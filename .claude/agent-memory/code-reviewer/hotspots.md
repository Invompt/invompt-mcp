---
name: hotspots
description: Invompt areas that produce the most review findings and the failure type each tends to have
metadata:
  type: project
---

- `backend/api/internal-mcp/` — authorization and transport contract issues: rate-limit semantics,
  missing idempotency, error-code allowlist mapping, missing no-store headers on responses that
  carry personal data. The dense single-line style makes validation gaps easy to miss.
- OAuth scope wiring — a new scope must land in `backend/types/models/oauth.ts`,
  `frontend/oauth/scope-labels.ts`, `messages/en.json` (two blocks: consent detail and short label),
  `tests/fixtures/mcp-tool-scope-policy-v1.json`, plus `content/docs/api/authentication.mdx` and
  `content/docs/mcp/*.mdx`. The two `content/docs` surfaces are the ones usually forgotten and are
  already stale for the templates scopes.
- `tests/fixtures/mcp-core-output-contract.json` vendors only a subset of MCP tool output schemas,
  so a new tool's response shape is often unenforced against the MCP package.

See [[recurring-patterns]].
