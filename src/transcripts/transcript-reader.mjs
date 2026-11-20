// Runs on the machine that owns the agent; reads only approved transcript roots.
import { execFileSync } from 'node:child_process'
import {
  open,
  readdir,
  readFile,
  readlink,
  realpath,
  stat,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
// Bundled with transcript-parser.mjs and transcript-program.mjs to run locally, over SSH, or in a hidden Rex terminal (see transcript-access.ts).
export async function readTranscripts(request) {
  if (!['claude', 'codex', 'pi'].includes(request.agent)) {
    throw Error('Unknown agent')
  }
  const home = homedir()
  const root = path.join(
    home,
    {
      claude: '.claude/projects',
      codex: '.codex/sessions',
      pi: '.pi/agent/sessions',
    }[request.agent],
  )
  const files = []
  let visited = 0
  async function walk(dir, depth = 0) {
    if (depth > 6) return
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(
      () => [],
    )) {
      if (++visited > 20000) throw Error('Transcript discovery limit reached.')
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(file, depth + 1)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.jsonl') &&
        !dir.endsWith(`${path.sep}subagents`)
      ) {
        files.push(file)
      }
    }
  }
  await walk(root)
  // An agent started by a shell or wrapper (`eh pi …`, `zsh -lc 'claude …'`) is a child of the
  // pane's process; for such a pane add its children (two levels) so the agent's own PID is matched.
  const pids = (request.pids || []).filter(
    (p) => Number.isSafeInteger(p) && p > 0,
  )
  for (
    let level = 0, edge = request.children ? pids : [];
    level < 2 && edge.length;
    level++
  ) {
    const children = []
    for (const pid of edge) {
      try {
        children.push(
          ...execFileSync('pgrep', ['-P', String(pid)], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2000,
          })
            .split('\n')
            .map(Number)
            .filter((p) => p > 0 && !pids.includes(p)),
        )
      } catch {
        // pgrep exits 1 when there are no children.
      }
    }
    pids.push(...children)
    edge = children
  }
  // When the agent process started (via ps; works on Linux and macOS). For Pi, prefer the actual
  // `pi` child over a wrapper (`eh`, `zsh`), and pick up any explicit `--session` / `--session-id`.
  let started = 0
  let agentPid = pids[0] || 0
  let exactId = ''
  const exactPaths = []
  const launchCwds = new Set()
  const psByPid = new Map()
  try {
    if (pids.length) {
      const lines = execFileSync(
        'ps',
        ['-o', 'pid=,etime=,args=', '-p', pids.join(',')],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        },
      )
        .split('\n')
        .map((line) => /^\s*(\d+)\s+(\S+)\s+(.+)$/.exec(line))
        .filter(Boolean)
      for (const m of lines) psByPid.set(Number(m[1]), m[3])
      const piRow =
        request.agent === 'pi' && lines.find((m) => isPiCommand(m[3]))
      const picked =
        piRow || lines.find((m) => Number(m[1]) === pids[0]) || lines[0]
      if (picked) {
        agentPid = Number(picked[1])
        started = parseEtime(picked[2])
        if (request.agent === 'pi') {
          const args = picked[3] || ''
          const sessionFile =
            /(?:^|\s)--session(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(args)
          const sessionPath =
            sessionFile?.[1] || sessionFile?.[2] || sessionFile?.[3]
          if (sessionPath) {
            exactPaths.push(
              path.isAbsolute(sessionPath)
                ? sessionPath
                : path.resolve(request.cwd || home, sessionPath),
            )
          }
          const sessionIdArg = /(?:^|\s)--session-id(?:=|\s+)(\S+)/.exec(args)
          if (sessionIdArg?.[1]) exactId = sessionIdArg[1]
        }
      }
    }
  } catch {
    // Optional metadata: matching falls back to the project directory.
  }
  let fdPids = pids
  if (request.agent === 'claude') {
    for (const pid of pids) {
      try {
        const info = JSON.parse(
          await readFile(
            path.join(home, '.claude/sessions', `${pid}.json`),
            'utf8',
          ),
        )
        // The pane's own process comes first; a Claude started inside it (from a tool) doesn't win.
        if (info.sessionId) {
          exactId = info.sessionId
          break
        }
      } catch {
        // Optional metadata: matching falls back to the project directory.
      }
    }
  } else if (request.agent === 'pi' && agentPid) {
    // Pi's own PWD records the folder it started in (even if a tool/worktree moves it later).
    const selfEnv = await readFile(`/proc/${agentPid}/environ`, 'utf8').catch(
      () => '',
    )
    for (const entry of selfEnv.split('\0')) {
      if (entry.startsWith('PWD=')) {
        const pwd = entry.slice('PWD='.length)
        if (pwd) launchCwds.add(pwd)
      }
    }
    // Pi passes PI_SESSION_FILE / PI_SESSION_ID to direct non-Pi children (e.g. bash tools).
    // Skip nested `pi` subagents so a subagent's session never overwrites the parent pane.
    let directChildren = []
    try {
      directChildren = execFileSync('pgrep', ['-P', String(agentPid)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      })
        .split('\n')
        .map(Number)
        .filter((p) => p > 0)
    } catch {
      // No children.
    }
    if (directChildren.length) {
      try {
        const childRows = execFileSync(
          'ps',
          ['-o', 'pid=,args=', '-p', directChildren.join(',')],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2000,
          },
        )
          .split('\n')
          .map((line) => /^\s*(\d+)\s+(.+)$/.exec(line))
          .filter(Boolean)
        for (const m of childRows) psByPid.set(Number(m[1]), m[2])
      } catch {
        // Best-effort filter.
      }
    }
    const toolChildren = directChildren.filter(
      (pid) => !isPiCommand(psByPid.get(pid) || ''),
    )
    fdPids = [agentPid, ...toolChildren]
    for (const pid of toolChildren) {
      const env = await readFile(`/proc/${pid}/environ`, 'utf8').catch(() => '')
      for (const entry of env.split('\0')) {
        if (entry.startsWith('PI_SESSION_FILE=')) {
          const p = entry.slice('PI_SESSION_FILE='.length)
          if (p) exactPaths.push(p)
        } else if (entry.startsWith('PI_SESSION_ID=')) {
          const id = entry.slice('PI_SESSION_ID='.length)
          if (id) exactId = id
        }
      }
    }
  }
  const openPaths = [...exactPaths]
  try {
    if (fdPids.length) {
      openPaths.push(
        ...execFileSync('lsof', ['-a', '-p', fdPids.join(','), '-Fn'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        })
          .split('\n')
          .filter((l) => l.startsWith('n'))
          .map((l) => l.slice(1)),
      )
    }
  } catch {
    // lsof is often missing on Linux; /proc/<pid>/fd lists the same open files.
    for (const pid of fdPids) {
      for (const fd of await readdir(`/proc/${pid}/fd`).catch(() => [])) {
        const target = await readlink(`/proc/${pid}/fd/${fd}`).catch(() => '')
        if (target.endsWith('.jsonl')) openPaths.push(target)
      }
    }
  }
  const canonicalCwd = request.cwd
    ? await realpath(request.cwd).catch(() => request.cwd)
    : ''
  const canonicalOpenPaths = new Set(
    await Promise.all(openPaths.map((p) => realpath(p).catch(() => p))),
  )
  const candidates = []
  for (const file of files) {
    const handle = await open(file, 'r')
    let prefix
    try {
      const buf = Buffer.alloc(65536)
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0)
      prefix = buf.subarray(0, bytesRead).toString()
    } finally {
      await handle.close()
    }
    const rows = prefix.split('\n').flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
    const meta =
      rows.find((r) => r.type === 'session_meta')?.payload ||
      rows.find((r) => r.type === 'session') ||
      rows.find((r) => r.cwd) ||
      {}
    const sessionId = meta.sessionId || meta.id || path.basename(file, '.jsonl')
    const canonicalFile = await realpath(file).catch(() => file)
    const exact =
      (exactId &&
        (path.basename(file) === `${exactId}.jsonl` ||
          sessionId === exactId)) ||
      openPaths.includes(file) ||
      canonicalOpenPaths.has(canonicalFile)
    const sameCwd =
      meta.cwd === request.cwd ||
      launchCwds.has(meta.cwd) ||
      (Boolean(canonicalCwd) &&
        (meta.cwd === canonicalCwd ||
          (await realpath(meta.cwd || '').catch(() => '')) === canonicalCwd))
    if (!exact && !sameCwd) continue
    // Codex writes a separate rollout for each subagent thread, in the same folders with the same cwd.
    if (!exact && (meta.parent_thread_id || meta.source?.subagent)) continue
    const info = await stat(file)
    // Pi records its session creation timestamp on startup even before flushing the file on the first message.
    const metaTime =
      request.agent === 'pi' && meta.timestamp ? Date.parse(meta.timestamp) : 0
    const created =
      Number.isFinite(metaTime) && metaTime > 0
        ? metaTime
        : info.birthtimeMs > 0
          ? info.birthtimeMs
          : info.mtimeMs
    candidates.push({
      created,
      exact: Boolean(exact),
      id: Buffer.from(path.relative(root, file)).toString('base64url'),
      modified: info.mtime.toISOString(),
      sessionId,
    })
  }
  candidates.sort((a, b) => b.modified.localeCompare(a.modified))
  const exact = candidates.filter((c) => c.exact)
  let fallback
  if (!request.id && exact.length === 0 && !exactId && started) {
    if (request.agent === 'pi') {
      const otherSameCwdStarts = await otherPiStartsInCwd({
        canonicalCwd,
        excludePids: new Set([...pids, agentPid]),
        launchCwds,
        requestCwd: request.cwd,
      })
      fallback = choosePiCandidate({
        candidates,
        otherSameCwdStarts,
        started,
      })
    } else {
      // No exact match (Codex): the newest transcript in this project created after the agent started is the live one.
      fallback = candidates
        .filter((c) => c.created >= started - 10000)
        .sort((a, b) => b.created - a.created)[0]
    }
  }
  // Claude (or Pi with explicit --session-id) names its session exactly; until that file exists
  // there is no transcript, and guessing by start time could pick another agent's conversation.
  const chosen = request.id
    ? candidates.find((c) => c.id === request.id)
    : exact.length > 0
      ? exact[0]
      : exactId
        ? undefined
        : fallback
  let text
  let truncated = false
  if (chosen) {
    const file = await realpath(
      path.join(root, Buffer.from(chosen.id, 'base64url').toString()),
    )
    const canonicalRoot = await realpath(root)
    if (!file.startsWith(canonicalRoot + path.sep)) {
      throw Error('Transcript is outside the permitted root.')
    }
    const handle = await open(file, 'r')
    try {
      // Long sessions keep growing; the view shows only recent items, so read the last 16 MiB
      // starting at the first complete line.
      const info = await handle.stat()
      const limit = 16 * 1024 * 1024
      if (info.size > limit) {
        const buffer = Buffer.alloc(limit)
        await handle.read(buffer, 0, limit, info.size - limit)
        const tail = buffer.toString('utf8')
        text = tail.slice(tail.indexOf('\n') + 1)
        truncated = true
      } else {
        text = await handle.readFile('utf8')
      }
    } finally {
      await handle.close()
    }
  }
  // Claude subagents: <session>/subagents/agent-<id>.jsonl with a .meta.json beside it.
  async function subagents(file) {
    const dir = `${file.replace(/\.jsonl$/, '') + path.sep}subagents`
    const out = []
    // The 20 most recently written: readdir order isn't chronological.
    const metas = (await readdir(dir).catch(() => [])).filter((n) =>
      n.endsWith('.meta.json'),
    )
    const written = await Promise.all(
      metas.map(async (n) => [
        n,
        (
          await stat(
            path.join(dir, n.replace(/\.meta\.json$/, '.jsonl')),
          ).catch(() => ({ mtimeMs: 0 }))
        ).mtimeMs,
      ]),
    )
    for (const name of written
      .sort((a, b) => a[1] - b[1])
      .slice(-20)
      .map(([n]) => n)) {
      try {
        const meta = JSON.parse(await readFile(path.join(dir, name), 'utf8'))
        const log = path.join(dir, name.replace(/\.meta\.json$/, '.jsonl'))
        const info = await stat(log)
        const handle = await open(log, 'r')
        let body
        try {
          const size = Math.min(info.size, 4 * 1024 * 1024)
          const buf = Buffer.alloc(size)
          await handle.read(buf, 0, size, info.size - size)
          body = buf.toString()
        } finally {
          await handle.close()
        }
        const rows = body.split('\n').flatMap((l) => {
          try {
            return [JSON.parse(l)]
          } catch {
            return []
          }
        })
        const steps = []
        let started = ''
        let lastAssistant
        for (const r of rows) {
          if (!started && r.timestamp) started = r.timestamp
          if (r.type !== 'assistant') continue
          lastAssistant = r
          for (const part of Array.isArray(r.message?.content)
            ? r.message.content
            : []) {
            if (part.type === 'tool_use') {
              steps.push({
                input: part.input,
                time: r.timestamp,
                tool: part.name,
              })
            }
          }
        }
        const done =
          Boolean(lastAssistant) &&
          !(lastAssistant.message?.content || []).some(
            (p) => p.type === 'tool_use',
          ) &&
          lastAssistant.message?.stop_reason != null
        out.push({
          background: meta.requestShape === 'background',
          description: meta.description,
          done,
          recent: steps.slice(-4),
          started,
          tools: steps.length,
          toolUseId: meta.toolUseId,
          type: meta.agentType,
          updated: info.mtime.toISOString(),
        })
      } catch {
        // An unreadable subagent file is left out.
      }
    }
    return out
  }
  let agents = []
  if (chosen && request.agent === 'claude') {
    agents = await subagents(
      await realpath(
        path.join(root, Buffer.from(chosen.id, 'base64url').toString()),
      ),
    )
  }
  let branch = ''
  if (chosen && request.cwd && request.agent !== 'claude') {
    try {
      const head = execFileSync(
        'git',
        ['-C', request.cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 1000,
        },
      ).trim()
      if (head && head !== 'HEAD') branch = head
    } catch {
      // Not a git repository, or git is unavailable.
    }
  }
  return {
    branch,
    // A session known exactly (Claude PID metadata, Pi --session-id) but not written yet has no conversation to offer instead.
    candidates: exactId && exact.length === 0 ? [] : candidates.slice(0, 100),
    selected: chosen?.id,
    subagents: agents,
    text,
    truncated,
  }
}

