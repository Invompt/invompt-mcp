import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const sourceRoot = join(import.meta.dirname, '..', 'src')
function readPublishedSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? [readPublishedSources(path)] : entry.name.endsWith('.ts') ? [readFileSync(path, 'utf8')] : []
    })
    .join('\n')
}

describe('public package boundary', () => {
  test('core source has no infrastructure or private-server coupling', () => {
    const source = readPublishedSources(sourceRoot)
    for (const forbidden of [
      '/api/',
      'database',
      'repository',
      'invompt_api_',
      'node:fs',
      'node:process',
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})
