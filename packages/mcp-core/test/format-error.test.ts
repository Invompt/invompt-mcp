import { describe, expect, test } from 'vitest'

import { InvomptApiError } from '../src/error.js'
import { formatToolError } from '../src/tools/format-error.js'

describe('formatToolError', () => {
  test('returns isError: true for InvomptApiError', () => {
    const err = new InvomptApiError('Bad request', 'BAD_REQUEST', 400)
    const result = formatToolError(err)
    expect(result.isError).toBe(true)
  })

  test('returns isError: true for unknown errors', () => {
    const result = formatToolError(new Error('Something went wrong'))
    expect(result.isError).toBe(true)
  })

  test('returns isError: true for non-Error values', () => {
    const result = formatToolError('string error')
    expect(result.isError).toBe(true)
  })

  test('preserves error code from InvomptApiError', () => {
    const err = new InvomptApiError('msg', 'MY_CODE')
    const result = formatToolError(err)
    const text = result.content[0]?.text ?? ''
    expect(text).toContain('MY_CODE')
  })

  test('preserves error message from InvomptApiError', () => {
    const err = new InvomptApiError('Detailed error message', 'CODE')
    const result = formatToolError(err)
    const text = result.content[0]?.text ?? ''
    expect(text).toContain('Detailed error message')
  })

  test('uses TOOL_ERROR code for unknown errors', () => {
    const result = formatToolError(new Error('unknown'))
    const text = result.content[0]?.text ?? ''
    expect(text).toContain('TOOL_ERROR')
  })

  test('content has text type', () => {
    const result = formatToolError(new InvomptApiError('msg', 'CODE'))
    expect(result.content[0]?.type).toBe('text')
  })

  test('content text is valid JSON', () => {
    const result = formatToolError(new InvomptApiError('msg', 'CODE'))
    const text = result.content[0]?.text ?? ''
    expect(() => JSON.parse(text)).not.toThrow()
  })

  test('JSON payload has success: false', () => {
    const result = formatToolError(new InvomptApiError('msg', 'CODE'))
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { success: boolean }
    expect(parsed.success).toBe(false)
  })

  test('JSON payload has error.code and error.message', () => {
    const result = formatToolError(new InvomptApiError('my message', 'MY_CODE'))
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as {
      error: { code: string; message: string }
    }
    expect(parsed.error.code).toBe('MY_CODE')
    expect(parsed.error.message).toBe('my message')
  })

  test('sanitizes a multi-line stack-trace-like message instead of forwarding it verbatim', () => {
    const stackLike = [
      'TypeError: Cannot read properties of undefined (reading \'id\')',
      '    at Object.<anonymous> (/Users/ariel/Code/invompt/backend/api/invoices/handler.ts:42:17)',
      '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    ].join('\n')
    const err = new InvomptApiError(stackLike, 'INTERNAL_ERROR', 500)
    const result = formatToolError(err)
    const text = result.content[0]?.text ?? ''

    expect(text).not.toContain('at Object.<anonymous>')
    expect(text).not.toContain('/Users/ariel/Code/invompt/backend/api/invoices/handler.ts')

    const parsed = JSON.parse(text) as { error: { code: string; message: string } }
    expect(parsed.error.code).toBe('INTERNAL_ERROR')
    expect(parsed.error.message).toBe('Unexpected error.')
    expect(parsed.error.message).not.toContain('\n')
  })

  test('sanitizes a single-line message carrying a credentialed URL', () => {
    const err = new InvomptApiError('Connection failed: postgres://dbuser:s3cr3t@db.internal:5432/app', 'INTERNAL_ERROR')
    const result = formatToolError(err)
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { error: { message: string } }
    expect(parsed.error.message).toBe('Unexpected error.')
  })

  test('caps an overly long but otherwise safe message', () => {
    const longMessage = `Validation failed: ${'x'.repeat(600)}`
    const err = new InvomptApiError(longMessage, 'VALIDATION_ERROR')
    const result = formatToolError(err)
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { error: { message: string } }
    expect(parsed.error.message.length).toBeLessThanOrEqual(501)
    expect(parsed.error.message.endsWith('…')).toBe(true)
  })
})
