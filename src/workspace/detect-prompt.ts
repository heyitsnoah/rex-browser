/**
 * The choice menu an agent is stopped at, read from the bottom of its terminal:
 * either a numbered menu (Claude Code / Codex: "❯ 1. Yes … Esc to cancel") or
 * Pi's arrow-navigable menu ("→ Yes / No … ↑↓ navigate  enter select").
 * Question and option descriptions wrap over several lines, so contiguous lines are joined.
 */
export type AgentPrompt = NonNullable<ReturnType<typeof detectPrompt>>

export function detectPrompt(screen: string) {
  const lines = screen
    .split('\n')
    // Claude Code draws some questions inside a box; its side borders aren't part of the text.
    .map((line) =>
      line
        .replace(/^\s*[│┃║]\s?/, '')
        .replace(/\s*[│┃║]\s*$/, '')
        .trimEnd(),
    )
    .slice(-60)
  return detectArrowPrompt(lines) ?? detectNumberedPrompt(lines)
}

function detectNumberedPrompt(lines: string[]) {
  const end = lines.findLastIndex((line) =>
    /Esc to cancel|Enter to confirm|to select|Tab to amend/.test(line),
  )
  if (end < 0) return undefined
  const options: {
    current: boolean
    detail: string
    key: string
    label: string
    send: string
  }[] = []
  let first = -1
  for (let index = Math.max(0, end - 30); index < end; index++) {
    const line = lines[index] ?? ''
    const match = /^\s*([❯›>])?\s*(\d{1,2})[.)]\s+(.+)$/.exec(line)
    const last = options.at(-1)
    if (match) {
      // A new list starting at 1 replaces anything collected above it: only the menu counts.
      if (match[2] === '1') {
        options.length = 0
        first = index
      }
      if (first < 0) first = index
      options.push({
        current: Boolean(match[1]),
        detail: '',
        key: match[2],
        label: match[3].trim(),
        send: match[2],
      })
    } else if (last && line.trim() && !/^[\s─━-]+$/.test(line)) {
      last.detail = `${last.detail} ${line.trim()}`.trim()
    }
  }
  if (options.length < 2 || !options.some((option) => option.current)) {
    return undefined
  }
  const question: string[] = []
  for (let index = first - 1; index >= Math.max(0, first - 12); index--) {
    const text = (lines[index] ?? '').trim()
    // Blank lines, rules and the top or bottom edge of a box end the question.
    if (!text || /^[─━╭╮╰╯-]+$/.test(text) || /^[←☐☒✔□■]/.test(text)) {
      if (question.length) break
      continue
    }
    question.unshift(text)
  }
  return { options, question: question.join(' ') }
}

/** Pi's select/confirm/trust/thinking prompts: arrow-highlighted list (`→`) with Enter to select. */
function detectArrowPrompt(lines: string[]) {
  const end = lines.findLastIndex((line) =>
    /(?:↑↓\s*navigate.*enter\s+select|Enter to select.*Escape\/Ctrl\+C to cancel)/i.test(
      line,
    ),
  )
  if (end < 0) return undefined
  const top = Math.max(0, end - 25)
  let arrow = -1
  for (let index = end - 1; index >= top; index--) {
    if (/^\s*→\s+\S/.test(lines[index] ?? '')) {
      arrow = index
      break
    }
  }
  if (arrow < 0) return undefined
  const isOptionLine = (line: string) =>
    /^\s*→\s+\S/.test(line) ||
    (/^\s{2,}\S/.test(line) &&
      !/^[\s─━-]+$/.test(line) &&
      !/^\s*\(\d+\/\d+\)\s*$/.test(line))
  let first = arrow
  while (first > top && isOptionLine(lines[first - 1] ?? '')) first--
  let last = arrow
  while (last + 1 < end && isOptionLine(lines[last + 1] ?? '')) last++
  const raw = lines.slice(first, last + 1)
  if (raw.length < 2) return undefined
  const currentIndex = arrow - first
  const options = raw.map((line, index) => {
    const current = index === currentIndex
    const cleaned = line
      .replace(/^\s*→\s*/, '')
      .replace(/^\s*✓\s*/, '')
      .trim()
    const split = /^(\S+)\s{2,}(.+)$/.exec(cleaned)
    const delta = index - currentIndex
    const move =
      delta > 0
        ? '\x1b[B'.repeat(delta)
        : delta < 0
          ? '\x1b[A'.repeat(-delta)
          : ''
    return {
      current,
      detail: split ? split[2].trim() : '',
      key: String(index + 1),
      label: split ? split[1].trim() : cleaned,
      send: `${move}\r`,
    }
  })
  const question: string[] = []
  for (let index = first - 1; index >= Math.max(0, first - 12); index--) {
    const text = (lines[index] ?? '').trim()
    if (/^[─━╭╮╰╯-]+$/.test(text)) break
    if (!text || text === '>') continue
    question.unshift(text)
  }
  return { options, question: question.join(' ') }
}
