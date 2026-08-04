import { lstatSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const BRIDGE_FILES = [
  '.agents/skills/invompt-invoice/agents/openai.yaml',
  '.agents/skills/invompt-invoice/references/mcp-surface.md',
  '.agents/skills/invompt-invoice/SKILL.md',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.codex/agents/invoice-operator.toml',
  '.cursor/rules/invompt-invoice.mdc',
  '.nvmrc',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'agents/invoice-operator.agent.md',
  'commands/invoice.md',
  'commands/invompt/invoice.toml',
  'dist/bridge.d.ts',
  'dist/bridge.js',
  'dist/contracts.d.ts',
  'dist/contracts.js',
  'dist/error.d.ts',
  'dist/error.js',
  'dist/guest-credential.d.ts',
  'dist/guest-credential.js',
  'dist/index.d.ts',
  'dist/index.js',
  'gemini-extension.json',
  'package.json',
  'plugin.json',
  'qwen-extension.json',
  'runtime-support.json',
  'skills/invompt-invoice/agents/openai.yaml',
  'skills/invompt-invoice/references/mcp-surface.md',
  'skills/invompt-invoice/SKILL.md',
]

// Only invompt-mcp is publishable. Private workspace packages retain source and tests
// in this repository but intentionally have no npm artifact contract.
export const PACKAGE_FILE_MANIFESTS = Object.freeze({
  'invompt-mcp': Object.freeze({ directory: 'packages/invompt-mcp', files: Object.freeze(BRIDGE_FILES) }),
})

function manifestError(packageName, label, paths) {
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right))
  return new Error(`${packageName} package manifest ${label}: ${sortedPaths.join(', ')}`)
}

function assertSafePackedPath(packageName, path) {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\\') || path.startsWith('/') || path.split('/').includes('..')) {
    throw new Error(`${packageName} package manifest contains an unsafe packed path`)
  }
}

function pathIsInside(path, root) {
  const pathFromRoot = relative(root, path)
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..')
}

export function verifyPackageFileManifest({ packageName, packEntry, packageRoot, lstat = lstatSync }) {
  const manifest = PACKAGE_FILE_MANIFESTS[packageName]
  if (!manifest) throw new Error(`No package file manifest is registered for ${packageName}`)
  if (!Array.isArray(packEntry?.files)) throw new Error(`${packageName} npm pack report has no file inventory`)

  const packedPaths = packEntry.files.map(({ path }) => path)
  for (const path of packedPaths) assertSafePackedPath(packageName, path)
  const uniquePackedPaths = new Set(packedPaths)
  if (uniquePackedPaths.size !== packedPaths.length) throw new Error(`${packageName} npm pack report contains duplicate paths`)

  const expectedPaths = new Set(manifest.files)
  const unexpectedPaths = [...uniquePackedPaths].filter((path) => !expectedPaths.has(path))
  if (unexpectedPaths.length > 0) throw manifestError(packageName, 'has unexpected files', unexpectedPaths)
  const missingPaths = [...expectedPaths].filter((path) => !uniquePackedPaths.has(path))
  if (missingPaths.length > 0) throw manifestError(packageName, 'is missing required files', missingPaths)

  const resolvedRoot = resolve(packageRoot)
  for (const path of packedPaths) {
    let sourcePath = resolve(resolvedRoot, path)
    while (true) {
      if (!pathIsInside(sourcePath, resolvedRoot)) throw new Error(`${packageName} packed path escapes its package root`)
      if (lstat(sourcePath).isSymbolicLink()) throw new Error(`${packageName} package manifest rejects symbolic links: ${path}`)
      if (sourcePath === resolvedRoot) break
      sourcePath = resolve(sourcePath, '..')
    }
  }

  return {
    package: packageName,
    manifest: `exact-${manifest.files.length}-file-allowlist`,
    packedFileCount: packedPaths.length,
  }
}
