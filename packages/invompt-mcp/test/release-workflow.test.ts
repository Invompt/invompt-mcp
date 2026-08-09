import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const workspaceRoot = resolve(import.meta.dirname, '../../..')

describe('npm trusted publishing workflow contract', () => {
  test('publishes exactly the verified invompt-mcp 0.10.2 artifact through OIDC', () => {
    const workflow = readFileSync(resolve(workspaceRoot, '.github/workflows/publish.yml'), 'utf8')
    const rootPackage = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')) as {
      private?: boolean
    }
    const publicPackage = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'packages/invompt-mcp/package.json'), 'utf8'),
    ) as {
      name?: string
      version?: string
      private?: boolean
    }

    expect(rootPackage.private).toBe(true)
    expect(publicPackage).toMatchObject({ name: 'invompt-mcp', version: '0.10.2' })
    expect(publicPackage.private).not.toBe(true)
    expect(workflow).toContain('- v0.10.2')
    expect(workflow).toContain("github.ref == 'refs/tags/v0.10.2'")
    expect(workflow).toContain("\n    if: github.ref == 'refs/tags/v0.10.2'")
    expect(workflow).not.toContain("\n  if: github.ref == 'refs/tags/v0.10.2'")
    expect(workflow).not.toContain('workflow_dispatch')
    expect(workflow).toContain('permissions: {}')
    expect(workflow).toContain('environment: npm')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('node-version: 22.22.0')
    expect(workflow).toContain('npm@11.11.0')
    expect(workflow).toContain(`npm view "invompt-mcp@\${PACKAGE_VERSION}" version --json`)
    expect(workflow).toContain('E404|404 Not Found')
    expect(workflow).toContain('sha256sum --check release-artifacts/SHA256SUMS')
    expect(workflow).toContain('sha512sum --check release-artifacts/SHA512SUMS')
    expect(workflow).toContain('m.integrity!==integrity')
    expect(workflow).toContain('digest-mismatch: error')
    expect(workflow).toContain(
      'npm publish ./release-artifacts/invompt-mcp-0.10.2.tgz --access public --tag next --ignore-scripts',
    )
    expect(workflow).not.toContain('--provenance')
    expect(workflow).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./)
  })
})
