import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import { STRUCTURED_INVOML_GUIDANCE } from '../src/contracts.js'
import { InvomptApiError } from '../src/error.js'
import { createMcpServer } from '../src/server.js'
import type { InvomptService } from '../src/service.js'
import type { UpdateInvoiceResult } from '../src/types.js'

function serviceFake(): InvomptService {
  const empty = async () => ({})
  return {
    isGuest: () => false,
    getInvomlSpec: empty,
    ping: empty,
    createInvoice: empty,
    listInvoices: empty,
    getInvoice: empty,
    updateInvoice: empty,
    archiveInvoice: empty,
    unarchiveInvoice: empty,
    renewInvoiceLink: empty,
    createAccountClaimLink: empty,
    getSettings: empty,
    updateSettings: empty,
    listClients: empty,
    getClient: empty,
    createClient: empty,
    updateClient: empty,
    archiveClient: empty,
  } as unknown as InvomptService
}

const PREVIEW_URL = `https://localhost/preview/${'a'.repeat(43)}`
const updateInvoiceResult: UpdateInvoiceResult = {
  invoiceId: 'inv_1',
  invoiceNumber: 'INV-001',
  status: 'draft',
  total: 100,
  currency: 'USD',
  dueDate: null,
  url: PREVIEW_URL,
  linkState: 'active',
  version: 2,
  replayed: false,
}

async function connectClient(service: InvomptService): Promise<{ client: Client; server: ReturnType<typeof createMcpServer> }> {
  const server = createMcpServer(service, 'test')
  const client = new Client({ name: 'mcp-core-test-client', version: 'test' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return { client, server }
}

describe('server instructions', () => {
  test('renew hosted links only when requested, after requested archive restoration', () => {
    const server = createMcpServer(serviceFake(), 'test')
    const instructions = (server.server as unknown as { _instructions: string })._instructions
    const restoreAt = instructions.indexOf('call unarchive_invoice only when the user has requested restoration')
    const renewAt = instructions.indexOf('after restoration, call renew_invoice_link only when the user\'s intent requests a new hosted link')

    expect(instructions).not.toContain('If get_invoice reports no active hosted link, use renew_invoice_link')
    expect(restoreAt).toBeGreaterThanOrEqual(0)
    expect(renewAt).toBeGreaterThan(restoreAt)
    expect(instructions).toContain('renew_invoice_link is optional')
    expect(instructions).toContain('A read or restoration alone never authorizes publishing a new public capability')
    expect(instructions).toContain('Use a stable idempotency key for renewal')
    expect(instructions).toContain('without revising the invoice')
  })

  test('put the self-contained create contract in the first 512 characters', () => {
    const server = createMcpServer(serviceFake(), 'test')
    const instructions = (server.server as unknown as { _instructions: string })._instructions

    expect(instructions.slice(0, 512)).toContain(STRUCTURED_INVOML_GUIDANCE)
    expect(instructions.slice(0, 512)).toContain('list_clients')
    expect(instructions.slice(0, 512)).toContain('idempotencyKey')
  })

  test('publishes structured and legacy create fields in the root JSON Schema', () => {
    const server = createMcpServer(serviceFake(), 'test')
    const inputSchema = (server as unknown as {
      _registeredTools: Record<string, { inputSchema: z.ZodType }>
    })._registeredTools.create_invoice?.inputSchema
    expect(inputSchema).toBeDefined()

    const jsonSchema = z.toJSONSchema(inputSchema)
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.required).toContain('idempotencyKey')
    expect(jsonSchema.properties).toEqual(
      expect.objectContaining({
        invoml: expect.objectContaining({ type: 'string' }),
        document: expect.objectContaining({ type: 'object' }),
      }),
    )
    expect(JSON.stringify(jsonSchema)).toContain('additionalProperties')
  })
})

describe('update_invoice SDK output contract', () => {
  test('publishes an object-root output schema and accepts a valid active capability link', async () => {
    const service = serviceFake()
    service.updateInvoice = async () => updateInvoiceResult
    const { client, server } = await connectClient(service)

    try {
      const tool = (await client.listTools()).tools.find(({ name }) => name === 'update_invoice')
      const outputSchema = tool?.outputSchema

      expect(outputSchema).toEqual(
        expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            url: expect.objectContaining({
              anyOf: expect.arrayContaining([expect.objectContaining({ type: 'string' }), { type: 'null' }]),
            }),
            linkState: { type: 'string', enum: ['active', 'unavailable'] },
          }),
          required: expect.arrayContaining(['url', 'linkState']),
        }),
      )

      const result = await client.callTool({
        name: 'update_invoice',
        arguments: {
          id: 'inv_1',
          expectedVersion: 1,
          idempotencyKey: 'test-key-123',
        },
      })

      expect(result.isError).toBeUndefined()
      expect(result.structuredContent).toEqual(updateInvoiceResult)
    } finally {
      await server.close()
    }
  })

  test('rejects an invalid update result through the real SDK call path', async () => {
    const service = serviceFake()
    service.updateInvoice = async () => ({
      ...updateInvoiceResult,
      url: null,
      linkState: 'active',
    }) as UpdateInvoiceResult
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({
        name: 'update_invoice',
        arguments: {
          id: 'inv_1',
          expectedVersion: 1,
          idempotencyKey: 'test-key-123',
        },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0]?.type).toBe('text')
      expect(result.content[0]?.text).toContain('Output validation error')
      expect(result.content[0]?.text).toContain('active invoice link requires')
    } finally {
      await server.close()
    }
  })
})

