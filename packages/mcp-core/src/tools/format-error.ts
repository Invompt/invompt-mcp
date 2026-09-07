import { InvomptApiError } from '../error.js'

export interface ToolErrorResult extends Record<string, unknown> {
  isError: true
  content: Array<{ type: 'text'; text: string }>
}

/**
 * Safety invariant: `formatToolError` forwards `InvomptApiError.message` to the MCP client, so
 * every construction site of `InvomptApiError` must already treat `message` as sanitized,
 * client-facing text (see the doc comment on `InvomptApiError` in `../error.js`). As defense in
 * depth against that invariant being violated upstream — for example an adapter wrapping a raw
 * exception, a stack trace, or a Postgres error as `message` — this module refuses to forward a
 * message that *looks* internal (multi-line/stack-trace-like content, "at ..." stack frames, file
 * paths, or URLs carrying embedded credentials), replacing it with a generic fallback instead. A
 * message that passes this check is still capped in length and has newlines stripped before it is
 * returned.
 */
const MAX_ERROR_MESSAGE_LENGTH = 500
const GENERIC_FALLBACK_MESSAGE = 'Unexpected error.'

// "at <frame> (<path>:<line>:<col>)" or "at <path>:<line>:<col>" — typical JS/TS stack trace lines.
const STACK_FRAME_PATTERN = /\bat\s+(?:[\w$.<>]+\s+)?\(?(?:[a-zA-Z]:\\|\/|file:\/\/)[^\s()]+:\d+:\d+\)?/
// An absolute filesystem path ending in a common source/config file extension.
const FILE_PATH_PATTERN = /(?:^|[\s"'(])(?:[a-zA-Z]:\\|\/)[^\s"')]*\.(?:ts|tsx|js|jsx|mjs|cjs|json|node)\b/
// A URL with a userinfo component carrying a password, e.g. postgres://user:pass@host/db.
const CREDENTIALED_URL_PATTERN = /\w+:\/\/[^\s/]+:[^\s/@]+@/

function looksInternal(message: string): boolean {
  return (
    message.includes('\n') ||
    message.includes('\r') ||
    STACK_FRAME_PATTERN.test(message) ||
    FILE_PATH_PATTERN.test(message) ||
    CREDENTIALED_URL_PATTERN.test(message)
  )
}

function sanitizeApiErrorMessage(message: string): string {
  if (looksInternal(message)) return GENERIC_FALLBACK_MESSAGE

  const singleLine = message.replace(/[\r\n]+/g, ' ').trim()
  if (singleLine.length === 0) return GENERIC_FALLBACK_MESSAGE

  return singleLine.length > MAX_ERROR_MESSAGE_LENGTH ? `${singleLine.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…` : singleLine
}

export function formatToolError(error: unknown): ToolErrorResult {
  const apiError = error instanceof InvomptApiError ? error : new InvomptApiError('Unexpected error.', 'TOOL_ERROR')
  const message = sanitizeApiErrorMessage(apiError.message)

  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: { code: apiError.code, message } }, null, 2),
      },
    ],
  }
}
