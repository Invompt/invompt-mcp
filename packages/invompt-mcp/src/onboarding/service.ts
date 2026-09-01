import { createGuestApi, type GuestApi } from './guest-api.js'
import { configureHost, logoutHost, removeHost } from './host-config.js'
import { createFileSecretStore, createKeychainSecretStore, selectedSecretStore } from './secret-store.js'
import { type AuthStateStore, bindHost, createAuthStateStore, selectMode } from './state.js'
import type { AuthMode, CommandRunner, GuestBackend, HostName, SecretStore } from './types.js'

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
    packageVersion: value.packageVersion ?? '0.11.3',
  }
}

function storeFor(backend: GuestBackend, value: OnboardingDependencies): SecretStore {
  return selectedSecretStore(backend, {
    keychain: value.keychain ?? createKeychainSecretStore(),
    file: value.file ?? createFileSecretStore(),
  })
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
      state.write(bindHost(state.read(), options.host, 'needs_reconcile', options.mode))
      throw error
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
  const binding = current.bindings[host]
  if (
    current.selectedMode !== 'guest' ||
    current.guest.status !== 'active' ||
    !current.guest.backend ||
    !binding ||
    binding.mode !== 'guest' ||
    binding.status !== 'active' ||
    binding.epoch !== current.epoch
  ) {
    throw new Error('Guest mode is not active on this device. Run invompt-mcp setup --mode guest.')
  }
  const credential = storeFor(current.guest.backend, deps).read()
  if (!credential) throw new Error('The selected Guest credential is unavailable. Run invompt-mcp setup --mode guest.')
  const epoch = current.epoch
  return {
    credential,
    epoch,
    guard: () => {
      const next = stateStore.read()
      const nextBinding = next.bindings[host]
      return (
        next.selectedMode === 'guest' &&
        next.guest.status === 'active' &&
        next.epoch === epoch &&
        nextBinding?.mode === 'guest' &&
        nextBinding.status === 'active' &&
        nextBinding.epoch === epoch
      )
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
