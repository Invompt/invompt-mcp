import type {
  ApproveAccountClaimInput,
  ApproveAccountClaimResult,
  ArchiveClientInput,
  ArchiveClientResult,
  ArchiveInvoiceInput,
  ArchiveInvoiceResult,
  CreateClientInput,
  CreateClientResult,
  CreateInvoiceInput,
  GetClientResult,
  InvoiceDetailResult,
  InvoiceResult,
  ListClientsParams,
  ListClientsResult,
  ListInvoicesParams,
  ListInvoicesResult,
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
  getInvoice(id: string): Promise<InvoiceDetailResult>
  updateInvoice(id: string, input: UpdateInvoiceInput): Promise<UpdateInvoiceResult>
  archiveInvoice(id: string, input: ArchiveInvoiceInput): Promise<ArchiveInvoiceResult>
  unarchiveInvoice(id: string, input: UnarchiveInvoiceInput): Promise<UnarchiveInvoiceResult>
  renewInvoiceLink(id: string, input: RenewInvoiceLinkInput): Promise<RenewInvoiceLinkResult>
  /** Phase 2 contract placeholder; the Phase 1 discovery handler never invokes it. */
  approveAccountClaim(input: ApproveAccountClaimInput): Promise<ApproveAccountClaimResult>
  getSettings(): Promise<SettingsResult>
  updateSettings(input: UpdateSettingsInput): Promise<UpdateSettingsResult>
  listClients(params?: ListClientsParams): Promise<ListClientsResult>
  getClient(id: string): Promise<GetClientResult>
  createClient(input: CreateClientInput): Promise<CreateClientResult>
  updateClient(id: string, input: UpdateClientInput): Promise<UpdateClientResult>
  archiveClient(id: string, input: ArchiveClientInput): Promise<ArchiveClientResult>
}
