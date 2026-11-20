'use client'

import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SunMoonIcon,
  XIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { toast } from 'sonner'

import type { RexHost } from '@/rex/rex-hosts'

import { useSessions, useTabs } from '@/workspace/workspace-queries'

export interface Selection {
  host: string
  session: string
  tab: string
}

/** Every computer, session and tab, with a filter. On phones it's a full-screen panel. */
export function SessionRail(props: {
  readonly hosts: RexHost[] | undefined
  readonly hostsError: string | undefined
  readonly onClose: () => void
  readonly onCloseTab: (selection: Selection) => Promise<void>
  readonly onNewTab: (props: {
    host: string
    name: string
    session: string
  }) => Promise<void>
  readonly onRefresh: () => void
  readonly onSelect: (selection: Selection) => void
  readonly open: boolean
  readonly selection: Selection | undefined
}) {
  const [filter, setFilter] = useState('')
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <aside
      className={`max-md:bg-background flex min-h-0 flex-col border-r max-md:fixed max-md:inset-0 max-md:z-20 max-md:border-r-0 max-md:pt-[env(safe-area-inset-top)] max-md:transition-transform max-md:duration-200 ${props.open ? '' : 'max-md:invisible max-md:-translate-x-full'}`}
    >
      <div className="flex h-13 items-center gap-2 pr-3 pl-4 max-md:pl-1">
        <button
          aria-label="Close sessions"
          className="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-lg md:hidden"
          onClick={props.onClose}
          type="button"
        >
          <XIcon className="size-4.5" />
        </button>
        <span className="flex-1 font-medium">Rex</span>
        <button
          aria-label="Switch theme"
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          type="button"
        >
          <SunMoonIcon className="size-4" />
        </button>
        <button
          aria-label="Refresh computers, sessions and tabs"
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
          onClick={props.onRefresh}
          type="button"
        >
          <RefreshCwIcon className="size-4" />
        </button>
      </div>
      <label className="border-input text-muted-foreground focus-within:outline-ring mx-3 mb-2 flex h-9 items-center gap-2 rounded border px-2.5 focus-within:outline-2 max-md:h-11">
        <SearchIcon className="size-3.5" />
        <input
          aria-label="Filter sessions and tabs"
          className="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none max-md:text-base"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          value={filter}
        />
      </label>
      <nav
        aria-label="Computers, sessions and tabs"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {props.hostsError && (
          <p className="text-destructive px-2 py-3 text-sm">
            {props.hostsError}
          </p>
        )}
        {props.hosts?.map((host) => (
          <HostSection
            filter={filter.toLowerCase()}
            host={host}
            key={host.id}
            onCloseTab={props.onCloseTab}
            onNewTab={props.onNewTab}
            onSelect={props.onSelect}
            selection={props.selection}
          />
        ))}
      </nav>
    </aside>
  )
}

function HostSection(props: {
  readonly filter: string
  readonly host: RexHost
  readonly onCloseTab: (selection: Selection) => Promise<void>
  readonly onNewTab: (props: {
    host: string
    name: string
    session: string
  }) => Promise<void>
  readonly onSelect: (selection: Selection) => void
  readonly selection: Selection | undefined
}) {
  const sessions = useSessions(props.host.id, props.host.online)
  return (
    <section>
      <div className="text-muted-foreground flex items-center gap-2 px-2 pt-4 pb-2 font-mono text-[0.7rem] tracking-wide uppercase">
        <span
          className={`size-1.5 rounded-full ${props.host.online ? 'bg-primary' : 'border-input border'}`}
        />
        {props.host.label}
        <span className="ml-auto normal-case">
          {props.host.online
            ? sessions.data
              ? `${sessions.data.length} ${sessions.data.length === 1 ? 'session' : 'sessions'}`
              : sessions.error
                ? 'error'
                : ''
            : 'offline'}
        </span>
      </div>
      {sessions.error && (
        <p className="text-destructive px-2 text-[0.8rem]">
          {sessions.error.message}
        </p>
      )}
      {sessions.data?.map((session) => (
        <SessionRow
          filter={props.filter}
          host={props.host.id}
          key={session.session_id}
          label={session.label}
          onCloseTab={props.onCloseTab}
          onNewTab={props.onNewTab}
          onSelect={props.onSelect}
          selection={props.selection}
          session={session.session_id}
        />
      ))}
    </section>
  )
}

