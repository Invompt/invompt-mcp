<div align="center">

# Invompt MCP

  <strong>Invoice tools for the AI hosts you already use.</strong>
  <br />
  Create, review, and manage Invompt invoices through an MCP connection.
</div>

<p align="center">
  <a href="packages/invompt-mcp/README.md">CLI reference</a>
  |
  <a href="packages/mcp-core/README.md">MCP contract</a>
  |
  <a href="https://mcp.invompt.com/mcp">Hosted MCP endpoint</a>
</p>

Invompt MCP is the local-beta distribution for connecting Claude Code or Codex to Invompt. It
provides a small setup CLI, portable host skills, and a Guest stdio bridge. Invoice rules,
calculation, persistence, and hosted document links remain part of the Invompt service.

## What it does

- Turns natural-language or structured requests into invoices, quotes, estimates, and pro formas.
- Lists and updates invoices and saved clients through the MCP contract.
- Supports two deliberate connection modes: a local Guest bridge or hosted OAuth over HTTPS.
- Keeps local setup state separate from the global hosted consumer.

This repository is a pre-1.0 local-beta package. It is not the global hosted consumer. The global
consumer uses the `invompt` connection name and hosted OAuth; this package uses the isolated
`invompt-local-beta` identity. ChatGPT web connects to the hosted endpoint with OAuth and does not
run this local CLI.

## Quick start

1. Choose a host and connection mode, then run the matching setup command. Use OAuth for a browser
   sign-in, or Guest for a server-issued pseudonymous local credential.

   ```sh
   npx --yes invompt-mcp@next setup --host codex --mode oauth
   # Replace codex with claude-code, or oauth with guest.
   ```

2. Restart the selected host so it discovers `invompt-local-beta`.

3. Ask the host to create or review an Invompt invoice.

## Connection modes

| Mode | What it uses | Choose it when |
| --- | --- | --- |
| Guest | Local stdio bridge | You want a server-issued pseudonymous credential. |
| OAuth | Hosted HTTPS MCP endpoint | You want browser-based sign-in. |

The bridge does not open a listener or implement invoice business logic. It forwards JSON-RPC only
through the selected connection and rejects HTTP redirects.

## Security

Guest credentials are stored in the macOS Keychain by default. The optional file fallback requires
an explicit flag and uses restricted local permissions. The CLI does not place credentials in a
plugin manifest or host configuration, derive a hardware fingerprint, or collect serial and MAC
data. Never paste credentials, tokens, or real invoice content into a public issue.

Report a vulnerability through [GitHub private vulnerability reporting][security-report].

[security-report]: https://github.com/Invompt/invompt-mcp/security/advisories/new

## Resources

- [CLI and onboarding reference](packages/invompt-mcp/README.md)
- [Transport-neutral MCP contract](packages/mcp-core/README.md)
- [Contract fixtures and service fake](packages/mcp-testkit/README.md)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Hosted Invompt MCP endpoint](https://mcp.invompt.com/mcp)

## Development

Use Node.js 22.22.0 and npm 11.11.0, as declared by the repository. From the repository root:

```sh
npm ci
npm run check
```

The check builds the workspaces, runs typechecking, linting, tests, privacy scanning, and package
verification. It is a source-quality check; it does not certify a registry artifact or host setup.

## License

[MIT](LICENSE)
