// Turns raw agent JSONL into conversation items for the read-only view.
// Items: {id, role, name, text, time, failed}. Roles: user, assistant, tool, result, attachment,
// summary, error. `failed` marks a tool result that reported an error.
// Also reports whether the agent looks mid-turn (`working`, `since`) and which background
// subagents have finished (`finished`: tool_use id -> status).
// Context the agent injects as user messages (Claude reminders and command output; Codex AGENTS.md and environment).
const BOOKKEEPING =
  /^(<(system-reminder|local-command-stdout|local-command-stderr|local-command-caveat|environment_context|user_instructions|INSTRUCTIONS|turn_aborted|user_shell_command)>|# AGENTS\.md instructions)/

// "<command-message>x</command-message><command-name>/x</command-name><command-args>…</command-args>"
export function parseTranscript(text, agent) {
  const warnings = []
  const records = []
  const lines = text.split('\n')
  // The last line is still being written until it ends with a newline; it's read on the next poll.
  lines.pop()
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {
      warnings.push('Skipped a malformed record.')
    }
  }
  let active = records
  if (agent === 'pi' || agent === 'claude') {
    const idKey = agent === 'pi' ? 'id' : 'uuid'
    const parentKey = agent === 'pi' ? 'parentId' : 'parentUuid'
    const linked = records.filter(
      (r) => r[idKey] && (agent !== 'claude' || !r.isSidechain),
    )
    const index = new Map(linked.map((r) => [r[idKey], r]))
    // Claude appends a message sent mid-turn (a queued_command attachment) after newer records, with
    // its parent at the point it was sent; starting there would hide everything after it. Start from the
    // newest real record; queued messages branching off the path are added back below.
    let leaf = linked.findLast((r) => r.type !== 'attachment') ?? linked.at(-1)
    if (leaf && parentKey in leaf) {
      active = []
      const seen = new Set()
      while (leaf && !seen.has(leaf[idKey])) {
        seen.add(leaf[idKey])
        active.unshift(leaf)
        // A Claude compaction starts a new chain. A boundary that kept recent messages lists them (they sit
        // before it, partly on side branches) and the walk continues above the first; otherwise it points
        // back with logicalParentUuid.
        const kept = leaf.compactMetadata?.preservedMessages?.allUuids
        if (Array.isArray(kept) && kept.length) {
          for (const keptId of kept.toReversed()) {
            const record = index.get(keptId)
            if (record && !seen.has(keptId)) {
              seen.add(keptId)
              active.unshift(record)
            }
          }
          leaf = index.get(index.get(kept[0])?.[parentKey])
        } else {
          leaf = index.get(leaf[parentKey] ?? leaf.logicalParentUuid)
        }
      }
      // Results of parallel tool calls can sit on sibling branches; keep any whose call is on the active path.
      if (agent === 'claude') {
        const calls = new Set()
        const have = new Set()
        for (const r of active) {
          for (const p of Array.isArray(r.message?.content)
            ? r.message.content
            : []) {
            if (p.type === 'tool_use') calls.add(p.id)
            if (p.type === 'tool_result') have.add(p.tool_use_id)
          }
        }
        const strays = linked.filter(
          (r) =>
            !seen.has(r.uuid) &&
            Array.isArray(r.message?.content) &&
            r.message.content.some(
              (p) =>
                p.type === 'tool_result' &&
                calls.has(p.tool_use_id) &&
                !have.has(p.tool_use_id),
            ),
        )
        for (const r of strays) seen.add(r.uuid)
        // Also keep queued human messages that branch off the active path or off a result kept above
        // (several queued in one turn share a parent, or chain off each other).
        for (let added = true; added;) {
          added = false
          for (const r of linked) {
            if (
              !seen.has(r.uuid) &&
              r.attachment?.type === 'queued_command' &&
              r.attachment.humanTurn &&
              seen.has(r.parentUuid)
            ) {
              seen.add(r.uuid)
              strays.push(r)
              added = true
            }
          }
        }
        if (strays.length) {
          active = [...active, ...strays].sort((a, b) =>
            String(a.timestamp).localeCompare(String(b.timestamp)),
          )
        }
      }
    }
  }
  const items = []
  let time = ''
  function add(role, value, name = '', id = '', failed = false) {
    if (value === undefined || value === null || value === '') return
    items.push({
      failed,
      id: id || String(items.length),
      name,
      role,
      text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      time,
    })
  }
  // A `!` command you ran in the agent: your command, then its output as a step. A command run in its
  // own terminal from Rex Browser comes back as `cat …/rex-browser/runs/<id>.txt`; it reads as the
  // original command, with the output it saved.
  let shellCommand
  function shellRun(command, output, id, failed = false) {
    const run = /rex-browser\/runs\/([0-9a-f]{8})\.txt/.exec(command)
    const saved =
      run && /^\$ ([\s\S]*?) {2}\(ran in a terminal\)\n/.exec(output)
    const shown = saved ? saved[1] : command
    const callId = run ? `run:${run[1]}` : `shell:${id}`
    add('user', `! ${shown}`, '', `${id}:you`)
    add('tool', { command: shown }, 'Terminal', callId)
    add(
      'result',
      // A silent command still gets a result, or its step would look like it's still running.
      (saved ? output.slice(saved[0].length) : output) || '(no output)',
      callId,
      `${id}:out`,
      failed || /\[exit [1-9]\d*\]\s*$/.test(output),
    )
  }
  function userText(value, id) {
    const claudeInput = /^<bash-input>([\s\S]*)<\/bash-input>$/.exec(value)
    if (claudeInput) {
      shellCommand = claudeInput[1]
      return
    }
    const claudeOutput =
      /^<bash-stdout>([\s\S]*?)<\/bash-stdout><bash-stderr>([\s\S]*?)<\/bash-stderr>/.exec(
        value,
      )
    if (claudeOutput && shellCommand !== undefined) {
      shellRun(
        shellCommand,
        [claudeOutput[1], claudeOutput[2]].filter(Boolean).join('\n'),
        id,
      )
      shellCommand = undefined
      return
    }
    const codex =
      /^<user_shell_command>\s*<command>\s*([\s\S]*?)\s*<\/command>\s*<result>\s*(?:Exit code: (\d+)\n)?[\s\S]*?Output:\n([\s\S]*?)\s*<\/result>/.exec(
        value,
      )
    if (codex) {
      shellRun(
        codex[1],
        codex[3],
        id,
        codex[2] !== undefined && codex[2] !== '0',
      )
      return
    }
    if (
      BOOKKEEPING.test(value) ||
      value.startsWith('<task-notification>') ||
      value.startsWith('<agent-message')
    ) {
      return
    }
    const command = commandText(value)
    if (command) {
      add(
        'user',
        (command.args || command.name)
          .replace(/\s*\[Image #\d+\]\s*/g, ' ')
          .trim(),
        command.name,
        id,
      )
      return
    }
    // Files uploaded from Rex Browser arrive as pasted paths; show them as file chips, not paths.
    const files = []
    value = value.replace(
      /\S*\/\.local\/state\/rex-browser\/uploads\/[\w-]+\/([\w.-]+)/g,
      (_, name) => {
        files.push(name)
        return ' '
      },
    )
    // Claude writes "[Image #1] text" alongside the image part; the attachment item carries the image.
    add('user', value.replace(/\s*\[Image #\d+\]\s*/g, ' ').trim(), '', id)
    files.forEach((name, i) =>
      add('attachment', name, 'file', `${id}:file${i}`),
    )
  }
  function content(role, value, id) {
    if (typeof value === 'string') {
      if (role === 'user') userText(value, id)
      else add(role, value, '', id)
      return
    }
    for (const [i, part] of (Array.isArray(value) ? value : []).entries()) {
      const partId = `${id}:${i}`
      if (['input_text', 'output_text', 'text'].includes(part.type)) {
        if (role === 'user') userText(part.text, partId)
        else add(role, part.text, '', partId)
      } else if (part.type === 'thinking' && role === 'assistant') {
        // Claude Code shows summarized thinking as progress lines ("· summary"); hidden thinking is empty.
        add('summary', part.thinking?.trim(), '', partId)
      } else if (['tool_use', 'toolCall'].includes(part.type)) {
        add('tool', part.input ?? part.arguments, part.name, part.id || partId)
      } else if (part.type === 'tool_result') {
        const output =
          typeof part.content === 'string'
            ? part.content
            : (part.content || [])
                .map((c) => c.text || `[${c.type}]`)
                .join('\n')
        add('result', output, part.tool_use_id, partId, part.is_error === true)
      } else if (['image', 'input_image'].includes(part.type)) {
        add('attachment', 'Image', '', partId)
        // Inline image data (Claude: source.base64; Codex: data: URL). The server swaps it for a cache key.
        const url =
          typeof part.image_url === 'string'
            ? part.image_url
            : part.image_url?.url
        const m =
          typeof url === 'string' &&
          url.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s)
        const image =
          part.source?.type === 'base64'
            ? {
                data: part.source.data,
                mime: part.source.media_type || 'image/png',
              }
            : m
              ? { data: m[2], mime: m[1] }
              : null
        if (image && items.at(-1)?.role === 'attachment') {
          items.at(-1).image = image
        }
      }
    }
  }
  // What Claude Code's status line shows that the transcript also records.
  const status = {
    branch: '',
    context: 0,
    // Written as its own unlinked record whenever the mode changes.
    mode:
      records.findLast((r) => r.type === 'permission-mode')?.permissionMode ||
      '',
    model: '',
  }
  for (const [i, r] of active.entries()) {
    const id = r.uuid || r.id || String(i)
    time = r.timestamp || ''
    if (r.gitBranch) status.branch = r.gitBranch
    if (
      r.type === 'assistant' &&
      r.message?.usage &&
      r.message.model !== '<synthetic>'
    ) {
      const u = r.message.usage
      status.model = r.message.model || status.model
      status.context =
        (u.input_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0)
    }
    if (agent === 'codex') {
      const p = r.payload || {}
      // response_item is the canonical content; event_msg often repeats the same text.
      if (r.type === 'response_item') {
        if (p.type === 'message' && ['assistant', 'user'].includes(p.role)) {
          content(p.role, p.content, id)
        } else if (['custom_tool_call', 'function_call'].includes(p.type)) {
          add('tool', p.arguments ?? p.input, p.name, p.call_id || id)
        } else if (
          ['custom_tool_call_output', 'function_call_output'].includes(p.type)
        ) {
          // Codex records no error flag; its failures start with "error" (shell) or the tool's error tag.
          add(
            'result',
            p.output,
            p.call_id,
            id,
            /^(error|<tool_use_error>)/i.test(String(p.output ?? '').trim()),
          )
        }
      } else if (r.type === 'compacted') {
        add('summary', p.message || 'Earlier context compacted.', '', id)
      } else if (
        r.type === 'event_msg' &&
        (p.type === 'error' || p.type === 'stream_error') &&
        p.message
      ) {
        add('error', String(p.message).split('\n')[0], '', id)
      }
    } else if (
      r.type === 'compaction' ||
      r.type === 'branch_summary' ||
      (r.type === 'system' && r.subtype === 'compact_boundary')
    ) {
      add('summary', r.summary || 'Context compacted.', '', id)
    } else if (
      r.type === 'attachment' &&
      r.attachment?.type === 'queued_command' &&
      r.attachment.humanTurn
    ) {
      const prompt = r.attachment.prompt
      if (Array.isArray(prompt)) content('user', prompt, id)
      else userText(String(prompt || ''), id)
    } else if (
      r.message &&
      !r.isSidechain &&
      !r.isMeta &&
      !r.isCompactSummary
    ) {
      const role = r.message.role || r.type
      if (['assistant', 'toolResult', 'user'].includes(role)) {
        if (role === 'toolResult') {
          add(
            'result',
            (r.message.content || [])
              .map((c) => c.text || `[${c.type}]`)
              .join('\n'),
            '',
            id,
            r.message.isError === true,
          )
        } else {
          content(role, r.message.content, id)
        }
      }
      // Pi records a failed reply as stopReason "error" with the provider's message.
      if (
        role === 'assistant' &&
        r.message.stopReason === 'error' &&
        r.message.errorMessage
      ) {
        add('error', errorText(r.message.errorMessage), '', `${id}:error`)
      }
    }
  }

  // Working state. Claude ends each turn with a system:turn_duration record; Codex with task_complete.
  let working = false
  let since = ''
  const finished = {}
  if (agent === 'claude') {
    // Notification records (subagent hand-backs, task notifications) arrive as user records after a turn ends; they don't start one.
    const machine = (r) => {
      const c = r.message?.content
      const t =
        typeof c === 'string'
          ? c
          : Array.isArray(c)
            ? c.find((p) => p.type === 'text')?.text
            : ''
      return (
        typeof t === 'string' && /^<(task-notification|agent-message)/.test(t)
      )
    }
    const last = records.findLast(
      (r) =>
        r.type === 'assistant' ||
        (r.type === 'user' && !r.isMeta && !machine(r)) ||
        (r.type === 'system' && r.subtype === 'turn_duration') ||
        (r.attachment?.type === 'queued_command' &&
          r.attachment.humanTurn &&
          !/^<(task-notification|agent-message)/.test(
            String(r.attachment.prompt),
          )),
    )
    // A turn ends with system:turn_duration, or with "[Request interrupted by user]" when Esc stops a reply
    // (that interrupt writes no turn_duration).
    const interrupted = (r) =>
      r?.type === 'user' &&
      /^\[Request interrupted by user/.test(
        typeof r.message?.content === 'string'
          ? r.message.content
          : (r.message?.content?.find?.((p) => p.type === 'text')?.text ?? ''),
      )
    working =
      Boolean(last) &&
      !(last.type === 'system' && last.subtype === 'turn_duration') &&
      !interrupted(last)
    for (const r of records) {
      const note =
        r.type === 'queue-operation'
          ? r.content
          : r.attachment?.type === 'queued_command'
            ? Array.isArray(r.attachment.prompt)
              ? r.attachment.prompt.find((p) => p.type === 'text')?.text
              : r.attachment.prompt
            : ''
      if (typeof note !== 'string' || !note.startsWith('<task-notification>')) {
        continue
      }
      const use = note.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)?.[1]
      const status = note.match(/<status>([^<]+)<\/status>/)?.[1]
      if (use) finished[use] = status || 'completed'
    }
  } else if (agent === 'codex') {
    const last = records.findLast(
      (r) =>
        r.type === 'event_msg' &&
        ['task_complete', 'task_started', 'turn_aborted'].includes(
          r.payload?.type,
        ),
    )
    working = last?.payload?.type === 'task_started'
  }
  if (working) {
    since = items.findLast((item) => item.role === 'user')?.time || ''
  }
  return {
    finished,
    items: items.slice(-500),
    since,
    status,
    warnings: [
      ...new Set([
        ...warnings,
        ...(items.length > 500
          ? ['Showing the latest 500 transcript items.']
          : []),
      ]),
    ],
    working,
  }
}

function commandText(text) {
  const name = text.match(/<command-name>([^<]*)<\/command-name>/)?.[1]
  if (!name) return null
  const args =
    text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1]?.trim() || ''
  return { args, name: name.trim() }
}

// First line of a provider error, plus the readable message when the rest is JSON ("…(401): {"error":{"message":"…"}}").
function errorText(value) {
  const text = String(value)
  const head = text.split('\n')[0].replace(/[\s:{]+$/, '')
  const detail = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  return detail && !head.includes(detail)
    ? `${head}: ${detail.replace(/\\"/g, '"')}`
    : head
}
