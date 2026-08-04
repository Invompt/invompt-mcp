import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const listInvoicesOutputSchema = {
  invoices: z.array(
    z.object({
      id: z.string(),
      invoiceNumber: z.string(),
      version: z.number().int().min(1),
      clientId: z.string().nullable().optional(),
      clientName: z.string().nullable(),
      total: z.number().nullable(),
      currency: z.string(),
      status: z.string(),
      dueDate: z.string().nullable(),
      sent: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
}

export function registerListInvoicesTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'list_invoices',
    {
      title: 'List Invoices',
      description:
        'Find, browse, show, search, or list invoices owned by the connected account or guest company. Returns summaries with invoice number, client, total, currency, status, and whether it was sent. Use get_invoice for full InvoML content.',
      outputSchema: listInvoicesOutputSchema,
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number (default 1)'),
        limit: z.number().int().min(1).max(50).optional().describe('Items per page (default 20, max 50)'),
        search: z.string().optional().describe('Search by invoice number or client name'),
        status: z.enum(['approved', 'archived']).optional().describe('Filter by status'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ page, limit, search, status }) => {
      try {
        const result = await client.listInvoices({ page, limit, search, status })

        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Found ${result.total} invoice(s) (page ${result.page}/${Math.ceil(result.total / result.limit) || 1}).`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
