import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { InvomptApiError } from '../src/error.js'
import { registerGetInvoiceTemplateTool } from '../src/tools/get-invoice-template.js'
import { registerListInvoiceTemplatesTool } from '../src/tools/list-invoice-templates.js'
import { registerPreviewInvoiceTemplateExtractionTool } from '../src/tools/preview-invoice-template-extraction.js'
import { registerSaveInvoiceAsTemplateTool } from '../src/tools/save-invoice-as-template.js'
import { templateIdSchema } from '../src/tools/template-schemas.js'
import type { InvomptService } from '../src/service.js'

type Handler = (input: Record<string, unknown>) => Promise<unknown>

function serverMock(): { server: McpServer; handlers: Record<string, Handler>; configs: Record<string, Record<string, unknown>> } {
  const handlers: Record<string, Handler> = {}
  const configs: Record<string, Record<string, unknown>> = {}
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: Handler) => {
      configs[name] = config
      handlers[name] = handler
    }),
  } as unknown as McpServer
  return { server, handlers, configs }
}

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '22222222-2222-4222-8222-222222222222'
const CHECKSUM = 'a'.repeat(64)
const summary = {
  id: TEMPLATE_ID,
  companyId: '33333333-3333-4333-8333-333333333333',
  documentType: 'invoice' as const,
  name: 'Safe semantic preset',
  scope: 'company' as const,
  status: 'active' as const,
  currentVersion: 1,
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
}
const detail = {
  ...summary,
  version: {
    version: 1,
    schemaVersion: '1.0',
    html: '' as const,
    css: '' as const,
    defaultData: { meta: { currency: 'USD' }, style: { template: 'professional' as const } },
    lineItemPresetMode: 'none' as const,
    assetManifest: [] as [],
    compilerVersion: '1.0',
    checksum: CHECKSUM,
    canonicalBytes: 200,
    createdAt: '2030-01-01T00:00:00Z',
  },
}

function service(overrides: Partial<InvomptService>): InvomptService {
  return {
    isGuest: () => false,
    getInvomlSpec: async () => '',
    ...overrides,
  } as InvomptService
}

