import { chmodSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'
import { type JsonRpcMessage, type MessageTransport, startBridge } from '../src/bridge.js'
import { runCli } from '../src/index.js'
import type { GuestApi } from '../src/onboarding/guest-api.js'
import { createGuestApi } from '../src/onboarding/guest-api.js'
import { configureHost, hostCommands, removeHost } from '../src/onboarding/host-config.js'
import { createFileSecretStore, createKeychainSecretStore } from '../src/onboarding/secret-store.js'
import { logout, reset, resolveGuestCredentialForBridge, setup, status } from '../src/onboarding/service.js'
import { createAuthStateStore } from '../src/onboarding/state.js'
import type { CommandRunner, SecretStore } from '../src/onboarding/types.js'

const credential = `inv_gd_v1.test.${Buffer.alloc(32, 1).toString('base64url')}.${Buffer.alloc(32, 2).toString('base64url')}`
const temporaryDirectories: string[] = []

function stateFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'invompt-onboarding-'))
  temporaryDirectories.push(directory)
  return createAuthStateStore(join(directory, '.invompt', 'auth-state.json'))
}

function secret(backend: 'keychain' | 'file', initial?: string): SecretStore {
  let value = initial
  return {
    backend,
    read: () => value,
    write: (next) => {
      value = next
    },
    remove: () => {
      value = undefined
    },
  }
}

function guestApi(): GuestApi {
  return {
    issueCredential: async () => credential,
    acknowledge: async () => {},
    prepareRevocation: async () => ({
      operationId: '00000000-0000-4000-8000-000000000000',
      recoveryToken: Buffer.alloc(32, 9).toString('base64url'),
    }),
    commitRevocation: async () => {},
  }
}

