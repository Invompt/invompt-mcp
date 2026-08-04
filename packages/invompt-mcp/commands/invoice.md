---
description: Create or manage an Invompt invoice, quote, estimate, or pro forma from a natural-language request
argument-hint: <billing request in any language>
---

Handle this request through the Invompt MCP server:

`$ARGUMENTS`

Load the `invompt-invoice` skill, infer whether the user wants to create, retrieve, list, update,
archive, inspect settings, or check status, and call the matching MCP tool. Reuse relevant facts
from the conversation. Respond in the user's language and return the hosted Invompt URL after
creation.

For a named recipient, search saved clients first. Auto-select only one exact unique match. Ask
which client when ambiguous. When none, ask once whether to save and assign or use recipient data
only on this invoice; never save a client silently.
