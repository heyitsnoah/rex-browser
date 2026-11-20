#!/usr/bin/env node
// Builds the three transcript-view directions (Branch C, 2026-11-20).
// Usage: node docs/design/tiles/transcript.mjs
// Everything outside the conversation (rail, header, composer, tokens) is Session Rail, unchanged,
// so the only differences between tiles are the weak dimensions: transcript rendering,
// the Conversation/Terminal switch, and how subagents show.
// Content: real turns from the 2026-11-20 rex-browser Claude Code session (lightly trimmed).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fonts = fs.readFileSync(path.join(here, 'fonts.css'), 'utf8')

const icons = {
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  panelBottom: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/>',
  panelRight: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
}
const ico = (name, size = 16) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------- Content (shared by all tiles) ----------
const turns = [
  {
    time: '09:24',
    user: 'is the server running',
    work: [
      { tool: 'Bash', kind: 'terminal', label: 'Find server port and check for running process', cmd: 'grep -nE "PORT|listen" server.ts; pgrep -af server.ts', out: '96:server.listen(4317,\'127.0.0.1\',…)\n2482362 node --experimental-strip-types server.ts', dur: '0.4s' },
      { tool: 'Bash', kind: 'terminal', label: 'Check server process age and HTTP response', cmd: 'ps -o pid,lstart,etime -p 2482362; curl -s -o /dev/null -w "%{http_code}" 127.0.0.1:4317/', out: '2482362  Fri Nov 20 08:01:36 2026  01:24:28\n200', dur: '0.3s' },
    ],
    duration: '14s',
    answer: `<p>Yes, the server is running. It's at <code>http://127.0.0.1:4317</code> and returns 200. It's <code>node --experimental-strip-types server.ts</code>, PID 2482362, started from this repo at 08:01 today.</p>
<p>One catch: it started two minutes before the transcript-view commit (<code>d46a016</code>). The pages under <code>public/</code> are reread on every request, so browser-side changes show up. Changes to <code>server.ts</code> itself need a restart.</p>`,
  },
  {
    time: '09:26',
    user: "that's not looking great yet",
    image: 'CleanShot 2026-11-20 at 9.26.24 AM.png',
    user2: "and why isn't transcript access configured",
    work: [
      { tool: 'Bash', kind: 'terminal', label: 'Show transcript view changes in client and server', dur: '0.2s' },
      { tool: 'Bash', kind: 'terminal', label: 'Read page styles and transcript config', dur: '0.1s' },
      { tool: 'Bash', kind: 'terminal', label: 'List Rex hosts, local hostname, SSH aliases', dur: '1.1s' },
      { tool: 'Bash', kind: 'terminal', label: 'Check whether rex-fw is this machine', dur: '0.6s' },
      { tool: 'Bash', kind: 'terminal', label: 'Test passwordless SSH to the other Rex computers', dur: '9.8s', fail: true },
      { tool: 'Bash', kind: 'terminal', label: 'Add rex-fw as a local transcript host', dur: '0.1s' },
      { tool: 'Read', kind: 'file', label: 'public/client.js', dur: '0.1s' },
      { tool: 'Edit', kind: 'edit', label: 'public/client.js', dur: '0.1s' },
      { tool: 'Edit', kind: 'edit', label: 'public/index.html', dur: '0.1s' },
      { tool: 'Bash', kind: 'terminal', label: 'Screenshot the rex-fw Claude pane via headless Chrome', dur: '21s' },
    ],
    duration: '6m 02s',
    answer: `<p>I've fixed the pane you screenshotted, and rex-fw can now read its transcripts. rex-mbp, rex-mini and rex-omarchy still can't, because nothing on them accepts a connection from this server yet.</p>
<ul><li><strong>No more dead end.</strong> Agent panes on a computer without transcript access open straight to the terminal.</li><li><strong>Tool calls are one row each</strong>, with the tool name and a readable summary.</li><li><strong>rex-fw is configured</strong> as a local host in <code>.rex-transcripts.json</code>.</li></ul>
<table><thead><tr><th>Computer</th><th>Result</th></tr></thead><tbody><tr><td>rex-mbp, rex-mini, rex-omarchy</td><td>SSH connection refused</td></tr><tr><td><code>mini</code> alias</td><td>Rejects this laptop's key</td></tr></tbody></table>`,
  },
  {
    time: '09:31',
    user: 'this looks terrible, can we redesign the actual ui (you can check stuff like t3 etc) and also the terminal button up there is weird',
    skill: 'alephic-design',
    live: true,
    work: [
      { tool: 'Bash', kind: 'terminal', label: 'Run design skill preflight checks', dur: '2.3s' },
      { tool: 'Read', kind: 'file', label: 'references/improve-existing.md', dur: '0.1s' },
      { tool: 'Agent', kind: 'agent', label: 'Research T3 Code agent UI', subagent: { type: 'general-purpose', background: true, elapsed: '4m 12s', tools: 38, now: { tool: 'WebSearch', label: 'Codex app terminal toggle shortcut' }, recent: [
        { tool: 'Bash', kind: 'terminal', label: 'Clone pingdotgg/t3code into scratchpad' },
        { tool: 'Read', kind: 'file', label: 'apps/web/src/components/chat/WorkLog.tsx' },
        { tool: 'Read', kind: 'file', label: 'apps/web/src/components/chat/TimelineWorkGroupRows.tsx' },
        { tool: 'WebFetch', kind: 'globe', label: 'developers.openai.com/codex/app/features' },
      ] } },
      { tool: 'Bash', kind: 'terminal', label: 'Capture incumbent screenshots for tile 0', dur: '34s' },
      { tool: 'Bash', kind: 'terminal', label: 'Run impeccable anti-pattern detection on UI', running: true, elapsed: '18s' },
    ],
    working: '6m 41s',
    lead: `<p>Preflight passes. This is the "design exists, isn't good yet" branch, as you said. I'll run the T3 Code research in the background while I capture and critique the current UI.</p>`,
  },
]

