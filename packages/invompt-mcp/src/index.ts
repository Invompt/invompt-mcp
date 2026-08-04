#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { startBridge } from './bridge.js'

export type { JsonRpcMessage, MessageTransport, StartBridgeOptions } from './bridge.js'
export {
  DEFAULT_PRIVATE_MCP_URL,
  parseTrustedPrivateMcpOrigins,
  startBridge,
  TRUSTED_PRIVATE_MCP_ORIGINS_ENV,
  validatePrivateMcpUrl,
} from './bridge.js'
export { GUEST_MCP_INSTRUCTIONS, ISSUER_IDENTITY_INSTRUCTION } from './contracts.js'
export {
  GUEST_CREDENTIAL_ENV,
  GUEST_CREDENTIAL_FILE_NAME,
  GUEST_CREDENTIAL_HEADER,
  GUEST_CREDENTIAL_PREFIX,
  guestCredentialFilePath,
  persistGuestCredential,
  readGuestCredential,
  shouldFsyncCredentialDirectory,
  supportsGuestCredentialFilePersistence,
  validateGuestCredential,
} from './guest-credential.js'

function isDirectExecution(moduleUrl: string): boolean {
  const argvPath = process.argv[1]
  if (!argvPath) return false
  try {
    return pathToFileURL(realpathSync(argvPath)).href === pathToFileURL(realpathSync(new URL(moduleUrl))).href
  } catch {
    return moduleUrl === pathToFileURL(argvPath).href
  }
}

if (isDirectExecution(import.meta.url)) {
  startBridge().catch((error: unknown) => {
    process.stderr.write(
      `invompt-mcp bridge failed: ${error instanceof Error ? error.message : 'Unknown startup failure'}\n`,
    )
    process.exitCode = 1
  })
}
