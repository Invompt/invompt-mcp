import { z } from 'zod'

export const CANONICAL_INVOML_MAX_BYTES = 128 * 1024

export const canonicalInvomlSchema = z
  .string()
  .min(1, 'invoml must be a non-empty InvoML JSON string')
  .refine((value) => new TextEncoder().encode(value).byteLength <= CANONICAL_INVOML_MAX_BYTES, {
    message: 'invoml exceeds 128 KiB UTF-8 limit',
  })
  .describe('InvoML (Invoice Markup Language) JSON document describing the invoice.')

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
