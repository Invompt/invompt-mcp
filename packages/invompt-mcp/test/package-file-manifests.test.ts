import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import { PACKAGE_FILE_MANIFESTS, verifyPackageFileManifest } from '../../../scripts/package-file-manifests.mjs'
import { assertPublishableWorkspacesCovered } from '../../../scripts/verify-package-files.mjs'

const workspaceRoot = resolve(import.meta.dirname, '../../..')

function packEntry(omittedPath?: string, extraPath?: string) {
  const paths = PACKAGE_FILE_MANIFESTS['invompt-mcp'].files.filter((path) => path !== omittedPath)
  if (extraPath) paths.push(extraPath)
  return { files: paths.map((path) => ({ path })) }
}

function regularFile() {
  return { isSymbolicLink: () => false }
}

describe('publishable package file manifests', () => {
  test('registers only invompt-mcp and keeps core and testkit private workspace source', () => {
    const rootPackage = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')) as {
      private?: boolean
    }
    const corePackage = JSON.parse(readFileSync(resolve(workspaceRoot, 'packages/mcp-core/package.json'), 'utf8')) as {
      private?: boolean
    }
    const testkitPackage = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'packages/mcp-testkit/package.json'), 'utf8'),
    ) as { private?: boolean }

    expect(rootPackage.private).toBe(true)
    expect(corePackage.private).toBe(true)
    expect(testkitPackage.private).toBe(true)
    expect(assertPublishableWorkspacesCovered()).toEqual(['invompt-mcp'])
    expect(Object.keys(PACKAGE_FILE_MANIFESTS)).toEqual(['invompt-mcp'])
    expect(PACKAGE_FILE_MANIFESTS['invompt-mcp'].files).toContain('THIRD_PARTY_NOTICES.md')
  })

  test('rejects an unexpected sensitive-file path without reading file contents', () => {
    expect(() =>
      verifyPackageFileManifest({
        packageName: 'invompt-mcp',
        packEntry: packEntry(undefined, 'dist/.env.production'),
        packageRoot: resolve(workspaceRoot, 'packages/invompt-mcp'),
        lstat: regularFile,
      }),
    ).toThrow('has unexpected files: dist/.env.production')
  })

  test('rejects a missing required bridge entry', () => {
    expect(() =>
      verifyPackageFileManifest({
        packageName: 'invompt-mcp',
        packEntry: packEntry('THIRD_PARTY_NOTICES.md'),
        packageRoot: resolve(workspaceRoot, 'packages/invompt-mcp'),
        lstat: regularFile,
      }),
    ).toThrow('is missing required files: THIRD_PARTY_NOTICES.md')
  })

  test('rejects a packed symbolic link', () => {
    expect(() =>
      verifyPackageFileManifest({
        packageName: 'invompt-mcp',
        packEntry: packEntry(),
        packageRoot: resolve(workspaceRoot, 'packages/invompt-mcp'),
        lstat: () => ({ isSymbolicLink: () => true }),
      }),
    ).toThrow('package manifest rejects symbolic links')
  })
})
