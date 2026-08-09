# @invompt/mcp-core

Private workspace source for the transport-neutral Invompt MCP discovery contract. It accepts an `InvomptService` implementation and contains no credential lookup, endpoint selection, filesystem persistence, or private transport implementation. It remains in the public repository for review and tests, but it is not an npm publish target.

Phase 1 has 15 operational tools. `approve_account_claim` is discoverable only as a non-operational Phase 2 placeholder; its handler fails closed and must not invoke an `InvomptService` implementation.

Authentication is adapter-owned: this core does not select or enforce Guest versus account mode.
The currently supported public Phase 1 deployment uses a Guest adapter; registered-account
authentication and account-claim execution are not operational in that deployment.