const successfulRunner: CommandRunner = async () => ({ ok: true })

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('macOS beta onboarding', () => {
  test('sets up Guest without placing its credential in state or command arguments', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    const commands: string[] = []
    await setup(
      { mode: 'guest', host: 'claude-code' },
      {
        state,
        keychain,
        guestApi: guestApi(),
        runner: async (command, args) => {
          commands.push([command, ...args].join(' '))
          return { ok: true }
        },
      },
    )
    expect(status({ state })).toMatchObject({
      selectedMode: 'guest',
      guest: { status: 'active', backend: 'keychain' },
      bindings: { 'claude-code': { epoch: 2, status: 'active' } },
    })
    expect(JSON.stringify(state.read())).not.toContain(credential)
    expect(commands.join('\n')).not.toContain(credential)
    expect(statSync(join(join(state.path, '..'), 'auth-state.json')).mode & 0o777).toBe(0o600)
  })

  test('uses file storage only after an explicit Keychain fallback request', async () => {
    const state = stateFixture()
    const file = secret('file')
    const denied: SecretStore = {
      backend: 'keychain',
      read: () => {
        throw new Error('locked')
      },
      write: () => {
        throw new Error('locked')
      },
      remove: () => {},
    }
    await expect(
      setup(
        { mode: 'guest', host: 'codex' },
        { state, keychain: denied, file, guestApi: guestApi(), runner: successfulRunner },
      ),
    ).rejects.toThrow('locked')
    await setup(
      { mode: 'guest', host: 'codex', allowFileFallback: true },
      { state, keychain: denied, file, guestApi: guestApi(), runner: successfulRunner },
    )
    expect(state.read().guest).toEqual({ status: 'active', backend: 'file' })
  })

  test('switches modes monotonically, retains a dormant Guest, and makes an old bridge fail closed', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    const deps = { state, keychain, guestApi: guestApi(), runner: successfulRunner }
    await setup({ mode: 'guest', host: 'codex' }, deps)
    const bridge = resolveGuestCredentialForBridge('codex', deps)
    await setup({ mode: 'oauth', host: 'claude-code' }, deps)
    expect(state.read()).toMatchObject({
      epoch: 3,
      selectedMode: 'oauth',
      guest: { status: 'dormant', backend: 'keychain' },
      bindings: { codex: { epoch: 2, status: 'unconfigured' } },
    })
    expect(bridge.guard()).toBe(false)
    await setup({ mode: 'guest', host: 'claude-code' }, deps)
    expect(state.read()).toMatchObject({
      epoch: 4,
      selectedMode: 'guest',
      guest: { status: 'active', backend: 'keychain' },
    })
  })

  test('reset attempts exactly one two-phase revocation and purges local state when it is offline', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    await setup({ mode: 'guest', host: 'codex' }, { state, keychain, guestApi: guestApi(), runner: successfulRunner })
    const offline: GuestApi = {
      ...guestApi(),
      prepareRevocation: async () => {
        throw new Error('offline')
      },
    }
    const hostCleanup: string[] = []
    const result = await reset(true, {
      state,
      keychain,
      guestApi: offline,
      runner: async (command, args) => {
        hostCleanup.push([command, ...args].join(' '))
        return { ok: true }
      },
    })
    expect(result.warning).toContain('Copied or stolen credentials')
    expect(keychain.read()).toBeUndefined()
    expect(state.read().guest.status).toBe('none')
    expect(state.read().selectedMode).toBeNull()
    expect(hostCleanup).toEqual([
      'claude mcp logout invompt-local-beta',
      'claude mcp remove invompt-local-beta',
      'codex mcp logout invompt-local-beta',
      'codex mcp remove invompt-local-beta',
    ])
  })

  test('has exact host commands and keeps Guest credentials out of them', () => {
    expect(hostCommands('codex', 'guest', '0.11.2')[1]).toEqual([
      'codex',
      'mcp',
      'add',
      'invompt-local-beta',
      '--',
      'npx',
      '--yes',
      'invompt-mcp@0.11.2',
      'serve',
      '--host',
      'codex',
    ])
    expect(hostCommands('claude-code', 'oauth', '0.11.2')[2]).toEqual(['claude', 'mcp', 'login', 'invompt-local-beta'])
    expect(JSON.stringify(hostCommands('claude-code', 'guest', '0.11.2'))).not.toContain(credential)
    for (const host of ['claude-code', 'codex'] as const) {
      for (const mode of ['guest', 'oauth'] as const) {
        for (const command of hostCommands(host, mode, '0.11.2')) expect(command).not.toContain('invompt')
      }
    }
  })

  test('preserves the injected runner contract while configuring interactive OAuth login commands', async () => {
    const commands: string[] = []
    await configureHost('claude-code', 'oauth', '0.11.2', async (command, args) => {
      commands.push([command, ...args].join(' '))
      return { ok: true }
    })
    await configureHost('codex', 'oauth', '0.11.2', async (command, args) => {
      commands.push([command, ...args].join(' '))
      return { ok: true }
    })
    expect(commands).toContain('claude mcp login invompt-local-beta')
    expect(commands).toContain(
      'codex mcp add invompt-local-beta --url https://mcp.invompt.com/mcp --oauth-resource https://mcp.invompt.com/mcp',
    )
    expect(commands).not.toContain('codex mcp login invompt-local-beta')
  })

  test('uses exact Guest REST mutation contracts without automatic retries', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const api = createGuestApi({
      fetch: async (url, init) => {
        requests.push({ url: String(url), init })
        return new Response(JSON.stringify({ credential, credentialType: 'inv_gd_v1' }), { status: 201 })
      },
      operationId: () => '00000000-0000-4000-8000-000000000000',
      recoveryToken: () => Buffer.alloc(32, 7).toString('base64url'),
    })
    await expect(api.issueCredential()).resolves.toBe(credential)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      url: 'https://invompt.com/api/guest/v1/credentials',
      init: { method: 'POST', headers: { 'Content-Length': '0' }, redirect: 'error' },
    })
    const acknowledgementApi = createGuestApi({
      fetch: async (url, init) => {
        requests.push({ url: String(url), init })
        return new Response('', { status: 200 })
      },
    })
    await acknowledgementApi.acknowledge(credential)
    expect(requests[1]).toMatchObject({
      url: 'https://invompt.com/api/guest/v1/credentials/acknowledge',
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Length': '0' },
        redirect: 'error',
      },
    })
    const revocationApi = createGuestApi({
      fetch: async (url, init) => {
        requests.push({ url: String(url), init })
        return new Response('', { status: String(url).includes('revocations') ? 201 : 200 })
      },
      operationId: () => '00000000-0000-4000-8000-000000000000',
      recoveryToken: () => Buffer.alloc(32, 7).toString('base64url'),
    })
    const prepared = await revocationApi.prepareRevocation(credential)
    await revocationApi.commitRevocation(prepared.operationId, prepared.recoveryToken)
    expect(requests[2]).toMatchObject({
      url: 'https://invompt.com/api/guest/v1/credentials/revocations',
      init: { method: 'POST', body: JSON.stringify(prepared) },
    })
    expect((requests[3].init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      `Invompt-Recovery ${prepared.recoveryToken}`,
    )
  })

  test('OAuth logout leaves a reconciliation marker and never accesses Guest storage', async () => {
    const state = stateFixture()
    const keychain = secret('keychain', credential)
    await setup({ mode: 'oauth', host: 'codex' }, { state, keychain, guestApi: guestApi(), runner: successfulRunner })
    await logout('codex', { state, keychain, runner: successfulRunner })
    expect(state.read().bindings.codex?.status).toBe('needs_reconcile')
  })

  test('does not issue or switch away from a recorded unavailable Guest backend', async () => {
    const state = stateFixture()
    state.write({
      schemaVersion: 1,
      epoch: 2,
      selectedMode: 'guest',
      guest: { status: 'active', backend: 'keychain' },
      bindings: {},
    })
    let issued = 0
    const unavailable: SecretStore = { backend: 'keychain', read: () => undefined, write: () => {}, remove: () => {} }
    await expect(
      setup(
        { mode: 'guest', host: 'codex', allowFileFallback: true },
        {
          state,
          keychain: unavailable,
          file: secret('file'),
          guestApi: {
            ...guestApi(),
            issueCredential: async () => {
              issued += 1
              return credential
            },
          },
          runner: successfulRunner,
        },
      ),
    ).rejects.toThrow('recorded Guest credential is unavailable')
    expect(issued).toBe(0)
    expect(state.read().guest.status).toBe('unavailable')
  })

  test('Guest logout removes its selected host and remains fail-closed on removal failure', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    await setup({ mode: 'guest', host: 'codex' }, { state, keychain, guestApi: guestApi(), runner: successfulRunner })
    const commands: string[] = []
    await logout('codex', {
      state,
      keychain,
      runner: async (command, args) => {
        commands.push([command, ...args].join(' '))
        return { ok: true }
      },
    })
    expect(commands).toEqual(['codex mcp remove invompt-local-beta'])
    expect(state.read().guest.status).toBe('active')
    expect(state.read().bindings.codex?.status).toBe('unconfigured')
  })

  test('serializes concurrent setup decisions and forwards no request after its mode guard changes', async () => {
    const state = stateFixture()
    const order: string[] = []
    await Promise.all([
      state.withLock(async () => {
        order.push('first')
        await new Promise<void>((resolve) => setTimeout(resolve, 30))
      }),
      state.withLock(async () => order.push('second')),
    ])
    expect(order).toEqual(['first', 'second'])

    const stdio: MessageTransport & { receive(message: JsonRpcMessage): void; sent: JsonRpcMessage[] } = {
      sent: [],
      async start() {},
      async close() {},
      async send(message) {
        this.sent.push(message)
      },
      receive(message) {
        this.onmessage?.(message)
      },
    }
    const remote: MessageTransport & { sent: JsonRpcMessage[] } = {
      sent: [],
      async start() {},
      async close() {},
      async send(message) {
        this.sent.push(message)
      },
    }
    const guarded = false
    await startBridge({
      guestCredential: credential,
      privateMcpUrl: 'http://localhost:3101/mcp',
      stdioTransport: stdio,
      remoteTransport: remote,
      modeGuard: () => guarded,
    })
    stdio.receive({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(remote.sent).toEqual([])
    const guardErrors: Error[] = []
    stdio.onerror = (error) => guardErrors.push(error)
    await startBridge({
      guestCredential: credential,
      privateMcpUrl: 'http://localhost:3101/mcp',
      stdioTransport: stdio,
      remoteTransport: remote,
      modeGuard: () => {
        throw new Error('unexpected')
      },
    })
    expect(() => stdio.receive({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).not.toThrow()
    expect(guardErrors[0]?.message).toBe('Guest mode verification failed. Restart the MCP host after setup completes.')
  })

  test('drops remote responses and notifications after mode change and closes both directions once', async () => {
    let active = true
    let stdioCloses = 0
    let remoteCloses = 0
    const stdioErrors: Error[] = []
    const stdio: MessageTransport & { sent: JsonRpcMessage[] } = {
      sent: [],
      onerror: (error) => stdioErrors.push(error),
      async start() {},
      async close() {
        stdioCloses += 1
        this.onclose?.()
      },
      async send(message) {
        this.sent.push(message)
      },
    }
    const remote: MessageTransport & { receive(message: JsonRpcMessage): void } = {
      async start() {},
      async close() {
        remoteCloses += 1
        this.onclose?.()
      },
      async send() {},
      receive(message) {
        this.onmessage?.(message)
      },
    }
    await startBridge({
      guestCredential: credential,
      privateMcpUrl: 'http://localhost:3101/mcp',
      stdioTransport: stdio,
      remoteTransport: remote,
      modeGuard: () => active,
    })
    remote.receive({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
    expect(stdio.sent).toHaveLength(1)

    active = false
    remote.receive({ jsonrpc: '2.0', id: 7, result: { tools: [] } })
    remote.receive({ jsonrpc: '2.0', method: 'notifications/resources/updated' })
    await Promise.resolve()

    expect(stdio.sent).toHaveLength(1)
    expect(stdioErrors.map((error) => error.message)).toEqual([
      'Guest mode changed on this device. Restart the MCP host after setup completes.',
    ])
    expect(stdioCloses).toBe(1)
    expect(remoteCloses).toBe(1)
  })

  test('closes only the peer when one transport reports an existing close', async () => {
    let stdioCloses = 0
    let remoteCloses = 0
    const stdio: MessageTransport = {
      async start() {},
      async close() {
        stdioCloses += 1
        this.onclose?.()
      },
      async send() {},
    }
    const remote: MessageTransport = {
      async start() {},
      async close() {
        remoteCloses += 1
        this.onclose?.()
      },
      async send() {},
    }
    await startBridge({
      guestCredential: credential,
      privateMcpUrl: 'http://localhost:3101/mcp',
      stdioTransport: stdio,
      remoteTransport: remote,
    })

    remote.onclose?.()
    await Promise.resolve()

    expect(stdioCloses).toBe(1)
    expect(remoteCloses).toBe(0)
  })

  test('uses static JXA arguments with credential only on stdin and rejects fallback symlinks', async () => {
    const calls: Array<{ args: readonly string[]; input?: string }> = []
    const keychain = createKeychainSecretStore((args, input) => {
      calls.push({ args, input })
      return { status: 0 }
    })
    keychain.write(credential)
    expect(calls[0].args.join(' ')).not.toContain(credential)
    expect(calls[0].input).toBe(credential)
    const directory = mkdtempSync(join(tmpdir(), 'invompt-fallback-'))
    temporaryDirectories.push(directory)
    const target = join(directory, 'target')
    const fallback = join(directory, 'guest-credential')
    writeFileSync(target, credential, { mode: 0o600 })
    symlinkSync(target, fallback)
    expect(() => createFileSecretStore(fallback).read()).toThrow('unsafe')
    const regular = join(directory, 'regular')
    const fileStore = createFileSecretStore(regular)
    fileStore.write(credential)
    chmodSync(regular, 0o644)
    expect(() => fileStore.read()).toThrow('unsafe')
  })

  test('starts undecided and offers localized deterministic bare setup prompts', async () => {
    const state = stateFixture()
    expect(status({ state }).selectedMode).toBeNull()
    expect(() => resolveGuestCredentialForBridge('codex', { state })).toThrow('Guest mode is not active')
    const prompts: string[] = []
    const values = ['guest', 'codex']
    await runCli(['setup'], {
      locale: 'es-ES',
      prompt: async (question) => {
        prompts.push(question)
        return values.shift() ?? ''
      },
      setup: async () => {},
    })
    expect(prompts).toEqual(['Modo (guest/oauth): ', 'Host (claude-code/codex): '])
  })

  test('rejects OAuth file fallback and duplicate or unknown CLI flags before setup', async () => {
    let setupCalls = 0
    const dependencies = {
      setup: async () => {
        setupCalls += 1
      },
    }
    await expect(
      runCli(['setup', '--mode', 'oauth', '--host', 'codex', '--allow-file-fallback'], dependencies),
    ).rejects.toThrow('--allow-file-fallback is only supported with --mode guest')
    await expect(
      runCli(['setup', '--mode', 'guest', '--mode', 'guest', '--host', 'codex'], dependencies),
    ).rejects.toThrow('--mode may be specified only once')
    await expect(runCli(['setup', '--mode', 'guest', '--host', 'codex', '--unexpected'], dependencies)).rejects.toThrow(
      '--unexpected is not supported by setup',
    )
    await expect(runCli(['serve', '--host', 'codex', '--host', 'codex'], { serve: async () => {} })).rejects.toThrow(
      '--host may be specified only once',
    )
    expect(setupCalls).toBe(0)
  })

  test.each([['help'], ['--help']])('prints deterministic help for %s without side effects', async (alias) => {
    const output: string[] = []
    await runCli([alias], {
      write: (value) => output.push(value),
      setup: async () => {
        throw new Error('must not run')
      },
    })
    expect(output.join('')).toContain('setup --mode guest|oauth --host claude-code|codex [--allow-file-fallback]')
    expect(output.join('')).toContain('reset --yes')
    expect(output.join('')).toContain('copied or stolen credentials valid')
  })

  test('rejects noncanonical Guest APIs and maps transport failures without leaking details', async () => {
    expect(() => createGuestApi({ baseUrl: 'https://attacker.example.invalid' })).toThrow('not permitted')
    const api = createGuestApi({
      fetch: async () => {
        throw new Error('credential text must not be surfaced')
      },
    })
    await expect(api.issueCredential()).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  test('recovers a dead-owner state lock without leaving state writes blocked', async () => {
    const state = stateFixture()
    state.write(state.read())
    writeFileSync(`${state.path}.lock`, JSON.stringify({ pid: 999_999_999, createdAt: Date.now() }), { mode: 0o600 })
    let entered = false
    await state.withLock(async () => {
      entered = true
    })
    expect(entered).toBe(true)
  })

  test('requires an active current Guest binding for the exact serve host', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    const deps = { state, keychain, guestApi: guestApi(), runner: successfulRunner }
    await setup({ mode: 'guest', host: 'codex' }, deps)
    expect(resolveGuestCredentialForBridge('codex', deps).credential).toBe(credential)
    state.write({ ...state.read(), bindings: { codex: { epoch: 1, mode: 'guest', status: 'active' } } })
    expect(() => resolveGuestCredentialForBridge('codex', deps)).toThrow('Guest mode is not active')
    state.write({
      ...state.read(),
      bindings: { codex: { epoch: state.read().epoch, mode: 'oauth', status: 'active' } },
    })
    expect(() => resolveGuestCredentialForBridge('codex', deps)).toThrow('Guest mode is not active')
    state.write({ ...state.read(), bindings: {} })
    expect(() => resolveGuestCredentialForBridge('codex', deps)).toThrow('Guest mode is not active')
  })

  test('restarts the bridge only through the explicitly requested host resolver', async () => {
    let resolvedHost: string | undefined
    const transport: MessageTransport = { async start() {}, async close() {}, async send() {} }
    await startBridge({
      host: 'claude-code',
      privateMcpUrl: 'http://localhost:3101/mcp',
      stdioTransport: transport,
      remoteTransport: transport,
      credentialResolver: (host) => {
        resolvedHost = host
        return { credential, guard: () => true }
      },
    })
    expect(resolvedHost).toBe('claude-code')
    await expect(
      startBridge({
        privateMcpUrl: 'http://localhost:3101/mcp',
        stdioTransport: transport,
        remoteTransport: transport,
      }),
    ).rejects.toThrow('serve requires --host')
  })

  test('parses required serve host and permits only narrow missing-host cleanup failures', async () => {
    let host: string | undefined
    await runCli(['serve', '--host', 'codex'], {
      serve: async (options) => {
        host = options.host
      },
    })
    expect(host).toBe('codex')
    await expect(runCli(['serve'], { serve: async () => {} })).rejects.toThrow('--host must be claude-code or codex')
    await configureHost('codex', 'guest', '0.11.2', async (_command, args) =>
      args[1] === 'remove' ? { ok: false, stderr: 'MCP server invompt-local-beta not found' } : { ok: true },
    )
    await removeHost('claude-code', async () => ({ ok: false, stderr: 'No MCP server named invompt-local-beta' }))
    await expect(
      removeHost('claude-code', async () => ({ ok: false, stderr: 'No MCP server named invompt' })),
    ).rejects.toThrow('Unable to remove')
    await expect(removeHost('codex', async () => ({ ok: false, stderr: 'permission denied' }))).rejects.toThrow(
      'Unable to remove',
    )
    await expect(
      removeHost('codex', async () => ({ ok: false, stderr: 'configuration lock is held' })),
    ).rejects.toThrow('Unable to remove')
    const attempted: string[] = []
    await expect(
      configureHost('claude-code', 'guest', '0.11.2', async (command, args) => {
        attempted.push([command, ...args].join(' '))
        return { ok: false, stderr: 'permission denied' }
      }),
    ).rejects.toThrow('Unable to configure')
    expect(attempted).toEqual(['claude mcp remove invompt-local-beta'])
  })

  test('chooses logout behavior from the host binding mode and fails closed on Guest removal denial', async () => {
    const state = stateFixture()
    const keychain = secret('keychain', credential)
    state.write({
      schemaVersion: 1,
      epoch: 2,
      selectedMode: 'guest',
      guest: { status: 'active', backend: 'keychain' },
      bindings: { codex: { epoch: 2, mode: 'oauth', status: 'active' } },
    })
    const commands: string[] = []
    await logout('codex', {
      state,
      keychain,
      runner: async (command, args) => {
        commands.push([command, ...args].join(' '))
        return { ok: true }
      },
    })
    expect(commands).toEqual(['codex mcp logout invompt-local-beta'])
    await setup({ mode: 'guest', host: 'codex' }, { state, keychain, guestApi: guestApi(), runner: successfulRunner })
    await expect(
      logout('codex', { state, keychain, runner: async () => ({ ok: false, stderr: 'permission denied' }) }),
    ).rejects.toThrow('Unable to remove')
    expect(state.read().guest.status).toBe('active')
  })

  test('Guest logout keeps another active host binding and bridge guard usable', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    const deps = { state, keychain, guestApi: guestApi(), runner: successfulRunner }
    await setup({ mode: 'guest', host: 'codex' }, deps)
    await setup({ mode: 'guest', host: 'claude-code' }, deps)
    const codexBridge = resolveGuestCredentialForBridge('codex', deps)
    await logout('claude-code', deps)
    expect(state.read().guest.status).toBe('active')
    expect(state.read().bindings['claude-code']?.status).toBe('unconfigured')
    expect(codexBridge.guard()).toBe(true)
  })

  test('removes every known host registration before a global mode switch', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    state.write({
      schemaVersion: 1,
      epoch: 2,
      selectedMode: 'oauth',
      guest: { status: 'none' },
      bindings: { codex: { epoch: 2, mode: 'oauth', status: 'active' } },
    })
    const commands: string[] = []
    await setup(
      { mode: 'guest', host: 'claude-code' },
      {
        state,
        keychain,
        guestApi: guestApi(),
        runner: async (command, args) => {
          commands.push([command, ...args].join(' '))
          return { ok: true }
        },
      },
    )
    expect(commands.slice(0, 1)).toEqual(['codex mcp remove invompt-local-beta'])
    expect(state.read()).toMatchObject({
      selectedMode: 'guest',
      bindings: {
        codex: { epoch: 2, mode: 'oauth', status: 'unconfigured' },
        'claude-code': { mode: 'guest', status: 'active' },
      },
    })
  })

  test('blocks a global mode switch before credential issuance when host cleanup fails', async () => {
    const state = stateFixture()
    const keychain = secret('keychain')
    state.write({
      schemaVersion: 1,
      epoch: 2,
      selectedMode: 'oauth',
      guest: { status: 'none' },
      bindings: { codex: { epoch: 2, mode: 'oauth', status: 'active' } },
    })
    let issued = 0
    await expect(
      setup(
        { mode: 'guest', host: 'claude-code' },
        {
          state,
          keychain,
          guestApi: {
            ...guestApi(),
            issueCredential: async () => {
              issued += 1
              return credential
            },
          },
          runner: async () => ({ ok: false, stderr: 'permission denied' }),
        },
      ),
    ).rejects.toThrow('before switching Invompt mode')
    expect(issued).toBe(0)
    expect(state.read()).toMatchObject({
      selectedMode: 'oauth',
      bindings: { codex: { status: 'needs_reconcile', mode: 'oauth' } },
    })
  })

  test('acknowledges an unrecorded Keychain credential and preserves unresolved Guest statuses on OAuth setup', async () => {
    const state = stateFixture()
    const keychain = secret('keychain', credential)
    let acknowledgements = 0
    await setup(
      { mode: 'guest', host: 'codex' },
      {
        state,
        keychain,
        guestApi: {
          ...guestApi(),
          acknowledge: async () => {
            acknowledgements += 1
          },
        },
        runner: successfulRunner,
      },
    )
    expect(acknowledgements).toBe(1)
    state.write({ ...state.read(), guest: { status: 'unavailable', backend: 'keychain' } })
    await setup(
      { mode: 'oauth', host: 'claude-code' },
      { state, keychain, guestApi: guestApi(), runner: successfulRunner },
    )
    expect(state.read().guest.status).toBe('unavailable')
  })
})
