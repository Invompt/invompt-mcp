import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { InvomptService } from '../service.js'
import {
  billingPartyInputSchema,
  clientIdSchema,
  expectedVersionSchema,
  idempotencyKeySchema,
  savedClientSchema,
} from './client-schemas.js'
import { formatToolError } from './format-error.js'

const partialBillingParty = Object.fromEntries(
  Object.entries(billingPartyInputSchema).map(([key, schema]) => [key, (schema as z.ZodType).optional()]),
) as unknown as Record<string, z.ZodType>

export function registerUpdateClientTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'update_client',
    {
      title: 'Update Saved Client',
      description:
        'Partially update a saved client with optimistic version protection and retry safety. Existing invoice recipient snapshots never change automatically.',
      inputSchema: {
        id: clientIdSchema,
        ...partialBillingParty,
        expectedVersion: expectedVersionSchema,
        idempotencyKey: idempotencyKeySchema,
      },
      outputSchema: { client: savedClientSchema, replayed: z.boolean().optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...input }) => {
      try {
        const result = await client.updateClient(id, input)
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Updated saved client ${result.client.id} to version ${result.client.version}. Historical invoices were not changed.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
