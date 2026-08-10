const REQUIRED_PACKED_FILES = [
  '.nvmrc',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.codex/agents/invoice-operator.toml',
  '.cursor/rules/invompt-invoice.mdc',
  'agents/invoice-operator.agent.md',
  'commands/invoice.md',
  'commands/invompt/invoice.toml',
  'dist/contracts.d.ts',
  'dist/contracts.js',
  'dist/error.d.ts',
  'dist/error.js',
  'dist/guest-credential.d.ts',
  'dist/guest-credential.js',
  'dist/bridge.d.ts',
  'dist/bridge.js',
  'dist/index.d.ts',
  'dist/index.js',
  'gemini-extension.json',
  'plugin.json',
  'qwen-extension.json',
  'runtime-support.json',
  'skills/invompt-invoice/SKILL.md',
  'THIRD_PARTY_NOTICES.md',
]

const VERSIONED_MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  'gemini-extension.json',
  'plugin.json',
  'qwen-extension.json',
]

const EXPECTED_PACKAGED_LAUNCHERS = [
  {
    asset: '.claude-plugin/plugin.json',
    command: 'node',
    target: 'dist/index.js',
  },
  {
    asset: 'gemini-extension.json',
    command: 'node',
    target: 'dist/index.js',
  },
  {
    asset: 'qwen-extension.json',
    command: 'node',
    target: 'dist/index.js',
  },
]

