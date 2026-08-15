import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { InvomptApiError } from '../src/error.js'
import { registerArchiveInvoiceTool } from '../src/tools/archive-invoice.js'
import {
  CANONICAL_INVOML_MAX_BYTES,
  canonicalInvomlSchema,
  structuredInvomlSchema,
} from '../src/tools/client-schemas.js'
import { registerCreateClientTool } from '../src/tools/create-client.js'
import { registerCreateAccountClaimLinkTool } from '../src/tools/create-account-claim-link.js'
import { registerCreateInvoiceTool } from '../src/tools/create-invoice.js'
import { registerGetInvoiceTool } from '../src/tools/get-invoice.js'
import { registerGetSettingsTool } from '../src/tools/get-settings.js'
import { registerListInvoicesTool } from '../src/tools/list-invoices.js'
import { registerPingTool } from '../src/tools/ping.js'
import { registerRenewInvoiceLinkTool } from '../src/tools/renew-invoice-link.js'
import { registerUnarchiveInvoiceTool } from '../src/tools/unarchive-invoice.js'
import { registerUpdateInvoiceTool } from '../src/tools/update-invoice.js'
import { registerUpdateSettingsTool } from '../src/tools/update-settings.js'

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

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

function makeServerMock(): { server: McpServer; getHandler: (name: string) => ToolHandler } {
  const handlers: Record<string, ToolHandler> = {}
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers[name] = handler
    }),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
  } as unknown as McpServer

  return {
    server,
    getHandler: (name: string) => {
      const h = handlers[name]
      if (!h) throw new Error(`No handler registered for tool: ${name}`)
      return h
    },
  }
}

const VALID_INVOML = JSON.stringify({
  $invoml: '1.0',
  meta: { documentType: 'invoice', number: 'EXAMPLE-MCP-0007', issueDate: '2030-01-15', currency: 'SGD' },
  items: [{ description: 'Synthetic service sample', quantity: 1, unitPrice: 318.75 }],
})
const VALID_STRUCTURED_DOCUMENT = {
  $invoml: '1.0' as const,
  meta: {
    documentType: 'invoice' as const,
    number: 'CHATGPT-LIKE-0001',
    issueDate: '2030-01-15',
    dueDate: '2030-02-15',
    expiryDate: '2030-03-15',
    reference: 'PO-42',
    currency: 'usd',
    locale: 'en-US',
  },
  to: {
    name: 'Northstar Example Studio',
    address: { lines: ['42 Example Road', 'Bangkok 10110'] },
    countryCode: 'th',
  },
  items: [{ description: 'Structured sample', quantity: 2, unitPrice: 25.5 }],
}
const IDEMPOTENCY_KEY = 'invoice-test-key'

const invoiceResult = {
  invoiceId: 'inv_example_007',
  invoiceNumber: 'EXAMPLE-MCP-0007',
  status: 'approved',
  total: 318.75,
  currency: 'SGD',
  dueDate: '2030-02-15',
  url: 'https://documents.example.invalid/invoice/inv_example_007',
  version: 1,
  replayed: false,
}
const updateInvoiceResult = {
  invoiceId: 'inv_example_007',
  invoiceNumber: 'EXAMPLE-MCP-0007',
  status: 'approved',
  total: 318.75,
  currency: 'SGD',
  dueDate: '2030-02-15',
  url: 'https://documents.example.invalid/invoice/inv_example_007',
  version: 2,
  replayed: false,
}
const invoiceReadBack = {
  invoice: {
    id: invoiceResult.invoiceId,
    invoiceNumber: invoiceResult.invoiceNumber,
    status: invoiceResult.status,
    total: invoiceResult.total,
    currency: invoiceResult.currency,
    dueDate: invoiceResult.dueDate,
    version: invoiceResult.version,
  },
}