// Summary sentence for a run of tool calls ("Ran 6 commands, read 1 file and edited 2 files").
function summarize(work) {
  const n = { terminal: 0, file: 0, edit: 0, globe: 0 }
  for (const w of work) if (w.kind in n) n[w.kind]++
  const parts = []
  if (n.terminal) parts.push(`ran ${n.terminal} command${n.terminal > 1 ? 's' : ''}`)
  if (n.file) parts.push(`read ${n.file} file${n.file > 1 ? 's' : ''}`)
  if (n.edit) parts.push(`edited ${n.edit} file${n.edit > 1 ? 's' : ''}`)
  if (n.globe) parts.push(`fetched ${n.globe} page${n.globe > 1 ? 's' : ''}`)
  const s = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0] || ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const iconFor = (w) => ({ terminal: 'terminal', file: 'file', edit: 'edit', agent: 'agent', globe: 'globe' })[w.kind]

// ---------- Shared shell (Session Rail, unchanged except a working dot on the active tab) ----------
const tokens = `
:root{color-scheme:light;
  --bg:#ffffff;--card:#ffffff;--fg:#231f20;--tray:#231f20;--tray-fg:#f4f4f2;--tray-edge:#231f20;--tray-active:#45bf55;
  --primary:#23602b;--primary-fg:#ffffff;--ring:#23602b;--muted-fg:#575c58;--muted:#e3e6e3;--subtle:#f3f5f3;
  --border:#d3d8d4;--input:#858b86;--destructive:#b42318;--selected:#e4f1e5;--note:#8fd999;--note-fg:#12301a;--note-soft:#e1f3e3;
  --shadow:0 1px 2px rgb(35 31 32/.06),0 2px 8px rgb(35 31 32/.06);
  --ease-out:cubic-bezier(0.23,1,0.32,1);--fast:150ms;
  --sans:'Geist',system-ui,sans-serif;--mono:'Geist Mono',ui-monospace,monospace}
:root[data-theme=dark]{color-scheme:dark;
  --bg:#161515;--card:#211f20;--fg:#ededeb;--tray:#0b0a0a;--tray-fg:#ededeb;--tray-edge:#363334;
  --primary:#45bf55;--primary-fg:#0f1f12;--ring:#8fd999;--muted-fg:#a6aba7;--muted:#2a2829;--subtle:#1c1b1b;
  --border:#363334;--input:#6e6b6c;--destructive:#ff8f8f;--selected:#1c2b1e;--note-soft:#1f3323;
  --shadow:0 1px 2px rgb(0 0 0/.4),0 2px 8px rgb(0 0 0/.3)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;
  --bg:#161515;--card:#211f20;--fg:#ededeb;--tray:#0b0a0a;--tray-fg:#ededeb;--tray-edge:#363334;
  --primary:#45bf55;--primary-fg:#0f1f12;--ring:#8fd999;--muted-fg:#a6aba7;--muted:#2a2829;--subtle:#1c1b1b;
  --border:#363334;--input:#6e6b6c;--destructive:#ff8f8f;--selected:#1c2b1e;--note-soft:#1f3323;
  --shadow:0 1px 2px rgb(0 0 0/.4),0 2px 8px rgb(0 0 0/.3)}}`

