import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const packageRoot = resolve(import.meta.dirname, '..')

describe('self-contained package contract', () => {
  test('has zero runtime dependencies and no sibling-core import', () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const runtimeSources = ['src/index.ts', 'src/contracts.ts', 'src/guest-credential.ts'].map((path) =>
      readFileSync(resolve(packageRoot, path), 'utf8'),
    )

    expect(packageJson.dependencies ?? {}).toEqual({})
    expect(runtimeSources.join('\n')).not.toContain('@invompt/mcp-core')
  })

  test('exposes dependency-free public declarations', () => {
    const publicDeclarations = ['dist/index.d.ts', 'dist/bridge.d.ts', 'dist/guest-credential.d.ts'].map((path) =>
      readFileSync(resolve(packageRoot, path), 'utf8'),
    )

    expect(publicDeclarations.join('\n')).not.toContain('@modelcontextprotocol/sdk')
    expect(publicDeclarations.join('\n')).not.toContain('NodeJS.')
  })

  test('keeps its embedded contract identical to the core contract', () => {
    expect(readFileSync(resolve(packageRoot, 'src/contracts.ts'), 'utf8')).toBe(
      readFileSync(resolve(packageRoot, '../mcp-core/src/contracts.ts'), 'utf8'),
    )
  })
})
