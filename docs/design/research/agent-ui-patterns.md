# Agent UI patterns (research, 2026-11-20)

Primary source: T3 Code source, `pingdotgg/t3code` `apps/web/src/` (read from a
scratch clone). Secondary: public docs for Codex app, Claude Code desktop, Zed,
Conductor.

## Tool calls

- T3 folds consecutive work entries into one group, ending at an error,
  approval, todo list, notice or run boundary
  (`components/chat/MessagesTimeline.logic.ts`).
- Collapsed group: icon + sentence joined from per-action counts, "Read 3 files,
  Ran 6 commands, and Changed 2 files"
  (`packages/client-runtime/src/work-log/presentation.ts`, `joinClauses`).
  Single calls render as one line, "Ran pnpm".
- Tense carries state: Running → Ran / Failed / Declined / Stopped.
- Rows: 24px, text-sm, muted label, 16px icon in a 24px slot, no borders or
  boxes; chevron rotates on expand (`WorkLog.tsx`, `TimelineWorkEntryRow.tsx`).
- Expanded group: compact rows in a box capped at min(18rem, 50dvh) with scroll
  fades; output `<pre>` max-h-64, mono 2xs, muted; follows live tail only when
  scrolled to bottom.
- Failure: red icon or trailing X; row not restyled. Changed files card at turn
  end.
- Claude Code desktop: Ctrl+O cycles Normal (tools collapsed into summaries) /
  Thinking / Verbose.

## Messages

- User: right-aligned bubble, max-w 80%, rounded-2xl, one step above ground;
  long ones fold.
- Assistant: no bubble, no visible label, full-width Markdown; actions and
  timestamp on hover only.
- One centered column shared with the composer: 46rem (~736px).

## Conversation vs terminal

- T3, Codex, Claude desktop all keep conversation primary; raw terminal is a
  resizable bottom drawer (T3 default 280px, min 180px, max 75vh) toggled by a
  header icon and mod+J. None use a peer tab.

## Sidebar

- 256px; threads under project headers; row = title + relative time that becomes
  status label. Status dots: working (pulses), pending approval, awaiting input,
  failed, plan ready, completed-unseen. Machine/branch in hover card.

## Composer

- Same column, rounded card, context strip below (environment / worktree /
  branch); hints in placeholder; Send becomes Stop while running.

## Live state

- "Working for 1m 23s" ticking line; live row with present-tense tool label and
  a shimmer; streaming Markdown.

## Subagents (from local transcripts, not T3)

- Claude Code: `Agent` tool_use in the main transcript (`description`,
  `subagent_type`, `run_in_background`); per-agent transcript
  `<session>/subagents/agent-<id>.jsonl` plus `.meta.json` (`agentType`,
  `description`, `toolUseId`, `requestShape`). Background completion arrives as
  a `<task-notification>` user record with status and usage (tokens, tool uses,
  duration).
- Codex: `spawn_agent` / `wait_agent` tools exist; real call shape unverified.
  Pi: none found.
