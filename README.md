# Invompt MCP

[![npm next](https://img.shields.io/npm/v/invompt-mcp/next?style=flat-square&label=npm%20next)](https://www.npmjs.com/package/invompt-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/invompt-mcp/ci.yml?style=flat-square&label=tests)](https://github.com/Invompt/invompt-mcp/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Bring Invompt invoice tools into MCP-compatible AI clients.**

Invompt MCP is a pre-1.0 TypeScript workspace for the public `invompt-mcp` stdio bridge and its
transport-neutral contract. The bridge connects an MCP client to a configured Invompt MCP service
without moving invoice business logic into the client package.

> **Prerelease:** this source declares `invompt-mcp@0.10.2` for the `next` channel. Verify the
> live registry before relying on that version. The artifact is for distribution and audit; it is
> not a public install/run promise.

## Installation

There is no supported external registry installation flow in Phase 1. Maintained hosts use the
private configurator and direct transport at `http://localhost:3101/mcp`. The npm artifact on
`next` is a distribution and audit boundary, not a replacement for that setup.

Node.js 18 or newer is required.

## Maintained runtime shape

The private host configurator owns executable discovery and credential materialization. The bridge
connects to `http://localhost:3101/mcp` by default; users must not synthesize a launch manifest or
copy a Guest credential from this repository.

```text
MCP client  →  invompt-mcp  →  configured Invompt MCP service  →  invoice operations
```

## Design

The public bridge has a deliberately narrow responsibility:

- Forward MCP JSON-RPC between stdio and Streamable HTTP.
- Allow the fixed loopback transport or an explicitly trusted exact HTTPS origin.
- Reject wildcards, paths, credentials, queries, fragments, and redirects.
- Bundle the runtime into a self-contained package with no runtime dependencies.

It does not execute invoice tools, make REST calls, access a database, or expose a network
listener. Invompt product code owns invoice rules, InvoML validation and calculation, rendering,
persistence, and hosted document links.

## Workspace

| Package | Purpose | Published to npm |
|---|---|---|
| `invompt-mcp` | Self-contained stdio bridge and portable host assets | Yes, on `next` |
| `@invompt/mcp-core` | Transport-neutral MCP contract source | No |
| `@invompt/mcp-testkit` | Contract fixtures and service fakes | No |

The package README shown on npm lives at
[`packages/invompt-mcp/README.md`](packages/invompt-mcp/README.md).

## Local development

Use Node.js 22.22.0 and npm 11.11.0 for the canonical release checks:

```sh
npm ci
npm run check
```

The check builds every workspace, typechecks, lints, tests, scans tracked and packed assets for
secrets, verifies third-party notices, and checks the packed-file allowlist plus an offline
tarball-only consumer.

Local source checks do not prove external registry availability or host compatibility. The `next`
channel contains development builds and is not a production channel or support promise.

## Security and contribution

- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [MIT License](LICENSE)

Publishing is an external authorization and is never performed by local validation.
