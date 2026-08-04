import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PACKAGE_FILE_MANIFESTS, verifyPackageFileManifest } from './package-file-manifests.mjs'

const workspaceRoot = resolve(import.meta.dirname, '..')

export function assertPublishableWorkspacesCovered() {
  const publishablePackageNames = readdirSync(resolve(workspaceRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(workspaceRoot, 'packages', entry.name, 'package.json'))
    .map((packageJsonPath) => JSON.parse(readFileSync(packageJsonPath, 'utf8')))
    .filter((packageJson) => packageJson.private !== true)
    .map((packageJson) => packageJson.name)
    .sort()
  const manifestPackageNames = Object.keys(PACKAGE_FILE_MANIFESTS).sort()
  if (JSON.stringify(publishablePackageNames) !== JSON.stringify(manifestPackageNames)) {
    throw new Error('Package file manifests do not cover exactly every publishable workspace')
  }
  return publishablePackageNames
}

export function verifyPackedPackageFiles(packageName) {
  assertPublishableWorkspacesCovered()
  const manifest = PACKAGE_FILE_MANIFESTS[packageName]
  if (!manifest) throw new Error(`No package file manifest is registered for ${packageName}`)
  const packed = spawnSync('npm', ['pack', '--workspace', packageName, '--dry-run', '--json', '--ignore-scripts'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  if (packed.error) throw packed.error
  if (packed.status !== 0) throw new Error(`${packageName} npm pack failed with exit ${packed.status}: ${packed.stderr.trim()}`)
  const entries = JSON.parse(packed.stdout)
  if (!Array.isArray(entries) || entries.length !== 1) throw new Error(`${packageName} npm pack returned an invalid JSON report`)
  return verifyPackageFileManifest({
    packageName,
    packEntry: entries[0],
    packageRoot: resolve(workspaceRoot, manifest.directory),
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPackage = process.argv[2]
  const packageNames = requestedPackage ? [requestedPackage] : Object.keys(PACKAGE_FILE_MANIFESTS)
  assertPublishableWorkspacesCovered()
  const results = packageNames.map((packageName) => verifyPackedPackageFiles(packageName))
  process.stdout.write(`${JSON.stringify({ status: 'passed', packages: results }, null, 2)}\n`)
}
