import type { ConversationItem as Item } from '@/transcripts/transcript-access'

import { toolKind } from '@/workspace/tool-calls'

export type ConversationBlock =
  | {
      attachments: { file: boolean; image: string | undefined; name: string }[]
      id: string
      kind: 'you'
      messages: { command: string; text: string }[]
    }
  | { call: ToolCall; id: string; kind: 'agent' }
  | { calls: ToolCall[]; id: string; kind: 'run' }
  | { error: boolean; id: string; kind: 'note'; text: string }
  | { id: string; kind: 'said'; text: string }

export interface ToolCall {
  failed: boolean
  id: string
  input: string
  name: string
  output: string | undefined
}

/** Groups transcript items into what the conversation shows, in order. */
export function conversationBlocks(items: Item[]) {
  const results = new Map(
    items
      .filter((item) => item.role === 'result')
      .map((item) => [item.name, item]),
  )
  const paired = new Set<Item>()
  const blocks: ConversationBlock[] = []
  for (const item of items) {
    const last = blocks.at(-1)
    switch (item.role) {
      case 'assistant':
        blocks.push({ id: item.id, kind: 'said', text: item.text })
        break
      case 'attachment':
      case 'user': {
        const you =
          last?.kind === 'you'
            ? last
            : {
                attachments: [],
                id: item.id,
                kind: 'you' as const,
                messages: [],
              }
        if (you !== last) blocks.push(you)
        if (item.role === 'attachment') {
          you.attachments.push({
            file: item.name === 'file',
            image: item.image,
            name: item.text,
          })
        } else {
          you.messages.push({ command: item.name, text: item.text })
        }
        break
      }
      case 'error':
      case 'summary':
        blocks.push({
          error: item.role === 'error',
          id: item.id,
          kind: 'note',
          text: item.text,
        })
        break
      case 'result':
        // Results without a matching call (Pi) still show, as their own step.
        if (!paired.has(item)) {
          appendCall(blocks, {
            failed: item.failed,
            id: item.id,
            input: '',
            name: 'Output',
            output: item.text,
          })
        }
        break
      case 'tool': {
        const result = results.get(item.id)
        if (result) paired.add(result)
        const call = {
          failed: result?.failed ?? false,
          id: item.id,
          input: item.text,
          name: item.name,
          output: result?.text,
        }
        if (toolKind(item.name) === 'agent') {
          blocks.push({ call, id: item.id, kind: 'agent' })
        } else {
          appendCall(blocks, call)
        }
        // Your answers to an AskUserQuestion read as your message, as the terminal shows them.
        const answers =
          item.name === 'AskUserQuestion' && result && !result.failed
            ? questionAnswers(result.text)
            : []
        if (answers.length) {
          blocks.push({
            attachments: [],
            id: `${item.id}:answer`,
            kind: 'you',
            messages: answers.map((text) => ({ command: '', text })),
          })
        }
        break
      }
    }
  }
  return blocks
}

function appendCall(blocks: ConversationBlock[], call: ToolCall) {
  const last = blocks.at(-1)
  if (last?.kind === 'run') last.calls.push(call)
  else blocks.push({ calls: [call], id: call.id, kind: 'run' })
}

/** The answers in Claude Code's AskUserQuestion result: `…answered: "question"="answer", "q2"="a2". …`. */
function questionAnswers(output: string) {
  return [...output.matchAll(/"(?:[^"\\]|\\.)*"="((?:[^"\\]|\\.)*)"/g)].map(
    (match) => match[1].replace(/\\"/g, '"'),
  )
}
