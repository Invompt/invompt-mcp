import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import { markdownLinkDestinations, proseText, validateDocument } from '../../../scripts/validate-public-readmes.mjs'

const workspaceRoot = resolve(import.meta.dirname, '../../..')

describe('public README policy', () => {
  test('keeps Markdown link text and image alt text while removing destinations', () => {
    const text = proseText('[Invoice guide](https://example.com/guide) ![Invoice icon](https://example.com/icon.svg)')

    expect(text).toContain('Invoice guide')
    expect(text).toContain('Invoice icon')
    expect(text).not.toContain('https://example.com')
  })

  test('rejects non-English prose inside a Markdown link label', () => {
    const source = readFileSync(resolve(workspaceRoot, 'packages/mcp-testkit/README.md'), 'utf8')
    const readme = source.replace('## License', '## License\n\n[facturas pendientes](https://example.com)')
    const findings = validateDocument('packages/mcp-testkit/README.md', readme)

    expect(findings).toEqual(expect.arrayContaining([expect.stringContaining('non-English prose marker: facturas')]))
  })

  test('does not count required links hidden in comments or code', () => {
    const source = readFileSync(resolve(workspaceRoot, 'packages/mcp-testkit/README.md'), 'utf8')
    const readme = source
      .replace('[`MIT`](LICENSE)', '')
      .replace(/\n$/, '\n<!-- [`MIT`](LICENSE) -->\n```md\n[`MIT`](LICENSE)\n```\n')
    const findings = validateDocument('packages/mcp-testkit/README.md', readme)

    expect(markdownLinkDestinations(readme)).not.toContain('LICENSE')
    expect(findings).toEqual(
      expect.arrayContaining([expect.stringContaining('missing required link or reference: LICENSE')]),
    )
  })
})
