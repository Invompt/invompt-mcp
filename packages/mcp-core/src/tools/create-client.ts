import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { InvomptService } from '../service.js'
import {
  billingPartyInputSchema,
  clientSummarySchema,
  idempotencyKeySchema,
  savedClientSchema,
} from './client-schemas.js'
import { formatToolError } from './format-error.js'

export function registerCreateClientTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'create_client',
    {
      title: 'Create Saved Client',
      description:
        'Explicitly save a reusable client after the user chose save and assign. Never call silently from create_invoice. Duplicate candidates require user confirmation before retrying with allowDuplicate=true.',
      inputSchema: {
        ...billingPartyInputSchema,
        idempotencyKey: idempotencyKeySchema,
        allowDuplicate: z.boolean().optional().describe('Set true only after explicit duplicate confirmation'),
      },
      outputSchema: {
        client: savedClientSchema.optional(),
        created: z.boolean(),
        replayed: z.boolean().optional(),
        duplicateCandidates: z.array(clientSummarySchema),
        requiresDuplicateConfirmation: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        const result = await client.createClient(input)
        const text = result.requiresDuplicateConfirmation
          ? `Possible duplicate saved client(s): ${result.duplicateCandidates.map(({ id, name }) => `${name} (${id})`).join(', ')}. Ask before creating another.`
          : `Saved client ${result.client?.name ?? ''} (${result.client?.id ?? ''}).`
        return { structuredContent: result, content: [{ type: 'text' as const, text }] }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
