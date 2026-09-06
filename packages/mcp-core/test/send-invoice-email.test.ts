import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { InvomptApiError } from '../src/error.js'
import { registerSendInvoiceEmailTool } from '../src/tools/send-invoice-email.js'

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>
type ToolConfig = {
  inputSchema: Record<string, z.ZodType>
  outputSchema: Record<string, z.ZodType>
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
}

function makeServerMock(): { server: McpServer; getHandler: (name: string) => ToolHandler; getConfig: (name: string) => ToolConfig } {
  const handlers: Record<string, ToolHandler> = {}
  const configs: Record<string, ToolConfig> = {}
  const server = {
    registerTool: vi.fn((name: string, config: ToolConfig, handler: ToolHandler) => {
      handlers[name] = handler
      configs[name] = config
    }),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
  } as unknown as McpServer

  return {
    server,
    getHandler: (name: string) => {
      const handler = handlers[name]
      if (!handler) throw new Error(`Tool ${name} was not registered.`)
      return handler
    },
    getConfig: (name: string) => {
      const config = configs[name]
      if (!config) throw new Error(`Tool ${name} was not registered.`)
      return config
    },
  }
}

function withGuestState<T extends Record<string, unknown>>(client: T, guest = false): T {
  return {
    ...client,
    isGuest: vi.fn().mockReturnValue(guest),
  } as T
}

function parseToolErrorText(result: { content: Array<{ text: string }>; isError?: boolean }): {
  success: false
  error: { code: string; message: string }
} {
  expect(result.isError).toBe(true)
  return JSON.parse(result.content[0]?.text ?? '{}') as {
    success: false
    error: { code: string; message: string }
  }
}

const sentResult = {
  invoiceId: 'inv_1',
  invoiceNumber: 'INV-0001',
  recipientEmail: 'client@billing.example.invalid',
  sentAt: '2026-09-06T00:00:00.000Z',
  emailLogId: 'log_1',
}

describe('send_invoice_email tool', () => {
  test('registers with correct name and annotations', () => {
    const { server, getConfig } = makeServerMock()
    registerSendInvoiceEmailTool(server, withGuestState({ sendInvoiceEmail: vi.fn() }))
    const config = getConfig('send_invoice_email')
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    })
  })

  test('calls client.sendInvoiceEmail and returns structured content plus receipt text only', async () => {
    const { server, getHandler, getConfig } = makeServerMock()
    const sendInvoiceEmail = vi.fn().mockResolvedValue(sentResult)
    registerSendInvoiceEmailTool(server, withGuestState({ sendInvoiceEmail }))

    const result = (await getHandler('send_invoice_email')({
      id: 'inv_1',
      recipientEmail: 'client@billing.example.invalid',
      recipientName: 'Client Name',
      subject: 'Your invoice',
      message: 'Please find the invoice attached.',
      cc: ['second@billing.example.invalid'],
    })) as { structuredContent: unknown; content: Array<{ text: string }>; isError?: boolean }

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(sentResult)
    expect(result.content[0]?.text).toBe('Invoice INV-0001 sent to client@billing.example.invalid.')
    expect(result.content[0]?.text).not.toContain('Your invoice')
    expect(result.content[0]?.text).not.toContain('Please find the invoice attached.')
    expect(result.content[0]?.text).not.toContain('second@billing.example.invalid')
    expect(sendInvoiceEmail).toHaveBeenCalledWith('inv_1', {
      recipientEmail: 'client@billing.example.invalid',
      recipientName: 'Client Name',
      subject: 'Your invoice',
      message: 'Please find the invoice attached.',
      cc: ['second@billing.example.invalid'],
    })

    const config = getConfig('send_invoice_email')
    const outputSchema = z.strictObject(config.outputSchema)
    expect(outputSchema.parse(sentResult)).toEqual(sentResult)
  })

  test('rejects an invalid recipient email', () => {
    const { server, getConfig } = makeServerMock()
    registerSendInvoiceEmailTool(server, withGuestState({ sendInvoiceEmail: vi.fn() }))
    const inputSchema = z.object(getConfig('send_invoice_email').inputSchema)
    const result = inputSchema.safeParse({ id: 'inv_1', recipientEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  test('rejects more than 5 cc addresses', () => {
    const { server, getConfig } = makeServerMock()
    registerSendInvoiceEmailTool(server, withGuestState({ sendInvoiceEmail: vi.fn() }))
    const inputSchema = z.object(getConfig('send_invoice_email').inputSchema)
    const result = inputSchema.safeParse({
      id: 'inv_1',
      recipientEmail: 'client@billing.example.invalid',
      cc: Array.from({ length: 6 }, (_, index) => `cc${index}@billing.example.invalid`),
    })
    expect(result.success).toBe(false)
  })

  test('propagates FORBIDDEN for a Guest connection', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState(
      {
        sendInvoiceEmail: vi
          .fn()
          .mockRejectedValue(new InvomptApiError('This connection is a Guest session.', 'FORBIDDEN', 403)),
      },
      true,
    )
    registerSendInvoiceEmailTool(server, client)
    const result = (await getHandler('send_invoice_email')({
      id: 'inv_1',
      recipientEmail: 'client@billing.example.invalid',
    })) as { content: Array<{ text: string }>; isError?: boolean }
    expect(parseToolErrorText(result).error.code).toBe('FORBIDDEN')
  })

  test('propagates NOT_FOUND when the invoice does not exist', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      sendInvoiceEmail: vi.fn().mockRejectedValue(new InvomptApiError('Invoice not found.', 'NOT_FOUND', 404)),
    })
    registerSendInvoiceEmailTool(server, client)
    const result = (await getHandler('send_invoice_email')({
      id: 'missing',
      recipientEmail: 'client@billing.example.invalid',
    })) as { content: Array<{ text: string }>; isError?: boolean }
    expect(parseToolErrorText(result).error.code).toBe('NOT_FOUND')
  })
})
