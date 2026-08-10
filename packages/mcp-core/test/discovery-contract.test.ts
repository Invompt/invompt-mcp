import type { McpRegistrar } from '@invompt/mcp-core'
import { registerMcpSurface } from '@invompt/mcp-core'
import {
  EXPECTED_PROMPT_NAMES,
  EXPECTED_RESOURCE_NAMES,
  EXPECTED_TOOL_NAMES,
  OPERATIONAL_TOOL_NAMES,
  createServiceFake,
} from '@invompt/mcp-testkit'
import { describe, expect, test, vi } from 'vitest'

describe('public MCP discovery contract', () => {
  test('registers exactly 16 operational tools, two resources, and one prompt', () => {
    const tools: string[] = []
    const resources: string[] = []
    const prompts: string[] = []
    const registrar = {
      registerTool: vi.fn((name: string) => tools.push(name)),
      registerResource: vi.fn((name: string) => resources.push(name)),
      registerPrompt: vi.fn((name: string) => prompts.push(name)),
    } as unknown as McpRegistrar

    registerMcpSurface(registrar, createServiceFake())

    expect(tools).toEqual(EXPECTED_TOOL_NAMES)
    expect(resources.sort()).toEqual([...EXPECTED_RESOURCE_NAMES].sort())
    expect(prompts).toEqual(EXPECTED_PROMPT_NAMES)
    expect(tools).toHaveLength(16)
    expect(OPERATIONAL_TOOL_NAMES).toHaveLength(16)
    expect(OPERATIONAL_TOOL_NAMES.every((name) => tools.includes(name))).toBe(true)
    expect(tools).toContain('create_account_claim_link')
  })
})
