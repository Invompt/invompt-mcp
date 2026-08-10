---
name: invompt-local-beta-invoice
description: |
  Create or manage an Invompt invoice, quote, estimate, or pro forma from
  natural-language intent in any language, including short follow-ups that
  reuse earlier facts. Use for explicit billing-document requests across
  Latin, Cyrillic, RTL, Indic, CJK, and Southeast Asian scripts. Do not use
  for price or budgeting advice unless the user asks to create a document.
---

# Invompt Invoice Workflow

Before any MCP call, load `invompt-local-beta-onboarding`. On the first Invompt request in this conversation,
it checks redacted local state and, when undecided, asks the user to choose Guest or OAuth in the
user's language. Do not call `invompt-local-beta` until onboarding confirms an active binding. Match semantic
intent rather than requiring the word “Invompt”, an English command, or a fixed keyword list.
Respond in the user's language unless they request another language.

Load the bundled [MCP surface contract](references/mcp-surface.md) with this skill. It records the
required mutation keys, optimistic versions, template IDs, and settings fields; the live MCP
schemas remain final if the connected server exposes a newer compatible surface.

## Route The Request

| Intent | Action |
|---|---|
| Price, cost, or budgeting advice without a document request | Answer normally; do not call Invompt. |
| Create an invoice, quote, estimate, or pro forma | Follow the creation workflow. |
| Convert earlier conversation into a billing document | Reuse relevant earlier facts and create it. |
| Find or read existing documents | Use `list_invoices` and `get_invoice` when exposed. |
| Revise, translate, correct, or restyle an existing document | Use `update_invoice` when exposed. |
| Renew an expired hosted link | Use `renew_invoice_link` when exposed. |
| Claim the active Guest workspace into an account | In Guest mode only, call `create_account_claim_link` once and present its expiring URL once. |
| Archive an existing document | Confirm the target and authorization, then use `archive_invoice`. |
| Read invoice defaults | Use `get_settings` only when exposed and invoice defaults matter. |
| Change invoice defaults | Use `update_settings` with only user-supplied fields and a stable idempotency key. |
| Find or manage saved clients | Use `list_clients`, `get_client`, `create_client`, `update_client`, or `archive_client` when exposed. |
| Check connection | Use `ping`; do not call it as a normal creation preflight. |

Treat live MCP tool and resource schemas as the final capability contract. If a management tool is
not exposed for the current adapter context, report that capability gap without
creating a duplicate or switching to another artifact tool.

Guest and OAuth setup are selected explicitly through `invompt-local-beta-onboarding`; never infer or convert
Guest state, and preserve Guest as dormant when OAuth is selected. ChatGPT web is remote OAuth-only
and never uses local Guest setup or local device state.

The surface has exactly 16 operational tools. Invoice, settings, and client tools use the selected
Guest or registered OAuth connection. `create_account_claim_link` is the one Guest-only tool: call
it once only when the user explicitly asks to claim the active Guest workspace. Present its
`claimUrl` exactly once, state that it expires, and never log or repeat the URL. After browser
success, stop using the former Guest credential when it returns `GUEST_ACCOUNT_CLAIMED`.

## Create A Document

1. Read `invompt://docs/getting-started` once per session when available.
2. Before the first document, read `invompt://spec/invoml/v1` and `invompt://locales` when
   available. If a resource is unavailable, continue from this skill and the live tool schema.
3. Reuse relevant facts from earlier turns, even when the current message is a short follow-up or
   uses a different language.
4. Ask one consolidated question only when a calculation-critical value is genuinely missing,
   such as currency, quantity, or price. Optional identity, tax, address, contact, payment, and
   notes fields never block creation.
5. For an explicitly named recipient, call `list_clients` first when it is exposed:
   - auto-select only when `resolution.kind` is `exact_unique`;
   - when ambiguous, ask which candidate to use;
   - when none, ask one consolidated question: save and assign the client, or use recipient data
     only for this invoice;
   - never create a saved client silently as a side effect of `create_invoice`.
