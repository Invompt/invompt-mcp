/**
 * Safety invariant: `message` is public, client-facing text that MCP tools forward verbatim (see
 * `formatToolError` in `./tools/format-error.js`). Every construction site — in this repo and in
 * any out-of-repo `InvomptService` adapter — MUST supply an already-sanitized message meant for an
 * end user or AI host. Never wrap a raw upstream error, a stack trace, a file path, or any other
 * internal detail as `message`; sanitize or replace it before constructing this error.
 */
export class InvomptApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'InvomptApiError'
  }
}
