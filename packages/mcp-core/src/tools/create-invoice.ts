import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { ISSUER_IDENTITY_INSTRUCTION, STRUCTURED_INVOML_GUIDANCE } from '../contracts.js'
import { InvomptApiError } from '../error.js'
import { INVOML_SPEC_URI } from '../resources/invoml-spec.js'
import { TEMPLATE_IDS } from '../types.js'
import {
  canonicalInvomlSchema,
  idempotencyKeySchema,
  structuredInvomlSchema,
} from './client-schemas.js'
import { formatToolError } from './format-error.js'

const sharedCreateInvoiceInputShape = {
  templateId: z.enum(TEMPLATE_IDS).optional().describe('Optional template override.'),
  clientId: z
    .uuid()
    .optional()
    .describe('Company-owned saved client to assign and snapshot. Search with list_clients first.'),
  idempotencyKey: idempotencyKeySchema,
}

const createInvoiceInputSchema = z
  .union([
    z.strictObject({
      invoml: canonicalInvomlSchema,
      ...sharedCreateInvoiceInputShape,
    }),
    z.strictObject({
      document: structuredInvomlSchema,
      ...sharedCreateInvoiceInputShape,
    }),
  ])
  .describe(
    'Provide exactly one input form: document as a structured InvoML object, or invoml as legacy serialized JSON.',
  )

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

function structuredIssuePath(path: (string | number)[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    return result ? `${result}.${String(segment)}` : String(segment)
  }, '')
}

function normalizeStructuredDocument(document: unknown): string {
  const parsed = structuredInvomlSchema.safeParse(document)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${structuredIssuePath(issue.path as (string | number)[])}: ${issue.message}`)
      .join('; ')
    throw new InvomptApiError(`Invalid structured InvoML: ${details}`, 'INVALID_INVOML', 400)
  }

  const value = parsed.data
  const normalized: Record<string, unknown> = {
    $invoml: value.$invoml,
    meta: {
      documentType: value.meta.documentType,
      number: value.meta.number,
      issueDate: value.meta.issueDate,
      ...(value.meta.dueDate === undefined ? {} : { dueDate: value.meta.dueDate }),
      ...(value.meta.expiryDate === undefined ? {} : { expiryDate: value.meta.expiryDate }),
      ...(value.meta.reference === undefined ? {} : { reference: value.meta.reference }),
      currency: value.meta.currency.toUpperCase(),
      ...(value.meta.locale === undefined ? {} : { locale: value.meta.locale }),
    },
    ...(value.from === undefined ? {} : { from: normalizeParty(value.from) }),
    ...(value.to === undefined ? {} : { to: normalizeParty(value.to) }),
    items: value.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    ...(value.notes === undefined ? {} : { notes: value.notes }),
    ...(value.prepaidAmount === undefined ? {} : { prepaidAmount: value.prepaidAmount }),
  }

  return JSON.stringify(normalized)
}

function normalizeParty(party: {
  content: string
} | {
  name: string
  email?: string
  address?: { lines: string[] }
  attention?: string
  taxId?: string
  businessNumber?: string
  phone?: string
  website?: string
  countryCode?: string
}): Record<string, unknown> {
  if ('content' in party) return { content: party.content }

  return {
    name: party.name,
    ...(party.email === undefined ? {} : { email: party.email }),
    ...(party.address === undefined ? {} : { address: { lines: [...party.address.lines] } }),
    ...(party.attention === undefined ? {} : { attention: party.attention }),
    ...(party.taxId === undefined ? {} : { taxId: party.taxId }),
    ...(party.businessNumber === undefined ? {} : { businessNumber: party.businessNumber }),
    ...(party.phone === undefined ? {} : { phone: party.phone }),
    ...(party.website === undefined ? {} : { website: party.website }),
    ...(party.countryCode === undefined ? {} : { countryCode: party.countryCode.toUpperCase() }),
  }
}

function resolveCreateInvoiceContent(input: {
  invoml?: unknown
  document?: unknown
}): string {
  const hasLegacy = input.invoml !== undefined
  const hasStructured = input.document !== undefined
  if (hasLegacy === hasStructured) {
    throw new InvomptApiError(
      'Provide exactly one of document (structured InvoML object) or invoml (legacy JSON string); do not provide both or neither.',
      'INVALID_INVOML_INPUT',
      400,
    )
  }
  if (hasStructured) return normalizeStructuredDocument(input.document)
  if (typeof input.invoml !== 'string') {
    throw new InvomptApiError('invoml must be a serialized InvoML JSON string.', 'INVALID_INVOML_INPUT', 400)
  }
  parseInvomlJsonObject(input.invoml)
  return input.invoml
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
      description: `${STRUCTURED_INVOML_GUIDANCE} Create and host an Invompt invoice, quote, estimate, or pro forma. For a named recipient, search list_clients first: auto-select only one exact unique match, ask which client for multiple matches, or ask once whether to save+assign or use one-off data when none. Never silently save a client. Recipient and issuer identity are optional. ${ISSUER_IDENTITY_INSTRUCTION} A clientId assigns the saved client and builds the recipient snapshot without private notes. Read ${INVOML_SPEC_URI} first.`,
      inputSchema: createInvoiceInputSchema,
      outputSchema: createInvoiceOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const { templateId, clientId, idempotencyKey } = input
      const invoml = 'invoml' in input ? input.invoml : undefined
      const document = 'document' in input ? input.document : undefined
      try {
        const serializedInvoml = resolveCreateInvoiceContent({ invoml, document })
        const authoredDocument = parseInvomlJsonObject(serializedInvoml)
        const requestedNumber = authoredInvoiceNumber(authoredDocument)
        const result = await client.createInvoice({
          invoml: serializedInvoml,
          templateId,
          clientId,
          idempotencyKey,
        })
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
