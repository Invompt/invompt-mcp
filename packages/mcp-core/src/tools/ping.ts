import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const pingOutputSchema = {
  status: z.literal('ok'),
  timestamp: z.string(),
  provisioned: z.boolean(),
  guestName: z.string().min(1).optional(),
  guestReference: z
    .string()
    .regex(/^guest_[A-Za-z0-9_-]{22}$/)
    .optional(),
  account: z
    .object({
      plan: z.string(),
    })
    .optional(),
}

export function registerPingTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Check API connectivity and the connected account or guest-company status.',
      outputSchema: pingOutputSchema,
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
        const result = await client.ping()

        const parts: string[] = [
          `Status: ${result.status}`,
          `Workspace: ${result.provisioned ? 'provisioned' : 'not provisioned'}`,
        ]
        if (result.guestName && result.guestReference) {
          parts.push(`Guest: ${result.guestName}${result.guestReference ? ` (${result.guestReference})` : ''}`)
        }
        if (result.account) {
          parts.push(`Plan: ${result.account.plan}`)
        }
        if (client.isGuest()) {
          parts.push('Connection: guest')
        }

        return {
          structuredContent: result,
          content: [{ type: 'text' as const, text: parts.join(' | ') }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
