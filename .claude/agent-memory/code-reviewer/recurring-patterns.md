---
name: recurring-patterns
description: Violations that show up repeatedly in Invompt product reviews, with the module where they cluster
metadata:
  type: project
---

Patterns seen across Invompt product reviews. Verify against the current diff before citing.

- **Rate-limit `unavailable` collapsed into `allowed === false`.** The repo contract in
  `backend/security/rate-limiter.ts` makes `unavailable` distinct from an exhausted window:
  hosted execution must answer 503, never 429. `allowManagedMcpOperation` and the Web send route
  both check `unavailable` first; new call sites of `checkDistributedRateLimit` tend to forget it.
  **Why:** a 429 tells a client to back off and retry the same way, hiding an infrastructure outage.
  **How to apply:** on every new `checkDistributedRateLimit` call, require an explicit
  `unavailable` branch before the `!allowed` branch.
- **New managed MCP mutating tool without `idempotencyKey`.** Every other mutating tool in
  `backend/api/internal-mcp/tool-managed-adapter.ts` requires `isIdempotencyKey`. Tools added later
  skip it. **Why:** MCP hosts retry on timeouts, and non-idempotent side effects duplicate.
  **How to apply:** flag any new managed tool whose accepted field set lacks `idempotencyKey`.
- **New OAuth scope added to `VALID_SCOPES` without refreshing stored `applications.default_scopes`.**
  `backend/services/oauth/oauth-authorization-service.ts` hard-rejects a requested scope absent from
  the application row. **How to apply:** ask for the data or migration step whenever a scope is added.

See [[hotspots]] and [[calibration]].
