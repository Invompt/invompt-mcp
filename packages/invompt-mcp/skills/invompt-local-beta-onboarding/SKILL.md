---
name: invompt-local-beta-onboarding
description: Set up or check the local-beta Invompt MCP connection before any Invompt tool use. Use on the first Invompt request in Claude Code or Codex; select Guest or OAuth explicitly in the user's language. ChatGPT web is remote OAuth-only and never uses local setup.
---

# Invompt Onboarding

Run this workflow before calling an Invompt MCP tool for the first time in a conversation. Keep
the user in control: do not configure a host, issue a Guest credential, log in, or reset state
until the user has explicitly chosen a mode.

## 1. Identify the host

- In Claude Code or Codex, this is a local-beta macOS workflow.
- In ChatGPT web, use remote OAuth only. Do not run local status, inspect device state, read local
  paths, request a Guest credential, or use a local bridge. Tell the user that ChatGPT connects to
  `https://mcp.invompt.com/mcp` through its remote OAuth flow.
- Gemini CLI and Qwen Code package files are templates only and are not supported runtimes.

## 2. Check redacted state first (local hosts only)

Use the command for the current host. `status --json` reports only mode, Guest status/backend, and
host bindings; it does not print the credential.

This local-beta flow owns only the host server `invompt-local-beta`. Never remove, log out, or
reconfigure the separate global `invompt` provider; it remains hosted OAuth-only.

- Claude Code: `npx --yes invompt-mcp@0.11.0 status --json`
- Codex: `npx --yes invompt-mcp@0.11.0 status --json`

Treat a current host binding as usable only when its status is active, `binding.mode ===
selectedMode`, and `binding.epoch === state.epoch`. Do not treat active status alone as usable. If
state is undecided or the binding needs reconciliation, continue below.

## 3. Ask exactly one mode question when undecided

Ask exactly this one choice question in the user's current conversation language, adapting only
the language, not the choices or meaning:

> Would you like **Guest** (a server-issued pseudonymous local credential stored in macOS Keychain) or **OAuth**
> (sign in through Invompt in your browser)?

Briefly explain that Guest uses a local stdio bridge and OAuth uses the hosted HTTPS MCP endpoint.
Then wait for an explicit `Guest` or `OAuth` choice. Do not infer a choice from an invoice request,
previous account details, or an existing dormant Guest credential.

## 4. Configure only the chosen mode

Run exactly one deterministic setup command for the current local host after the explicit choice.

| Host | Guest | OAuth |
|---|---|---|
| Claude Code | `npx --yes invompt-mcp@0.11.0 setup --host claude-code --mode guest` | `npx --yes invompt-mcp@0.11.0 setup --host claude-code --mode oauth` |
| Codex | `npx --yes invompt-mcp@0.11.0 setup --host codex --mode guest` | `npx --yes invompt-mcp@0.11.0 setup --host codex --mode oauth` |

The default Guest secret store is macOS Keychain. If Keychain is unavailable and the user
explicitly accepts a file fallback, append `--allow-file-fallback`; otherwise stop and report the
Keychain error. Never place a Guest credential in a manifest, environment variable, prompt, or
host configuration.

Switching from Guest to OAuth leaves the Guest credential dormant; it is not sent through OAuth.
OAuth setup uses native HTTPS and browser login. Claiming a Guest workspace is a separate,
explicit, Guest-only browser-link flow.

## 5. Handle expected failures safely

- Offline/network failure or `5xx`: leave state unchanged where possible; report temporary
  unavailability and do not loop or silently retry credential issuance.
- `401`: the Guest credential is invalid or revoked; direct the user to deliberate reset/recovery
  before another setup attempt, especially when the recorded secret backend is unavailable. Do not
  copy credentials between hosts.
- `429`: respect `Retry-After` when supplied; do not retry before that time.
- Host CLI failure: report that setup needs reconciliation; do not say the host is configured.

For a deliberate local logout use `logout --host claude-code` or `logout --host codex`. For a full
local reset, require `reset --yes`; it attempts Guest revocation, removes local state, and cleans
host configuration. A failed online revocation may leave copied credentials valid, so report the
warning accurately.

## 6. Continue

After a confirmed active `invompt-local-beta` binding, load `invompt-local-beta-invoice` for invoice work and follow live MCP tool
schemas. The package exposes exactly 16 operational tools.

## 7. Claim an active Guest workspace only when asked

When the user explicitly asks to move the active Guest workspace into an authenticated account,
call `create_account_claim_link` once while still connected as Guest. The tool takes no input; do
not ask for or send credentials, account IDs, claim IDs, nonces, or OAuth data. Present the returned
`claimUrl` exactly once, explain that it expires at `expiresAt`, and never log, repeat, or retain the
URL. The user completes sign-in and confirmation in the browser. Do not call this tool through
OAuth. After a successful claim, the former Guest credential returns `GUEST_ACCOUNT_CLAIMED`;
stop using it and reconcile local onboarding state instead of retrying.
