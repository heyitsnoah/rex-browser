import { z } from 'zod'

const KINDS = [
  ['command', /^(bash|shell|exec_command|exec|run|terminal|local_shell)$/i],
  ['read', /^(read|view|read_file|cat|notebookread)$/i],
  [
    'edit',
    /^(edit|write|multiedit|apply_patch|str_replace|notebookedit|create|update_file)$/i,
  ],
  ['search', /^(grep|glob|search|find|ls|list)$/i],
  ['web', /^(webfetch|websearch|web_search|fetch|browse)/i],
  ['agent', /^(agent|task|spawn_agent)$/i],
] as const

export type ToolKind = 'tool' | (typeof KINDS)[number][0]

const VERBS: Record<Exclude<ToolKind, 'agent'>, [string, string, string]> = {
  command: ['Ran', 'command', 'commands'],
  edit: ['Edited', 'file', 'files'],
  read: ['Read', 'file', 'files'],
  search: ['Searched', 'time', 'times'],
  tool: ['Used', 'tool', 'tools'],
  web: ['Fetched', 'page', 'pages'],
}

export function toolKind(name: string): ToolKind {
  return KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'tool'
}

/** Tool input arrives as a JSON string (Claude, Pi) or a JSON string inside a string (Codex). */
export function toolArgs(input: unknown) {
  try {
    let value: unknown = typeof input === 'string' ? JSON.parse(input) : input
    if (typeof value === 'string') value = JSON.parse(value)
    const args = z.record(z.string(), z.unknown()).safeParse(value)
    return args.success ? args.data : undefined
  } catch {
    return undefined
  }
}

/** One readable line for a call: its description, command, path, pattern or query. */
export function toolSummary(name: string, input: unknown) {
  const args = toolArgs(input)
  if (!args) {
    return (typeof input === 'string' ? input : name).split('\n')[0] ?? ''
  }
  const pick =
    [
      firstQuestion(args.questions),
      args.description,
      args.command,
      args.cmd,
      args.file_path,
      args.path,
      args.pattern,
      args.query,
      args.url,
      args.prompt,
    ].find((value) => value !== undefined) ??
    Object.values(args).find((value) => typeof value === 'string')
  const text = Array.isArray(pick)
    ? pick.join(' ')
    : typeof pick === 'string'
      ? pick
      : name
  return text.split('\n')[0] ?? ''
}

/** "Ran 6 commands, read 2 files and edited 1 file" for a run of calls. */
export function runSentence(names: string[]) {
  const counts = new Map<Exclude<ToolKind, 'agent'>, number>()
  for (const name of names) {
    const kind = toolKind(name)
    const key = kind === 'agent' ? 'tool' : kind
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const parts = [...counts].map(([kind, count], index) => {
    const [verb, one, many] = VERBS[kind]
    return `${index === 0 ? verb : verb.toLowerCase()} ${count} ${count === 1 ? one : many}`
  })
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`
    : (parts.at(0) ?? '')
}

/** AskUserQuestion puts its text in `questions[0].question`. */
function firstQuestion(questions: unknown) {
  const first = z.array(z.object({ question: z.string() })).safeParse(questions)
  return first.success ? first.data.at(0)?.question : undefined
}
