export type AuthMode = 'guest' | 'oauth'
export type HostName = 'claude-code' | 'codex'
export type GuestBackend = 'keychain' | 'file'
export type GuestStatus = 'none' | 'active' | 'dormant' | 'needs_acknowledgement' | 'unavailable'
export type BindingStatus = 'active' | 'needs_reconcile' | 'unconfigured'

export interface HostBinding {
  epoch: number
  mode: AuthMode
  status: BindingStatus
}

export interface AuthState {
  schemaVersion: 1
  epoch: number
  selectedMode: AuthMode | null
  guest: { status: GuestStatus; backend?: GuestBackend }
  bindings: Partial<Record<HostName, HostBinding>>
}

export interface CommandResult {
  readonly ok: boolean
  readonly stderr?: string
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>

export interface SecretStore {
  readonly backend: GuestBackend
  read(): string | undefined
  write(value: string): void
  remove(): void
}
