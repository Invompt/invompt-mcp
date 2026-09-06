import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { formatToolError } from './format-error.js'

const emailSchema = z.string().trim().pipe(z.email().max(320))

const sendInvoiceEmailOutputSchema = {
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  recipientEmail: z.string(),
  sentAt: z.iso.datetime(),
  emailLogId: z.string().nullable(),
}

export function registerSendInvoiceEmailTool(server: McpServer, client: InvomptService): void {
  server.registerTool(
    'send_invoice_email',
    {
      title: 'Send Invoice Email',
      description:
        'Send an existing invoice as a server-rendered PDF attachment by email. Requires a registered account; Guest connections must first use create_account_claim_link. Do not use to create, edit, or download an invoice. Use get_invoice or list_invoices to identify the invoice first, and confirm the recipient with the user before calling.',
      outputSchema: sendInvoiceEmailOutputSchema,
      inputSchema: {
        id: z.string().min(1).describe('Invoice ID'),
        recipientEmail: emailSchema.describe('Email address that receives the invoice PDF.'),
        recipientName: z.string().trim().min(1).max(200).optional().describe('Optional recipient display name.'),
        subject: z.string().trim().min(1).max(200).optional().describe('Optional email subject override.'),
        message: z.string().trim().min(1).max(2000).optional().describe('Optional plain-text message included with the email.'),
        cc: z.array(emailSchema).max(5).optional().describe('Optional additional recipients, up to 5 email addresses.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, recipientEmail, recipientName, subject, message, cc }) => {
      try {
        const result = await client.sendInvoiceEmail(id, { recipientEmail, recipientName, subject, message, cc })
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: `Invoice ${result.invoiceNumber} sent to ${result.recipientEmail}.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
