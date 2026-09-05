import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import { STRUCTURED_INVOML_GUIDANCE } from '../src/contracts.js'
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
