import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'

import { registerMcpSurface } from '../src/server.js'
import type { InvomptService } from '../src/service.js'

type RequiredAnnotations = {
  readOnlyHint: boolean
  destructiveHint: boolean
  openWorldHint: boolean
}

const expectedAnnotations: Record<string, RequiredAnnotations> = {
  ping: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  create_invoice: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  list_invoices: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  get_invoice: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  update_invoice: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  archive_invoice: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  unarchive_invoice: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  renew_invoice_link: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  create_account_claim_link: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  get_settings: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  update_settings: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  list_clients: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  get_client: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  create_client: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  update_client: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  archive_client: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
}

describe('OpenAI tool annotation contract', () => {
  test('classifies every operational tool by its actual effects', () => {
    const discovered = new Map<string, RequiredAnnotations>()
    const server = {
      registerTool: vi.fn((name: string, config: { annotations?: RequiredAnnotations }) => {
        if (config.annotations) {
          const { readOnlyHint, destructiveHint, openWorldHint } = config.annotations
          discovered.set(name, { readOnlyHint, destructiveHint, openWorldHint })
        }
      }),
      registerResource: vi.fn(),
      registerPrompt: vi.fn(),
    } as unknown as McpServer

    registerMcpSurface(server, {} as InvomptService)

    expect(Object.fromEntries(discovered)).toEqual(expectedAnnotations)
  })
})
