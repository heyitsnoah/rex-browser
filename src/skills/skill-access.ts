import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

import { readAgentProcess } from '@/rex/agent-process'
import { runRemoteProgram } from '@/rex/remote-program'

/** Slash commands built into each agent, offered alongside its skills. */
const BUILT_IN = {
  claude: [
    'clear',
    'compact',
    'context',
    'cost',
    'help',
    'init',
    'model',
    'resume',
    'review',
  ],
  codex: ['compact', 'diff', 'init', 'model', 'new', 'review', 'status'],
  pi: [
    'compact',
    'copy',
    'export',
    'fork',
    'hotkeys',
    'login',
    'logout',
    'model',
    'name',
    'new',
    'quit',
    'reload',
    'resume',
    'scoped-models',
    'session',
    'settings',
    'share',
    'thinking',
    'tree',
  ],
} as const

/** What the pane's agent accepts after `/`: its built-in commands and installed skills. */
export async function listSlashCommands(props: {
  block: string
  host: string
  session: string
}) {
  const { agent, cwd } = await readAgentProcess(props)
  if (!agent) return []
  const source = await readFile(
    path.join(process.cwd(), 'src/skills/skill-lister.mjs'),
    'utf8',
  )
  const { skills } = z
    .object({
      skills: z.array(z.object({ description: z.string(), name: z.string() })),
    })
    .parse(
      await runRemoteProgram({
        host: props.host,
        request: { agent, cwd },
        session: props.session,
        source,
      }),
    )
  return [
    ...BUILT_IN[agent].map((name) => ({
      description: 'Built-in command',
      name,
    })),
    // Pi invokes skills as `/skill:<name>`; Claude Code and Codex use `/<name>`.
    ...skills.map((skill) =>
      agent === 'pi' ? { ...skill, name: `skill:${skill.name}` } : skill,
    ),
  ]
}