const base = `${fonts}
${tokens}
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 15px/1.5 var(--sans);-webkit-font-smoothing:antialiased;display:grid;grid-template-columns:272px minmax(0,1fr);overflow:hidden}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
code{font:400 .86em/1 var(--mono);padding:2px 5px;border-radius:4px;background:var(--muted)}
.label{font:400 11px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mono{font-family:var(--mono)}
aside{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:8px;height:52px;padding:0 12px 0 16px;font-weight:500}.brand span{flex:1}
.ib{width:32px;height:32px;display:inline-grid;place-items:center;border-radius:8px;color:var(--muted-fg)}
.ib:hover{background:var(--muted);color:var(--fg)}
.filter{display:flex;align-items:center;gap:8px;height:36px;margin:0 12px 8px;padding:0 10px;border:1px solid var(--input);border-radius:4px;color:var(--muted-fg);font-size:13px}
#tree{flex:1;overflow:hidden;padding:0 8px}
.host{display:flex;align-items:center;gap:8px;padding:16px 8px 8px;color:var(--muted-fg)}
.n{margin-left:auto;font:400 11px/1 var(--mono);color:var(--muted-fg)}
.dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--primary)}
.sess,.tab{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 8px;border-radius:4px;font-size:13px;text-align:left}
.sess{font-weight:500}.sess svg{color:var(--muted-fg);flex:none}
.tabs{margin:2px 0 6px 13px;padding-left:8px;border-left:1px solid var(--border)}
.tab[aria-current=true]{background:var(--selected);font-weight:500}
.tab.new{color:var(--muted-fg)}
.tab .work{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:400 11px/1 var(--mono);color:var(--primary)}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--primary);animation:pulse 1.6s var(--ease-out) infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.pulse,.shine{animation:none!important}}
main{display:flex;flex-direction:column;min-width:0;min-height:0}
.head{display:flex;align-items:center;gap:14px;min-height:52px;padding:0 16px 0 24px;border-bottom:1px solid var(--border)}
.head h1{margin:0;font-size:18px;font-weight:500;letter-spacing:-.01em}
.meta{font:400 12px/1 var(--mono);color:var(--muted-fg)}
.sp{flex:1}
.state{display:inline-flex;gap:6px;align-items:center;color:var(--primary)}
.composer{padding:12px 24px 16px;border-top:1px solid var(--border)}
.to{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:var(--muted-fg)}.to b{color:var(--fg);font-weight:500}
.field{display:flex;gap:10px}
.field .ta{flex:1;height:56px;padding:9px 12px;border:1px solid var(--input);border-radius:4px;font:400 13px/1.5 var(--sans);color:var(--muted-fg)}
.send{align-self:flex-end;height:40px;display:inline-flex;align-items:center;gap:10px;padding:0 14px;border-radius:8px;background:var(--primary);color:var(--primary-fg);font-size:14px;font-weight:500}
.send kbd{font:400 11px/1 var(--mono);opacity:.8}
/* Markdown */
.anchor{position:absolute;left:0;right:0;bottom:0}
.md p{margin:0 0 12px}.md p:last-child{margin-bottom:0}
.md ul{margin:0 0 12px;padding-left:20px}.md li{margin:4px 0}
.md strong{font-weight:500}
.md table{border-collapse:collapse;margin:4px 0 12px;font-size:13px}
.md th{text-align:left;font-weight:500;color:var(--muted-fg)}
.md th,.md td{padding:6px 16px 6px 0;border-bottom:1px solid var(--border)}
`

