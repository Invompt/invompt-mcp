# Invompt MCP

[![CI status][ci-badge]][ci]
[![npm @next version][npm-badge]][npm]
[![MCP Registry listing][registry-badge]][registry]
[![Hosted MCP connector score on Glama][glama-badge]][glama]
[![Awesome Remote MCP listing][awesome-badge]][awesome]
[![MIT License][license-badge]][license]

Create and manage invoices from a conversation with your AI assistant. Review every detail before
you share a document with a client.

**[Install Invompt for your AI assistant](https://invompt.com/install)**

Start without an account. Create one later to keep your invoices.

## Quick start

1. Open the [installation guide](https://invompt.com/install) and choose your AI assistant.
2. Connect to Invompt in your browser. Choose **Continue without an account**, **Sign in**, or
   **Create account**. You can also **Deny** the connection.
3. Ask your assistant to draft an invoice, then review it before sharing.

The hosted connection uses OAuth, including when you start without an account. Your AI assistant
handles the authorization flow.

## From conversation to invoice

1. **Describe the work.** Include the client, service, quantity, and rate; add tax or payment terms
   when needed.
2. **Review the draft.** Check the client, line items, totals, and dates. Ask for changes in the same
   conversation.
3. **Choose what happens next.** Open the hosted invoice to download its PDF. Sending by email
   requires a registered account.

> Draft an invoice from the project details we just discussed. Set payment terms to 14 days.

## What it does

Invompt creates invoices, quotes, estimates, and pro formas from a conversation. It can revise a
selected document and reuse saved clients and business settings.

## Hosted connection

Use the hosted MCP server at:

```text
https://mcp.invompt.com/mcp
```

The hosted OAuth connection is the recommended way to get started.

## Connection modes

The repository's local-beta CLI and Guest stdio bridge are secondary development options. See the
[local-beta CLI reference](packages/invompt-mcp/README.md) for developer setup details.

## Accounts and access

You can begin without an account. When you're ready, ask your connected assistant to help create an
Invompt account and keep invoices made through your current connection. Open the link it provides
and complete the account flow. Creating an account elsewhere does not automatically find unrelated
guest histories. Sending invoices by email requires a registered account.

## Security

The hosted connection uses your AI assistant's OAuth flow. The local-beta CLI stores Guest
credentials in the macOS Keychain by default; read its security guidance before using that option.

## Resources

- [Installation guide](https://invompt.com/install)
- [Hosted MCP endpoint](https://mcp.invompt.com/mcp)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Local-beta CLI reference](packages/invompt-mcp/README.md)
- [MCP contract](packages/mcp-core/README.md)
- [Contract testkit](packages/mcp-testkit/README.md)
- [Website](https://www.invompt.com)
- [Support](https://www.invompt.com/contact)
- [Privacy](https://www.invompt.com/privacy)
- [Security reporting](https://github.com/Invompt/invompt-mcp/security/advisories/new)

## License

[MIT](LICENSE)

[ci-badge]: https://github.com/Invompt/invompt-mcp/actions/workflows/ci.yml/badge.svg?branch=main
[ci]: https://github.com/Invompt/invompt-mcp/actions/workflows/ci.yml
[npm-badge]: https://img.shields.io/npm/v/invompt-mcp/next?label=npm%20%40next
[npm]: https://www.npmjs.com/package/invompt-mcp?activeTab=versions
[registry-badge]: https://img.shields.io/badge/MCP%20Registry-listed-brightgreen
[registry]: https://registry.modelcontextprotocol.io/v0.1/servers/com.invompt%2Finvompt/versions/latest
[glama-badge]: https://glama.ai/mcp/connectors/com.invompt/invompt/badges/score.svg
[glama]: https://glama.ai/mcp/connectors/com.invompt/invompt
[awesome-badge]: https://img.shields.io/badge/Awesome%20Remote%20MCP-Listed-brightgreen
[awesome]: https://github.com/punkpeye/awesome-remote-mcp-servers#finance
[license-badge]: https://img.shields.io/github/license/Invompt/invompt-mcp
[license]: https://github.com/Invompt/invompt-mcp/blob/main/LICENSE
