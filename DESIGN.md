---
name: Rex Browser
description:
  Session Rail. Every computer, session and tab visible in a left rail; the
  selected tab's panes on a flat white work surface; a docked composer that
  names its destination.
colors:
  background: '#ffffff'
  card: '#ffffff'
  foreground: '#231f20'
  primary: '#23602b'
  primary-foreground: '#ffffff'
  ring: '#23602b'
  muted: '#e3e6e3'
  muted-foreground: '#575c58'
  border: '#d3d8d4'
  input: '#858b86'
  destructive: '#b42318'
  tray: '#231f20'
  tray-foreground: '#f4f4f2'
  selected: '#e4f1e5'
  note-soft: '#e1f3e3'
  subtle: '#f3f5f3'
typography:
  title:
    {
      fontFamily: 'Geist, system-ui, sans-serif',
      fontSize: '1.125rem',
      fontWeight: 500,
      letterSpacing: '-0.01em',
    }
  body:
    {
      fontFamily: 'Geist, system-ui, sans-serif',
      fontSize: '0.9375rem',
      fontWeight: 400,
      lineHeight: 1.5,
    }
  row:
    {
      fontFamily: 'Geist, system-ui, sans-serif',
      fontSize: '0.8125rem',
      fontWeight: 400,
    }
  label:
    {
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: '0.6875rem',
      fontWeight: 400,
      letterSpacing: '0.04em',
    }
  meta:
    {
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: '0.75rem',
      fontWeight: 400,
    }
  terminal:
    {
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: '0.8125rem',
      fontWeight: 400,
      lineHeight: 1.55,
    }
rounded:
  sm: '4px'
  md: '8px'
spacing:
  unit: '4px'
  rail: '272px'
  row: '30px'
  control: '36px'
  button: '40px'
components:
  button-primary:
    {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.primary-foreground}',
      rounded: '{rounded.md}',
      height: '{spacing.button}',
      padding: '0 14px',
    }
  tab-row:
    {
      textColor: '{colors.foreground}',
      typography: '{typography.row}',
      rounded: '{rounded.sm}',
      height: '{spacing.row}',
    }
  tab-row-selected: { backgroundColor: '{colors.selected}' }
  pane:
    {
      backgroundColor: '{colors.card}',
      textColor: '{colors.foreground}',
      rounded: '{rounded.md}',
    }
  segment-selected:
    { backgroundColor: '{colors.tray}', textColor: '{colors.tray-foreground}' }
  field:
    {
      backgroundColor: '{colors.card}',
      rounded: '{rounded.sm}',
      padding: '9px 12px',
    }
---

## Overview

Rex Browser is a rail and a workbench. The rail answers "where is it": about 35
tabs across 4 computers, nearly all single pane, so finding the tab is the job
and everything stays visible. The work surface shows the chosen tab's panes
exactly as Rex tiles them. The composer always says where text will go.

Not a second session manager, not a dashboard, not a terminal emulator skin.
Quiet, precise, practical. Light is the primary mode (white ground, never gray);
dark ships and follows the system until toggled.

Source system: Alephic Product, registry revision 2
(`docs/design/research/product-system.md`). Chosen over Ink Stage and Tab Deck
on 2026-11-17 (`docs/design/DECISIONS.md`).

## Colors

Committed. White ground, Ink type, Forest for the one committing action (Send)
and for selection (tab row edge, pane outline, live dot). No orange. Secondary
text is `muted-foreground`, never opacity.

| Token                        | Light             | Dark                                |
| ---------------------------- | ----------------- | ----------------------------------- |
| background                   | #ffffff           | #161515                             |
| card (panes, fields)         | #ffffff           | #211f20                             |
| foreground                   | #231f20           | #ededeb                             |
| primary / fg                 | #23602b / #ffffff | #45bf55 / #0f1f12                   |
| ring                         | #23602b           | #8fd999                             |
| muted                        | #e3e6e3           | #2a2829                             |
| muted-foreground             | #575c58           | #a6aba7                             |
| border                       | #d3d8d4           | #363334                             |
| input                        | #858b86           | #6e6b6c                             |
| destructive                  | #b42318           | #ff8f8f                             |
| tray / fg (selected segment) | #231f20 / #f4f4f2 | #0b0a0a / #ededeb, 1px #363334 edge |
| selected (row fill, derived) | #e4f1e5           | #1c2b1e                             |

Terminal output takes the pane's `card` and `foreground`. When rich rendering
lands, terminal-authored ANSI colors are shown as authored and never recolored.

## Typography

Geist for names and prose; Geist Mono for anything counted or typed: computer
labels, counts, pane ids, the path line, key hints, status, and terminal output.
Weights 400 and 500 only. Both are SIL OFL, latin subset inlined in
`public/index.html`.

