'use server'

import { requireActionAccess } from '@/rex/rex-access'
import { rex } from '@/rex/rex-cli'
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
