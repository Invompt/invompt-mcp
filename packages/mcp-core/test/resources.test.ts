import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'

import { GETTING_STARTED_URI, registerGettingStartedResource } from '../src/resources/getting-started.js'
import { INVOML_SPEC_URI, registerInvomlSpecResource } from '../src/resources/invoml-spec.js'
import { STRUCTURED_INVOML_GUIDANCE } from '../src/contracts.js'

type ResourceHandler = (uri: URL) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>

function makeServerMock() {
  const handlers: Record<string, ResourceHandler> = {}
  const server = {
    registerTool: vi.fn(),
    registerResource: vi.fn((name: string, _uri: string, _config: unknown, handler: ResourceHandler) => {
      handlers[name] = handler
    }),
    registerPrompt: vi.fn(),
  } as unknown as McpServer

  return {
    server,
    getHandler: (name: string) => {
      const h = handlers[name]
      if (!h) throw new Error(`No handler registered for resource: ${name}`)
      return h
    },
  }
}

describe('invoml-spec resource', () => {
  test('exports INVOML_SPEC_URI constant', () => {
    expect(INVOML_SPEC_URI).toBe('invompt://spec/invoml/v1')
  })

  test('registers with correct uri', () => {
    const { server } = makeServerMock()
    const client = { getInvomlSpec: vi.fn() } as unknown as Parameters<typeof registerInvomlSpecResource>[1]
    registerInvomlSpecResource(server, client)
    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[1]).toBe(INVOML_SPEC_URI)
  })

  test('handler calls the service port and returns spec text', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockResolvedValue('InvoML v1 spec content') } as unknown as Parameters<
      typeof registerInvomlSpecResource
    >[1]
    registerInvomlSpecResource(server, client)
    const result = await getHandler('invoml-spec')(new URL(INVOML_SPEC_URI))
    expect(result.contents[0]?.text).toBe('InvoML v1 spec content')
    expect(result.contents[0]?.mimeType).toBe('text/plain')
    expect(result.contents[0]?.uri).toBe(INVOML_SPEC_URI)
  })

  test('handler propagates service errors', async () => {
    const { server, getHandler } = makeServerMock()
    const client = { getInvomlSpec: vi.fn().mockRejectedValue(new Error('Network down')) } as unknown as Parameters<
      typeof registerInvomlSpecResource
    >[1]
    registerInvomlSpecResource(server, client)
    await expect(getHandler('invoml-spec')(new URL(INVOML_SPEC_URI))).rejects.toThrow('Network down')
  })
})

describe('getting-started resource', () => {
  test('exports GETTING_STARTED_URI constant', () => {
    expect(GETTING_STARTED_URI).toBe('invompt://docs/getting-started')
  })

  test('registers with correct uri', () => {
    const { server } = makeServerMock()
    registerGettingStartedResource(server)
    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[1]).toBe(GETTING_STARTED_URI)
  })

  test('handler returns static content with Invompt branding', async () => {
    const { server, getHandler } = makeServerMock()
    registerGettingStartedResource(server)
    const result = await getHandler('getting-started')(new URL(GETTING_STARTED_URI))
    const text = result.contents[0]?.text ?? ''
    expect(text).toContain('Invompt')
    expect(text).toContain('get_settings')
    expect(text).toContain('server-issued pseudonymous local credential')
    expect(text).toContain('separate registered OAuth')
    expect(text).toContain('Connection Setup')
    expect(text).toContain('exactly 20 operational tools')
    expect(text).toContain('create_account_claim_link')
    expect(text).toContain('Present claimUrl exactly once')
    expect(text).toContain('GUEST_ACCOUNT_CLAIMED')
    expect(text).not.toContain('INVOMPT_GUEST_CREDENTIAL')
    expect(text).not.toContain('~/.invompt/')
    expect(text).toContain('Never invent issuer identity')
    expect(text).toContain("user's language")
    expect(text).toContain('Never invent currency')
    expect(text).toContain(STRUCTURED_INVOML_GUIDANCE)
    expect(text).toContain('update_settings')
    expect(text).toContain('idempotencyKey')
    expect(text).toContain('expectedVersion')
    expect(text).toContain('latest version')
    expect(text).toContain('professional')
    expect(text).toContain('Omitted settings')
    expect(text).toContain('no secrets or identifiers as input')
    expect(text).not.toContain('API key')
    expect(text).not.toContain('invompt.com/integrations')
    expect(result.contents[0]?.mimeType).toBe('text/plain')
  })

  test('handler returns correct uri in contents', async () => {
    const { server, getHandler } = makeServerMock()
    registerGettingStartedResource(server)
    const result = await getHandler('getting-started')(new URL(GETTING_STARTED_URI))
    expect(result.contents[0]?.uri).toBe(GETTING_STARTED_URI)
  })

  test('handler always returns exactly one content item', async () => {
    const { server, getHandler } = makeServerMock()
    registerGettingStartedResource(server)
    const result = await getHandler('getting-started')(new URL(GETTING_STARTED_URI))
    expect(result.contents).toHaveLength(1)
  })
})
