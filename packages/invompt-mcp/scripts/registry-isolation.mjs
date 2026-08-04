export const ISOLATED_REGISTRY = 'http://127.0.0.1:9/'

const PROXY_ENVIRONMENT_KEYS = new Set(['all_proxy', 'http_proxy', 'https_proxy', 'no_proxy'])
const UNREACHABLE_NETWORK_CODES = /\b(?:ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT)\b/

export function createIsolatedNpmEnvironment(environment, cachePath) {
  const sanitizedEnvironment = {}
  for (const [key, value] of Object.entries(environment)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey.startsWith('npm_config_') || PROXY_ENVIRONMENT_KEYS.has(normalizedKey)) continue
    sanitizedEnvironment[key] = value
  }
  return {
    ...sanitizedEnvironment,
    NO_COLOR: '1',
    npm_config_cache: cachePath,
    npm_config_registry: ISOLATED_REGISTRY,
    npm_config_proxy: 'false',
    npm_config_https_proxy: 'false',
  }
}

export function isolatedNpmArguments(userconfigPath, globalconfigPath) {
  return [
    `--registry=${ISOLATED_REGISTRY}`,
    `--@invompt:registry=${ISOLATED_REGISTRY}`,
    '--proxy=false',
    '--https-proxy=false',
    `--userconfig=${userconfigPath}`,
    `--globalconfig=${globalconfigPath}`,
  ]
}

export function isUnreachableIsolatedRegistryProbe(result) {
  if (result?.status === 0) return false
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`
  return output.includes('127.0.0.1:9') && UNREACHABLE_NETWORK_CODES.test(output)
}
