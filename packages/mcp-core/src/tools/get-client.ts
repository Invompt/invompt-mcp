import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { InvomptService } from '../service.js'
import { clientIdSchema, savedClientSchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

export function registerGetClientTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'get_client',
    {
      title: 'Get Saved Client',
      description:
        'Get the canonical structured billing-party fields for one company-owned saved client. Private notes and Web-specific rich HTML are never exposed.',
      inputSchema: { id: clientIdSchema },
      outputSchema: { client: savedClientSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        const result = await client.getClient(id)
        return {
          structuredContent: result,
          content: [
            { type: 'text' as const, text: `Loaded saved client ${result.client.name} (${result.client.id}).` },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
