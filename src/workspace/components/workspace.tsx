'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import type { PendingMessage } from '@/workspace/components/conversation-view'
import type { Run } from '@/workspace/components/run-card'
import type { Selection } from '@/workspace/components/session-rail'

import { AgentStatus } from '@/workspace/components/agent-status'
import { Composer } from '@/workspace/components/composer'
import { PaneGrid } from '@/workspace/components/pane-grid'
import { SessionRail } from '@/workspace/components/session-rail'
import { WorkspaceHeader } from '@/workspace/components/workspace-header'
import { AGENT_NAMES, paneAgent } from '@/workspace/pane-agent'
import { isSubagentRunning } from '@/workspace/subagent-status'
import {
  closeTabAction,
  newTabAction,
  runInNewTabAction,
  writeToPaneAction,
} from '@/workspace/workspace-actions'
import {
  useConversation,
  useHosts,
  useSessions,
  useTabs,
} from '@/workspace/workspace-queries'

const REMEMBERED = 'rex-target'
const selectionSchema = z.object({
  host: z.string(),
  session: z.string(),
  tab: z.string(),
})

/** The whole app: rail, open tab's panes, and the composer. The URL holds the open tab. */
export function Workspace() {
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const host = params.get('host') ?? ''
  const session = params.get('session') ?? ''
  const selection =
    host && session
      ? { host, session, tab: params.get('tab') ?? '' }
      : undefined
  const [nav, setNav] = useState(false)
  const [activeBlock, setActiveBlock] = useState<string>()
  const [drawers, setDrawers] = useState(new Set<string>())
  const [drawerRem, setDrawerRem] = useState(17.5)
  const [typing, setTyping] = useState(false)
  const [transcripts, setTranscripts] = useState(new Map<string, string>())
  const [pending, setPending] = useState(new Map<string, PendingMessage[]>())
  const [runs, setRuns] = useState(new Map<string, Run[]>())
  // Read by the touch handlers only: where the current touch started.
  const touchStart = useRef<{ x: number; y: number }>(undefined)

  const hosts = useHosts()
  const tabs = useTabs(host, selection?.session)
  const sessionLabel = useSessions(host, Boolean(host)).data?.find(
    (item) => item.session_id === session,
  )?.label
  const tab =
    tabs.data?.find((item) => item.id === selection?.tab) ?? tabs.data?.at(0)
  const panes = tab?.panes ?? []
  const active =
    panes.find((pane) => pane.id === activeBlock)?.id ??
    (panes.some((pane) => pane.id === tab?.focusedBlockId)
      ? tab?.focusedBlockId
      : panes.at(0)?.id)
  const target =
    active && selection ? { block: active, host, session } : undefined
  const agent = paneAgent(
    useConversation(target, active ? transcripts.get(active) : undefined).data,
    active !== undefined && transcripts.has(active),
  )
  const agentLabel = agent ? AGENT_NAMES[agent.agent] : undefined
  const drawer = active !== undefined && drawers.has(active)
  const hostLabel = hosts.data?.find((item) => item.id === host)?.label ?? host
  const running = agent
    ? agent.subagents.filter((sub) =>
        isSubagentRunning({
          done: sub.done,
          finished:
            sub.toolUseId in agent.finished
              ? agent.finished[sub.toolUseId]
              : undefined,
          offsetMs: Date.parse(agent.now) - Date.now(),
          updated: sub.updated,
        }),
      ).length
    : 0

  // The open tab survives reloads through the URL; a bare URL reopens the last tab (localStorage is outside React).
  useEffect(() => {
    if (selection) return
    try {
      const remembered = selectionSchema.safeParse(
        JSON.parse(localStorage.getItem(REMEMBERED) ?? 'null'),
      )
      if (remembered.success) select(remembered.data)
    } catch {
      // No usable remembered tab: stay on the empty view.
    }
  })

  // Ctrl+J toggles the active agent pane's terminal drawer, wherever focus is.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'j' &&
        agent &&
        active
      ) {
        event.preventDefault()
        toggleDrawer(active)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  function select(next: Selection) {
    window.history.replaceState(
      null,
      '',
      `/?${new URLSearchParams({ host: next.host, session: next.session, tab: next.tab }).toString()}`,
    )
    try {
      localStorage.setItem(REMEMBERED, JSON.stringify(next))
    } catch {
      // Private mode: the URL still holds the tab.
    }
    setActiveBlock(undefined)
    setTyping(false)
    setNav(false)
  }

  function toggleDrawer(block: string) {
    setDrawers((current) => {
      const next = new Set(current)
      if (!next.delete(block)) next.add(block)
      return next
    })
    setTyping(false)
  }

  function updatePending(
    block: string,
    update: (list: PendingMessage[]) => PendingMessage[],
  ) {
    setPending((current) =>
      new Map(current).set(block, update(current.get(block) ?? [])),
    )
  }

  function input(block: string, data: string) {
    if (!selection) return
    writeToPaneAction({ block, data, host, session }).catch((error: unknown) =>
      toast.error(
        `Input failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      ),
    )
  }

  return (
    <div
      className="grid h-dvh grid-cols-[17rem_minmax(0,1fr)] overflow-hidden max-md:grid-cols-1"
      // On phones, swipe right from the left edge to open the list, and left to close it.
      onTouchEnd={(event) => {
        const start = touchStart.current
        const touch = event.changedTouches.item(0)
        touchStart.current = undefined
        if (!start || !matchMedia('(max-width: 48rem)').matches) return
        const dx = touch.clientX - start.x
        if (Math.abs(touch.clientY - start.y) > Math.abs(dx)) return
        const rem = parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        )
        if (!nav && start.x < 2.5 * rem && dx > 3.5 * rem) setNav(true)
        if (nav && dx < -3.5 * rem) setNav(false)
      }}
      onTouchStart={(event) => {
        const touch = event.touches.item(0)
        touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
    >
      <SessionRail
        hosts={hosts.data}
        hostsError={hosts.error?.message}
        onClose={() => setNav(false)}
        onCloseTab={async (closed) => {
          await closeTabAction(closed)
          await queryClient.invalidateQueries({
            queryKey: ['tabs', closed.host, closed.session],
          })
        }}
        onNewTab={async (tabProps) => {
          await newTabAction(tabProps)
          await queryClient.invalidateQueries({
            queryKey: ['tabs', tabProps.host, tabProps.session],
          })
        }}
        onRefresh={() => void queryClient.invalidateQueries()}
        onSelect={select}
        open={nav}
        selection={selection && tab ? { ...selection, tab: tab.id } : selection}
      />
      <main className="flex min-h-0 min-w-0 flex-col pt-[env(safe-area-inset-top)] md:pt-0">
        <WorkspaceHeader
          agentsRunning={running}
          drawer={agent ? drawer : undefined}
          error={tabs.error?.message}
          meta={[
            hostLabel,
            sessionLabel,
            tab
              ? `${panes.length} ${panes.length === 1 ? 'pane' : 'panes'}`
              : undefined,
          ]
            .filter(Boolean)
            .join(' / ')}
          onMenu={() => setNav(true)}
          onToggleDrawer={() => active && toggleDrawer(active)}
          onTyping={setTyping}
          title={tab?.label ?? 'Rex'}
          typing={target && (!agent || drawer) ? typing : undefined}
        />
        <div className="min-h-0 flex-1">
          {selection && tab ? (
            <PaneGrid
              active={active}
              host={host}
              pane={(block) => ({
                drawer: drawers.has(block),
                drawerRem,
                onAnswer: (key) => input(block, key),
                onChooseTranscript: (id) =>
                  setTranscripts((current) => new Map(current).set(block, id)),
                onDrawerResize: setDrawerRem,
                onInput: (data) => input(block, data),
                onOpenRun: (run) =>
                  select({
                    host: run.host,
                    session: run.session,
                    tab: run.tab,
                  }),
                onOpenTerminal: () =>
                  !drawers.has(block) && toggleDrawer(block),
                onRunInput: (run, data) =>
                  writeToPaneAction({
                    block: run.block,
                    data,
                    host: run.host,
                    session: run.session,
                  }).catch((error: unknown) =>
                    toast.error(
                      `Input failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                    ),
                  ),
                onSelect: () => {
                  // A new target always starts in Compose (DESIGN.md, Input mode).
                  if (block === active) return
                  setActiveBlock(block)
                  setTyping(false)
                },
                pending: pending.get(block) ?? [],
                runs: runs.get(block) ?? [],
                transcript: transcripts.get(block),
                typing,
              })}
              session={session}
              tab={tab}
            />
          ) : (
            <p className="text-muted-foreground grid h-full place-items-center p-6 text-center text-sm">
              {tabs.isLoading || hosts.isLoading
                ? 'Loading…'
                : 'Choose a tab from the list.'}
            </p>
          )}
        </div>
        {/* Typing in the terminal sends every key there, so the message box steps aside. */}
        <Composer
          agentLabel={agentLabel}
          destination={
            target
              ? [
                  hostLabel,
                  agentLabel ?? panes.find((pane) => pane.id === active)?.title,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : ''
          }
          hidden={typing && target !== undefined && (!agent || drawer)}
          onPending={(message) => {
            const block = active ?? ''
            const entry = {
              at: Date.now(),
              failed: false,
              sent: false,
              ...message,
            }
            updatePending(block, (list) => [
              ...list.filter((item) => Date.now() - item.at < 10 * 60 * 1000),
              entry,
            ])
            return {
              failed: () =>
                updatePending(block, (list) =>
                  list.map((item) =>
                    item.at === entry.at ? { ...item, failed: true } : item,
                  ),
                ),
              sent: () =>
                updatePending(block, (list) =>
                  list.map((item) =>
                    item.at === entry.at ? { ...item, sent: true } : item,
                  ),
                ),
            }
          }}
          onRun={async (command) => {
            if (!target) return
            const started = await runInNewTabAction({ ...target, command })
            setRuns((current) =>
              new Map(current).set(target.block, [
                ...(current.get(target.block) ?? []),
                { ...started, at: Date.now(), command, host, session },
              ]),
            )
          }}
          status={
            agent?.status &&
            target && (
              <AgentStatus
                agent={agent.agent}
                // Remounts when the transcript catches up, dropping a shown-but-unconfirmed choice.
                key={`${target.block}|${agent.status.model}|${agent.status.effort}`}
                status={agent.status}
                target={target}
                working={agent.working}
              />
            )
          }
          target={target}
        />
      </main>
    </div>
  )
}
