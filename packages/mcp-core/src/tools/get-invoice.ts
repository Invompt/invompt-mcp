import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const getInvoiceOutputSchema = {
  invoice: z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    version: z.number().int().min(1),
    clientId: z.string().nullable().optional(),
    clientName: z.string().nullable(),
    total: z.number().nullable(),
    currency: z.string(),
    status: z.string(),
    dueDate: z.string().nullable(),
    templateId: z.string(),
    invomlContent: z.string().nullable(),
    url: z.string().nullable(),
    linkState: z.enum(['active', 'unavailable']).optional(),
    expiresAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
}

export function registerGetInvoiceTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'get_invoice',
    {
      title: 'Get Invoice',
      description:
        'Get, retrieve, open, or inspect one invoice owned by the connected workspace with its full InvoML content. Use the returned InvoML for revisions, translations, duplication, or as a template.',
      outputSchema: getInvoiceOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const result = await client.getInvoice(id)

        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: result.invoice.url
                ? `Invoice ${result.invoice.invoiceNumber} (${result.invoice.currency} ${result.invoice.total ?? 0}): ${result.invoice.url}`
                : `Invoice ${result.invoice.invoiceNumber} (${result.invoice.currency} ${result.invoice.total ?? 0}) has no active hosted link. Use renew_invoice_link to issue a replacement.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
