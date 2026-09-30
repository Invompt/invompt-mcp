import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'
import { previewUrlSchema } from './preview-url-schema.js'

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
    url: previewUrlSchema.nullable(),
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
        'Get, retrieve, open, or inspect one invoice owned by the connected workspace with its full InvoML content. Use the returned InvoML for revisions, translations, and explicit duplication via create_invoice. For reusable workspace templates, call preview_invoice_template_extraction for this immutable invoice version, review its included/excluded paths and proposed defaults with the user, then save only after explicit confirmation with save_invoice_as_template. Pass the preview’s projection.checksum as the required projectionChecksum. Line-item presets default off and require explicit opt-in. The projection excludes recipient identity, payment data, generated values, free-form content, and rendered HTML/CSS. If save_invoice_as_template returns TEMPLATE_PROJECTION_STALE, preview again and repeat the review; do not reuse the stale checksum.',
      outputSchema: getInvoiceOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
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
                : result.invoice.status === 'archived'
                  ? `Invoice ${result.invoice.invoiceNumber} (${result.invoice.currency} ${result.invoice.total ?? 0}) is archived and has no active hosted link. Its former hosted URL remains revoked. Use unarchive_invoice to restore it only if the user requested restoration; after restoration, use renew_invoice_link only if the user's intent requests a new hosted link.`
                  : `Invoice ${result.invoice.invoiceNumber} (${result.invoice.currency} ${result.invoice.total ?? 0}) has no active hosted link. Use renew_invoice_link to issue a replacement only if the user's intent requests a new hosted link.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
