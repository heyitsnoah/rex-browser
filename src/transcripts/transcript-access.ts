import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

import { readAgentProcess } from '@/rex/agent-process'
import { runRemoteProgram } from '@/rex/remote-program'

const imageSchema = z.object({
  data: z.string(),
  id: z.string(),
  mime: z.string(),
})
const itemSchema = z.object({
  failed: z.boolean(),
  id: z.string(),
  image: z.union([z.string(), imageSchema]).optional(),
  name: z.string(),
  role: z.enum([
    'user',
    'assistant',
    'tool',
    'result',
    'attachment',
    'summary',
    'error',
  ]),
  text: z.string(),
  time: z.string(),
})
const resultSchema = z.union([
  z.object({ error: z.string() }),
  z.object({
    candidates: z.array(
      z.object({
        exact: z.boolean(),
        id: z.string(),
        modified: z.string(),
        sessionId: z.string(),
      }),
    ),
    parsed: z
      .object({
        finished: z.record(z.string(), z.string()),
        items: z.array(itemSchema),
        since: z.string(),
        status: z.object({
          branch: z.string(),
          context: z.number(),
          effort: z.string(),
          mode: z.string(),
          model: z.string(),
        }),
        warnings: z.array(z.string()),
        working: z.boolean(),
      })
      .optional(),
    selected: z.string().optional(),
    subagents: z.array(
      z.object({
        background: z.boolean(),
        description: z.string(),
        done: z.boolean(),
        recent: z.array(
          z.object({ input: z.unknown(), time: z.string(), tool: z.string() }),
        ),
        started: z.string(),
        tools: z.number(),
        toolUseId: z.string(),
        type: z.string(),
        updated: z.string(),
      }),
    ),
  }),
])

// Images stay out of the transcript poll: each is replaced by a hash and served once.
const images = new Map<string, { bytes: Buffer; mime: string }>()
const inflight = new Map<string, Promise<z.infer<typeof resultSchema>>>()

export function transcriptImage(id: string) {
  return images.get(id)
}

/** The conversation for an agent pane, or `agent: null` when the pane runs no agent. */
export type AgentConversation = Exclude<Conversation, { agent: null }>

export type Conversation = Awaited<ReturnType<typeof readConversation>>
export type ConversationItem = AgentConversation['items'][number]
export async function readConversation(props: {
  block: string
  host: string
  session: string
  transcript: string | undefined
}) {
  const { agent, byShell, cwd, pids } = await readAgentProcess(props)
  if (!agent) return { agent: null }
  const request = {
    agent,
    children: byShell,
    cwd,
    id: props.transcript,
    known: [...images.keys()],
    pids,
  }
  // One read per pane at a time; polls that arrive meanwhile share it.
  const key = [props.host, props.block, props.transcript ?? ''].join('|')
  let pending = inflight.get(key)
  if (!pending) {
    pending = runProgram({
      host: props.host,
      request,
      session: props.session,
    }).finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  const result = await pending
  if ('error' in result) throw new Error(result.error)
  return {
    agent,
    candidates: result.candidates,
    finished: result.parsed?.finished ?? {},
    items: result.parsed?.items.map(stashImage) ?? [],
    now: new Date().toISOString(),
    selected: result.selected,
    since: result.parsed?.since ?? '',
    status: result.parsed?.status,
    subagents: result.subagents,
    warnings: result.parsed?.warnings ?? [],
    working: result.parsed?.working ?? false,
  }
}

function stashImage(item: z.infer<typeof itemSchema>) {
  if (item.image === undefined) return { ...item, image: undefined }
  if (typeof item.image === 'string') {
    return { ...item, image: images.has(item.image) ? item.image : undefined }
  }
  if (!/^image\/(png|jpeg|gif|webp)$/.test(item.image.mime)) {
    return { ...item, image: undefined }
  }
  const bytes = Buffer.from(item.image.data, 'base64')
  const id = createHash('sha256').update(bytes).digest('hex').slice(0, 32)
  if (!images.has(id)) {
    images.set(id, { bytes, mime: item.image.mime })
    const oldest = images.keys().next().value
    if (images.size > 200 && oldest !== undefined) images.delete(oldest)
  }
  return { ...item, image: id }
}

/** The reader and parser run together on the computer that owns the files and return only the parsed conversation. */
async function programSource() {
  const dir = path.join(process.cwd(), 'src/transcripts')
  const reader = (
    await readFile(path.join(dir, 'transcript-reader.mjs'), 'utf8')
  ).replace(
    'export async function readTranscripts',
    'async function readTranscripts',
  )
  const parser = (
    await readFile(path.join(dir, 'transcript-parser.mjs'), 'utf8')
  ).replace('export function parseTranscript', 'function parseTranscript')
  const main = await readFile(path.join(dir, 'transcript-program.mjs'), 'utf8')
  return [reader, parser, main].join('\n')
}

async function runProgram(props: {
  host: string
  request: unknown
  session: string
}) {
  return resultSchema.parse(
    await runRemoteProgram({ ...props, source: await programSource() }),
  )
}
