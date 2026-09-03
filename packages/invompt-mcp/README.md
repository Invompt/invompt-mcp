# invompt-mcp

`invompt-mcp` is the local-beta onboarding CLI and Guest stdio bridge for Invompt MCP. It ships
portable skills for Claude Code and Codex and keeps host setup separate from the global `invompt`
consumer. It does not contain invoice business logic, persistence, or an HTTP listener.

The host integration targets Claude Code and Codex on macOS. The hosted MCP endpoint is
[`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp). ChatGPT web is a separate OAuth-only
consumer of that endpoint and does not run this CLI.

## Overview

Use this package when you want a local command to configure and inspect an Invompt MCP connection.
The setup flow keeps Guest and OAuth modes explicit, and status output stays redacted.

## Install

For the published prerelease channel, run the CLI without adding a global install:

```sh
npx --yes invompt-mcp@next setup --host codex --mode oauth
```

Replace `codex` with `claude-code`, or `oauth` with `guest`. The CLI configures only the
`invompt-local-beta` MCP identity. Check the registry metadata before relying on a feature that is
newer than the published channel.

## Commands

```text
invompt-mcp serve --host claude-code|codex
invompt-mcp setup --mode guest|oauth --host claude-code|codex [--allow-file-fallback]
invompt-mcp status [--json]
invompt-mcp logout --host claude-code|codex
invompt-mcp reset --yes
```

`serve` starts the Guest stdio bridge. `setup` selects Guest or OAuth and configures one host.
`status` prints redacted local state. `logout` disconnects one host. `reset --yes` removes local
authentication state and attempts Guest revocation.

## Connection modes

Guest mode uses a server-issued pseudonymous credential and the stdio bridge. OAuth mode configures
the host for the hosted HTTPS MCP endpoint and browser sign-in. The modes are intentionally
separate: selecting OAuth leaves any Guest credential dormant, and selecting Guest never converts
or claims it.

The packaged plugin identity is `invompt-local-beta`, with onboarding and invoice skills under the
same namespace. It does not own the global `invompt-invoice`, `invompt-export`, or `invompt-health`
discovery names.

## State and security

Guest credentials use the macOS Keychain service `com.invompt.invompt-mcp` and account
`guest-credential` by default. `--allow-file-fallback` is required before the restricted file
fallback at `~/.invompt/guest-credential` is used. Non-secret state is stored at
`~/.invompt/auth-state.json`. The CLI never puts credentials in a manifest or host configuration,
derives a hardware fingerprint, or follows HTTP redirects.

If a host command fails, setup records a reconciliation state and reports the error. A `401` means
that the Guest credential is invalid or revoked; a `429` must honor `Retry-After`. Do not retry
credential issuance silently or include credentials, tokens, or real invoice content in issues.

## Development

Use Node.js 22.22.0 and npm 11.11.0:

```sh
npm ci
npm run check
```

From the repository root, the focused package commands are:

```sh
npm run build --workspace=invompt-mcp
npm run typecheck --workspace=invompt-mcp
npm run lint --workspace=invompt-mcp
npm run test --workspace=invompt-mcp
npm run verify:pack --workspace=invompt-mcp
```

## License

[`MIT`](LICENSE)
