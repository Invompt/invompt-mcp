<div align="center">

# Invompt MCP

  <strong>Turn AI-host work into invoices you review before send.</strong>
  <br />
  Continue anonymously or OAuth via hosted MCP.
</div>

> **Prefer the hosted connector**
> Registry [`com.invompt/invompt`](https://glama.ai/mcp/connectors/com.invompt/invompt)
> -> [`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp)
> Continue anonymously | review-before-send | [www.invompt.com](https://www.invompt.com)
> Wellknown: [invompt-mcp](https://wellknown.network/agents/invompt-mcp)
> Local-beta/stdio in this repo is secondary.

<p align="center">
  <a href="https://mcp.invompt.com/mcp">Hosted MCP endpoint</a>
  |
  <a href="packages/invompt-mcp/README.md">CLI reference (secondary)</a>
  |
  <a href="packages/mcp-core/README.md">MCP contract</a>
</p>

Invompt MCP connects AI hosts to Invompt invoices. Prefer the hosted path above.
This repository also ships a pre-1.0 local-beta CLI, portable host skills, and a
Guest stdio bridge for Claude Code or Codex. Invoice rules, calculation,
persistence, and hosted document links remain part of the Invompt service.

## What it does

- Turns AI-host context into invoices, quotes, estimates, and pro formas you review
  before send.
- Lists and updates invoices and saved clients through the MCP contract.
- Hosted path: Continue anonymously or OAuth over HTTPS at mcp.invompt.com.
- Secondary local-beta path: Guest stdio bridge or hosted OAuth via this package.
- Keeps local setup state separate from the global hosted consumer.

This package uses the isolated `invompt-local-beta` identity. ChatGPT web connects
to the hosted endpoint with OAuth and does not run this local CLI.

## Quick start

**Hosted (preferred):** point your host at
[`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp), Continue anonymously
(or OAuth), create or review an invoice, then review before send.

**Local-beta (secondary):**

1. Choose a host and connection mode, then run the matching setup command. Use OAuth
   for a browser sign-in, or Guest for a server-issued pseudonymous local credential.

   ```sh
   npx --yes invompt-mcp@next setup --host codex --mode oauth
   # Replace codex with claude-code, or oauth with guest.
   ```

2. Restart the selected host so it discovers `invompt-local-beta`.

3. Ask the host to create or review an Invompt invoice.

## Connection modes

| Mode | What it uses | Choose it when |
| --- | --- | --- |
| Hosted | HTTPS MCP endpoint | Default product path (Continue anonymously / OAuth). |
| Guest | Local stdio bridge | Local-beta pseudonymous credential (secondary). |
| OAuth | Hosted HTTPS via this CLI | Local-beta browser sign-in setup (secondary). |

The bridge does not open a listener or implement invoice business logic. It forwards
JSON-RPC only through the selected connection and rejects HTTP redirects.

## Security

Guest credentials are stored in the macOS Keychain by default. The optional file
fallback requires an explicit flag and uses restricted local permissions. The CLI
does not place credentials in a plugin manifest or host configuration, derive a
hardware fingerprint, or collect serial and MAC data. Never paste credentials,
tokens, or real invoice content into a public issue.

Report a vulnerability through [GitHub private vulnerability reporting][security-report].

[security-report]: https://github.com/Invompt/invompt-mcp/security/advisories/new

## Resources

- [CLI and onboarding reference](packages/invompt-mcp/README.md)
- [Transport-neutral MCP contract](packages/mcp-core/README.md)
- [Contract fixtures and service fake](packages/mcp-testkit/README.md)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Hosted Invompt MCP endpoint](https://mcp.invompt.com/mcp)
- [www.invompt.com](https://www.invompt.com)

## License

[MIT](LICENSE)
