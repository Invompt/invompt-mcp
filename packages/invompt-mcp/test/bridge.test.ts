import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PRIVATE_MCP_URL,
  type MessageTransport,
  parseTrustedPrivateMcpOrigins,
  type StartBridgeOptions,
  startBridge,
  TRUSTED_PRIVATE_MCP_ORIGINS_ENV,
  validatePrivateMcpUrl,
} from '../src/bridge.js'
import { GUEST_CREDENTIAL_HEADER } from '../src/guest-credential.js'

const credential = `inv_gd_v1.test.${Buffer.alloc(32, 1).toString('base64url')}.${Buffer.alloc(32, 2).toString('base64url')}`

class FakeTransport implements MessageTransport {
  onmessage?: (message: JSONRPCMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void
  readonly sent: JSONRPCMessage[] = []
  started = false

  async start(): Promise<void> {
    this.started = true
  }
  async close(): Promise<void> {}
  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message)
  }
  receive(message: JSONRPCMessage): void {
    this.onmessage?.(message)
  }
  closeFromPeer(): void {
    this.onclose?.()
  }
}

describe('stdio private MCP bridge', () => {
  test('uses the canonical private MCP URL', () => {
    expect(DEFAULT_PRIVATE_MCP_URL).toBe('http://localhost:3101/mcp')
    expect(validatePrivateMcpUrl(DEFAULT_PRIVATE_MCP_URL).href).toBe(DEFAULT_PRIVATE_MCP_URL)
  })

  test.each([
    'not a URL',
    ' http://localhost:3101/mcp',
    'http://attacker.example.invalid/mcp',
    'http://localhost.attacker.example.invalid/mcp',
    'http://localhost:3102/mcp',
    'http://LOCALHOST:3101/mcp',
    'http://localhost.:3101/mcp',
    'http://127.1:3101/mcp',
    'http://2130706433:3101/mcp',
    'http://localhost:3101/mcp/',
    'http://localhost:3101/%6dcp',
    'https://user:pass@transport.example.invalid/mcp',
    'https://transport.example.invalid/not-mcp',
    'https://mcp.example.invalid.attacker.example.invalid/mcp',
    'https://mcp.example.invalid@attacker.example.invalid/mcp',
    'https://mcp.example.invalid%2eattacker.example.invalid/mcp',
    'https://mcp\uFF0Eexample.invalid/mcp',
    'https://mcp.example.invalid/mcp?redirect=https://attacker.example.invalid',
    'https://mcp.example.invalid/mcp#fragment',
  ])('rejects unsafe private bridge URL %s before connection', (value) =>
    expect(() => validatePrivateMcpUrl(value)).toThrow(),
  )

  test.each(['http://localhost:3101/mcp', 'http://127.0.0.1:3101/mcp', 'http://[::1]:3101/mcp'])(
    'allows the exact canonical local MCP endpoint %s',
    (value) => {
      expect(validatePrivateMcpUrl(value).href).toBe(value)
    },
  )

  test('rejects arbitrary HTTPS before reading or forwarding the credential or starting transports', async () => {
    const stdio = new FakeTransport()
    const remote = new FakeTransport()
    let credentialRead = false
    const options = {
      privateMcpUrl: 'https://credential-sink.example.invalid/mcp',
      stdioTransport: stdio,
      remoteTransport: remote,
      get guestCredential() {
        credentialRead = true
        return credential
      },
    } satisfies StartBridgeOptions

    await expect(startBridge(options)).rejects.toThrow('require an exact origin')
    expect(credentialRead).toBe(false)
    expect(stdio.started).toBe(false)
    expect(remote.started).toBe(false)
    expect(stdio.sent).toEqual([])
    expect(remote.sent).toEqual([])
  })

  test('allows a future remote MCP endpoint only with an exact explicitly trusted HTTPS origin', async () => {
    const privateMcpUrl = 'https://mcp.example.invalid/mcp'
    const trustedPrivateMcpOrigins = ['https://mcp.example.invalid']
    expect(validatePrivateMcpUrl(privateMcpUrl, trustedPrivateMcpOrigins).href).toBe(privateMcpUrl)

    const stdio = new FakeTransport()
    const remote = new FakeTransport()
    const previousTrustedOrigins = process.env[TRUSTED_PRIVATE_MCP_ORIGINS_ENV]
    process.env[TRUSTED_PRIVATE_MCP_ORIGINS_ENV] = trustedPrivateMcpOrigins[0]
    try {
      await startBridge({
        guestCredential: credential,
        privateMcpUrl,
        stdioTransport: stdio,
        remoteTransport: remote,
      })
    } finally {
      if (previousTrustedOrigins === undefined) delete process.env[TRUSTED_PRIVATE_MCP_ORIGINS_ENV]
      else process.env[TRUSTED_PRIVATE_MCP_ORIGINS_ENV] = previousTrustedOrigins
    }

    expect(stdio.started).toBe(true)
    expect(remote.started).toBe(true)
  })

  test.each([
    'https://*.example.invalid',
    'https://mcp.example.invalid/',
    'https://mcp.example.invalid/mcp',
    'https://user@mcp.example.invalid',
    'http://mcp.example.invalid',
  ])('rejects non-exact trusted remote origin %s', (origin) => {
    expect(() => validatePrivateMcpUrl('https://mcp.example.invalid/mcp', [origin])).toThrow()
  })

  test('parses only non-empty comma-separated exact remote origins', () => {
    expect(parseTrustedPrivateMcpOrigins('https://mcp.example.invalid,https://mcp-staging.example.invalid')).toEqual([
      'https://mcp.example.invalid',
      'https://mcp-staging.example.invalid',
    ])
    expect(() => parseTrustedPrivateMcpOrigins('')).toThrow()
    expect(() => parseTrustedPrivateMcpOrigins('https://mcp.example.invalid,')).toThrow()
  })

  test('forwards every MCP message exactly once without outer tool execution', async () => {
    const stdio = new FakeTransport()
    const remote = new FakeTransport()
    await startBridge({ guestCredential: credential, stdioTransport: stdio, remoteTransport: remote })
    const request = {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'ping', arguments: {} },
    }
    const response = { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'pong' }] } }
    stdio.receive(request)
    remote.receive(response)
    await new Promise((resolve) => setImmediate(resolve))

    expect(stdio.started).toBe(true)
    expect(remote.started).toBe(true)
    expect(remote.sent).toEqual([request])
    expect(stdio.sent).toEqual([response])
    expect(GUEST_CREDENTIAL_HEADER).toBe('X-Invompt-Guest-Credential')
    stdio.closeFromPeer()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