describe('create_invoice SDK output contract', () => {
  test('publishes the document family as a required structured field', async () => {
    const { client, server } = await connectClient(serviceFake())

    try {
      const tool = (await client.listTools()).tools.find(({ name }) => name === 'create_invoice')
      expect(tool?.outputSchema).toEqual(
        expect.objectContaining({
          properties: expect.objectContaining({
            documentType: expect.objectContaining({
              type: 'string',
              enum: ['invoice', 'quote', 'estimate', 'receipt', 'credit_note'],
            }),
          }),
          required: expect.arrayContaining(['documentType']),
        }),
      )
    } finally {
      await server.close()
    }
  })
})

describe('SDK error transport contract', () => {
  test('preserves a get_invoice NOT_FOUND error without structured content', async () => {
    const service = serviceFake()
    let calls = 0
    service.getInvoice = async () => {
      calls += 1
      throw new InvomptApiError('Invoice inv_missing was not found.', 'NOT_FOUND', 404)
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({ name: 'get_invoice', arguments: { id: 'inv_missing' } })

      expect(calls).toBe(1)
      expect(result.isError).toBe(true)
      expect(result.content[0]?.type).toBe('text')
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice inv_missing was not found.' },
      })
      expect(result.structuredContent).toBeUndefined()
    } finally {
      await server.close()
    }
  })

  test('reaches update_invoice with valid input and transports its NOT_FOUND error', async () => {
    const service = serviceFake()
    let calls = 0
    service.updateInvoice = async () => {
      calls += 1
      throw new InvomptApiError('Invoice inv_missing was not found.', 'NOT_FOUND', 404)
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({
        name: 'update_invoice',
        arguments: { id: 'inv_missing', expectedVersion: 1, idempotencyKey: 'test-key-123' },
      })

      expect(calls).toBe(1)
      expect(result.isError).toBe(true)
      expect(result.content[0]?.type).toBe('text')
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice inv_missing was not found.' },
      })
      expect(result.structuredContent).toBeUndefined()
    } finally {
      await server.close()
    }
  })

  test('preserves an authorization error code and message without structured content', async () => {
    const service = serviceFake()
    service.getInvoice = async () => {
      throw new InvomptApiError('You do not have access to this invoice.', 'FORBIDDEN', 403)
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({ name: 'get_invoice', arguments: { id: 'inv_private' } })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this invoice.' },
      })
      expect(result.structuredContent).toBeUndefined()
    } finally {
      await server.close()
    }
  })

  test('returns SDK -32602 input validation before calling get_invoice service', async () => {
    const service = serviceFake()
    let calls = 0
    service.getInvoice = async () => {
      calls += 1
      throw new Error('service should not be called for invalid input')
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({ name: 'get_invoice', arguments: {} })

      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('MCP error -32602: Input validation error'),
      }))
      expect(result.structuredContent).toBeUndefined()
      expect(calls).toBe(0)
    } finally {
      await server.close()
    }
  })

  test('transports a missing immutable invoice revision without structured content', async () => {
    const service = serviceFake()
    let calls = 0
    let receivedInput: unknown
    service.previewInvoiceTemplateExtraction = async (input) => {
      calls += 1
      receivedInput = input
      throw new InvomptApiError(
        'Invoice revision 00000000-0000-4000-8000-000000000123:73 was not found.',
        'NOT_FOUND',
        404,
      )
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({
        name: 'preview_invoice_template_extraction',
        arguments: { invoiceId: '00000000-0000-4000-8000-000000000123', version: 73 },
      })

      expect(calls).toBe(1)
      expect(receivedInput).toEqual({
        invoiceId: '00000000-0000-4000-8000-000000000123',
        version: 73,
        includeLineItems: false,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0]?.type).toBe('text')
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invoice revision 00000000-0000-4000-8000-000000000123:73 was not found.',
        },
      })
      expect(result.structuredContent).toBeUndefined()
    } finally {
      await server.close()
    }
  })

  test('returns SDK -32602 for a fractional revision before calling the preview service', async () => {
    const service = serviceFake()
    let calls = 0
    service.previewInvoiceTemplateExtraction = async (input) => {
      calls += 1
      throw new Error('service should not be called for invalid input')
    }
    const { client, server } = await connectClient(service)

    try {
      const result = await client.callTool({
        name: 'preview_invoice_template_extraction',
        arguments: { invoiceId: '00000000-0000-4000-8000-000000000123', version: 1.5 },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0]).toEqual(expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('MCP error -32602: Input validation error'),
      }))
      expect(result.structuredContent).toBeUndefined()
      expect(calls).toBe(0)
    } finally {
      await server.close()
    }
  })
})

