# Security policy

## Supported status

This is public-development, pre-1.0 software. Published artifacts and checks support distribution and audit workflows; they do not establish production availability, support coverage, or a service-level commitment.

## Reporting a vulnerability

Use this repository's GitHub **Private vulnerability reporting** feature. Do not open a public issue for a suspected vulnerability and do not include credentials, customer data, invoice content, or access tokens in a report.

Include the affected revision or package integrity, a minimal reproduction, impact, and any relevant mitigation. The Invompt security role will acknowledge and coordinate the report through GitHub private vulnerability reporting.

## Scope

This repository is a separate local-beta CLI and stdio-bridge distribution. It is not the Workspace Hub's global consumer plugin: that consumer remains a single hosted HTTPS OAuth provider and must not gain Guest credentials, static headers, or local-device state through this package.

Guest mode forwards only to `https://mcp.invompt.com/mcp` after an explicit local choice; the loopback endpoint is development-only. OAuth mode uses the host-native OAuth flow at the same hosted endpoint. Reports involving choice/mode isolation, credential storage or revocation, host configuration, redirect/origin checks, packed artifacts, release automation, and dependency provenance are in scope.
