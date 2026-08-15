import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import { STRUCTURED_INVOML_GUIDANCE } from '../src/contracts.js'
import { createMcpServer } from '../src/server.js'
import type { InvomptService } from '../src/service.js'

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

describe('server instructions', () => {
  test('put the self-contained create contract in the first 512 characters', () => {
    const server = createMcpServer(serviceFake(), 'test')
    const instructions = (server.server as unknown as { _instructions: string })._instructions

    expect(instructions.slice(0, 512)).toContain(STRUCTURED_INVOML_GUIDANCE)
    expect(instructions.slice(0, 512)).toContain('list_clients')
    expect(instructions.slice(0, 512)).toContain('idempotencyKey')
  })

  test('publishes mutually exclusive structured and legacy create branches in JSON Schema', () => {
    const server = createMcpServer(serviceFake(), 'test')
    const inputSchema = (server as unknown as {
      _registeredTools: Record<string, { inputSchema: z.ZodType }>
    })._registeredTools.create_invoice?.inputSchema
    expect(inputSchema).toBeDefined()

    const jsonSchema = z.toJSONSchema(inputSchema)
    expect(jsonSchema.anyOf).toHaveLength(2)
    expect(jsonSchema.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: expect.arrayContaining(['invoml', 'idempotencyKey']) }),
        expect.objectContaining({ required: expect.arrayContaining(['document', 'idempotencyKey']) }),
      ]),
    )
    expect(JSON.stringify(jsonSchema)).toContain('additionalProperties')
  })
})
