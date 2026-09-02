import { z } from 'zod'

import type { InvoiceTemplateDocumentType } from '../types.js'

export const invoiceTemplateDocumentTypes = ['invoice', 'quote', 'estimate', 'receipt', 'credit_note'] as const
export const invoiceTemplateDocumentTypeSchema = z.enum(invoiceTemplateDocumentTypes)

export const templateIdSchema = z.uuid().describe('Company-owned template ID')
export const templateVersionSchema = z.number().int().min(1).describe('Immutable template version')

const safeDiscountSchema = z.union([
  z.string().min(1),
  z.strictObject({
    type: z.enum(['percentage', 'fixed']),
    value: z.number().finite(),
    label: z.string().optional(),
  }),
])

const safeTaxSchema = z.union([
  z.strictObject({
    label: z.string().min(1),
    rate: z.number().finite(),
    inclusive: z.boolean().optional(),
  }),
  z.strictObject({
    system: z.string().optional(),
    compound: z.boolean().optional(),
    inclusive: z.boolean().optional(),
    categories: z.array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        rate: z.number().finite(),
        default: z.boolean().optional(),
        exempt: z.boolean().optional(),
        reverseCharge: z.boolean().optional(),
        withholding: z.boolean().optional(),
        inclusive: z.boolean().optional(),
      }),
    ).min(1),
  }),
])

const safeDefaultDataSchema = z.strictObject({
  meta: z
    .strictObject({
      currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
      locale: z.string().optional(),
      tax: safeTaxSchema.optional(),
    })
    .optional(),
  style: z
    .strictObject({
      template: z.enum(['standard', 'minimal', 'professional']).optional(),
      dateFormat: z.enum(['iso', 'numeric', 'medium', 'long']).optional(),
    })
    .optional(),
  items: z
    .array(
      z.strictObject({
        description: z.string().min(1),
        quantity: z.number().finite().positive(),
        unit: z.string().optional(),
        unitPrice: z.number().finite().nonnegative(),
        discount: safeDiscountSchema.optional(),
        taxCategory: z.string().optional(),
      }),
    )
    .optional(),
})

export const emptyAssetManifestSchema = z.array(z.string()).max(0).describe('v1 does not accept arbitrary assets')

const templateSummaryShape = {
  id: z.string(),
  companyId: z.string(),
  documentType: invoiceTemplateDocumentTypeSchema,
  name: z.string().trim().min(1).max(120),
  scope: z.literal('company'),
  status: z.enum(['active', 'archived']),
  currentVersion: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
}

export const invoiceTemplateSummarySchema = z.strictObject(templateSummaryShape)

export const invoiceTemplateVersionSchema = z.strictObject({
  version: templateVersionSchema,
  schemaVersion: z.string().min(1).max(32),
  html: z.literal('').describe('Rendered HTML is never reused in v1 template extraction.'),
  css: z.literal('').describe('Rendered CSS is never reused in v1 template extraction.'),
  defaultData: safeDefaultDataSchema,
  lineItemPresetMode: z.enum(['none', 'explicit']),
  assetManifest: emptyAssetManifestSchema,
  compilerVersion: z.string().min(1).max(32),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  canonicalBytes: z.number().int().min(1).max(524288),
  createdAt: z.string(),
})

export const invoiceTemplateDetailSchema = z.strictObject({
  ...templateSummaryShape,
  version: invoiceTemplateVersionSchema.nullable(),
})

export const invoiceTemplateProjectionSchema = z.strictObject({
  invoiceId: z.string(),
  invoiceVersion: z.number().int().min(1),
  documentType: invoiceTemplateDocumentTypeSchema,
  html: z.literal(''),
  css: z.literal(''),
  defaultData: safeDefaultDataSchema,
  lineItemPresetMode: z.enum(['none', 'explicit']),
  assetManifest: emptyAssetManifestSchema,
  includedPaths: z.array(z.string().min(1).max(100)),
  excludedPaths: z.array(
    z.strictObject({
      path: z.string().min(1).max(100),
      reason: z.enum([
        'generated_identity_or_date',
        'free_form_content_requires_explicit_allowlist',
        'recipient_identity',
        'sensitive_or_generated',
        'line_items_require_explicit_opt_in',
        'source_rendered_markup_never_reused',
      ]),
    }),
  ),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  canonicalBytes: z.number().int().min(1).max(524288),
  compilerVersion: z.string().min(1).max(32),
})

export type SafeTemplateDefaultData = z.infer<typeof safeDefaultDataSchema>
export type TemplateDocumentType = InvoiceTemplateDocumentType