describe('reusable invoice template tools', () => {
  test('registers strict discovery schemas and forwards list filters', async () => {
    const listInvoiceTemplates = vi.fn().mockResolvedValue({ templates: [summary] })
    const { server, handlers, configs } = serverMock()
    registerListInvoiceTemplatesTool(server, service({ listInvoiceTemplates }))

    const inputSchema = configs.list_invoice_templates.inputSchema as z.ZodType
    expect(z.safeParse(inputSchema, { documentType: 'invoice', status: 'active', unexpected: true }).success).toBe(false)
    await handlers.list_invoice_templates({ documentType: 'invoice', status: 'active' })
    expect(listInvoiceTemplates).toHaveBeenCalledWith({ documentType: 'invoice', status: 'active' })
  })

  test('gets a validated semantic preset and rejects rendered markup', async () => {
    const getInvoiceTemplate = vi.fn().mockResolvedValue({ template: detail })
    const { server, handlers, configs } = serverMock()
    registerGetInvoiceTemplateTool(server, service({ getInvoiceTemplate }))

    const outputSchema = configs.get_invoice_template.outputSchema as unknown as z.ZodType
    expect(templateIdSchema.description).toBe('Company-owned template ID')
    expect(outputSchema.safeParse({ template: detail }).success).toBe(true)
    expect(outputSchema.safeParse({ template: { ...detail, version: { ...detail.version, html: '<p>unsafe</p>' } } }).success).toBe(false)
    await handlers.get_invoice_template({ templateId: TEMPLATE_ID })
    expect(getInvoiceTemplate).toHaveBeenCalledWith(TEMPLATE_ID, undefined)
  })

  test('accepts canonical line items and preserves multi-rate tax categories', async () => {
    const longDescription = 'Credit adjustment '.repeat(150)
    const longTaxLabel = 'Zero-rated category '.repeat(12)
    const getInvoiceTemplate = vi.fn().mockResolvedValue({
      template: {
        ...detail,
        version: {
          ...detail.version,
          defaultData: {
            meta: {
              currency: 'USD',
              tax: {
                system: 'vat',
                categories: [
                  { id: 'standard', label: 'Standard VAT', rate: 20, default: true },
                  { id: 'zero', label: longTaxLabel, rate: 0, exempt: true },
                ],
              },
            },
            items: [{ description: longDescription, quantity: 1, unitPrice: 50, taxCategory: 'zero' }],
          },
          lineItemPresetMode: 'explicit',
        },
      },
    })
    const { server, handlers, configs } = serverMock()
    registerGetInvoiceTemplateTool(server, service({ getInvoiceTemplate }))

    const outputSchema = configs.get_invoice_template.outputSchema as unknown as z.ZodType
    expect(outputSchema.safeParse(await getInvoiceTemplate()).success).toBe(true)
    await handlers.get_invoice_template({ templateId: TEMPLATE_ID })
    expect(getInvoiceTemplate).toHaveBeenCalledWith(TEMPLATE_ID, undefined)
  })

  test('defaults extraction line items to false and keeps projection markup empty', async () => {
    const previewInvoiceTemplateExtraction = vi.fn().mockResolvedValue({
      projection: {
        invoiceId: INVOICE_ID,
        invoiceVersion: 3,
        documentType: 'invoice',
        html: '',
        css: '',
        defaultData: { meta: { currency: 'USD' } },
        lineItemPresetMode: 'none',
        assetManifest: [],
        includedPaths: ['meta.currency'],
        excludedPaths: [{ path: 'to', reason: 'recipient_identity' }],
        checksum: CHECKSUM,
        canonicalBytes: 200,
        compilerVersion: '1.0',
      },
    })
    const { server, handlers } = serverMock()
    registerPreviewInvoiceTemplateExtractionTool(server, service({ previewInvoiceTemplateExtraction }))
    await handlers.preview_invoice_template_extraction({ invoiceId: INVOICE_ID, version: 3 })
    expect(previewInvoiceTemplateExtraction).toHaveBeenCalledWith({ invoiceId: INVOICE_ID, version: 3, includeLineItems: false })
  })

  test('validates an explicit line-item projection with taxCategory', async () => {
    const previewInvoiceTemplateExtraction = vi.fn().mockResolvedValue({
      projection: {
        invoiceId: INVOICE_ID,
        invoiceVersion: 3,
        documentType: 'credit_note',
        html: '',
        css: '',
        defaultData: {
          meta: {
            currency: 'USD',
            tax: {
              system: 'vat',
              categories: [
                { id: 'standard', label: 'Standard VAT', rate: 20, default: true },
                { id: 'zero', label: 'Zero-rated', rate: 0, exempt: true },
              ],
            },
          },
          items: [{ description: 'Credit', quantity: 1, unitPrice: 50, taxCategory: 'zero' }],
        },
        lineItemPresetMode: 'explicit',
        assetManifest: [],
        includedPaths: ['meta.tax', 'items'],
        excludedPaths: [],
        checksum: CHECKSUM,
        canonicalBytes: 200,
        compilerVersion: '1.0',
      },
    })
    const { server, handlers, configs } = serverMock()
    registerPreviewInvoiceTemplateExtractionTool(server, service({ previewInvoiceTemplateExtraction }))
    const outputSchema = configs.preview_invoice_template_extraction.outputSchema as unknown as z.ZodType
    const result = await previewInvoiceTemplateExtraction({ invoiceId: INVOICE_ID, version: 3, includeLineItems: true })
    expect(outputSchema.safeParse(result).success).toBe(true)
    expect(outputSchema.safeParse({
      projection: {
        ...result.projection,
        defaultData: { items: [{ description: 'Invalid', quantity: 1, unitPrice: 10, tax: { label: 'VAT', rate: 20 } }] },
      },
    }).success).toBe(false)
    await handlers.preview_invoice_template_extraction({ invoiceId: INVOICE_ID, version: 3, includeLineItems: true })
    expect(previewInvoiceTemplateExtraction).toHaveBeenCalledWith({ invoiceId: INVOICE_ID, version: 3, includeLineItems: true })
  })

  test('saves only checksum-bound projections and preserves stable backend errors', async () => {
    const saveInvoiceAsTemplate = vi.fn().mockRejectedValue(new InvomptApiError('Stale projection.', 'TEMPLATE_PROJECTION_STALE', 409))
    const { server, handlers, configs } = serverMock()
    registerSaveInvoiceAsTemplateTool(server, service({ saveInvoiceAsTemplate }))

    const inputSchema = configs.save_invoice_as_template.inputSchema as z.ZodType
    expect(z.safeParse(inputSchema, {
      invoiceId: INVOICE_ID,
      version: 3,
      projectionChecksum: CHECKSUM,
      name: 'Safe template',
      idempotencyKey: 'template-key',
      html: '',
      css: '',
    }).success).toBe(false)
    const result = await handlers.save_invoice_as_template({
      invoiceId: INVOICE_ID,
      version: 3,
      projectionChecksum: CHECKSUM,
      name: 'Safe template',
      idempotencyKey: 'template-key',
    }) as { isError: boolean; content: Array<{ text: string }> }
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('TEMPLATE_PROJECTION_STALE')
  })
})
