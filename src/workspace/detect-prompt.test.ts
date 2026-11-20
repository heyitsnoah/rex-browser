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

test('a numbered list above a permission menu is not part of the menu', () => {
  const screen = `● Here's the plan:
  1. Build the app
  2. Ship it

● Bash(pnpm build)

 Bash command
   pnpm build
   Build the app

 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and don't ask again for pnpm build commands
   3. No, and tell Claude what to do differently (esc)

 Esc to cancel`
  const prompt = detectPrompt(screen)
  expect(prompt?.question).toBe('Do you want to proceed?')
  expect(prompt?.options.map((option) => option.label)).toEqual([
    'Yes',
    "Yes, and don't ask again for pnpm build commands",
    'No, and tell Claude what to do differently (esc)',
  ])
})

test('a question drawn inside a box loses its side borders', () => {
  const screen = `│ Which direction? See                │
│ https://example.com/canvas/1         │

❯ 1. First
  2. Second
Enter to select · Esc to cancel`
  expect(detectPrompt(screen)?.question).toBe(
    'Which direction? See https://example.com/canvas/1',
  )
})
