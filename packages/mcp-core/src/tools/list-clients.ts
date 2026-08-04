import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { InvomptService } from '../service.js'
import { clientSummarySchema, resolutionSchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

export function registerListClientsTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'list_clients',
    {
      title: 'List or Search Saved Clients',
      description:
        'Search saved clients by name or email before creating an invoice for a named recipient. Auto-select only resolution.kind=exact_unique. Ask the user to choose when ambiguous; when none, ask once whether to save and assign or use one-off recipient data.',
      inputSchema: {
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        search: z.string().trim().max(320).optional().describe('Name or email to resolve'),
      },
      outputSchema: {
        clients: z.array(clientSummarySchema),
        total: z.number().int(),
        page: z.number().int(),
        limit: z.number().int(),
        hasMore: z.boolean(),
        resolution: resolutionSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        const result = await client.listClients(input)
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Found ${result.total} saved client(s); resolution: ${result.resolution.kind}.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
