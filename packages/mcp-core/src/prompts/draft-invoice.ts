import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { INVOML_SPEC_URI } from '../resources/invoml-spec.js'

export function registerDraftInvoicePrompt(server: McpServer, service: InvomptService): void {
  server.registerPrompt(
    'draft_invoice_invoml',
    {
      title: 'Draft Invoice InvoML',
      description:
        'Draft strict Invompt InvoML JSON from a natural-language request for an invoice, quote, estimate, or pro forma in any language.',
      argsSchema: {
        request: z
          .string()
          .min(1, 'request must be a non-empty string')
          .describe('Natural-language invoice requirements.'),
      },
    },
    async ({ request }) => {
      const spec = await service.getInvomlSpec()

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'resource' as const,
              resource: {
                uri: INVOML_SPEC_URI,
                mimeType: 'text/plain',
                text: spec,
              },
            },
          },
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'Convert the request below into a valid Invompt InvoML JSON document.',
                `Follow the attached spec from ${INVOML_SPEC_URI}.`,
                "Preserve the user's language in descriptions, notes, and other user-facing content.",
                'When the spec supports a locale field, use the normalized locale implied by the request.',
                'Do not invent seller or client identities, tax identifiers, payment details, rates, quantities, currency, addresses, or legal facts.',
                'When a customer or recipient is explicitly provided, for freeform data map it to to.content; structured data uses the direct party form defined by the spec. Never invent a generic client property.',
                'Saved-client resolution happens before creation: search by name/email, auto-select only an exact unique match, ask which when ambiguous, and ask save-and-assign versus one-off when none. Never silently save a client.',
                'Omit unknown optional fields. Keep billable work in standard line items and let Invompt calculate totals.',
                'If saved paymentInfo is provided, map it to the standard payment block only when the attached spec supports it. Never place a payment object inside notes; notes is plain text.',
                'Use the document type that matches the request: invoice, quote, estimate, or pro forma as defined by the attached spec.',
                'Output only raw JSON with no code fences, prose, or commentary.',
                '',
                request,
              ].join('\n'),
            },
          },
        ],
      }
    },
  )
}
