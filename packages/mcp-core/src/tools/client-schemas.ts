import { z } from 'zod'

export const CANONICAL_INVOML_MAX_BYTES = 128 * 1024

export const canonicalInvomlSchema = z
  .string()
  .min(1, 'invoml must be a non-empty InvoML JSON string')
  .refine((value) => new TextEncoder().encode(value).byteLength <= CANONICAL_INVOML_MAX_BYTES, {
    message: 'invoml exceeds 128 KiB UTF-8 limit',
  })
  .describe('InvoML (Invoice Markup Language) JSON document describing the invoice.')

const structuredInvoMlString = (description: string, max = 2000) =>
  z.string().trim().min(1).max(max).describe(description)

export const structuredAddressSchema = z
  .strictObject({
    lines: z
      .array(structuredInvoMlString('One address line.', 500))
      .min(1)
      .max(20)
      .describe('Address lines in display order.'),
  })
  .describe('Structured address. Use { lines: [...] }, never a single address string.')

const structuredPartyFieldsSchema = z
  .strictObject({
    name: structuredInvoMlString('Legal or display name of the party.', 200),
    email: z.string().trim().pipe(z.email().max(320)).optional(),
    address: structuredAddressSchema.optional(),
    attention: structuredInvoMlString('Optional attention/contact line.', 200).optional(),
    taxId: structuredInvoMlString('Optional tax identifier.', 100).optional(),
    businessNumber: structuredInvoMlString('Optional business registration number.', 100).optional(),
    phone: structuredInvoMlString('Optional phone number.', 100).optional(),
    website: z.string().trim().pipe(z.httpUrl().max(500)).optional(),
    countryCode: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).optional(),
  })
  .describe('Structured party fields. Use address.lines for an address.')

const freeformPartySchema = z
  .strictObject({
    content: structuredInvoMlString(
      'Freeform party content. Use this string form instead of structured party content.',
      5000,
    ),
  })
  .describe('Freeform party: content is a string. Do not add structured fields.')

const structuredPartySchema = z
  .strictObject({
    ...structuredPartyFieldsSchema.shape,
  })
  .describe('Structured party object. Do not wrap it in content or mix it with the freeform string form.')

export const structuredPartyInputSchema = z
  .union([freeformPartySchema, structuredPartySchema])
  .describe('Party is oneOf: { content: string } or { name, address: { lines: [...] } }.')

const structuredInvoiceMetaSchema = z
  .strictObject({
    documentType: z
      .enum(['invoice', 'quote', 'estimate', 'receipt', 'credit_note'])
      .describe('Supported document type. A pro forma is represented as quote.'),
    number: structuredInvoMlString('Exact authored invoice/document number.', 200),
    issueDate: z.iso.date().describe('Issue date in YYYY-MM-DD format.'),
    dueDate: z.iso.date().optional().describe('Optional payment due date in YYYY-MM-DD format.'),
    expiryDate: z.iso.date().optional().describe('Optional quote/estimate expiry date in YYYY-MM-DD format.'),
    reference: structuredInvoMlString('Optional customer or purchase reference.', 200).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).describe('Three-letter ISO currency code.'),
    locale: z.string().trim().min(2).max(35).optional().describe('Optional BCP 47 locale, such as en-US.'),
  })
  .describe('Required document metadata.')

const structuredInvoiceItemSchema = z
  .strictObject({
    description: structuredInvoMlString('Billable item description.', 2000),
    quantity: z.number().finite().positive().describe('Positive item quantity.'),
    unitPrice: z.number().finite().nonnegative().describe('Non-negative price per unit. Do not use item.taxRate.'),
  })
  .describe('Minimal billable line item. Totals are calculated by Invompt.')

/**
 * Deliberately small, strict structured input for hosts that cannot reliably produce a serialized
 * JSON string. Full InvoML remains available through the legacy `invoml` string path.
 */
export const structuredInvomlSchema = z
  .strictObject({
    $invoml: z.literal('1.0').describe('InvoML version.'),
    meta: structuredInvoiceMetaSchema,
    from: structuredPartyInputSchema.optional().describe('Optional issuer party.'),
    to: structuredPartyInputSchema.optional().describe('Optional recipient party.'),
    items: z.array(structuredInvoiceItemSchema).min(1).describe('At least one billable item.'),
    notes: z.string().max(10000).optional().describe('Optional plain-text notes.'),
    prepaidAmount: z.number().finite().nonnegative().optional().describe('Optional amount already paid.'),
  })
  .describe('Strict minimal structured InvoML document. Unknown fields are rejected.')

export const clientIdSchema = z.uuid().describe('Company-owned saved client ID')
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .describe('Stable retry key. Reuse it only when retrying the same mutation.')
export const expectedVersionSchema = z.number().int().min(1).describe('Version returned by the last resource read')

export const billingPartyInputSchema = {
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email().max(320)).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  attention: z.string().trim().max(200).nullable().optional(),
  taxId: z.string().trim().max(100).nullable().optional(),
  businessNumber: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(100).nullable().optional(),
  website: z.string().trim().pipe(z.httpUrl().max(500)).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
}

export const billingPartyOutputSchema = {
  name: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  attention: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  businessNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
}

export const clientSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  version: z.number().int(),
})

export const savedClientSchema = z.object({
  id: z.string(),
  ...billingPartyOutputSchema,
  version: z.number().int(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const resolutionSchema = z.object({
  kind: z.enum(['exact_unique', 'ambiguous', 'none']),
  query: z.string().optional(),
  selectedClientId: z.string().optional(),
  candidates: z.array(clientSummarySchema),
})
