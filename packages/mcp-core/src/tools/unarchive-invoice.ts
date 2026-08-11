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
        'Restore a clearly identified archived invoice owned by the connected guest company. The invoice returns to active lists without changing its document content.',
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
          content: [{ type: 'text' as const, text: `Unarchived invoice ${result.invoiceId}.` }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
