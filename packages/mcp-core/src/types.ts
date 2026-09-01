export const TEMPLATE_IDS = ['standard', 'minimal', 'professional'] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface CreateInvoiceInput {
  invoml: string
  templateId?: TemplateId
  clientId?: string
  idempotencyKey: string
}

export interface InvoiceResult extends Record<string, unknown> {
  invoiceId: string
  invoiceNumber: string
  status: string
  total: number | null
  currency: string
  dueDate: string | null
  url: string
  version: number
  replayed: boolean
  clientId?: string | null
  clientName?: string | null
  guestName?: string
  guestReference?: string
}

export interface ListInvoicesParams {
  page?: number
  limit?: number
  search?: string
  status?: 'approved' | 'archived'
}

export interface InvoiceListItem {
  id: string
  invoiceNumber: string
  version: number
  clientId: string | null
  clientName: string | null
  total: number | null
  currency: string
  status: string
  dueDate: string | null
  sent: boolean
  createdAt: string
}

export interface ListInvoicesResult extends Record<string, unknown> {
  invoices: InvoiceListItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export type InvoiceTemplateDocumentType = 'invoice' | 'quote' | 'estimate' | 'receipt' | 'credit_note'
export type InvoiceTemplateScope = 'company'
export type InvoiceTemplateStatus = 'active' | 'archived'
export type LineItemPresetMode = 'none' | 'explicit'
export const INVOICE_TEMPLATE_ERROR_CODES = [
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'TEMPLATE_PROJECTION_STALE',
  'TEMPLATE_NAME_CONFLICT',
  'TEMPLATE_VERSION_CONFLICT',
  'TEMPLATE_LIMIT_EXCEEDED',
  'TEMPLATE_STORAGE_LIMIT_EXCEEDED',
  'IDEMPOTENCY_CONFLICT',
  'SERVICE_UNAVAILABLE',
] as const
export type InvoiceTemplateErrorCode = (typeof INVOICE_TEMPLATE_ERROR_CODES)[number]

export interface InvoiceTemplateSummary {
  id: string
  companyId: string
  documentType: InvoiceTemplateDocumentType
  name: string
  scope: InvoiceTemplateScope
  status: InvoiceTemplateStatus
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface InvoiceTemplateVersion {
  version: number
  schemaVersion: string
  /** v1 stores a validated semantic preset; rendered source markup is never reusable. */
  html: ''
  css: ''
  defaultData: Record<string, unknown>
  lineItemPresetMode: LineItemPresetMode
  assetManifest: []
  compilerVersion: string
  checksum: string
  canonicalBytes: number
  createdAt: string
}

export interface InvoiceTemplateDetail extends InvoiceTemplateSummary {
  version: InvoiceTemplateVersion | null
}

export interface ListInvoiceTemplatesParams {
  documentType?: InvoiceTemplateDocumentType
  status?: 'active'
}

export interface ListInvoiceTemplatesResult extends Record<string, unknown> {
  templates: InvoiceTemplateSummary[]
}

export interface GetInvoiceTemplateResult extends Record<string, unknown> {
  template: InvoiceTemplateDetail
}

export interface PreviewInvoiceTemplateExtractionInput {
  invoiceId: string
  version: number
  includeLineItems?: boolean
}

export interface InvoiceTemplateProjection extends Omit<InvoiceTemplateVersion, 'version' | 'createdAt'> {
  invoiceId: string
  invoiceVersion: number
  documentType: InvoiceTemplateDocumentType
  includedPaths: string[]
  excludedPaths: Array<{ path: string; reason: string }>
}

export interface PreviewInvoiceTemplateExtractionResult extends Record<string, unknown> {
  projection: InvoiceTemplateProjection
}

export interface SaveInvoiceAsTemplateInput extends PreviewInvoiceTemplateExtractionInput {
  projectionChecksum: string
  name: string
  idempotencyKey: string
}

export interface SaveInvoiceAsTemplateResult extends Record<string, unknown> {
  template: InvoiceTemplateDetail
  replayed: boolean
}

export interface InvoiceDetail extends Record<string, unknown> {
  id: string
  invoiceNumber: string
  version: number
  clientId: string | null
  clientName: string | null
  total: number | null
  currency: string
  status: string
  dueDate: string | null
  templateId: string
  invomlContent: string | null
  url: string | null
  linkState?: 'active' | 'unavailable'
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceDetailResult extends Record<string, unknown> {
  invoice: InvoiceDetail
}

export interface UpdateInvoiceInput {
  expectedVersion: number
  idempotencyKey: string
  invoml?: string
  templateId?: TemplateId
  /**
   * Omitted: retain the current client link without resyncing the snapshot.
   * null: detach the saved client while preserving the current invoice snapshot.
   * UUID: assign that company-owned client and rebuild the invoice recipient snapshot.
   */
  clientId?: string | null
  /**
   * Explicitly authorizes correction of a previously persisted wrong number.
   * `from` must match the current canonical number and the reason is retained
   * in the immutable mutation receipt.
   */
  numberCorrection?: {
    from: string
    reason: string
  }
}

interface UpdateInvoiceResultBase extends Record<string, unknown> {
  invoiceId: string
  invoiceNumber: string
  status: string
  total: number | null
  currency: string
  dueDate: string | null
  version: number
  replayed: boolean
  clientId?: string | null
  clientName?: string | null
}

export type UpdateInvoiceResult =
  | (UpdateInvoiceResultBase & { url: string; linkState: 'active' })
  | (UpdateInvoiceResultBase & { url: null; linkState: 'unavailable' })

export interface ArchiveInvoiceInput {
  expectedVersion: number
  idempotencyKey: string
}

export interface ArchiveInvoiceResult extends Record<string, unknown> {
  invoiceId: string
  status: 'archived'
  version: number
  replayed: boolean
}

export interface UnarchiveInvoiceInput {
  expectedVersion: number
  idempotencyKey: string
}

export interface UnarchiveInvoiceResult extends Record<string, unknown> {
  invoiceId: string
  status: 'unarchived'
  version: number
  replayed: boolean
}

export interface CreateAccountClaimLinkResult extends Record<string, unknown> {
  claimUrl: string
  expiresAt: string
}

export interface RenewInvoiceLinkInput {
  idempotencyKey: string
}

export interface RenewInvoiceLinkResult extends Record<string, unknown> {
  invoiceId: string
  url: string
  expiresAt: string
  replayed: boolean
}

export interface SettingsPaymentInfo {
  title: string
  content: string
  paymentTerms: string
}

export interface PublicSettings extends Record<string, unknown> {
  companyName: string | null
  currency: string | null
  invoicePrefix: string
  invoiceNumberFormat: string
  defaultDueDate: string
  senderInfo: string
  paymentInfo: SettingsPaymentInfo
}

export interface SettingsResult extends Record<string, unknown> {
  settings: PublicSettings
}

export interface UpdateSettingsPaymentInfo {
  title?: string
  content?: string
  paymentTerms?: string
}

export interface UpdateSettingsInput {
  companyName?: string | null
  currency?: string | null
  invoicePrefix?: string
  invoiceNumberFormat?: string
  defaultDueDate?: string
  senderInfo?: string
  paymentInfo?: UpdateSettingsPaymentInfo
  idempotencyKey: string
}

export interface UpdateSettingsResult extends SettingsResult {
  replayed: boolean
}

export interface PingAccount {
  plan: string
}

export interface PingResult extends Record<string, unknown> {
  status: 'ok'
  timestamp: string
  provisioned: boolean
  guestName?: string
  guestReference?: string
  account?: PingAccount
}

export interface ClientBillingParty {
  name: string
  email?: string | null
  address?: string | null
  attention?: string | null
  taxId?: string | null
  businessNumber?: string | null
  phone?: string | null
  website?: string | null
  countryCode?: string | null
}

export interface SavedClient extends ClientBillingParty {
  id: string
  version: number
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientSummary {
  id: string
  name: string
  email?: string | null
  version: number
}

export type ClientMatchKind = 'exact_unique' | 'ambiguous' | 'none'

export interface ClientResolution {
  kind: ClientMatchKind
  query?: string
  selectedClientId?: string
  candidates: ClientSummary[]
}

export interface ListClientsParams {
  page?: number
  limit?: number
  search?: string
}

export interface ListClientsResult extends Record<string, unknown> {
  clients: ClientSummary[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  resolution: ClientResolution
}

export interface GetClientResult extends Record<string, unknown> {
  client: SavedClient
}

export interface CreateClientInput extends ClientBillingParty {
  idempotencyKey: string
  allowDuplicate?: boolean
}

export interface CreateClientResult extends Record<string, unknown> {
  client?: SavedClient
  created: boolean
  replayed?: boolean
  duplicateCandidates: ClientSummary[]
  requiresDuplicateConfirmation: boolean
}

export interface UpdateClientInput extends Partial<ClientBillingParty> {
  idempotencyKey: string
  expectedVersion: number
}

export interface UpdateClientResult extends Record<string, unknown> {
  client: SavedClient
  replayed?: boolean
}

export interface ArchiveClientInput {
  idempotencyKey: string
  expectedVersion: number
  confirmed: true
}

export interface ArchiveClientResult extends Record<string, unknown> {
  clientId: string
  status: 'archived'
  version: number
  archivedAt: string
  replayed?: boolean
}
