import { createGuestApi, type GuestApi } from './guest-api.js'
import { configureHost, hostCliBinary, logoutHost, removeHost } from './host-config.js'
import { createFileSecretStore, createKeychainSecretStore, selectedSecretStore } from './secret-store.js'
import { type AuthStateStore, bindHost, createAuthStateStore, selectMode } from './state.js'
import {
  type AuthMode,
  type AuthState,
  type CommandRunner,
  type GuestBackend,
  type HostName,
  OnboardingError,
  type SecretStore,
} from './types.js'

export interface OnboardingDependencies {
  readonly state?: AuthStateStore
  readonly guestApi?: GuestApi
  readonly runner?: CommandRunner
  readonly keychain?: SecretStore
  readonly file?: SecretStore
  readonly packageVersion?: string
}

export interface SetupOptions {
  mode: AuthMode
  host: HostName
  allowFileFallback?: boolean
}
export interface ResetResult {
  readonly revoked: boolean
  readonly warning?: string
}

function dependencies(value: OnboardingDependencies) {
  return {
    state: value.state ?? createAuthStateStore(),
    guestApi: value.guestApi ?? createGuestApi(),
    packageVersion: value.packageVersion ?? '0.11.8',
  }
}

function storeFor(backend: GuestBackend, value: OnboardingDependencies): SecretStore {
  return selectedSecretStore(backend, {
    keychain: value.keychain ?? createKeychainSecretStore(),
    file: value.file ?? createFileSecretStore(),
  })
}

export function cliFailureExitCode(error: unknown): number {
  return error instanceof OnboardingError ? error.exitCode : 1
}

export function formatStatus(current: {
  selectedMode: AuthMode | null
  guest: { status: string; backend?: GuestBackend }
  bindings: AuthState['bindings']
}): string {
  const backend = current.guest.backend ? ` (${current.guest.backend})` : ''
  const lines = [`mode: ${current.selectedMode ?? 'undecided'}`, `guest: ${current.guest.status}${backend}`]
  for (const host of ['claude-code', 'codex'] as const) {
    const binding = current.bindings[host]
    if (binding) lines.push(`${host}: ${binding.status}`)
  }
  const needsReconcile = Object.values(current.bindings).some((binding) => binding?.status === 'needs_reconcile')
  if (needsReconcile && current.guest.status === 'active') {
    lines.push(
      'note: Guest is already active. A host binding needs reconciliation. Do not reset. Install the host CLI and run setup again.',
    )
  } else if (needsReconcile) {
    lines.push('note: a host binding needs reconciliation. Install the host CLI and run setup again.')
  }
  return `${lines.join('\n')}\n`
}

function guestBindingReadyForServe(current: AuthState, host: HostName): boolean {
  const binding = current.bindings[host]
  return (
    current.selectedMode === 'guest' &&
    current.guest.status === 'active' &&
    Boolean(current.guest.backend) &&
    binding?.mode === 'guest' &&
    binding.epoch === current.epoch &&
    (binding.status === 'active' || binding.status === 'needs_reconcile')
  )
}

function hostReconcileError(options: SetupOptions, current: AuthState, cause: unknown): OnboardingError {
  const causeMessage = cause instanceof Error ? cause.message : 'Unable to configure the host.'
  const binary = hostCliBinary(options.host)
  const guestLine =
    options.mode === 'guest' && current.guest.status === 'active'
      ? ` Guest is already active${current.guest.backend ? ` (backend: ${current.guest.backend})` : ''} and the ${options.host} binding needs reconciliation. Do not reset. Serve can start with this Guest credential; ${options.host} will not discover invompt-local-beta until setup completes. Inspect with status --json.`
      : ` The ${options.host} binding needs reconciliation. Inspect with status --json.`
  const nextStep = causeMessage.includes('not installed')
    ? ` Install ${binary}, then run setup again.`
    : ' Resolve the host CLI error and run setup again.'
  return new OnboardingError(`${causeMessage}${guestLine}${nextStep}`, 2)
}