## Layout

Two columns: a 272px rail and the detail. Detail stacks a 52px header (tab name,
Mono path, status, input mode), the pane area, and the composer. Panes are
positioned from Rex's layout rects with 12px between them. Below 760px the rail
stacks above the detail and the path line hides; full phone interaction is still
undecided.

## Elevation & Depth

Flat. Borders separate; nothing casts a shadow. Selection is a Forest outline,
not lift.

## Shapes

4px on rows, fields and chips; 8px on panes and buttons. Icons are Lucide-style
line icons, 1.5px stroke, 16px in the rail header, 12px in rows.

## Components

- **Rail.** Computer header: Mono uppercase label, a Forest dot when online
  (hollow when offline), a Mono count or state word. Session row: chevron, name
  at 500, tab count once loaded. Tab row: 30px; selected is `selected` fill with
  a 2px Forest left edge; pane count only when above one. "New tab" is the last
  row of an open session and becomes a name field in place.
- **Header.** The tab name is the only title. Path is Mono
  `computer / session / n panes`. Status is one Mono word (`LIVE`, `LOADING`,
  `IDLE`, `OFFLINE`, `ERROR`) and always has the word, never color alone.
- **Input mode.** Segmented `Compose | Type in terminal` (`Type` on phones):
  where your typing goes. The selected segment is Ink, never Forest. Type in
  terminal hides the composer and focuses the terminal; it returns to Compose
  whenever the target changes.
- **Pane.** Bordered card with a 34px header (title, Mono short id). The
  targeted pane has a 2px Forest outline at 2px offset.
- **Composer.** "Send to" plus the pane title and id, a Mono field, one Forest
  Send button with its key hint. Feedback sits on the same line, right aligned;
  errors use `destructive` and keep the draft.

### Conversation (agent panes)

Direction A · Thread, chosen 2026-11-20 over Ledger and Turn Cards
(`docs/design/DECISIONS.md`). Applies to panes running Claude Code, Codex or Pi
with transcript access.

- One centered column, 736px max, 24px gutters; on a single-pane tab the pane
  frame and pane header disappear and the conversation sits on the surface.
  Tiled tabs keep frames.
- Yours: right-aligned bubble, max 80% wide, `note-soft` fill (light #e1f3e3,
  dark #1f3323), radius 16/16/4/16. Slash commands show as a Mono chip above it;
  images as a bordered "Image" chip. No "You" label.
- The agent's: no bubble, no label; Markdown at 14.5px/1.65. Code blocks on
  `subtle` with a border; inline code on `muted`.
- Tool work: each run of consecutive calls is one 26px muted line, "Ran 6
  commands, read 2 files and edited 1 file", with a chevron. Open, it lists one
  24px row per call (icon, Mono tool name, description); a row opens to Input
  and Output on `muted`, 280px max. A single call is just its row. Failures say
  "N failed" in `destructive`; the row isn't restyled.
- Subagents: a bordered card (radius 10) at the point of launch: pulse while
  running, Forest check when done, destructive X when failed; description, Mono
  type and "background", elapsed and tool count on the right; latest four steps
  nested under a hairline, the live one shimmering. Running cards stay open;
  done cards fold to one line.
- Live state: "Working for 2m 05s" with a pulse at the end of the thread until
  the turn ends; the header shows "N agents running" once, never in two places.
- Terminal: header button "Terminal Ctrl+J" (pressed state on `muted`) opens a
  drawer under the conversation, 280px default, 140px to 75% of the pane, drag
  the top edge. Compose / Type in terminal appears only while a terminal is on
  screen. The composer placeholder names the agent ("Reply to Claude Code").

### Motion

Agent panes add two loops, both off under reduced motion: the 1.6s opacity pulse
on working dots, and a 2.4s text shimmer on the live step.

- Stance: crisp. Motion confirms, it never decorates.
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; 150ms on hover background color;
  press is `scale(0.97)`.
- Never animated: terminal output, the rail tree, selection changes, tab
  switches, status.
- Reduced motion: transitions and press scale are removed.

## Do's and Don'ts

- Do keep every computer, session and tab reachable from the rail without a
  menu.
- Do name the destination pane next to the composer at all times.
- Do use Geist Mono for counts, ids, status and key hints.
- Do check light and dark, long tab names, and a session with no tabs.
- Don't use Forest for anything except Send, selection and the live dot.
- Don't add shadows, gradients or a gray page ground.
- Don't animate terminal output or scroll it while the reader has scrolled up.
- Don't show a count twice or float status over the panes.
- Don't change Rex names, layout or focus as a side effect of styling.
