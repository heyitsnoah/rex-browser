# Rex Browser design decisions

## 2026-11-17: three directions published, choice pending

Branch B (brand exists). Palette, faces, radii, shadows and motion come from Alephic Product registry revision 2 (`research/product-system.md`), so the directions diverge on structure, density, material and how boldly Forest is used.

Evidence that shaped them: live Rex metadata on 2026-11-17 showed 4 computers, about 12 sessions and about 35 tabs, nearly all single pane. Navigation is the larger problem; tiling is the smaller one.

| Direction | Slug | Color | Type | Density | Material | Primary mode |
| --- | --- | --- | --- | --- | --- | --- |
| A · Ink Stage | `ink-stage` | Restrained: Ink ground, bright green only on the target pane and Send | Mono-forward chrome | Compact, edge to edge | Flat, one floating tray | Dark |
| B · Session Rail | `session-rail` | Committed: white ground, Forest for selection and Send | Geist workhorse, Mono for counts and ids | Normal | Bordered, no shadow | Light |
| C · Tab Deck | `tab-deck` | Full Product palette: Ink trays, Forest selection, Mint for typing and destination | Geist, Mono for kinds and counts | Normal to spacious | Layered objects with shadow and lift | Light |

Review surface: canvas https://intelligence.alephic.ai/artifacts/103870dc-52b1-4f15-9977-e3e95acdcfdb with one artifact per mockup:

- A: https://intelligence.alephic.ai/artifacts/de5605db-1a45-400f-9e6f-204ca8b4e073
- B: https://intelligence.alephic.ai/artifacts/e075bc9c-a9d8-4cc8-acdc-8a41a1bc56aa
- C: https://intelligence.alephic.ai/artifacts/1d17d3ce-8ed2-4547-984a-07c4d35d579a

Notes:

- Mockups are built by `tiles/build.mjs`. They are full-size app mockups, not the skill's generic style tile: with brand tokens fixed, a hero and stat-card tile would have shown one direction three times.
- Host, session and tab names are real metadata (client-named tabs left out). Terminal output is synthetic and says so on its first line.
- Fonts: Geist and Geist Mono (SIL OFL), latin subset embedded in `tiles/fonts.css` because the Intelligence viewer does not load remote fonts.
- `selected` row fill (#e4f1e5 light, #1c2b1e dark) and the `lifted` shadow are derived, not registry values.
- Motion stance for all three: crisp, per Product. 150ms ease-out on color and lift only; terminal output never animates.
- Open: phone scope. All three are desktop-first.

## 2026-11-17: direction chosen, Session Rail (B)

**Why:** with about 35 tabs across 4 computers and almost no tiling, finding the tab is the job; B is the only direction that keeps all of it visible. Noah picked it from the canvas.
**Rejected:** Ink Stage, navigation hidden behind a switcher; Tab Deck, most chrome and one session at a time.
**Axes:** color committed · type Geist workhorse with Mono for counts · density normal · material bordered and flat.
**Built:** `public/index.html` and `public/client.js` now follow `DESIGN.md`. No server change. Behavior kept: discovery, lazy tab loading per session, pane targeting, read only by default, draft kept on failure. Added: last tab reopened on reload, filter, in-place new tab name, system theme with toggle.
**Not verified:** sending input, direct typing, new tab creation and the under-760px layout were not exercised after the restyle.

## 2026-11-20: transcript view is the weak dimension (Branch C)

Agent panes (Claude Code, Codex, Pi) now open a conversation read from JSONL, and that view is what Noah sees most. Verdict: "for cc/codex/pi sessions how we show transcript is ugly af", plus the floating Terminal toggle.
**Scope confirmed:** transcript rendering and the Conversation/Terminal switch only. Rail, palette, Geist faces, composer and page header stay as Session Rail (tile 0) so the comparison is honest.
**Evidence:** `research/critique.md`; tile 0 in `tiles/incumbent-*.png`.
**Added same day:** show running subagents. Claude Code records them: the `Agent` tool call in the main transcript plus `<session>/subagents/agent-<id>.jsonl` with a `.meta.json` (`description`, `agentType`, `toolUseId`, `requestShape: background`). Codex exposes `spawn_agent` / `wait_agent` tools (record shape of a real call not yet verified). Pi: none found. Directions must show a subagent inline at its launch point, a session-level running count, and a rail signal.

## 2026-11-20: three transcript directions published, choice pending

Built by `tiles/transcript.mjs` (shell identical to Session Rail; content is real turns from this session). Reviewed on an Intelligence canvas per alephic-design #692.

| Direction | Slug | Grouping unit | Terminal | Subagents |
| --- | --- | --- | --- | --- |
| A · Thread | `transcript-thread` | One quiet summary line per run of tools, centered 736px column, Mint "yours" bubbles | Bottom drawer, header button, Ctrl+J | Live inline row at launch point; count in header |
| B · Ledger | `transcript-ledger` | Per-turn mono trace (counts, failures, duration) that opens to a table; time gutter | Right split, both visible | Sticky agents strip |
| C · Turn Cards | `transcript-cards` | Card per turn: prompt, step timeline, answer; old turns fold | Tab beside the title | Child card nested under its step |

Canvas: https://intelligence.alephic.ai/artifacts/303367bd-0dea-4f7d-a01c-c64b2e23c582

- A: https://intelligence.alephic.ai/artifacts/641b1d50-eef8-4bc6-8f02-251bf361b0c3
- B: https://intelligence.alephic.ai/artifacts/a33d0497-47a7-4b34-b4c0-422bb5ae6285
- C: https://intelligence.alephic.ai/artifacts/584c63b8-45e8-427b-8055-26700d6cc6d1

All three: rail tab row shows a pulsing `working` mark; motion limited to the working pulse and a text shimmer on the live step (both off under reduced motion).

## 2026-11-20: direction chosen, A · Thread

**Why:** the complaint was that agent transcripts read like a debug log; Thread is the quietest fix and matches T3 Code, Codex and Claude desktop. Noah picked it from the canvas.
**Merged in:** C's nested subagent steps inside Thread's live subagent row.
**Rejected:** Ledger, busiest and halves reading width; Turn Cards, most chrome per turn and keeps the swap model.
**Built:** `public/conversation.js` (new), `public/client.js`, `public/index.html`, `src/transcripts/*` (parser: commands, mid-turn messages, working state, task notifications, sibling-branch results; reader: subagents, subagent files excluded from candidates), `server.ts` (routes, `REX_BROWSER_PORT`). Markdown via vendored `@pierre/words` 0.3.0 plus an allow-list sanitizer. `DESIGN.md` § Conversation added.
**Not built from the mockup:** the rail's per-tab "working" mark (needs transcript polling for every tab, not just the open one).

## 2026-11-20: phone layout and composer

Noah: "mobile isnt good", the close button placement, slow send, no uploads, "the bottom mobile bar is a mess". Rail becomes a full-screen panel opened from a menu button with its X in the same top-left spot; header goes icon-only; composer becomes one rounded box (attachment chips, auto-growing field, paperclip, destination, round send arrow on phones); send is optimistic. Uploads use the transcript access path until Rex's data protocol is documented.

## 2026-11-20: every computer through Rex

Noah chose Rex over turning on SSH everywhere. Transcripts, the answer card and uploads now run a single program through a hidden Rex terminal on the target computer when `.rex-transcripts.json` has no entry; `local` and SSH remain as faster paths. Also added the same day after QA: a "Needs your answer" card for choice prompts in the agent's terminal, queued-message persistence, cached last view, a token that survives restarts, Codex/Pi matching by process start time, Codex injected-context filtering, and agent error lines.
