#!/usr/bin/env node
// Builds the three Rex Browser direction mockups (self-contained HTML).
// Usage: node docs/design/tiles/build.mjs
// Tokens: Alephic Product system, registry revision 2 (docs/design/research/product-system.md).
// Host, session and tab names are real Rex metadata; terminal output is synthetic.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// Geist + Geist Mono (OFL), latin subset, embedded: the Intelligence viewer does not load remote fonts.
const fonts = fs.readFileSync(path.join(here, 'fonts.css'), 'utf8')

const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  enter: '<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>',
  keyboard:
    '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
}
const ico = (name, size = 16) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`

// Synthetic terminal output. Never real session contents.
const panes = [
  {
    id: '4be2a1',
    text: `# sample output, not a real session
$ pnpm test --filter bridge

 ok hosts › lists tagged peers             12ms
 ok sessions › keeps selection on refresh  31ms
 ok input › rejects a stale pane target     8ms
 ok input › keeps the draft on failure      5ms

 Test Files  4 passed (4)
      Tests  23 passed (23)
   Duration  1.84s

$ git status --short
 M public/client.js
 M server.ts
$ `,
    title: 'envoy: review loop',
  },
  {
    id: '9c07d3',
    text: `# sample output, not a real session
$ rex window ls
ID        NAME      PANES
7c1e4be2  wiki      1
a09f3d11  cleanup   1
52bb90c4  envoy     2

