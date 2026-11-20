'use client'

import { useQuery } from '@tanstack/react-query'

import type { RexHost } from '@/rex/rex-hosts'
import type { listSlashCommands } from '@/skills/skill-access'
import type { Conversation } from '@/transcripts/transcript-access'
import type { listSessions, Tab } from '@/workspace/workspace-listing'

export interface PaneTarget {
  block: string
  host: string
  session: string
}

export function useConversation(
  target: PaneTarget | undefined,
  transcript: string | undefined,
) {
  return useQuery({
    enabled: target !== undefined,
    queryFn: () =>
      getJson<Conversation>('conversation', {
        ...(target ?? { block: '', host: '', session: '' }),
        ...(transcript ? { transcript } : {}),
      }),
    queryKey: [
      'conversation',
      target?.host,
      target?.session,
      target?.block,
      transcript,
    ],
    refetchInterval: 3_000,
  })
}

export function useHosts() {
  return useQuery({
    queryFn: () => getJson<RexHost[]>('hosts', {}),
    queryKey: ['hosts'],
  })
}

export function useSessions(host: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () =>
      getJson<Awaited<ReturnType<typeof listSessions>>>('sessions', { host }),
    queryKey: ['sessions', host],
  })
}

export function useTabs(host: string, session: string | undefined) {
  return useQuery({
    enabled: session !== undefined,
    queryFn: () => getJson<Tab[]>('tabs', { host, session: session ?? '' }),
    queryKey: ['tabs', host, session],
    refetchInterval: 15_000,
  })
}

/** The pane's screen as text; polled fast while shown, slower while only watched for a prompt. */
export function useScreen(target: PaneTarget, intervalMs: false | number) {
  return useQuery({
    enabled: intervalMs !== false,
    queryFn: () => getJson<{ content: string }>('screen', { ...target }),
    queryKey: ['screen', target.host, target.session, target.block],
    refetchInterval: intervalMs,
  })
}

export function useSlashCommands(
  target: PaneTarget | undefined,
  enabled: boolean,
) {
  return useQuery({
    enabled: target !== undefined && enabled,
    queryFn: () =>
      getJson<Awaited<ReturnType<typeof listSlashCommands>>>('skills', {
        ...(target ?? { block: '', host: '', session: '' }),
      }),
    queryKey: ['skills', target?.host, target?.block],
    staleTime: 10 * 60 * 1000,
  })
}

async function getJson<T>(route: string, params: Record<string, string>) {
  const response = await fetch(
    `/api/${route}?${new URLSearchParams(params).toString()}`,
  )
  const body: unknown = await response
    .json()
    .catch(() => ({ error: `Request failed (${response.status})` }))
  if (!response.ok) {
    throw new Error(
      body !== null &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status})`,
    )
  }
  // Same-codebase routes: T is the return type of the server module behind the route.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return body as T
}
