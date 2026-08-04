import { describe, expect, test } from 'vitest'

import { FALSE_POSITIVE_ALLOWLIST, scanText } from '../../../scripts/privacy-secret-scan.mjs'

describe('privacy and secret scan contract', () => {
  test('detects materialized credentials and never suppresses another finding in an allowlisted file', () => {
    const credential = `inv_gd_v1.test.${Buffer.alloc(32, 1).toString('base64url')}.${Buffer.alloc(32, 2).toString('base64url')}`
    const reviewedUpstreamEmail = ['sindresorhus', 'gmail.com'].join('@')
    const unsafeEmail = ['unsafe', 'example.com'].join('@')
    expect(scanText('packages/invompt-mcp/src/example.ts', credential)).toEqual([
      'packages/invompt-mcp/src/example.ts: Invompt guest credential',
    ])
    expect(scanText('packages/invompt-mcp/THIRD_PARTY_NOTICES.md', `${reviewedUpstreamEmail}\n${credential}`)).toEqual([
      'packages/invompt-mcp/THIRD_PARTY_NOTICES.md: Invompt guest credential',
    ])
    expect(scanText('packages/invompt-mcp/test/example.ts', 'safe@fixture.example.invalid')).toEqual([])
    expect(scanText('packages/invompt-mcp/test/example.ts', unsafeEmail)).toEqual([
      'packages/invompt-mcp/test/example.ts: email address',
    ])
    expect(FALSE_POSITIVE_ALLOWLIST).toContainEqual(
      expect.objectContaining({
        path: 'packages/invompt-mcp/THIRD_PARTY_NOTICES.md',
        label: 'email address',
        value: reviewedUpstreamEmail,
      }),
    )
  })
})
