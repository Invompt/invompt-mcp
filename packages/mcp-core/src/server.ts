import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { GUEST_MCP_INSTRUCTIONS, STRUCTURED_INVOML_GUIDANCE } from './contracts.js'
import { registerDraftInvoicePrompt } from './prompts/draft-invoice.js'
import { registerGettingStartedResource } from './resources/getting-started.js'
import { registerInvomlSpecResource } from './resources/invoml-spec.js'
import type { InvomptService } from './service.js'
import { registerArchiveClientTool } from './tools/archive-client.js'
import { registerArchiveInvoiceTool } from './tools/archive-invoice.js'
import { registerCreateAccountClaimLinkTool } from './tools/create-account-claim-link.js'
import { registerCreateClientTool } from './tools/create-client.js'
import { registerCreateInvoiceTool } from './tools/create-invoice.js'
import { registerGetClientTool } from './tools/get-client.js'
import { registerGetInvoiceTool } from './tools/get-invoice.js'
import { registerGetSettingsTool } from './tools/get-settings.js'
import { registerListClientsTool } from './tools/list-clients.js'
import { registerListInvoicesTool } from './tools/list-invoices.js'
import { registerPingTool } from './tools/ping.js'
import { registerRenewInvoiceLinkTool } from './tools/renew-invoice-link.js'
import { registerUnarchiveInvoiceTool } from './tools/unarchive-invoice.js'
import { registerUpdateClientTool } from './tools/update-client.js'
import { registerUpdateInvoiceTool } from './tools/update-invoice.js'
import { registerUpdateSettingsTool } from './tools/update-settings.js'

export const MCP_SERVER_NAME = 'invompt-mcp'

export type McpRegistrar = McpServer

export function registerMcpSurface(server: McpRegistrar, service: InvomptService): void {
  registerInvomlSpecResource(server, service)
  registerGettingStartedResource(server)
  registerPingTool(server, service)
  registerCreateInvoiceTool(server, service)
  registerListInvoicesTool(server, service)
  registerGetInvoiceTool(server, service)
  registerUpdateInvoiceTool(server, service)
  registerArchiveInvoiceTool(server, service)
  registerUnarchiveInvoiceTool(server, service)
  registerRenewInvoiceLinkTool(server, service)
  registerCreateAccountClaimLinkTool(server, service)
  registerGetSettingsTool(server, service)
  registerUpdateSettingsTool(server, service)
  registerListClientsTool(server, service)
  registerGetClientTool(server, service)
  registerCreateClientTool(server, service)
  registerUpdateClientTool(server, service)
  registerArchiveClientTool(server, service)
  registerDraftInvoicePrompt(server, service)
}

export function createMcpServer(service: InvomptService, version: string): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version },
    {
      instructions: `${STRUCTURED_INVOML_GUIDANCE} For named recipients, call list_clients before create_invoice; never silently save a client. Every create requires a stable idempotencyKey. ${GUEST_MCP_INSTRUCTIONS}`,
    },
  )
  registerMcpSurface(server, service)
  return server
}
