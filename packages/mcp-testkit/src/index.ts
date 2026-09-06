import type { InvomptService } from '@invompt/mcp-core'

export const EXPECTED_TOOL_NAMES = [
  'ping',
  'create_invoice',
  'list_invoices',
  'list_invoice_templates',
  'get_invoice_template',
  'preview_invoice_template_extraction',
  'save_invoice_as_template',
  'get_invoice',
  'update_invoice',
  'archive_invoice',
  'unarchive_invoice',
  'renew_invoice_link',
  'send_invoice_email',
  'create_account_claim_link',
  'get_settings',
  'update_settings',
  'list_clients',
  'get_client',
  'create_client',
  'update_client',
  'archive_client',
] as const

export const OPERATIONAL_TOOL_NAMES = EXPECTED_TOOL_NAMES

export const EXPECTED_RESOURCE_NAMES = ['getting-started', 'invoml-spec'] as const
export const EXPECTED_PROMPT_NAMES = ['draft_invoice_invoml'] as const

export function createServiceFake(overrides: Partial<InvomptService> = {}): InvomptService {
  const unavailable = async (): Promise<never> => {
    throw new Error('Test service operation was not configured.')
  }
  return {
    isGuest: () => true,
    getInvomlSpec: async () => '# InvoML v1',
    ping: unavailable,
    createInvoice: unavailable,
    listInvoices: unavailable,
    listInvoiceTemplates: unavailable,
    getInvoiceTemplate: unavailable,
    previewInvoiceTemplateExtraction: unavailable,
    saveInvoiceAsTemplate: unavailable,
    getInvoice: unavailable,
    updateInvoice: unavailable,
    archiveInvoice: unavailable,
    unarchiveInvoice: unavailable,
    renewInvoiceLink: unavailable,
    sendInvoiceEmail: unavailable,
    createAccountClaimLink: unavailable,
    getSettings: unavailable,
    updateSettings: unavailable,
    listClients: unavailable,
    getClient: unavailable,
    createClient: unavailable,
    updateClient: unavailable,
    archiveClient: unavailable,
    ...overrides,
  }
}
