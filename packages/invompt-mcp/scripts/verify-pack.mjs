import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { verifyPackContract } from './pack-contract.mjs'
import {
  createIsolatedNpmEnvironment,
  isolatedNpmArguments,
  isUnreachableIsolatedRegistryProbe,
} from './registry-isolation.mjs'
import { verifyPackageFileManifest } from '../../../scripts/package-file-manifests.mjs'
import { assertPublishableWorkspacesCovered } from '../../../scripts/verify-package-files.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(repositoryRoot, '../..')
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
const {
  GUEST_MCP_INSTRUCTIONS: exportedGuestInstructions,
  ISSUER_IDENTITY_INSTRUCTION: exportedIssuerInstruction,
} = await import('invompt-mcp/contracts')
const {
  shouldFsyncCredentialDirectory,
  supportsGuestCredentialFilePersistence,
  validateGuestCredential,
} = await import('invompt-mcp')
const canonicalNonce = Buffer.alloc(32, 0).toString('base64url')
const canonicalMac = Buffer.alloc(32, 1).toString('base64url')
const canonicalCredential = `inv_gd_v1.pack.${canonicalNonce}.${canonicalMac}`
const nonCanonicalNonce = `${canonicalNonce.slice(0, -1)}B`
const nonCanonicalMac = `${canonicalMac.slice(0, -1)}R`

function credentialRejected(value) {
  try {
    validateGuestCredential(value)
    return false
  } catch {
    return true
  }
}

const npmVersionResult = spawnSync('npm', ['--version'], { cwd: repositoryRoot, encoding: 'utf8' })
if (npmVersionResult.status !== 0) throw new Error('Unable to verify the npm runtime version')

function runPack() {
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  if (packed.error) throw packed.error
  if (packed.status !== 0) throw new Error(`npm pack failed with exit ${packed.status}: ${packed.stderr.trim()}`)
  try {
    return { entries: JSON.parse(packed.stdout), raw: packed.stdout }
  } catch {
    throw new Error('npm pack did not produce valid JSON')
  }
}

const firstPack = runPack()
const repeatedPack = runPack()
const artifactRoots = [
  mkdtempSync(resolve(tmpdir(), 'invompt-mcp-pack-a-')),
  mkdtempSync(resolve(tmpdir(), 'invompt-mcp-pack-b-')),
]
const isolatedConsumerRoot = mkdtempSync(resolve(tmpdir(), 'invompt-mcp-consumer-'))
const artifactBuffers = []
const artifactReports = []
const artifactPaths = []
let isolatedInstallBehavior
let retainedPackagedLaunchers
let packageFileManifests

