import assert from 'node:assert/strict'
import { test } from 'vitest'

import { parseTranscript } from './transcript-parser.mjs'

const jsonl = (rows) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`
test('Claude follows the active branch, excludes sidechains and shows tool calls/results', () => {
  const rows = [
    {
      message: { content: 'hello', role: 'user' },
      parentUuid: null,
      type: 'user',
      uuid: 'a',
    },
    {
      message: { content: 'abandoned', role: 'assistant' },
      parentUuid: 'a',
      type: 'assistant',
      uuid: 'old',
    },
    {
      message: {
        content: [
          {
            id: 'call',
            input: { file: 'example.ts' },
            name: 'Read',
            type: 'tool_use',
          },
        ],
        role: 'assistant',
      },
      parentUuid: 'a',
      type: 'assistant',
      uuid: 'new',
    },
    {
      message: {
        content: [
          { content: 'contents', tool_use_id: 'call', type: 'tool_result' },
        ],
        role: 'user',
      },
      parentUuid: 'new',
      type: 'user',
      uuid: 'result',
    },
    {
      isSidechain: true,
      message: { content: 'hidden', role: 'assistant' },
      parentUuid: null,
      uuid: 'side',
    },
  ]
  const { items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items.map((i) => i.role),
    ['user', 'tool', 'result'],
  )
  assert(!JSON.stringify(items).includes('abandoned'))
})
test('Codex uses response items without duplicating event messages', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        payload: { message: 'answer', type: 'agent_message' },
        type: 'event_msg',
      },
      {
        payload: {
          content: [{ text: 'answer', type: 'output_text' }],
          role: 'assistant',
          type: 'message',
        },
        type: 'response_item',
      },
      {
        payload: {
          arguments: '{"cmd":"pwd"}',
          call_id: '1',
          name: 'exec',
          type: 'function_call',
        },
        type: 'response_item',
      },
      {
        payload: {
          call_id: '1',
          output: '/project',
          type: 'function_call_output',
        },
        type: 'response_item',
      },
    ]),
    'codex',
  )
  assert.deepEqual(
    items.map((i) => i.role),
    ['assistant', 'tool', 'result'],
  )
  assert.equal(items[0].text, 'answer')
})
test('Pi follows parent IDs and preserves compaction boundaries', () => {
  const { items } = parseTranscript(
    jsonl([
      { cwd: '/project', id: 'session', type: 'session' },
      {
        id: 'a',
        message: { content: 'first', role: 'user' },
        parentId: null,
        type: 'message',
      },
      {
        id: 'b',
        message: { content: 'discarded branch', role: 'assistant' },
        parentId: 'a',
        type: 'message',
      },
      {
        id: 'c',
        parentId: 'a',
        summary: 'Earlier context',
        type: 'compaction',
      },
      {
        id: 'd',
        message: {
          content: [{ text: 'current', type: 'text' }],
          role: 'assistant',
        },
        parentId: 'c',
        type: 'message',
      },
    ]),
    'pi',
  )
  assert.deepEqual(
    items.map((i) => i.text),
    ['first', 'Earlier context', 'current'],
  )
})
test('an incomplete appended line waits until newline; malformed complete lines are reported', () => {
  const good = jsonl([
    {
      payload: { content: 'hi', role: 'user', type: 'message' },
      type: 'response_item',
    },
  ])
  const result = parseTranscript(`${good}not json\n{"type":`, 'codex')
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.warnings, ['Skipped a malformed record.'])
})
test('hostile transcript text remains text, never markup', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        payload: {
          content: '<script>alert(1)</script>',
          role: 'assistant',
          type: 'message',
        },
        type: 'response_item',
      },
    ]),
    'codex',
  )
  assert.equal(items[0].text, '<script>alert(1)</script>')
})
test('Claude slash commands, mid-turn messages and image tags read as plain user messages', () => {
  const rows = [
    {
      message: {
        content:
          '<command-message>design</command-message>\n<command-name>/design</command-name>\n<command-args>redo the ui</command-args>',
        role: 'user',
      },
      parentUuid: null,
      type: 'user',
      uuid: 'a',
    },
    {
      attachment: {
        humanTurn: true,
        prompt: 'and the toggle [Image #2]',
        type: 'queued_command',
      },
      parentUuid: 'a',
      type: 'attachment',
      uuid: 'b',
    },
    {
      attachment: {
        humanTurn: true,
        prompt:
          '<task-notification><tool-use-id>t1</tool-use-id><status>completed</status></task-notification>',
        type: 'queued_command',
      },
      parentUuid: 'b',
      type: 'attachment',
      uuid: 'c',
    },
  ]
  const { finished, items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items.map((i) => [i.name, i.text]),
    [
      ['/design', 'redo the ui'],
      ['', 'and the toggle'],
    ],
  )
  assert.deepEqual(finished, { t1: 'completed' })
})
test('Claude is working until the turn_duration record', () => {
  const base = [
    {
      message: { content: 'go', role: 'user' },
      parentUuid: null,
      timestamp: '2026-11-20T10:00:00Z',
      type: 'user',
      uuid: 'a',
    },
    {
      message: {
        content: [{ id: 'x', input: {}, name: 'Bash', type: 'tool_use' }],
        role: 'assistant',
      },
      parentUuid: 'a',
      type: 'assistant',
      uuid: 'b',
    },
  ]
  const busy = parseTranscript(jsonl(base), 'claude')
  assert.equal(busy.working, true)
  assert.equal(busy.since, '2026-11-20T10:00:00Z')
  const idle = parseTranscript(
    jsonl([
      ...base,
      { parentUuid: 'b', subtype: 'turn_duration', type: 'system', uuid: 'c' },
    ]),
    'claude',
  )
  assert.equal(idle.working, false)
})
test('a parallel tool result on a sibling branch is kept', () => {
  const rows = [
    {
      message: { content: 'go', role: 'user' },
      parentUuid: null,
      timestamp: '1',
      type: 'user',
      uuid: 'a',
    },
    {
      message: {
        content: [
          { id: 'p1', input: {}, name: 'Bash', type: 'tool_use' },
          { id: 'p2', input: {}, name: 'Bash', type: 'tool_use' },
        ],
        role: 'assistant',
      },
      parentUuid: 'a',
      timestamp: '2',
      type: 'assistant',
      uuid: 'b',
    },
    {
      message: {
        content: [{ content: 'one', tool_use_id: 'p1', type: 'tool_result' }],
        role: 'user',
      },
      parentUuid: 'b',
      timestamp: '3',
      type: 'user',
      uuid: 'r1',
    },
    {
      message: {
        content: [{ content: 'two', tool_use_id: 'p2', type: 'tool_result' }],
        role: 'user',
      },
      parentUuid: 'b',
      timestamp: '4',
      type: 'user',
      uuid: 'r2',
    },
    {
      message: { content: 'done', role: 'assistant' },
      parentUuid: 'r2',
      timestamp: '5',
      type: 'assistant',
      uuid: 'd',
    },
  ]
  const { items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items
      .filter((i) => i.role === 'result')
      .map((i) => i.text)
      .sort(),
    ['one', 'two'],
  )
})
test('a mid-turn message with an image keeps its text and an image item', () => {
  const rows = [
    {
      attachment: {
        humanTurn: true,
        prompt: [
          { text: '[Image #5] Can you see this', type: 'text' },
          { source: { data: 'x', type: 'base64' }, type: 'image' },
        ],
        type: 'queued_command',
      },
      parentUuid: null,
      type: 'attachment',
      uuid: 'a',
    },
  ]
  const { items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items.map((i) => [i.role, i.text]),
    [
      ['user', 'Can you see this'],
      ['attachment', 'Image'],
    ],
  )
})
test('two messages queued in one turn both show, and a later notification does not mean working', () => {
  const rows = [
    {
      message: { content: 'go', role: 'user' },
      parentUuid: null,
      timestamp: '1',
      type: 'user',
      uuid: 'a',
    },
    {
      attachment: { humanTurn: true, prompt: 'one', type: 'queued_command' },
      parentUuid: 'a',
      timestamp: '2',
      type: 'attachment',
      uuid: 'q1',
    },
    {
      attachment: { humanTurn: true, prompt: 'two', type: 'queued_command' },
      parentUuid: 'a',
      timestamp: '3',
      type: 'attachment',
      uuid: 'q2',
    },
    {
      message: { content: 'ok', role: 'assistant' },
      parentUuid: 'q2',
      timestamp: '4',
      type: 'assistant',
      uuid: 'b',
    },
    {
      parentUuid: 'b',
      subtype: 'turn_duration',
      timestamp: '5',
      type: 'system',
      uuid: 't',
    },
    {
      message: {
        content:
          '<task-notification><tool-use-id>x</tool-use-id><status>completed</status></task-notification>',
        role: 'user',
      },
      parentUuid: 't',
      timestamp: '6',
      type: 'user',
      uuid: 'n',
    },
  ]
  const r = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    r.items.filter((i) => i.role === 'user').map((i) => i.text),
    ['go', 'one', 'two'],
  )
  assert.equal(r.working, false)
})
test('uploaded file paths become file attachments', () => {
  const rows = [
    {
      message: {
        content:
          '/home/u/.local/state/rex-browser/uploads/0f3a-11/notes.md What is in it?',
        role: 'user',
      },
      parentUuid: null,
      type: 'user',
      uuid: 'a',
    },
  ]
  const { items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items.map((i) => [i.role, i.text, i.name]),
    [
      ['user', 'What is in it?', ''],
      ['attachment', 'notes.md', 'file'],
    ],
  )
})
test('Codex injected context is not shown as user messages', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        payload: {
          content: [
            {
              text: '# AGENTS.md instructions\n\n<INSTRUCTIONS>x</INSTRUCTIONS>',
              type: 'input_text',
            },
            {
              text: '<environment_context>\n<cwd>/p</cwd>\n</environment_context>',
              type: 'input_text',
            },
          ],
          role: 'user',
          type: 'message',
        },
        type: 'response_item',
      },
      {
        payload: {
          content: [{ text: 'hi', type: 'input_text' }],
          role: 'user',
          type: 'message',
        },
        type: 'response_item',
      },
    ]),
    'codex',
  )
  assert.deepEqual(
    items.map((i) => i.text),
    ['hi'],
  )
})
test('a failed Pi reply shows its error', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        id: 'a',
        message: { content: 'hi', role: 'user' },
        parentId: null,
        type: 'message',
      },
      {
        id: 'b',
        message: {
          content: [],
          errorMessage:
            'Token refresh failed (401): {\n  "error": {"message": "Please sign in again."}}',
          role: 'assistant',
          stopReason: 'error',
        },
        parentId: 'a',
        type: 'message',
      },
    ]),
    'pi',
  )
  assert.deepEqual(
    items.map((i) => [i.role, i.text]),
    [
      ['user', 'hi'],
      ['error', 'Token refresh failed (401): Please sign in again.'],
    ],
  )
})
test('a mid-turn message written after newer records does not hide them', () => {
  // Shape captured 2026-11-20: the queued_command attachment is the last record in the file, parented at the
  // point it was sent, while the assistant kept working on the main chain.
  const rows = [
    {
      message: { content: 'go', role: 'user' },
      parentUuid: null,
      timestamp: '1',
      type: 'user',
      uuid: 'u',
    },
    {
      message: { content: 'step one', role: 'assistant' },
      parentUuid: 'u',
      timestamp: '2',
      type: 'assistant',
      uuid: 'a1',
    },
    {
      message: { content: 'step two', role: 'assistant' },
      parentUuid: 'a1',
      timestamp: '4',
      type: 'assistant',
      uuid: 'a2',
    },
    {
      attachment: {
        humanTurn: true,
        prompt: 'how do i see the agent?',
        type: 'queued_command',
      },
      parentUuid: 'a1',
      timestamp: '3',
      type: 'attachment',
      uuid: 'q',
    },
  ]
  const { items } = parseTranscript(jsonl(rows), 'claude')
  assert.deepEqual(
    items.map((i) => i.text),
    ['go', 'step one', 'how do i see the agent?', 'step two'],
  )
})
test('Esc interrupting Claude ends the turn', () => {
  // Captured shape: an Esc interrupt writes this user record and no system:turn_duration.
  const rows = [
    {
      message: { content: 'go', role: 'user' },
      parentUuid: null,
      timestamp: '1',
      type: 'user',
      uuid: 'a',
    },
    {
      message: { content: 'working on it', role: 'assistant' },
      parentUuid: 'a',
      timestamp: '2',
      type: 'assistant',
      uuid: 'b',
    },
    {
      message: {
        content: [{ text: '[Request interrupted by user]', type: 'text' }],
        role: 'user',
      },
      parentUuid: 'b',
      timestamp: '3',
      type: 'user',
      uuid: 'c',
    },
  ]
  assert.equal(parseTranscript(jsonl(rows), 'claude').working, false)
})
test('a Claude tool result flagged is_error is failed; one starting with "Error" but not flagged is not', () => {
  const rows = [
    {
      message: {
        content: [
          { id: 't1', input: {}, name: 'Bash', type: 'tool_use' },
          { id: 't2', input: {}, name: 'Bash', type: 'tool_use' },
        ],
        role: 'assistant',
      },
      parentUuid: null,
      type: 'assistant',
      uuid: 'a',
    },
    {
      message: {
        content: [
          {
            content: 'Exit code 1',
            is_error: true,
            tool_use_id: 't1',
            type: 'tool_result',
          },
          {
            content: 'error: Run `ai login` first (expected output)',
            tool_use_id: 't2',
            type: 'tool_result',
          },
        ],
        role: 'user',
      },
      parentUuid: 'a',
      type: 'user',
      uuid: 'b',
    },
  ]
  const results = parseTranscript(jsonl(rows), 'claude').items.filter(
    (i) => i.role === 'result',
  )
  assert.deepEqual(
    results.map((r) => r.failed),
    [true, false],
  )
})
test('Codex is working from task_started until task_complete, and its error events show', () => {
  const started = [
    { payload: { type: 'task_started' }, type: 'event_msg' },
    {
      payload: { message: 'stream disconnected\ndetails', type: 'error' },
      type: 'event_msg',
    },
  ]
  const busy = parseTranscript(jsonl(started), 'codex')
  assert.equal(busy.working, true)
  assert.deepEqual(
    busy.items.map((i) => [i.role, i.text]),
    [['error', 'stream disconnected']],
  )
  assert.equal(
    parseTranscript(
      jsonl([
        ...started,
        { payload: { type: 'task_complete' }, type: 'event_msg' },
      ]),
      'codex',
    ).working,
    false,
  )
})

test('Claude thinking summaries show as notes; hidden thinking stays out', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        message: { content: 'hi', role: 'user' },
        parentUuid: null,
        type: 'user',
        uuid: 'a',
      },
      {
        message: {
          content: [
            {
              signature: 's',
              thinking: 'Checking the parser first.',
              type: 'thinking',
            },
            { signature: 's', thinking: '', type: 'thinking' },
            { text: 'Done.', type: 'text' },
          ],
          role: 'assistant',
        },
        parentUuid: 'a',
        type: 'assistant',
        uuid: 'b',
      },
    ]),
    'claude',
  )
  assert.deepEqual(
    items.map((item) => [item.role, item.text]),
    [
      ['user', 'hi'],
      ['summary', 'Checking the parser first.'],
      ['assistant', 'Done.'],
    ],
  )
})

test('a message queued off a parallel tool result on a side branch still shows', () => {
  const result = (uuid, parentUuid, id, timestamp) => ({
    message: {
      content: [{ content: 'ok', tool_use_id: id, type: 'tool_result' }],
      role: 'user',
    },
    parentUuid,
    timestamp,
    type: 'user',
    uuid,
  })
  const { items } = parseTranscript(
    jsonl([
      {
        message: { content: 'go', role: 'user' },
        parentUuid: null,
        timestamp: '1',
        type: 'user',
        uuid: 'a',
      },
      {
        message: {
          content: [
            { id: 't1', input: {}, name: 'Bash', type: 'tool_use' },
            { id: 't2', input: {}, name: 'Bash', type: 'tool_use' },
          ],
          role: 'assistant',
        },
        parentUuid: 'a',
        timestamp: '2',
        type: 'assistant',
        uuid: 'b',
      },
      result('r2', 'b', 't2', '3'),
      result('r1', 'b', 't1', '4'),
      {
        attachment: {
          humanTurn: true,
          prompt: 'also this',
          type: 'queued_command',
        },
        parentUuid: 'r2',
        timestamp: '5',
        type: 'attachment',
        uuid: 'q',
      },
      {
        message: { content: 'Done.', role: 'assistant' },
        parentUuid: 'r1',
        timestamp: '6',
        type: 'assistant',
        uuid: 'c',
      },
    ]),
    'claude',
  )
  assert.ok(
    items.some((item) => item.role === 'user' && item.text === 'also this'),
  )
})

test('Claude history before a compaction stays visible', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        message: { content: 'before', role: 'user' },
        parentUuid: null,
        type: 'user',
        uuid: 'a',
      },
      {
        message: { content: 'old reply', role: 'assistant' },
        parentUuid: 'a',
        type: 'assistant',
        uuid: 'b',
      },
      {
        logicalParentUuid: 'b',
        parentUuid: null,
        subtype: 'compact_boundary',
        type: 'system',
        uuid: 'c',
      },
      {
        isCompactSummary: true,
        message: { content: 'Summary: …', role: 'user' },
        parentUuid: 'c',
        type: 'user',
        uuid: 'd',
      },
      {
        message: { content: 'after', role: 'user' },
        parentUuid: 'd',
        type: 'user',
        uuid: 'e',
      },
      { permissionMode: 'auto', type: 'permission-mode' },
    ]),
    'claude',
  )
  assert.deepEqual(
    items.map((item) => [item.role, item.text]),
    [
      ['user', 'before'],
      ['assistant', 'old reply'],
      ['summary', 'Context compacted.'],
      ['user', 'after'],
    ],
  )
})

test('messages a compaction kept, including a queued one, stay visible', () => {
  const { items } = parseTranscript(
    jsonl([
      {
        message: { content: 'old', role: 'user' },
        parentUuid: null,
        type: 'user',
        uuid: 'a',
      },
      {
        message: { content: 'kept reply', role: 'assistant' },
        parentUuid: 'a',
        type: 'assistant',
        uuid: 'k1',
      },
      {
        attachment: {
          humanTurn: true,
          prompt: 'queued while busy',
          type: 'queued_command',
        },
        parentUuid: 'k1',
        type: 'attachment',
        uuid: 'k2',
      },
      {
        compactMetadata: {
          preservedMessages: { allUuids: ['k1', 'k2', 'gone'] },
        },
        logicalParentUuid: 'gone',
        parentUuid: null,
        subtype: 'compact_boundary',
        type: 'system',
        uuid: 'c',
      },
      {
        message: { content: 'after', role: 'user' },
        parentUuid: 'c',
        type: 'user',
        uuid: 'e',
      },
    ]),
    'claude',
  )
  assert.deepEqual(
    items.map((item) => item.text),
    ['old', 'kept reply', 'queued while busy', 'Context compacted.', 'after'],
  )
})

test('! commands read as your command plus its output, and a terminal run as the original command', () => {
  const user = (uuid, parentUuid, content) => ({
    message: { content, role: 'user' },
    parentUuid,
    type: 'user',
    uuid,
  })
  const { items } = parseTranscript(
    jsonl([
      user('a', null, '<bash-input>echo hi</bash-input>'),
      user(
        'b',
        'a',
        '<bash-stdout>hi</bash-stdout><bash-stderr></bash-stderr>',
      ),
      user(
        'c',
        'b',
        '<bash-input>cat "$HOME/.local/state/rex-browser/runs/ab12cd34.txt"</bash-input>',
      ),
      user(
        'd',
        'c',
        '<bash-stdout>$ gh auth refresh  (ran in a terminal)\nDone.\n[exit 0]</bash-stdout><bash-stderr></bash-stderr>',
      ),
    ]),
    'claude',
  )
  assert.deepEqual(
    items.map((item) => [item.role, item.text, item.name]),
    [
      ['user', '! echo hi', ''],
      ['tool', JSON.stringify({ command: 'echo hi' }, null, 2), 'Terminal'],
      ['result', 'hi', 'shell:b'],
      ['user', '! gh auth refresh', ''],
      [
        'tool',
        JSON.stringify({ command: 'gh auth refresh' }, null, 2),
        'Terminal',
      ],
      ['result', 'Done.\n[exit 0]', 'run:ab12cd34'],
    ],
  )
})

test('Codex ! commands read like Claude ones, with a failed exit and a silent command', () => {
  // Layout from a real ~/.codex/sessions rollout.
  const shell = (command, exit, output) => ({
    payload: {
      content: [
        {
          text: `<user_shell_command>\n<command>\n${command}\n</command>\n<result>\nExit code: ${exit}\nDuration: 0.0220 seconds\nOutput:\n${output}\n</result>\n</user_shell_command>`,
          type: 'input_text',
        },
      ],
      role: 'user',
      type: 'message',
    },
    type: 'response_item',
  })
  const { items } = parseTranscript(
    jsonl([
      shell('ls nope', 2, 'ls: nope: No such file'),
      shell('true', 0, ''),
    ]),
    'codex',
  )
  assert.deepEqual(
    items
      .filter((item) => item.role !== 'tool')
      .map((item) => [item.role, item.text, item.failed]),
    [
      ['user', '! ls nope', false],
      ['result', 'ls: nope: No such file', true],
      ['user', '! true', false],
      ['result', '(no output)', false],
    ],
  )
})

test('Claude ! output is unescaped', () => {
  const user = (uuid, parentUuid, content) => ({
    message: { content, role: 'user' },
    parentUuid,
    type: 'user',
    uuid,
  })
  const { items } = parseTranscript(
    jsonl([
      user(
        'a',
        null,
        '<bash-input>cat "$HOME/.local/state/rex-browser/runs/e6f6efe6.txt"</bash-input>',
      ),
      user(
        'b',
        'a',
        '<bash-stdout>$ git checkout main &amp;&amp; git pull  (ran in a terminal)\nerror: &lt;main&gt; not found\n\n[exit 1]</bash-stdout><bash-stderr></bash-stderr>',
      ),
    ]),
    'claude',
  )
  assert.deepEqual(
    items
      .filter((item) => item.role !== 'tool')
      .map((item) => [item.role, item.text]),
    [
      ['user', '! git checkout main && git pull'],
      ['result', 'error: <main> not found\n\n[exit 1]'],
    ],
  )
})
