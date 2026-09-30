import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { expectedVersionSchema, idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const archiveInvoiceOutputSchema = {
  invoiceId: z.string(),
  status: z.literal('archived'),
  version: z.number().int().min(1),
  replayed: z.boolean(),
}

export function registerArchiveInvoiceTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'archive_invoice',
    {
      title: 'Archive Invoice',
      description:
        'Archive a clearly identified invoice owned by the connected workspace. This retains the invoice and its InvoML for authorized workspace reads and removes it from active lists, but revokes its current hosted review and public PDF URL capability. Unarchiving does not restore that URL; renew_invoice_link can issue a new one after restoration. Already downloaded or delivered PDF copies are immutable external copies and are unaffected.',
      outputSchema: archiveInvoiceOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
        expectedVersion: expectedVersionSchema,
        idempotencyKey: idempotencyKeySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, expectedVersion, idempotencyKey }) => {
      try {
        const result = await client.archiveInvoice(id, { expectedVersion, idempotencyKey })

        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Archived invoice ${result.invoiceId}. Its current hosted review and public PDF URL capability is revoked. Already downloaded or delivered PDF copies are unaffected.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
