#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(import.meta.dirname, '..')

export const README_DOCUMENTS = Object.freeze({
  'README.md': {
    profile: 'root',
    maxLines: 100,
    maxLineLength: 120,
    requiredSections: [/^(?:what it does|overview)$/i, /^quick start$/i, /^connection modes$/i, /^security$/i, /^resources$/i, /^license$/i],
    requiredLinks: [
      'packages/invompt-mcp/README.md',
      'packages/mcp-core/README.md',
      'packages/mcp-testkit/README.md',
      'https://mcp.invompt.com/mcp',
      'security/advisories/new',
      'LICENSE',
    ],
  },
  'packages/invompt-mcp/README.md': {
    profile: 'cli',
    maxLines: 180,
    maxLineLength: 112,
    requiredSections: [/^install$/i, /^commands$/i, /^connection modes$/i, /^state and security$/i, /^development$/i, /^license$/i],
    requiredLinks: ['https://mcp.invompt.com/mcp', 'LICENSE'],
  },
  'packages/mcp-core/README.md': {
    profile: 'core',
    maxLines: 160,
    maxLineLength: 112,
    requiredSections: [/^purpose$/i, /^contract surface$/i, /^integration$/i, /^design boundaries$/i, /^development$/i, /^license$/i],
    requiredLinks: ['LICENSE'],
  },
  'packages/mcp-testkit/README.md': {
    profile: 'testkit',
    maxLines: 140,
    maxLineLength: 100,
    requiredSections: [/^fixtures$/i, /^usage$/i, /^development$/i, /^license$/i],
    requiredLinks: ['LICENSE'],
  },
})

const forbiddenPatterns = Object.freeze([
  { label: 'internal staging project identifier', pattern: /cncjqpdtksgeffqdeary/gi },
  { label: 'local infrastructure endpoint', pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/gi },
  { label: 'private filesystem path', pattern: /(?:\/Users\/|\/private\/var\/|\/tmp\/invompt)/gi },
  { label: 'credential or token material', pattern: /(?:inv_gd_v1\.[a-z0-9]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}|(?:ghp|gho|ghu|ghs)_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,})/g },
  { label: 'secret-bearing environment variable', pattern: /\b(?:GITHUB_TOKEN|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY)\b/g },
  { label: 'internal deployment identifier', pattern: /\bdpl_[A-Za-z0-9_-]{8,}\b/g },
  { label: 'release or internal runbook language', pattern: /\b(?:candidate release|fresh-host|registry-availability|maintainer evidence|exact-SHA|staging project)\b/gi },
])

const nonEnglishMarkers = Object.freeze([
  /\b(?:este|esta|estos|estas|proyecto|producto|permite|crear|documentos?|cualquier|empresa|facilmente|para|con)\b/gi,
  /\b(?:factura(?:s)?|cotizacion(?:es)?|presupuesto(?:s)?|seguridad|recursos|licencia|instrucciones)\b/gi,
  /\bconfiguracion(?:es)?\b/gi,
  /\bcredencial(?:es)?\b/gi,
  /\bservidor(?:es)?\b/gi,
  /\binstalacion(?:es)?\b/gi,
  /\bejecutar\b/gi,
  /\bconectado\b/gi,
  /\beinrichtung\b/gi,
  /\bverbindung\b/gi,
])

function lineNumber(text, offset) {
  return text.slice(0, offset).split('\n').length
}

function contentLines(text) {
  const lines = []
  let inFence = false
  for (const [index, line] of text.split('\n').entries()) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence) lines.push({ index: index + 1, text: line })
  }
  return lines
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
}

function visibleMarkdownText(text) {
  return contentLines(stripHtmlComments(text))
    .map(({ text: line }) => line.replace(/(`+)(.*?)\1/g, ' '))
    .join('\n')
}

export function proseText(text) {
  return contentLines(text)
    .map(({ text: line }) =>
      line
        .replace(/<[^>]*>/g, ' ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`[^`]*`/g, ' ')
        .replace(/https?:\/\/\S+/gi, ' '),
    )
    .join('\n')
}

export function markdownLinkDestinations(text) {
  const visible = visibleMarkdownText(text)
  const destinations = []
  const patterns = [
    /!?\[[^\]]*\]\(\s*(?:<([^>\n]*)>|([^\s)\n]+))/g,
    /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>\n]*)>|([^\s\n]+))/gm,
  ]
  for (const pattern of patterns) {
    for (const match of visible.matchAll(pattern)) destinations.push(match[1] ?? match[2] ?? match[3] ?? match[4])
  }
  return destinations
}

function headings(text) {
  const values = []
  let inFence = false
  for (const [index, line] of text.split('\n').entries()) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)
    if (match) values.push({ level: match[1].length, title: match[2].trim(), line: index + 1 })
  }
  return values
}

function addFinding(findings, path, line, rule, detail) {
  findings.push(path + ':' + line + ' [' + rule + '] ' + detail)
}

