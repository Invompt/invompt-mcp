# Invompt MCP Surface

Use the tool schemas exposed by the connected server as the final authority. The packaged
`invompt-mcp` stdio server currently exposes these surfaces.

Phase 1 has 15 operational tools. `approve_account_claim` is retained only as a discovery-only
Phase 2 placeholder; it is not operational and must not be called.

Public Phase 1 deployment is Guest-only. Registered-account setup and account-claim
execution are not capabilities of this package; authentication for those workflows
is owned by the private adapter layer.

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
| `ping` | Guest | Read-only | Connectivity and connected workspace state. |
| `create_invoice` | Guest | Idempotent create | Create a hosted document and receive its canonical number, status, amount, currency, URL, and version. |
| `list_invoices` | Guest | Read-only | Search and page through owned invoices. |
| `get_invoice` | Guest | Read-only | Retrieve full canonical InvoML. |
| `update_invoice` | Guest | Idempotent update | Change content or template with expected-version protection, then return the canonical active hosted URL from authorized read-back; use the explicit audited correction object only to repair a wrong persisted number. |
| `archive_invoice` | Guest | Idempotent destructive soft delete | Archive with expected-version protection. |
| `unarchive_invoice` | Guest | Idempotent restore | Restore an archived invoice with expected-version protection. |
| `renew_invoice_link` | Guest | Idempotent capability rotation | Replace the hosted review URL for 72 hours without revising the invoice. |
| `approve_account_claim` | Phase 2 only | Discovery-only, non-operational | Do not call in Phase 1; account-claim execution is deferred to Phase 2. |
| `get_settings` | Guest | Read-only | Read company, currency, numbering, and payment defaults. |
| `update_settings` | Guest | Idempotent update | Partially update invoice defaults without inventing omitted values. |
| `list_clients` | Guest | Read-only | Search saved clients and receive deterministic exact/ambiguous/none resolution. |
| `get_client` | Guest | Read-only | Read one structured billing party without private notes or rich HTML. |
| `create_client` | Guest | Idempotent create | Explicitly save after user choice; protect against unconfirmed duplicates. |
| `update_client` | Guest | Idempotent update | Partially edit with expected-version conflict protection. |
| `archive_client` | Guest | Destructive soft delete | Archive after explicit confirmation; preserve invoice history. |

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
