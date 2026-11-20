# Rex Browser prototype

A local browser frontend for existing Rex sessions, using the official unmodified libghostty-vt 1.0.1 WebAssembly module and a small JavaScript wrapper. No ghostty-web dependency.

## Run

Requires Node with TypeScript stripping, the Rex CLI, and connected Tailscale.

```
npm start
```

Open http://127.0.0.1:4317. The left rail lists every discovered computer and its sessions; open a session to see its tabs and pick one. Click a pane to target it. The page starts in Read only; switch to Direct typing for basic keyboard input in the focused pane, or use the composer and Send (Ctrl+Enter). Selecting another target returns to Read only. The last tab is reopened on reload, and the theme follows the system until you toggle it.

Visual direction: `DESIGN.md` (Session Rail, Alephic Product). Fonts are inlined in `public/index.html`, so the bridge needs no extra static routes.

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

## Serving over Tailscale

The bridge always binds to loopback. To reach it from other devices on the tailnet, run it on a machine with Tailscale Serve in front and set both variables:

```sh
REX_BROWSER_HOST=<machine>.<tailnet>.ts.net REX_BROWSER_LOGIN=<your Tailscale login> npm start
tailscale serve --bg 4317
```

Requests for that host name are accepted only when Tailscale Serve reports that login in `Tailscale-User-Login`; everyone else, including tagged devices with no user, gets 403. With either variable unset, only loopback works. Never use Funnel: the page carries the API token and can type into every pane.

## Agent transcript views (access setup required per host)

Claude Code, Codex, and Pi processes default to a conversation view; a Terminal button switches to the Rex output. Other programs retain the terminal view. The composer still sends input through Rex; the application never edits JSONL or resumes a second agent process.

The reader runs on the host that owns the files, reads originals in place, and returns messages in memory. No transcript copies, synchronization, database, SDK, or agent-service dependency. It polls every three seconds while visible. It reads `.claude/projects`, `.codex/sessions`, and `.pi/agent/sessions` under that host user's home. Only uncompressed JSONL is supported, up to 32 MiB per file; the UI shows the latest 500 items. Tool calls/results are expandable plain text. Rich Markdown/diff rendering is not yet implemented.

Configure `.rex-transcripts.json` locally (gitignored), keyed by the discovered Rex DNS name:

```json
{
  "rex-example.your-tailnet.ts.net": { "ssh": "user@example" },
  "rex-this-machine.your-tailnet.ts.net": { "local": true }
}
```

Use `local` only when that Rex server runs on the browser bridge's own machine as the same user. SSH uses existing credentials and strict host-key verification; it runs Node through stdin without installing or writing a script on the remote machine. Node must be on the remote noninteractive PATH. Spark is configured locally through the existing `sparky` SSH alias following Tailscale SSH authentication. Mini still rejects the available SSH credentials; other hosts require their own access configuration.

Claude's PID session metadata and open transcript files reported by `lsof` can establish an exact match. Otherwise the UI lists conversations whose recorded working directory matches the pane's project and asks the user to select; it never assumes the newest file is the active conversation. Missing/unsupported home directories, absent metadata, large files, and compressed Codex rollouts can prevent matching. A selected transcript is a view only, not proof it belongs to the currently running process. If remote access is unavailable, the conversation view explains this and Terminal remains available.

Parser coverage: Claude/Pi parent chains, Claude sidechain exclusion, Codex canonical response items (avoids duplicate event messages), tool content, compaction markers, incomplete and malformed lines. Raw transcripts remain authoritative; this is a conversation reader, not an exact model-context reconstruction or full implementation of every provider's rollback/edit event.

Validation: `node --test src/transcripts/transcript-parser.test.mjs`. Five tests pass. An existing local Pi transcript was read in place and produced 191 items; no copy was saved. Browser fixture checks passed transcript default, safe text rendering, and Terminal fallback. Live remote QA on Spark passed after SSH authentication: a running Claude Code pane matched its exact transcript (76 parsed items, no warnings), opened the conversation by default, and switched to Terminal and back. Verification recorded counts and visibility only; no transcript content was saved. Existing shell terminal rendering was checked against live Rex.

Reference inspected: T3 Code `AgentSessionScanner.ts`, `AgentSessionImporter.ts`, and `usageTranscriptReader.ts` at `c7157d376d828541b86f472d33e2e03f037edc32`: https://github.com/pingdotgg/t3code/tree/c7157d376d828541b86f472d33e2e03f037edc32/apps/server/src . Implementation here is independent; no T3 runtime dependency.
