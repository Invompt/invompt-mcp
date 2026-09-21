# Invompt MCP

Create invoices from your AI assistant and review them before sending.

Start without creating an account. Create one later and keep all your invoices.

## Quick start

1. Follow the [installation guide](https://invompt.com/install) for your AI assistant.
2. Complete the OAuth connection in your browser. Choose **Continue without an account**,
   **Sign in**, or **Create account**. **Deny** remains available.
3. Return to your assistant and ask it to create an invoice.

Hosted MCP server URL:

```text
https://mcp.invompt.com/mcp
```

The hosted connection uses OAuth, including when you start without an account. Your AI tool handles
the authorization flow. The hosted path is preferred; this repository's local-beta CLI and Guest
stdio bridge are secondary development options.

## What it does

- Create invoices, quotes, estimates, and pro formas from a conversation.
- Review a hosted invoice and revise the selected document.
- Reuse saved clients and business settings.
- Open the hosted invoice to download its PDF.

## Try it

> Create an invoice for Alex: 10 hours of design work at $80 per hour.

> Change the payment terms to 14 days.

Review the document and its details before sending it to your client.

## Connection modes

The hosted path is the recommended OAuth connection. The [local-beta CLI reference](packages/invompt-mcp/README.md)
covers the secondary local Guest stdio bridge and its separate setup.

## Accounts and access

When you're ready, ask your connected assistant to help you create an Invompt account and keep your
invoices. Open the link it provides and complete the account flow to keep the invoices made through
your current connection. Creating an account elsewhere does not automatically find unrelated guest
histories. Sending invoices by email requires a registered account.

## Security

The hosted connection uses your AI tool's OAuth flow. The local-beta CLI stores Guest credentials in
the macOS Keychain by default; see its security guidance before using that secondary path.

## Resources

- [Hosted MCP endpoint](https://mcp.invompt.com/mcp)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)

- [Installation guide](https://invompt.com/install)
- [Local-beta CLI reference](packages/invompt-mcp/README.md)
- [MCP contract](packages/mcp-core/README.md)
- [Contract testkit](packages/mcp-testkit/README.md)
- [Website](https://www.invompt.com)
- [Support](https://www.invompt.com/contact)
- [Privacy](https://www.invompt.com/privacy)
- [Security reporting](https://github.com/Invompt/invompt-mcp/security/advisories/new)

## License

[MIT](LICENSE)
