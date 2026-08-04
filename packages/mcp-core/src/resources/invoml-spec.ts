import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { InvomptService } from '../service.js'

export const INVOML_SPEC_URI = 'invompt://spec/invoml/v1'

export function registerInvomlSpecResource(server: McpServer, service: InvomptService): void {
  server.registerResource(
    'invoml-spec',
    INVOML_SPEC_URI,
    {
      title: 'Invompt InvoML v1 Spec',
      description: 'Public InvoML spec served by Invompt for invoice generation clients. JSON-based format.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const spec = await service.getInvomlSpec()

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: spec,
          },
        ],
      }
    },
  )
}
