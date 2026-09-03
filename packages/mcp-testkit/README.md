# @invompt/mcp-testkit

`@invompt/mcp-testkit` contains contract fixtures and service fakes for Invompt MCP integrations.
It keeps adapter tests aligned with the public MCP surface without requiring a live endpoint.

This workspace-only package is included in the public repository for source review and tests. It
is not an npm publish target and has no transport implementation dependency.

## Fixtures

The package exports these contract lists:

- `EXPECTED_TOOL_NAMES`: all 20 operational tool names in registration order.
- `OPERATIONAL_TOOL_NAMES`: the operational tool list used by contract checks.
- `EXPECTED_RESOURCE_NAMES`: `getting-started` and `invoml-spec`.
- `EXPECTED_PROMPT_NAMES`: `draft_invoice_invoml`.

It also exports `createServiceFake`, which returns an `InvomptService` whose methods fail clearly
until a test overrides the operation it needs.

## Usage

```ts
import { createServiceFake, EXPECTED_TOOL_NAMES } from '@invompt/mcp-testkit'

const service = createServiceFake({
  ping: async () => ({ status: 'ok', timestamp: new Date().toISOString(), provisioned: false }),
})

console.log(EXPECTED_TOOL_NAMES.length)
```

Use the fake for unit tests and use the exported name lists for discovery and registration parity
checks. Keep network, credential, and persistence behavior in the adapter-specific test suite.

## Development

From the repository root, use Node.js 22.22.0 and npm 11.11.0:

```sh
npm ci
npm run build --workspace=@invompt/mcp-testkit
npm run typecheck --workspace=@invompt/mcp-testkit
```

## License

[`MIT`](LICENSE)
