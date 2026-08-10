#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'

import { startBridge } from './bridge.js'
import { logout, reset, setup as setupOnboarding, status } from './onboarding/service.js'
import type { AuthMode, HostName } from './onboarding/types.js'

export type { JsonRpcMessage, MessageTransport, StartBridgeOptions } from './bridge.js'
export {
  DEFAULT_GUEST_MCP_URL,
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
export { createGuestApi, GuestApiError, INVOMPT_WEB_URL } from './onboarding/guest-api.js'
export { configureHost, HOSTED_MCP_URL, hostCommands, logoutHost, removeHost } from './onboarding/host-config.js'
export {
  createFileSecretStore,
  createKeychainSecretStore,
  guestFallbackPath,
  KEYCHAIN_ACCOUNT,
  KEYCHAIN_SERVICE,
} from './onboarding/secret-store.js'
export { logout, reset, resolveGuestCredentialForBridge, setup, status } from './onboarding/service.js'
export { AUTH_STATE_FILE_NAME, authStatePath, createAuthStateStore, initialAuthState } from './onboarding/state.js'
export type {
  AuthMode,
  AuthState,
  BindingStatus,
  CommandResult,
  CommandRunner,
  GuestBackend,
  GuestStatus,
  HostBinding,
  HostName,
  SecretStore,
} from './onboarding/types.js'

function isDirectExecution(moduleUrl: string): boolean {
  const argvPath = process.argv[1]
  if (!argvPath) return false
  try {
    return pathToFileURL(realpathSync(argvPath)).href === pathToFileURL(realpathSync(new URL(moduleUrl))).href
  } catch {
    return moduleUrl === pathToFileURL(argvPath).href
  }
}

type FlagValue = string | true

function parseCommandFlags(
  command: string,
  argv: readonly string[],
  allowed: Readonly<Record<string, 'value' | 'boolean'>>,
): ReadonlyMap<string, FlagValue> {
  const flags = new Map<string, FlagValue>()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--') || token === '--')
      throw new Error(`${command} accepts only documented flags; received ${token}.`)
    const kind = allowed[token]
    if (!kind) throw new Error(`${token} is not supported by ${command}.`)
    if (flags.has(token)) throw new Error(`${token} may be specified only once for ${command}.`)
    if (kind === 'boolean') {
      flags.set(token, true)
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value.`)
    flags.set(token, value)
    index += 1
  }
  return flags
}

function valueFlag(flags: ReadonlyMap<string, FlagValue>, flag: string): string | undefined {
  const value = flags.get(flag)
  return typeof value === 'string' ? value : undefined
}

function parseMode(value: string | undefined): AuthMode {
  if (value === 'guest' || value === 'oauth') return value
  throw new Error('--mode must be guest or oauth.')
}

function parseHost(value: string | undefined): HostName {
  if (value === 'claude-code' || value === 'codex') return value
  throw new Error('--host must be claude-code or codex.')
}

export interface CliDependencies {
  readonly locale?: string
  readonly prompt?: (question: string) => Promise<string>
  readonly write?: (value: string) => void
  readonly writeError?: (value: string) => void
  readonly setup?: typeof setupOnboarding
  readonly serve?: typeof startBridge
}

async function defaultPrompt(question: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return await terminal.question(question)
  } finally {
    terminal.close()
  }
}

function localizedPrompt(locale: string | undefined): { mode: string; host: string } {
  return locale?.toLowerCase().startsWith('es')
    ? { mode: 'Modo (guest/oauth): ', host: 'Host (claude-code/codex): ' }
    : { mode: 'Mode (guest/oauth): ', host: 'Host (claude-code/codex): ' }
}

const CLI_USAGE = `Usage: invompt-mcp [serve|setup|status|logout|reset]

serve
  Start the Guest stdio bridge: serve --host claude-code|codex
setup --mode guest|oauth --host claude-code|codex [--allow-file-fallback]
  Configure a host. File fallback is explicit and only available for Guest setup.
status [--json]
  Show redacted local authentication state.
logout --host claude-code|codex
  Disconnect the selected host.
reset --yes
  Remove local authentication state. This may leave copied or stolen credentials valid when online revocation is unavailable.
`

export async function runCli(argv: readonly string[], dependencies: CliDependencies = {}): Promise<void> {
  const write = dependencies.write ?? ((value: string) => process.stdout.write(value))
  const writeError = dependencies.writeError ?? ((value: string) => process.stderr.write(value))
  const [command = 'serve', ...args] = argv
  if (command === 'help' || command === '--help') {
    write(CLI_USAGE)
    return
  }
  if (command === 'serve') {
    const flags = parseCommandFlags('serve', args, { '--host': 'value' })
    await (dependencies.serve ?? startBridge)({ host: parseHost(valueFlag(flags, '--host')) })
    return
  }
  if (command === 'setup') {
    const flags = parseCommandFlags('setup', args, {
      '--mode': 'value',
      '--host': 'value',
      '--allow-file-fallback': 'boolean',
    })
    let requestedMode = flags.get('--mode')
    let requestedHost = flags.get('--host')
    if (flags.size === 0) {
      const prompt = dependencies.prompt ?? defaultPrompt
      const prompts = localizedPrompt(dependencies.locale ?? process.env.LANG)
      requestedMode = await prompt(prompts.mode)
      requestedHost = await prompt(prompts.host)
    }
    if (typeof requestedMode !== 'string' || typeof requestedHost !== 'string')
      throw new Error('setup requires both --mode and --host.')
    const mode = parseMode(requestedMode)
    if (mode === 'oauth' && flags.has('--allow-file-fallback'))
      throw new Error('--allow-file-fallback is only supported with --mode guest.')
    await (dependencies.setup ?? setupOnboarding)({
      mode,
      host: parseHost(requestedHost),
      allowFileFallback: flags.has('--allow-file-fallback'),
    })
    return
  }
  if (command === 'status') {
    const flags = parseCommandFlags('status', args, { '--json': 'boolean' })
    const current = status()
    if (flags.has('--json')) write(`${JSON.stringify(current)}\n`)
    else write(`mode: ${current.selectedMode ?? 'undecided'}\nguest: ${current.guest.status}\n`)
    return
  }
  if (command === 'logout') {
    const flags = parseCommandFlags('logout', args, { '--host': 'value' })
    await logout(parseHost(valueFlag(flags, '--host')))
    return
  }
  if (command === 'reset') {
    const flags = parseCommandFlags('reset', args, { '--yes': 'boolean' })
    const result = await reset(flags.has('--yes'))
    if (result.warning) writeError(`${result.warning}\n`)
    return
  }
  throw new Error(`Unknown command: ${command}`)
}

if (isDirectExecution(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`invompt-mcp failed: ${error instanceof Error ? error.message : 'Unknown startup failure'}\n`)
    process.exitCode = 1
  })
}
