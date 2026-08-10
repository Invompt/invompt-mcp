import { spawnSync } from 'node:child_process'

import type { AuthMode, CommandResult, CommandRunner, HostName } from './types.js'

export const HOSTED_MCP_URL = 'https://mcp.invompt.com/mcp'

function missingConfiguration(host: HostName, stderr: string | undefined): boolean {
  if (!stderr) return false
  return host === 'claude-code'
    ? /(?:no mcp server named|mcp server .*invompt.*(?:not found|not configured))/i.test(stderr)
    : /(?:no mcp server named|mcp server .*invompt.*not found)/i.test(stderr)
}

function defaultRunner(command: string, args: readonly string[], interactive = false) {
  const result = spawnSync(command, args, interactive ? { stdio: 'inherit' } : { encoding: 'utf8' })
  return Promise.resolve({
    ok: result.status === 0,
    stderr: interactive ? undefined : typeof result.stderr === 'string' ? result.stderr : '',
  })
}

function runConfiguredCommand(
  runner: CommandRunner,
  command: string,
  args: readonly string[],
  interactive: boolean,
): Promise<CommandResult> {
  return runner === defaultRunner ? defaultRunner(command, args, interactive) : runner(command, args)
}

export function hostCommands(host: HostName, mode: AuthMode, packageVersion: string): readonly (readonly string[])[] {
  const serve = ['npx', '--yes', `invompt-mcp@${packageVersion}`, 'serve', '--host', host]
  if (host === 'claude-code') {
    return mode === 'guest'
      ? [
          ['claude', 'mcp', 'remove', 'invompt'],
          ['claude', 'mcp', 'add', '--scope', 'user', '--transport', 'stdio', 'invompt', '--', ...serve],
        ]
      : [
          ['claude', 'mcp', 'remove', 'invompt'],
          ['claude', 'mcp', 'add', '--scope', 'user', '--transport', 'http', 'invompt', HOSTED_MCP_URL],
          ['claude', 'mcp', 'login', 'invompt'],
        ]
  }
  return mode === 'guest'
    ? [
        ['codex', 'mcp', 'remove', 'invompt'],
        ['codex', 'mcp', 'add', 'invompt', '--', ...serve],
      ]
    : [
        ['codex', 'mcp', 'remove', 'invompt'],
        ['codex', 'mcp', 'add', 'invompt', '--url', HOSTED_MCP_URL, '--oauth-resource', HOSTED_MCP_URL],
      ]
}

export async function configureHost(
  host: HostName,
  mode: AuthMode,
  packageVersion: string,
  runner: CommandRunner = defaultRunner,
): Promise<void> {
  const commands = hostCommands(host, mode, packageVersion)
  for (let index = 0; index < commands.length; index += 1) {
    const [command, ...args] = commands[index]
    const interactive =
      mode === 'oauth' && ((host === 'claude-code' && args[1] === 'login') || (host === 'codex' && args[1] === 'add'))
    const result = await runConfiguredCommand(runner, command, args, interactive)
    if (!result.ok && (index !== 0 || !missingConfiguration(host, result.stderr)))
      throw new Error(
        `Unable to configure ${host} for ${mode} mode. Run setup again after resolving the host CLI error.`,
      )
  }
}

export async function logoutHost(host: HostName, runner: CommandRunner = defaultRunner): Promise<void> {
  const result = await runner(host === 'claude-code' ? 'claude' : 'codex', ['mcp', 'logout', 'invompt'])
  if (!result.ok)
    throw new Error(`Unable to log ${host} out of Invompt. Run setup again after resolving the host CLI error.`)
}

export async function removeHost(host: HostName, runner: CommandRunner = defaultRunner): Promise<void> {
  const result = await runner(host === 'claude-code' ? 'claude' : 'codex', ['mcp', 'remove', 'invompt'])
  if (!result.ok && !missingConfiguration(host, result.stderr))
    throw new Error(`Unable to remove ${host} Invompt configuration.`)
}
