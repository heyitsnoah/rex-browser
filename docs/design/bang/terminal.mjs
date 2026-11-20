import { readFileSync, writeFileSync } from 'node:fs'

const css = readFileSync('build.mjs', 'utf8').match(
  /const css = `([\s\S]*?)`/,
)[1]
const url =
  '<a href="https://github.com/login/device" style="color:#9be3a6">https://github.com/login/device</a>'
const step = (n, label, body) =>
  `<div class="step"><div class="stepn">${n} · ${label}</div>${body}</div>`
const steps =
  step(
    1,
    'Type ! in the box — it becomes a terminal line',
    `<div class="composer" style="background:var(--tray);border-color:var(--tray)"><div class="dest" style="color:#a9b0aa">Terminal · <b style="color:#f4f4f2">rex-fw</b> · <span class="mono">~/dev/01_Projects/rex-browser</span></div><div class="mono" style="font-size:14px;color:#f4f4f2"><span style="color:#9be3a6">$</span> gh auth refresh -h github.com -s workflow<span style="opacity:.6">▍</span></div><div style="display:flex;margin-top:8px;align-items:center"><span class="meta" style="color:#a9b0aa">Output goes to Claude Code when it finishes · Backspace past $ to leave</span><span class="send" style="background:#6fbf7a;color:#0f1a11">Run ↵</span></div></div>`,
  ) +
  step(
    2,
    'Running — a live terminal in the thread; answer prompts right there',
    `<div class="term" style="border-radius:10px;padding:0;overflow:hidden;white-space:normal"><div style="display:flex;gap:8px;align-items:center;padding:7px 12px;border-bottom:1px solid #3a403b;font-size:12px;color:#a9b0aa"><span class="dot" style="background:#6fbf7a"></span>Running · 0:18<span style="margin-left:auto;text-decoration:underline">Open full terminal</span></div><div style="padding:10px 12px"><div>$ gh auth refresh -h github.com -s workflow</div><div>! First copy your one-time code: 4F2A-91C7</div><div>Press Enter to open ${url} in your browser...</div></div><div style="display:flex;gap:8px;align-items:center;padding:7px 12px;border-top:1px solid #3a403b"><span style="color:#9be3a6">›</span><span style="color:#7d847e">Type here, Enter sends to this terminal</span></div></div>`,
  ) +
  step(
    3,
    'Finished — folds to one line; the agent has the output',
    `<div class="row" style="margin:0"><span class="mono" style="color:var(--fg)">$ gh auth refresh -h github.com -s workflow</span><span>· exit 0 · 41s</span><span style="margin-left:auto">›</span></div><div class="meta" style="margin:2px 0 10px">Sent to Claude Code</div><p class="said">Thanks, the token has the workflow scope now. Pushing the branch and opening the PR.</p>`,
  )
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>! runs in a terminal</title><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap" rel="stylesheet"><style>${css}</style></head><body>
<h1>! runs in a terminal</h1><p class="thesis">Start a message with ! and the box turns into a terminal line. The command runs in a real terminal next to the agent (same computer, same folder), shows live in the thread, takes your typing when it asks for something, and when it ends the output goes to the agent.</p><p class="not"><b>Not:</b> a new character in the conversation, or a trip to another tab. The terminal is the thing; what runs it stays out of sight.</p>
<div class="modes">${['', 'dark'].map((m) => `<div class="frame ${m}"><div class="mlabel"><span>${m ? 'Dark' : 'Light'}</span><span>rex-fw · Claude Code</span></div>${steps}</div>`).join('')}</div></body></html>`
writeFileSync('d-terminal.html', html)