const invoiceListResult = {
  invoices: [
    {
      id: 'inv_1',
      invoiceNumber: 'INV-001',
      version: 1,
      clientName: 'Northstar Example Studio',
      total: 100,
      currency: 'USD',
      status: 'approved',
      dueDate: null,
      sent: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  hasMore: false,
}

const invoiceDetail = {
  invoice: {
    id: 'inv_1',
    invoiceNumber: 'INV-001',
    version: 1,
    clientName: 'Northstar Example Studio',
    total: 100,
    currency: 'USD',
    status: 'approved',
    dueDate: null,
    templateId: 'standard',
    invomlContent: 'meta:\n  invoice_number: INV-001',
    url: 'https://documents.example.invalid/invoice/inv_example_001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

const settingsResult = {
  settings: {
    companyName: 'Northstar Example Studio',
    currency: 'USD',
    invoicePrefix: 'INV',
    invoiceNumberFormat: 'sequential',
    defaultDueDate: 'net30',
    senderInfo: 'Northstar Example Studio\nExample district',
    paymentInfo: {
      title: 'Payment Information',
      content: 'EXAMPLE PAYMENT REFERENCE: NOT-A-REAL-ACCOUNT',
      paymentTerms: 'Net 30',
    },
  },
}

const pingResult = {
  status: 'ok' as const,
  timestamp: '2026-03-31T00:00:00.000Z',
  provisioned: true,
  account: { plan: 'pro' },
}

const guestPingResult = {
  status: 'ok' as const,
  timestamp: '2026-03-31T00:00:00.000Z',
  provisioned: false,
  guestName: 'Crazy Weasel',
  guestReference: 'guest_abcdefghijklmnopqrstuv',
}

describe('ping tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ ping: vi.fn() }) as unknown as Parameters<typeof registerPingTool>[1]
    registerPingTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('ping')
  })

  test('calls client.ping and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({ ping: vi.fn().mockResolvedValue(pingResult) }) as unknown as Parameters<
      typeof registerPingTool
    >[1]
    registerPingTool(server, client)
    const result = (await getHandler('ping')({})) as {
      structuredContent: unknown
      isError?: boolean
      content: Array<{ text: string }>
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(pingResult)
    expect(result.content[0]?.text).toContain('Plan: pro')
    expect(result.content[0]?.text).toContain('Workspace: provisioned')
  })

  test('shows minimal text when no account info', async () => {
    const { server, getHandler } = makeServerMock()
    const minimalPing = {
      status: 'ok' as const,
      timestamp: '2026-03-31T00:00:00.000Z',
      provisioned: false,
    }
    const client = withGuestState({ ping: vi.fn().mockResolvedValue(minimalPing) }) as unknown as Parameters<
      typeof registerPingTool
    >[1]
    registerPingTool(server, client)
    const result = (await getHandler('ping')({})) as { content: Array<{ text: string }> }
    expect(result.content[0]?.text).toBe('Status: ok | Workspace: not provisioned')
    expect(result.content[0]?.text).not.toContain('Plan')
  })

  test('shows the guest connection without commercial limit fields', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({ ping: vi.fn().mockResolvedValue(guestPingResult) }, true) as unknown as Parameters<
      typeof registerPingTool
    >[1]
    registerPingTool(server, client)
    const result = (await getHandler('ping')({})) as {
      structuredContent: Record<string, unknown>
      content: Array<{ text: string }>
    }
    expect(result.content[0]?.text).toContain('Guest: Crazy Weasel')
    expect(result.content[0]?.text).toContain('Connection: guest')
    expect(result.content[0]?.text).toContain('Workspace: not provisioned')
    expect(result.structuredContent).toEqual(guestPingResult)
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      ping: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'ERR')),
    }) as unknown as Parameters<typeof registerPingTool>[1]
    registerPingTool(server, client)
    const result = (await getHandler('ping')({})) as { isError: boolean }
    expect(result.isError).toBe(true)
  })
})

