import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { ISSUER_IDENTITY_INSTRUCTION } from '../contracts.js'
import { InvomptApiError } from '../error.js'
import { INVOML_SPEC_URI } from '../resources/invoml-spec.js'
import { TEMPLATE_IDS } from '../types.js'
import { canonicalInvomlSchema, idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const createInvoiceInputSchema = {
  invoml: canonicalInvomlSchema,
  templateId: z.enum(TEMPLATE_IDS).optional().describe('Optional template override.'),
  clientId: z
    .uuid()
    .optional()
    .describe('Company-owned saved client to assign and snapshot. Search with list_clients first.'),
  idempotencyKey: idempotencyKeySchema,
}

const createInvoiceOutputSchema = {
  invoiceId: z.string(),
  invoiceNumber: z.string().min(1),
  status: z.string().min(1),
  total: z.number().nullable(),
  currency: z.string().min(3),
  dueDate: z.string().nullable(),
  url: z.url(),
  version: z.number().int().min(1),
  replayed: z.boolean(),
  guestName: z.string().min(1).optional(),
  guestReference: z
    .string()
    .regex(/^guest_[A-Za-z0-9_-]{22}$/)
    .optional(),
  clientId: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
}

function parseInvomlJsonObject(invoml: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(invoml)
  } catch {
    throw new InvomptApiError('Invalid InvoML: expected a valid JSON object.', 'INVALID_INVOML', 400)
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new InvomptApiError('Invalid InvoML: expected a JSON object.', 'INVALID_INVOML', 400)
  }
  return parsed as Record<string, unknown>
}

function authoredInvoiceNumber(document: Record<string, unknown>): string | null {
  const meta = document.meta
  if (meta === null || Array.isArray(meta) || typeof meta !== 'object') return null
  const number = (meta as Record<string, unknown>).number
  return typeof number === 'string' ? number : null
}

export function registerCreateInvoiceTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'create_invoice',
    {
      title: 'Create Invoice',
      description: `Create and host an Invompt invoice, quote, estimate, or pro forma from an InvoML JSON document. For a named recipient, search list_clients first: auto-select only one exact unique match, ask which client for multiple matches, or ask once whether to save+assign or use one-off data when none. Never silently save a client. Recipient and issuer identity are optional. ${ISSUER_IDENTITY_INSTRUCTION} A clientId assigns the saved client and builds the recipient snapshot without private notes. Read ${INVOML_SPEC_URI} first.`,
      inputSchema: createInvoiceInputSchema,
      outputSchema: createInvoiceOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ invoml, templateId, clientId, idempotencyKey }) => {
      try {
        const document = parseInvomlJsonObject(invoml)
        const requestedNumber = authoredInvoiceNumber(document)
        const result = await client.createInvoice({ invoml, templateId, clientId, idempotencyKey })
        if (requestedNumber !== null && result.invoiceNumber !== requestedNumber) {
          throw new InvomptApiError(
            `Created invoice ${result.invoiceId} as ${result.invoiceNumber}, but InvoML requested ${requestedNumber}. The invoice is not ready; inspect it before any follow-up action.`,
            'CANONICAL_INVOICE_NUMBER_MISMATCH',
            409,
          )
        }
        const readBack = (await client.getInvoice(result.invoiceId)).invoice
        if (
          readBack.invoiceNumber !== result.invoiceNumber ||
          readBack.status !== result.status ||
          readBack.total !== result.total ||
          readBack.currency !== result.currency ||
          readBack.dueDate !== result.dueDate ||
          readBack.version !== result.version
        ) {
          throw new InvomptApiError(
            `Created invoice ${result.invoiceId}, but canonical read-back did not match the creation response. The invoice is not ready; inspect it before any follow-up action.`,
            'CANONICAL_INVOICE_READBACK_MISMATCH',
            409,
          )
        }
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Created ${
                result.guestName && result.guestReference
                  ? `${result.guestName}${result.guestReference ? ` (${result.guestReference})` : ''}'s `
                  : ''
              }invoice ${result.invoiceNumber} (${result.invoiceId}), ${result.currency} ${result.total}: ${result.url}`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
