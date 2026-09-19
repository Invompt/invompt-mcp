<div align="center">

# Invompt MCP

  <strong>Turn AI-host work into invoices you review before send — Continue anonymously or OAuth via hosted MCP.</strong>
</div>

> **Start here (product path)**  
> Continue anonymously · [`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp) · review-before-send  
> Registry: [`com.invompt/invompt`](https://glama.ai/mcp/connectors/com.invompt/invompt) · Site: [www.invompt.com](https://www.invompt.com) · Wellknown: [invompt-mcp](https://wellknown.network/agents/invompt-mcp)  
> Local-beta / stdio in this repo is **secondary** (Claude Code / Codex setup). Prefer the hosted connector for the default path.

<p align="center">
  <a href="https://mcp.invompt.com/mcp">Hosted MCP</a>
  |
  <a href="https://www.invompt.com">www.invompt.com</a>
  |
  <a href="packages/invompt-mcp/README.md">Local-beta CLI (secondary)</a>
  |
  <a href="packages/mcp-core/README.md">MCP contract</a>
</p>

## What it does

- Turns AI-host work into invoices, quotes, estimates, and pro formas you **review before send**.
- Connect via hosted MCP: Continue anonymously or OAuth over HTTPS.
- Lists and updates invoices and saved clients through the MCP contract.
- Optionally, this repository also ships a **local-beta** setup CLI, portable host skills, and a Guest stdio bridge for Claude Code / Codex (secondary to hosted).

Invoice rules, calculation, persistence, and hosted document links remain part of the Invompt service.

## Quick start (hosted — preferred)

1. Point your AI host at the hosted MCP endpoint: [`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp).
2. Continue anonymously (or sign in with OAuth when your host supports it).
3. Ask the host to create or review an Invompt invoice — then review before send.

Registry id: `com.invompt/invompt`. More: [www.invompt.com](https://www.invompt.com) · [Wellknown agent](https://wellknown.network/agents/invompt-mcp).

## Local-beta / stdio (secondary)

This repository is a pre-1.0 local-beta package. It is **not** the global hosted consumer. The global consumer uses the `invompt` connection name and hosted OAuth; this package uses the isolated `invompt-local-beta` identity. ChatGPT web connects to the hosted endpoint and does not run this local CLI.

1. Choose a host and connection mode, then run the matching setup command. Use OAuth for a browser sign-in, or Guest for a server-issued pseudonymous local credential.

   ```sh
   npx --yes invompt-mcp@next setup --host codex --mode oauth
   # Replace codex with claude-code, or oauth with guest.
   ```

2. Restart the selected host so it discovers `invompt-local-beta`.

3. Ask the host to create or review an Invompt invoice.

### Connection modes (local-beta)

| Mode | What it uses | Choose it when |
| --- | --- | --- |
| Guest | Local stdio bridge | You want a server-issued pseudonymous credential. |
| OAuth | Hosted HTTPS MCP endpoint | You want browser-based sign-in. |

The bridge does not open a listener or implement invoice business logic. It forwards JSON-RPC only through the selected connection and rejects HTTP redirects.

## Security

Guest credentials are stored in the macOS Keychain by default. The optional file fallback requires an explicit flag and uses restricted local permissions. The CLI does not place credentials in a plugin manifest or host configuration, derive a hardware fingerprint, or collect serial and MAC data. Never paste credentials, tokens, or real invoice content into a public issue.

Report a vulnerability through [GitHub private vulnerability reporting][security-report].

[security-report]: https://github.com/Invompt/invompt-mcp/security/advisories/new

## Resources

- [Hosted Invompt MCP endpoint](https://mcp.invompt.com/mcp)
- [www.invompt.com](https://www.invompt.com)
- [Registry `com.invompt/invompt`](https://glama.ai/mcp/connectors/com.invompt/invompt)
- [Wellknown agent](https://wellknown.network/agents/invompt-mcp)
- [CLI and onboarding reference (local-beta)](packages/invompt-mcp/README.md)
- [Transport-neutral MCP contract](packages/mcp-core/README.md)
- [Contract fixtures and service fake](packages/mcp-testkit/README.md)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)

## Development

Use Node.js 22.22.0 and npm 11.11.0, as declared by the repository. From the repository root:

```sh
npm ci
npm run check
```

The check builds the workspaces, runs typechecking, linting, tests, privacy scanning, and package verification. It is a source-quality check; it does not certify a registry artifact or host setup.

## License

[MIT](LICENSE)
