/**
 * The numbered choice menu an agent is stopped at, read from the bottom of its
 * terminal ("❯ 1. Yes … Esc to cancel"), or undefined. Question and option
 * descriptions wrap over several lines, so contiguous lines are joined.
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
  const end = lines.findLastIndex((line) =>
    /Esc to cancel|Enter to confirm|to select|Tab to amend/.test(line),
  )
  if (end < 0) return undefined
  const options: {
    current: boolean
    detail: string
    key: string
    label: string
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
      })
    } else if (last && line.trim() && !/^[\s─━-]+$/.test(line)) {
      last.detail = `${last.detail} ${line.trim()}`.trim()
    }
  }
  if (options.length < 2) return undefined
  const question: string[] = []
  for (let index = first - 1; index >= Math.max(0, first - 12); index--) {
    const text = (lines[index] ?? '').trim()
    if (!text || /^[─━-]+$/.test(text) || /^[←☐☒✔□■]/.test(text)) {
      if (question.length) break
      continue
    }
    question.unshift(text)
  }
  return { options, question: question.join(' ') }
}
