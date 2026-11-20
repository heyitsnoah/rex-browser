import { expect, test, vi } from 'vitest'

import { isAllowedRequest } from '@/rex/rex-access'

vi.mock('@/env', () => ({
  env: {
    REX_BROWSER_HOST: 'machine.tailnet.ts.net',
    REX_BROWSER_LOGIN: 'owner@example.com',
  },
}))

function request(headers: Record<string, string>) {
  return new Headers(headers)
}

test.each([
  ['a direct loopback request', { host: '127.0.0.1:4317' }, true],
  [
    'a loopback request Next.js forwarded internally',
    { 'host': 'localhost:4317', 'x-forwarded-for': '::1' },
    true,
  ],
  [
    'the owner through Tailscale Serve',
    {
      'host': 'machine.tailnet.ts.net',
      'tailscale-user-login': 'owner@example.com',
      'x-forwarded-for': '100.111.7.68',
    },
    true,
  ],
  [
    'another login through Tailscale Serve',
    {
      'host': 'machine.tailnet.ts.net',
      'tailscale-user-login': 'someone@example.com',
      'x-forwarded-for': '100.64.0.9',
    },
    false,
  ],
  // Captured 2026-11-20: Serve passed `Host: 127.0.0.1:4317` through and added the client's tailnet address.
  [
    'a spoofed loopback Host through Tailscale Serve',
    { 'host': '127.0.0.1:4317', 'x-forwarded-for': '100.64.0.9' },
    false,
  ],
  ['a foreign Host (DNS rebinding)', { host: 'evil.example' }, false],
])('%s → %s', (_name, headers, allowed) => {
  expect(isAllowedRequest(request(headers))).toBe(allowed)
})