const rail = (extra = '') => `<aside aria-label="Rex sessions">
  <div class="brand"><span>Rex</span><button class="ib" aria-label="Switch theme" data-theme-toggle>${ico('sun')}</button><button class="ib" aria-label="Refresh">${ico('refresh')}</button></div>
  <label class="filter">${ico('search', 14)}<span>Filter</span></label>
  <nav id="tree">
    <div class="host label"><span class="dot"></span>rex-fw<span class="n">1 session</span></div>
    <button class="sess">${ico('down', 14)}<span>silent-brook</span><span class="n">1</span></button>
    <div class="tabs"><button class="tab" aria-current="true"><span class="trunc">Session status check</span><span class="work"><span class="pulse"></span>working</span></button><button class="tab new">${ico('plus', 14)}New tab</button></div>
    <div class="host label"><span class="dot"></span>rex-mbp<span class="n">3 sessions</span></div>
    <button class="sess">${ico('chevron', 14)}<span>mini-tailscale-debug</span></button><button class="sess">${ico('chevron', 14)}<span>clayfuls</span></button><button class="sess">${ico('chevron', 14)}<span>cli-modularization-review</span></button>
    <div class="host label"><span class="dot"></span>rex-mini<span class="n">8 sessions</span></div>
    <button class="sess">${ico('chevron', 14)}<span>Hubspot</span></button><button class="sess">${ico('chevron', 14)}<span>presentation-path-experiments</span></button><button class="sess">${ico('chevron', 14)}<span>PR 3325 second opinion</span></button><button class="sess">${ico('chevron', 14)}<span>AI Board ticket review</span></button><button class="sess">${ico('chevron', 14)}<span>reviews</span></button>
    <div class="host label"><span class="dot"></span>rex-spark<span class="n">7 sessions</span></div>
    <button class="sess">${ico('chevron', 14)}<span>AI-5490</span></button><button class="sess">${ico('chevron', 14)}<span>AI MCP</span></button><button class="sess">${ico('chevron', 14)}<span>Backup Harness Sessions</span></button><button class="sess">${ico('chevron', 14)}<span>Speech Acts</span></button>
  </nav>${extra}
</aside>`

const composer = (placeholder = 'Reply to Claude Code') => `<div class="composer">
  <div class="to"><span>Send to</span><b>Session status check</b><span class="meta">rex-fw · Claude Code</span></div>
  <div class="field"><div class="ta">${placeholder}</div><button class="send">Send <kbd>Ctrl+Enter</kbd></button></div>
</div>`

const script = `const r=document.documentElement,q=new URLSearchParams(location.search).get('theme');if(q)r.dataset.theme=q;
document.querySelector('[data-theme-toggle]').onclick=()=>{const d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'light':'dark'};
document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const t=b.closest('[data-group]');t.toggleAttribute('data-open')});`

