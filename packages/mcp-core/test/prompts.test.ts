import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'

import { registerDraftInvoicePrompt } from '../src/prompts/draft-invoice.js'
import { INVOML_SPEC_URI } from '../src/resources/invoml-spec.js'

type PromptHandler = (args: Record<string, string>) => Promise<{ messages: unknown[] }>

function makeServerMock() {
  const handlers: Record<string, PromptHandler> = {}
  const server = {
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn((name: string, _config: unknown, handler: PromptHandler) => {
      handlers[name] = handler
    }),
  } as unknown as McpServer

  return {
    server,
    getHandler: (name: string) => {
      const h = handlers[name]
      if (!h) throw new Error(`No handler registered for prompt: ${name}`)
      return h
    },
  }
}

describe('draft_invoice_invoml prompt', () => {
  test('registers with name draft_invoice_invoml', () => {
    const { server } = makeServerMock()
    const client = { getInvomlSpec: vi.fn() } as unknown as Parameters<typeof registerDraftInvoicePrompt>[1]
    registerDraftInvoicePrompt(server, client)
    const calls = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0]).toBe('draft_invoice_invoml')
  })

  test('handler returns exactly 2 messages', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('InvoML spec text') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'Create an invoice for consulting' })
    expect(result.messages).toHaveLength(2)
  })

  test('first message is a resource with InvoML spec', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('InvoML spec content') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'Invoice request' })
    const first = result.messages[0] as {
      role: string
      content: { type: string; resource: { uri: string; text: string } }
    }
    expect(first.content.type).toBe('resource')
    expect(first.content.resource.uri).toBe(INVOML_SPEC_URI)
    expect(first.content.resource.text).toBe('InvoML spec content')
  })

  test('second message is text with output instructions', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('spec') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'Invoice request' })
    const second = result.messages[1] as { role: string; content: { type: string; text: string } }
    expect(second.content.type).toBe('text')
    expect(second.content.text).toContain('Output only raw JSON')
  })

  test('second message includes the original request', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('spec') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'Special consulting invoice request' })
    const second = result.messages[1] as { content: { text: string } }
    expect(second.content.text).toContain('Special consulting invoice request')
  })

  test('preserves language and forbids invented billing facts', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('spec') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'Crie uma fatura' })
    const second = result.messages[1] as { content: { text: string } }
    expect(second.content.text).toContain("Preserve the user's language")
    expect(second.content.text).toContain('Do not invent seller or client identities')
    expect(second.content.text).toContain('map it to to.content')
    expect(second.content.text).toContain('Never invent a generic client property')
    expect(second.content.text).toContain('Never place a payment object inside notes')
    expect(second.content.text).toContain('Crie uma fatura')
  })

  test('handler calls the service port', async () => {
    const { server, getHandler } = makeServerMock()
    const getInvomlSpec = vi.fn().mockResolvedValue('spec')
    const client = { getInvomlSpec } as unknown as Parameters<typeof registerDraftInvoicePrompt>[1]
    registerDraftInvoicePrompt(server, client)
    await getHandler('draft_invoice_invoml')({ request: 'req' })
    expect(getInvomlSpec).toHaveBeenCalledTimes(1)
  })

  test('both messages have role user', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('spec') } as unknown as Parameters<
      typeof registerDraftInvoicePrompt
    >[1]
    registerDraftInvoicePrompt(server, client)
    const result = await getHandler('draft_invoice_invoml')({ request: 'req' })
    for (const msg of result.messages) {
      expect((msg as { role: string }).role).toBe('user')
    }
  })
})
