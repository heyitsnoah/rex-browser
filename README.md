# Rex Browser prototype

A local browser frontend for existing Rex sessions, using the official unmodified libghostty-vt 1.0.1 WebAssembly module and a small JavaScript wrapper. No ghostty-web dependency.

## Run

Requires Node with TypeScript stripping, the Rex CLI, and connected Tailscale.

```
npm start
```

Open http://127.0.0.1:4317. Select Mini or Spark, a session, and a pane. Input is disabled until Enable typing is checked. Click the terminal for basic keyboard input, or use the text box and Send + Enter. Selecting another target disables typing again.

The bridge binds only to loopback, validates the Host header, and requires a per-process token for API calls. It invokes Rex with argument arrays, never shell interpolation. Do not expose this prototype publicly.

## Scope and limitations

- Snapshot refresh every 800 ms; not a continuous terminal stream. `rex block stream` returned not implemented in the installed CLI.
- Official Ghostty interprets VT; the wrapper uses its plain-text formatter. Colors, cursor drawing, mouse protocols, IME and resize synchronization are not implemented.
- Parsing viewport is fixed at 160x48. Remote terminal sizes are not changed. Large scrollback is reprocessed per changed snapshot.
- Uses the existing servers at rex-mini.taila2391.ts.net and rex-spark.taila2391.ts.net.
- Browser starts in read-only mode. Sending input affects the real selected pane.
- No server restart or origin setting change is needed.

## Verification (2026-11-14 Eastern)

Created only scratch session `browser-prototype` on Mini for input testing. Authenticated bridge input returned 200, a subsequent VT snapshot contained REX_BROWSER_OK, and the official WASM successfully parsed and formatted it. Requests without the local token return 403. Browser smoke/regression now passes in throwaway Chromium via local CDP: session/pane loading, scratch command submission with visible output, host switching with typing reset, and localhost reload. Fixed an invalid placeholder block ID sent during initial pane loading, cleared stale selections during switches, and allowed localhost alongside 127.0.0.1. Local QA evidence: `tmp/qa/rex-fix/` (ignored). Direct keyboard/paste and exhaustive failure scenarios remain unverified.

## Sources

- https://lib.ghostty.org/vt/installing.html
- https://github.com/ghostty-org/ghostty/tree/vt-1.0.1/example/wasm-vt
- https://www.superlogical.com/rex/docs/reference/api
- https://www.superlogical.com/rex/docs/reference/cli

WASM source: https://release.files.ghostty.org/libghostty-vt/1.0.1/ghostty-vt-1.0.1-small.wasm
SHA-256 verified against official SHA256SUMS:
`e226900d2126faab515668e5400b69fc78ba3d99aaf9525b325f79707b29bf01`

Ghostty is MIT licensed; see GHOSTTY-LICENSE. Our wrapper follows the official example's C ABI usage. Future work should first validate Rex's data protocol for continuous streaming, then add color/cursor rendering and terminal sizing.

For a background process that survives the launching terminal/tool session:

```sh
mkdir -p tmp/qa/runtime
nohup setsid node --experimental-strip-types server.ts > tmp/qa/runtime/server.log 2>&1 < /dev/null &
```

This does not install a login/startup service. A previous foreground tool-launched server stopped after the tool session ended; detached launch was verified with a subsequent HTTP 200 check.

## Tabs, panes and submission

The tab selector follows Rex windows; each tab displays its tiled terminal panes using Rex's reported geometry. Click a pane header or choose it in the pane selector to target input. Floating layers and nonterminal blocks are not displayed, and Refresh reloads layout/title changes.

Send + Enter submits explicitly without requiring Direct typing; Ctrl/Cmd+Enter in the composer does the same. Successful sends clear the composer, and errors retain the draft with a persistent message. Direct typing controls only keyboard/paste input inside a focused terminal. New tab creates a real Rex shell tab in the selected session, selects it in the browser, and leaves native-client focus unchanged.

Browser regression verified explicit submission, rejected submission/draft retention, new-tab creation in the scratch session, and real two-pane 50/50 geometry. Full terminal sizing, continuous streams, and rich rendering remain future work.

## Computer discovery

The picker reads `tailscale status --json` on page load and Refresh, selecting peers tagged `tag:rex`. It uses their current full DNS names, shows offline peers disabled, and preserves the selected computer/session/tab on Refresh when still available. It does not depend on the `rex hosts` address book or a fixed machine list. The bridge only connects to hosts returned by discovery. Tailscale discovery failures and empty results are shown explicitly. A local-only Rex server without a tagged Tailscale node is not included.

Verified 2026-11-17: browser lists rex-mbp, rex-mini, rex-spark; MacBook sessions and panes load; Refresh preserves selection; an undiscovered host request is rejected. Offline/no-peer branches were not exercised against the live tailnet.
