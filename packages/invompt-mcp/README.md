# Invompt MCP

`invompt-mcp` is a self-contained local-beta onboarding CLI and Guest stdio bridge for Invompt MCP. It ships portable skills for Claude Code and Codex; it does not contain invoice business logic, a database client, REST fallback, or an HTTP listener.

> **Prerelease:** this public-development, pre-1.0 source declares `0.11.2` for `next`. It makes no release, production, registry-availability, or fresh-host compatibility claim. Verify live registry state independently before relying on a package version.

## Local-beta scope

Supported local-beta hosts are macOS Claude Code and Codex. Their plugin manifests discover skills only; they deliberately contain no static `mcpServers` configuration because Guest and OAuth need different transports. Gemini CLI and Qwen Code manifest files are template-not-supported assets, not supported runtimes.

| Mode | Transport | Endpoint |
|---|---|---|
| Guest | stdio bridge | `https://mcp.invompt.com/mcp` |
| OAuth | native HTTPS MCP | `https://mcp.invompt.com/mcp` |

`http://localhost:3101/mcp` is the loopback development endpoint. It is not a public host-default configuration. ChatGPT web is separate and remote OAuth-only: it connects to the hosted endpoint and must never run local status/setup, use Guest mode, or inspect local device state.

This is a separate CLI/local-beta distribution. It configures only `invompt-local-beta`; setup, logout, reset, and reconciliation never remove or modify `invompt`. The Workspace Hub global consumer remains a single hosted HTTPS OAuth-only `invompt` provider.

## Explicit setup

On first local-beta Invompt use, `invompt-local-beta-onboarding` checks redacted status. When mode is undecided it asks, in the current conversation language, exactly whether the user wants **Guest** or **OAuth**, gives a brief explanation, and waits for an explicit choice.

For Codex, use the exact pinned CLI command after that choice:

```sh
npx --yes invompt-mcp@0.11.2 setup --host codex --mode guest
npx --yes invompt-mcp@0.11.2 setup --host codex --mode oauth
```

For Claude Code, use the same pinned package CLI rather than assuming an installed-cache path:

```sh
npx --yes invompt-mcp@0.11.2 setup --host claude-code --mode guest
npx --yes invompt-mcp@0.11.2 setup --host claude-code --mode oauth
```

Use the equivalent `status --json` command to inspect only redacted mode, backend, and binding status. This package has no postinstall prompt. It never packages a credential or writes one to a manifest or host configuration.

Both hosts name this package's connection `invompt-local-beta`. The normal global `invompt` connection remains separate and OAuth-only.

The packaged plugin identity is also `invompt-local-beta`; its only skills are `invompt-local-beta-onboarding` and `invompt-local-beta-invoice`. It does not own or package the global `invompt-invoice`, `invompt-export`, or `invompt-health` discovery names.

## State and switching

Guest credentials use macOS Keychain first: service `com.invompt.invompt-mcp`, account `guest-credential`. `--allow-file-fallback` is required before the restricted-permission plaintext fallback path `~/.invompt/guest-credential` (permissions `0600`) may be used. Non-secret state is `~/.invompt/auth-state.json` (permissions `0600` in directory `0700`).

Guest to OAuth switching leaves the Guest credential dormant. It never auto-converts or claims a Guest workspace. `logout --host codex` or `logout --host claude-code` removes the selected host configuration. `reset --yes` removes local state and attempts online Guest revocation; an offline revocation failure means copied credentials may remain valid and is reported as a warning.

Transport mode is separate from account type: hosted OAuth Guest and legacy credential Guest are both Guest principals. An explicit account-claim request calls the claim tool once; the backend decides eligibility. After an OAuth Guest claim, the OAuth grant remains connected and subsequent operations revalidate registered state. After a legacy Guest claim, the old credential fails with `GUEST_ACCOUNT_CLAIMED`.

## Migration and rollback

`0.11.2` adds nullable update-link recovery: a committed `update_invoice` can report `url: null` with `linkState: unavailable` when capability lookup loses a renewal race, so renew the link without repeating the update. It does not migrate the Workspace Hub global OAuth consumer. Choose one local-beta mode. `--allow-file-fallback` is accepted only for Guest setup; unknown and duplicate flags fail closed. Roll back local-beta state with `logout --host …`, then use `reset --yes` only when removing local state and attempting Guest revocation. Restore the global consumer through its OAuth-only installer, not this package.

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
