import { spawnSync } from 'node:child_process'
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

import { validateGuestCredential } from '../guest-credential.js'
import type { GuestBackend, SecretStore } from './types.js'

export const KEYCHAIN_SERVICE = 'com.invompt.invompt-mcp'
export const KEYCHAIN_ACCOUNT = 'guest-credential'

export interface SecurityCommand {
  status: number | null
  secret?: string
}

export type SecurityRunner = (args: readonly string[], input?: string) => SecurityCommand

function defaultSecurityRunner(args: readonly string[], input?: string): SecurityCommand {
  const [, ...programArgs] = args
  const result = spawnSync('/usr/bin/osascript', programArgs, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'ignore', 'ignore', 'pipe'],
  })
  return { status: result.status, secret: result.output?.[3] ? String(result.output[3]) : undefined }
}

function jxaSource(operation: 'read' | 'write' | 'remove'): string {
  const setup = `ObjC.import('Security');ObjC.import('Foundation');ObjC.import('stdlib');const service='${KEYCHAIN_SERVICE}';const account='${KEYCHAIN_ACCOUNT}';const q=$({'class':'genp','svce':service,'acct':account});`
  if (operation === 'read')
    return `${setup}const r=$({'class':'genp','svce':service,'acct':account,'r_Data':true});const out=Ref();const s=Number($.SecItemCopyMatching(r,out));if(s===-25300)$.exit(10);if(s!==0)$.exit(1);$.NSFileHandle.alloc.initWithFileDescriptorCloseOnDealloc(3,false).writeData(out[0]);`
  if (operation === 'remove') return `${setup}const s=Number($.SecItemDelete(q));if(s!==0&&s!==-25300)$.exit(1);`
  return `${setup}const d=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;const a=$({'v_Data':d});let s=Number($.SecItemUpdate(q,a));if(s===-25300)s=Number($.SecItemAdd($({'class':'genp','svce':service,'acct':account,'v_Data':d}),null));if(s===-25299)s=Number($.SecItemUpdate(q,a));if(s!==0)$.exit(1);`
}

export function guestFallbackPath(homeDirectory: string = homedir()): string {
  return join(homeDirectory, '.invompt', 'guest-credential')
}

export function createKeychainSecretStore(runner: SecurityRunner = defaultSecurityRunner): SecretStore {
  function fail(action: string, result: SecurityCommand): never {
    void result
    throw new Error(`macOS Keychain ${action} failed. Keychain is unavailable or locked.`)
  }
  return {
    backend: 'keychain',
    read(): string | undefined {
      const result = runner(['osascript', '-l', 'JavaScript', '-e', jxaSource('read')])
      if (result.status === 10) return undefined
      if (result.status !== 0) fail('read', result)
      if (!result.secret) throw new Error('macOS Keychain read failed. Keychain is unavailable or locked.')
      return validateGuestCredential(result.secret.trim())
    },
    write(value: string): void {
      validateGuestCredential(value)
      // Security.framework receives the secret over standard input; it never reaches a process argument.
      const result = runner(['osascript', '-l', 'JavaScript', '-e', jxaSource('write')], value)
      if (result.status !== 0) fail('write', result)
    },
    remove(): void {
      const result = runner(['osascript', '-l', 'JavaScript', '-e', jxaSource('remove')])
      if (result.status !== 0 && result.status !== 10) fail('delete', result)
    },
  }
}

export function createFileSecretStore(path: string = guestFallbackPath()): SecretStore {
  return {
    backend: 'file',
    read(): string | undefined {
      try {
        const stat = lstatSync(path)
        if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600)
          throw new Error('Guest credential fallback is unsafe.')
        const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
        try {
          const opened = fstatSync(descriptor)
          if (!opened.isFile() || (opened.mode & 0o777) !== 0o600)
            throw new Error('Guest credential fallback is unsafe.')
          return validateGuestCredential(readFileSync(descriptor, 'utf8').trim())
        } finally {
          closeSync(descriptor)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
        throw error
      }
    },
    write(value: string): void {
      validateGuestCredential(value)
      const directory = dirname(path)
      try {
        lstatSync(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        mkdirSync(directory, { recursive: true, mode: 0o700 })
      }
      const directoryStat = lstatSync(directory)
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
        throw new Error('Guest credential fallback directory is unsafe.')
      chmodSync(directory, 0o700)
      const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
      const descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
      try {
        writeSync(descriptor, value)
        fsyncSync(descriptor)
      } finally {
        closeSync(descriptor)
      }
      chmodSync(temporary, 0o600)
      renameSync(temporary, path)
      const directoryDescriptor = openSync(directory, constants.O_RDONLY)
      try {
        fsyncSync(directoryDescriptor)
      } finally {
        closeSync(directoryDescriptor)
      }
    },
    remove(): void {
      try {
        const stat = lstatSync(path)
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Guest credential fallback is unsafe.')
        unlinkSync(path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    },
  }
}

export function selectedSecretStore(
  backend: GuestBackend,
  options: { keychain?: SecretStore; file?: SecretStore } = {},
): SecretStore {
  if (backend === 'keychain') return options.keychain ?? createKeychainSecretStore()
  return options.file ?? createFileSecretStore()
}
