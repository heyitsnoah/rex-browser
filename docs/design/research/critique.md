# Critique of the Session Rail incumbent (2026-11-20)

Tile 0: `tiles/incumbent-conversation.png`, `incumbent-conversation-dark.png`, `incumbent-terminal.png`. Noah's verdict: "this looks terrible", and the Terminal toggle placement is weird.

What changed since Session Rail was chosen on 2026-11-17: panes running Claude Code, Codex or Pi now open a conversation read from the agent's JSONL transcript. Most panes Noah opens are agent panes, so the main object on screen is now a **conversation**, not a terminal. The layout was designed for terminals.

## Findings, by weight

1. **Terminal frame on a chat (hierarchy/layout).** A single-pane tab (nearly all tabs) gets a page header, then a green-outlined bordered card, then a pane header, then the toggle: three stacked frames before any content. The tab name appears four times: rail row, H1, pane header, and "Send to". The pane frame exists for tiling and adds nothing when there's one pane.
2. **The transcript reads as a debug log (component rendering).** Every tool call is a full-width bordered row of equal weight; turns aren't grouped; every message gets an uppercase `AGENT` label; no Markdown, so code, lists and links show as raw text. A 76ch column sits left-aligned in a pane that's 1100px wide, leaving the right half dead.
3. **Three overlapping input modes (interaction model).** Read only / Direct typing in the page header, Conversation / Terminal per pane, and an always-on composer. Direct typing means nothing in conversation view. The view toggle floats at the pane header's far right, away from the content it switches (Noah's "weird").
4. **No agent status (information).** The most useful fact about an agent tab is whether it's working, waiting for you, or done. The rail shows none of it; the header's `LIVE` dot only means polling works. Block ids (`b2ab45`) appear in three places and mean nothing to a person.
5. **Composer is a form field, not a chat composer.** Mono placeholder, a separate Send button with a kbd hint, and an id. It doesn't read as "reply to this agent".

## Automated checks

`npx impeccable detect public/` (regex only, so an undercount): side-stripe accents on `.tab[aria-current]` and `.message.user` (valid), cramped `.seg` inset (valid), Geist flagged as overused (overridden: Alephic Product mandates Geist). Advisory color notes are dark-mode tokens missing from `DESIGN.md` frontmatter.

## Keep

Alephic Product palette and Geist faces; Forest only for selection and the committing action; the rail as the way to find a tab; read-only by default; terminal output never animates.

## Candidate weak dimensions

- **Layout/hierarchy:** conversation-first surface; pane chrome only when a tab is actually tiled.
- **Transcript rendering:** turn grouping, summarized tool work, Markdown, user and agent shapes.
- **Status and interaction model:** agent state in the rail; one place for view and input mode.
