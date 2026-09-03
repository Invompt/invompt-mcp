# @invompt/mcp-core

`@invompt/mcp-core` composes the transport-neutral Invompt MCP contract. It accepts an
`InvomptService` implementation and registers the server surface; it does not choose an
endpoint, read credentials, persist state, or implement a transport.

This workspace-only package is included in the public repository for source review and contract
tests. It is not an npm publish target.

## Purpose

The package separates MCP protocol composition from adapters such as an HTTP client, a private
server integration, or a test fake. The service interface is the dependency boundary:

```ts
import { createMcpServer } from '@invompt/mcp-core'

const server = createMcpServer(service, '0.11.4')
```

`service` must implement the exported `InvomptService` interface. The `version` argument becomes
the MCP server version reported during initialization.

## Contract surface

The server registers 20 operational tools:

- Invoice lifecycle: create, list, read, update, archive, unarchive, and renew hosted links.
- Invoice templates: list, read, preview extraction, and save from an invoice.
- Clients: list, read, create, update, and archive.
- Workspace operations: ping, read or update settings, and create an explicit account-claim link.

It also registers the `getting-started` and `invoml-spec` resources and the
`draft_invoice_invoml` prompt. Tool names and fixture expectations are exported by
`@invompt/mcp-testkit`.

## Integration

Implement the service methods in an adapter, then pass the adapter to `createMcpServer`:

```ts
import { createMcpServer } from '@invompt/mcp-core'

const mcp = createMcpServer(adapter, '0.11.4')
// Connect mcp to the adapter's chosen MCP transport.
```

Authentication and account eligibility remain adapter and backend responsibilities. The core
calls an account-claim operation once when the host explicitly invokes it and formats the result;
it does not accept credentials or account identifiers for that operation.

## Design boundaries

- InvoML validation, calculation, persistence, and hosted URLs belong to the service implementation.
- Credential lookup, OAuth, Guest storage, endpoint selection, and transport lifecycle belong to an adapter.
- Template projections contain validated semantic defaults; reusable HTML and CSS are empty by contract.
- Create and mutation inputs use stable idempotency keys where the type contract requires them.

## Development

From the repository root, use Node.js 22.22.0 and npm 11.11.0:

```sh
npm ci
npm run build --workspace=@invompt/mcp-core
npm run typecheck --workspace=@invompt/mcp-core
npm run test --workspace=@invompt/mcp-core
```

## License

[`MIT`](LICENSE)
