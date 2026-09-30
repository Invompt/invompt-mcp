import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { expectedVersionSchema, idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const unarchiveInvoiceOutputSchema = {
  invoiceId: z.string(),
  status: z.literal('unarchived'),
  version: z.number().int().min(1),
  replayed: z.boolean(),
}

export function registerUnarchiveInvoiceTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'unarchive_invoice',
    {
      title: 'Unarchive Invoice',
      description:
        'Restore a clearly identified archived invoice owned by the connected workspace only when the user has requested restoration. The invoice returns to active lists without changing its document content. Restoration does not revive its former hosted review or public PDF URL; call renew_invoice_link after restoration only if the user also wants a new hosted link.',
      outputSchema: unarchiveInvoiceOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
        expectedVersion: expectedVersionSchema,
        idempotencyKey: idempotencyKeySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, expectedVersion, idempotencyKey }) => {
      try {
        const result = await client.unarchiveInvoice(id, { expectedVersion, idempotencyKey })
        return {
          structuredContent: result,
          content: [{
            type: 'text' as const,
            text: `Unarchived invoice ${result.invoiceId}. Its former hosted URL remains revoked; use renew_invoice_link only if the user also wants a new hosted link.`,
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