function isPiCommand(args) {
  const argv0 = String(args || '')
    .trim()
    .split(/\s+/)[0]
  if (!argv0) return false
  const bin = path.basename(argv0)
  if (bin === 'pi') return true
  return (
    (bin === 'node' || bin === 'bun' || bin === 'deno') &&
    /pi-coding-agent/i.test(args)
  )
}

async function otherPiStartsInCwd({
  canonicalCwd,
  excludePids,
  launchCwds,
  requestCwd,
}) {
  const starts = []
  let rows
  try {
    rows = execFileSync('ps', ['-eo', 'pid=,etime=,args='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    })
      .split('\n')
      .map((line) => /^\s*(\d+)\s+(\S+)\s+(.+)$/.exec(line))
      .filter((m) => m && isPiCommand(m[3]) && !excludePids.has(Number(m[1])))
  } catch {
    return starts
  }
  for (const m of rows) {
    const pid = Number(m[1])
    const start = parseEtime(m[2])
    if (!start) continue
    // On Linux, /proc/<pid>/cwd tells us whether this sibling Pi shares our project folder.
    let pidCwd = await readlink(`/proc/${pid}/cwd`).catch(() => '')
    if (!pidCwd) {
      try {
        pidCwd =
          execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1500,
          })
            .split('\n')
            .find((l) => l.startsWith('n'))
            ?.slice(1) || ''
      } catch {
        // Can't read sibling's cwd: conservatively assume it could be in this folder.
      }
    }
    if (pidCwd) {
      const canonicalPidCwd = await realpath(pidCwd).catch(() => pidCwd)
      if (
        pidCwd !== requestCwd &&
        canonicalPidCwd !== canonicalCwd &&
        !launchCwds.has(pidCwd) &&
        !launchCwds.has(canonicalPidCwd)
      ) {
        continue
      }
    }
    starts.push(start)
  }
  return starts
}

