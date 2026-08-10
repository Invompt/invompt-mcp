import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const GETTING_STARTED_URI = 'invompt://docs/getting-started'

const GETTING_STARTED_CONTENT = `Invompt — AI Invoice Generator
================================

Invompt (invompt.com) lets you create professional invoices from natural
language or structured data. This MCP server gives your AI tool full
access to the invoicing workflow.

## Recommended Workflow

1. Understand the user's semantic intent in their language. Distinguish a
   request for a billing document from pricing advice that does not require one.

2. Read the InvoML spec (invompt://spec/invoml/v1) — understand the Invoice
   Markup Language JSON format.

3. Before tool use, complete explicit onboarding for either Guest mode with a
   server-issued pseudonymous local credential or separate registered OAuth over
   hosted HTTPS. When defaults matter and get_settings is exposed, read the connected
   workspace currency, invoice prefix, and payment terms. When the user asks to change defaults, call update_settings with only the fields
   they supplied and a stable 8–128 character idempotencyKey. Omitted settings
   stay unchanged; explicit null clears company name or currency.

4. For a named recipient, search saved clients (list_clients) by name or email
   before creation when that tool is exposed. Auto-select only one
   exact_unique match. If matches are ambiguous, ask which client to use. If
   there is no match, ask one consolidated question: save and assign the
   client, or use recipient data only for this invoice. Never save silently.

5. Create invoices, quotes, estimates, and pro formas (create_invoice) —
   generate InvoML from the user's request and return the verified canonical
   number, status, amount, currency, due date, version, and hosted URL. An
   authored meta.number is exact: a different server value is a hard failure.
   The tool performs canonical get_invoice read-back before reporting success. Recipient
   and issuer identity are optional. Never invent issuer identity. Passing
   clientId assigns a saved client and snapshots
   its billing fields; private notes are never copied. Every create requires a
   stable 8–128 character idempotencyKey; reuse it only for an identical retry.

6. Browse invoices (list_invoices, get_invoice) — search existing invoices,
   read their InvoML content and current version, use them as templates for new
   ones.

7. Update invoices (update_invoice) — modify InvoML content or change templates.
   Omitting clientId retains the link without resync, null detaches it while
   keeping the current snapshot, and a UUID assigns/resyncs that invoice. Send
   the latest version as expectedVersion plus a stable idempotencyKey. Ordinary
   updates preserve the canonical number. Repair a wrong persisted number only
   with full corrected InvoML and numberCorrection { from, reason }. The tool
   performs an authorized canonical get_invoice read-back and returns the
   active hosted URL with the updated invoice facts.

8. Manage saved clients (get_client, create_client, update_client,
   archive_client). Client edits never rewrite historical invoice snapshots.

9. Archive invoices (archive_invoice) — soft delete only after the user has
   clearly identified and authorized the target. Send the latest version as
   expectedVersion plus a stable idempotencyKey.

10. Restore an archived invoice with unarchive_invoice only when the user
    explicitly identifies the target and asks to restore it.

## Key Concepts

- InvoML (Invoice Markup Language): JSON format for invoice data. The system
  calculates totals from line items — never set totals manually.

- Templates: Three neutral styles — standard (default), minimal, and
  professional. They follow established invoicing conventions informed by
  Stripe, Xero, and QuickBooks. Let the server apply standard unless the user
  explicitly asks for a supported alternative.

- Payment: Put ordinary bank instructions in root payment. paymentAdvice is a
  detachable remittance stub and is opt-in; omit it from the document,
  style.order, and style.blocks unless the user explicitly asks for one.

- Invoice URLs: Every invoice gets a hosted URL for viewing and browser-based
  PDF download. Return that URL instead of rendering or writing a PDF locally.

- Language and locale: Preserve the user's language in descriptions and notes.
  Use the locale supported by the live InvoML spec for dates, numbers, labels,
  currency formatting, and text direction.

- The MCP surface exposes exactly 16 operational tools. create_account_claim_link
  is a Guest-only mutation that creates a short-lived browser link for an explicit
  account-claim request. It accepts no secrets or identifiers as input.

- Guest onboarding and registered OAuth are separate connection modes. Do not call
  create_account_claim_link while connected through OAuth.

## Tips

- Never invent currency, prices, quantities, identities, tax details, payment
  instructions, addresses, or legal facts. Ask one consolidated question when
  calculation-critical information is missing.

- Omit unknown optional fields instead of filling them with placeholders.

- When duplicating invoices, use get_invoice to fetch the original InvoML,
  modify it, and pass to create_invoice.

- Treat meta.number as final authored data. If a final document number is
  missing, ask for it; never persist a made-up sequential or DRAFT number.

## Connection Setup

Complete onboarding before calling an invoice tool. Guest mode uses a server-issued
pseudonymous local credential; registered OAuth is a separate hosted HTTPS sign-in.
Agents must never discover, copy, print, or synthesize authentication material. When
the user explicitly asks to claim the active Guest workspace, call
create_account_claim_link once. Present claimUrl exactly once, explain that it expires,
and never log or repeat it. Do not include credentials, account IDs, claim IDs, or
other internal identifiers. After the browser claim succeeds, the old Guest credential
returns GUEST_ACCOUNT_CLAIMED; do not retry it.
`

export function registerGettingStartedResource(server: McpServer): void {
  server.registerResource(
    'getting-started',
    GETTING_STARTED_URI,
    {
      title: 'Invompt Getting Started Guide',
      description: 'Product guide — what Invompt is, recommended workflow, available tools, and tips.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: GETTING_STARTED_CONTENT,
          },
        ],
      }
    },
  )
}