describe('create_invoice tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = { createInvoice: vi.fn() } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('create_invoice')
  })

  test('describes the structured document path and its forbidden confusions', () => {
    const { server } = makeServerMock()
    const client = { createInvoice: vi.fn() } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)
    const config = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      description: string
    }
    expect(config.description).toContain('exactly one: document')
    expect(config.description).toContain('address:{lines:[...]}')
    expect(config.description).toContain('item.taxRate')
    expect(config.description).toContain('taxCategory')
  })

  test('calls client.createInvoice and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const client = {
      createInvoice: vi.fn().mockResolvedValue(invoiceResult),
      getInvoice: vi.fn().mockResolvedValue(invoiceReadBack),
    } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)
    const result = (await getHandler('create_invoice')({
      invoml: VALID_INVOML,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      structuredContent: unknown
      isError?: boolean
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(invoiceResult)
    expect(client.createInvoice).toHaveBeenCalledWith({
      invoml: VALID_INVOML,
      templateId: undefined,
      clientId: undefined,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
    expect(client.getInvoice).toHaveBeenCalledWith(invoiceResult.invoiceId)
  })

  test('normalizes a ChatGPT-like structured document deterministically', async () => {
    const { server, getHandler } = makeServerMock()
    const client = {
      createInvoice: vi.fn().mockResolvedValue({ ...invoiceResult, invoiceNumber: 'CHATGPT-LIKE-0001' }),
      getInvoice: vi.fn().mockResolvedValue({
        invoice: { ...invoiceReadBack.invoice, invoiceNumber: 'CHATGPT-LIKE-0001' },
      }),
    } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)

    await getHandler('create_invoice')({ document: VALID_STRUCTURED_DOCUMENT, idempotencyKey: IDEMPOTENCY_KEY })

    expect(client.createInvoice).toHaveBeenCalledWith({
      invoml:
        '{"$invoml":"1.0","meta":{"documentType":"invoice","number":"CHATGPT-LIKE-0001","issueDate":"2030-01-15","dueDate":"2030-02-15","expiryDate":"2030-03-15","reference":"PO-42","currency":"USD","locale":"en-US"},"to":{"name":"Northstar Example Studio","address":{"lines":["42 Example Road","Bangkok 10110"]},"countryCode":"TH"},"items":[{"description":"Structured sample","quantity":2,"unitPrice":25.5}]}',
      templateId: undefined,
      clientId: undefined,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test.each([
    ['neither input', {}],
    ['both input forms', { invoml: VALID_INVOML, document: VALID_STRUCTURED_DOCUMENT }],
  ])('rejects %s without calling the API client', async (_label, input) => {
    const { server, getHandler } = makeServerMock()
    const createInvoice = vi.fn().mockResolvedValue(invoiceResult)
    const client = { createInvoice } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)

    const result = (await getHandler('create_invoice')({ ...input, idempotencyKey: IDEMPOTENCY_KEY })) as {
      isError: boolean
      content: Array<{ text: string }>
    }

    expect(parseToolErrorText(result).error).toEqual({
      code: 'INVALID_INVOML_INPUT',
      message: expect.stringContaining('exactly one'),
    })
    expect(createInvoice).not.toHaveBeenCalled()
  })

  test('fails closed when the server rewrites the authored invoice number', async () => {
    const { server, getHandler } = makeServerMock()
    const getInvoice = vi.fn()
    const client = {
      createInvoice: vi.fn().mockResolvedValue({
        ...invoiceResult,
        invoiceNumber: 'INV-00007',
      }),
      getInvoice,
    } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)

    const result = (await getHandler('create_invoice')({
      invoml: VALID_INVOML,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      content: Array<{ text: string }>
      isError: boolean
    }

    expect(parseToolErrorText(result).error).toEqual({
      code: 'CANONICAL_INVOICE_NUMBER_MISMATCH',
      message: expect.stringContaining('Created invoice'),
    })
    expect(result.content[0]?.text).toContain('INV-00007')
    expect(result.content[0]?.text).toContain('EXAMPLE-MCP-0007')
    expect(getInvoice).not.toHaveBeenCalled()
  })

  test('returns tool error when client throws', async () => {
    const { server, getHandler } = makeServerMock()
    const client = {
      createInvoice: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'BAD')),
    } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)
    const result = (await getHandler('create_invoice')({
      invoml: VALID_INVOML,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { isError: boolean }
    expect(result.isError).toBe(true)
  })

  test('rejects malformed InvoML JSON without calling the API client', async () => {
    const { server, getHandler } = makeServerMock()
    const createInvoice = vi.fn().mockResolvedValue(invoiceResult)
    const client = { createInvoice } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)
    const result = (await getHandler('create_invoice')({
      invoml: 'not json at all',
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      isError: boolean
      content: Array<{ text: string }>
    }
    expect(result.isError).toBe(true)
    expect(parseToolErrorText(result).error).toEqual({
      code: 'INVALID_INVOML',
      message: 'Invalid InvoML: expected a valid JSON object.',
    })
    expect(createInvoice).not.toHaveBeenCalled()
  })

  test.each(['null', '[]', '"invoice"', '123'])(
    'rejects non-object InvoML JSON %s without calling the API client',
    async (invoml) => {
      const { server, getHandler } = makeServerMock()
      const createInvoice = vi.fn().mockResolvedValue(invoiceResult)
      const client = { createInvoice } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
      registerCreateInvoiceTool(server, client)

      const result = (await getHandler('create_invoice')({ invoml, idempotencyKey: IDEMPOTENCY_KEY })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(parseToolErrorText(result).error).toEqual({
        code: 'INVALID_INVOML',
        message: 'Invalid InvoML: expected a JSON object.',
      })
      expect(createInvoice).not.toHaveBeenCalled()
    },
  )

  test('delegates semantic validation for valid JSON objects to the API', async () => {
    const { server, getHandler } = makeServerMock()
    const createInvoice = vi
      .fn()
      .mockRejectedValue(new InvomptApiError('meta.currency: Currency is required.', 'INVALID_INVOML', 400))
    const client = { createInvoice } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
    registerCreateInvoiceTool(server, client)

    const result = (await getHandler('create_invoice')({
      invoml: '{}',
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      isError: boolean
      content: Array<{ text: string }>
    }

    expect(parseToolErrorText(result).error.message).toBe('meta.currency: Currency is required.')
    expect(createInvoice).toHaveBeenCalledOnce()
  })
})

describe('structured InvoML schema', () => {
  test('accepts supported document types and minimal line-item fields', () => {
    for (const documentType of ['invoice', 'quote', 'estimate', 'receipt', 'credit_note'] as const) {
      expect(structuredInvomlSchema.safeParse({ ...VALID_STRUCTURED_DOCUMENT, meta: { ...VALID_STRUCTURED_DOCUMENT.meta, documentType } }).success).toBe(true)
    }
  })

  test.each([
    ['item.taxRate', { items: [{ description: 'Bad', quantity: 1, unitPrice: 10, taxRate: 0.2 }] }],
    ['string address', { to: { content: { name: 'Bad', address: 'one line' } } }],
    ['mixed party forms', { to: { content: { name: 'Bad', content: 'also freeform' } } }],
    ['unsupported taxCategory', { meta: { taxCategory: 'standard' } }],
  ])('rejects %s instead of passing an ambiguous payload downstream', (_label, invalid) => {
    const candidate = {
      ...VALID_STRUCTURED_DOCUMENT,
      ...invalid,
      meta: { ...VALID_STRUCTURED_DOCUMENT.meta, ...('meta' in invalid ? invalid.meta : {}) },
      items: 'items' in invalid ? invalid.items : VALID_STRUCTURED_DOCUMENT.items,
      to: 'to' in invalid ? invalid.to : VALID_STRUCTURED_DOCUMENT.to,
    }
    expect(structuredInvomlSchema.safeParse(candidate).success).toBe(false)
  })
})

describe('canonical InvoML byte limit', () => {
  test('accepts exactly 128 KiB of single-byte UTF-8 input', () => {
    expect(canonicalInvomlSchema.safeParse('a'.repeat(CANONICAL_INVOML_MAX_BYTES)).success).toBe(true)
  })

  test('rejects one byte beyond 128 KiB', () => {
    const result = canonicalInvomlSchema.safeParse('a'.repeat(CANONICAL_INVOML_MAX_BYTES + 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('128 KiB UTF-8')
    }
  })

  test('counts multibyte UTF-8 bytes rather than JavaScript code units', () => {
    const exact = `${'€'.repeat(43_690)}ab`
    const over = `${exact}€`
    expect(new TextEncoder().encode(exact)).toHaveLength(CANONICAL_INVOML_MAX_BYTES)
    expect(canonicalInvomlSchema.safeParse(exact).success).toBe(true)
    expect(new TextEncoder().encode(over).byteLength).toBeGreaterThan(CANONICAL_INVOML_MAX_BYTES)
    expect(canonicalInvomlSchema.safeParse(over).success).toBe(false)
  })
})

describe('list_invoices tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ listInvoices: vi.fn() }) as unknown as Parameters<
      typeof registerListInvoicesTool
    >[1]
    registerListInvoicesTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('list_invoices')
  })

  test('calls client.listInvoices and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      listInvoices: vi.fn().mockResolvedValue(invoiceListResult),
    }) as unknown as Parameters<typeof registerListInvoicesTool>[1]
    registerListInvoicesTool(server, client)
    const result = (await getHandler('list_invoices')({})) as { structuredContent: unknown; isError?: boolean }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(invoiceListResult)
  })

  test('passes query params to client', async () => {
    const { server, getHandler } = makeServerMock()
    const listInvoices = vi.fn().mockResolvedValue(invoiceListResult)
    const client = withGuestState({ listInvoices }) as unknown as Parameters<typeof registerListInvoicesTool>[1]
    registerListInvoicesTool(server, client)
    await getHandler('list_invoices')({ page: 2, limit: 10, search: 'acme', status: 'approved' })
    expect(listInvoices).toHaveBeenCalledWith({ page: 2, limit: 10, search: 'acme', status: 'approved' })
  })

  test('supports listing invoices in guest mode', async () => {
    const { server, getHandler } = makeServerMock()
    const listInvoices = vi.fn().mockResolvedValue(invoiceListResult)
    const client = withGuestState({ listInvoices }, true) as unknown as Parameters<typeof registerListInvoicesTool>[1]
    registerListInvoicesTool(server, client)
    const result = (await getHandler('list_invoices')({})) as { structuredContent: unknown; isError?: boolean }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(invoiceListResult)
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      listInvoices: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'ERR')),
    }) as unknown as Parameters<typeof registerListInvoicesTool>[1]
    registerListInvoicesTool(server, client)
    const result = (await getHandler('list_invoices')({})) as { isError: boolean }
    expect(result.isError).toBe(true)
  })
})

