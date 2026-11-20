import type { NextRequest } from 'next/server'

import { headers } from 'next/headers'

import { env } from '@/env'

/**
 * A loopback request is always allowed. The tailnet name is allowed only when
 * REX_BROWSER_HOST and REX_BROWSER_LOGIN are set and Tailscale Serve reports
 * that login. Checking Host also blocks DNS rebinding.
 *
 * Tailscale Serve passes the client's Host header through unchanged, so Host
 * alone can't prove a request is local: Serve also sets X-Forwarded-For to the
 * tailnet client's address, which the client can't remove.
 */
export function isAllowedRequest(requestHeaders: Headers) {
  const host = requestHeaders.get('host') ?? ''
  const forwardedFor = (requestHeaders.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const local =
    /^(127\.0\.0\.1|localhost):\d+$/.test(host) &&
    forwardedFor.every((address) => /^(127\.|::1$|::ffff:127\.)/.test(address))
  if (local) return true
  return (
    env.REX_BROWSER_HOST !== undefined &&
    env.REX_BROWSER_LOGIN !== undefined &&
    host === env.REX_BROWSER_HOST &&
    requestHeaders.get('tailscale-user-login') === env.REX_BROWSER_LOGIN
  )
}

export function requireActionAccess<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
) {
  return async (...args: A) => {
    if (!isAllowedRequest(await headers())) throw new Error('Forbidden')
    return action(...args)
  }
}

export function requirePageAccess<P>(page: (props: P) => React.ReactNode) {
  return async (props: P) => {
    if (!isAllowedRequest(await headers())) throw new Error('Forbidden')
    return page(props)
  }
}

export function requireRouteAccess(
  handler: (request: NextRequest) => Promise<Response> | Response,
) {
  return async (request: NextRequest) =>
    isAllowedRequest(request.headers)
      ? handler(request)
      : new Response(null, { status: 403 })
}

/** The root layout is a static shell; its page decides access. */
export function skipLayoutAccess<P>(layout: (props: P) => React.ReactNode) {
  return layout
}
