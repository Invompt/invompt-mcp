import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { InvomptApiError } from './error.js'

export const GUEST_CREDENTIAL_ENV = 'INVOMPT_GUEST_CREDENTIAL'
export const GUEST_CREDENTIAL_HEADER = 'X-Invompt-Guest-Credential'
export const GUEST_CREDENTIAL_FILE_NAME = 'guest-credential'
export const GUEST_CREDENTIAL_PREFIX = 'inv_gd_v1'

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const GUEST_CREDENTIAL_PATTERN = /^inv_gd_v1\.[a-z0-9]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/
const GUEST_CREDENTIAL_TRANSITION_PREFIX = '.guest-credential.transition.'
const GUEST_CREDENTIAL_ACK_PREFIX = '.guest-credential.ack.'

interface PendingCredentialTransition {
  version: 1
  state: 'pending'
  pid: number
  createdAt: number
  ownerToken: string
  expectedHash: string
  nextCredential: string
}

interface CompleteCredentialTransition {
  version: 1
  state: 'complete'
  expectedHash: string
  nextHash: string
  completedAt: number
}

type CredentialTransition = PendingCredentialTransition | CompleteCredentialTransition

function localStateDirectory(): string {
  const homeDirectory = process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || homedir()
  return join(homeDirectory, '.invompt')
}

export function guestCredentialFilePath(): string {
  return join(localStateDirectory(), GUEST_CREDENTIAL_FILE_NAME)
}

export function validateGuestCredential(value: string): string {
  if (!GUEST_CREDENTIAL_PATTERN.test(value)) {
    throw invalidCredential()
  }
  const [, , nonce, mac] = value.split('.')
  if (!isCanonical32ByteBase64Url(nonce) || !isCanonical32ByteBase64Url(mac)) {
    throw invalidCredential()
  }
  return value
}

function invalidCredential(): InvomptApiError {
  return new InvomptApiError(
    `Guest credential must use the ${GUEST_CREDENTIAL_PREFIX} versioned format.`,
    'INVALID_GUEST_CREDENTIAL',
  )
}

function isCanonical32ByteBase64Url(value: string): boolean {
  const decoded = Buffer.from(value, 'base64url')
  return decoded.length === 32 && decoded.toString('base64url') === value
}

export function shouldFsyncCredentialDirectory(platform: string = process.platform): boolean {
  return platform !== 'win32'
}

export function supportsGuestCredentialFilePersistence(platform: string = process.platform): boolean {
  return platform !== 'win32'
}

function unreadableCredential(): InvomptApiError {
  return new InvomptApiError('The Invompt guest credential cannot be read safely.', 'GUEST_CREDENTIAL_UNREADABLE')
}

function assertPrivateRegularFile(path: string): void {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isFile()) throw unreadableCredential()
  if (process.platform !== 'win32' && (stat.mode & 0o777) !== PRIVATE_FILE_MODE) {
    throw unreadableCredential()
  }
}

function assertPrivateDirectory(path: string): void {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw unreadableCredential()
  if (process.platform !== 'win32' && (stat.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) {
    throw unreadableCredential()
  }
}

function readPrivateFile(path: string): string {
  assertPrivateRegularFile(path)
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const stat = fstatSync(descriptor)
    if (!stat.isFile() || (process.platform !== 'win32' && (stat.mode & 0o777) !== PRIVATE_FILE_MODE)) {
      throw unreadableCredential()
    }
    return readFileSync(descriptor, 'utf8')
  } finally {
    closeSync(descriptor)
  }
}