try {
  assertPublishableWorkspacesCovered()
  packageFileManifests = [
    verifyPackageFileManifest({
      packageName: packageJson.name,
      packEntry: firstPack.entries[0],
      packageRoot: repositoryRoot,
    }),
  ]
  const privacyScan = spawnSync('node', [resolve(workspaceRoot, 'scripts/privacy-secret-scan.mjs'), '--source', '--packed'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  if (privacyScan.status !== 0) throw new Error(`tracked and packed privacy scan failed: ${privacyScan.stderr.trim()}`)

  for (const destination of artifactRoots) {
    const packed = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    })
    if (packed.status !== 0) {
      throw new Error(`npm pack artifact build failed with exit ${packed.status}: ${packed.stderr.trim()}`)
    }
    const entries = JSON.parse(packed.stdout)
    if (!Array.isArray(entries) || entries.length !== 1 || typeof entries[0]?.filename !== 'string') {
      throw new Error('npm pack artifact build returned an invalid JSON report')
    }
    const artifactPath = resolve(destination, entries[0].filename)
    artifactPaths.push(artifactPath)
    artifactBuffers.push(readFileSync(artifactPath))
    artifactReports.push(entries[0])
  }

  writeFileSync(
    resolve(isolatedConsumerRoot, 'package.json'),
    `${JSON.stringify({ name: 'invompt-mcp-isolated-pack-consumer', private: true, type: 'module' }, null, 2)}\n`,
  )
  writeFileSync(
    resolve(isolatedConsumerRoot, 'isolated.npmrc'),
    'registry=http://127.0.0.1:9/\n@invompt:registry=http://127.0.0.1:9/\n',
  )
  writeFileSync(resolve(isolatedConsumerRoot, 'isolated-global.npmrc'), '')
  const isolatedNpmrcPath = resolve(isolatedConsumerRoot, 'isolated.npmrc')
  const isolatedGlobalNpmrcPath = resolve(isolatedConsumerRoot, 'isolated-global.npmrc')
  const offlineNpmEnvironment = createIsolatedNpmEnvironment(process.env, resolve(isolatedConsumerRoot, '.npm-cache'))
  const offlineNpmArguments = isolatedNpmArguments(isolatedNpmrcPath, isolatedGlobalNpmrcPath)
  const publicRegistryProbe = spawnSync(
    'npm',
    [
      'view',
      'invompt-mcp-offline-proof-not-a-package',
      'version',
      '--fetch-retries=0',
      '--fetch-timeout=1000',
      ...offlineNpmArguments,
    ],
    { cwd: isolatedConsumerRoot, encoding: 'utf8', env: offlineNpmEnvironment },
  )
  const scopedRegistryProbe = spawnSync(
    'npm',
    ['view', '@invompt/offline-proof-not-a-package', 'version', '--fetch-retries=0', '--fetch-timeout=1000', ...offlineNpmArguments],
    { cwd: isolatedConsumerRoot, encoding: 'utf8', env: offlineNpmEnvironment },
  )
  if (!isUnreachableIsolatedRegistryProbe(publicRegistryProbe) || !isUnreachableIsolatedRegistryProbe(scopedRegistryProbe)) {
    throw new Error('isolated registry probes did not prove the exact loopback registry was unreachable')
  }

  const installed = spawnSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', artifactPaths[0], ...offlineNpmArguments],
    { cwd: isolatedConsumerRoot, encoding: 'utf8', env: offlineNpmEnvironment },
  )
  if (installed.status !== 0) {
    throw new Error(`isolated tarball install failed with exit ${installed.status}: ${installed.stderr.trim()}`)
  }

  const installedPackageRoot = resolve(isolatedConsumerRoot, 'node_modules/invompt-mcp')
  const installedPackageJson = JSON.parse(readFileSync(resolve(installedPackageRoot, 'package.json'), 'utf8'))
  const packedJsonAssets = firstPack.entries[0].files
    .map(({ path }) => path)
    .filter((path) => path.endsWith('.json') && path !== 'package.json')
  for (const asset of packedJsonAssets) {
    const manifest = JSON.parse(readFileSync(resolve(installedPackageRoot, asset), 'utf8'))
    if (Object.hasOwn(manifest, 'mcpServers')) throw new Error(`${asset} contains a static MCP transport`)
  }
  retainedPackagedLaunchers = []
  const statusProbe = spawnSync(process.execPath, [resolve(installedPackageRoot, 'dist/index.js'), 'status', '--json'], {
    cwd: installedPackageRoot,
    encoding: 'utf8',
    env: { ...process.env, HOME: isolatedConsumerRoot, USERPROFILE: isolatedConsumerRoot },
  })
  if (statusProbe.status !== 0) throw new Error(`installed onboarding status probe failed: ${statusProbe.stderr.trim()}`)
  const status = JSON.parse(statusProbe.stdout)
  if (status.selectedMode !== null || status.guest?.status !== 'none') {
    throw new Error('installed onboarding status probe did not return redacted initial state')
  }

  const isolatedProbe = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      String.raw`
        import assert from 'node:assert/strict'
        import { startBridge, validatePrivateMcpUrl } from 'invompt-mcp'
        import { GUEST_MCP_INSTRUCTIONS, ISSUER_IDENTITY_INSTRUCTION } from 'invompt-mcp/contracts'

        const operationalToolNames = [
          'ping', 'create_invoice', 'list_invoices', 'get_invoice', 'update_invoice',
          'list_invoice_templates', 'get_invoice_template', 'preview_invoice_template_extraction', 'save_invoice_as_template',
          'archive_invoice', 'unarchive_invoice', 'renew_invoice_link', 'send_invoice_email', 'create_account_claim_link', 'get_settings',
          'update_settings', 'list_clients', 'get_client', 'create_client', 'update_client',
          'archive_client',
        ]
        const toolNames = [...operationalToolNames]
        const resourceNames = ['getting-started', 'invoml-spec']
        const promptNames = ['draft_invoice_invoml']
        const responses = {
          initialize: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {}, resources: {}, prompts: {} },
            serverInfo: { name: 'isolated-private-mcp-fixture', version: '1.0.0' },
          },
          'tools/list': {
            tools: toolNames.map((name) => ({
              name,
              description: 'Operational tool.',
              inputSchema: { type: 'object' },
            })),
          },
          'resources/list': { resources: resourceNames.map((name) => ({ name, uri: 'invompt://fixture/' + name })) },
          'prompts/list': { prompts: promptNames.map((name) => ({ name })) },
        }

        class FixtureTransport {
          constructor(remote = false) { this.remote = remote; this.sent = []; this.started = false }
          async start() { this.started = true }
          async close() {}
          async send(message) {
            this.sent.push(message)
            if (this.remote && 'method' in message) {
              const result = responses[message.method]
              if (result) this.onmessage?.({ jsonrpc: '2.0', id: message.id, result })
            }
          }
        }

        const stdio = new FixtureTransport()
        const remote = new FixtureTransport(true)
        await startBridge({ guestCredential: 'isolated-fixture', stdioTransport: stdio, remoteTransport: remote })
        const methods = ['initialize', 'tools/list', 'resources/list', 'prompts/list']
        for (const [index, method] of methods.entries()) {
          stdio.onmessage?.({
            jsonrpc: '2.0',
            id: index + 1,
            method,
            ...(method === 'initialize'
              ? { params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'pack-probe', version: '1' } } }
              : {}),
          })
          await new Promise((resolve) => setImmediate(resolve))
        }

        assert.equal(stdio.started, true)
        assert.equal(remote.started, true)
        assert.deepEqual(remote.sent.map(({ method }) => method), methods)
        assert.deepEqual(stdio.sent[1].result.tools.map(({ name }) => name), toolNames)
        assert.equal(operationalToolNames.length, 21)
        assert.equal(toolNames.includes('create_account_claim_link'), true)
        assert.deepEqual(stdio.sent[2].result.resources.map(({ name }) => name), resourceNames)
        assert.deepEqual(stdio.sent[3].result.prompts.map(({ name }) => name), promptNames)
        assert.equal(ISSUER_IDENTITY_INSTRUCTION, 'issuer may be omitted; never invent issuer identity')
        assert.match(GUEST_MCP_INSTRUCTIONS, /create_account_claim_link.*present claimUrl exactly once.*GUEST_ACCOUNT_CLAIMED/)
        assert.equal(validatePrivateMcpUrl('http://localhost:3101/mcp').href, 'http://localhost:3101/mcp')
        assert.throws(() => validatePrivateMcpUrl('https://credential-sink.example/mcp'))
        assert.equal(
          validatePrivateMcpUrl('https://mcp.example.invalid/mcp', ['https://mcp.example.invalid']).href,
          'https://mcp.example.invalid/mcp',
        )
        assert.throws(() => validatePrivateMcpUrl('https://mcp.example.invalid/mcp', ['https://*.example.invalid']))
      `,
    ],
    { cwd: isolatedConsumerRoot, encoding: 'utf8' },
  )
  if (isolatedProbe.status !== 0) {
    throw new Error(`isolated initialize/discovery probe failed with exit ${isolatedProbe.status}: ${isolatedProbe.stderr.trim()}`)
  }

  writeFileSync(
    resolve(isolatedConsumerRoot, 'consumer.ts'),
    `import {
  startBridge,
  validatePrivateMcpUrl,
  type JsonRpcMessage,
  type MessageTransport,
  type StartBridgeOptions,
} from 'invompt-mcp'
import { ISSUER_IDENTITY_INSTRUCTION } from 'invompt-mcp/contracts'

const message: JsonRpcMessage = { jsonrpc: '2.0', id: 1, method: 'ping' }
const transport: MessageTransport = {
  async start() {},
  async close() {},
  async send(value) { void value },
}
const options: StartBridgeOptions = { stdioTransport: transport, remoteTransport: transport }
void startBridge
void validatePrivateMcpUrl
void ISSUER_IDENTITY_INSTRUCTION
void message
void options
`,
  )
  writeFileSync(
    resolve(isolatedConsumerRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          lib: ['ES2022', 'DOM'],
        },
        files: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
  )
  const typeScriptConsumer = spawnSync(
    process.execPath,
    [resolve(workspaceRoot, 'node_modules/typescript/bin/tsc'), '--project', resolve(isolatedConsumerRoot, 'tsconfig.json')],
    { cwd: isolatedConsumerRoot, encoding: 'utf8' },
  )
  if (typeScriptConsumer.status !== 0) {
    throw new Error(`isolated TypeScript consumer failed with exit ${typeScriptConsumer.status}: ${typeScriptConsumer.stdout.trim()} ${typeScriptConsumer.stderr.trim()}`)
  }

  const dependencyTree = spawnSync('npm', ['ls', '--all', '--json'], {
    cwd: isolatedConsumerRoot,
    encoding: 'utf8',
    env: offlineNpmEnvironment,
  })
  if (dependencyTree.status !== 0) {
    throw new Error(`isolated dependency inspection failed with exit ${dependencyTree.status}: ${dependencyTree.stderr.trim()}`)
  }
  const dependencyJson = JSON.parse(dependencyTree.stdout)
  const installedRuntimeDependencies = installedPackageJson.dependencies ?? {}
  const packageTree = dependencyJson.dependencies?.['invompt-mcp']
  isolatedInstallBehavior = {
    tarballOnly: true,
    registriesUnreachable: publicRegistryProbe.status !== 0 && scopedRegistryProbe.status !== 0,
    zeroRuntimeDependencies:
      Object.keys(installedRuntimeDependencies).length === 0 &&
      (packageTree?.dependencies === undefined || Object.keys(packageTree.dependencies).length === 0),
    initializeAndDiscoveryPassed: true,
    exactOriginPolicyPassed: true,
    siblingCoreAbsent: !dependencyTree.stdout.includes('@invompt/mcp-core'),
    noStaticMcpTransport: retainedPackagedLaunchers.length === 0,
    cleanTypeScriptConsumerPassed: true,
  }
} finally {
  for (const destination of artifactRoots) rmSync(destination, { recursive: true, force: true })
  rmSync(isolatedConsumerRoot, { recursive: true, force: true })
}

