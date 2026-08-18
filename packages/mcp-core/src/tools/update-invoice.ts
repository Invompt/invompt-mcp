import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { TEMPLATE_IDS } from '../types.js'
import { canonicalInvomlSchema, expectedVersionSchema, idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'
import { previewUrlSchema } from './preview-url-schema.js'

const updateInvoiceOutputShape = {
  invoiceId: z.string(),
  invoiceNumber: z.string().min(1),
  status: z.string().min(1),
  total: z.number().nullable(),
  currency: z.string().min(3),
  dueDate: z.string().nullable(),
  version: z.number().int().min(1),
  replayed: z.boolean(),
  clientId: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
}

const updateInvoiceOutputSchema = z
  .object({
    ...updateInvoiceOutputShape,
    url: previewUrlSchema.nullable(),
    linkState: z.enum(['active', 'unavailable']),
  })
  .superRefine((result, context) => {
    if (result.linkState === 'active' && result.url === null) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'An active invoice link requires a capability-backed preview URL.',
      })
    }

    if (result.linkState === 'unavailable' && result.url !== null) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'An unavailable invoice link must not return a preview URL.',
      })
    }
  })

export function registerUpdateInvoiceTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'update_invoice',
    {
      title: 'Update Invoice',
      description:
        'Update, revise, correct, translate, restyle, or explicitly resync a saved client onto an existing invoice owned by the connected workspace. clientId omitted retains the link without resync; null detaches the link but keeps the current recipient snapshot; a UUID assigns that workspace-owned client and rebuilds this invoice snapshot. Client edits never rewrite historical invoices automatically.',
      outputSchema: updateInvoiceOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
        invoml: canonicalInvomlSchema.optional().describe('New InvoML JSON content.'),
        templateId: z.enum(TEMPLATE_IDS).optional().describe('New template'),
        clientId: z
          .uuid()
          .nullable()
          .optional()
          .describe('Omit to retain without resync; null to detach while keeping snapshot; UUID to assign/resync.'),
        numberCorrection: z
          .object({
            from: z.string().min(1).max(120),
            reason: z.string().trim().min(8).max(500),
          })
          .strict()
          .optional()
          .describe(
            'Controlled correction for a wrong persisted invoice number. from must equal the current canonical number. Omit for ordinary immutable-number updates.',
          ),
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
    async ({ id, invoml, templateId, clientId, numberCorrection, expectedVersion, idempotencyKey }) => {
      try {
        const result = await client.updateInvoice(id, {
          invoml,
          templateId,
          clientId,
          numberCorrection,
          expectedVersion,
          idempotencyKey,
        })

        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text:
                result.linkState === 'active'
                  ? `Updated invoice ${result.invoiceNumber} (${result.invoiceId}); status ${result.status}: ${result.url}`
                  : `Updated invoice ${result.invoiceNumber} (${result.invoiceId}); status ${result.status}; no active hosted link. Use renew_invoice_link to issue a replacement.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
