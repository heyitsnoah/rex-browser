import { expect, test } from 'vitest'

import { conversationBlocks } from '@/workspace/conversation-blocks'

function item(
  role: 'assistant' | 'attachment' | 'result' | 'tool' | 'user',
  id: string,
  text: string,
  name = '',
) {
  return { id, image: undefined, name, role, text, time: '' }
}

test('pairs each call with its result and folds consecutive calls into one run', () => {
  const blocks = conversationBlocks([
    item('user', 'u', 'go'),
    item('tool', 'c1', '{"command":"ls"}', 'Bash'),
    item('tool', 'c2', '{"file_path":"a.ts"}', 'Read'),
    item('result', 'r2', 'contents', 'c2'),
    item('result', 'r1', 'Error: no such file', 'c1'),
    item('assistant', 'a', 'done'),
  ])
  expect(blocks.map((block) => block.kind)).toEqual(['you', 'run', 'said'])
  const run = blocks.at(1)
  expect(
    run?.kind === 'run' &&
      run.calls.map((call) => [call.name, call.output, call.failed]),
  ).toEqual([
    ['Bash', 'Error: no such file', true],
    ['Read', 'contents', false],
  ])
})

test('a subagent call breaks the run and keeps its result', () => {
  const blocks = conversationBlocks([
    item('tool', 'c1', '{}', 'Bash'),
    item('tool', 'ag', '{"description":"Research"}', 'Agent'),
    item('result', 'r', 'launched', 'ag'),
    item('tool', 'c2', '{}', 'Bash'),
  ])
  expect(blocks.map((block) => block.kind)).toEqual(['run', 'agent', 'run'])
})
