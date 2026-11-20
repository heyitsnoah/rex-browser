import { MenuIcon, PanelBottomIcon } from 'lucide-react'

/** The open tab's title and the controls for its active pane. */
export function WorkspaceHeader(props: {
  readonly agentsRunning: number
  readonly drawer: boolean | undefined
  readonly error: string | undefined
  readonly meta: string
  readonly onMenu: () => void
  readonly onToggleDrawer: () => void
  readonly onTyping: (typing: boolean) => void
  readonly title: string
  readonly typing: boolean | undefined
}) {
  return (
    <header className="flex min-h-13 items-center gap-3.5 border-b pr-4 pl-6 max-md:gap-2 max-md:py-1 max-md:pr-2 max-md:pl-1">
      <button
        aria-label="Show computers, sessions and tabs"
        className="text-muted-foreground hover:bg-muted grid size-11 place-items-center rounded-lg md:hidden"
        onClick={props.onMenu}
        type="button"
      >
        <MenuIcon className="size-4.5" />
      </button>
      <h1 className="min-w-0 truncate text-lg font-medium tracking-tight max-md:flex-1 max-md:text-[1.05rem] md:max-w-[40%]">
        {props.title}
      </h1>
      <span className="text-muted-foreground min-w-0 truncate font-mono text-xs max-md:hidden">
        {props.meta}
      </span>
      <span className="flex-1 max-md:hidden" />
      <span
        className={`inline-flex items-center gap-1.5 font-mono text-[0.7rem] tracking-wide whitespace-nowrap uppercase ${props.error ? 'text-destructive' : 'text-primary'}`}
        role="status"
        title={props.error}
      >
        {props.error ? (
          'Error'
        ) : (
          <span className="bg-primary size-1.5 rounded-full" />
        )}
        <span className="max-md:hidden">{props.error ? '' : 'Live'}</span>
      </span>
      {props.agentsRunning > 0 && (
        <button
          className="text-primary hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-lg px-2 font-mono text-xs whitespace-nowrap"
          onClick={() =>
            document
              .querySelector('[data-agent-running]')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          title="Show the running agent"
          type="button"
        >
          <span className="bg-primary animate-pulse-dot size-1.5 rounded-full" />
          <span className="max-md:hidden">
            {props.agentsRunning === 1
              ? '1 agent running'
              : `${props.agentsRunning} agents running`}
          </span>
        </button>
      )}
      {props.drawer !== undefined && (
        <button
          aria-pressed={props.drawer}
          className="text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8rem] max-md:h-10 max-md:w-11 max-md:justify-center max-md:px-0"
          onClick={props.onToggleDrawer}
          title={
            props.drawer ? 'Hide terminal (Ctrl+J)' : 'Show terminal (Ctrl+J)'
          }
          type="button"
        >
          <PanelBottomIcon className="size-4" />
          <span className="max-md:hidden">Terminal</span>
          <kbd className="font-mono text-[0.7rem] max-md:hidden">Ctrl+J</kbd>
        </button>
      )}
      {props.typing !== undefined && (
        <div
          aria-label="Where your typing goes"
          className="inline-flex shrink-0 rounded-lg border p-0.5"
          role="group"
        >
          {[false, true].map((typing) => (
            <button
              aria-pressed={props.typing === typing}
              className="text-muted-foreground aria-pressed:bg-tray aria-pressed:text-tray-foreground h-7.5 rounded-md px-3 text-[0.8rem] whitespace-nowrap max-md:h-9"
              key={String(typing)}
              onClick={() => props.onTyping(typing)}
              type="button"
            >
              {typing ? (
                <>
                  <span className="max-md:hidden">Type in terminal</span>
                  <span className="md:hidden">Type</span>
                </>
              ) : (
                'Compose'
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
