import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const paymentInfoSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(10_000).optional(),
  paymentTerms: z.string().max(500).optional(),
})

const settingsSchema = z.object({
  companyName: z.string().nullable(),
  currency: z.string().nullable(),
  invoicePrefix: z.string(),
  invoiceNumberFormat: z.string(),
  defaultDueDate: z.string(),
  senderInfo: z.string(),
  paymentInfo: z.object({
    title: z.string(),
    content: z.string(),
    paymentTerms: z.string(),
  }),
})

export function registerUpdateSettingsTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'update_settings',
    {
      title: 'Update Settings',
      description:
        'Partially update saved invoice defaults for the connected account or guest company. Omitted fields remain unchanged; company name and currency may be explicitly cleared with null. Returns the complete canonical settings after the update.',
      inputSchema: {
        companyName: z.string().trim().min(1).max(200).nullable().optional(),
        currency: z.string().trim().min(1).max(3).nullable().optional(),
        invoicePrefix: z.string().trim().min(1).max(24).optional(),
        invoiceNumberFormat: z.string().trim().min(1).max(100).optional(),
        defaultDueDate: z.string().trim().min(1).max(100).optional(),
        senderInfo: z.string().max(10_000).optional(),
        paymentInfo: paymentInfoSchema.optional(),
        idempotencyKey: idempotencyKeySchema,
      },
      outputSchema: {
        settings: settingsSchema,
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const result = await client.updateSettings(input)
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: result.replayed ? 'Invoice settings replayed safely.' : 'Invoice settings updated.',
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
