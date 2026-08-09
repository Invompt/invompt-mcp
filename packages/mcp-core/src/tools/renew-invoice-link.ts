import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const renewInvoiceLinkOutputSchema = {
  invoiceId: z.string(),
  url: z.url(),
  expiresAt: z.iso.datetime(),
  replayed: z.boolean(),
}

export function registerRenewInvoiceLinkTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'renew_invoice_link',
    {
      title: 'Renew Invoice Link',
      description:
        'Issue a replacement 72-hour hosted review link for an existing invoice without creating or revising the invoice. The previous public link is revoked when the connected service supports renewal.',
      outputSchema: renewInvoiceLinkOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
        idempotencyKey: idempotencyKeySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, idempotencyKey }) => {
      try {
        const result = await client.renewInvoiceLink(id, { idempotencyKey })
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Replacement review link for invoice ${result.invoiceId}: ${result.url}`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