const page = (title, css, mainHtml) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${base}${css}</style></head>
<body>${rail()}<main>${mainHtml}</main><script>${script}</script></body></html>`

// =====================================================================
// A · Thread: T3-style. Centered column, Mint "yours" bubbles, one quiet summary row per run of tools,
// subagent as a live inline row, terminal as a bottom drawer from a header icon.
// =====================================================================
const aCss = `
.view{flex:1;min-height:0;overflow:hidden;position:relative}
.col{max-width:736px;margin:0 auto;padding:28px 24px 8px}
.user{display:flex;flex-direction:column;align-items:flex-end;margin:0 0 20px}
.bubble{max-width:80%;padding:10px 14px;border-radius:16px 16px 4px 16px;background:var(--note-soft);font-size:14px;line-height:1.55}
.bubble+.bubble{margin-top:4px}
.att{display:inline-flex;align-items:center;gap:8px;margin-bottom:4px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--muted-fg)}
.skill{display:block;margin-bottom:4px;font:400 11px/1 var(--mono);color:var(--muted-fg)}
.agent{margin:0 0 24px;font-size:14.5px;line-height:1.65}
.run{margin:0 0 14px}
.run>button{display:flex;align-items:center;gap:8px;height:26px;padding:0 4px;margin-left:-4px;border-radius:6px;font-size:13.5px;color:var(--muted-fg)}
.run>button:hover{color:var(--fg);background:var(--subtle)}
.run>button .chev{transition:transform var(--fast) var(--ease-out);opacity:.7}
.run[data-open]>button .chev{transform:rotate(90deg)}
.run .dur{font:400 11px/1 var(--mono);opacity:.8}
.rows{display:none;margin:4px 0 0 2px;padding:6px 0 6px 18px;border-left:1px solid var(--border)}
.run[data-open] .rows{display:block}
.row{display:flex;align-items:center;gap:8px;height:24px;font-size:13px;color:var(--muted-fg)}
.row svg{flex:none;opacity:.8}.row .t{flex:none;min-width:40px;color:var(--fg);font:400 12px/1 var(--mono)}
.row .d{margin-left:auto;font:400 11px/1 var(--mono)}
.row.fail svg,.row.fail .t{color:var(--destructive)}
.sub{margin:6px 0 14px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card)}
.sub-top{display:flex;align-items:center;gap:8px;font-size:13.5px}
.sub-top b{font-weight:500}.sub-top .meta{margin-left:auto}
.sub-now{display:flex;align-items:center;gap:8px;margin:6px 0 0 14px;font-size:13px;color:var(--muted-fg)}
.shine{background:linear-gradient(90deg,var(--muted-fg) 0%,var(--fg) 50%,var(--muted-fg) 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 2.4s linear infinite}
@keyframes shine{to{background-position:-200% 0}}
.working{display:flex;align-items:center;gap:8px;height:28px;margin:4px 0 0;font-size:13px;color:var(--muted-fg)}
.working .mono{font-size:12px}
.hdr-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--muted-fg)}
.hdr-btn kbd{font:400 11px/1 var(--mono)}
.agents{display:inline-flex;align-items:center;gap:6px;font:400 12px/1 var(--mono);color:var(--primary)}
.composer .field{max-width:736px;margin:0 auto}.composer .to{max-width:736px;margin:0 auto 8px}
.fade{position:absolute;left:0;right:0;top:0;height:28px;background:linear-gradient(var(--bg),transparent);pointer-events:none}
`
function aWork(work) {
  // fold consecutive non-agent tools into runs; subagents and running tools break the run
  const out = []
  let run = []
  const flush = (open = false) => {
    if (!run.length) return
    const total = run.length
    const head = total === 1 ? `${ico(iconFor(run[0]), 14)}<span class="trunc">${esc(run[0].label)}</span><span class="dur">${run[0].dur || ''}</span>` : `${ico('chevron', 12).replace('<svg', '<svg class="chev"')}<span>${summarize(run)}</span>${run.some((w) => w.fail) ? `<span style="color:var(--destructive)">· 1 failed</span>` : ''}`
    out.push(`<div class="run" data-group ${open ? 'data-open' : ''}><button data-toggle>${head}</button>
      <div class="rows">${run.map((w) => `<div class="row${w.fail ? ' fail' : ''}">${ico(w.fail ? 'x' : iconFor(w), 13)}<span class="t">${w.tool}</span><span class="trunc">${esc(w.label)}</span><span class="d">${w.dur || ''}</span></div>`).join('')}</div></div>`)
    run = []
  }
  for (const w of work) {
    if (w.subagent) {
      flush()
      const s = w.subagent
      out.push(`<div class="sub"><div class="sub-top"><span class="pulse"></span><b>${esc(w.label)}</b><span class="meta">${s.type} · background</span><span class="meta">${s.elapsed} · ${s.tools} tools</span></div>
        <div class="sub-now">${ico('globe', 13)}<span class="shine">Searching ${esc(s.now.label)}</span></div></div>`)
    } else if (w.running) {
      flush()
      out.push(`<div class="run"><button>${ico('terminal', 14)}<span class="shine">${esc(w.label)}</span><span class="dur">${w.elapsed}</span></button></div>`)
    } else run.push(w)
  }
  flush()
  return out.join('')
}
const aTurns = turns.map((t, i) => `
  <div class="user">${t.skill ? `<span class="skill">/${t.skill}</span>` : ''}${t.image ? `<span class="att">${ico('image', 14)}${esc(t.image)}</span>` : ''}<div class="bubble">${esc(t.user)}</div>${t.user2 ? `<div class="bubble">${esc(t.user2)}</div>` : ''}</div>
  ${t.lead ? `<div class="agent md">${t.lead}</div>` : ''}
  ${i === 1 ? aWork(t.work).replace('class="run" data-group ', 'class="run" data-group data-open ') : aWork(t.work)}
  ${t.answer ? `<div class="agent md">${t.answer}</div>` : ''}
  ${t.live ? `<div class="working"><span class="pulse"></span>Working for <span class="mono">${t.working}</span></div>` : ''}`).join('')
const thread = page('Thread', aCss, `
  <div class="head"><h1 class="trunc">Session status check</h1><div class="meta">rex-fw / silent-brook · Claude Code</div><span class="sp"></span>
    <span class="agents"><span class="pulse"></span>1 agent running</span>
    <button class="hdr-btn" title="Show terminal (Ctrl+J)">${ico('panelBottom', 15)}Terminal <kbd>Ctrl+J</kbd></button></div>
  <div class="view"><div class="fade"></div><div class="col anchor">${aTurns}</div></div>
  ${composer()}`)

// =====================================================================
// B · Ledger: dense, left-aligned, time gutter. Each turn gets a one-line mono trace of its tool work,
// expandable to a table. Subagents in a sticky strip at the top. Terminal as a right split.
// =====================================================================
const bCss = `
.split{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 420px}
.view{min-height:0;overflow:hidden;position:relative;display:flex;flex-direction:column}
.strip>*{white-space:nowrap;flex:none}.strip .now{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.strip{flex:none;display:flex;align-items:center;gap:12px;height:40px;padding:0 24px;border-bottom:1px solid var(--border);background:var(--subtle);font-size:13px}
.strip .label{color:var(--muted-fg)}
.strip b{font-weight:500}
.strip .meta{color:var(--muted-fg)}
.strip .now{color:var(--muted-fg);display:inline-flex;align-items:center;gap:6px}
.log{flex:1;min-height:0;overflow:hidden;position:relative}
.entry{display:grid;grid-template-columns:52px minmax(0,1fr);column-gap:12px}
.gut{padding-top:15px;font:400 11px/1 var(--mono);color:var(--muted-fg)}
.you{margin:10px 0 4px;padding:10px 12px;border-radius:6px;background:var(--note-soft);font-size:14px}
.you .who{display:block;margin-bottom:2px;font:400 11px/1.4 var(--mono);color:var(--muted-fg)}
.trace{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0;font:400 12px/1 var(--mono);color:var(--muted-fg)}
.trace button{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:1px solid var(--border);border-radius:4px}
.trace button:hover{color:var(--fg);background:var(--subtle)}
.chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px;border-radius:4px;background:var(--muted);color:var(--fg)}
.chip.bad{color:var(--destructive)}
.tbl{display:none;margin:0 0 10px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;overflow:hidden}
[data-open]>.tbl{display:block}
.tr{display:grid;grid-template-columns:64px minmax(0,1fr) 56px 18px;gap:10px;align-items:center;height:26px;padding:0 10px}
.tr+.tr{border-top:1px solid var(--border)}
.tr .t{font:400 11.5px/1 var(--mono)}.tr .d{font:400 11px/1 var(--mono);color:var(--muted-fg);text-align:right}
.tr.fail{color:var(--destructive)}
.tr.live{background:var(--selected)}
.ans{margin:4px 0 14px;font-size:14px;line-height:1.6}
.term{border-left:1px solid var(--border);display:flex;flex-direction:column;min-height:0;background:var(--card)}
.term-h{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted-fg)}
.term pre{flex:1;margin:0;padding:12px 14px;overflow:hidden;font:400 12px/1.55 var(--mono);white-space:pre-wrap}
.seg{display:inline-flex;padding:2px;border:1px solid var(--border);border-radius:8px}
.seg button{height:28px;padding:0 10px;border-radius:6px;font-size:13px;color:var(--muted-fg);display:inline-flex;align-items:center;gap:6px}
.seg button[aria-pressed=true]{background:var(--muted);color:var(--fg)}
`
const bTrace = (t, open) => {
  const counts = {}
  for (const w of t.work) counts[w.tool] = (counts[w.tool] || 0) + 1
  const chips = Object.entries(counts).map(([k, v]) => `<span class="chip">${k.toLowerCase()} ${v}</span>`).join('')
  const failed = t.work.filter((w) => w.fail).length
  return `<div data-group ${open ? 'data-open' : ''}><div class="trace"><button data-toggle>${ico('chevron', 11)}${t.work.length} steps</button>${chips}${failed ? `<span class="chip bad">${failed} failed</span>` : ''}<span>${t.live ? 'running' : t.duration}</span></div>
  <div class="tbl">${t.work.map((w) => `<div class="tr${w.fail ? ' fail' : ''}${w.running || w.subagent ? ' live' : ''}"><span class="t">${w.tool}</span><span class="trunc">${esc(w.label)}${w.subagent ? ` <span class="meta">· ${w.subagent.tools} tools</span>` : ''}</span><span class="d">${w.dur || w.elapsed || w.subagent?.elapsed || ''}</span>${w.running || w.subagent ? '<span class="pulse"></span>' : w.fail ? ico('x', 13) : `<span style="color:var(--muted-fg)">${ico('check', 13)}</span>`}</div>`).join('')}</div></div>`
}
const bEntries = turns.map((t, i) => `
  <div class="entry"><div class="gut">${t.time}</div><div>
    <div class="you"><span class="who">you${t.skill ? ' · /' + t.skill : ''}${t.image ? ' · 1 image' : ''}</span>${esc(t.user)}${t.user2 ? '<br>' + esc(t.user2) : ''}</div>
    ${t.lead ? `<div class="ans md">${t.lead}</div>` : ''}
    ${bTrace(t, i === 2)}
    ${t.answer ? `<div class="ans md">${t.answer}</div>` : ''}
  </div></div>`).join('')
const ledger = page('Ledger', bCss, `
  <div class="head"><h1 class="trunc">Session status check</h1><div class="meta">rex-fw / silent-brook · Claude Code</div><span class="sp"></span>
    <span class="state label"><span class="dot"></span>Working 6m 41s</span>
    <div class="seg" role="group" aria-label="Panels"><button aria-pressed="true">Conversation</button><button aria-pressed="true">${ico('panelRight', 14)}Terminal</button></div></div>
  <div class="split">
    <div class="view">
      <div class="strip"><span class="label">Agents</span><span class="pulse"></span><b>Research T3 Code agent UI</b><span class="meta mono">general-purpose · 4m 12s · 38 tools</span><span class="now">${ico('globe', 13)}WebSearch Codex app terminal toggle shortcut</span></div>
      <div class="log"><div class="anchor" style="padding:0 24px">${bEntries}</div></div>
    </div>
    <div class="term"><div class="term-h">${ico('terminal', 14)}<span>Terminal</span><span class="sp"></span><span class="meta">b2ab45</span></div>