function SessionRow(props: {
  readonly filter: string
  readonly host: string
  readonly label: string
  readonly onCloseTab: (selection: Selection) => Promise<void>
  readonly onNewTab: (props: {
    host: string
    name: string
    session: string
  }) => Promise<void>
  readonly onSelect: (selection: Selection) => void
  readonly selection: Selection | undefined
  readonly session: string
}) {
  const selected =
    props.selection?.host === props.host &&
    props.selection.session === props.session
  const [open, setOpen] = useState(selected)
  const [naming, setNaming] = useState(false)
  // The tab whose close is waiting for a second click.
  const [closing, setClosing] = useState<string>()
  const tabs = useTabs(
    props.host,
    open || selected || props.filter !== '' ? props.session : undefined,
  )
  const matches = (text: string) => text.toLowerCase().includes(props.filter)
  const shownTabs = tabs.data?.filter(
    (tab) => !props.filter || matches(tab.label) || matches(props.label),
  )
  if (props.filter && !matches(props.label) && !shownTabs?.length) return null
  const expanded = open || props.filter !== ''
  return (
    <div>
      <button
        className="hover:bg-muted flex h-7.5 w-full items-center gap-2 rounded px-2 text-left text-[0.8rem] font-medium max-md:h-11 max-md:text-[0.95rem]"
        onClick={() => setOpen(!expanded)}
        type="button"
      >
        {expanded ? (
          <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" />
        )}
        <span className="truncate">{props.label}</span>
        {tabs.data && (
          <span className="text-muted-foreground ml-auto font-mono text-[0.7rem] font-normal">
            {tabs.data.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-border mt-0.5 mb-1.5 ml-3.5 border-l pl-2">
          {tabs.error && (
            <p className="text-destructive px-2 py-1.5 text-[0.8rem]">
              {tabs.error.message}
            </p>
          )}
          {shownTabs?.map((tab) => {
            const current = selected && props.selection.tab === tab.id
            return (
              <div className="group relative" key={tab.id}>
                <button
                  aria-current={current}
                  className={`flex h-7.5 w-full items-center rounded px-2 pr-8 text-left text-[0.8rem] max-md:h-11 max-md:pr-11 max-md:text-[0.95rem] ${current ? 'bg-selected font-medium' : 'hover:bg-muted'}`}
                  onClick={() =>
                    props.onSelect({
                      host: props.host,
                      session: props.session,
                      tab: tab.id,
                    })
                  }
                  type="button"
                >
                  <span className="truncate">{tab.label}</span>
                </button>
                {closing === tab.id ? (
                  <div
                    className="bg-card absolute inset-0 flex items-center gap-1.5 rounded border px-2 text-[0.75rem]"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setClosing(undefined)
                    }}
                  >
                    <span className="text-muted-foreground mr-auto truncate">
                      Close tab? Its programs stop.
                    </span>
                    <button
                      className="bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 rounded px-1.5 py-0.5 font-medium"
                      onClick={() => {
                        setClosing(undefined)
                        props
                          .onCloseTab({
                            host: props.host,
                            session: props.session,
                            tab: tab.id,
                          })
                          .catch((error: unknown) =>
                            toast.error(
                              `Close failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                            ),
                          )
                      }}
                      type="button"
                    >
                      Close
                    </button>
                    <button
                      // The safe choice gets focus, so a keyboard user lands on the confirm.
                      autoFocus
                      className="hover:bg-muted rounded px-1.5 py-0.5"
                      onClick={() => setClosing(undefined)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label={`Close tab ${tab.label}`}
                    className={`text-muted-foreground hover:text-foreground hover:bg-muted absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded group-hover:opacity-100 focus-visible:opacity-100 max-md:size-9 max-md:opacity-100 ${current ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setClosing(tab.id)}
                    type="button"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </div>
            )
          })}
          {naming ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const name = new FormData(event.currentTarget).get('name')
                if (typeof name === 'string' && name.trim()) {
                  void props
                    .onNewTab({
                      host: props.host,
                      name: name.trim(),
                      session: props.session,
                    })
                    .then(() => setNaming(false))
                    .catch((error: unknown) =>
                      toast.error(
                        `New tab failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                      ),
                    )
                }
              }}
            >
              <input
                aria-label="New tab name"
                autoFocus
                className="border-input bg-card h-7.5 w-full rounded border px-2 text-[0.8rem] max-md:h-11 max-md:text-base"
                maxLength={128}
                name="name"
                onBlur={() => setNaming(false)}
                onKeyDown={(event) =>
                  event.key === 'Escape' && setNaming(false)
                }
                placeholder="Tab name"
              />
            </form>
          ) : (
            <button
              className="text-muted-foreground hover:bg-muted flex h-7.5 w-full items-center gap-2 rounded px-2 text-[0.8rem] max-md:h-11"
              onClick={() => setNaming(true)}
              type="button"
            >
              <PlusIcon className="size-3.5" />
              New tab
            </button>
          )}
        </div>
      )}
    </div>
  )
}
