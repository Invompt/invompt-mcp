# @invompt/mcp-core

Private workspace source for the transport-neutral Invompt MCP discovery contract. It accepts an `InvomptService` implementation and contains no credential lookup, endpoint selection, filesystem persistence, or private transport implementation. It remains in the public repository for review and tests, but it is not an npm publish target.

The core exposes exactly 16 operational tools. `create_account_claim_link` replaces the retired account-claim placeholder with an input-free Guest-only mutation that returns a short-lived browser URL.

Authentication is adapter-owned: this core does not select or enforce Guest versus account mode.
The active adapter enforces authentication mode. Guest claim-link creation is rejected for OAuth
before any product call, and a successfully claimed Guest credential subsequently fails closed.
