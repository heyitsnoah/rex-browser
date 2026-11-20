# Terminal experience research — 2026-11-14

## Labels: verified and corrected

The app displayed block.label (default `shell`) and discarded the window/tab
hierarchy and terminal title. Live Mini responses confirm named windows such as
envoy, Reviews, Tools and Component Artifacts. The terminal `title` method
separately returns program-provided titles. The block endpoint now combines
window label, terminal title (fallback block label), and short ID to distinguish
duplicate panes. It does not rename anything in Rex. Browser QA verified real
labels render. Titles refresh when the pane list refreshes; continuous title
updates remain future work.

## Why the prototype feels unlike a terminal

Current code rebuilds a 160x48 Ghostty terminal from a complete snapshot every
800ms, formats it to PLAIN, replaces a pre element, and scrolls to the bottom.
This discards colors/cursor appearance, can interrupt reading/selection, and
adds polling latency. Input spawns a CLI call per key. Changing fonts alone
cannot fix these behaviors.

## Recommended implementation order

1. Preserve tab → pane hierarchy, terminal titles, and foreground
   process/directory fallbacks. Subscribe to title_changed and process_changed
   when the persistent connection is built. Show agent state only when Rex
   reports it.
2. Prove Rex's data transport on the scratch session: persistent control session
   attach, data.connect ticket, then /api/data with rex.data.terminal.v1. Verify
   framing, initial state, reconnect, ordering, and backpressure before treating
   it as raw ANSI. The public method docs expose ticket mechanics, but we have
   not yet verified the binary stream protocol. No need to introduce another
   session service.
3. Replace PLAIN formatting with a persistent renderer preserving cell
   attributes, cursor, alternate screen, Unicode widths, and scrollback.
   Synchronize geometry deliberately: Rex size has an owner and client sizes, so
   browser resize must not fight an existing native client.
4. Browser interaction: hidden textarea/composition for IME, correct control/Alt
   keys, bracketed paste, clipboard permissions, text selection, links, search,
   font size, and follow-output only while at the bottom. Add explicit reconnect
   and input-active states; don't silently replay uncertain keystrokes.
5. QA on a scratch pane: shell editing, Claude/Codex UI, alternate screen app,
   rapid output, Unicode, long scrollback, paste, resize, disconnect/reconnect.
   No input into ongoing work panes.

## Build versus reuse

| Option                                | Benefit                                                                                  | Cost / uncertainty                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Official libghostty-vt + our renderer | Keeps upstream WASM; complete control; no third-party Ghostty fork                       | We own browser rendering, selection, accessibility, IME and input integration; current render API docs need checking against pinned 1.0.1 ABI |
| coder/ghostty-web                     | Browser Terminal/onData/write API and Ghostty parser already integrated                  | README says it builds patched Ghostty source; not merely a wrapper around our official WASM. Compatibility and behavior need an isolated test |
| xterm.js                              | Established browser terminal API and addon ecosystem; fit/search/web links/WebGL options | Different emulator from Ghostty; does not solve Rex transport                                                                                 |

Recommendation: keep official Ghostty for now and implement a bounded
renderer/transport spike before adopting a port. Do not mistake our small
proof-of-concept wrapper for a finished browser terminal. If
selection/IME/accessibility costs dominate, compare ghostty-web and xterm.js
using the same scratch-session acceptance cases rather than rewriting those
features unquestioningly. No dependency switch has been made.

## Sources checked

- Live Rex CLI: block inspect, window ls, terminal title, data.connect schema.
  These determine installed-server capabilities.
- https://www.superlogical.com/rex/docs/reference/api — data tickets, block
  input events, methods.
- https://raw.githubusercontent.com/ghostty-org/ghostty/main/include/ghostty/vt/render.h
  — render state includes cells, cursor, colors and dirty tracking; main is not
  proof of pinned ABI compatibility.
- https://raw.githubusercontent.com/coder/ghostty-web/main/README.md — API,
  patched source build, upstream-WASM intent.
- https://github.com/xtermjs/xterm.js and
  https://xtermjs.org/docs/guides/using-addons/ — browser terminal and addons.

## Design handoff

No DESIGN.md, PRODUCT.md, brand, or UI framework exists. Current UI is an
unstyled functional prototype. Alephic Design preflight: catalog dependencies
present, ai authenticated with artifact read/write, artifact help checked; uvx
available as shot-scraper fallback. Entry choice pending: new visual direction,
existing brand, or targeted redesign. Do not select for Noah. No visual review
artifact yet because this checkpoint asks about project classification, not
comparison of visuals.
