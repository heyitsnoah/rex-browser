import { writeFileSync } from 'node:fs'

const css = `
:root{--bg:#fff;--fg:#231f20;--muted:#575c58;--border:#d3d8d4;--subtle:#f3f5f3;--note:#e1f3e3;--primary:#23602b;--pfg:#fff;--card:#fff;--tray:#231f20;--trayfg:#f4f4f2;--warn:#8a5a00}
.dark{--bg:#161a17;--fg:#ecefec;--muted:#a3aaa4;--border:#2f3631;--subtle:#1e2420;--note:#22392a;--primary:#6fbf7a;--pfg:#0f1a11;--card:#1b201c;--tray:#0e110f;--trayfg:#e6e9e6;--warn:#e0b25a}
*{box-sizing:border-box}body{margin:0;background:#eef0ee;font:15px/1.5 Geist,system-ui,sans-serif;color:#231f20;padding:28px 24px 48px}
h1{font-size:22px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}.thesis{color:#575c58;margin:0 0 6px;max-width:72ch}.not{color:#575c58;font-size:13px;margin:0 0 22px}
.modes{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:1200px){.modes{grid-template-columns:1fr}}
.frame{background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.mlabel{font:11px Geist Mono,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:10px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.step{padding:18px 22px;border-bottom:1px dashed var(--border)}.step:last-child{border-bottom:0}
.stepn{font:11px Geist Mono,monospace;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px}
.mono{font-family:Geist Mono,ui-monospace,monospace}.meta{font:12px Geist Mono,monospace;color:var(--muted)}
.you{margin-left:auto;max-width:80%;background:var(--note);border-radius:14px;padding:8px 14px;width:fit-content}
.said{max-width:62ch;margin:10px 0}
.row{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14px;margin:8px 0}
.composer{border:1px solid var(--border);border-radius:12px;background:var(--card);padding:10px 12px}
.dest{font-size:12.5px;color:var(--muted);margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap}.dest b{color:var(--fg);font-weight:500}
.send{margin-left:auto;background:var(--primary);color:var(--pfg);border-radius:8px;padding:5px 12px;font-size:13px}
.term{background:var(--tray);color:var(--trayfg);border-radius:8px;padding:10px 12px;font:12.5px/1.55 Geist Mono,monospace;white-space:pre-wrap}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:2px 10px;font:12px Geist Mono,monospace;color:var(--muted)}
.dot{width:7px;height:7px;border-radius:50%;background:var(--primary);display:inline-block}
.btn{border:1px solid var(--border);border-radius:8px;padding:3px 10px;font-size:13px;background:var(--card);color:var(--fg)}
.rex{width:20px;height:20px;border-radius:5px;background:#23602b;color:#fff;font:600 10px Geist Mono,monospace;display:grid;place-items:center;flex:none}
.rexmark{color:#9be3a6}
.card{border:1px solid var(--border);border-radius:10px;background:var(--subtle);overflow:hidden}
.cardh{display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:13.5px;border-bottom:1px solid var(--border)}
.handoff{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin:8px 0 0 28px}
.prefix{font:12px Geist Mono,monospace;background:var(--tray);color:var(--trayfg);border-radius:6px;padding:2px 7px}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);margin:-18px -22px 14px;padding:0 12px;font-size:13px}
.tabs span{padding:8px 12px;color:var(--muted)}.tabs .on{color:var(--fg);border-bottom:2px solid var(--primary)}
`
const AUTH = `$ gh auth refresh -h github.com -s workflow
! First copy your one-time code: 4F2A-91C7
Press Enter to open github.com in your browser...`
function page(o) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${o.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap" rel="stylesheet"><style>${css}</style></head><body>
<h1>${o.title}</h1><p class="thesis">${o.thesis}</p><p class="not"><b>Not:</b> ${o.not}</p>
<div class="modes">${['', 'dark'].map((m) => `<div class="frame ${m}"><div class="mlabel"><span>${m ? 'Dark' : 'Light'}</span><span>rex-fw · Claude Code · ~/dev/01_Projects/rex-browser</span></div>${o.steps}</div>`).join('')}</div></body></html>`
}
const step = (n, label, body) =>
  `<div class="step"><div class="stepn">${n} · ${label}</div>${body}</div>`

const A = page({
  not: "a new participant, a new place to look, or anything the agent doesn't already show for its own commands.",
  steps:
    step(
      1,
      'Composer in ! mode',
      `<div class="composer"><div class="dest">Run in a new Rex tab on <b>rex-fw</b> · <span class="mono">~/dev/01_Projects/rex-browser</span></div><div class="mono" style="font-size:14px"><span style="color:var(--muted)">$</span> gh auth refresh -h github.com -s workflow</div><div style="display:flex;margin-top:8px"><span class="meta">Output goes to Claude Code when it ends</span><span class="send">Run ↵</span></div></div>`,
    ) +
    step(
      2,
      'Running',
      `<div class="you mono">! gh auth refresh -h github.com -s workflow</div><div class="card" style="margin-top:12px"><div class="cardh"><span class="dot"></span>Running in tab <b class="mono" style="font-weight:500">! gh auth refresh</b><span class="meta" style="margin-left:auto">0:18</span><span class="btn">Open tab</span></div><div class="term" style="border-radius:0">${AUTH}</div></div>`,
    ) +
    step(
      3,
      'Finished · handed back',
      `<div class="you mono">! gh auth refresh -h github.com -s workflow</div><div class="row">› Ran <span class="mono">gh auth refresh</span> · exit 0 · 41s</div><div class="meta" style="margin:-4px 0 8px 14px">Output sent to Claude Code</div><p class="said">Thanks, the token has the workflow scope now. Pushing the branch and opening the PR.</p>`,
    ),
  thesis:
    'The command is just another step in the thread: a live card while it runs, then the same folded row every tool call uses. The output line says where it went.',
  title: 'A · Inline run',
})

const B = page({
  not: "output inside the conversation; the thread stays the agent's, the tab is yours.",
  steps:
    step(
      1,
      'Composer in ! mode',
      `<div class="composer"><div class="dest">Opens a new tab <b class="mono" style="font-weight:500">! gh auth refresh</b> on <b>rex-fw</b></div><div class="mono" style="font-size:14px">!gh auth refresh -h github.com -s workflow</div><div style="display:flex;margin-top:8px"><span class="meta">Opens and focuses the tab</span><span class="send">Open tab ↵</span></div></div>`,
    ) +
    step(
      2,
      'Running · tab in front',
      `<div class="tabs"><span>rex-browser</span><span class="on"><span class="dot"></span> ! gh auth refresh</span></div><div class="term">${AUTH}\n<span style="opacity:.6">▍</span></div><div class="meta" style="margin-top:8px">Claude Code gets the output when this ends · <u>Back to conversation</u></div>`,
    ) +
    step(
      3,
      'Finished · receipt in thread',
      `<div class="row"><span class="pill"><span class="dot"></span>tab ! gh auth refresh · exit 0 · 41s</span><span>3 lines sent to Claude Code</span><span class="btn" style="margin-left:auto">Open tab</span></div><p class="said">Thanks, the token has the workflow scope now. Pushing the branch and opening the PR.</p>`,
    ),
  thesis:
    'The Rex tab is the unit. ! opens the tab and brings it forward so you can answer prompts there; the thread keeps only a slim status line and a receipt.',
  title: 'B · Tab-first',
})

const C = page({
  not: "output disguised as the agent's own tool call; Rex's work is labeled Rex.",
  steps:
    step(
      1,
      'Composer in ! mode',
      `<div class="composer"><div class="dest"><span class="rex" style="width:16px;height:16px;font-size:8px">&gt;_</span><b>Rex</b> runs this on rex-fw, then hands the output to <b>Claude Code</b></div><div style="display:flex;align-items:center;gap:8px"><span class="prefix">rex !</span><span class="mono" style="font-size:14px">gh auth refresh -h github.com -s workflow</span></div><div style="display:flex;margin-top:8px"><span class="meta">Shift+Enter: run without handing back</span><span class="send">Run ↵</span></div></div>`,
    ) +
    step(
      2,
      'Running · answer inline',
      `<div style="display:flex;gap:8px"><span class="rex">&gt;_</span><div style="flex:1"><div style="font-size:13.5px;margin-bottom:6px"><b style="font-weight:500">Rex</b> <span class="meta">running in tab ! gh auth refresh · 0:18</span></div><div class="card"><div class="term" style="border-radius:0">${AUTH}</div><div class="cardh" style="border-top:1px solid var(--border);border-bottom:0"><span class="meta">Waiting for input</span><span class="btn" style="margin-left:auto">Press Enter</span><span class="btn">Type…</span><span class="btn">Open tab</span></div></div></div></div>`,
    ) +
    step(
      3,
      'Finished · visible hand-off',
      `<div style="display:flex;gap:8px"><span class="rex">&gt;_</span><div style="flex:1"><div class="row" style="margin:0"><b style="font-weight:500;color:var(--fg)">Rex</b> ran <span class="mono">gh auth refresh</span> · exit 0 · 41s · <u>3 lines</u></div><div class="handoff" style="margin-left:0">→ handed to <b style="color:var(--fg);font-weight:500">Claude Code</b></div></div></div><p class="said">Thanks, the token has the workflow scope now. Pushing the branch and opening the PR.</p>`,
    ),
  thesis:
    'Rex becomes a participant in the thread, with its own mark, next to you and the agent. It runs the command, shows it live, lets you answer prompts inline, and visibly hands the result to the agent. Step one of Rex as the harness.',
  title: 'C · Rex speaks',
})
writeFileSync('a-inline-run.html', A)
writeFileSync('b-tab-first.html', B)
writeFileSync('c-rex-speaks.html', C)
