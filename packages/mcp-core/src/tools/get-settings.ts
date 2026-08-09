import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const getSettingsOutputSchema = {
  settings: z.object({
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
  }),
}

export function registerGetSettingsTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'get_settings',
    {
      title: 'Get Settings',
      description:
        'Get saved invoice defaults for the connected workspace: optional company name, currency, invoice prefix, numbering format, default due date, sender info, and payment terms.',
      outputSchema: getSettingsOutputSchema,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const result = await client.getSettings()

        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Settings for ${result.settings.companyName ?? 'your company'}: ${result.settings.currency ?? 'no currency set'}, prefix "${result.settings.invoicePrefix}".`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
