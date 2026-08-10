import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import type { AuthMode, AuthState, HostName } from './types.js'

export const AUTH_STATE_FILE_NAME = 'auth-state.json'
export const AUTH_STATE_SCHEMA_VERSION = 1 as const
const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600

export interface AuthStateStore {
  readonly path: string
  read(): AuthState
  write(state: AuthState): void
  withLock<T>(operation: () => Promise<T>): Promise<T>
}

export function authStatePath(homeDirectory: string = homedir()): string {
  return join(homeDirectory, '.invompt', AUTH_STATE_FILE_NAME)
}

export function initialAuthState(): AuthState {
  return {
    schemaVersion: AUTH_STATE_SCHEMA_VERSION,
    epoch: 1,
    selectedMode: null,
    guest: { status: 'none' },
    bindings: {},
  }
}

function validateState(value: unknown): AuthState {
  if (!value || typeof value !== 'object') throw new Error('Invompt authentication state is invalid.')
  const state = value as Partial<AuthState>
  if (
    state.schemaVersion !== AUTH_STATE_SCHEMA_VERSION ||
    !Number.isSafeInteger(state.epoch) ||
    (state.epoch ?? 0) < 1 ||
    (state.selectedMode !== null && state.selectedMode !== 'guest' && state.selectedMode !== 'oauth') ||
    !state.guest ||
    !['none', 'active', 'dormant', 'needs_acknowledgement', 'unavailable'].includes(state.guest.status) ||
    (state.guest.backend !== undefined && state.guest.backend !== 'keychain' && state.guest.backend !== 'file') ||
    !state.bindings ||
    typeof state.bindings !== 'object'
  )
    throw new Error('Invompt authentication state is invalid.')
  for (const binding of Object.values(state.bindings)) {
    if (
      !binding ||
      !Number.isSafeInteger(binding.epoch) ||
      binding.epoch < 1 ||
      (binding.mode !== 'guest' && binding.mode !== 'oauth') ||
      !['active', 'needs_reconcile', 'unconfigured'].includes(binding.status)
    ) {
      throw new Error('Invompt authentication state is invalid.')
    }
  }
  return state as AuthState
}

function ensureDirectory(directory: string): void {
  try {
    lstatSync(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    mkdirSync(directory, { recursive: true, mode: DIRECTORY_MODE })
  }
  const stat = lstatSync(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invompt authentication state directory is unsafe.')
  chmodSync(directory, DIRECTORY_MODE)
}

function readPrivateFile(path: string): string {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== FILE_MODE)
    throw new Error('Invompt authentication state is unsafe.')
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const opened = fstatSync(descriptor)
    if (!opened.isFile() || (opened.mode & 0o777) !== FILE_MODE)
      throw new Error('Invompt authentication state is unsafe.')
    return readFileSync(descriptor, 'utf8')
  } finally {
    closeSync(descriptor)
  }
}

function writePrivateFile(path: string, contents: string): void {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  const descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, FILE_MODE)
  try {
    const bytes = Buffer.from(contents, 'utf8')
    let offset = 0
    while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset, bytes.length - offset)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  chmodSync(temporary, FILE_MODE)
  renameSync(temporary, path)
  const directory = openSync(dirname(path), constants.O_RDONLY)
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
}

export function createAuthStateStore(path: string = authStatePath()): AuthStateStore {
  const directory = dirname(path)
  const lockPath = `${path}.lock`
  return {
    path,
    read(): AuthState {
      try {
        return validateState(JSON.parse(readPrivateFile(path)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return initialAuthState()
        throw error
      }
    },
    write(state: AuthState): void {
      validateState(state)
      ensureDirectory(directory)
      writePrivateFile(path, `${JSON.stringify(state)}\n`)
    },
    async withLock<T>(operation: () => Promise<T>): Promise<T> {
      ensureDirectory(directory)
      let descriptor: number | undefined
      for (let attempt = 0; attempt < 500; attempt += 1) {
        try {
          descriptor = openSync(lockPath, 'wx', FILE_MODE)
          writeSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
          fsyncSync(descriptor)
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          try {
            const lock = JSON.parse(readPrivateFile(lockPath)) as { pid?: unknown; createdAt?: unknown }
            const pid = typeof lock.pid === 'number' ? lock.pid : 0
            let alive = false
            try {
              process.kill(pid, 0)
              alive = true
            } catch (processError) {
              alive = (processError as NodeJS.ErrnoException).code !== 'ESRCH'
            }
            if (typeof lock.createdAt !== 'number' || Date.now() - lock.createdAt > 300_000 || !alive) {
              unlinkSync(lockPath)
              continue
            }
          } catch (lockError) {
            if ((lockError as NodeJS.ErrnoException).code !== 'ENOENT') throw lockError
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 10))
        }
      }
      if (descriptor === undefined) throw new Error('Another Invompt setup operation is still in progress.')
      try {
        return await operation()
      } finally {
        closeSync(descriptor)
        try {
          unlinkSync(lockPath)
        } catch {
          /* lock cleanup is best effort */
        }
      }
    },
  }
}

export function selectMode(state: AuthState, mode: AuthMode): AuthState {
  if (state.selectedMode === mode) return state
  // Existing bindings retain their old epochs so hosts can recognize they are stale.
  return { ...state, epoch: state.epoch + 1, selectedMode: mode }
}

export function bindHost(
  state: AuthState,
  host: HostName,
  status: 'active' | 'needs_reconcile' | 'unconfigured',
  mode: AuthMode,
): AuthState {
  return { ...state, bindings: { ...state.bindings, [host]: { epoch: state.epoch, status, mode } } }
}