6. Draft valid InvoML:
   - use `"$invoml": "1.0"`;
   - put `documentType`, `number`, `issueDate`, `currency`, and `locale` inside `meta`;
   - treat `meta.number` as exact final authored data; if a final number is missing, ask for it
     instead of inventing a sequence or persisting a `DRAFT-*` value;
   - use the current local date when no issue date is provided;
   - normalize `meta.locale` as BCP 47 and preserve the user's content language;
   - use `invoice`, `quote`, or `estimate` according to user intent; use `quote` for pro formas;
   - put an explicitly provided recipient in `to.content`; never invent a generic `client` field;
   - keep billable work in `items` and let Invompt calculate totals;
   - use quantity `1` for an explicitly stated flat amount;
   - put an explicitly paid amount in root-level `prepaidAmount`, never inside `totals`;
   - use the standard `payment` block only when the live schema supports saved payment details;
   - issuer may be omitted; never invent issuer identity;
   - omit unknown facts rather than inventing identities, rates, tax data, addresses, or legal text;
   - omit visual template selection unless the user requests `standard`, `minimal`, or
     `professional` and the live schema supports it.
7. Call `create_invoice` with the serialized InvoML, a stable 8–128 character `idempotencyKey`,
   and the selected saved `clientId` when applicable. Reuse the key only for an identical retry.
8. Return the exact canonical number, status, amount, currency, due date, `invoiceId`, `version`,
   and hosted `url` supplied by Invompt. Creation is successful only after the tool compares the
   authored number with the response and performs canonical `get_invoice` read-back. If returned,
   use the friendly `guestName`. Never expose the underlying guest credential.

## Manage Existing Documents

- Retrieve canonical InvoML before editing when the current conversation does not already contain
  the latest document.
- Use `update_invoice`, not `create_invoice`, for revisions to an identified document.
- Ordinary updates preserve the canonical invoice number. Correct a wrong persisted number only
  with full corrected InvoML and explicit audited `numberCorrection: { from, reason }`.
- Put normal bank instructions in root `payment`. Add root `paymentAdvice` and its style
  order/block entries only when the user explicitly requests a detachable remittance stub.
- Send the complete revised InvoML and preserve fields the user did not ask to change.
- Send the latest invoice `version` as `expectedVersion` plus a stable 8–128 character
  `idempotencyKey` for update and archive. On version conflict, read again before retrying.
- Treat an update as successful only when `update_invoice` returns the canonical number, status,
  amount, currency, due date, `invoiceId`, version, and active hosted `url` verified by authorized
  `get_invoice` read-back. Never rely on a URL remembered by the host.
- If `get_invoice` reports no active hosted link, use `renew_invoice_link` with a stable
  idempotency key. Renewal rotates only the 72-hour public capability and does not revise the
  invoice or require `expectedVersion`.
- Treat archive as destructive even when implemented as a soft delete. Require an identified target
  and clear user authorization.
- Saved client writes require stable idempotency keys. Reuse a key only for the same retry.
- Use the latest client `version` as `expectedVersion` for updates and archive. Ask before allowing
  a duplicate or archiving.
- Client edits never rewrite historical invoices. To refresh one invoice, pass its client UUID to
  `update_invoice`; omit clientId to retain without resync, or use null to detach while preserving
  the current recipient snapshot.
- Settings updates are partial. Send only user-supplied fields to `update_settings`; omission means
  unchanged, while explicit null clears company name or currency. Never invent sender or payment
  information.

## Error Recovery

- Correct one obvious InvoML validation error and retry once.
- If required billing values remain missing, ask one concise consolidated question.
- If the MCP endpoint or required tool is unavailable, report the connection or capability error.
- Never expose API keys, OAuth tokens, headers, cookies, stack traces, or device identifiers.

## Hard Boundaries

- Never bypass MCP with direct Invompt REST calls.
- Never create a replacement PDF, document, site, code artifact, or filesystem output.
- Never launch Chromium, Puppeteer, or a PDF CLI for this workflow.
- Never silently switch to another MCP server or environment.
- Never include credentials, account IDs, claim IDs, nonces, or OAuth data in account-claim input or output.
- Return Invompt's hosted URL; the Web product owns preview and download/print.
