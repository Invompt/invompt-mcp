# invompt-mcp

[![npm](https://img.shields.io/npm/v/invompt-mcp?style=flat-square)](https://www.npmjs.com/package/invompt-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/invompt-mcp/ci.yml?style=flat-square)](https://github.com/Invompt/invompt-mcp/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**A self-contained stdio bridge for an Invompt MCP connection.**

`invompt-mcp` connects a host's stdio MCP transport to the configured Invompt MCP service. It
forwards MCP JSON-RPC messages once. It does not execute invoice tools, make REST calls, access a
database, or open a network listener. Product code owns invoice rules, InvoML validation and
calculation, rendering, persistence, and hosted links.

> **Prerelease:** version `0.10.0` is a public-development, pre-1.0 release on the `next` channel.
> Use `@next` explicitly. `latest` currently points to retired `0.4.1` and must not be used for
> this package.

## Install

```sh
npm install invompt-mcp@next
```

The package installs the `invompt-mcp` executable and can also be imported as a library. The host
must be configured through the official Invompt setup flow before starting the bridge; this README
does not contain endpoint or credential material.

## Quick start

Add the executable to the MCP host configuration used by your client:

```json
{
  "mcpServers": {
    "invompt": {
      "command": "invompt-mcp"
    }
  }
}
```

Start it directly when the host is already configured:

```sh
invompt-mcp
```

The bridge's default implementation target is the exact local transport
`http://localhost:3101/mcp`. This is a local host boundary, not a public service URL; remote use
requires an exact trusted origin and redirects are rejected.

## What is included

The published package is intentionally narrow:

- A self-contained `invompt-mcp` stdio executable.
- `startBridge()` and the transport/origin policy helpers from the root export.
- The `invompt-mcp/contracts` subpath for the shared MCP instructions.
- Host manifests, selected skills and commands, licensing, and third-party notices.

The public bridge has **no runtime dependencies** and does not import the workspace core at
runtime. `@invompt/mcp-core` and `@invompt/mcp-testkit` remain private workspace source for the
transport-neutral contract and test fakes; they are not npm install targets.

The bridge does not execute invoice tools. It only connects the host transport to the configured
MCP service, where the product owns the business operations.

## Architecture

```text
MCP client host  →  invompt-mcp stdio bridge  →  configured Invompt MCP service
                                               →  product-owned invoice operations
```

The package is not the private server, does not replace the product, and does not provide a public
HTTP endpoint.

## Security

- Use the official host setup to provision authentication; never place credentials in this README,
  source code, or a launch manifest.
- The bridge accepts only the fixed local transport by default or an explicitly trusted exact HTTPS
  origin.
- Wildcards, paths, credentials, queries, fragments, and redirects are rejected for remote origins.
- The package contains no invoice database client, REST fallback, or product business logic.

## Development

From the repository root:

```sh
npm ci
npm run check
```

`npm run check` builds the workspaces, runs type, lint, test, privacy, package-content, and
isolated tarball checks. The packaged README is checked as part of the release contract. Local
source checks do not prove external registry availability or host compatibility.

The `next` channel is for development builds and is not a production channel or support promise.

## License and contribution

- [MIT License](LICENSE)
- [Contributing guide](https://github.com/Invompt/invompt-mcp/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/Invompt/invompt-mcp/blob/main/SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