describe('SDK resource transport contract', () => {
  test('discovers and reads both public resources, and rejects unknown URIs', async () => {
    const service = serviceFake()
    service.getInvomlSpec = async () => 'InvoML v1 spec content'
    const { client, server } = await connectClient(service)

    try {
      const resources = (await client.listResources()).resources
      const guide = resources.find(({ uri }) => uri === 'invompt://docs/getting-started')
      const spec = resources.find(({ uri }) => uri === 'invompt://spec/invoml/v1')

      expect(guide).toEqual(expect.objectContaining({
        uri: 'invompt://docs/getting-started',
        name: 'getting-started',
        title: 'Invompt Getting Started Guide',
        description: expect.stringContaining('Product guide'),
        mimeType: 'text/plain',
      }))
      expect(spec).toEqual(expect.objectContaining({
        uri: 'invompt://spec/invoml/v1',
        name: 'invoml-spec',
        title: 'Invompt InvoML v1 Spec',
        description: expect.stringContaining('Public InvoML spec'),
        mimeType: 'text/plain',
      }))

      const guideResult = await client.readResource({ uri: 'invompt://docs/getting-started' })
      expect(guideResult.contents).toHaveLength(1)
      expect(guideResult.contents[0]).toEqual(expect.objectContaining({
        uri: 'invompt://docs/getting-started',
        mimeType: 'text/plain',
        text: expect.stringContaining('exactly 21 operational tools'),
      }))

      const specResult = await client.readResource({ uri: 'invompt://spec/invoml/v1' })
      expect(specResult.contents).toHaveLength(1)
      expect(specResult.contents[0]).toEqual({
        uri: 'invompt://spec/invoml/v1',
        mimeType: 'text/plain',
        text: 'InvoML v1 spec content',
      })

      await expect(client.readResource({ uri: 'invompt://unknown/resource' })).rejects.toMatchObject({
        code: -32602,
        message: expect.stringContaining('Resource invompt://unknown/resource not found'),
      })
    } finally {
      await server.close()
    }
  })
})
