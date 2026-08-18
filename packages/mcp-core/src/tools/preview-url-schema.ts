import { z } from 'zod'

const PREVIEW_PATHNAME = /^\/preview\/[A-Za-z0-9_-]{43}$/
const PREVIEW_URL_PATTERN = /^https?:\/\/[^/?#]+\/preview\/[A-Za-z0-9_-]{43}$/
const HTTP_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const INVALID_PREVIEW_URL_MESSAGE =
  'Expected an absolute HTTPS capability URL (HTTP only on loopback) with a /preview/{43-character base64url token} pathname and no credentials, query, or fragment.'

/**
 * A public invoice link is a bearer capability, not an authenticated invoice route.
 * Hosts are intentionally unrestricted so local acceptance can use localhost.
 */
export const previewUrlSchema = z.string().url().regex(PREVIEW_URL_PATTERN, INVALID_PREVIEW_URL_MESSAGE).superRefine((value, context) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    context.addIssue({ code: 'custom', message: INVALID_PREVIEW_URL_MESSAGE })
    return
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    (url.protocol === 'http:' && !HTTP_LOOPBACK_HOSTS.has(url.hostname)) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href.includes('?') ||
    url.href.includes('#') ||
    !PREVIEW_PATHNAME.test(url.pathname)
  ) {
    context.addIssue({ code: 'custom', message: INVALID_PREVIEW_URL_MESSAGE })
  }
})