describe('get_invoice tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ getInvoice: vi.fn() }) as unknown as Parameters<typeof registerGetInvoiceTool>[1]
    registerGetInvoiceTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('get_invoice')
  })

  test('calls client.getInvoice with id and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const getInvoice = vi.fn().mockResolvedValue(invoiceDetail)
    const client = withGuestState({ getInvoice }) as unknown as Parameters<typeof registerGetInvoiceTool>[1]
    registerGetInvoiceTool(server, client)
    const result = (await getHandler('get_invoice')({ id: 'inv_1' })) as {
      structuredContent: unknown
      isError?: boolean
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(invoiceDetail)
    expect(getInvoice).toHaveBeenCalledWith('inv_1')
  })

  test('supports reading invoices in guest mode', async () => {
    const { server, getHandler } = makeServerMock()
    const getInvoice = vi.fn().mockResolvedValue(invoiceDetail)
    const client = withGuestState({ getInvoice }, true) as unknown as Parameters<typeof registerGetInvoiceTool>[1]
    registerGetInvoiceTool(server, client)
    const result = (await getHandler('get_invoice')({ id: 'inv_1' })) as { structuredContent: unknown }
    expect(result.structuredContent).toEqual(invoiceDetail)
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      getInvoice: vi.fn().mockRejectedValue(new InvomptApiError('Not found', 'NOT_FOUND', 404)),
    }) as unknown as Parameters<typeof registerGetInvoiceTool>[1]
    registerGetInvoiceTool(server, client)
    const result = (await getHandler('get_invoice')({ id: 'bad' })) as { isError: boolean }
    expect(result.isError).toBe(true)
  })
})

describe('create_client tool', () => {
  test('returns duplicate candidates as normal structured content for user confirmation', async () => {
    const { server, getHandler } = makeServerMock()
    const duplicateResult = {
      created: false,
      duplicateCandidates: [
        {
          id: 'client_existing',
          name: 'Existing Example Client',
          email: 'billing@northstar.example.invalid',
          version: 3,
        },
      ],
      requiresDuplicateConfirmation: true,
    }
    const createClient = vi.fn().mockResolvedValue(duplicateResult)
    const client = withGuestState({ createClient }, true) as unknown as Parameters<typeof registerCreateClientTool>[1]
    registerCreateClientTool(server, client)

    const input = {
      name: 'Existing Example Client',
      email: 'billing@northstar.example.invalid',
      idempotencyKey: 'create-client-duplicate',
    }
    const result = (await getHandler('create_client')(input)) as {
      structuredContent: Record<string, unknown>
      content: Array<{ text: string }>
      isError?: boolean
    }
    const toolConfig = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      outputSchema: Record<string, z.ZodType>
    }

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(duplicateResult)
    expect(z.strictObject(toolConfig.outputSchema).parse(result.structuredContent)).toEqual(duplicateResult)
    expect(Object.keys(result.structuredContent).sort()).toEqual([
      'created',
      'duplicateCandidates',
      'requiresDuplicateConfirmation',
    ])
    expect(Object.keys(duplicateResult.duplicateCandidates[0] ?? {}).sort()).toEqual([
      'email',
      'id',
      'name',
      'version',
    ])
    expect(result.content[0]?.text).toBe(
      'Possible duplicate saved client(s): Existing Example Client (client_existing). Ask before creating another.',
    )
    expect(createClient).toHaveBeenCalledWith(input)
  })
})

