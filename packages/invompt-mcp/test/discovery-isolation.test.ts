import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import { PACKAGE_FILE_MANIFESTS } from '../../../scripts/package-file-manifests.mjs'

const workspaceRoot = resolve(import.meta.dirname, '../../..')
const packageRoot = resolve(workspaceRoot, 'packages/invompt-mcp')
const read = (path: string): string => readFileSync(resolve(packageRoot, path), 'utf8')

describe('local-beta discovery isolation', () => {
  test('uses only the beta plugin and skill identities across host manifests', () => {
    const manifestPaths = [
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      'plugin.json',
      'gemini-extension.json',
      'qwen-extension.json',
    ]
    for (const path of manifestPaths) expect(JSON.parse(read(path)).name).toBe('invompt-local-beta')

    const runtimeSupport = JSON.parse(read('runtime-support.json')) as {
      pluginIdentity?: string
      skillIdentities?: string[]
    }
    expect(runtimeSupport.pluginIdentity).toBe('invompt-local-beta')
    expect(runtimeSupport.skillIdentities).toEqual(['invompt-local-beta-invoice', 'invompt-local-beta-onboarding'])
    expect(read('skills/invompt-local-beta-invoice/SKILL.md')).toMatch(/^name: invompt-local-beta-invoice$/m)
    expect(read('skills/invompt-local-beta-onboarding/SKILL.md')).toMatch(/^name: invompt-local-beta-onboarding$/m)
  })

  test('packs no retired global discovery paths', () => {
    const packedPaths = PACKAGE_FILE_MANIFESTS['invompt-mcp'].files
    const retiredPaths = [
      '.agents/skills/invompt-invoice/',
      '.agents/skills/invompt-onboarding/',
      '.codex/agents/invoice-operator.toml',
      '.cursor/rules/invompt-invoice.mdc',
      'agents/invoice-operator.agent.md',
      'commands/invoice.md',
      'commands/invompt/',
      'skills/invompt-invoice/',
      'skills/invompt-onboarding/',
    ]
    for (const retiredPath of retiredPaths) {
      expect(packedPaths.some((path) => path === retiredPath || path.startsWith(retiredPath))).toBe(false)
    }
  })
})
