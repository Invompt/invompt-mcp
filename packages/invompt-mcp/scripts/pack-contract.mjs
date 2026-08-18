const REQUIRED_PACKED_FILES = [
  '.nvmrc',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.codex/agents/invompt-local-beta-invoice-operator.toml',
  '.cursor/rules/invompt-local-beta-invoice.mdc',
  'agents/invompt-local-beta-invoice-operator.agent.md',
  'commands/invompt-local-beta-invoice.md',
  'commands/invompt-local-beta/invoice.toml',
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
  'dist/onboarding/guest-api.d.ts',
  'dist/onboarding/guest-api.js',
  'dist/onboarding/host-config.d.ts',
  'dist/onboarding/host-config.js',
  'dist/onboarding/secret-store.d.ts',
  'dist/onboarding/secret-store.js',
  'dist/onboarding/service.d.ts',
  'dist/onboarding/service.js',
  'dist/onboarding/state.d.ts',
  'dist/onboarding/state.js',
  'dist/onboarding/types.d.ts',
  'dist/onboarding/types.js',
  'gemini-extension.json',
  'plugin.json',
  'qwen-extension.json',
  'runtime-support.json',
  'skills/invompt-local-beta-invoice/SKILL.md',
  'skills/invompt-local-beta-onboarding/SKILL.md',
  'skills/invompt-local-beta-onboarding/agents/openai.yaml',
  '.agents/skills/invompt-local-beta-onboarding/SKILL.md',
  '.agents/skills/invompt-local-beta-onboarding/agents/openai.yaml',
  'THIRD_PARTY_NOTICES.md',
]

const VERSIONED_MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  'gemini-extension.json',
  'plugin.json',
  'qwen-extension.json',
]

const EXPECTED_PACKAGED_LAUNCHERS = []