<pre>  Preflight passed and I'm signed in to ai, so
  I'll capture the current UI as tile 0.

* Agent(Research T3 Code agent UI)
  | Backgrounded agent (down to manage)

  Capturing incumbent screenshots · 35s
  | $ node shot.mjs incumbent-conversation.png

* Imagining... (6m 41s · 3.1k tokens)

----------------------------------------
&gt;
----------------------------------------
  rex-browser · master · Opus 5.5
  auto mode on

  * main
  o general-purpose  Browsing T3 Code...</pre></div>
  </div>
  ${composer()}`)

// =====================================================================
// C · Turn cards: each turn is an object. The prompt heads the card; the work is a vertical step
// timeline (collapsed to one line once done); the answer is the body. Subagents nest as child cards.
// Terminal is a tab in the pane's own header, beside the title.
// =====================================================================
const cCss = `
.view{flex:1;min-height:0;overflow:hidden;background:var(--subtle);position:relative}
.stack{max-width:820px;margin:0 auto;padding:20px 24px 6px}
.tabs-h{display:flex;align-items:flex-end;gap:20px;height:52px;padding:0 24px;border-bottom:1px solid var(--border)}
.tabs-h h1{margin:0 8px 15px 0;font-size:18px;font-weight:500}
.tabs-h button{height:52px;display:inline-flex;align-items:center;gap:6px;font-size:13.5px;color:var(--muted-fg);border-bottom:2px solid transparent}
.tabs-h button[aria-current=true]{color:var(--fg);font-weight:500;border-color:var(--primary)}
.tabs-h .meta{margin:0 0 19px auto}
.card{margin:0 0 14px;border:1px solid var(--border);border-radius:10px;background:var(--card);box-shadow:var(--shadow)}
.prompt{display:flex;gap:10px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border)}
.you{flex:none;margin-top:1px;padding:3px 7px;border-radius:4px;background:var(--note);color:var(--note-fg);font:500 11px/1.2 var(--mono)}
.prompt .q{flex:1;font-size:14.5px;font-weight:500}
.prompt .q small{display:block;margin-top:4px;font:400 12px/1.4 var(--sans);color:var(--muted-fg)}
.prompt .meta{flex:none}
.card.done .steps-line{display:flex;align-items:center;gap:8px;padding:9px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted-fg)}
.body{padding:14px 16px;font-size:14px;line-height:1.6}
.card.folded .body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--muted-fg)}
.tl{position:relative;padding:12px 16px 4px 16px;border-bottom:1px solid var(--border)}
.st{position:relative;display:flex;align-items:center;gap:10px;min-height:28px;padding-left:28px;font-size:13px;color:var(--muted-fg)}
.st::before{content:'';position:absolute;left:9px;top:-6px;bottom:-6px;width:1px;background:var(--border)}
.st:first-child::before{top:14px}.st:last-child::before{bottom:14px}
.st .ic{position:absolute;left:0;top:50%;transform:translateY(-50%);width:19px;height:19px;display:grid;place-items:center;border-radius:50%;background:var(--card);border:1px solid var(--border);color:var(--muted-fg);z-index:1}
.st.ok .ic{color:var(--primary)}
.st.run .ic{border-color:var(--primary);color:var(--primary)}
.st .t{color:var(--fg);font:400 12px/1 var(--mono);min-width:36px}
.st .d{margin-left:auto;font:400 11px/1 var(--mono)}
.child{margin:4px 0 10px 28px;border:1px solid var(--border);border-radius:8px;background:var(--subtle)}
.child-h{display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:13px}
.child-h b{font-weight:500}.child-h .meta{margin-left:auto}
.child .st{padding-left:24px;margin:0 10px;min-height:24px;font-size:12.5px}
.child .st::before{left:6px}
.child .st .ic{width:13px;height:13px;border:0;background:none}
.child .tail{padding:0 0 8px}
.foot{display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:13px;color:var(--muted-fg)}
.shine{background:linear-gradient(90deg,var(--muted-fg) 0%,var(--fg) 50%,var(--muted-fg) 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 2.4s linear infinite}
@keyframes shine{to{background-position:-200% 0}}
`
const cStep = (w) => {
  if (w.subagent) {
    const s = w.subagent
    return `<div class="st run"><span class="ic">${ico('agent', 11)}</span><span class="t">Agent</span><span class="trunc" style="color:var(--fg)">${esc(w.label)}</span><span class="d">${s.elapsed}</span></div>
    <div class="child"><div class="child-h"><span class="pulse"></span><b>${s.type}</b><span class="meta">background · ${s.tools} tools</span></div>
    <div class="tail">${s.recent.slice(-3).map((r) => `<div class="st ok"><span class="ic">${ico(iconFor(r), 11)}</span><span class="trunc">${esc(r.label)}</span></div>`).join('')}
    <div class="st run"><span class="ic">${ico('globe', 11)}</span><span class="trunc shine">Searching ${esc(s.now.label)}</span></div></div></div>`
  }
  return `<div class="st ${w.running ? 'run' : w.fail ? 'fail' : 'ok'}"><span class="ic">${ico(w.fail ? 'x' : iconFor(w), 11)}</span><span class="t">${w.tool}</span><span class="trunc${w.running ? ' shine' : ''}">${esc(w.label)}</span><span class="d">${w.dur || w.elapsed || ''}</span></div>`
}
const cards = turns.map((t, i) => {
  const prompt = `<div class="prompt"><span class="you">YOU</span><div class="q">${esc(t.user)}${t.user2 ? `<small>${esc(t.user2)}</small>` : ''}${t.image ? `<small>${ico('image', 12)} ${esc(t.image)}</small>` : ''}${t.skill ? `<small>/${t.skill}</small>` : ''}</div><span class="meta">${t.time}</span></div>`
  if (t.live) return `<div class="card">${prompt}<div class="body md" style="border-bottom:1px solid var(--border)">${t.lead}</div><div class="tl">${t.work.map(cStep).join('')}</div><div class="foot"><span class="pulse"></span>Working for <span class="mono">${t.working}</span><span class="sp"></span><span class="meta">${t.work.length} steps · 1 agent</span></div></div>`
  return `<div class="card done${i === 0 ? ' folded' : ''}">${prompt}<div class="steps-line">${ico('chevron', 12)}${t.work.length} steps · ${summarize(t.work)}${t.work.some((w) => w.fail) ? ' · <span style="color:var(--destructive)">1 failed</span>' : ''}<span class="sp"></span><span class="meta">${t.duration}</span></div><div class="body md">${t.answer}</div></div>`
}).join('')
const turnCards = page('Turn Cards', cCss, `
  <div class="tabs-h"><h1 class="trunc">Session status check</h1><button aria-current="true">Conversation</button><button>${ico('terminal', 14)}Terminal</button><span class="meta">rex-fw / silent-brook · Claude Code</span></div>
  <div class="view"><div class="stack anchor">${cards}</div></div>
  ${composer()}`)

for (const [slug, html] of [['transcript-thread', thread], ['transcript-ledger', ledger], ['transcript-cards', turnCards]]) {
  fs.writeFileSync(path.join(here, `${slug}.html`), html)
  console.log('wrote', slug)
}
