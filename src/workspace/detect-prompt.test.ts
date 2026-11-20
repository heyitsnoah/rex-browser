import { expect, test } from 'vitest'

import { detectPrompt } from '@/workspace/detect-prompt'

// Captured from a Claude Code AskUserQuestion screen on 2026-11-20 (wrapped at the pane width).
const askUserQuestion = `● Two decisions only you can make:
────────────────────────────────────────
 ←  ☐ Checkpoint  ☐ Cloud parts  ✔ Submit  →

Before the Next.js migration starts, should I commit the current
working version of Rex Browser on master, then do the
migration on a new branch?

❯ 1. Commit, then branch (Recommended)
     A safe restore point; the migration happens on its own branch
     and goes up as a PR.
  2. Don't commit; branch as is
     Carry the uncommitted work onto the migration branch.
  3. Type something.
────────────────────────────────────────
  4. Chat about this

Enter to select · Tab/Arrow keys to navigate · Esc to cancel`

test('joins a wrapped question and option descriptions', () => {
  const prompt = detectPrompt(askUserQuestion)
  expect(prompt?.question).toBe(
    'Before the Next.js migration starts, should I commit the current working version of Rex Browser on master, then do the migration on a new branch?',
  )
  expect(
    prompt?.options.map((option) => [option.key, option.label, option.detail]),
  ).toEqual([
    [
      '1',
      'Commit, then branch (Recommended)',
      'A safe restore point; the migration happens on its own branch and goes up as a PR.',
    ],
    [
      '2',
      "Don't commit; branch as is",
      'Carry the uncommitted work onto the migration branch.',
    ],
    ['3', 'Type something.', ''],
    ['4', 'Chat about this', ''],
  ])
})

test('ignores a numbered list that is not a menu', () => {
  expect(detectPrompt('Steps:\n  1. Build\n  2. Ship\n❯ ')).toBeUndefined()
})