const EXPECTED_RUNTIMES = [
  { id: 'claude-code', artifact: '.claude-plugin/plugin.json', scope: 'local-beta-macos', modes: ['guest-stdio', 'oauth-http'], status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
  { id: 'codex', artifact: '.codex-plugin/plugin.json', scope: 'local-beta-macos', modes: ['guest-stdio', 'oauth-http'], status: 'package-contract-verified', freshHostStatus: 'external-verification-required' },
  { id: 'chatgpt-web', scope: 'remote', modes: ['oauth-http'], status: 'remote-oauth-only', localDeviceState: 'not-used', freshHostStatus: 'external-verification-required' },
]

const EXPECTED_TEMPLATES = [
  { id: 'gemini-cli', artifact: 'gemini-extension.json', status: 'template-not-supported' },
  { id: 'qwen-code', artifact: 'qwen-extension.json', status: 'template-not-supported' },
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
const RETIRED_DISCOVERY_PATHS = [
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
      isolatedInstallBehavior?.noStaticMcpTransport === true &&
      isolatedInstallBehavior?.cleanTypeScriptConsumerPassed === true,
    'the tarball installs offline, has no runtime dependency or static MCP transport, and typechecks a clean consumer',
  )
  assert(
    JSON.stringify(retainedPackagedLaunchers) === JSON.stringify(EXPECTED_PACKAGED_LAUNCHERS),
    'the packed launcher inventory contains no static MCP transport',
  )

  const pack = packEntries[0]
  assert(pack?.name === packageJson.name, 'packed package name matches package.json')
  assert(pack?.version === packageJson.version, 'packed package version matches package.json')
  assert(Array.isArray(pack?.files) && pack.files.length > 0, 'packed package contains files')

  const packedPaths = new Set(pack.files.map(({ path }) => path))
  for (const path of REQUIRED_PACKED_FILES) assert(packedPaths.has(path), `packed package includes ${path}`)
  for (const path of RETIRED_PACKED_ASSETS) assert(!packedPaths.has(path), `packed package excludes ${path}`)
  for (const path of RETIRED_DISCOVERY_PATHS) {
    assert(
      ![...packedPaths].some((packedPath) => packedPath === path || packedPath.startsWith(path)),
      `packed package excludes retired discovery path ${path}`,
    )
  }
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
  assert(runtimeSupport.schemaVersion === 2, 'runtime support schema is current')
  assert(runtimeSupport.pluginIdentity === 'invompt-local-beta', 'runtime support records the isolated beta plugin identity')
  assert(
    JSON.stringify(runtimeSupport.skillIdentities) ===
      JSON.stringify(['invompt-local-beta-invoice', 'invompt-local-beta-onboarding']),
    'runtime support records only isolated beta skill identities',
  )
  assert(
    runtimeSupport.endpoints?.hostedMcp === 'https://mcp.invompt.com/mcp' &&
      runtimeSupport.endpoints?.webCredentialLifecycle === 'https://invompt.com' &&
      runtimeSupport.endpoints?.loopbackDevelopmentMcp === 'http://localhost:3101/mcp',
    'runtime support records hosted, Web lifecycle, and loopback-development endpoints',
  )
  assert(runtimeSupport.releaseChannel?.status === 'local-beta-pre-1.0', 'runtime support states local beta pre-1.0 status')
  assert(runtimeSupport.releaseChannel?.next === 'development-only', 'runtime support limits next to development use')
  assert(runtimeSupport.releaseChannel?.externalRegistryVerificationRequired === true, 'runtime support requires external registry verification')
  assert(runtimeSupport.releaseChannel?.productionClaim === false, 'runtime support makes no production claim')
  assert(
    runtimeSupport.localState?.authState === '~/.invompt/auth-state.json' &&
      runtimeSupport.localState?.fileFallback === '~/.invompt/guest-credential only with --allow-file-fallback' &&
      runtimeSupport.localState?.guestToOauth === 'Guest remains dormant when OAuth is selected',
    'runtime support records local state and dormant Guest switching semantics',
  )
  assert(
    JSON.stringify(runtimeSupport.runtimes) === JSON.stringify(EXPECTED_RUNTIMES),
    'runtime matrix exactly matches package-contract-only host claims',
  )
  assert(JSON.stringify(runtimeSupport.templates) === JSON.stringify(EXPECTED_TEMPLATES), 'runtime support labels Gemini and Qwen as unsupported templates')
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
  const coreReadme = readText('../mcp-core/README.md')
  assert(
    !coreReadme.includes('input-free Guest-only mutation') &&
      !coreReadme.includes('Guest claim-link creation is rejected for OAuth'),
    'mcp-core README excludes stale Guest-only and OAuth-rejection claims',
  )
  assert(
    coreReadme.includes('Guest-account-only') &&
      coreReadme.includes('hosted OAuth Guest') &&
      coreReadme.includes('backend is authoritative for eligibility'),
    'mcp-core README documents hosted OAuth Guest and backend-authoritative eligibility',
  )
  assert(readme.includes('https://mcp.invompt.com/mcp'), 'packaged README records the hosted MCP endpoint')
  assert(readme.includes('http://localhost:3101/mcp'), 'packaged README records the loopback development endpoint')
  assert(
    readme.includes('does not contain invoice business logic') && readme.includes('no runtime dependencies'),
    'packaged README limits bridge responsibility and dependencies',
  )
  assert(readme.includes('npx --yes invompt-mcp@0.11.0 setup --host codex'), 'packaged README pins Codex setup to 0.11.0')
  assert(readme.includes('npx --yes invompt-mcp@0.11.0 setup --host claude-code'), 'packaged README pins Claude setup to 0.11.0')
  assert(readme.includes('--allow-file-fallback') && readme.includes('auth-state.json'), 'packaged README documents explicit fallback and state paths')
  assert(readme.includes('no postinstall prompt'), 'packaged README states that setup has no postinstall prompt')
  assert(readme.includes('ChatGPT web is separate and remote OAuth-only'), 'packaged README distinguishes ChatGPT remote OAuth')
  assert(
    readme.includes('configures only `invompt-local-beta`') &&
      readme.includes('never remove or modify `invompt`'),
    'packaged README separates local beta from the global OAuth consumer',
  )
  assert(readme.includes('no release, production, registry-availability'), 'packaged README makes no unverified release claim')
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
      gettingStartedSource.includes('server-issued pseudonymous local credential') &&
      gettingStartedSource.includes('separate registered OAuth') &&
      gettingStartedSource.includes('transport-neutral') &&
      gettingStartedSource.includes('backend decides eligibility') &&
      !gettingStartedSource.includes('Do not call\n  create_account_claim_link while connected through OAuth') &&
      !gettingStartedSource.includes('private adapter layer'),
    'getting-started resource documents the input-free link-first Guest claim flow',
  )
  const createAccountClaimLinkSource = readText('../mcp-core/src/tools/create-account-claim-link.ts')
  assert(
    createAccountClaimLinkSource.includes("'create_account_claim_link'") &&
      createAccountClaimLinkSource.includes('inputSchema: {}') &&
      createAccountClaimLinkSource.includes('client.createAccountClaimLink()') &&
      createAccountClaimLinkSource.includes('readOnlyHint: false') &&
      createAccountClaimLinkSource.includes('idempotentHint: false') &&
      createAccountClaimLinkSource.includes('openWorldHint: false') &&
      !createAccountClaimLinkSource.includes('client.isGuest()') &&
      !createAccountClaimLinkSource.includes('replayed'),
    'create_account_claim_link is operational, input-free, and annotated as a closed non-idempotent mutation',
  )
  const skillSource = readText('skills/invompt-local-beta-invoice/SKILL.md')
  const skillMirror = readText('.agents/skills/invompt-local-beta-invoice/SKILL.md')
  const onboardingSkill = readText('skills/invompt-local-beta-onboarding/SKILL.md')
  const onboardingMirror = readText('.agents/skills/invompt-local-beta-onboarding/SKILL.md')
  const onboardingMetadata = readText('skills/invompt-local-beta-onboarding/agents/openai.yaml')
  const onboardingMetadataMirror = readText('.agents/skills/invompt-local-beta-onboarding/agents/openai.yaml')
  const surfaceSource = readText('skills/invompt-local-beta-invoice/references/mcp-surface.md')
  const surfaceMirror = readText('.agents/skills/invompt-local-beta-invoice/references/mcp-surface.md')
  assert(
    !surfaceSource.includes('`create_account_claim_link` is Guest-only; ChatGPT web is a separate remote') &&
      !surfaceSource.includes('OAuth-only host and cannot create a Guest claim link.'),
    'MCP surface excludes the stale ChatGPT OAuth claim prohibition',
  )
  assert(
    surfaceSource.includes('hosted OAuth Guest and legacy') &&
      surfaceSource.includes('backend decide eligibility'),
    'MCP surface documents hosted OAuth Guest and legacy Guest eligibility',
  )
  assert(skillSource === skillMirror, 'packaged skill and generated agent mirror are byte-identical')
  assert(surfaceSource === surfaceMirror, 'packaged MCP reference and generated agent mirror are byte-identical')
  assert(onboardingSkill === onboardingMirror, 'packaged onboarding skill and generated agent mirror are byte-identical')
  assert(onboardingMetadata === onboardingMetadataMirror, 'packaged onboarding skill metadata and mirror are byte-identical')
  assert(/^name: invompt-local-beta-invoice$/m.test(skillSource), 'invoice skill owns only its beta discovery identity')
  assert(
    /^name: invompt-local-beta-onboarding$/m.test(onboardingSkill),
    'onboarding skill owns only its beta discovery identity',
  )
  assert(
    skillSource.includes('Before any MCP call, load `invompt-local-beta-onboarding`') &&
      skillSource.includes('Do not call `invompt-local-beta` until onboarding confirms an active binding'),
    'invoice skill routes through onboarding before MCP calls',
  )
  assert(
    onboardingSkill.includes('Ask exactly this one choice question') &&
      onboardingSkill.includes('wait for an explicit `Guest` or `OAuth` choice') &&
      onboardingSkill.includes('leaves the Guest credential dormant') &&
      onboardingSkill.includes('ChatGPT web, use remote OAuth only') &&
      onboardingSkill.includes('owns only the host server `invompt-local-beta`') &&
      onboardingSkill.includes('global `invompt` provider') &&
      onboardingSkill.includes('npx --yes invompt-mcp@0.11.0 setup --host codex') &&
      onboardingSkill.includes('npx --yes invompt-mcp@0.11.0 setup --host claude-code') &&
      onboardingSkill.includes('deliberate reset/recovery') &&
      onboardingSkill.includes('before another setup attempt') &&
      onboardingSkill.includes('binding.mode ===\nselectedMode') &&
      onboardingSkill.includes('binding.epoch === state.epoch') &&
      onboardingSkill.includes('Do not treat active status alone as usable') &&
      onboardingSkill.includes('call `create_account_claim_link` once') &&
      onboardingSkill.includes('`claimUrl` exactly once') &&
      onboardingSkill.includes('transport; the backend decides') &&
      !onboardingSkill.includes('Do not call this tool through\nOAuth') &&
      onboardingSkill.includes('`GUEST_ACCOUNT_CLAIMED`'),
    'onboarding skill requires explicit setup plus one-time, expiring Guest claim-link handling',
  )
  assert(OPERATIONAL_TOOL_SOURCES.length === 16, 'pack-contract inspects the exact 16 operational tool sources')
  for (const [path, toolName] of OPERATIONAL_TOOL_SOURCES) {
    const contents = readText(path)
    assert(
      contents.includes(`'${toolName}'`) || contents.includes(`\"${toolName}\"`),
      `${path} exposes operational tool registration for ${toolName}`,
    )
    assert(
      !/connected Guest workspace|guest or account|account or guest|guest-company/i.test(contents),
      `${path} remains authentication-neutral for adapter composition`,
    )
  }
  for (const [path, contents] of [
    ['skills/invompt-local-beta-invoice/SKILL.md', skillSource],
    ['skills/invompt-local-beta-invoice/references/mcp-surface.md', surfaceSource],
  ]) {
    assert(
      contents.includes('exactly 16 operational tools') &&
      contents.includes('create_account_claim_link') &&
      contents.includes('GUEST_ACCOUNT_CLAIMED') &&
      contents.includes('backend decides'),
      `${path} documents the operational link-first Guest account claim`,
    )
  }

  const hostManifestPaths = [
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    'plugin.json',
    'gemini-extension.json',
    'qwen-extension.json',
  ]
  for (const path of hostManifestPaths) {
    const manifest = JSON.parse(readText(path))
    assert(manifest.name === 'invompt-local-beta', `${path} uses the isolated beta plugin identity`)
    assert(!Object.hasOwn(manifest, 'mcpServers'), `${path} declares no static MCP transport`)
    const serialized = JSON.stringify(manifest)
    for (const term of ['INVOMPT_GUEST_CREDENTIAL', 'X-Invompt-Guest-Credential', 'guest credential']) {
      assert(!serialized.toLowerCase().includes(term.toLowerCase()), `${path} contains no Guest credential material or setting`)
    }
  }
  const claudeManifest = JSON.parse(readText('.claude-plugin/plugin.json'))
  const codexManifest = JSON.parse(readText('.codex-plugin/plugin.json'))
  assert(claudeManifest.skills === './skills/', 'Claude manifest discovers skills without a static transport')
  assert(codexManifest.skills === './skills/', 'Codex manifest discovers skills without a static transport')
  for (const path of ['gemini-extension.json', 'qwen-extension.json']) {
    const manifest = JSON.parse(readText(path))
    assert(!Object.hasOwn(manifest, 'status'), `${path} contains no nonstandard status field`)
    assert(manifest.description.includes('Template only') && manifest.description.includes('not a supported'), `${path} is labeled as an unsupported template`)
    assert(!Object.hasOwn(manifest, 'settings'), `${path} has no stale Guest launch settings`)
  }
  for (const path of [...packedPaths].filter((value) => value.startsWith('dist/') && /\.(?:c?js|d\.ts)$/.test(value))) {
    const contents = readText(path)
    for (const pattern of [/ioreg/i, /system_profiler/i, /machine-id/i, /mac address collection/i, /serial number collection/i, /hostname identity/i, /fingerprint(?:ing)?\s*(?:api|collection)?/i, /hardware\s*api/i]) {
      assert(!pattern.test(contents), `${path} excludes device fingerprint and hardware identity collection`)
    }
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