function setBindingStatus(
  state: ReturnType<AuthStateStore['read']>,
  host: HostName,
  status: 'active' | 'needs_reconcile' | 'unconfigured',
): ReturnType<AuthStateStore['read']> {
  const binding = state.bindings[host]
  if (!binding) return state
  return { ...state, bindings: { ...state.bindings, [host]: { ...binding, status } } }
}

async function cleanBindingsBeforeModeSwitch(
  current: ReturnType<AuthStateStore['read']>,
  nextMode: AuthMode,
  state: AuthStateStore,
  runner: CommandRunner | undefined,
): Promise<ReturnType<AuthStateStore['read']>> {
  if (!current.selectedMode || current.selectedMode === nextMode) return current
  let cleaned = current
  for (const host of ['claude-code', 'codex'] as const) {
    const binding = cleaned.bindings[host]
    if (!binding || binding.status === 'unconfigured') continue
    try {
      await removeHost(host, runner)
      cleaned = setBindingStatus(cleaned, host, 'unconfigured')
    } catch {
      cleaned = setBindingStatus(cleaned, host, 'needs_reconcile')
      state.write(cleaned)
      throw new Error(
        `Unable to remove ${host} before switching Invompt mode. Resolve the host configuration and retry.`,
      )
    }
  }
  state.write(cleaned)
  return cleaned
}

export async function setup(options: SetupOptions, deps: OnboardingDependencies = {}): Promise<void> {
  const { state, guestApi, packageVersion } = dependencies(deps)
  await state.withLock(async () => {
    let current = state.read()
    current = await cleanBindingsBeforeModeSwitch(current, options.mode, state, deps.runner)
    current = selectMode(current, options.mode)
    if (options.mode === 'guest') {
      const recordedBackend = current.guest.backend
      let backend: GuestBackend = current.guest.backend ?? 'keychain'
      let secret: SecretStore = storeFor(backend, deps)
      let credential: string | undefined
      let requiresAcknowledgement = current.guest.status === 'needs_acknowledgement'
      try {
        credential = secret.read()
      } catch (error) {
        if (recordedBackend) {
          state.write({ ...current, guest: { ...current.guest, status: 'unavailable' } })
          throw new Error('The recorded Guest secret backend is unavailable. Run reset or recovery before setup.')
        }
        if (!options.allowFileFallback || backend === 'file') throw error
        backend = 'file'
        secret = storeFor('file', deps)
        credential = secret.read()
      }
      if (!recordedBackend && credential) requiresAcknowledgement = true
      if (!credential) {
        if (recordedBackend) {
          state.write({ ...current, guest: { ...current.guest, status: 'unavailable' } })
          throw new Error('The recorded Guest credential is unavailable. Run reset or recovery before setup.')
        }
        credential = await guestApi.issueCredential()
        requiresAcknowledgement = true
        try {
          secret.write(credential)
        } catch (error) {
          if (!options.allowFileFallback || backend === 'file') throw error
          backend = 'file'
          secret = storeFor('file', deps)
          secret.write(credential)
        }
      }
      if (requiresAcknowledgement) {
        try {
          await guestApi.acknowledge(credential)
        } catch (error) {
          state.write({ ...current, guest: { status: 'needs_acknowledgement', backend } })
          throw error
        }
      }
      current = { ...current, guest: { status: 'active', backend } }
    } else if (current.guest.status === 'active') {
      current = { ...current, guest: { ...current.guest, status: 'dormant' } }
    }
    current = bindHost(current, options.host, 'needs_reconcile', options.mode)
    state.write(current)
    try {
      await configureHost(options.host, options.mode, packageVersion, deps.runner)
      state.write(bindHost(state.read(), options.host, 'active', options.mode))
    } catch (error) {
      const next = bindHost(state.read(), options.host, 'needs_reconcile', options.mode)
      state.write(next)
      throw hostReconcileError(options, next, error)
    }
  })
}

export function status(deps: OnboardingDependencies = {}) {
  const state = (deps.state ?? createAuthStateStore()).read()
  return {
    schemaVersion: state.schemaVersion,
    epoch: state.epoch,
    selectedMode: state.selectedMode,
    guest: { status: state.guest.status, backend: state.guest.backend },
    bindings: state.bindings,
  }
}