const artifactSha256 = createHash('sha256').update(artifactBuffers[0]).digest('hex')
const artifactSha512 = createHash('sha512').update(artifactBuffers[0]).digest('hex')
const npmIntegrity = `sha512-${createHash('sha512').update(artifactBuffers[0]).digest('base64')}`
if (
  artifactReports.length !== 2 ||
  artifactReports[0].integrity !== npmIntegrity ||
  artifactReports[1].integrity !== npmIntegrity
) {
  throw new Error('npm pack integrity metadata does not match the actual tarball bytes')
}

const result = verifyPackContract({
  packageJson,
  packEntries: firstPack.entries,
  repeatedPackEntries: repeatedPack.entries,
  packReportsIdentical: firstPack.raw === repeatedPack.raw,
  packedArtifactsIdentical:
    artifactBuffers.length === 2 &&
    artifactBuffers[0].length === artifactBuffers[1].length &&
    artifactBuffers[0].equals(artifactBuffers[1]),
  artifactSha256,
  artifactSha512,
  npmIntegrity,
  npmVersion: npmVersionResult.stdout.trim(),
  isolatedInstallBehavior,
  retainedPackagedLaunchers,
  exportedIssuerInstruction,
  exportedGuestInstructions,
  packagedCredentialBehavior: {
    canonicalAccepted: validateGuestCredential(canonicalCredential) === canonicalCredential,
    leadingWhitespaceRejected: credentialRejected(` ${canonicalCredential}`),
    trailingWhitespaceRejected: credentialRejected(`${canonicalCredential}\n`),
    nonCanonicalNonceRejected: credentialRejected(`inv_gd_v1.pack.${nonCanonicalNonce}.${canonicalMac}`),
    nonCanonicalMacRejected: credentialRejected(`inv_gd_v1.pack.${canonicalNonce}.${nonCanonicalMac}`),
  },
  packagedDirectoryFsyncBehavior: {
    win32Fsync: shouldFsyncCredentialDirectory('win32'),
    win32Persistence: supportsGuestCredentialFilePersistence('win32'),
    linuxFsync: shouldFsyncCredentialDirectory('linux'),
    linuxPersistence: supportsGuestCredentialFilePersistence('linux'),
  },
  readText: (path) => readFileSync(resolve(repositoryRoot, path), 'utf8'),
  runtimeVersion: process.version,
})

process.stdout.write(`${JSON.stringify({ ...result, packageFileManifests }, null, 2)}\n`)
