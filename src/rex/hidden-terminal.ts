import { gunzipSync } from 'node:zlib'
import { z } from 'zod'

import { rex, rexJson } from '@/rex/rex-cli'

// Linux limits a single command-line argument to 128 KB.
const WRITE_CHUNK = 60_000

const formatReplySchema = z.object({
  content: z.string(),
  eof: z.boolean().optional(),
  id: z.number().optional(),
})

/**
 * Runs a command in a terminal on that computer that no window shows, waits
 * for its framed result (`REXB64:<gzip+base64 JSON>:REXEND`), and closes it.
 * A program that reads input prints `REXREADY` once its terminal is in raw
 * mode; `input` is then typed in chunks.
 */
export async function runHidden(props: {
  command: string[]
  host: string
  input?: string
  session: string
  timeoutMs?: number
}) {
  const { block_id: block } = await rexJson({
    args: [
      'api',
      'call',
      '-s',
      props.session,
      'session.new_block',
      JSON.stringify({
        flavor: 'com.superlogical.terminal.shell',
        label: 'rex-browser reader',
        options: {
          command: props.command,
          exit: { on_completion: false },
          interactive: true,
          size: { columns: 4000, rows: 50 },
        },
        session_id: props.session,
      }),
    ],
    host: props.host,
    schema: z.object({ block_id: z.string() }),
  })
  try {
    const deadline = Date.now() + (props.timeoutMs ?? 20_000)
    let input = props.input
    let lastScreen = ''
    for (let wait = 150; ; wait = Math.min(wait * 1.5, 800)) {
      const text = await readScreen({
        block,
        host: props.host,
        session: props.session,
      })
      lastScreen = text
      if (text.includes(':REXEND')) return decodeFramed(text)
      if (input !== undefined && text.includes('REXREADY')) {
        for (let i = 0; i < input.length; i += WRITE_CHUNK) {
          await rex(props.host, [
            'block',
            'call',
            '-s',
            props.session,
            '-b',
            block,
            'write',
            JSON.stringify({ data: input.slice(i, i + WRITE_CHUNK) }),
          ])
        }
        input = undefined
      }
      if (Date.now() > deadline) {
        throw new Error(
          `The reader timed out on that computer. Last output: ${lastScreen.trim().slice(-500) || '(none)'}`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  } finally {
    void rex(props.host, [
      'api',
      'call',
      '-s',
      props.session,
      'block.close',
      JSON.stringify({ block_id: block, session_id: props.session }),
    ])
  }
}

/** Decodes the framed result printed by a hidden-terminal, local, or SSH program. */
export function decodeFramed(output: string) {
  const match = /REXB64:([A-Za-z0-9+/=]+):REXEND/.exec(
    output.replace(/\s+/g, ''),
  )
  if (!match?.[1]) {
    throw new Error(
      'The reader returned no result. Check that Node is installed on that computer.',
    )
  }
  return JSON.parse(
    gunzipSync(Buffer.from(match[1], 'base64')).toString(),
  ) as unknown
}

export async function readScreen(props: {
  block: string
  host: string
  session: string
}) {
  let reply = await rexJson({
    args: [
      'block',
      'call',
      '-s',
      props.session,
      '-b',
      props.block,
      'format',
      JSON.stringify({
        format: 'text',
        max_bytes: 983_040,
        trim: true,
        unwrap: true,
      }),
    ],
    host: props.host,
    schema: formatReplySchema,
  })
  let text = reply.content
  while (reply.id !== undefined && !reply.eof) {
    reply = await rexJson({
      args: [
        'block',
        'call',
        '-s',
        props.session,
        '-b',
        props.block,
        'blob_read',
        JSON.stringify({ id: reply.id }),
      ],
      host: props.host,
      schema: formatReplySchema,
    })
    text += reply.content
  }
  return text
}
