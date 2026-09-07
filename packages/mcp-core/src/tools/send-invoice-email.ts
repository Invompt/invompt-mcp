import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { InvomptService } from '../service.js'
import { idempotencyKeySchema } from './client-schemas.js'
import { formatToolError } from './format-error.js'

const emailSchema = z.string().trim().pipe(z.email().max(320))

/**
 * Drops any `cc` entry that matches `recipientEmail` case-insensitively, then dedupes the
 * remaining entries case-insensitively (first occurrence wins), so a host that mis-parses
 * "send to X and cc X" or repeats an address never turns one logical send into duplicate
 * deliveries to the same address under one idempotency key.
 */
function normalizeCc(cc: string[] | undefined, recipientEmail: string): string[] | undefined {
  if (!cc || cc.length === 0) return cc

  const recipientKey = recipientEmail.trim().toLowerCase()
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const address of cc) {
    const key = address.trim().toLowerCase()
    if (key === recipientKey) continue
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(address)
  }

  return deduped.length > 0 ? deduped : undefined
}

const sendInvoiceEmailOutputSchema = {
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  recipientEmail: z.string(),
  sentAt: z.iso.datetime(),
  emailLogId: z.string().nullable(),
  replayed: z.boolean(),
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
        idempotencyKey: idempotencyKeySchema.describe(
          'Stable per-send key. Reuse it only when retrying the same send so a host retry never emails the customer twice.',
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, recipientEmail, recipientName, subject, message, cc, idempotencyKey }) => {
      try {
        const result = await client.sendInvoiceEmail(id, {
          recipientEmail,
          recipientName,
          subject,
          message,
          cc: normalizeCc(cc, recipientEmail),
          idempotencyKey,
        })
        return {
          structuredContent: result,
          content: [
            {
              type: 'text' as const,
              text: result.replayed
                ? `Invoice ${result.invoiceNumber} was already sent to ${result.recipientEmail} (replayed).`
                : `Invoice ${result.invoiceNumber} sent to ${result.recipientEmail}.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