function readPrivateCredentialFile(path: string): string {
  try {
    return validateGuestCredential(readPrivateFile(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error
    throw unreadableCredential()
  }
}

function ensurePrivateDirectory(directory: string): void {
  try {
    assertPrivateDirectory(directory)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  let createdDirectory = false
  try {
    mkdirSync(directory, { mode: PRIVATE_DIRECTORY_MODE })
    createdDirectory = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  if (createdDirectory && process.platform !== 'win32') chmodSync(directory, PRIVATE_DIRECTORY_MODE)
  assertPrivateDirectory(directory)
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function writePrivateTemp(path: string, contents: string): void {
  const descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, PRIVATE_FILE_MODE)
  try {
    const buffer = Buffer.from(contents, 'utf8')
    let offset = 0
    while (offset < buffer.length) {
      const written = writeSync(descriptor, buffer, offset, buffer.length - offset)
      if (written <= 0) throw unreadableCredential()
      offset += written
    }
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  if (process.platform !== 'win32') chmodSync(path, PRIVATE_FILE_MODE)
}

function writePrivateFileNoClobber(path: string, contents: string): void {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writePrivateTemp(temp, contents)
    linkSync(temp, path)
    unlinkSync(temp)
    fsyncDirectory(dirname(path))
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      // The temp may not exist or may already have been linked and removed.
    }
    throw error
  }
}

function replacePrivateFile(path: string, contents: string): void {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writePrivateTemp(temp, contents)
    renameSync(temp, path)
    fsyncDirectory(dirname(path))
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      // The temp may not exist or may already have been renamed.
    }
    throw error
  }
}

function credentialHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function transitionHash(expectedCredential: string | undefined): string {
  return credentialHash(expectedCredential ?? 'initial')
}

function transitionPath(directory: string, expectedCredential: string | undefined): string {
  return join(directory, `${GUEST_CREDENTIAL_TRANSITION_PREFIX}${transitionHash(expectedCredential)}`)
}

function ackPath(directory: string, credential: string): string {
  return join(directory, `${GUEST_CREDENTIAL_ACK_PREFIX}${credentialHash(credential)}`)
}

function ackReleasePath(directory: string, credential: string, ownerToken: string): string {
  return `${ackPath(directory, credential)}.released.${ownerToken}`
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

function inspectOrphanPrivateTemp(directory: string): string | undefined {
  for (;;) {
    const candidates = readdirSync(directory).filter(
      (name) => name.includes('guest-credential') && name.endsWith('.tmp'),
    )
    if (candidates.length === 0) return undefined
    if (candidates.length !== 1) throw unreadableCredential()

    const name = candidates[0]
    const match = /^(.*)\.(\d+)\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.tmp$/.exec(name)
    if (!match) throw unreadableCredential()
    const [, targetName, rawPid] = match
    const pid = Number(rawPid)
    if (!Number.isSafeInteger(pid) || pid <= 0) throw unreadableCredential()

    const path = join(directory, name)
    const transitionMatch = /^\.guest-credential\.transition\.([a-f0-9]{64})$/.exec(targetName)
    const ackMatch = /^\.guest-credential\.ack\.([a-f0-9]{64})$/.exec(targetName)
    const releaseMatch =
      /^\.guest-credential\.ack\.([a-f0-9]{64})\.released\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
        targetName,
      )
    try {
      if (targetName === GUEST_CREDENTIAL_FILE_NAME) {
        validateGuestCredential(readPrivateFile(path))
      } else if (transitionMatch) {
        const transition = parseTransition(path)
        if (
          transition.expectedHash !== transitionMatch[1] ||
          (transition.state === 'pending' && transition.pid !== pid)
        ) {
          throw unreadableCredential()
        }
      } else if (ackMatch) {
        const ack = JSON.parse(readPrivateFile(path)) as {
          version?: number
          pid?: number
          createdAt?: number
          ownerToken?: string
        }
        if (
          ack.version !== 1 ||
          !Number.isSafeInteger(ack.pid) ||
          (ack.pid ?? 0) <= 0 ||
          !Number.isFinite(ack.createdAt) ||
          typeof ack.ownerToken !== 'string' ||
          ack.ownerToken.length < 16
        ) {
          throw unreadableCredential()
        }
      } else if (releaseMatch) {
        const release = JSON.parse(readPrivateFile(path)) as { version?: number; releasedAt?: number }
        if (release.version !== 1 || !Number.isFinite(release.releasedAt)) throw unreadableCredential()
      } else {
        throw unreadableCredential()
      }
    } catch (error) {
      // A live writer can publish and remove its private temp after readdir but
      // before our lstat/open. The vanished snapshot proves nothing unsafe;
      // inspect the directory's current state instead of leaking raw ENOENT.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      if (error instanceof InvomptApiError) throw error
      throw unreadableCredential()
    }
    if (processIsAlive(pid)) {
      throw new InvomptApiError('Another Invompt guest credential update is in progress.', 'GUEST_CREDENTIAL_LOCKED')
    }
    return path
  }
}

function cleanupOrphanPrivateTemp(directory: string): void {
  for (;;) {
    const orphan = inspectOrphanPrivateTemp(directory)
    if (!orphan) return
    try {
      unlinkSync(orphan)
    } catch (error) {
      // Another recovery or the original writer may have removed this exact
      // temp after inspection. Re-scan before deciding the directory is clean.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    fsyncDirectory(directory)
    return
  }
}

function parseTransition(path: string): CredentialTransition {
  let parsed: unknown
  try {
    parsed = JSON.parse(readPrivateFile(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error
    throw unreadableCredential()
  }
  if (!parsed || typeof parsed !== 'object') throw unreadableCredential()
  const value = parsed as Record<string, unknown>
  if (
    value.version !== 1 ||
    (value.state !== 'pending' && value.state !== 'complete') ||
    typeof value.expectedHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.expectedHash)
  ) {
    throw unreadableCredential()
  }
  if (value.state === 'pending') {
    if (
      !Number.isSafeInteger(value.pid) ||
      (value.pid as number) <= 0 ||
      !Number.isFinite(value.createdAt) ||
      typeof value.ownerToken !== 'string' ||
      value.ownerToken.length < 16 ||
      typeof value.nextCredential !== 'string'
    ) {
      throw unreadableCredential()
    }
    validateGuestCredential(value.nextCredential)
  } else if (
    typeof value.nextHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.nextHash) ||
    !Number.isFinite(value.completedAt)
  ) {
    throw unreadableCredential()
  }
  return value as unknown as CredentialTransition
}

function readCurrentCredential(target: string): string | undefined {
  try {
    return readPrivateCredentialFile(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

function ensureTransitionAcknowledgement(directory: string, transition: PendingCredentialTransition): void {
  const path = ackPath(directory, transition.nextCredential)
  try {
    writePrivateFileNoClobber(
      path,
      JSON.stringify({
        version: 1,
        pid: transition.pid,
        createdAt: transition.createdAt,
        ownerToken: transition.ownerToken,
      }),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    let existing: { version?: number; pid?: number; createdAt?: number; ownerToken?: string }
    try {
      existing = JSON.parse(readPrivateFile(path))
    } catch {
      throw unreadableCredential()
    }
    if (
      existing.version !== 1 ||
      existing.pid !== transition.pid ||
      existing.createdAt !== transition.createdAt ||
      existing.ownerToken !== transition.ownerToken
    ) {
      throw unreadableCredential()
    }
  }
}

function assertAcknowledgedPredecessor(directory: string, expectedCredential: string): void {
  const path = ackPath(directory, expectedCredential)
  let metadata: { version?: number; pid?: number; ownerToken?: string }
  try {
    metadata = JSON.parse(readPrivateFile(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw unreadableCredential()
  }
  const pid = metadata.pid
  if (
    metadata.version !== 1 ||
    !Number.isSafeInteger(pid) ||
    (pid ?? 0) <= 0 ||
    typeof metadata.ownerToken !== 'string'
  ) {
    throw unreadableCredential()
  }
  if (
    !readFileIfPresent(ackReleasePath(directory, expectedCredential, metadata.ownerToken)) &&
    processIsAlive(pid as number)
  ) {
    throw new InvomptApiError(
      'The preceding Invompt guest credential update has not returned to its owner yet.',
      'GUEST_CREDENTIAL_LOCKED',
    )
  }
}

function readFileIfPresent(path: string): string | undefined {
  try {
    return readPrivateFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

function releaseAcknowledgementAfterReturn(directory: string, credential: string, ownerToken: string): void {
  const path = ackReleasePath(directory, credential, ownerToken)
  setImmediate(() => {
    try {
      writePrivateFileNoClobber(path, JSON.stringify({ version: 1, releasedAt: Date.now() }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        // Fail closed: while this process remains alive, absence keeps the next
        // transition blocked. Process death makes the immutable ack recoverable.
      }
    }
  })
}

function publishTransition(
  target: string,
  transitionFile: string,
  transition: PendingCredentialTransition,
  expectedCredential: string | undefined,
): string {
  const current = readCurrentCredential(target)
  const nextCredential = transition.nextCredential

  if (expectedCredential === undefined) {
    if (current === undefined) {
      writePrivateFileNoClobber(target, nextCredential)
    } else if (current !== nextCredential) {
      throw new InvomptApiError(
        'An Invompt guest credential already exists; replacement requires an explicit rotation.',
        'GUEST_CREDENTIAL_EXISTS',
      )
    }
  } else if (current === expectedCredential) {
    replacePrivateFile(target, nextCredential)
  } else if (current !== nextCredential) {
    throw new InvomptApiError(
      'The current Invompt guest credential does not match the expected rotation state.',
      'GUEST_CREDENTIAL_ROTATION_CONFLICT',
    )
  }

  const persisted = readPrivateCredentialFile(target)
  if (persisted !== nextCredential) throw unreadableCredential()

  const complete: CompleteCredentialTransition = {
    version: 1,
    state: 'complete',
    expectedHash: transition.expectedHash,
    nextHash: credentialHash(nextCredential),
    completedAt: Date.now(),
  }
  replacePrivateFile(transitionFile, JSON.stringify(complete))
  return nextCredential
}

/**
 * Resolve the single machine credential shared by Claude Code, Codex, and Kimi.
 */
export function readGuestCredential(): string | undefined {
  const fromEnvironment = process.env[GUEST_CREDENTIAL_ENV]
  if (fromEnvironment !== undefined) return validateGuestCredential(fromEnvironment)

  const path = guestCredentialFilePath()
  try {
    const directory = dirname(path)
    assertPrivateDirectory(directory)
    cleanupOrphanPrivateTemp(directory)
    return readPrivateCredentialFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        const directory = dirname(path)
        const hasTransition = readdirSync(directory).some(
          (name) => name.startsWith(GUEST_CREDENTIAL_TRANSITION_PREFIX) && !name.endsWith('.tmp'),
        )
        if (hasTransition) throw unreadableCredential()
      } catch (directoryError) {
        if ((directoryError as NodeJS.ErrnoException).code !== 'ENOENT') throw directoryError
      }
      return undefined
    }
    if (error instanceof InvomptApiError) throw error
    throw unreadableCredential()
  }
}

export interface PersistGuestCredentialOptions {
  expectedCredential?: string
}

/**
 * Persist a server-issued guest credential through an immutable per-state
 * transition. O_EXCL admits exactly one next credential for a given current
 * state. A pending transition is recoverable and idempotent; completion seals
 * it with hashes so a late contender can never supersede it.
 */
export function persistGuestCredential(rawCredential: string, options: PersistGuestCredentialOptions = {}): string {
  try {
    return persistGuestCredentialToFile(rawCredential, options)
  } catch (error) {
    if (error instanceof InvomptApiError) throw error
    if (isNodeFileSystemError(error)) throw unreadableCredential()
    throw error
  }
}

function isNodeFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
}

function persistGuestCredentialToFile(rawCredential: string, options: PersistGuestCredentialOptions): string {
  const credential = validateGuestCredential(rawCredential)
  const expectedCredential =
    options.expectedCredential !== undefined ? validateGuestCredential(options.expectedCredential) : undefined
  if (!supportsGuestCredentialFilePersistence()) {
    throw new InvomptApiError(
      'Guest credential file persistence is not supported on Windows; use INVOMPT_GUEST_CREDENTIAL.',
      'GUEST_CREDENTIAL_PERSISTENCE_UNSUPPORTED',
    )
  }

  const target = guestCredentialFilePath()
  const directory = dirname(target)
  ensurePrivateDirectory(directory)
  cleanupOrphanPrivateTemp(directory)
  const transitionFile = transitionPath(directory, expectedCredential)
  const expectedHash = transitionHash(expectedCredential)
  const current = readCurrentCredential(target)
  let existingTransition: CredentialTransition | undefined
  try {
    existingTransition = parseTransition(transitionFile)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  if (expectedCredential === undefined) {
    if (current !== undefined) {
      if (
        ((existingTransition?.state === 'complete' && existingTransition.nextHash === credentialHash(credential)) ||
          (existingTransition?.state === 'pending' && existingTransition.nextCredential === credential)) &&
        current === credential
      ) {
        if (existingTransition.state === 'complete') return credential
      } else {
        throw new InvomptApiError(
          'An Invompt guest credential already exists; replacement requires an explicit rotation.',
          'GUEST_CREDENTIAL_EXISTS',
        )
      }
    }
    if (existingTransition?.state === 'complete') throw unreadableCredential()
  } else if (current !== expectedCredential) {
    if (
      ((existingTransition?.state === 'complete' && existingTransition.nextHash === credentialHash(credential)) ||
        (existingTransition?.state === 'pending' && existingTransition.nextCredential === credential)) &&
      current === credential
    ) {
      if (existingTransition.state === 'complete') return credential
    } else {
      throw new InvomptApiError(
        'The current Invompt guest credential does not match the expected rotation state.',
        'GUEST_CREDENTIAL_ROTATION_CONFLICT',
      )
    }
  } else {
    assertAcknowledgedPredecessor(directory, expectedCredential)
  }

  const pending: PendingCredentialTransition = {
    version: 1,
    state: 'pending',
    pid: process.pid,
    createdAt: Date.now(),
    ownerToken: randomUUID(),
    expectedHash,
    nextCredential: credential,
  }

  let transition: CredentialTransition
  let admitted = false
  try {
    writePrivateFileNoClobber(transitionFile, JSON.stringify(pending))
    transition = pending
    admitted = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      if (error instanceof InvomptApiError) throw error
      throw unreadableCredential()
    }
    transition = parseTransition(transitionFile)
  }

  if (transition.expectedHash !== expectedHash) throw unreadableCredential()
  if (transition.state === 'complete') {
    const current = readCurrentCredential(target)
    if (transition.nextHash === credentialHash(credential) && current === credential) return credential
    throw new InvomptApiError(
      expectedCredential === undefined
        ? 'An Invompt guest credential already exists; replacement requires an explicit rotation.'
        : 'The current Invompt guest credential does not match the expected rotation state.',
      expectedCredential === undefined ? 'GUEST_CREDENTIAL_EXISTS' : 'GUEST_CREDENTIAL_ROTATION_CONFLICT',
    )
  }

  ensureTransitionAcknowledgement(directory, transition)
  const published = publishTransition(target, transitionFile, transition, expectedCredential)
  if (published !== credential) {
    throw new InvomptApiError(
      expectedCredential === undefined
        ? 'An Invompt guest credential already exists; replacement requires an explicit rotation.'
        : 'The current Invompt guest credential does not match the expected rotation state.',
      expectedCredential === undefined ? 'GUEST_CREDENTIAL_EXISTS' : 'GUEST_CREDENTIAL_ROTATION_CONFLICT',
    )
  }
  if (admitted) {
    releaseAcknowledgementAfterReturn(directory, credential, transition.ownerToken)
  }
  return published
}
