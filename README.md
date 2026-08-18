# Invompt MCP

Invompt MCP is a pre-1.0, local-beta package for onboarding Claude Code and Codex to Invompt invoice tools. It provides portable skills, a setup CLI, and a Guest stdio bridge; Invompt retains invoice rules, persistence, rendering, and hosted document links.

> This source prepares `invompt-mcp@0.11.2` for the `next` channel only. It makes no release, production, registry-availability, or fresh-host compatibility claim. Verify external state independently before relying on any registry artifact.

## Supported local-beta hosts

Local beta is scoped to macOS Claude Code and Codex. Their package manifests expose skills only; they do not install a static MCP transport because the user must choose the connection mode first.

| Mode | Transport | Use when |
|---|---|---|
| Guest | Local stdio bridge to `https://mcp.invompt.com/mcp` | You explicitly choose a server-issued pseudonymous local credential. |
| OAuth | Native HTTPS MCP at `https://mcp.invompt.com/mcp` | You explicitly choose browser sign-in. |

The local loopback development endpoint is `http://localhost:3101/mcp`; it is for development, not a public host-default configuration. Gemini CLI and Qwen Code files are templates only and are not supported local-beta runtimes.

ChatGPT web is separate: it is remote OAuth-only at `https://mcp.invompt.com/mcp`. It must never run local status/setup, use a Guest bridge, or inspect local device state.

This repository's CLI is a separate local-beta distribution. It configures only `invompt-local-beta`; setup, logout, reset, and reconciliation never remove or modify `invompt`. The Workspace Hub global consumer remains one hosted HTTPS OAuth-only `invompt` provider.

## Setup

Before an Invompt MCP call, the onboarding skill checks redacted status. If the mode is undecided, it asks exactly whether you want **Guest** or **OAuth** in the current conversation language and waits for your explicit choice.

For Codex, run one chosen command:

```sh
npx --yes invompt-mcp@0.11.2 setup --host codex --mode guest
npx --yes invompt-mcp@0.11.2 setup --host codex --mode oauth
```

For Claude Code, use the same pinned package CLI rather than assuming an installed-cache path:

```sh
npx --yes invompt-mcp@0.11.2 setup --host claude-code --mode guest
npx --yes invompt-mcp@0.11.2 setup --host claude-code --mode oauth
```

Use `status --json` through the same current-host command to inspect redacted state. There is no postinstall prompt and no credential in a manifest or host configuration.

The resulting MCP server is named `invompt-local-beta` on both hosts. Keep the normal global `invompt` provider separate and OAuth-only.

Plugin and skill discovery use the same isolated namespace: plugin `invompt-local-beta`, with skills `invompt-local-beta-onboarding` and `invompt-local-beta-invoice`. The package does not discover as global plugin `invompt` or as global skill `invompt-invoice`, `invompt-export`, or `invompt-health`.

Guest is Keychain-first on macOS (`com.invompt.invompt-mcp` / `guest-credential`). Only when you explicitly permit the fallback may setup add `--allow-file-fallback`; the fallback is restricted-permission plaintext at `~/.invompt/guest-credential` (mode `0600`). Non-secret local state is `~/.invompt/auth-state.json` (mode `0600` in a `0700` directory).

Switching Guest to OAuth leaves the Guest secret dormant. It is never auto-converted, claimed, or merged into an account. Use `logout --host codex` or `logout --host claude-code` for a deliberate host logout. `reset --yes` removes local state and attempts Guest revocation; if revocation cannot reach the service, copied credentials may remain valid and the CLI reports that warning.

Transport mode is separate from account type: hosted OAuth Guest and legacy credential Guest are both Guest principals. An explicit account-claim request calls the claim tool once; the backend decides eligibility. After an OAuth Guest claim, the grant remains connected and revalidates registered state; after a legacy Guest claim, the old credential fails with `GUEST_ACCOUNT_CLAIMED`.

## Migration and rollback

`0.11.2` adds nullable update-link recovery: a committed `update_invoice` can report `url: null` with `linkState: unavailable` when capability lookup loses a renewal race, so renew the link without repeating the update. It does not migrate an existing global OAuth-only consumer. Select one local-beta mode deliberately. `--allow-file-fallback` is valid only with `setup --mode guest`, and unknown or duplicate flags are rejected. To roll back local-beta state, first run `logout --host …`; use `reset --yes` only when you also intend to remove local authentication state and attempt Guest revocation. Restore the Workspace Hub consumer through its own OAuth-only installer, not this CLI.

## Failures and privacy

- Offline/network failures and `5xx` responses are temporary failures; do not loop or silently retry credential issuance.
- `401` means a Guest credential is invalid or revoked; use deliberate reset/recovery before another setup attempt, especially when the recorded secret backend is unavailable.
- `429` respects `Retry-After`; do not retry before it.
- A host CLI error leaves setup needing reconciliation; do not claim the host is configured.

Invompt MCP derives no hardware or device fingerprint and collects no serial data or MAC addresses. The server-issued Guest credential is the sole pseudonymous local identity; it is stored in Keychain by default and is never used to derive device identity. It has no runtime dependencies after bundling, opens no listener, and does not execute invoice business logic. It forwards JSON-RPC only through the explicitly selected transport and rejects HTTP redirects.

## Development verification

Use Node.js 22.22.0 and npm 11.11.0 for the canonical package gates:

```sh
npm ci
npm run check
```

The checks build, typecheck, lint, test, scan source and packed artifacts for secrets/privacy regressions, verify the exact package allowlist, and test an isolated tarball-only consumer. Local checks do not prove an external release or fresh-host installation.
