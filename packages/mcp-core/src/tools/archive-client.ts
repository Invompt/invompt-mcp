import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { InvomptService } from '../service.js'
import { clientIdSchema, expectedVersionSchema, idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

export function registerArchiveClientTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'archive_client',
    {
      title: 'Archive Saved Client',
      description:
        'Archive a clearly identified saved client only after explicit confirmation. This is a soft delete; historical invoice snapshots and links remain stable.',
      inputSchema: {
        id: clientIdSchema,
        expectedVersion: expectedVersionSchema,
        idempotencyKey: idempotencyKeySchema,
        confirmed: z.literal(true).describe('Must be true after the user explicitly confirms archiving'),
      },
      outputSchema: {
        clientId: z.string(),
        status: z.literal('archived'),
        version: z.number().int(),
        archivedAt: z.string(),
        replayed: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, ...input }) => {
      try {
        const result = await client.archiveClient(id, input)
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Archived saved client ${result.clientId}; historical invoice snapshots remain unchanged.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
