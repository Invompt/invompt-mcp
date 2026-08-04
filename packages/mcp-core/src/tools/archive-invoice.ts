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
        'Archive, remove from active lists, or soft-delete a clearly identified invoice owned by the connected account or guest company. The invoice remains viewable; financial documents are never permanently deleted.',
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
        openWorldHint: true,
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
              text: `Archived invoice ${result.invoiceId}.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
