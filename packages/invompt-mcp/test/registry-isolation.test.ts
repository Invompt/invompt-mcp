import { describe, expect, test } from 'vitest'

import {
  createIsolatedNpmEnvironment,
  ISOLATED_REGISTRY,
  isolatedNpmArguments,
  isUnreachableIsolatedRegistryProbe,
} from '../scripts/registry-isolation.mjs'

describe('isolated npm registry proof', () => {
  test('rejects a reachable registry 404 instead of treating every failure as offline', () => {
    expect(
      isUnreachableIsolatedRegistryProbe({
        status: 1,
        stderr: 'npm error code E404\nnpm error 404 Not Found - GET http://127.0.0.1:9/not-a-package',
      }),
    ).toBe(false)
  })

  test('accepts only an exact loopback connection failure', () => {
    expect(
      isUnreachableIsolatedRegistryProbe({
        status: 1,
        stderr: 'npm error code ECONNREFUSED\nnpm error request to http://127.0.0.1:9/not-a-package failed',
      }),
    ).toBe(true)
    expect(isUnreachableIsolatedRegistryProbe({ status: 1, stderr: 'npm error code ECONNREFUSED' })).toBe(false)
  })

  test('removes registry and proxy overrides before invoking npm', () => {
    const environment = createIsolatedNpmEnvironment(
      {
        npm_config_registry: 'http://reachable.example.invalid/',
        NPM_CONFIG_REGISTRY: 'http://reachable.example.invalid/',
        NPM_CONFIG_USERCONFIG: '/tmp/reachable-npmrc',
        npm_config_cafile: '/tmp/reachable-ca.pem',
        HTTP_PROXY: 'http://reachable.example.invalid/',
        https_proxy: 'http://reachable.example.invalid/',
        KEEP_ME: 'safe',
      },
      '/tmp/isolated-cache',
    )

    expect(environment).toMatchObject({
      KEEP_ME: 'safe',
      NO_COLOR: '1',
      npm_config_cache: '/tmp/isolated-cache',
      npm_config_registry: ISOLATED_REGISTRY,
      npm_config_proxy: 'false',
      npm_config_https_proxy: 'false',
    })
    expect(environment).not.toHaveProperty('NPM_CONFIG_USERCONFIG')
    expect(environment).not.toHaveProperty('NPM_CONFIG_REGISTRY')
    expect(environment).not.toHaveProperty('npm_config_cafile')
    expect(environment).not.toHaveProperty('HTTP_PROXY')
    expect(environment).not.toHaveProperty('https_proxy')
    expect(isolatedNpmArguments('/tmp/isolated.npmrc', '/tmp/isolated-global.npmrc')).toEqual([
      `--registry=${ISOLATED_REGISTRY}`,
      `--@invompt:registry=${ISOLATED_REGISTRY}`,
      '--proxy=false',
      '--https-proxy=false',
      '--userconfig=/tmp/isolated.npmrc',
      '--globalconfig=/tmp/isolated-global.npmrc',
    ])
  })
})
