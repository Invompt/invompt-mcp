import { randomBytes, randomUUID } from 'node:crypto'

import { validateGuestCredential } from '../guest-credential.js'

export const INVOMPT_WEB_URL = 'https://invompt.com'

export class GuestApiError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_OR_REVOKED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'PROTOCOL',
    readonly retryAfter?: string,
  ) {
    super(message)
    this.name = 'GuestApiError'
  }
}

export interface GuestApi {
  issueCredential(): Promise<string>
  acknowledge(credential: string): Promise<void>
  prepareRevocation(credential: string): Promise<{ operationId: string; recoveryToken: string }>
  commitRevocation(operationId: string, recoveryToken: string): Promise<void>
}

export interface GuestApiOptions {
  fetch?: typeof fetch
  baseUrl?: string
  operationId?: () => string
  recoveryToken?: () => string
}

function errorFor(response: Response): GuestApiError {
  if (response.status === 401) return new GuestApiError('Guest credential is invalid or revoked.', 'INVALID_OR_REVOKED')
  if (response.status === 429)
    return new GuestApiError(
      'Guest service is rate limited.',
      'RATE_LIMITED',
      response.headers.get('Retry-After') ?? undefined,
    )
  if (response.status >= 500) return new GuestApiError('Guest service is temporarily unavailable.', 'UNAVAILABLE')
  return new GuestApiError('Guest service returned an unexpected response.', 'PROTOCOL')
}

function unavailable(): GuestApiError {
  return new GuestApiError('Guest service is temporarily unavailable.', 'UNAVAILABLE')
}

function validateBaseUrl(value: string): string {
  if (value !== 'https://invompt.com' && value !== 'http://localhost:3100')
    throw new GuestApiError('Guest service base URL is not permitted.', 'PROTOCOL')
  return value
}

function validateRevocation(operationId: string, recoveryToken: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId) ||
    Buffer.from(recoveryToken, 'base64url').length !== 32 ||
    Buffer.from(recoveryToken, 'base64url').toString('base64url') !== recoveryToken
  )
    throw new GuestApiError('Unable to prepare a valid credential revocation.', 'PROTOCOL')
}

async function expect(response: Response, status: number): Promise<void> {
  if (response.status !== status) throw errorFor(response)
}

export function createGuestApi(options: GuestApiOptions = {}): GuestApi {
  const request = options.fetch ?? fetch
  const baseUrl = validateBaseUrl(options.baseUrl ?? INVOMPT_WEB_URL)
  const endpoint = (path: string): string => `${baseUrl}${path}`
  const send = async (path: string, init: RequestInit): Promise<Response> => {
    try {
      return await request(endpoint(path), { ...init, redirect: 'error' })
    } catch {
      throw unavailable()
    }
  }
  return {
    async issueCredential(): Promise<string> {
      const response = await send('/api/guest/v1/credentials', { method: 'POST', headers: { 'Content-Length': '0' } })
      await expect(response, 201)
      const value = (await response.json()) as { credential?: unknown; credentialType?: unknown }
      if (value.credentialType !== 'inv_gd_v1' || typeof value.credential !== 'string')
        throw new GuestApiError('Guest service returned an invalid credential response.', 'PROTOCOL')
      return validateGuestCredential(value.credential)
    },
    async acknowledge(credential: string): Promise<void> {
      validateGuestCredential(credential)
      await expect(
        await send('/api/guest/v1/credentials/acknowledge', {
          method: 'POST',
          headers: { Authorization: `Bearer ${credential}`, 'Content-Length': '0' },
        }),
        200,
      )
    },
    async prepareRevocation(credential: string): Promise<{ operationId: string; recoveryToken: string }> {
      validateGuestCredential(credential)
      const operationId = (options.operationId ?? randomUUID)()
      const recoveryToken = (options.recoveryToken ?? (() => randomBytes(32).toString('base64url')))()
      validateRevocation(operationId, recoveryToken)
      await expect(
        await send('/api/guest/v1/credentials/revocations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId, recoveryToken }),
        }),
        201,
      )
      return { operationId, recoveryToken }
    },
    async commitRevocation(operationId: string, recoveryToken: string): Promise<void> {
      validateRevocation(operationId, recoveryToken)
      await expect(
        await send(`/api/guest/v1/credential-operations/${operationId}`, {
          method: 'PUT',
          headers: { Authorization: `Invompt-Recovery ${recoveryToken}`, 'Content-Type': 'application/json' },
          body: '{}',
        }),
        200,
      )
    },
  }
}
