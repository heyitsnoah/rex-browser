'use server'

import { readScreen } from '@/rex/hidden-terminal'
import { requireActionAccess } from '@/rex/rex-access'
import { rex } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { detectPrompt } from '@/workspace/detect-prompt'

// The status line Claude Code shows for each mode.
const MODE_LABELS = {
  acceptEdits: 'accept edits on',
  auto: 'auto mode on',
  default: 'manual mode on',
  plan: 'plan mode on',
}

// Effort levels in the order ←/→ moves through them in Claude Code's /model picker.
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

/**
 * Changes a Claude Code pane's model, effort or mode for that session only. Model and effort go
 * through Claude Code's /model picker with "s" (use this session only), so its saved default stays.
 */
export const setClaudeSettingAction = requireActionAccess(
  // Next.js hides a thrown error's message in production, so the reason comes back as data.
  async (props: Parameters<typeof changeClaudeSetting>[0]) => {
    try {
      await changeClaudeSetting(props)
      return { error: undefined }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'unknown error' }
    }
  },
)

async function changeClaudeSetting(props: {
  block: string
  host: string
  session: string
  setting:
    | { kind: 'effort'; value: (typeof EFFORTS)[number] }
    | { kind: 'mode'; value: keyof typeof MODE_LABELS }
    | {
        kind: 'model'
        value: 'Fable 5.2' | 'Haiku 5.5' | 'Opus 5.5' | 'Sonnet 5.5'
      }
}) {
  const host = await requireHost(props.host)
  const pane = { block: props.block, host, session: props.session }
  async function writeKeys(data: string) {
    await rex(host, [
      'block',
      'call',
      '-s',
      props.session,
      '-b',
      props.block,
      'write',
      JSON.stringify({ data }),
    ])
  }
  // Presses a key and waits for the screen to settle on the result.
  async function press(data: string) {
    await writeKeys(data)
    await new Promise((resolve) => setTimeout(resolve, 400))
    return bottomLines(pane, 30)
  }
  const bottom = await bottomLines(pane, 10)
  // Keys typed while a dialog or menu is open would answer it instead.
  if (!bottom.includes('shift+tab to cycle')) {
    throw new Error(
      'Claude Code is showing a dialog or menu. Finish it in the terminal, then try again.',
    )
  }
  if (props.setting.kind === 'mode') {
    const label = MODE_LABELS[props.setting.value]
    const start = Object.values(MODE_LABELS).find((mode) =>
      bottom.includes(mode),
    )
    // Each press moves to the next mode; a cycle has at most five.
    for (let press = 0; press < 5; press++) {
      if ((await bottomLines(pane, 10)).includes(label)) return
      await writeKeys('\x1b[Z')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    // Not in this Claude Code's cycle: go back to where it was.
    for (let press = 0; start && press < 5; press++) {
      if ((await bottomLines(pane, 10)).includes(start)) break
      await writeKeys('\x1b[Z')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`This Claude Code has no ${label.replace(/ on$/, '')}.`)
  }
  // Text waiting in Claude's input would be sent along with the command.
  const draft = /^\s*❯(.*)$/m.exec(bottom.split('\n').reverse().join('\n'))?.[1]
  if (draft?.trim()) {
    throw new Error(
      "Claude Code's input has unsent text. Send or clear it in the terminal, then try again.",
    )
  }
  const confirmation = 'for this session only'
  // An earlier confirmation may still be on screen; wait for one more.
  const before = (await readScreen(pane)).split(confirmation).length
  await rex(host, [
    'api',
    'call',
    '-s',
    props.session,
    'block.event',
    JSON.stringify({
      block_id: props.block,
      event: { payload: { text: '/model' }, type: 'paste' },
      session_id: props.session,
    }),
  ])
  await new Promise((resolve) => setTimeout(resolve, 120))
  let picker = await press('\r')
  try {
    for (let tries = 0; !picker.includes('Select model'); tries++) {
      if (tries > 10) throw new Error("Claude Code's model picker didn't open.")
      await new Promise((resolve) => setTimeout(resolve, 300))
      picker = await bottomLines(pane, 30)
    }
    if (props.setting.kind === 'model') {
      // The picker opens on the current model; ↓ moves through the rows (and wraps).
      const target = props.setting.value
      for (let row = 0; highlighted(picker) !== target; row++) {
        if (row > 8) {
          throw new Error(`Claude Code doesn't offer ${target} here.`)
        }
        picker = await press('\x1b[B')
      }
    } else {
      const target = EFFORTS.indexOf(props.setting.value)
      for (let step = 0; ; step++) {
        const current = effortIn(picker)
        if (current === undefined) {
          throw new Error('This model has no effort setting.')
        }
        if (current === target) break
        if (step > EFFORTS.length) {
          throw new Error(
            `Claude Code didn't reach ${props.setting.value} effort.`,
          )
        }
        picker = await press(current < target ? '\x1b[C' : '\x1b[D')
      }
    }
    await writeKeys('s')
    const deadline = Date.now() + 10_000
    let switchConfirmed = false
    for (
      let screen = await readScreen(pane);
      screen.split(confirmation).length <= before;
      screen = await readScreen(pane)
    ) {
      // Mid-conversation, Claude Code asks whether to switch (the history is re-read on the new model).
      // The person chose this model, so confirm the menu that's open now, once.
      const option = detectPrompt(screen)?.options.find((choice) =>
        choice.label.startsWith('Yes, switch to'),
      )
      if (option && !switchConfirmed) {
        switchConfirmed = true
        await writeKeys(option.key)
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Claude Code didn't confirm the ${props.setting.kind} change.`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  } catch (error) {
    // Leave Claude Code as it was rather than with its picker open.
    if ((await bottomLines(pane, 30)).includes('Select model')) {
      await writeKeys('\x1b')
    }
    throw error
  }
}

/** The model row the picker has highlighted, e.g. "Fable 5.2" ("❯ 3.  Fable 5.2   For your …"). */
function highlighted(picker: string) {
  const row = /^\s*❯\s*\d+\.\s+(.*?)(?:\s{2,}|$)/m.exec(picker)?.[1]
  return row?.replace(/\s*✔$/, '')
}

/** The picker's effort level as an index into EFFORTS ("◉ xHigh effort ←/→ to adjust"). */
function effortIn(picker: string) {
  const level = /\b(low|medium|xhigh|high|max) effort/i.exec(picker)?.[1]
  return level === undefined
    ? undefined
    : EFFORTS.findIndex((effort) => effort === level.toLowerCase())
}

/** The last lines of the pane's screen: Claude Code's input, status line, or its picker. */
async function bottomLines(
  pane: { block: string; host: string; session: string },
  count: number,
) {
  return (await readScreen(pane)).split('\n').slice(-count).join('\n')
}
