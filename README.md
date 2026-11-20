# Rex Browser

A local web app for your Rex sessions across every Rex computer: find a tab,
read coding-agent conversations (Claude Code, Codex, Pi) as a chat, see
subagents and prompts the agent is waiting on, and reply, from a desktop or a
phone. Built on the Alephic create-app standards (Next.js App Router,
TypeScript, shadcn/Tailwind, TanStack Query, zod), with the template's cloud
pieces (Better Auth, Neon, email, Workflow, Vercel) left out: it runs on your
machine.

Design: `DESIGN.md` (Alephic Product; conversation direction A · Thread).
Decisions: `docs/design/DECISIONS.md`.

## Run

Needs Node 24, pnpm, the `rex` CLI, and Tailscale connected (Rex computers are
the peers tagged `tag:rex`).

```sh
pnpm install
pnpm build
pnpm start            # http://127.0.0.1:4317
pnpm dev              # development, same address
```

To keep it running after the terminal closes:

```sh
nohup setsid pnpm start > tmp/rex-browser.log 2>&1 < /dev/null &
```

### On your tailnet (phone)

The app binds to 127.0.0.1 only. Put Tailscale Serve in front and name the host
and the one login allowed:

```sh
REX_BROWSER_HOST=<machine>.<tailnet>.ts.net REX_BROWSER_LOGIN=<your Tailscale login> pnpm start
tailscale serve --bg 4317
```

Requests for that host name are accepted only when Tailscale Serve reports that
login (`Tailscale-User-Login`); everything else gets 403, and only loopback
works when either variable is unset. Never use Funnel: the page can type into
every pane.

## Access

Every entry point is wrapped (`requirePageAccess`, `requireRouteAccess`,
`requireActionAccess` in `src/rex/rex-access.ts`, enforced by
`@alephic-ai/require-auth-wrapper`) and checks the Host header, which also
blocks DNS rebinding. Mutations are server actions, which Next.js protects
against cross-site calls. Rex is invoked with argument arrays, never a shell.

## How it reaches each computer

Reading transcripts, listing skills, and uploading run a small Node program on
the computer that owns the files and return one framed, gzipped result
(`REXB64:…:REXEND`). By default the program runs in a hidden Rex terminal on
that computer (`session.new_block` in the pane's session, never placed in a
window), read back with `format` (`unwrap`, paged with `blob_read`) and then
closed. Nothing is installed; Node must be on that computer's interactive PATH.
Optionally `.rex-transcripts.json` (gitignored, keyed by Rex DNS name) picks a
faster path: `{ "local": true }` for this machine or `{ "ssh": "alias" }`.

The transcript reader and parser (`src/transcripts/*.mjs`) and the skill lister
(`src/skills/skill-lister.mjs`) are plain JavaScript because they are sent as
source to Node on other computers.

## Agent panes

- The pane's process decides: Claude Code, Codex and Pi open as a conversation;
  anything else, or a fresh agent with no transcript yet, shows its terminal.
- Transcripts are matched exactly for Claude Code (its PID metadata and open
  files); for Codex and Pi, the newest transcript in the project created after
  the agent process started. Otherwise the conversation offers a choice of
  transcripts.
- Your messages are bubbles (slash commands as a chip, images as thumbnails,
  uploaded files as chips); the agent's Markdown is rendered by `@pierre/words`
  with raw HTML skipped and then an allow-list sanitizer
  (`src/workspace/sanitize-markdown.ts`); runs of tool calls fold into one line
  that opens to each call's input and output; Claude subagents show live (latest
  steps, elapsed, tool count) from `<session>/subagents/` until their completion
  notice; a "Working for …" line shows until the turn ends; errors from Pi and
  Codex show in red.
- A choice the agent is stopped at in its terminal (permission prompts,
  questions) appears as a "Needs your answer" card; a button presses that
  option's number.
- The terminal opens in a drawer under the conversation (header button or
  Ctrl+J). While a terminal is on screen, **Compose / Type in terminal** picks
  where your typing goes; Type in terminal hides the message box and sends every
  key to the pane.
- A session too long to read whole (over 16 MiB) is read from its most recent
  part, and the view says so.

## Composer

Sends to the active pane: attached file paths are pasted first (Claude Code
turns pasted image paths into attachments), then the text as one paste, then
Enter as its own keystroke 120 ms later (sent together, TUIs treat the Enter as
part of the paste). The message shows as pending ("Sending…", "Sent", "Queued"
while the agent is busy) until the transcript has it. `/` lists the agent's
built-in commands and installed skills from that computer (`~/.claude/skills`,
`~/.codex/skills`, `~/.pi/agent/skills`, `~/.agents/skills`, and the project's
`.claude/skills` / `.agents/skills`). Uploads go to
`~/.local/state/rex-browser/uploads/<uuid>/` on the pane's computer (folder 700,
file 600, 25 MB max) and are not cleaned up automatically.

### `!` commands

In an agent pane, a message starting with `!` turns the box into a terminal
line. The command runs in a new tab on the same computer, in the agent's folder
(through `script`, so prompts and logins work), shows live in the thread, and
takes your typing when you click into it. When it ends, the output (escape codes
stripped, last 400 lines, plus the exit code) is saved to
`~/.local/state/rex-browser/runs/<id>.txt` (not cleaned up automatically) and
the agent runs `!cat` on it, so the output lands in its context. The hand-back
waits while the agent shows a menu, so its Enter can't pick an option. The tab
closes when the command succeeds; a failed command keeps its tab open so you can
see why.

## Phone

Under 48rem the list is a full-screen panel: open it with the menu button or a
swipe right from the left edge, close it with the X in the same spot, a swipe
left, or by picking a tab. Text fields are 16px so iOS doesn't zoom, and
safe-area insets keep the composer above the home indicator. Queries are cached
in localStorage, so a reopened page shows the last view at once.

## Checks

```sh
pnpm lint   # ESLint, tsc, Prettier
pnpm test   # Vitest
```

Tests cover the transcript parser, prompt detection on a captured screen,
conversation grouping, and the Markdown sanitizer against hostile input.

## Limits

- Screens are polled (every 0.8 s while a terminal is shown, 2 s while watching
  for a prompt), not streamed; transcripts every 3 s.
- Rex's native `upload_begin` would be faster than typing base64 into a hidden
  terminal (about 2 s per 300 KB) but needs its undocumented data protocol.
- Codex subagents (`spawn_agent`) are not shown yet; Pi has none.
- No per-tab "working" mark in the list yet (it would need a transcript read for
  every tab).
