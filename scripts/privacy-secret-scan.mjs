import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(import.meta.dirname, '..')
const excludedDirectories = new Set(['.git', 'dist', 'node_modules', 'release-artifacts'])

const upstreamLicenseEmailParts = Object.freeze([
  ['aaa', 'bzfx.net'],
  ['andrews_henry', 'yahoo.com'],
  ['ben', 'jsonschema.dev'],
  ['bh7', 'sanger.ac.uk'],
  ['chalkerx', 'gmail.com'],
  ['doug', 'somethingdoug.com'],
  ['espen', 'hovlandsdal.com'],
  ['fgaliegue', 'gmail.com'],
  ['floatdrop', 'gmail.com'],
  ['gary.court', 'gmail.com'],
  ['gregsdennis', 'yahoo.com'],
  ['hello', 'blakeembrey.com'],
  ['hello', 'moxy.studio'],
  ['henry', 'cloudflare.com'],
  ['jed.watson', 'me.com'],
  ['kevinmartensson', 'gmail.com'],
  ['kris', 'sitepen.com'],
  ['luffgd', 'gmail.com'],
  ['me', 'jongleberry.com'],
  ['shtylman+expressjs', 'gmail.com'],
  ['shtylman', 'gmail.com'],
  ['sindresorhus', 'gmail.com'],
  ['tj', 'learnboost.com'],
  ['tj', 'vision-media.ca'],
  ['troygoode', 'gmail.com'],
  ['whitequark', 'whitequark.org'],
])

// Every exception is path-, finding-, and exact-value-scoped. Never exempt a whole file.
export const FALSE_POSITIVE_ALLOWLIST = Object.freeze(
  upstreamLicenseEmailParts.map(([local, domain]) => ({
    path: 'packages/invompt-mcp/THIRD_PARTY_NOTICES.md',
    label: 'email address',
    value: `${local}@${domain}`,
    reason: 'verbatim upstream license notice retains its reviewed copyright contact detail',
  })),
)

const joined = (...parts) => parts.join('')

const forbiddenPatterns = Object.freeze([
  { label: 'private key', pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g },
  { label: 'GitHub token', pattern: /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { label: 'npm token', pattern: /\bnpm_[A-Za-z0-9]{20,}\b/g },
  { label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { label: 'Invompt guest credential', pattern: /\binv_gd_v1\.[a-z0-9]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}\b/g },
  { label: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { label: 'owner personal name', pattern: new RegExp(`\\b(?:${joined('Ari', 'el')}|${joined('Mar', 'ti')})\\b`, 'gi') },
  { label: 'owner business system', pattern: new RegExp(`\\b(?:${joined('Tra', 'dify')}|${joined('E', 'vo')})\\b`, 'gi') },
  { label: 'owner-derived invoice number', pattern: new RegExp(`\\b${joined('IV', '00049')}\\b`, 'g') },
  { label: 'owner-derived invoice amount', pattern: new RegExp(`\\b${joined('126', '72')}(?:\\.00)?\\b`, 'g') },
  { label: 'owner-derived currency', pattern: new RegExp(`\\b(?:${joined('N', 'ZD')}|${joined('New', ' Zealand')})\\b`, 'gi') },
  { label: 'personal local path', pattern: new RegExp(joined('/Users/', 'ari', 'el'), 'gi') },
  { label: 'private infrastructure reference', pattern: new RegExp(`\\b${joined('supa', 'base')}\\b`, 'gi') },
])

export function sourceFiles(directory = workspaceRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (excludedDirectories.has(entry.name)) return []
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() ? [path] : []
  })
}

function isAllowed(relativePath, label, value) {
  if (label === 'email address' && value.toLowerCase().endsWith('.example.invalid')) return true
  return FALSE_POSITIVE_ALLOWLIST.some(
    (entry) => entry.path === relativePath && entry.label === label && entry.value === value,
  )
}

export function scanText(relativePath, text) {
  const findings = new Set()
  for (const { label, pattern } of forbiddenPatterns) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      if (!isAllowed(relativePath, label, match[0])) findings.add(`${relativePath}: ${label}`)
    }
  }
  return [...findings]
}

function packedPaths() {
  const packed = spawnSync('npm', ['pack', '--workspace=invompt-mcp', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  if (packed.status !== 0) throw new Error(`Cannot inspect packed assets: ${packed.stderr.trim()}`)
  const entries = JSON.parse(packed.stdout)
  if (!Array.isArray(entries) || entries.length !== 1 || !Array.isArray(entries[0]?.files)) {
    throw new Error('npm pack did not return one packed file inventory')
  }
  return entries[0].files.map(({ path }) => resolve(workspaceRoot, 'packages/invompt-mcp', path))
}

function scan(paths) {
  return paths.flatMap((path) => {
    const relativePath = relative(workspaceRoot, path)
    const text = readFileSync(path, 'utf8')
    return [...scanText(relativePath, text), ...scanText(`${relativePath}#filename`, relativePath)]
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requested = new Set(process.argv.slice(2))
  const sourceRequested = requested.size === 0 || requested.has('--source')
  const packedRequested = requested.has('--packed')
  if (![...requested].every((argument) => argument === '--source' || argument === '--packed')) {
    throw new Error('Usage: node scripts/privacy-secret-scan.mjs [--source] [--packed]')
  }
  const findings = [...(sourceRequested ? scan(sourceFiles()) : []), ...(packedRequested ? scan(packedPaths()) : [])]
  if (findings.length > 0) throw new Error(`Secret or private material detected:\n${findings.join('\n')}`)
  process.stdout.write(
    `${JSON.stringify({ status: 'passed', scopes: [sourceRequested && 'source', packedRequested && 'packed'].filter(Boolean), syntheticEmailRule: '*.example.invalid', falsePositiveAllowlist: FALSE_POSITIVE_ALLOWLIST.map(({ path, label, value, reason }) => ({ path, label, value, reason })) })}\n`,
  )
}
