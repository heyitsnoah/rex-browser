'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { readAgentProcess } from '@/rex/agent-process'
import { readScreen } from '@/rex/hidden-terminal'
import { requireActionAccess } from '@/rex/rex-access'
import { rex, rexJson } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'

/** Types `data` into the pane as keystrokes (e.g. "\r" for Enter, a digit to answer a menu). */
export const writeToPaneAction = requireActionAccess(
  async (props: {
    block: string
    data: string
    host: string
    session: string
  }) => {
    await rex(await requireHost(props.host), [
      'block',
      'call',
      '-s',
      props.session,
      '-b',
      props.block,
      'write',
      JSON.stringify({ data: props.data }),
    ])
  },
)

export const newTabAction = requireActionAccess(
  async (props: { host: string; name: string; session: string }) => {
    await rex(await requireHost(props.host), [
      'api',
      'call',
      '-s',
      props.session,
      'session.new_window',
      JSON.stringify({
        focus: false,
        layout: { block: { flavor: 'com.superlogical.terminal.shell' } },
        session_id: props.session,
        window_label: props.name,
      }),
    ])
  },
)

/** Closes a tab (a Rex window) and ends every program in it. */
export const closeTabAction = requireActionAccess(
  async (props: { host: string; session: string; tab: string }) => {
    await rex(await requireHost(props.host), [
      'api',
      'call',
      '-s',
      props.session,
      'session.close_window',
      JSON.stringify({ session_id: props.session, window_id: props.tab }),
    ])
  },
)

/** Pastes `text` as one bracketed paste, which TUIs keep separate from a later Enter. */
export const pasteToPaneAction = requireActionAccess(
  async (props: {
    block: string
    host: string
    session: string
    text: string
  }) => {
    await rex(await requireHost(props.host), [
      'api',
      'call',
      '-s',
      props.session,
      'block.event',
      JSON.stringify({
        block_id: props.block,
        event: { payload: { text: props.text }, type: 'paste' },
        session_id: props.session,
      }),
    ])
  },
)

/**
 * Runs a `!` command in a new tab beside the agent (same computer and folder), so logins and prompts
 * work there, then has the agent run `!cat` on the saved output so it lands in its context.
 * Returns once the tab is open; the hand-back happens when the command ends.
 */
export const runInNewTabAction = requireActionAccess(
  async (props: {
    block: string
    command: string
    host: string
    session: string
  }) => {
    const host = await requireHost(props.host)
    const { cwd } = await readAgentProcess({ ...props, host })
    const id = randomUUID().slice(0, 8)
    const file = `$HOME/.local/state/rex-browser/runs/${id}.txt`
    const encoded = Buffer.from(props.command).toString('base64')
    // script(1) keeps a real terminal for the command while recording it (util-linux and macOS
    // spell it differently); the record is stripped of escape codes and capped at 400 lines.
    const wrapper = `cmd=$(printf %s '${encoded}' | base64 --decode)
d="$HOME/.local/state/rex-browser/runs"; mkdir -p "$d"; chmod 700 "$d"
printf '$ %s\\n\\n' "$cmd"
if script --version >/dev/null 2>&1; then script -qfec "$cmd" "$d/${id}.raw"; else script -q "$d/${id}.raw" sh -c "$cmd"; fi
code=$?
{ printf '$ %s  (ran in a terminal)\\n' "$cmd"; perl -pe 's/\\e\\[[0-9;?]*[ -\\/]*[@-~]//g; s/\\e\\][^\\a\\e]*(\\a|\\e\\\\)//g; s/\\e[()][A-Z0-9]//g; s/\\r//g' "$d/${id}.raw" | sed -e '/^Script started on /d' -e '/^Script done on /d' | tail -n 400; printf '[exit %s]\\n' "$code"; } > "$d/${id}.txt"
rm -f "$d/${id}.raw"
printf '\\nREXRUN-%s-DONE exit %s · output sent to the agent\\n' '${id}' "$code"
exec "\${SHELL:-sh}" -l`
    const { block_ids: blocks, window_id: tab } = await rexJson({
      args: [
        'api',
        'call',
        '-s',
        props.session,
        'session.new_window',
        JSON.stringify({
          focus: false,
          layout: {
            block: {
              flavor: 'com.superlogical.terminal.shell',
              options: { command: ['sh', '-c', wrapper], cwd },
            },
          },
          session_id: props.session,
          window_label: `! ${props.command}`.slice(0, 40),
        }),
      ],
      host,
      schema: z.object({
        block_ids: z.array(z.string()).min(1),
        window_id: z.string(),
      }),
    })
    void handBack({
      agentBlock: props.block,
      file,
      host,
      id,
      runBlock: blocks[0],
      session: props.session,
      tab,
    })
    return { block: blocks[0], id, tab }
  },
)

async function handBack(props: {
  agentBlock: string
  file: string
  host: string
  id: string
  runBlock: string
  session: string
  tab: string
}) {
  const deadline = Date.now() + 60 * 60 * 1000
  try {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const screen = await readScreen({
        block: props.runBlock,
        host: props.host,
        session: props.session,
      })
      const done = new RegExp(`REXRUN-${props.id}-DONE exit (\\d+)`).exec(
        screen,
      )
      if (!done) continue
      await rex(props.host, [
        'api',
        'call',
        '-s',
        props.session,
        'block.event',
        JSON.stringify({
          block_id: props.agentBlock,
          event: { payload: { text: `!cat "${props.file}"` }, type: 'paste' },
          session_id: props.session,
        }),
      ])
      await new Promise((resolve) => setTimeout(resolve, 120))
      await rex(props.host, [
        'block',
        'call',
        '-s',
        props.session,
        '-b',
        props.agentBlock,
        'write',
        JSON.stringify({ data: '\r' }),
      ])
      // A command that worked has nothing left to see; a failed one keeps its tab so you can look.
      if (done[1] === '0') {
        await rex(props.host, [
          'api',
          'call',
          '-s',
          props.session,
          'session.close_window',
          JSON.stringify({ session_id: props.session, window_id: props.tab }),
        ])
      }
      return
    }
  } catch (error) {
    // Nobody is waiting on this promise: the tab closed or the computer went away. Its output stays in the file.
    console.error(`Rex tab ${props.runBlock}: hand-back failed`, error)
  }
}
