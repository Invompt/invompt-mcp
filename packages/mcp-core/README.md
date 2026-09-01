# @invompt/mcp-core

Private workspace source for the transport-neutral Invompt MCP discovery contract. It accepts an `InvomptService` implementation and contains no credential lookup, endpoint selection, filesystem persistence, or private transport implementation. It remains in the public repository for review and tests, but it is not an npm publish target.

The core exposes exactly 20 operational tools, including safe reusable invoice-template listing, reading, extraction preview, and save-from-invoice operations. Template extraction stores only validated semantic defaults with empty HTML/CSS; it never accepts arbitrary layout blobs or free-form invoice content. `create_account_claim_link` replaces the retired account-claim placeholder with an input-free Guest-account-only mutation that returns a short-lived browser URL. Transport mode is not account type: hosted OAuth Guest and legacy credential Guest may both invoke it, and the backend is authoritative for eligibility.

Authentication is adapter-owned: this core does not select or enforce Guest versus account mode.
The active backend enforces account eligibility. On explicit invocation the core calls the
service once, regardless of transport, and formats backend errors normally.