$ tail -f tmp/qa/runtime/server.log
listening on http://127.0.0.1:4317
GET /api/hosts   200  41ms
GET /api/blocks  200 118ms
GET /api/screen  200  64ms
GET /api/screen  200  59ms
`,
    title: 'zsh · ~/dev/envoy',
  },
]
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const term = (p) =>
  `<pre class="term" tabindex="0" aria-label="${p.title}">${esc(p.text)}<span class="cursor"></span></pre>`

const hosts = [
  {
    name: 'rex-spark',
    sessions: [
      { name: 'AI MCP', tabs: 8 },
      { name: 'AI-5490', tabs: 1 },
      { name: 'Backup Harness Sessions', tabs: 1 },
      { name: 'Canvas', tabs: 1 },
      { name: 'Speech Acts', tabs: 2 },
      {
        name: 'hidden-mesa',
        open: true,
        tabs: [
          ['wiki', 1],
          ['cleanup', 1],
          ['PR data', 1],
          ['Escalation Tuning', 1],
          ['Slack send', 1],
          ['PR 3277', 1],
          ['3271 Slack gate', 1],
          ['envoy', 2],
        ],
      },
    ],
  },
  {
    name: 'rex-mini',
    sessions: [
      { name: 'Unsessioned', tabs: 4 },
      { name: 'presentation-path-experiments', tabs: 1 },
    ],
  },
  {
    name: 'rex-mbp',
    sessions: [
      { name: 'polished-forest', tabs: 8 },
      { name: 'clayfuls', tabs: 1 },
    ],
  },
  { name: 'rex-fw', sessions: [] },
]
const mesa = hosts[0].sessions.find((s) => s.open).tabs

const base = `
*{box-sizing:border-box}
:root{
  --bg:#ffffff;--card:#ffffff;--fg:#231f20;--tray:#231f20;--tray-fg:#f4f4f2;--tray-muted:#a6aba7;--tray-edge:#231f20;
  --tray-active:#45bf55;--tray-active-fg:#0f1f12;--primary:#23602b;--primary-fg:#ffffff;--ring:#23602b;
  --note:#8fd999;--note-fg:#12301a;--muted-fg:#575c58;--muted:#e3e6e3;--border:#d3d8d4;--input:#858b86;
  --destructive:#b42318;--selected:#e4f1e5;
  --shadow-object:0 1px 2px rgb(35 31 32/.08),0 6px 16px -6px rgb(35 31 32/.18);
  --shadow-float:0 12px 32px -10px rgb(0 0 0/.55);
  --shadow-lifted:0 2px 4px rgb(35 31 32/.08),0 14px 28px -10px rgb(35 31 32/.28);
  --ease-out:cubic-bezier(0.23,1,0.32,1);--fast:150ms;
  --sans:'Geist',system-ui,sans-serif;--mono:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
[data-theme=dark]{
  --bg:#161515;--card:#211f20;--fg:#ededeb;--tray:#0b0a0a;--tray-fg:#ededeb;--tray-edge:#363334;
  --primary:#45bf55;--primary-fg:#0f1f12;--ring:#8fd999;--muted-fg:#a6aba7;--muted:#2a2829;--border:#363334;--input:#6e6b6c;
  --destructive:#ff8f8f;--selected:#1c2b1e;
  --shadow-object:0 1px 2px rgb(0 0 0/.4),0 6px 16px -6px rgb(0 0 0/.6);
  --shadow-lifted:0 2px 4px rgb(0 0 0/.4),0 14px 28px -10px rgb(0 0 0/.7);
}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 15px/1.5 var(--sans);-webkit-font-smoothing:antialiased;overflow:hidden;min-width:880px}
button,input,textarea{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0;padding:0}
button:active{transform:scale(.97)}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.mono{font-family:var(--mono)}
.label{font:400 11px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase}
kbd{font:400 11px/1 var(--mono);letter-spacing:.02em}
.term{margin:0;flex:1;min-height:0;overflow:auto;padding:12px 14px;font:400 13px/1.55 var(--mono);white-space:pre;background:var(--term-bg);color:var(--term-fg);outline-offset:-2px}
.cursor{display:inline-block;width:.6em;height:1.15em;vertical-align:text-bottom;background:var(--term-fg)}
.pane:not(.on) .cursor{background:none;box-shadow:inset 0 0 0 1px var(--term-fg)}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
@media (prefers-reduced-motion:reduce){*{transition:none!important}button:active{transform:none}}
`

const script = `
const root=document.documentElement;
const q=new URLSearchParams(location.search).get('theme');if(q)root.dataset.theme=q;
document.querySelectorAll('[data-toggle-theme]').forEach(b=>b.onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'});
document.querySelectorAll('.pane').forEach(p=>{const pick=()=>{document.querySelectorAll('.pane').forEach(o=>o.classList.toggle('on',o===p));document.querySelectorAll('[data-dest]').forEach(d=>d.textContent=p.dataset.title);document.querySelectorAll('[data-dest-id]').forEach(d=>d.textContent=p.dataset.id)};p.addEventListener('focusin',pick);p.addEventListener('click',pick)});
const sw=document.querySelector('[data-switcher]');
document.querySelectorAll('[data-open-switcher]').forEach(b=>b.onclick=()=>{sw.hidden=!sw.hidden;b.setAttribute('aria-expanded',String(!sw.hidden))});
if(sw)document.addEventListener('keydown',e=>{if(e.key==='Escape')sw.hidden=true});
document.querySelectorAll('[data-typing]').forEach(b=>b.onclick=()=>{const g=b.closest('[data-typing-group]');g.querySelectorAll('[data-typing]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));document.body.classList.toggle('typing',b.dataset.typing==='on')});
`

const page = (title, theme, css, body) => `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${fonts}${base}${css}</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>
`

// ---------------------------------------------------------------- A · Ink Stage
const inkStage = page(
  'Ink Stage',
  'dark',
  `
body{--term-bg:#161515;--term-fg:#ededeb;background:#161515;color:#ededeb;display:flex;flex-direction:column}
.stage{flex:1;min-height:0;display:grid;grid-template-columns:58fr 42fr;gap:1px;background:#363334;padding-bottom:84px;background-clip:content-box}
.pane{display:flex;flex-direction:column;min-width:0;min-height:0;background:#161515;box-shadow:inset 0 2px 0 transparent}
.pane.on{box-shadow:inset 0 2px 0 var(--tray-active)}
.pane header{display:flex;gap:10px;align-items:center;height:28px;padding:0 14px;color:#a6aba7;font:400 11px/1 var(--mono);letter-spacing:.04em}
.pane.on header{color:#ededeb}
.pane header .id{margin-left:auto}
.tray{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(1040px,calc(100% - 32px));display:flex;align-items:center;gap:4px;height:52px;padding:8px;border-radius:12px;background:#0b0a0a;border:1px solid #363334;box-shadow:var(--shadow-float);color:#ededeb}
.tb{height:36px;display:inline-flex;align-items:center;gap:8px;padding:0 10px;border-radius:8px;color:#ededeb;font-size:13px;white-space:nowrap;transition:background-color var(--fast) var(--ease-out)}
.tb:hover{background:#211f20}
.tb kbd{color:#a6aba7}
.crumb{font:400 12px/1 var(--mono)}
.crumb .sep{color:#6e6b6c}
.crumb b{font-weight:500}
.rule{width:1px;height:20px;background:#363334;margin:0 4px}
.dest{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:4px;background:#211f20;color:#8fd999;font:400 11px/1 var(--mono);letter-spacing:.04em;white-space:nowrap}
.say{flex:1;min-width:0;height:36px;background:none;border:0;outline:0;font:400 13px/1 var(--mono);color:#ededeb;padding:0 8px}
.say::placeholder{color:#a6aba7}
.send{background:var(--tray-active);color:var(--tray-active-fg);font-weight:500}
.send:hover{background:#5fcf6d}
.send kbd{color:#0f1f12}
.tb[aria-pressed=true]{background:var(--tray-active);color:var(--tray-active-fg)}
.live{padding:0 10px;color:#a6aba7}
.switcher{position:fixed;left:max(16px,calc(50% - 520px));bottom:80px;width:480px;max-height:calc(100% - 112px);display:flex;flex-direction:column;border-radius:12px;background:var(--card);color:var(--fg);border:1px solid var(--border);box-shadow:var(--shadow-float);overflow:hidden}
.switcher[hidden]{display:none}
.find{display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border-bottom:1px solid var(--border);color:var(--muted-fg)}
.find input{flex:1;border:0;outline:0;background:none;font-size:14px;color:var(--fg)}
.find input::placeholder{color:var(--muted-fg)}
.list{overflow:auto;padding:6px}
.grp{display:flex;justify-content:space-between;padding:12px 8px 6px;color:var(--muted-fg)}
.row{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px;border-radius:4px;font-size:13px;text-align:left}
.row:hover{background:var(--muted)}
.row .s{color:var(--muted-fg)}
.row .n{margin-left:auto;color:var(--muted-fg);font:400 11px/1 var(--mono)}
.row.on{background:var(--selected);box-shadow:inset 2px 0 0 var(--primary);font-weight:500}
`,
  `<main class="stage" aria-label="Terminal panes">
${panes.map((p, i) => `<section class="pane${i === 0 ? ' on' : ''}" data-title="${p.title}" data-id="${p.id}"><header><span class="trunc">${p.title}</span><span class="id">${p.id}</span></header>${term(p)}</section>`).join('\n')}
</main>
<div class="switcher" data-switcher role="dialog" aria-label="Switch tab">
  <label class="find">${ico('search')}<input placeholder="Find a computer, session or tab" aria-label="Find a computer, session or tab"><kbd>ESC</kbd></label>
  <div class="list">
    <div class="grp label"><span>rex-spark · hidden-mesa</span><span>8 tabs</span></div>
    ${mesa.map(([n, c]) => `<button class="row${n === 'envoy' ? ' on' : ''}">${ico('terminal')}<span class="trunc">${n}</span><span class="n">${c} ${c > 1 ? 'panes' : 'pane'}</span></button>`).join('')}
    <div class="grp label"><span>Other sessions</span><span>11</span></div>
    ${[
      ['rex-spark', 'AI MCP', 8],
      ['rex-spark', 'Speech Acts', 2],
      ['rex-mini', 'Unsessioned', 4],
      ['rex-mbp', 'polished-forest', 8],
    ]
      .map(
        ([h, s, c]) =>
          `<button class="row">${ico('monitor')}<span class="s">${h}</span><span class="trunc">${s}</span><span class="n">${c} tabs</span></button>`,
      )
      .join('')}
  </div>
</div>
<div class="tray" role="toolbar" aria-label="Rex">
  <button class="tb crumb" data-open-switcher aria-expanded="true">${ico('monitor', 17)}<span>rex-spark <span class="sep">/</span> hidden-mesa <span class="sep">/</span> <b>envoy</b></span><kbd>Ctrl+K</kbd></button>
  <span class="rule"></span>
  <span class="dest">${ico('arrow', 12)}<span data-dest-id>4be2a1</span></span>
  <input class="say" placeholder="Send text to the selected pane" aria-label="Text to send to the selected pane">
  <button class="tb send">Send <kbd>Ctrl+Enter</kbd></button>
  <span class="rule"></span>
  <span data-typing-group style="display:contents"><button class="tb" data-typing="on" aria-pressed="false" aria-label="Direct typing">${ico('keyboard', 17)}</button></span>
  <button class="tb" aria-label="New tab">${ico('plus', 17)}</button>
  <button class="tb" data-toggle-theme aria-label="Switch theme">${ico('sun', 17)}</button>
  <span class="live label">Live</span>
</div>`,
)

// ---------------------------------------------------------------- B · Session Rail
const rail = hosts
  .map((h) => {
    const head = `<div class="host label"><span class="dot${h.sessions.length ? '' : ' off'}"></span><span>${h.name}</span><span class="n">${h.sessions.length ? `${h.sessions.length} sessions` : 'no sessions'}</span></div>`
    const rows = h.sessions
      .map((s) => {
        const open = Array.isArray(s.tabs)
        const count = open ? s.tabs.length : s.tabs
        const tabs = open
          ? `<div class="tabs">${s.tabs.map(([n, c]) => `<button class="tab${n === 'envoy' ? ' on' : ''}"><span class="trunc">${n}</span>${c > 1 ? `<span class="n">${c}</span>` : ''}</button>`).join('')}<button class="tab new">${ico('plus', 12)}<span>New tab</span></button></div>`
          : ''
        return `<button class="sess${open ? ' open' : ''}" aria-expanded="${open}">${ico(open ? 'down' : 'chevron', 12)}<span class="trunc">${s.name}</span><span class="n">${count}</span></button>${tabs}`
      })
      .join('')
    return head + rows
  })
  .join('')

const sessionRail = page(
  'Session Rail',
  'light',
  `
body{--term-bg:var(--card);--term-fg:var(--fg);display:grid;grid-template-columns:272px minmax(0,1fr)}
aside{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:8px;height:52px;padding:0 12px 0 16px;font-weight:500;font-size:15px}
.brand .sp{flex:1}
.ib{width:36px;height:36px;display:inline-grid;place-items:center;border-radius:8px;color:var(--muted-fg);transition:background-color var(--fast) var(--ease-out)}
.ib:hover{background:var(--muted);color:var(--fg)}
.filter{display:flex;align-items:center;gap:8px;height:36px;margin:0 12px 8px;padding:0 10px;border:1px solid var(--input);border-radius:4px;color:var(--muted-fg);background:var(--card)}
.filter input{flex:1;min-width:0;border:0;outline:0;background:none;font-size:13px}
.filter input::placeholder{color:var(--muted-fg)}
.filter:focus-within{outline:2px solid var(--ring);outline-offset:1px}
.tree{flex:1;overflow:auto;padding:0 8px 16px}
.host{display:flex;align-items:center;gap:8px;padding:16px 8px 8px;color:var(--muted-fg)}
.host .n,.sess .n,.tab .n{margin-left:auto;font:400 11px/1 var(--mono);color:var(--muted-fg);letter-spacing:.02em;text-transform:none}
.dot{width:6px;height:6px;border-radius:50%;background:var(--primary)}
.dot.off{background:none;box-shadow:inset 0 0 0 1px var(--input)}
.sess,.tab{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 8px;border-radius:4px;font-size:13px;text-align:left;transition:background-color var(--fast) var(--ease-out)}
.sess{font-weight:500}
.sess svg{color:var(--muted-fg);flex:none}
.sess:hover,.tab:hover{background:var(--muted)}
.tabs{margin:2px 0 6px 13px;padding-left:8px;border-left:1px solid var(--border)}
.tab.on{background:var(--selected);box-shadow:inset 2px 0 0 var(--primary);font-weight:500;border-radius:0 4px 4px 0}
.tab.new{color:var(--muted-fg)}
main{display:flex;flex-direction:column;min-width:0;min-height:0}
.head{display:flex;align-items:center;gap:16px;height:52px;padding:0 16px 0 20px;border-bottom:1px solid var(--border)}
.head h1{margin:0;font-size:18px;font-weight:500;letter-spacing:-.01em}
.meta{display:flex;gap:6px;align-items:center;color:var(--muted-fg);font:400 12px/1 var(--mono)}
.meta i{font-style:normal;color:var(--border)}
.head .sp{flex:1}
.seg{display:inline-flex;padding:2px;border:1px solid var(--border);border-radius:8px}
.seg button{height:30px;padding:0 12px;border-radius:6px;font-size:13px;color:var(--muted-fg)}
.seg button[aria-pressed=true]{background:var(--tray);color:var(--tray-fg);box-shadow:0 0 0 1px var(--tray-edge)}
.live{color:var(--primary);display:inline-flex;gap:6px;align-items:center}
.work{flex:1;min-height:0;display:grid;grid-template-columns:58fr 42fr;gap:12px;padding:16px 20px}
.pane{display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid var(--border);border-radius:8px;background:var(--card);overflow:hidden}
.pane.on{outline:2px solid var(--primary);outline-offset:2px}
.pane header{display:flex;align-items:center;gap:10px;height:34px;padding:0 12px;border-bottom:1px solid var(--border);font-size:13px;font-weight:500}
.pane header .id{margin-left:auto;font:400 11px/1 var(--mono);color:var(--muted-fg);letter-spacing:.04em}
.composer{padding:12px 20px 14px;border-top:1px solid var(--border)}
.to{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:var(--muted-fg)}
.to b{color:var(--fg);font-weight:500}
.to .id{font:400 11px/1 var(--mono);letter-spacing:.04em}
.to .ok{margin-left:auto}
.field{display:flex;gap:10px;align-items:stretch}
.field textarea{flex:1;min-width:0;height:60px;resize:none;padding:9px 12px;border:1px solid var(--input);border-radius:4px;background:var(--card);font:400 13px/1.5 var(--mono)}
.field textarea::placeholder{color:var(--muted-fg)}
.go{align-self:flex-end;height:40px;display:inline-flex;align-items:center;gap:10px;padding:0 14px;border-radius:8px;background:var(--primary);color:var(--primary-fg);font-size:14px;font-weight:500}
.go kbd{opacity:1}
`,
  `<aside aria-label="Rex sessions">
  <div class="brand"><span>Rex</span><span class="sp"></span><button class="ib" data-toggle-theme aria-label="Switch theme">${ico('sun')}</button><button class="ib" aria-label="Refresh computers">${ico('refresh')}</button></div>
  <label class="filter">${ico('search', 14)}<input placeholder="Filter" aria-label="Filter sessions and tabs"></label>
  <nav class="tree">${rail}</nav>
</aside>
<main>
  <div class="head">
    <h1>envoy</h1>
    <div class="meta"><span>rex-spark</span><i>/</i><span>hidden-mesa</span><i>/</i><span>2 panes</span></div>
    <span class="sp"></span>
    <span class="live label"><span class="dot"></span>Live</span>
    <div class="seg" data-typing-group role="group" aria-label="Keyboard input"><button data-typing="off" aria-pressed="true">Read only</button><button data-typing="on" aria-pressed="false">Direct typing</button></div>
  </div>
  <div class="work" aria-label="Terminal panes">
${panes.map((p, i) => `<section class="pane${i === 0 ? ' on' : ''}" data-title="${p.title}" data-id="${p.id}"><header><span class="trunc">${p.title}</span><span class="id">${p.id}</span></header>${term(p)}</section>`).join('\n')}
  </div>
  <div class="composer">
    <div class="to"><span>Send to</span><b data-dest>envoy: review loop</b><span class="id" data-dest-id>4be2a1</span><span class="ok" role="status">Sent to Rex.</span></div>
    <div class="field"><textarea placeholder="Text or command" aria-label="Text or command to send"></textarea><button class="go">Send <kbd>Ctrl+Enter</kbd></button></div>
  </div>
</main>`,
)

// ---------------------------------------------------------------- C · Tab Deck
const face = `<span class="face" aria-hidden="true"><i style="width:60%"></i><i style="width:85%"></i><i style="width:40%"></i><i style="width:70%"></i></span>`
const tabDeck = page(
  'Tab Deck',
  'light',
  `
body{--term-bg:#161515;--term-fg:#ededeb;display:flex;flex-direction:column}
[data-theme=dark] body{--term-bg:#0b0a0a}
.tray{display:flex;align-items:center;gap:4px;height:52px;margin:12px 12px 0;padding:8px;border-radius:12px;background:var(--tray);color:var(--tray-fg);border:1px solid var(--tray-edge);box-shadow:var(--shadow-float)}
.tb{height:36px;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border-radius:8px;font-size:13px;white-space:nowrap;color:var(--tray-fg);transition:background-color var(--fast) var(--ease-out)}
.tb:hover{background:#363334}
.tb.on{background:var(--tray-active);color:var(--tray-active-fg);font-weight:500}
.tb.off{color:var(--tray-muted)}
.tb .n{font:400 11px/1 var(--mono);color:var(--tray-muted)}
.rule{width:1px;height:20px;background:#4a4647;margin:0 6px}
.sp{flex:1}
.live{padding:0 10px;color:var(--tray-muted)}
.deck{display:flex;gap:12px;padding:16px 16px 6px;overflow-x:auto}
.obj{flex:none;display:flex;align-items:center;gap:10px;width:176px;height:60px;padding:7px 10px 7px 7px;border:1px solid var(--border);border-radius:8px;background:var(--card);box-shadow:var(--shadow-object);text-align:left;transition:transform var(--fast) var(--ease-out)}
.obj.on{outline:2px solid var(--primary);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-lifted)}
.face{flex:none;display:flex;flex-direction:column;gap:4px;justify-content:center;width:60px;height:44px;padding:0 7px;border-radius:4px;background:var(--term-bg)}
.face i{height:2px;border-radius:1px;background:#6e6b6c}
.obj b{display:block;font-size:13px;font-weight:500}
.obj small{display:block;margin-top:3px;font:400 11px/1 var(--mono);color:var(--muted-fg);letter-spacing:.02em}
.obj .t{min-width:0}
.work{flex:1;min-height:0;display:grid;grid-template-columns:58fr 42fr;gap:16px;padding:14px 16px 92px}
.pane{display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid var(--border);border-radius:8px;background:var(--card);box-shadow:var(--shadow-object);overflow:hidden;transition:transform var(--fast) var(--ease-out)}
.pane.on{outline:2px solid var(--primary);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-lifted)}
.pane footer{display:flex;align-items:center;gap:10px;height:38px;padding:0 10px;font-size:13px;font-weight:500}
.kind{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px;border-radius:4px;background:var(--muted);color:var(--fg);font-weight:400}
.pane footer .id{margin-left:auto;font:400 11px/1 var(--mono);color:var(--muted-fg);letter-spacing:.04em}
.yours{display:none;height:22px;align-items:center;padding:0 7px;border-radius:4px;background:var(--note);color:var(--note-fg);font-weight:400}
.typing .pane.on .yours{display:inline-flex}
.send{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(760px,calc(100% - 32px));margin:0}
.dest{display:inline-flex;align-items:center;gap:6px;height:24px;max-width:220px;padding:0 8px;border-radius:4px;background:var(--note);color:var(--note-fg);font-size:12px;font-weight:500;white-space:nowrap}
.say{flex:1;min-width:0;height:36px;background:none;border:0;outline:0;font:400 13px/1 var(--mono);color:var(--tray-fg);padding:0 8px}
.say::placeholder{color:var(--tray-muted)}
.tb[aria-pressed=true]{background:var(--tray-active);color:var(--tray-active-fg)}
.tb.on kbd{color:var(--tray-active-fg)}
`,
  `<div class="tray" role="toolbar" aria-label="Rex">
  <button class="tb on">rex-spark</button><button class="tb">rex-mini</button><button class="tb">rex-mbp</button><button class="tb off" aria-disabled="true">rex-fw</button>
  <span class="rule"></span>
  <button class="tb">hidden-mesa <span class="n">8 tabs</span>${ico('down', 14)}</button>
  <span class="sp"></span>
  <button class="tb">${ico('plus', 17)}New tab</button>
  <button class="tb" aria-label="Refresh">${ico('refresh', 17)}</button>
  <button class="tb" data-toggle-theme aria-label="Switch theme">${ico('sun', 17)}</button>
  <span class="live label">Live</span>
</div>
<nav class="deck" aria-label="Tabs in hidden-mesa">
${[...mesa]
  .reverse()
  .map(
    ([n, c]) =>
      `<button class="obj${n === 'envoy' ? ' on' : ''}">${face}<span class="t"><b class="trunc">${n}</b><small>${c} ${c > 1 ? 'panes' : 'pane'}</small></span></button>`,
  )
  .join('\n')}
</nav>
<main class="work" aria-label="Terminal panes">
${panes.map((p, i) => `<section class="pane${i === 0 ? ' on' : ''}" data-title="${p.title}" data-id="${p.id}">${term(p)}<footer><span class="kind label">${ico('terminal', 12)}Terminal</span><span class="trunc">${p.title}</span><span class="yours label">Typing</span><span class="id">${p.id}</span></footer></section>`).join('\n')}
</main>
<div class="tray send" role="group" aria-label="Send to pane">
  <span class="dest">${ico('arrow', 12)}<span class="trunc" data-dest>envoy: review loop</span></span>
  <input class="say" placeholder="Text or command" aria-label="Text or command to send">
  <span data-typing-group style="display:contents"><button class="tb" data-typing="on" aria-pressed="false" aria-label="Direct typing">${ico('keyboard', 17)}</button></span>
  <button class="tb on">Send <kbd>Ctrl+Enter</kbd></button>
</div>`,
)

for (const [slug, html] of [
  ['ink-stage', inkStage],
  ['session-rail', sessionRail],
  ['tab-deck', tabDeck],
]) {
  fs.writeFileSync(path.join(here, `${slug}.html`), html)
  console.log('wrote', `${slug}.html`, html.length)
}