const EXPECTED_RUNTIMES = [
  { id: 'claude-code', artifact: '.claude-plugin/plugin.json', status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
  { id: 'codex', artifact: '.codex-plugin/plugin.json', status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
  { id: 'gemini-cli', artifact: 'gemini-extension.json', status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
  { id: 'qwen-code', artifact: 'qwen-extension.json', status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
]

const EXPECTED_SURFACES = [
  {
    id: 'stdio-bridge',
    artifact: 'dist/index.js',
    sourceVerificationCommand: 'npm run verify:pack',
    status: 'package-contract-verified',
    boundary: 'package',
  },
]

const OPERATIONAL_TOOL_SOURCES = Object.freeze([
  ['../mcp-core/src/tools/ping.ts', 'ping'],
  ['../mcp-core/src/tools/create-invoice.ts', 'create_invoice'],
  ['../mcp-core/src/tools/list-invoices.ts', 'list_invoices'],
  ['../mcp-core/src/tools/get-invoice.ts', 'get_invoice'],
  ['../mcp-core/src/tools/update-invoice.ts', 'update_invoice'],
  ['../mcp-core/src/tools/archive-invoice.ts', 'archive_invoice'],
  ['../mcp-core/src/tools/unarchive-invoice.ts', 'unarchive_invoice'],
  ['../mcp-core/src/tools/renew-invoice-link.ts', 'renew_invoice_link'],
  ['../mcp-core/src/tools/create-account-claim-link.ts', 'create_account_claim_link'],
  ['../mcp-core/src/tools/get-settings.ts', 'get_settings'],
  ['../mcp-core/src/tools/update-settings.ts', 'update_settings'],
  ['../mcp-core/src/tools/list-clients.ts', 'list_clients'],
  ['../mcp-core/src/tools/get-client.ts', 'get_client'],
  ['../mcp-core/src/tools/create-client.ts', 'create_client'],
  ['../mcp-core/src/tools/update-client.ts', 'update_client'],
  ['../mcp-core/src/tools/archive-client.ts', 'archive_client'],
])

const RETIRED_PACKED_ASSETS = ['.mcp.json', '.cursor/mcp.json', 'server.json']

export function verifyPackContract({
  packageJson,
  packEntries,
  repeatedPackEntries,
  packReportsIdentical,
  packedArtifactsIdentical,
  artifactSha256,
  artifactSha512,
  npmIntegrity,
  npmVersion,
  isolatedInstallBehavior,
  retainedPackagedLaunchers,
  packagedCredentialBehavior,
  exportedIssuerInstruction,
  exportedGuestInstructions,
  packagedDirectoryFsyncBehavior,
  readText,
  runtimeVersion,
}) {
  let assertionsExecuted = 0
  const checks = []

  function assert(condition, message) {
    assertionsExecuted += 1
    if (!condition) throw new Error(message)
    checks.push(message)
  }

  assert(/^v22\.22\.0$/.test(runtimeVersion), 'pack gate runs on the canonical Node 22.22.0 runtime')
  assert(packageJson.packageManager === 'npm@11.11.0', 'package manager is pinned to npm@11.11.0')
  assert(npmVersion === '11.11.0', 'pack gate runs with npm 11.11.0')
  assert(
    packageJson.dependencies === undefined || Object.keys(packageJson.dependencies).length === 0,
    'public package has zero runtime dependencies',
  )
  assert(Array.isArray(packEntries) && packEntries.length === 1, 'npm pack returned exactly one package entry')
  assert(packReportsIdentical === true, 'two npm pack dry-runs emit byte-for-byte identical JSON reports')
  assert(JSON.stringify(repeatedPackEntries) === JSON.stringify(packEntries), 'two npm pack reports parse identically')
  assert(packedArtifactsIdentical === true, 'two actual npm pack tarballs are byte-for-byte identical')
  assert(/^[a-f0-9]{64}$/.test(artifactSha256), 'actual packed artifact has a SHA-256 provenance digest')
  assert(/^[a-f0-9]{128}$/.test(artifactSha512), 'actual packed artifact has a SHA-512 provenance digest')
  assert(/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(npmIntegrity), 'actual packed artifact has npm integrity provenance')
  assert(
    isolatedInstallBehavior?.tarballOnly === true &&
      isolatedInstallBehavior?.registriesUnreachable === true &&
      isolatedInstallBehavior?.zeroRuntimeDependencies === true &&
      isolatedInstallBehavior?.initializeAndDiscoveryPassed === true &&
      isolatedInstallBehavior?.exactOriginPolicyPassed === true &&
      isolatedInstallBehavior?.siblingCoreAbsent === true &&
      isolatedInstallBehavior?.retainedLaunchersResolved === true &&
      isolatedInstallBehavior?.retainedLaunchersExecuted === true &&
      isolatedInstallBehavior?.cleanTypeScriptConsumerPassed === true,
    'the tarball installs offline, has no runtime dependency, launches every retained host config, and typechecks a clean consumer',
  )
  assert(
    JSON.stringify(retainedPackagedLaunchers) === JSON.stringify(EXPECTED_PACKAGED_LAUNCHERS),
    'the packed launcher inventory exactly contains Claude Code, Gemini CLI, and Qwen Code',
  )

  const pack = packEntries[0]
  assert(pack?.name === packageJson.name, 'packed package name matches package.json')
  assert(pack?.version === packageJson.version, 'packed package version matches package.json')
  assert(Array.isArray(pack?.files) && pack.files.length > 0, 'packed package contains files')

  const packedPaths = new Set(pack.files.map(({ path }) => path))
  for (const path of REQUIRED_PACKED_FILES) assert(packedPaths.has(path), `packed package includes ${path}`)
  for (const path of RETIRED_PACKED_ASSETS) assert(!packedPaths.has(path), `packed package excludes ${path}`)
  assert(![...packedPaths].some((path) => path.startsWith('plugin/')), 'packed package excludes the legacy nested plugin tree')
  assert(!packedPaths.has('dist/client.js'), 'packed package excludes the retired REST client')
  assert(!packedPaths.has('dist/http.js'), 'packed package excludes public HTTP server ownership')
  assert(!packedPaths.has('dist/device.js'), 'packed package excludes retired device implementation')
  assert(!packedPaths.has('dist/device.d.ts'), 'packed package excludes retired device declarations')
  assert(![...packedPaths].some((path) => path.startsWith('test/')), 'packed package excludes tests')

  for (const path of VERSIONED_MANIFESTS) {
    const manifest = JSON.parse(readText(path))
    assert(manifest.version === packageJson.version, `${path} version matches package.json`)
  }

  const runtimeSupport = JSON.parse(readText('runtime-support.json'))
  assert(runtimeSupport.canonicalHosts?.localMcp === 'http://localhost:3101/mcp', 'local MCP endpoint is canonical')
  assert(
    runtimeSupport.transportPolicy?.default === 'exact-loopback-mcp' &&
      runtimeSupport.transportPolicy?.optionalExplicitTrustedHttpsOrigins === true,
    'runtime support documents the transport-neutral exact-origin policy',
  )
  assert(Object.keys(runtimeSupport.canonicalHosts ?? {}).length === 1, 'runtime support advertises no endpoint beyond exact loopback MCP')
  assert(runtimeSupport.releaseChannel?.status === 'public-development-pre-1.0', 'runtime support states pre-1.0 public development status')
  assert(runtimeSupport.releaseChannel?.next === 'development-only', 'runtime support limits next to development use')
  assert(runtimeSupport.releaseChannel?.externalRegistryVerificationRequired === true, 'runtime support requires external registry verification')
  assert(runtimeSupport.verificationContract?.scope === 'source-repository', 'verification scope is source-repository')
  assert(runtimeSupport.verificationContract?.sourceCommand === 'npm run verify:pack', 'source verification command is exact')
  assert(runtimeSupport.verificationContract?.successStatus === 'passed', 'runtime verification success status is exact')
  assert(
    JSON.stringify(runtimeSupport.runtimes) === JSON.stringify(EXPECTED_RUNTIMES),
    'runtime matrix exactly matches package-contract-only host claims',
  )
  assert(
    JSON.stringify(runtimeSupport.surfaces) === JSON.stringify(EXPECTED_SURFACES),
    'surface matrix exactly matches package-owned verified artifacts',
  )

  assert(
    packagedDirectoryFsyncBehavior?.win32Fsync === false &&
      packagedDirectoryFsyncBehavior?.win32Persistence === false &&
      packagedDirectoryFsyncBehavior?.linuxFsync === true &&
      packagedDirectoryFsyncBehavior?.linuxPersistence === true,
    'packed credential persistence fails before mutation on Windows and uses directory fsync on Linux',
  )
  assert(
    packagedCredentialBehavior?.canonicalAccepted === true &&
      packagedCredentialBehavior?.leadingWhitespaceRejected === true &&
      packagedCredentialBehavior?.trailingWhitespaceRejected === true &&
      packagedCredentialBehavior?.nonCanonicalNonceRejected === true &&
      packagedCredentialBehavior?.nonCanonicalMacRejected === true,
    'packed credential parser requires exact canonical 32-byte base64url segments',
  )

  const packageSource = readText('package.json')
  assert(packageSource.includes('"./contracts"'), 'package exports the shared contracts subpath')
  assert(
    exportedIssuerInstruction === 'issuer may be omitted; never invent issuer identity',
    'public contracts subpath exports the exact issuer instruction',
  )
  assert(
    exportedGuestInstructions.includes('create_account_claim_link') &&
      exportedGuestInstructions.includes('present claimUrl exactly once') &&
      exportedGuestInstructions.includes('GUEST_ACCOUNT_CLAIMED'),
    'public contracts subpath documents the operational link-first Guest claim flow',
  )
  assert(
    readText('src/contracts.ts') === readText('../mcp-core/src/contracts.ts'),
    'self-contained public contract stays byte-identical to the separately packable core contract',
  )
  const credentialSource = readText('src/guest-credential.ts')
  assert(
    credentialSource.includes(String.raw`^inv_gd_v1\.[a-z0-9]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$`),
    'guest credential validator matches the exact kid/nonce/MAC envelope',
  )
  assert(credentialSource.includes('guest-credential'), 'credential source uses the canonical private filename')
  assert(credentialSource.includes('INVOMPT_GUEST_CREDENTIAL'), 'credential source uses the canonical environment name')
  assert(credentialSource.includes('X-Invompt-Guest-Credential'), 'credential source exports the canonical MCP header')
  assert(!readText('dist/bridge.js').includes('/api/guest/v1'), 'bridge excludes product guest business routes')
  assert(readText('dist/bridge.js').includes('http://localhost:3101/mcp'), 'packed bridge retains the exact loopback MCP default')
  assert(readText('dist/bridge.js').includes("redirect: 'error'"), 'packed bridge refuses HTTP redirects')
  for (const path of ['dist/index.d.ts', 'dist/bridge.d.ts', 'dist/guest-credential.d.ts']) {
    assert(!readText(path).includes('@modelcontextprotocol/sdk'), `${path} has no public SDK type dependency`)
    assert(!readText(path).includes('NodeJS.'), `${path} has no public Node namespace type dependency`)
  }

  const readme = readText('README.md')
  assert(readme.includes('public-development, pre-1.0'), 'packaged README states the public-development pre-1.0 status')
  assert(readme.includes('http://localhost:3101/mcp'), 'packaged README limits the bridge to the exact loopback transport')
  assert(readme.includes('does not execute invoice tools') && readme.includes('no runtime dependencies'), 'packaged README limits bridge responsibility and dependencies')
  assert(readme.includes('no supported external registry installation flow'), 'packaged README advertises no external Phase 1 registry setup')
  assert(readme.includes('Verify live registry state'), 'packaged README treats registry state as externally verified')
  assert(readme.includes('external registry availability or host compatibility'), 'packaged README makes no unverified installation claim')
  assert(readme.includes('development builds') && readme.includes('not a production channel'), 'packaged README limits next to development use')
  assert(readText('THIRD_PARTY_NOTICES.md').includes('@modelcontextprotocol/sdk@1.30.0'), 'packed package includes deterministic bundled third-party notices')

  const gettingStartedSource = readText('../mcp-core/src/resources/getting-started.ts')
  assert(!gettingStartedSource.includes('API key'), 'getting-started resource advertises no API-key setup')
  assert(!gettingStartedSource.includes('invompt.com/integrations'), 'getting-started resource advertises no account setup URL')
  assert(!gettingStartedSource.includes('INVOMPT_GUEST_CREDENTIAL'), 'getting-started resource exposes no credential materialization instructions')
  assert(!gettingStartedSource.includes('~/.invompt/'), 'getting-started resource exposes no private credential path')
  assert(
    gettingStartedSource.includes('exactly 16 operational tools') &&
      gettingStartedSource.includes('create_account_claim_link') &&
      gettingStartedSource.includes('Present claimUrl exactly once') &&
      gettingStartedSource.includes('GUEST_ACCOUNT_CLAIMED') &&
      gettingStartedSource.includes('server-issued Guest credential'),
    'getting-started resource documents the input-free link-first Guest claim flow',
  )
  const createAccountClaimLinkSource = readText('../mcp-core/src/tools/create-account-claim-link.ts')
  assert(
    createAccountClaimLinkSource.includes("'create_account_claim_link'") &&
      createAccountClaimLinkSource.includes('inputSchema: {}') &&
      createAccountClaimLinkSource.includes('client.isGuest()') &&
      createAccountClaimLinkSource.includes('ACCOUNT_CLAIM_OAUTH_FORBIDDEN') &&
      createAccountClaimLinkSource.includes('client.createAccountClaimLink()') &&
      createAccountClaimLinkSource.includes('readOnlyHint: false') &&
      createAccountClaimLinkSource.includes('idempotentHint: false') &&
      createAccountClaimLinkSource.includes('openWorldHint: false') &&
      !createAccountClaimLinkSource.includes('replayed'),
    'create_account_claim_link is Guest-only, input-free, and annotated as a closed non-idempotent mutation',
  )
  const skillSource = readText('skills/invompt-invoice/SKILL.md')
  const skillMirror = readText('.agents/skills/invompt-invoice/SKILL.md')
  const surfaceSource = readText('skills/invompt-invoice/references/mcp-surface.md')
  const surfaceMirror = readText('.agents/skills/invompt-invoice/references/mcp-surface.md')
  assert(skillSource === skillMirror, 'packaged skill and generated agent mirror are byte-identical')
  assert(surfaceSource === surfaceMirror, 'packaged MCP reference and generated agent mirror are byte-identical')
  assert(
    skillSource.includes('Public deployment is Guest-only') &&
      skillSource.includes('create_account_claim_link') &&
      skillSource.includes('GUEST_ACCOUNT_CLAIMED'),
    'packaged skill documents the operational link-first Guest account claim',
  )
  assert(
    surfaceSource.includes('exactly 16 operational tools') &&
      surfaceSource.includes('create_account_claim_link') &&
      surfaceSource.includes('GUEST_ACCOUNT_CLAIMED'),
    'packaged MCP reference documents the operational link-first Guest account claim',
  )
  assert(OPERATIONAL_TOOL_SOURCES.length === 16, 'pack-contract inspects the exact 16 operational tool sources')
  for (const [path, toolName] of OPERATIONAL_TOOL_SOURCES) {
    const contents = readText(path)
    assert(
      contents.includes(`'${toolName}'`) || contents.includes(`\"${toolName}\"`),
      `${path} exposes operational tool registration for ${toolName}`,
    )
    if (toolName === 'create_account_claim_link') {
      assert(
        contents.includes('client.isGuest()') && contents.includes('ACCOUNT_CLAIM_OAUTH_FORBIDDEN'),
        `${path} is explicitly Guest-only and fails closed for OAuth`,
      )
    } else {
      assert(
        !/connected Guest workspace|guest or account|account or guest|guest-company/i.test(contents),
        `${path} remains authentication-neutral for adapter composition`,
      )
    }
  }
  for (const [path, contents] of [
    ['skills/invompt-invoice/SKILL.md', skillSource],
    ['skills/invompt-invoice/references/mcp-surface.md', surfaceSource],
  ]) {
    assert(
      contents.includes('exactly 16 operational tools') &&
        contents.includes('create_account_claim_link') &&
        contents.includes('GUEST_ACCOUNT_CLAIMED'),
      `${path} documents the operational link-first Guest account claim`,
    )
  }

  const bannedHostAssetTerms = [
    'npx',
    '--prefer-offline',
    `invompt-mcp@${packageJson.version}`,
    'https://mcp.invompt.com',
    'test:mcp:hosts:guest',
    'deferred-p3',
    '"boundary": "product"',
  ]
  const packedTextAssets = [...packedPaths].filter((path) => /\.(?:c?js|d\.ts|json|md|mdc|toml|yaml)$/.test(path))
  for (const path of packedTextAssets) {
    const contents = readText(path)
    for (const term of bannedHostAssetTerms) assert(!contents.includes(term), `${path} excludes ${term}`)
  }

  const credentialLiteralPattern = /inv_gd_v1\.[a-z0-9]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}/
  const historicalContractAllowlist = new Set(['CHANGELOG.md'])
  const retiredContractPatterns = [
    { pattern: /\bunlimited\b/i, label: 'retired no-limit advertising' },
    { pattern: /\bquota(?:used|limit)?\b/i, label: 'retired commercial limit fields' },
    { pattern: /\banonymous\b/i, label: 'retired anonymous terminology' },
  ]
  for (const path of packedPaths) {
    if (!/\.(?:c?js|d\.ts|json|md|toml|yaml)$/.test(path)) continue
    const contents = readText(path)
    assert(!credentialLiteralPattern.test(contents), `${path} contains no materialized guest credential`)
    if (historicalContractAllowlist.has(path) || path === 'dist/index.js') continue
    for (const { pattern, label } of retiredContractPatterns) assert(!pattern.test(contents), `${path} excludes ${label}`)
  }

  for (const path of ['README.md', 'src/bridge.ts', 'src/index.ts']) {
    const source = readText(path)
    assert(!source.includes('https://www.invompt.com'), `${path} excludes the non-canonical Web host`)
    assert(!source.includes('X-Invompt-Device-ID'), `${path} excludes the retired device header`)
    assert(!source.includes('~/.invompt/device-id'), `${path} excludes the retired device file`)
  }

  assert(assertionsExecuted > 0, 'pack gate executes non-zero assertions')
  return {
    status: 'passed',
    package: `${packageJson.name}@${packageJson.version}`,
    assertionsExecuted,
    packedFileCount: pack.files.length,
    artifactSha256,
    artifactSha512,
    npmIntegrity,
    retainedPackagedLaunchers,
    isolatedInstallBehavior,
    checks,
  }
}
