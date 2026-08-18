import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const TRUSTED_PUBLIC_HOSTS = new Set(['invompt.com', 'www.invompt.com'])
const TRUSTED_VERCEL_HOST = /^invompt(?:-[a-z0-9-]+)?-(?:4riel|invo7)\.vercel\.app$/
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const claimUrlSchema = z.url().refine(
  (value) => {
    const url = new URL(value)
    if (url.username || url.password) return false
    if (LOOPBACK_HOSTS.has(url.hostname)) return url.protocol === 'http:' || url.protocol === 'https:'
    return (
      url.protocol === 'https:' &&
      (TRUSTED_PUBLIC_HOSTS.has(url.hostname) || TRUSTED_VERCEL_HOST.test(url.hostname))
    )
  },
  'Must use an approved Invompt HTTPS host or an exact HTTP/HTTPS loopback host.',
)

const createAccountClaimLinkOutputSchema = {
  claimUrl: claimUrlSchema,
  expiresAt: z.iso.datetime(),
}

export function registerCreateAccountClaimLinkTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'create_account_claim_link',
    {
      title: 'Create Account Claim Link',
      description:
        'Create a short-lived browser link that lets the current Guest claim this workspace into an authenticated Invompt account. Guest-account-only and transport-neutral; the backend decides eligibility. The link is sensitive, expires, and must be presented once without logging it.',
      inputSchema: {},
      outputSchema: createAccountClaimLinkOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const result = await client.createAccountClaimLink()
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Account claim link created. It expires at ${result.expiresAt}. Present claimUrl exactly once and do not log it.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
