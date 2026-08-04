import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { InvomptApiError } from '../error.js'
import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const base64Url32ByteSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Must be a 32-byte base64url value (43 characters).')

const approveAccountClaimOutputSchema = {
  approvalProof: base64Url32ByteSchema,
  replayed: z.boolean(),
}

/** Registers the Phase 2 contract shape without enabling account-claim execution. */
export function registerApproveAccountClaimTool(server: McpServer, _client: InvomptService): void {
  server.registerTool(
    'approve_account_claim',
    {
      title: 'Approve Account Claim',
      description:
        'Discovery-only Phase 2 placeholder. This tool is not operational in Phase 1 and must not be called. Account-claim execution and registered-account setup remain unavailable until Phase 2.',
      inputSchema: {
        intentId: z.uuid().describe('Claim intent UUID created by the registered Invompt Web app.'),
        nonce: base64Url32ByteSchema.describe('43-character base64url nonce displayed by that Web claim session.'),
      },
      outputSchema: approveAccountClaimOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      formatToolError(
        new InvomptApiError(
          'approve_account_claim is discovery-only and unavailable until Phase 2.',
          'ACCOUNT_CLAIM_PHASE_2_DEFERRED',
        ),
      ),
  )
}
