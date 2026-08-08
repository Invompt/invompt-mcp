# Invompt MCP

Invompt MCP is a public-development, pre-1.0 workspace for an invoice-focused MCP bridge. It contains three source packages:

- `@invompt/mcp-core` is private workspace source for the transport-neutral MCP contract.
- `@invompt/mcp-testkit` is private workspace source for contract fixtures and service fakes.
- `invompt-mcp` is the only npm publish target: a self-contained stdio bridge.

The bridge relays MCP JSON-RPC once to the default loopback transport at `http://localhost:3101/mcp`. It does not execute invoice tools, make REST calls, access a database, or expose a network listener. An operator may explicitly allow an exact HTTPS MCP origin; wildcards, paths, credentials, queries, fragments, and redirects remain rejected. Invompt product code owns invoice business logic, InvoML validation and calculation, rendering, persistence, and hosted document links.

This repository is a release candidate, not a claim that a registry package is available. Before any install instruction is relied on, independently verify the package name, version, tarball integrity, and supported-host behavior from the external registry. The `next` dist-tag is a development channel only; it is not a production channel or a support commitment.

## Local validation

Use Node 22.22.0 and npm 11.11.0:

```sh
npm ci
npm run check
```

The check builds each workspace, typechecks, lints, tests, scans tracked and packed assets for secrets, verifies deterministic third-party notices, and checks the exact packed-file allowlist plus an offline tarball-only consumer.

## Release boundary

Only `invompt-mcp` may be published. The release workflow accepts only the exact `v0.10.1` tag, rejects an already-published `invompt-mcp@0.10.1`, validates one build/test/pack artifact, verifies its SHA-256 and SHA-512 after isolated download, and uses npm trusted publishing through the GitHub Actions `npm` environment. Publishing remains an external authorization and is not performed by local validation.

See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
