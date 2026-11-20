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
  const screen = `╭──────────────────────────────────────╮
│ Which direction? See                 │
│ https://example.com/canvas/1         │
╰──────────────────────────────────────╯

❯ 1. First
  2. Second
Enter to select · Esc to cancel`
  expect(detectPrompt(screen)?.question).toBe(
    'Which direction? See https://example.com/canvas/1',
  )
  expect(detectPrompt(screen)?.options.map((o) => o.send)).toEqual(['1', '2'])
})

// Captured from real Pi v1.6.0 screens on 2026-11-20.
test('detects Pi project trust prompt and computes arrow+Enter keystrokes', () => {
  const screen = `────────────────────────────────────────────────────────────────────────────────

 Trust project folder?
 /tmp/pi-parity-trust

 This allows pi to load .pi settings and resources, install missing project
 packages, and execute project extensions.

 → Trust
   Trust parent folder (/tmp)
   Trust (this session only)
   Do not trust
   Do not trust (this session only)

 ↑↓ navigate  enter select  escape/ctrl+c cancel

────────────────────────────────────────────────────────────────────────────────`
  const prompt = detectPrompt(screen)
  expect(prompt?.question).toContain('Trust project folder?')
  expect(prompt?.question).toContain('/tmp/pi-parity-trust')
  expect(
    prompt?.options.map((o) => [o.key, o.label, o.current, o.send]),
  ).toEqual([
    ['1', 'Trust', true, '\r'],
    ['2', 'Trust parent folder (/tmp)', false, '\x1b[B\r'],
    ['3', 'Trust (this session only)', false, '\x1b[B\x1b[B\r'],
    ['4', 'Do not trust', false, '\x1b[B\x1b[B\x1b[B\r'],
    [
      '5',
      'Do not trust (this session only)',
      false,
      '\x1b[B\x1b[B\x1b[B\x1b[B\r',
    ],
  ])
})

test('detects Pi ctx.ui.confirm and ctx.ui.select dialogs', () => {
  const confirm = `────────────────────────────────────────────────────────────────────────────────

 Delete temporary files?
 This will remove 3 scratch files.

 → Yes
   No

 ↑↓ navigate  enter select  escape/ctrl+c cancel

────────────────────────────────────────────────────────────────────────────────`
  const confirmPrompt = detectPrompt(confirm)
  expect(confirmPrompt?.question).toBe(
    'Delete temporary files? This will remove 3 scratch files.',
  )
  expect(confirmPrompt?.options.map((o) => [o.label, o.send])).toEqual([
    ['Yes', '\r'],
    ['No', '\x1b[B\r'],
  ])

  const select = `────────────────────────────────────────────────────────────────────────────────

 Pick a deployment target:

 → Staging
   Production
   Cancel

 ↑↓ navigate  enter select  escape/ctrl+c cancel

────────────────────────────────────────────────────────────────────────────────`
  const selectPrompt = detectPrompt(select)
  expect(selectPrompt?.question).toBe('Pick a deployment target:')
  expect(selectPrompt?.options.map((o) => [o.label, o.send])).toEqual([
    ['Staging', '\r'],
    ['Production', '\x1b[B\r'],
    ['Cancel', '\x1b[B\x1b[B\r'],
  ])
})

test('detects Pi /thinking menu with arrow in the middle (up and down arrows)', () => {
  const thinking = `────────────────────────────────────────────────────────────────────────────────

Thinking Level

Shift+Tab cycles thinking levels in-session

>

    minimal   Very brief reasoning (~1k tokens)
    low       Light reasoning (~2k tokens)
→ ✓ medium    Moderate reasoning (~8k tokens) · default
    high      Deep reasoning (~16k tokens)
    xhigh     Extra-high reasoning (~32k tokens)
    max       Maximum reasoning

  Enter to select · Ctrl+S to set as default · Escape/Ctrl+C to cancel
────────────────────────────────────────────────────────────────────────────────`
  const prompt = detectPrompt(thinking)
  expect(prompt?.question).toBe(
    'Thinking Level Shift+Tab cycles thinking levels in-session',
  )
  expect(
    prompt?.options.map((o) => [o.label, o.detail, o.current, o.send]),
  ).toEqual([
    ['minimal', 'Very brief reasoning (~1k tokens)', false, '\x1b[A\x1b[A\r'],
    ['low', 'Light reasoning (~2k tokens)', false, '\x1b[A\r'],
    ['medium', 'Moderate reasoning (~8k tokens) · default', true, '\r'],
    ['high', 'Deep reasoning (~16k tokens)', false, '\x1b[B\r'],
    ['xhigh', 'Extra-high reasoning (~32k tokens)', false, '\x1b[B\x1b[B\r'],
    ['max', 'Maximum reasoning', false, '\x1b[B\x1b[B\x1b[B\r'],
  ])
})

test('does not false-positive on Pi slash autocomplete or settings', () => {
  const slashMenu = `────────────────────────────────────────────────────────────────────────────────
/
────────────────────────────────────────────────────────────────────────────────
→ settings                        Open settings menu
  model                           <provider/model> — Select model
  tree                            Navigate session tree
  (1/116)
/tmp/pi-parity-test`
  expect(detectPrompt(slashMenu)).toBeUndefined()

  const settings = `────────────────────────────────────────────────────────────────────────────────
>

→ Auto-compact                      true
  Show images                       true
  (1/35)

  Type to search · Enter/Space to change · Esc to cancel
────────────────────────────────────────────────────────────────────────────────`
  expect(detectPrompt(settings)).toBeUndefined()
})
