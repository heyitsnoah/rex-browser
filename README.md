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

## Agent transcript views (every Rex computer, no setup)

Claude Code, Codex, and Pi processes default to a conversation view (design: `DESIGN.md` § Conversation). The Terminal button in the header, or Ctrl+J, opens the raw Rex output in a resizable drawer under it. Other programs, and agents on computers without transcript access, keep the terminal view. The composer still sends input through Rex; the application never edits JSONL or resumes a second agent process.

The reader runs on the host that owns the files, reads originals in place, and returns messages in memory. No transcript copies, synchronization, database, SDK, or agent-service dependency. It polls every three seconds while visible. It reads `.claude/projects`, `.codex/sessions`, and `.pi/agent/sessions` under that host user's home. Only uncompressed JSONL is supported, up to 32 MiB per file; the UI shows the latest 500 items. Agent Markdown is rendered by `@pierre/words` 0.3.0 (Apache-2.0, vendored unmodified in `public/vendor/words/`) with raw HTML skipped, then passed through an allow-list sanitizer in `public/conversation.js`; links open in a new tab and images are not loaded. Runs of tool calls fold into one summary line; each call expands to its input and output as plain text. Claude subagents show as a live row (elapsed time, tool count, latest steps) from `<session>/subagents/agent-*.jsonl` and their `.meta.json`; background completion comes from the transcript's task notifications. A pulsing "Working" line shows until Claude writes its end-of-turn record (Codex: `task_complete`). Diff rendering is not implemented.

**How the reader reaches a computer.** The reader and parser run together on the computer that owns the files and return only the parsed conversation, gzipped and base64-framed (`REXB64:…:REXEND`); this session's 26 MB transcript comes back as about 100 KB. With no entry in `.rex-transcripts.json`, the bridge runs that program in a hidden Rex terminal on the target computer (`session.new_block` in the pane's session, never placed in a window), reads its output with `format` (`unwrap`, paged with `blob_read`), and closes it. Nothing is installed; Node must be on that computer's interactive PATH. Verified 2026-11-20: Node v24 found on rex-mbp, rex-mini, rex-omarchy, rex-spark and rex-fw (0.3–0.8 s per run); a rex-mini Claude Code pane read in 0.6–1.0 s; no hidden terminals left behind. Images already cached by the bridge are not sent again.

Optionally, `.rex-transcripts.json` (gitignored), keyed by the discovered Rex DNS name, picks a faster path:

```json
{
  "rex-example.your-tailnet.ts.net": { "ssh": "user@example" },
  "rex-this-machine.your-tailnet.ts.net": { "local": true }
}
```

Use `local` only when that Rex server runs on the browser bridge's own machine as the same user. SSH uses existing credentials and strict host-key verification; it runs Node through stdin without installing or writing a script on the remote machine. Node must be on the remote noninteractive PATH. Spark is configured locally through the existing `sparky` SSH alias following Tailscale SSH authentication. Mini still rejects the available SSH credentials; other hosts require their own access configuration.

Claude's PID session metadata and open transcript files reported by `lsof` can establish an exact match. Otherwise the UI lists conversations whose recorded working directory matches the pane's project and asks the user to select; it never assumes the newest file is the active conversation. Missing/unsupported home directories, absent metadata, large files, and compressed Codex rollouts can prevent matching. A selected transcript is a view only, not proof it belongs to the currently running process. If remote access is unavailable, the conversation view explains this and Terminal remains available.

Parser coverage: Claude/Pi parent chains, Claude sidechain exclusion, Codex canonical response items (avoids duplicate event messages), tool content, compaction markers, incomplete and malformed lines. Raw transcripts remain authoritative; this is a conversation reader, not an exact model-context reconstruction or full implementation of every provider's rollback/edit event.

Validation: `node --test src/transcripts/transcript-parser.test.mjs`. Eight tests pass (added: slash commands, mid-turn messages, task notifications, working state, parallel results on sibling branches). On 2026-11-20 the Thread view was checked in headless Chromium against a live local Claude Code session: Markdown tables and lists, one finished background subagent (47 tools), folded runs with expandable input/output, the Ctrl+J drawer showing the live terminal, and dark mode. An existing local Pi transcript was read in place and produced 191 items; no copy was saved. Browser fixture checks passed transcript default, safe text rendering, and Terminal fallback. Live remote QA on Spark passed after SSH authentication: a running Claude Code pane matched its exact transcript (76 parsed items, no warnings), opened the conversation by default, and switched to Terminal and back. Verification recorded counts and visibility only; no transcript content was saved. Existing shell terminal rendering was checked against live Rex.

Reference inspected: T3 Code `AgentSessionScanner.ts`, `AgentSessionImporter.ts`, and `usageTranscriptReader.ts` at `c7157d376d828541b86f472d33e2e03f037edc32`: https://github.com/pingdotgg/t3code/tree/c7157d376d828541b86f472d33e2e03f037edc32/apps/server/src . Implementation here is independent; no T3 runtime dependency.

## Attachments and phone layout

The composer's paperclip (or pasting a file) uploads to the pane's computer through the same path as transcripts (`local`, SSH, or by default a hidden Rex terminal that reads the file as base64 in raw mode, in 60 KB writes), into `~/.local/state/rex-browser/uploads/<uuid>/` (folder 700, file 600, name reduced to `[\w.-]`, 25 MB max). On Send the paths are pasted into the pane as their own Rex `paste` event (pasted together with the text, Claude Code reads the path as text instead of attaching the image), then the message is pasted and Enter is sent as a separate keystroke after 120 ms: sent in one write, Claude Code treats the Enter as part of the paste and leaves the message unsubmitted. Over Rex, 300 KB took 1.9 s to rex-mini with matching SHA-256 on both ends (2026-11-20). Rex's native `upload_begin` would be faster but needs its `rex.data.bytes.v1` data protocol, which isn't documented. Uploaded files are not cleaned up automatically.

Send is optimistic: the composer clears and a pending bubble appears at once. It stays ("Sending…", "Sent", or "Queued" while the agent is busy) until the transcript shows the message, since Claude Code writes a mid-turn message only when it picks it up. Images in transcripts render as thumbnails: the server swaps inline base64 for a hash (in-memory cache, 200 images) and serves the bytes once from `/api/image`.

Under 760px the rail is a full-screen panel behind a menu button (closed by the X in the same spot or by picking a tab), the conversation takes the screen, header controls are icon-only, text fields are 16px so iOS doesn't zoom, and safe-area insets keep the composer above the home indicator.

Verified 2026-11-20: uploads to rex-fw (local) and Spark (SSH), refusal for an unconfigured computer, path-traversal names sanitized; paste then typed input delivered in order to a scratch Rex session (deleted afterwards); phone layout captured at 390×844 in light and dark.

QA 2026-11-20, through the web UI against a real Claude Code in a scratch Rex session (deleted afterwards): a message submitted and got its reply; a message sent mid-turn was delivered and answered; an image attached from the phone layout was recognized by Claude Code (answered correctly) and shown as a thumbnail.
