import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'
import { invoiceTemplateProjectionSchema } from './template-schemas.js'

export function registerPreviewInvoiceTemplateExtractionTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'preview_invoice_template_extraction',
    {
      title: 'Preview Invoice Template Extraction',
      description:
        'Preview a safe semantic template projection from an immutable invoice revision. Recipient identity, payment data, generated values, free-form content, and rendered HTML/CSS are excluded; line items require explicit opt-in.',
      inputSchema: z.strictObject({
        invoiceId: z.uuid().describe('Invoice ID.'),
        version: z.number().int().min(1).describe('Immutable invoice revision version.'),
        includeLineItems: z
          .boolean()
          .default(false)
          .describe('Explicitly include sanitized line-item presets; defaults to false.'),
      }),
      outputSchema: z.strictObject({ projection: invoiceTemplateProjectionSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ invoiceId, version, includeLineItems }) => {
      try {
        const result = await client.previewInvoiceTemplateExtraction({
          invoiceId,
          version,
          includeLineItems: includeLineItems ?? false,
        })
        return {
          structuredContent: result,
          content: [{ type: 'text' as const, text: `Previewed template extraction for invoice revision ${version}.` }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
