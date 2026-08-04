import { InvomptApiError } from '../error.js'

export interface ToolErrorResult extends Record<string, unknown> {
  isError: true
  content: Array<{ type: 'text'; text: string }>
}

export function formatToolError(error: unknown): ToolErrorResult {
  const apiError = error instanceof InvomptApiError ? error : new InvomptApiError('Unexpected error.', 'TOOL_ERROR')

  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: { code: apiError.code, message: apiError.message } }, null, 2),
      },
    ],
  }
}
