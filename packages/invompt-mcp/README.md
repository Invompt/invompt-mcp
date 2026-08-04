# Invompt MCP

`invompt-mcp` is a public-development, pre-1.0 self-contained stdio bridge. It forwards MCP JSON-RPC exactly once to the default loopback MCP transport at `http://localhost:3101/mcp` and forwards a server-issued `X-Invompt-Guest-Credential`. Operators may explicitly allow an exact HTTPS MCP origin; wildcards, paths, credentials, queries, fragments, and redirects remain rejected.

The package has no runtime dependencies and no REST client, product route client, database access, or network listener. It does not execute invoice tools and does not contain an invoice service or endpoint. Product code owns invoice business logic, InvoML validation and calculation, rendering, persistence, and hosted document links. The bridge is limited to stdio-to-exactly-trusted MCP transport and credential forwarding.

This repository candidate does not establish external registry availability or host compatibility. Verify registry metadata, integrity, and a fresh-host installation independently before relying on an install command. `next` is reserved for development builds and is not a production channel or support promise.

## Included assets

The packed artifact contains only the bridge, declared host manifests, selected skills and commands, licensing, [third-party notices](THIRD_PARTY_NOTICES.md), and the exact reviewed files. From a source checkout, `npm run verify:pack` enforces that allowlist and runs a tarball-only consumer test against an unreachable registry. The verification command is a source-repository gate; it is not advertised as an installed-package command.

The package exports `startBridge`, origin-policy helpers, credential persistence helpers, and the `./contracts` subpath. It does not publish the private workspace core or testkit packages.