/** Resolve only the backend recorded in non-secret state. No environment or legacy file import is permitted. */
export function resolveGuestCredentialForBridge(
  host: HostName,
  deps: OnboardingDependencies = {},
): {
  credential: string
  epoch: number
  guard: () => boolean
} {
  const stateStore = deps.state ?? createAuthStateStore()
  const current = stateStore.read()
  if (!guestBindingReadyForServe(current, host)) {
    const binding = current.bindings[host]
    if (
      current.selectedMode === 'guest' &&
      current.guest.status === 'active' &&
      current.guest.backend &&
      (!binding || (binding.mode === 'guest' && binding.epoch === current.epoch))
    ) {
      throw new OnboardingError(
        `Guest is already active, but the ${host} binding needs reconciliation. Install the host CLI and run invompt-mcp setup --mode guest --host ${host} again. Do not reset.`,
        2,
      )
    }
    throw new Error('Guest mode is not active on this device. Run invompt-mcp setup --mode guest.')
  }
  const backend = current.guest.backend
  if (!backend) throw new Error('Guest mode is not active on this device. Run invompt-mcp setup --mode guest.')
  const credential = storeFor(backend, deps).read()
  if (!credential) throw new Error('The selected Guest credential is unavailable. Run invompt-mcp setup --mode guest.')
  const epoch = current.epoch
  return {
    credential,
    epoch,
    guard: () => {
      const next = stateStore.read()
      return guestBindingReadyForServe(next, host) && next.epoch === epoch
    },
  }
}

export async function logout(host: HostName, deps: OnboardingDependencies = {}): Promise<void> {
  const { state } = dependencies(deps)
  await state.withLock(async () => {
    const current = state.read()
    const binding = current.bindings[host]
    if (!binding) throw new Error(`No Invompt configuration is recorded for ${host}.`)
    if (binding.mode === 'oauth') {
      try {
        await logoutHost(host, deps.runner)
      } finally {
        state.write(bindHost(state.read(), host, 'needs_reconcile', binding.mode))
      }
      return
    }
    // Guest identity is device-global, but this logout removes only one host binding.
    state.write(bindHost(current, host, 'needs_reconcile', binding.mode))
    try {
      await removeHost(host, deps.runner)
      state.write(setBindingStatus(state.read(), host, 'unconfigured'))
    } catch {
      throw new Error(`Unable to remove ${host} Guest configuration. Run reset or remove it manually before retrying.`)
    }
  })
}

export async function reset(yes: boolean, deps: OnboardingDependencies = {}): Promise<ResetResult> {
  if (!yes) throw new Error("reset requires --yes because it removes this device's local authentication state.")
  const { state, guestApi } = dependencies(deps)
  return state.withLock(async () => {
    const current = state.read()
    let warning: string | undefined
    let revoked = false
    if (current.guest.backend) {
      const secret = storeFor(current.guest.backend, deps)
      try {
        const credential = secret.read()
        if (credential) {
          const prepared = await guestApi.prepareRevocation(credential)
          await guestApi.commitRevocation(prepared.operationId, prepared.recoveryToken)
          revoked = true
        }
      } catch {
        warning = 'Online revocation was unavailable. Copied or stolen credentials may remain valid.'
      }
      try {
        secret.remove()
      } catch {
        warning ??= 'Local secret removal could not be confirmed.'
      }
    }
    const cleanupFailures: string[] = []
    for (const host of ['claude-code', 'codex'] as const) {
      try {
        await logoutHost(host, deps.runner)
      } catch {
        cleanupFailures.push(`${host} logout`)
      }
      try {
        await removeHost(host, deps.runner)
      } catch {
        cleanupFailures.push(`${host} removal`)
      }
    }
    if (cleanupFailures.length > 0)
      warning = `${warning ? `${warning} ` : ''}Host cleanup needs reconciliation (${cleanupFailures.join(', ')}).`
    state.write({
      schemaVersion: 1,
      epoch: current.epoch + 1,
      selectedMode: null,
      guest: { status: 'none' },
      bindings: {},
    })
    return { revoked, warning }
  })
}
