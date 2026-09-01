import type {
  ArchiveClientInput,
  ArchiveClientResult,
  ArchiveInvoiceInput,
  ArchiveInvoiceResult,
  CreateClientInput,
  CreateClientResult,
  CreateAccountClaimLinkResult,
  CreateInvoiceInput,
  GetClientResult,
  InvoiceDetailResult,
  InvoiceResult,
  ListClientsParams,
  ListClientsResult,
  ListInvoicesParams,
  ListInvoicesResult,
  ListInvoiceTemplatesParams,
  ListInvoiceTemplatesResult,
  GetInvoiceTemplateResult,
  PreviewInvoiceTemplateExtractionInput,
  PreviewInvoiceTemplateExtractionResult,
  SaveInvoiceAsTemplateInput,
  SaveInvoiceAsTemplateResult,
  PingResult,
  RenewInvoiceLinkInput,
  RenewInvoiceLinkResult,
  SettingsResult,
  UnarchiveInvoiceInput,
  UnarchiveInvoiceResult,
  UpdateClientInput,
  UpdateClientResult,
  UpdateInvoiceInput,
  UpdateInvoiceResult,
  UpdateSettingsInput,
  UpdateSettingsResult,
} from './types.js'

/**
 * Transport-independent public service boundary for the Invompt MCP contract.
 *
 * Implementations may be HTTP clients, private server adapters, or test fakes.
 * This package intentionally does not choose an endpoint, credential source, or
 * persistence mechanism.
 */
export interface InvomptService {
  isGuest(): boolean
  getInvomlSpec(): Promise<string>
  ping(): Promise<PingResult>
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>
  listInvoices(params?: ListInvoicesParams): Promise<ListInvoicesResult>
  listInvoiceTemplates(params?: ListInvoiceTemplatesParams): Promise<ListInvoiceTemplatesResult>
  getInvoiceTemplate(id: string, version?: number): Promise<GetInvoiceTemplateResult>
  previewInvoiceTemplateExtraction(input: PreviewInvoiceTemplateExtractionInput): Promise<PreviewInvoiceTemplateExtractionResult>
  saveInvoiceAsTemplate(input: SaveInvoiceAsTemplateInput): Promise<SaveInvoiceAsTemplateResult>
  getInvoice(id: string): Promise<InvoiceDetailResult>
  updateInvoice(id: string, input: UpdateInvoiceInput): Promise<UpdateInvoiceResult>
  archiveInvoice(id: string, input: ArchiveInvoiceInput): Promise<ArchiveInvoiceResult>
  unarchiveInvoice(id: string, input: UnarchiveInvoiceInput): Promise<UnarchiveInvoiceResult>
  renewInvoiceLink(id: string, input: RenewInvoiceLinkInput): Promise<RenewInvoiceLinkResult>
  createAccountClaimLink(): Promise<CreateAccountClaimLinkResult>
  getSettings(): Promise<SettingsResult>
  updateSettings(input: UpdateSettingsInput): Promise<UpdateSettingsResult>
  listClients(params?: ListClientsParams): Promise<ListClientsResult>
  getClient(id: string): Promise<GetClientResult>
  createClient(input: CreateClientInput): Promise<CreateClientResult>
  updateClient(id: string, input: UpdateClientInput): Promise<UpdateClientResult>
  archiveClient(id: string, input: ArchiveClientInput): Promise<ArchiveClientResult>
}
