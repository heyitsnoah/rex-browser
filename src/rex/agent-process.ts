import { z } from 'zod'

import { rexJson } from '@/rex/rex-cli'

const processSchema = z.object({
  argv0: z.string().optional(),
  cwd: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  pid: z.number(),
  script: z.string().optional(),
})

/** Which coding agent a pane runs (if any), its working directory, and its process IDs. */
export async function readAgentProcess(props: {
  block: string
  host: string
  session: string
}) {
  const info = await rexJson({
    args: ['block', 'call', '-s', props.session, '-b', props.block, 'process'],
    host: props.host,
    schema: z.object({
      ancestors: z.array(processSchema).optional(),
      child: processSchema.optional(),
      foreground: processSchema.optional(),
    }),
  })
  const processes = [
    info.foreground,
    ...(info.ancestors ?? []),
    info.child,
  ].filter((p) => p !== undefined)
  const seen = processes.map(detectAgent).find((agent) => agent !== undefined)
  return {
    // Started through a wrapper (`eh pi …`, `zsh -lc 'claude …'`), the agent shares the wrapper's
    // process group, so Rex reports the wrapper; the agent still reports itself via program_status.
    agent: seen ?? (await reportedAgent({ ...props, processes })),
    // Then the agent is a child of these processes, which the transcript reader looks up.
    byShell: seen === undefined,
    cwd: info.foreground?.cwd ?? info.child?.cwd,
    pids: processes.map((p) => p.pid),
  }
}

function detectAgent(proc: z.infer<typeof processSchema>) {
  const executable = [proc.script, proc.argv0, proc.path, proc.name]
    .filter(Boolean)
    .join(' ')
  if (/(?:^|[/\s])claude(?:$|[/\s-])|\/claude\/versions\//i.test(executable)) {
    return 'claude' as const
  }
  if (/(?:^|[/\s])codex(?:$|[/\s-])/i.test(executable)) return 'codex' as const
  if (/(?:^|[/\s])pi(?:$|[/\s])|pi-coding-agent/i.test(executable)) {
    return 'pi' as const
  }
  return undefined
}

async function reportedAgent(props: {
  block: string
  host: string
  processes: z.infer<typeof processSchema>[]
  session: string
}) {
  try {
    const status = await rexJson({
      args: [
        'block',
        'call',
        '-s',
        props.session,
        '-b',
        props.block,
        'program_status',
      ],
      host: props.host,
      schema: z.object({
        records: z.array(
          z.object({
            effective_app: z.string().optional(),
            owner: z.object({ name: z.string(), pid: z.number() }).nullish(),
            updated_at: z.string().optional(),
          }),
        ),
      }),
    })
    const live = status.records
      .filter((record) => {
        const owner = record.owner
        if (!owner) return true
        return props.processes.some(
          (proc) =>
            proc.pid === owner.pid && (!proc.name || proc.name === owner.name),
        )
      })
      .toSorted((a, b) =>
        (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
      )
    for (const record of live) {
      const app = record.effective_app ?? ''
      if (app.startsWith('claude')) return 'claude' as const
      if (app.startsWith('codex')) return 'codex' as const
      if (app === 'pi' || app.startsWith('pi-')) return 'pi' as const
    }
    return undefined
  } catch {
    return undefined
  }
}
