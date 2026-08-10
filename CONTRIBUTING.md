# Contributing to Invompt MCP

Thanks for helping improve this public-development, pre-1.0 project.

## Before opening a pull request

1. Keep changes focused and avoid adding customer data, real invoice amounts, client names, credentials, or generated private artifacts.
2. Preserve the self-contained stdio bridge boundary: no product REST fallback, database access, or network listener belongs in `invompt-mcp`.
3. Keep `@invompt/mcp-core` and `@invompt/mcp-testkit` private workspace packages; only `invompt-mcp` is publishable.
4. Use Node 22.22.0 and npm 11.11.0, then run `npm ci` and `npm run check`.
5. Keep this CLI/local-beta lane separate from the Workspace Hub global consumer: the global consumer is hosted OAuth-only. Do not add Guest secrets, static authorization headers, local endpoints, or a second normal consumer provider to its configuration.

## Documentation and testing

Update the exact packed-file allowlist and tests when a public package asset changes. Regenerate `packages/invompt-mcp/THIRD_PARTY_NOTICES.md` from the locked bundled dependency inventory and keep the privacy/secret scan allowlist narrowly path-scoped.

Do not claim registry availability, production readiness, runtime support, or publication without independent external verification. The Invompt maintainer role reviews contributions and release changes through GitHub.

CLI parsing is a security boundary: reject unknown and duplicate flags, and keep `--allow-file-fallback` exclusive to explicit Guest setup. Add a focused negative test when changing a command or its flags.
