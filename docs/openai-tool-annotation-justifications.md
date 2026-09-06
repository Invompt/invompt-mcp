# OpenAI tool annotation justifications

These values classify actual effects according to the current OpenAI plugin review guidance. A read-only tool never changes state. An open-world tool can change publicly visible internet state. A destructive tool can delete, overwrite, revoke, or otherwise cause an outcome that the exposed MCP surface cannot readily reverse.

| Tool | Read-only | Open world | Destructive | Justification |
|---|---:|---:|---:|---|
| `ping` | Yes | No | No | Reads private connection and workspace status only. |
| `list_invoices` | Yes | No | No | Lists invoices in the connected private workspace without changing state. |
| `get_invoice` | Yes | No | No | Retrieves one private workspace invoice and its current hosted URL without changing it. |
| `get_settings` | Yes | No | No | Retrieves private workspace defaults only. |
| `list_clients` | Yes | No | No | Searches saved clients inside the private workspace only. |
| `get_client` | Yes | No | No | Retrieves one saved client from the private workspace only. |
| `create_invoice` | No | Yes | No | Creates a new hosted document and publicly reachable review URL; it does not overwrite existing data. |
| `update_invoice` | No | Yes | Yes | Overwrites an existing hosted document, its template, recipient snapshot, or corrected number; the MCP surface exposes version protection but no revision rollback. |
| `archive_invoice` | No | No | No | Changes private list state through a soft delete; the invoice remains viewable and `unarchive_invoice` reverses the operation. |
| `unarchive_invoice` | No | No | No | Restores private list state without changing document content or publishing anything. |
| `renew_invoice_link` | No | Yes | Yes | Publishes a replacement hosted review URL and revokes the previous public capability URL. |
| `send_invoice_email` | No | Yes | No | Sends a server-rendered PDF of an existing invoice to an external email address; it does not overwrite or publish the invoice itself and returns only a delivery receipt. |
| `create_account_claim_link` | No | No | No | Creates a short-lived sensitive capability inside the first-party account-claim flow; it does not publish or overwrite user data. |
| `update_settings` | No | No | Yes | Overwrites private invoice defaults; omission is safe, but supplied fields have no exposed rollback. |
| `create_client` | No | No | No | Creates a saved client inside the private workspace without publishing or replacing existing data. |
| `update_client` | No | No | Yes | Overwrites supplied saved-client fields; version protection prevents stale writes, but no revision rollback is exposed. |
| `archive_client` | No | No | Yes | Soft-deletes a saved client from active private use. Historical invoice snapshots remain, but this MCP surface exposes no client restore operation. |
| `list_invoice_templates` | Yes | No | No | Lists safe reusable-template metadata in the private workspace without changing state. |
| `get_invoice_template` | Yes | No | No | Retrieves one immutable validated semantic template preset without changing state. |
| `preview_invoice_template_extraction` | Yes | No | No | Projects one immutable invoice revision into a checksum-bound safe preset without changing state. |
| `save_invoice_as_template` | No | No | No | Creates a reusable semantic preset in the private workspace; it does not publish or overwrite invoice data. |

Authoritative guidance: [OpenAI MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review#review-and-approval-faqs).