function parseEtime(text) {
  const m = String(text || '')
    .trim()
    .match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/)
  if (!m) return 0
  return (
    Date.now() -
    (((Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3])) * 60 +
      Number(m[4])) *
      1000
  )
}

/**
 * Matches a Pi pane to its own transcript without stealing a sibling Pi's conversation in the same
 * folder. Pi writes its `session.timestamp` at startup (within seconds of process start), even if
 * the file isn't flushed until the first message.
 */
export function choosePiCandidate({ candidates, otherSameCwdStarts, started }) {
  const inStartupWindow = (created, start) =>
    created >= start - 5000 && created <= start + 30000
  const eligible = candidates.filter((c) => {
    if (c.created < started - 5000) return false
    const dist = Math.abs(c.created - started)
    // Never pick a session whose timestamp falls in another running Pi's startup window as close
    // (within ps etime's ±2s granularity) as it is to ours — refuse to guess on simultaneous launches.
    return !otherSameCwdStarts.some(
      (other) =>
        inStartupWindow(c.created, other) &&
        Math.abs(c.created - other) <= dist + 2000,
    )
  })
  if (otherSameCwdStarts.length > 0) {
    // With sibling Pis in the same folder, only auto-match a session from our own startup window.
    return eligible
      .filter((c) => inStartupWindow(c.created, started))
      .sort(
        (a, b) => Math.abs(a.created - started) - Math.abs(b.created - started),
      )[0]
  }
  // Solo Pi in this folder: newest session created since startup (handles `/new` seamlessly).
  return eligible.sort((a, b) => b.created - a.created)[0]
}
