import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { GUEST_CREDENTIAL_HEADER, readGuestCredential } from './guest-credential.js'

export const DEFAULT_PRIVATE_MCP_URL = 'http://localhost:3101/mcp'
export const TRUSTED_PRIVATE_MCP_ORIGINS_ENV = 'INVOMPT_TRUSTED_MCP_ORIGINS'

const TRUSTED_LOCAL_MCP_ORIGINS = new Set(['http://localhost:3101', 'http://127.0.0.1:3101', 'http://[::1]:3101'])

export interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  [key: string]: unknown
}

export interface MessageTransport {
  onmessage?: (message: JsonRpcMessage) => void
  onerror?: (error: Error) => void
  onclose?: () => void
  start(): Promise<void>
  close(): Promise<void>
  send(message: JsonRpcMessage): Promise<void>
}

export interface StartBridgeOptions {
  guestCredential?: string
  privateMcpUrl?: string
  trustedPrivateMcpOrigins?: readonly string[]
  stdioTransport?: MessageTransport
  remoteTransport?: MessageTransport
}

function parseUrl(value: string, errorMessage: string): URL {
  if (value.length === 0 || value.trim() !== value) throw new Error(errorMessage)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(errorMessage)
  }
  return url
}

function validateTrustedPrivateMcpOrigin(value: string): string {
  const errorMessage = `${TRUSTED_PRIVATE_MCP_ORIGINS_ENV} entries must be exact HTTPS origins without paths, credentials, queries, fragments, or wildcards.`
  const url = parseUrl(value, errorMessage)
  if (url.protocol !== 'https:' || url.hostname.includes('*') || value !== url.origin) {
    throw new Error(errorMessage)
  }
  return url.origin
}

export function parseTrustedPrivateMcpOrigins(value: string | undefined): readonly string[] {
  if (value === undefined) return []
  if (value.length === 0) {
    throw new Error(`${TRUSTED_PRIVATE_MCP_ORIGINS_ENV} must not be empty when configured.`)
  }
  const origins = value.split(',')
  if (origins.some((origin) => origin.length === 0)) {
    throw new Error(`${TRUSTED_PRIVATE_MCP_ORIGINS_ENV} must contain comma-separated exact HTTPS origins.`)
  }
  return origins.map(validateTrustedPrivateMcpOrigin)
}

export function validatePrivateMcpUrl(value: string, trustedOrigins: readonly string[] = []): URL {
  const errorMessage = 'INVOMPT_PRIVATE_MCP_URL must be an exact trusted MCP endpoint.'
  const url = parseUrl(value, errorMessage)
  const canonicalEndpoint = `${url.origin}/mcp`
  if (value !== canonicalEndpoint || url.href !== canonicalEndpoint) throw new Error(errorMessage)

  if (TRUSTED_LOCAL_MCP_ORIGINS.has(url.origin)) return url

  const exactTrustedOrigins = new Set(trustedOrigins.map(validateTrustedPrivateMcpOrigin))
  if (url.protocol !== 'https:' || !exactTrustedOrigins.has(url.origin)) {
    throw new Error(`Remote private MCP endpoints require an exact origin in ${TRUSTED_PRIVATE_MCP_ORIGINS_ENV}.`)
  }
  return url
}

function protocolVersion(message: JsonRpcMessage): string | undefined {
  if (!('method' in message) || message.method !== 'initialize' || !('params' in message)) return undefined
  const value = (message.params as { protocolVersion?: unknown } | undefined)?.protocolVersion
  return typeof value === 'string' ? value : undefined
}

export async function startBridge(options: StartBridgeOptions = {}): Promise<void> {
  const privateMcpUrl = validatePrivateMcpUrl(
    options.privateMcpUrl ?? process.env.INVOMPT_PRIVATE_MCP_URL ?? DEFAULT_PRIVATE_MCP_URL,
    options.trustedPrivateMcpOrigins ?? parseTrustedPrivateMcpOrigins(process.env[TRUSTED_PRIVATE_MCP_ORIGINS_ENV]),
  )
  const credential = options.guestCredential ?? readGuestCredential()
  if (!credential)
    throw new Error('A Guest credential is required. Set INVOMPT_GUEST_CREDENTIAL or bootstrap one first.')

  const stdio: MessageTransport = options.stdioTransport ?? (new StdioServerTransport() as unknown as MessageTransport)
  const defaultRemote = options.remoteTransport
    ? undefined
    : new StreamableHTTPClientTransport(privateMcpUrl, {
        requestInit: {
          redirect: 'error',
          headers: { [GUEST_CREDENTIAL_HEADER]: credential },
        },
      })
  const remote: MessageTransport = options.remoteTransport ?? (defaultRemote as unknown as MessageTransport)

  stdio.onmessage = (message) => {
    const version = protocolVersion(message)
    if (version) defaultRemote?.setProtocolVersion(version)
    void remote
      .send(message)
      .catch((error: unknown) => stdio.onerror?.(error instanceof Error ? error : new Error(String(error))))
  }
  remote.onmessage = (message) => {
    void stdio
      .send(message)
      .catch((error: unknown) => remote.onerror?.(error instanceof Error ? error : new Error(String(error))))
  }
  stdio.onclose = () => {
    void remote.close()
  }
  remote.onclose = () => {
    void stdio.close()
  }
  await remote.start()
  await stdio.start()
}
