import type { InvomptService } from '@invompt/mcp-core'

export const EXPECTED_TOOL_NAMES = [
  'ping',
  'create_invoice',
  'list_invoices',
  'get_invoice',
  'update_invoice',
  'archive_invoice',
  'unarchive_invoice',
  'renew_invoice_link',
  'approve_account_claim',
  'get_settings',
  'update_settings',
  'list_clients',
  'get_client',
  'create_client',
  'update_client',
  'archive_client',
] as const

export const PHASE_1_OPERATIONAL_TOOL_NAMES = EXPECTED_TOOL_NAMES.filter(
  (name) => name !== 'approve_account_claim',
)
export const PHASE_2_DISCOVERY_ONLY_TOOL_NAMES = ['approve_account_claim'] as const

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
    getInvoice: unavailable,
    updateInvoice: unavailable,
    archiveInvoice: unavailable,
    unarchiveInvoice: unavailable,
    renewInvoiceLink: unavailable,
    approveAccountClaim: unavailable,
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