describe('update_invoice tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ updateInvoice: vi.fn() }) as unknown as Parameters<
      typeof registerUpdateInvoiceTool
    >[1]
    registerUpdateInvoiceTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('update_invoice')
  })

  test('calls client.updateInvoice and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const updateInvoice = vi.fn().mockResolvedValue(updateInvoiceResult)
    const client = withGuestState({ updateInvoice }) as unknown as Parameters<typeof registerUpdateInvoiceTool>[1]
    registerUpdateInvoiceTool(server, client)
    const result = (await getHandler('update_invoice')({
      id: 'inv_1',
      templateId: 'minimal',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      structuredContent: unknown
      isError?: boolean
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(updateInvoiceResult)
    expect((result as { content: Array<{ text: string }> }).content[0]?.text).toContain(updateInvoiceResult.url)
    expect(updateInvoice).toHaveBeenCalledWith('inv_1', {
      invoml: undefined,
      templateId: 'minimal',
      clientId: undefined,
      numberCorrection: undefined,
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test('supports updating invoices in guest mode', async () => {
    const { server, getHandler } = makeServerMock()
    const updateInvoice = vi.fn().mockResolvedValue(updateInvoiceResult)
    const client = withGuestState({ updateInvoice }, true) as unknown as Parameters<typeof registerUpdateInvoiceTool>[1]
    registerUpdateInvoiceTool(server, client)
    const result = (await getHandler('update_invoice')({
      id: 'inv_1',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { structuredContent: unknown }
    expect(result.structuredContent).toEqual(updateInvoiceResult)
  })

  test('passes an explicit audited number correction to the API client', async () => {
    const { server, getHandler } = makeServerMock()
    const updateInvoice = vi.fn().mockResolvedValue(updateInvoiceResult)
    const client = withGuestState({ updateInvoice }, true) as unknown as Parameters<typeof registerUpdateInvoiceTool>[1]
    registerUpdateInvoiceTool(server, client)
    const correctedInvoml = VALID_INVOML

    const result = (await getHandler('update_invoice')({
      id: 'inv_1',
      invoml: correctedInvoml,
      templateId: 'professional',
      numberCorrection: {
        from: 'INV-00007',
        reason: 'Restore the explicit number supplied during creation.',
      },
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { structuredContent: unknown }

    expect(result.structuredContent).toEqual(updateInvoiceResult)
    expect(updateInvoice).toHaveBeenCalledWith('inv_1', {
      invoml: correctedInvoml,
      templateId: 'professional',
      clientId: undefined,
      numberCorrection: {
        from: 'INV-00007',
        reason: 'Restore the explicit number supplied during creation.',
      },
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      updateInvoice: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'ERR')),
    }) as unknown as Parameters<typeof registerUpdateInvoiceTool>[1]
    registerUpdateInvoiceTool(server, client)
    const result = (await getHandler('update_invoice')({
      id: 'inv_1',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { isError: boolean }
    expect(result.isError).toBe(true)
  })

  test('delegates canonical InvoML validation to the API', async () => {
    const { server, getHandler } = makeServerMock()
    const updateInvoice = vi
      .fn()
      .mockRejectedValue(new InvomptApiError('items[0].unitPrice: Expected a number.', 'INVALID_INVOML', 400))
    const client = withGuestState({ updateInvoice }) as unknown as Parameters<typeof registerUpdateInvoiceTool>[1]
    registerUpdateInvoiceTool(server, client)
    const result = (await getHandler('update_invoice')({
      id: 'inv_1',
      invoml: 'not json at all',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      content: Array<{ text: string }>
      isError?: boolean
    }

    expect(parseToolErrorText(result).error).toEqual({
      code: 'INVALID_INVOML',
      message: 'items[0].unitPrice: Expected a number.',
    })
    expect(updateInvoice).toHaveBeenCalledWith('inv_1', {
      invoml: 'not json at all',
      templateId: undefined,
      clientId: undefined,
      numberCorrection: undefined,
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })
})

describe('archive_invoice tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ archiveInvoice: vi.fn() }) as unknown as Parameters<
      typeof registerArchiveInvoiceTool
    >[1]
    registerArchiveInvoiceTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('archive_invoice')
  })

  test('calls client.archiveInvoice and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const archiveInvoice = vi
      .fn()
      .mockResolvedValue({ invoiceId: 'inv_1', status: 'archived', version: 2, replayed: false })
    const client = withGuestState({ archiveInvoice }) as unknown as Parameters<typeof registerArchiveInvoiceTool>[1]
    registerArchiveInvoiceTool(server, client)
    const result = (await getHandler('archive_invoice')({
      id: 'inv_1',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      structuredContent: unknown
      isError?: boolean
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual({
      invoiceId: 'inv_1',
      status: 'archived',
      version: 2,
      replayed: false,
    })
    expect(archiveInvoice).toHaveBeenCalledWith('inv_1', {
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test('supports archiving invoices in guest mode', async () => {
    const { server, getHandler } = makeServerMock()
    const archiveInvoice = vi
      .fn()
      .mockResolvedValue({ invoiceId: 'inv_1', status: 'archived', version: 2, replayed: false })
    const client = withGuestState({ archiveInvoice }, true) as unknown as Parameters<
      typeof registerArchiveInvoiceTool
    >[1]
    registerArchiveInvoiceTool(server, client)
    const result = (await getHandler('archive_invoice')({
      id: 'inv_1',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { structuredContent: unknown }
    expect(result.structuredContent).toEqual({
      invoiceId: 'inv_1',
      status: 'archived',
      version: 2,
      replayed: false,
    })
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      archiveInvoice: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'ERR')),
    }) as unknown as Parameters<typeof registerArchiveInvoiceTool>[1]
    registerArchiveInvoiceTool(server, client)
    const result = (await getHandler('archive_invoice')({
      id: 'inv_1',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { isError: boolean }
    expect(result.isError).toBe(true)
  })
})

describe('renew_invoice_link tool', () => {
  const renewed = {
    invoiceId: 'inv_1',
    url: 'https://documents.example.invalid/preview/replacement',
    expiresAt: '2026-08-02T00:00:00.000Z',
    replayed: false,
  }

  test.each([false, true])('is callable in managed/guest mode (guest=%s)', async (guest) => {
    const { server, getHandler } = makeServerMock()
    const renewInvoiceLink = vi.fn().mockResolvedValue(renewed)
    const client = withGuestState({ renewInvoiceLink }, guest) as unknown as Parameters<
      typeof registerRenewInvoiceLinkTool
    >[1]
    registerRenewInvoiceLinkTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        annotations: expect.objectContaining({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        }),
      }),
    )

    const result = (await getHandler('renew_invoice_link')({
      id: 'inv_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      structuredContent: unknown
      content: Array<{ text: string }>
      isError?: boolean
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(renewed)
    expect(result.content[0]?.text).toContain(renewed.url)
    expect(renewInvoiceLink).toHaveBeenCalledWith('inv_1', {
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test('returns a structured tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      renewInvoiceLink: vi.fn().mockRejectedValue(new InvomptApiError('Conflict', 'IDEMPOTENCY_CONFLICT', 409)),
    }) as unknown as Parameters<typeof registerRenewInvoiceLinkTool>[1]
    registerRenewInvoiceLinkTool(server, client)
    const result = (await getHandler('renew_invoice_link')({
      id: 'inv_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { content: Array<{ text: string }>; isError?: boolean }
    expect(parseToolErrorText(result).error.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})

describe('get_settings tool', () => {
  test('registers with correct name', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ getSettings: vi.fn() }) as unknown as Parameters<typeof registerGetSettingsTool>[1]
    registerGetSettingsTool(server, client)
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('get_settings')
  })

  test('calls client.getSettings and returns structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      getSettings: vi.fn().mockResolvedValue(settingsResult),
    }) as unknown as Parameters<typeof registerGetSettingsTool>[1]
    registerGetSettingsTool(server, client)
    const result = (await getHandler('get_settings')({})) as {
      structuredContent: unknown
      isError?: boolean
      content: Array<{ text: string }>
    }
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(settingsResult)
  })

  test('uses fallback text when companyName and currency are null', async () => {
    const { server, getHandler } = makeServerMock()
    const nullSettings = {
      settings: { ...settingsResult.settings, companyName: null, currency: null },
    }
    const client = withGuestState({
      getSettings: vi.fn().mockResolvedValue(nullSettings),
    }) as unknown as Parameters<typeof registerGetSettingsTool>[1]
    registerGetSettingsTool(server, client)
    const result = (await getHandler('get_settings')({})) as { content: Array<{ text: string }> }
    expect(result.content[0]?.text).toContain('your company')
    expect(result.content[0]?.text).toContain('no currency set')
  })

  test('supports reading settings in guest mode', async () => {
    const { server, getHandler } = makeServerMock()
    const getSettings = vi.fn().mockResolvedValue(settingsResult)
    const client = withGuestState({ getSettings }, true) as unknown as Parameters<typeof registerGetSettingsTool>[1]
    registerGetSettingsTool(server, client)
    const result = (await getHandler('get_settings')({})) as { structuredContent: unknown }
    expect(result.structuredContent).toEqual(settingsResult)
  })

  test('returns tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      getSettings: vi.fn().mockRejectedValue(new InvomptApiError('Bad', 'ERR')),
    }) as unknown as Parameters<typeof registerGetSettingsTool>[1]
    registerGetSettingsTool(server, client)
    const result = (await getHandler('get_settings')({})) as { isError: boolean }
    expect(result.isError).toBe(true)
  })
})

describe('update_settings tool', () => {
  test('registers with the correct name and preserves a partial input exactly', async () => {
    const { server, getHandler } = makeServerMock()
    const updateSettings = vi.fn().mockResolvedValue({ ...settingsResult, replayed: false })
    const client = withGuestState({ updateSettings }) as unknown as Parameters<typeof registerUpdateSettingsTool>[1]
    registerUpdateSettingsTool(server, client)

    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('update_settings')

    const input = {
      companyName: null,
      paymentInfo: { paymentTerms: 'Due on receipt' },
      idempotencyKey: 'settings-update-key',
    }
    const result = (await getHandler('update_settings')(input)) as {
      structuredContent: unknown
      content: Array<{ text: string }>
      isError?: boolean
    }

    expect(result.isError).toBeUndefined()
    expect(updateSettings).toHaveBeenCalledWith(input)
    expect(result.structuredContent).toEqual({ ...settingsResult, replayed: false })
    expect(result.content[0]?.text).toBe('Invoice settings updated.')
  })

  test('supports replay and guest mode without inventing an issuer', async () => {
    const { server, getHandler } = makeServerMock()
    const canonical = {
      settings: { ...settingsResult.settings, companyName: null, currency: null },
      replayed: true,
    }
    const updateSettings = vi.fn().mockResolvedValue(canonical)
    const client = withGuestState({ updateSettings }, true) as unknown as Parameters<
      typeof registerUpdateSettingsTool
    >[1]
    registerUpdateSettingsTool(server, client)

    const result = (await getHandler('update_settings')({
      currency: null,
      idempotencyKey: 'settings-replay-key',
    })) as { structuredContent: unknown; content: Array<{ text: string }> }

    expect(result.structuredContent).toEqual(canonical)
    expect(result.content[0]?.text).toBe('Invoice settings replayed safely.')
    expect(updateSettings).toHaveBeenCalledWith({
      currency: null,
      idempotencyKey: 'settings-replay-key',
    })
  })

  test('returns a structured tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      updateSettings: vi.fn().mockRejectedValue(new InvomptApiError('Conflict', 'IDEMPOTENCY_CONFLICT', 409)),
    }) as unknown as Parameters<typeof registerUpdateSettingsTool>[1]
    registerUpdateSettingsTool(server, client)

    const result = (await getHandler('update_settings')({
      senderInfo: 'Known sender only',
      idempotencyKey: 'settings-conflict-key',
    })) as { content: Array<{ text: string }>; isError?: boolean }

    expect(parseToolErrorText(result).error.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})

describe('get_invoice null branches', () => {
  test('uses 0 as fallback when invoice total is null', async () => {
    const { server, getHandler } = makeServerMock()
    const nullTotalDetail = { invoice: { ...invoiceDetail.invoice, total: null } }
    const client = withGuestState({
      getInvoice: vi.fn().mockResolvedValue(nullTotalDetail),
    }) as unknown as Parameters<typeof registerGetInvoiceTool>[1]
    registerGetInvoiceTool(server, client)
    const result = (await getHandler('get_invoice')({ id: 'inv_1' })) as { content: Array<{ text: string }> }
    expect(result.content[0]?.text).toContain('0')
  })
})

describe('list_invoices zero total branch', () => {
  test('shows page 1/1 when total is 0', async () => {
    const { server, getHandler } = makeServerMock()
    const emptyList = { invoices: [], total: 0, page: 1, limit: 20, hasMore: false }
    const client = withGuestState({ listInvoices: vi.fn().mockResolvedValue(emptyList) }) as unknown as Parameters<
      typeof registerListInvoicesTool
    >[1]
    registerListInvoicesTool(server, client)
    const result = (await getHandler('list_invoices')({})) as { content: Array<{ text: string }> }
    expect(result.content[0]?.text).toContain('1/1')
  })
})
test('presents guest invoice creation without commercial limit fields', async () => {
  const { server, getHandler } = makeServerMock()
  const client = {
    createInvoice: vi.fn().mockResolvedValue({
      ...invoiceResult,
      guestName: 'Crazy Weasel',
      guestReference: 'guest_abcdefghijklmnopqrstuv',
    }),
    getInvoice: vi.fn().mockResolvedValue(invoiceReadBack),
  } as unknown as Parameters<typeof registerCreateInvoiceTool>[1]
  registerCreateInvoiceTool(server, client)
  const result = (await getHandler('create_invoice')({
    invoml: VALID_INVOML,
    idempotencyKey: IDEMPOTENCY_KEY,
  })) as {
    structuredContent: Record<string, unknown>
    content: Array<{ text: string }>
  }
  expect(result.content[0]?.text).toContain("Crazy Weasel (guest_abcdefghijklmnopqrstuv)'s invoice")
  expect(result.structuredContent).toEqual({
    ...invoiceResult,
    guestName: 'Crazy Weasel',
    guestReference: 'guest_abcdefghijklmnopqrstuv',
  })
})

describe('create_account_claim_link tool', () => {
  test('registers an input-free, non-idempotent Guest claim-link mutation', async () => {
    const { server } = makeServerMock()
    const claimResult = {
      claimUrl: 'https://invompt.com/claim/example',
      expiresAt: '2026-08-10T12:00:00.000Z',
    }
    const createAccountClaimLink = vi.fn().mockResolvedValue(claimResult)
    const client = {
      isGuest: () => true,
      createAccountClaimLink,
    } as unknown as Parameters<typeof registerCreateAccountClaimLinkTool>[1]
    registerCreateAccountClaimLinkTool(server, client)

    const [name, config] = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      {
        description: string
        inputSchema: Record<string, unknown>
        outputSchema: Record<string, { safeParse: (value: unknown) => { success: boolean } }>
        annotations: Record<string, boolean>
      },
    ]
    expect(name).toBe('create_account_claim_link')
    expect(Object.keys(config.inputSchema)).toEqual([])
    expect(Object.keys(config.outputSchema).sort()).toEqual(['claimUrl', 'expiresAt'].sort())
    const credentialedClaimUrl = new URL('https://invompt.com/claim/example')
    credentialedClaimUrl.username = 'attacker'
    for (const url of [
      claimResult.claimUrl,
      'https://www.invompt.com/claim/example',
      'https://invompt-git-branch-4riel.vercel.app/claim/example',
      'https://invompt-preview-invo7.vercel.app/claim/example',
      'http://localhost:3100/claim/example',
      'https://localhost:3100/claim/example',
      'http://127.0.0.1:3100/claim/example',
      'https://[::1]:3100/claim/example',
    ]) {
      expect(config.outputSchema.claimUrl?.safeParse(url).success).toBe(true)
    }
    for (const url of [
      'https://attacker.example/claim/example',
      'https://invompt.com.attacker.example/claim/example',
      'https://invompt-preview-attacker.vercel.app/claim/example',
      credentialedClaimUrl.href,
      'http://invompt.com/claim/example',
      'http://localhost.attacker.example/claim/example',
      'http://0.0.0.0:3100/claim/example',
      'javascript:alert(1)',
    ]) {
      expect(config.outputSchema.claimUrl?.safeParse(url).success).toBe(false)
    }
    expect(config.outputSchema.expiresAt?.safeParse(claimResult.expiresAt).success).toBe(true)
    expect(config.description).toContain('Guest-account-only')
    expect(config.description).toContain('transport-neutral')
    expect(config.description).toContain('backend decides')
    expect(config.description).toContain('presented once')
    expect(config.annotations).toEqual(
      expect.objectContaining({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      }),
    )
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as ToolHandler
    const result = (await handler({})) as {
      content: Array<{ text: string }>
      structuredContent: typeof claimResult
    }

    expect(result.structuredContent).toEqual(claimResult)
    expect(result.content[0]?.text).not.toContain(claimResult.claimUrl)
    expect(result.content[0]?.text).toContain(claimResult.expiresAt)
    expect(createAccountClaimLink).toHaveBeenCalledOnce()
    expect(createAccountClaimLink).toHaveBeenCalledWith()
  })

  test('allows a hosted OAuth Guest transport and calls the claim service once', async () => {
    const { server } = makeServerMock()
    const claimResult = {
      claimUrl: 'https://invompt.com/claim/oauth-guest',
      expiresAt: '2026-08-10T12:00:00.000Z',
    }
    const createAccountClaimLink = vi.fn().mockResolvedValue(claimResult)
    const client = {
      isGuest: () => false,
      createAccountClaimLink,
    } as unknown as Parameters<typeof registerCreateAccountClaimLinkTool>[1]
    registerCreateAccountClaimLinkTool(server, client)

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as ToolHandler
    const result = (await handler({})) as { content: Array<{ text: string }>; structuredContent: typeof claimResult }

    expect(result.structuredContent).toEqual(claimResult)
    expect(result.content[0]?.text).not.toContain(claimResult.claimUrl)
    expect(createAccountClaimLink).toHaveBeenCalledOnce()
  })

  test('formats a registered-account backend denial after calling the service once', async () => {
    const { server } = makeServerMock()
    const createAccountClaimLink = vi.fn().mockRejectedValue(
      new InvomptApiError('Account claim links are available only for Guest accounts.', 'ACCOUNT_CLAIM_REGISTERED', 403),
    )
    const client = {
      isGuest: () => false,
      createAccountClaimLink,
    } as unknown as Parameters<typeof registerCreateAccountClaimLinkTool>[1]
    registerCreateAccountClaimLinkTool(server, client)

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as ToolHandler
    const result = (await handler({})) as { content: Array<{ text: string }>; isError?: boolean }

    expect(parseToolErrorText(result).error).toEqual({
      code: 'ACCOUNT_CLAIM_REGISTERED',
      message: 'Account claim links are available only for Guest accounts.',
    })
    expect(createAccountClaimLink).toHaveBeenCalledOnce()
  })
})

describe('unarchive_invoice tool', () => {
  const unarchiveResult = {
    invoiceId: 'inv_1',
    status: 'unarchived' as const,
    version: 3,
    replayed: false,
  }

  test('registers with correct name and annotations', () => {
    const { server } = makeServerMock()
    const client = withGuestState({ unarchiveInvoice: vi.fn() }) as unknown as Parameters<
      typeof registerUnarchiveInvoiceTool
    >[1]
    registerUnarchiveInvoiceTool(server, client)

    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('unarchive_invoice')
    expect((server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        annotations: expect.objectContaining({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        }),
      }),
    )
  })

  test.each([false, true])('calls client.unarchiveInvoice and returns structured content (guest=%s)', async (guest) => {
    const { server, getHandler } = makeServerMock()
    const unarchiveInvoice = vi.fn().mockResolvedValue(unarchiveResult)
    const client = withGuestState({ unarchiveInvoice }, guest) as unknown as Parameters<
      typeof registerUnarchiveInvoiceTool
    >[1]
    registerUnarchiveInvoiceTool(server, client)

    const result = (await getHandler('unarchive_invoice')({
      id: 'inv_1',
      expectedVersion: 2,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as {
      structuredContent: unknown
      content: Array<{ text: string }>
      isError?: boolean
    }

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual(unarchiveResult)
    expect(result.content[0]?.text).toBe('Unarchived invoice inv_1.')
    expect(unarchiveInvoice).toHaveBeenCalledWith('inv_1', {
      expectedVersion: 2,
      idempotencyKey: IDEMPOTENCY_KEY,
    })
  })

  test('propagates the replayed flag in structured content', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      unarchiveInvoice: vi.fn().mockResolvedValue({ ...unarchiveResult, replayed: true }),
    }) as unknown as Parameters<typeof registerUnarchiveInvoiceTool>[1]
    registerUnarchiveInvoiceTool(server, client)

    const result = (await getHandler('unarchive_invoice')({
      id: 'inv_1',
      expectedVersion: 2,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { structuredContent: Record<string, unknown>; isError?: boolean }

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent.replayed).toBe(true)
  })

  test('returns a structured tool error on failure', async () => {
    const { server, getHandler } = makeServerMock()
    const client = withGuestState({
      unarchiveInvoice: vi.fn().mockRejectedValue(new InvomptApiError('Conflict', 'IDEMPOTENCY_CONFLICT', 409)),
    }) as unknown as Parameters<typeof registerUnarchiveInvoiceTool>[1]
    registerUnarchiveInvoiceTool(server, client)

    const result = (await getHandler('unarchive_invoice')({
      id: 'inv_1',
      expectedVersion: 2,
      idempotencyKey: IDEMPOTENCY_KEY,
    })) as { content: Array<{ text: string }>; isError?: boolean }

    expect(parseToolErrorText(result).error.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})
