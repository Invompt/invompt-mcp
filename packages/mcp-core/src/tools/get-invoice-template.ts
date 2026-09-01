import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'
import { invoiceTemplateDetailSchema, templateIdSchema, templateVersionSchema } from './template-schemas.js'

export function registerGetInvoiceTemplateTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'get_invoice_template',
    {
      title: 'Get Invoice Template',
      description:
        'Retrieve one workspace-owned invoice template and its selected immutable, validated semantic preset. Rendered HTML/CSS is intentionally empty in v1.',
      inputSchema: z.strictObject({
        templateId: templateIdSchema,
        version: templateVersionSchema.optional().describe('Optional immutable version; defaults to current.'),
      }),
      outputSchema: z.strictObject({ template: invoiceTemplateDetailSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ templateId, version }) => {
      try {
        const result = await client.getInvoiceTemplate(templateId, version)
        return {
          structuredContent: result,
          content: [{ type: 'text' as const, text: `Loaded invoice template ${result.template.name}.` }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
