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
  return {
    agent: processes.map(detectAgent).find((agent) => agent !== undefined),
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