export function validateDocument(relativePath, text) {
  const config = README_DOCUMENTS[relativePath]
  if (!config) return [relativePath + ': [configuration] no README profile is declared']
  const findings = []
  const lines = text.split('\n')

  if (!text.endsWith('\n')) addFinding(findings, relativePath, lines.length, 'format', 'file must end with a newline')
  for (const [index, line] of lines.entries()) {
    if (/\s+$/.test(line)) addFinding(findings, relativePath, index + 1, 'format', 'trailing whitespace is not allowed')
    if (line.length > config.maxLineLength) {
      addFinding(findings, relativePath, index + 1, 'line-length', 'line has ' + line.length + ' characters; ' + config.profile + ' profile allows ' + config.maxLineLength)
    }
  }
  const contentLineCount = lines.length - (text.endsWith('\n') ? 1 : 0)
  if (contentLineCount > config.maxLines) {
    addFinding(findings, relativePath, config.maxLines + 1, 'line-count', config.profile + ' profile allows at most ' + config.maxLines + ' content lines')
  }

  const parsedHeadings = headings(text)
  if (parsedHeadings.length === 0) addFinding(findings, relativePath, 1, 'headings', 'add one level-one title')
  if (parsedHeadings.filter(({ level }) => level === 1).length !== 1) {
    addFinding(findings, relativePath, 1, 'headings', 'document must contain exactly one level-one title')
  }
  for (let index = 1; index < parsedHeadings.length; index += 1) {
    const previous = parsedHeadings[index - 1]
    const current = parsedHeadings[index]
    if (current.level > previous.level + 1) {
      addFinding(findings, relativePath, current.line, 'headings', 'heading level ' + current.level + ' follows level ' + previous.level + '; do not skip a level')
    }
  }
  const seenHeadings = new Set()
  for (const heading of parsedHeadings) {
    const key = heading.title.toLowerCase()
    if (seenHeadings.has(key)) addFinding(findings, relativePath, heading.line, 'headings', 'duplicate heading: ' + heading.title)
    seenHeadings.add(key)
  }
  for (const section of config.requiredSections) {
    if (!parsedHeadings.some(({ title }) => section.test(title))) {
      addFinding(findings, relativePath, 1, 'sections', 'missing required ' + config.profile + ' section (' + section + ')')
    }
  }

  const linkDestinations = markdownLinkDestinations(text)
  for (const link of config.requiredLinks) {
    const present = linkDestinations.some((destination) => destination === link || destination.endsWith('/' + link))
    if (!present) addFinding(findings, relativePath, 1, 'links', 'missing required link or reference: ' + link)
  }

  const publicText = proseText(text)
  for (const { label, pattern } of forbiddenPatterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (match) {
      const sourceOffset = text.indexOf(match[0])
      addFinding(findings, relativePath, lineNumber(text, sourceOffset < 0 ? 0 : sourceOffset), 'privacy', label + ': ' + match[0])
    }
  }
  const nonAscii = /[\u0080-\uFFFF]/u.exec(publicText)
  if (nonAscii) addFinding(findings, relativePath, 1, 'language', 'non-ASCII prose is not allowed (' + JSON.stringify(nonAscii[0]) + ')')
  for (const marker of nonEnglishMarkers) {
    marker.lastIndex = 0
    const match = marker.exec(publicText)
    if (match) {
      const sourceOffset = text.indexOf(match[0])
      addFinding(findings, relativePath, lineNumber(text, sourceOffset < 0 ? 0 : sourceOffset), 'language', 'non-English prose marker: ' + match[0])
      break
    }
  }
  return findings
}

function usage() {
  return 'Usage: node scripts/validate-public-readmes.mjs [README.md ...]\n\nWith no paths, validate every public README declared by this policy.'
}

function requestedPaths(args) {
  if (args.length === 0) return Object.keys(README_DOCUMENTS)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage() + '\n')
    return []
  }
  const invalid = args.filter((path) => !Object.hasOwn(README_DOCUMENTS, path))
  if (invalid.length > 0) throw new Error('Unknown README path(s): ' + invalid.join(', ') + '\n' + usage())
  return args
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = requestedPaths(process.argv.slice(2))
  if (paths.length === 0) process.exit(0)
  const findings = paths.flatMap((path) => {
    const absolutePath = resolve(workspaceRoot, path)
    try {
      return validateDocument(path, readFileSync(absolutePath, 'utf8'))
    } catch (error) {
      return [path + ': [io] ' + (error instanceof Error ? error.message : String(error))]
    }
  })
  if (findings.length > 0) {
    process.stderr.write('Public README policy failed with ' + findings.length + ' finding(s):\n' + findings.map((finding) => '- ' + finding).join('\n') + '\n')
    process.exitCode = 1
  } else {
    process.stdout.write('Public README policy passed: ' + paths.length + ' file(s) checked.\n')
  }
}
