# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Noah, accessing existing Rex sessions from his Linux computer over Tailscale.

## Product Purpose
Find and interact with existing remote terminal sessions without introducing a second session manager. Preserve Rex's host, session, tab and pane identity.

## Operating Context
Local Node bridge, Rex CLI, official libghostty-vt WASM. Mini and Spark are remote Rex servers. Ongoing work sessions must survive browser refreshes and local bridge changes.

## Capabilities and Constraints
List sessions, show terminal titles and tab names, mirror tiled panes, submit text, create a shell tab. Current transport is snapshot polling; rendering is plain text. Streaming, rich rendering, resize ownership, floating panes and nonterminal blocks remain incomplete. Phone interaction scope is pending Noah's answer.

## Brand Commitments
Use Alephic's registered Product design system, explicitly requested by Noah. Exact source: artifact 808eb452-99c7-418c-beb3-3025006922f2 version 4, Product registry revision 2.

## Evidence on Hand
Live Rex metadata and local browser QA; docs/design/research/terminal-experience.md; docs/design/research/product-system.md. Design examples must not reproduce private terminal contents.

## Product Principles
- Rex remains the source of session and layout state.
- Make the input destination evident.
- Preserve the user's draft on failure.
- Keep the terminal work dominant.
