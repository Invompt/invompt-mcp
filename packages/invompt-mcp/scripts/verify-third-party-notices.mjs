import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(packageRoot, '../..')
const lockfile = JSON.parse(readFileSync(resolve(workspaceRoot, 'package-lock.json'), 'utf8'))
const packageLockEntries = lockfile.packages ?? {}

function normalizeNoticeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd()
}

// These are bundled into dist/index.js by esbuild. The resolver below follows each
// locked production dependency so notices remain complete when either root changes.
const BUNDLED_PRODUCTION_ROOTS = Object.freeze(['@modelcontextprotocol/sdk', 'zod'])

function packageKeyForDependency(parentKey, dependencyName) {
  let current = parentKey
  while (true) {
    const nested = current ? `${current}/node_modules/${dependencyName}` : `node_modules/${dependencyName}`
    if (packageLockEntries[nested]) return nested
    const marker = '/node_modules/'
    const index = current.lastIndexOf(marker)
    if (index === -1) return `node_modules/${dependencyName}`
    current = current.slice(0, index)
  }
}

function packageNameFromKey(key) {
  const marker = 'node_modules/'
  return key.slice(key.lastIndexOf(marker) + marker.length)
}

function bundledPackages() {
  const pending = BUNDLED_PRODUCTION_ROOTS.map((name) => `node_modules/${name}`)
  const visited = new Set()
  const packages = []
  while (pending.length > 0) {
    const key = pending.pop()
    if (visited.has(key)) continue
    visited.add(key)
    const entry = packageLockEntries[key]
    if (!entry) throw new Error(`Bundled production dependency is absent from package-lock.json: ${key}`)
    packages.push({
      key,
      name: entry.name ?? packageNameFromKey(key),
      version: entry.version,
      license: entry.license ?? 'UNKNOWN',
      noticeFiles: readdirSync(resolve(workspaceRoot, key), { withFileTypes: true })
        .filter(
          (file) =>
            file.isFile() && /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(file.name),
        )
        .map((file) => ({
          name: file.name,
          text: normalizeNoticeText(readFileSync(resolve(workspaceRoot, key, file.name), 'utf8')),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    })
    for (const dependencyName of Object.keys(entry.dependencies ?? {}).sort().reverse()) {
      pending.push(packageKeyForDependency(key, dependencyName))
    }
  }
  return [...new Map(packages.map((entry) => [`${entry.name}@${entry.version}`, entry])).values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
  )
}

export function renderThirdPartyNotices() {
  const entries = bundledPackages()
  for (const entry of entries) {
    if (entry.license === 'UNKNOWN') throw new Error(`Unknown bundled license: ${entry.name}@${entry.version}`)
    if (entry.noticeFiles.length === 0) {
      throw new Error(`Bundled dependency has no redistributable license or notice file: ${entry.name}@${entry.version}`)
    }
  }
  return [
    '# Third-party notices',
    '',
    'This deterministic notice set covers every locked production dependency bundled into `dist/index.js` from the declared bundle roots `@modelcontextprotocol/sdk` and `zod`.',
    'It is generated from `package-lock.json` and the exact upstream license and notice files installed by `npm ci`.',
    'The license content below is preserved for redistribution compliance with only line endings and trailing whitespace normalized; update this file only through the source verifier.',
    '',
    ...entries.flatMap(({ key, name, version, license, noticeFiles }) => [
      `## ${name}@${version} — ${license}`,
      '',
      `Locked path: \`${key}\``,
      '',
      ...noticeFiles.flatMap((notice) => [
        `### ${notice.name}`,
        '',
        '~~~text',
        notice.text,
        '~~~',
        '',
      ]),
    ]),
  ].join('\n')
}

const expected = renderThirdPartyNotices()
const noticesPath = resolve(packageRoot, 'THIRD_PARTY_NOTICES.md')
const command = process.argv[2] ?? '--check'
if (command === '--stdout') {
  process.stdout.write(expected)
} else if (command === '--write') {
  writeFileSync(noticesPath, expected)
  process.stdout.write(`Updated ${noticesPath}\n`)
} else if (command === '--check') {
  let actual = ''
  try {
    actual = readFileSync(noticesPath, 'utf8')
  } catch {
    throw new Error('THIRD_PARTY_NOTICES.md is missing; regenerate it from package-lock.json')
  }
  if (actual !== expected) throw new Error('THIRD_PARTY_NOTICES.md does not match the locked bundled production dependency inventory')
} else {
  throw new Error(`Unsupported third-party notice verifier command: ${command}`)
}
