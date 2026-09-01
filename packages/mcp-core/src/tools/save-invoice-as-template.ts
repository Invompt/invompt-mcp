import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'
import { invoiceTemplateDetailSchema } from './template-schemas.js'

export function registerSaveInvoiceAsTemplateTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'save_invoice_as_template',
    {
      title: 'Save Invoice as Template',
      description:
        'Save a confirmed safe semantic projection of an immutable invoice revision as a reusable workspace template. The server recomputes projectionChecksum; host-supplied HTML, CSS, assets, and arbitrary defaults are not accepted.',
      inputSchema: z.strictObject({
        invoiceId: z.uuid().describe('Invoice ID.'),
        version: z.number().int().min(1).describe('Immutable invoice revision version.'),
        projectionChecksum: z.string().regex(/^[0-9a-f]{64}$/).describe('Checksum returned by preview_invoice_template_extraction.'),
        name: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'name must not contain control characters')
          .describe('New workspace template name.'),
        includeLineItems: z.boolean().default(false).describe('Persist sanitized line-item presets; defaults to false.'),
        idempotencyKey: idempotencyKeySchema,
      }),
      outputSchema: z.strictObject({ template: invoiceTemplateDetailSchema, replayed: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ invoiceId, version, projectionChecksum, name, includeLineItems, idempotencyKey }) => {
      try {
        const result = await client.saveInvoiceAsTemplate({
          invoiceId,
          version,
          projectionChecksum,
          name,
          includeLineItems: includeLineItems ?? false,
          idempotencyKey,
        })
        return {
          structuredContent: result,
          content: [{ type: 'text' as const, text: `${result.replayed ? 'Replayed' : 'Saved'} invoice template ${result.template.name}.` }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
