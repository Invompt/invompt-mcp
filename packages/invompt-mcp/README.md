# Invompt MCP

[![npm next](https://img.shields.io/npm/v/invompt-mcp/next?style=flat-square&label=npm%20next)](https://www.npmjs.com/package/invompt-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/invompt-mcp/ci.yml?style=flat-square&label=tests)](https://github.com/Invompt/invompt-mcp/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Bring Invompt invoice tools into MCP-compatible AI clients.**

`invompt-mcp` is a self-contained stdio bridge between an MCP client and a configured Invompt MCP
service. It forwards MCP JSON-RPC messages without moving invoice business logic into the client.

> **Prerelease:** this public-development, pre-1.0 source declares version `0.10.3` for the
> `next` channel. Verify live registry state before relying on it. Operational Phase 1 is
> supported only through maintained private adapter configuration and direct transport.

## Installation

There is no supported external registry installation flow in Phase 1. Maintained hosts use the
private adapter configuration and direct transport. The npm tarball on `next` is an audit and
distribution artifact, not a public setup contract.

Node.js 18 or newer is required.

## Maintained runtime shape

The private host configurator owns executable discovery and credential materialization. The bridge
connects to `http://localhost:3101/mcp` by default. Do not construct a launch manifest or copy a
Guest credential from the public artifact.

```text
MCP client  →  invompt-mcp  →  configured Invompt MCP service  →  invoice operations
```

## What the bridge does

- Connects stdio-based MCP clients to Invompt's Streamable HTTP transport.
- Forwards each JSON-RPC message once in either direction.
- Exposes `startBridge()` for programmatic integrations.
- Ships host manifests, agent skills, and shared MCP instructions in one package.
- Runs with no runtime dependencies after bundling.

## What it does not do

The bridge does not execute invoice tools, make REST calls, access a database, or open a network
listener. Invompt owns invoice rules, InvoML validation and calculation, rendering, persistence,
and hosted document links.

The package is not the Invompt server and does not provide a public HTTP endpoint.

## Auditable library surface

```ts
import { startBridge } from 'invompt-mcp'

// Maintainer-owned host configuration calls this after establishing private configuration.
await startBridge()
```

The root export also includes transport policy and Guest credential helpers for maintained hosts.
Shared MCP instructions are available from `invompt-mcp/contracts`. These exports document the
artifact boundary; they do not establish a supported external setup flow.

## Security model

- The fixed loopback transport at `http://localhost:3101/mcp` is allowed by default.
- Remote transports require an explicitly trusted, exact HTTPS origin.
- Wildcards, paths, credentials, queries, fragments, and redirects are rejected.
- Credentials stay in the official host setup; do not place them in source code or launch
  manifests.
- There is no invoice database client, REST fallback, or product business logic in the package.

## Package contents

The npm package intentionally contains only the public bridge and its portable host assets.
`@invompt/mcp-core` and `@invompt/mcp-testkit` are private workspace packages used to compose and
verify the transport-neutral contract; they are not npm install targets.

## Development

From the repository root:

```sh
npm ci
npm run check
```

`npm run check` builds every workspace and runs type, lint, test, privacy, package-content, and
isolated tarball checks. Local source checks do not prove external registry availability or host compatibility.

The `next` channel contains development builds and is not a production channel or support promise.

## Resources

- [Invompt integrations](https://invompt.com/integrations)
- [Source repository](https://github.com/Invompt/invompt-mcp)
- [Contributing guide](https://github.com/Invompt/invompt-mcp/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/Invompt/invompt-mcp/blob/main/SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

[MIT](LICENSE)
