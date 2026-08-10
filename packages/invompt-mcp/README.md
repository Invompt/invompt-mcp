# Invompt MCP

`invompt-mcp` is a self-contained local-beta onboarding CLI and Guest stdio bridge for Invompt MCP. It ships portable skills for Claude Code and Codex; it does not contain invoice business logic, a database client, REST fallback, or an HTTP listener.

> **Prerelease:** this public-development, pre-1.0 source declares `0.11.0` for `next`. It makes no release, production, registry-availability, or fresh-host compatibility claim. Verify live registry state independently before relying on a package version.

## Local-beta scope

Supported local-beta hosts are macOS Claude Code and Codex. Their plugin manifests discover skills only; they deliberately contain no static `mcpServers` configuration because Guest and OAuth need different transports. Gemini CLI and Qwen Code manifest files are template-not-supported assets, not supported runtimes.

| Mode | Transport | Endpoint |
|---|---|---|
| Guest | stdio bridge | `https://mcp.invompt.com/mcp` |
| OAuth | native HTTPS MCP | `https://mcp.invompt.com/mcp` |

`http://localhost:3101/mcp` is the loopback development endpoint. It is not a public host-default configuration. ChatGPT web is separate and remote OAuth-only: it connects to the hosted endpoint and must never run local status/setup, use Guest mode, or inspect local device state.

This is a separate CLI/local-beta distribution. The Workspace Hub global consumer remains a single hosted HTTPS OAuth-only `invompt` provider; this package must not be used to add Guest credentials, static headers, or local-device state to that consumer configuration.

## Explicit setup

On first Invompt use, `invompt-onboarding` checks redacted status. When mode is undecided it asks, in the current conversation language, exactly whether the user wants **Guest** or **OAuth**, gives a brief explanation, and waits for an explicit choice.

For Codex, use the exact pinned CLI command after that choice:

```sh
npx --yes invompt-mcp@0.11.0 setup --host codex --mode guest
npx --yes invompt-mcp@0.11.0 setup --host codex --mode oauth
```

For Claude Code, use the same pinned package CLI rather than assuming an installed-cache path:

```sh
npx --yes invompt-mcp@0.11.0 setup --host claude-code --mode guest
npx --yes invompt-mcp@0.11.0 setup --host claude-code --mode oauth
```

Use the equivalent `status --json` command to inspect only redacted mode, backend, and binding status. This package has no postinstall prompt. It never packages a credential or writes one to a manifest or host configuration.

## State and switching

Guest credentials use macOS Keychain first: service `com.invompt.invompt-mcp`, account `guest-credential`. `--allow-file-fallback` is required before the restricted-permission plaintext fallback path `~/.invompt/guest-credential` (permissions `0600`) may be used. Non-secret state is `~/.invompt/auth-state.json` (permissions `0600` in directory `0700`).

Guest to OAuth switching leaves the Guest credential dormant. It never auto-converts or claims a Guest workspace. `logout --host codex` or `logout --host claude-code` removes the selected host configuration. `reset --yes` removes local state and attempts online Guest revocation; an offline revocation failure means copied credentials may remain valid and is reported as a warning.

## Migration and rollback

`0.11.0` adds explicit local-beta onboarding without migrating the Workspace Hub global OAuth consumer. Choose one local-beta mode. `--allow-file-fallback` is accepted only for Guest setup; unknown and duplicate flags fail closed. Roll back local-beta state with `logout --host …`, then use `reset --yes` only when removing local state and attempting Guest revocation. Restore the global consumer through its OAuth-only installer, not this package.

## Error handling and privacy

Offline/network failures and `5xx` responses are temporary: do not loop or silently retry credential issuance. A `401` Guest credential is invalid or revoked; use deliberate reset/recovery before another setup attempt, especially when the recorded secret backend is unavailable. A `429` must honor `Retry-After`. A host CLI error means setup needs reconciliation, not that the host is configured.

The package derives no hardware or device fingerprint and collects no serial data or MAC addresses. The server-issued Guest credential is the sole pseudonymous local identity; it is stored in Keychain by default and is never used to derive device identity. It bundles with no runtime dependencies, rejects redirects, and forwards JSON-RPC only for the selected connection mode.

## Development

Use Node 22.22.0 and npm 11.11.0:

```sh
npm ci
npm run check
```

`npm run check` builds, typechecks, lints, tests, scans source and packed artifacts, verifies the exact file allowlist, and checks an isolated tarball-only consumer. These local checks do not prove an external release or fresh-host verification.

## License

[MIT](LICENSE)
