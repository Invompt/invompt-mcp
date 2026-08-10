# Invompt MCP Surface

Use the tool schemas exposed by the connected server as the final authority. The connected
Invompt MCP service exposes these surfaces after `invompt-onboarding` confirms the selected Guest
or OAuth connection.

The surface has exactly 16 operational tools. Authentication is established by the selected Guest
or OAuth connection. `create_account_claim_link` is Guest-only; ChatGPT web is a separate remote
OAuth-only host and cannot create a Guest claim link.

## Resources

| Name | Resource | Use |
|---|---|---|
| `getting-started` | `invompt://docs/getting-started` | Read the recommended workflow and public Phase 1 access model. |
| `invoml-spec` | `invompt://spec/invoml/v1` | Read the live InvoML contract before drafting. |

## Prompt

| Prompt | Use |
|---|---|
| `draft_invoice_invoml` | Convert a natural-language billing request into strict InvoML JSON. |

## Tools

| Tool | Authentication | Mutability | Use |
|---|---|---|---|
| `ping` | Selected Guest or registered OAuth connection | Read-only | Connectivity and connected workspace state. |
| `create_invoice` | Selected Guest or registered OAuth connection | Idempotent create | Create a hosted document and receive its canonical number, status, amount, currency, URL, and version. |
| `list_invoices` | Selected Guest or registered OAuth connection | Read-only | Search and page through owned invoices. |
| `get_invoice` | Selected Guest or registered OAuth connection | Read-only | Retrieve full canonical InvoML. |
| `update_invoice` | Selected Guest or registered OAuth connection | Idempotent update | Change content or template with expected-version protection, then return the canonical active hosted URL from authorized read-back; use the explicit audited correction object only to repair a wrong persisted number. |
| `archive_invoice` | Selected Guest or registered OAuth connection | Idempotent destructive soft delete | Archive with expected-version protection. |
| `unarchive_invoice` | Selected Guest or registered OAuth connection | Idempotent restore | Restore an archived invoice with expected-version protection. |
| `renew_invoice_link` | Selected Guest or registered OAuth connection | Idempotent capability rotation | Replace the hosted review URL for 72 hours without revising the invoice. |
| `create_account_claim_link` | Guest only | Non-idempotent mutation | Create a short-lived browser claim URL with no input. Present it once, explain expiry, and never log it. |
| `get_settings` | Selected Guest or registered OAuth connection | Read-only | Read company, currency, numbering, and payment defaults. |
| `update_settings` | Selected Guest or registered OAuth connection | Idempotent update | Partially update invoice defaults without inventing omitted values. |
| `list_clients` | Selected Guest or registered OAuth connection | Read-only | Search saved clients and receive deterministic exact/ambiguous/none resolution. |
| `get_client` | Selected Guest or registered OAuth connection | Read-only | Read one structured billing party without private notes or rich HTML. |
| `create_client` | Selected Guest or registered OAuth connection | Idempotent create | Explicitly save after user choice; protect against unconfirmed duplicates. |
| `update_client` | Selected Guest or registered OAuth connection | Idempotent update | Partially edit with expected-version conflict protection. |
| `archive_client` | Selected Guest or registered OAuth connection | Destructive soft delete | Archive after explicit confirmation; preserve invoice history. |

For a named recipient, search saved clients first. Auto-select only an exact unique match. Ask the
user to choose among multiple matches. With no match, ask one question offering save-and-assign or
one-off recipient data; never save silently. `create_invoice.clientId` assigns and snapshots a
saved client. For `update_invoice.clientId`, omission retains without resync, null detaches while
keeping the snapshot, and a UUID assigns/resyncs the selected invoice.

Invoice create/update/archive/link-renewal mutations require a stable `idempotencyKey` of 8–128 characters.
Update and archive also require that the latest invoice `version` be sent as `expectedVersion`.
Invoice list and get results expose the current version. Settings updates are partial: omitted
fields remain unchanged, company name and currency accept explicit null, and payment information
accepts individual title, content, or terms fields. Canonical InvoML is limited to 128 KiB of
UTF-8 bytes. The supported packaged templates are `standard`, `minimal`, and `professional`.
An explicit `meta.number` is authoritative: creation must return the same canonical number or fail.
Ordinary updates preserve that number. A repair uses full corrected InvoML plus
`numberCorrection: { from, reason }`; `from` must match the current canonical number and the reason
is retained in the immutable mutation receipt.

Normal bank instructions belong in root `payment`. Do not add root `paymentAdvice`, or include
`paymentAdvice` in `style.order`/`style.blocks`, unless the user explicitly requests a detachable
remittance stub.

Saved billing-party input follows the product contract: name 200 characters; email 320; address
2000; attention 200; tax ID, business number, and phone 100 each; website 500; two-letter country
code; HTTP/HTTPS website URLs; and trimmed idempotency keys of 8–128 characters.
Do not invent tools that the server does not list. PDF rendering is not a published
`invompt-mcp` tool. Return hosted invoice URLs; use `renew_invoice_link` when `get_invoice`
reports no active link. The Web product owns preview and browser PDF download/print.

Account claim is link-first: `create_account_claim_link` accepts no secrets or identifiers and
returns only `claimUrl` and `expiresAt`. Never include credentials, account IDs, claim IDs, nonces,
or OAuth data. Present `claimUrl` exactly once. After successful browser claim, the old
Guest credential returns `GUEST_ACCOUNT_CLAIMED`; stop using it and reconcile onboarding state.
