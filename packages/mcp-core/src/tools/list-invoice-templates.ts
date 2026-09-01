import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'
import { invoiceTemplateDocumentTypeSchema, invoiceTemplateSummarySchema } from './template-schemas.js'

export function registerListInvoiceTemplatesTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'list_invoice_templates',
    {
      title: 'List Invoice Templates',
      description:
        'List active reusable invoice templates available in the connected workspace. Returns only safe metadata; use get_invoice_template for the validated semantic preset.',
      inputSchema: z.strictObject({
        documentType: invoiceTemplateDocumentTypeSchema.optional().describe('Filter by document type.'),
        status: z.literal('active').optional().describe('Active templates are the only v1 list view.'),
      }),
      outputSchema: z.strictObject({ templates: z.array(invoiceTemplateSummarySchema) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentType, status }) => {
      try {
        const result = await client.listInvoiceTemplates({ documentType, status })
        return {
          structuredContent: result,
          content: [{ type: 'text' as const, text: `Found ${result.templates.length} active invoice template(s).` }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
