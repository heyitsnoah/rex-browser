// Agent conversation view (direction A · Thread, docs/design/DECISIONS.md 2026-11-20).
// Messages: yours as Mint bubbles, the agent's as Markdown rendered by @pierre/words (vendored)
// and sanitized here. Runs of tool calls fold into one summary line. Subagents get a live row
// with their latest steps nested under it.
import {renderToHtml} from './vendor/words/no-math.js';

const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  chevron: 'm9 18 6-6-6-6',
  command: 'm4 17 6-6-6-6M12 19h8',
  read: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  agent: 'M7 7h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM12 3v4M9 13h.01M15 13h.01',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  check: 'm5 12 5 5L20 7',
  x: 'M18 6 6 18M6 6l12 12',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM21 16l-5-5-9 9',
};
function icon(name, size = 14) {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'})) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', PATHS[name]); svg.append(path);
  return svg;
}
function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(c => c !== null && c !== undefined && c !== false));
  return node;
}

// ---- Markdown: Words renders, then an allow-list keeps only inert elements and safe links ----
const ALLOWED = new Set(['P','BR','HR','STRONG','EM','B','I','DEL','S','CODE','PRE','BLOCKQUOTE','UL','OL','LI','A','H1','H2','H3','H4','H5','H6','TABLE','THEAD','TBODY','TR','TH','TD','SPAN','INPUT']);
const decoder = new TextDecoder();
const mdCache = new Map();
function clean(node) {
  for (const child of [...node.children]) {
    if (!ALLOWED.has(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent)); continue; }
    for (const attr of [...child.attributes]) {
      const keep = (child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:|#)/i.test(attr.value.trim()))
        || (child.tagName === 'INPUT' && (attr.name === 'type' && attr.value === 'checkbox' || attr.name === 'checked' || attr.name === 'disabled'))
        || ((child.tagName === 'TH' || child.tagName === 'TD') && attr.name === 'align')
        || (attr.name === 'class' && child.tagName === 'CODE' && /^language-[\w-]+$/.test(attr.value));
      if (!keep) child.removeAttribute(attr.name);
    }
    if (child.tagName === 'INPUT') child.disabled = true;
    if (child.tagName === 'A') { child.target = '_blank'; child.rel = 'noopener noreferrer'; }
    clean(child);
  }
}
function markdown(text) {
  let html = mdCache.get(text);
  if (html === undefined) {
    try {
      const template = document.createElement('template');
      template.innerHTML = decoder.decode(renderToHtml(text, {skipHtml: true}));
      clean(template.content);
      html = template.innerHTML;
    } catch { html = null; }
    if (mdCache.size > 400) mdCache.clear();
    mdCache.set(text, html);
  }
  const box = h('div', {className: 'md'});
  if (html === null) box.textContent = text; else box.innerHTML = html;
  for (const table of box.querySelectorAll('table')) table.replaceWith(h('div', {className: 'md-table'}, table.cloneNode(true)));
  return box;
}

// ---- Tool calls ----
function args(text) {
  try { let v = JSON.parse(text); if (typeof v === 'string') v = JSON.parse(v); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
const KINDS = [
  ['command', /^(bash|shell|exec_command|exec|run|terminal|local_shell)$/i],
  ['read', /^(read|view|read_file|cat|notebookread)$/i],
  ['edit', /^(edit|write|multiedit|apply_patch|str_replace|notebookedit|create|update_file)$/i],
  ['search', /^(grep|glob|search|find|ls|list)$/i],
  ['web', /^(webfetch|websearch|web_search|fetch|browse)/i],
  ['agent', /^(agent|task|spawn_agent)$/i],
];
const kindOf = name => KINDS.find(([, re]) => re.test(name || ''))?.[0] || 'tool';
function summary(name, text) {
  const v = typeof text === 'object' && text ? text : args(text);
  if (!v) return String(text || '').split('\n')[0];
  const pick = v.description ?? v.command ?? v.cmd ?? v.file_path ?? v.path ?? v.pattern ?? v.query ?? v.url ?? v.prompt ?? Object.values(v).find(x => typeof x === 'string');
  return String(Array.isArray(pick) ? pick.join(' ') : pick ?? name ?? '').split('\n')[0];
}
const pretty = text => { const v = args(text); return v ? JSON.stringify(v, null, 2) : text; };
const VERBS = {command: ['Ran', 'command', 'commands'], read: ['Read', 'file', 'files'], edit: ['Edited', 'file', 'files'], search: ['Searched', 'time', 'times'], web: ['Fetched', 'page', 'pages'], tool: ['Used', 'tool', 'tools']};
function sentence(calls) {
  const counts = {};
  for (const c of calls) { const k = kindOf(c.name); counts[k] = (counts[k] || 0) + 1; }
  const parts = Object.entries(counts).map(([k, n], i) => { const [verb, one, many] = VERBS[k]; return `${i ? verb.toLowerCase() : verb} ${n} ${n === 1 ? one : many}`; });
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0];
}

// Images are fetched once with the API token and kept as blob URLs.
const blobs = new Map();
function thumb(id) {
  const img = h('img', {className: 'thumb', alt: 'Attached image', loading: 'lazy', decoding: 'async'});
  const link = h('a', {className: 'thumb-link', target: '_blank', rel: 'noopener'}, img);
  let url = blobs.get(id);
  if (!url) {
    url = fetch('/api/image?id=' + encodeURIComponent(id), {headers: {'x-rex-token': window.rexToken}})
      .then(r => r.ok ? r.blob() : Promise.reject()).then(b => URL.createObjectURL(b));
    blobs.set(id, url);
    url.catch(() => blobs.delete(id));
  }
  Promise.resolve(url).then(u => { img.src = u; link.href = u; }, () => link.replaceWith(h('span', {className: 'att'}, icon('image', 13), 'Image')));
  return link;
}

export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
// Live timers tick from the server's clock offset so remote hosts don't drift.
function live(from, offset) {
  const node = h('span', {className: 'mono'});
  node.dataset.since = String(Date.parse(from)); node.dataset.offset = String(offset);
  node.textContent = duration(Date.now() + offset - Date.parse(from));
  return node;
}
export function tick(root) {
  for (const node of root.querySelectorAll('[data-since]')) node.textContent = duration(Date.now() + Number(node.dataset.offset) - Number(node.dataset.since));
}

function stepRow(call, result, ctx) {
  const failed = result && /^(error|<tool_use_error>)/i.test(result.text.trim());
  const pending = !result && ctx.working;
  const key = 'step:' + call.id;
  const row = h('details', {className: 'step' + (failed ? ' fail' : '') + (pending ? ' live' : ''), open: ctx.open.has(key)},
    h('summary', {}, icon(failed ? 'x' : kindOf(call.name) === 'tool' ? 'tool' : kindOf(call.name), 13), h('span', {className: 'tool', textContent: call.name || 'Tool'}), h('span', {className: 'trunc' + (pending ? ' shine' : ''), textContent: summary(call.name, call.text)})),
    h('div', {className: 'io'}, h('div', {className: 'label', textContent: 'Input'}), h('pre', {textContent: pretty(call.text)}), result ? h('div', {className: 'label', textContent: 'Output'}) : null, result ? h('pre', {textContent: result.text}) : null));
  row.ontoggle = () => row.open ? ctx.open.add(key) : ctx.open.delete(key);
  return row;
}

function run(calls, ctx) {
  const key = 'run:' + calls[0].id;
  const failures = calls.filter(c => ctx.results.get(c.id) && /^(error|<tool_use_error>)/i.test(ctx.results.get(c.id).text.trim())).length;
  const pending = ctx.working && calls.some(c => !ctx.results.has(c.id));
  if (calls.length === 1) return h('div', {className: 'run single'}, stepRow(calls[0], ctx.results.get(calls[0].id), ctx));
  const group = h('details', {className: 'run', open: ctx.open.has(key)},
    h('summary', {}, icon('chevron', 12), h('span', {className: pending ? 'shine' : '', textContent: sentence(calls)}), failures ? h('span', {className: 'bad', textContent: `${failures} failed`}) : null),
    h('div', {className: 'rows'}, ...calls.map(c => stepRow(c, ctx.results.get(c.id), ctx))));
  group.ontoggle = () => group.open ? ctx.open.add(key) : ctx.open.delete(key);
  return group;
}

function subagent(call, ctx) {
  const input = args(call.text) || {};
  const info = ctx.agents.get(call.id);
  const result = ctx.results.get(call.id);
  const background = info?.background ?? Boolean(input.run_in_background);
  const finished = ctx.finished[call.id];
  // Running: no completion notice and still writing (or, for a foreground call, no result yet).
  const recent = info && Date.now() + ctx.offset - Date.parse(info.updated) < 5 * 60 * 1000;
  const running = !finished && (background ? Boolean(info && !info.done && recent) : !result && ctx.working);
  const status = running ? 'running' : finished === 'failed' || finished === 'killed' ? finished : 'done';
  const key = 'agent:' + call.id;
  const meta = [info?.type || input.subagent_type || 'agent', background ? 'background' : null].filter(Boolean).join(' · ');
  const stats = h('span', {className: 'meta'});
  if (info?.started) {
    if (running) stats.append(live(info.started, ctx.offset));
    else stats.append(duration(Date.parse(info.updated) - Date.parse(info.started)));
    stats.append(` · ${info.tools} tools`);
  }
  const card = h('details', {className: 'agent-card ' + status, open: running || ctx.open.has(key)},
    h('summary', {}, running ? h('span', {className: 'pulse', title: 'Running'}) : icon(status === 'done' ? 'check' : 'x', 13),
      h('b', {className: 'trunc', textContent: input.description || summary(call.name, call.text)}), h('span', {className: 'meta', textContent: meta}), h('span', {className: 'sp'}), stats));
  const steps = info?.recent || [];
  const body = h('div', {className: 'agent-steps'});
  steps.forEach((s, i) => {
    const now = running && i === steps.length - 1;
    body.append(h('div', {className: 'agent-step' + (now ? ' now' : '')}, icon(kindOf(s.tool) === 'tool' ? 'tool' : kindOf(s.tool), 12), h('span', {className: 'tool', textContent: s.tool}), h('span', {className: 'trunc' + (now ? ' shine' : ''), textContent: summary(s.tool, s.input)})));
  });
  if (!steps.length) body.append(h('div', {className: 'agent-step', textContent: info ? 'No steps yet' : 'Details unavailable for this agent'}));
  card.append(body);
  card.ontoggle = () => card.open ? ctx.open.add(key) : ctx.open.delete(key);
  return {card, running};
}

// data: transcript API response. view: per-pane state {open:Set}. Returns the number of running subagents.
export function renderConversation(container, data, view) {
  const follow = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  const offset = data.now ? Date.parse(data.now) - Date.now() : 0;
  const items = data.items || [];
  const results = new Map(), used = new Set();
  for (const item of items) if (item.role === 'result' && item.name) results.set(item.name, item);
  const ctx = {results, open: view.open, working: Boolean(data.working), finished: data.finished || {}, offset, agents: new Map((data.subagents || []).map(a => [a.toolUseId, a]))};
  const col = h('div', {className: 'thread'});
  let running = 0, calls = [], user = null;
  const flush = () => { if (calls.length) col.append(run(calls, ctx)); calls = []; };

  if (data.unavailable) col.append(h('p', {className: 'hint', textContent: data.unavailable}));
  if (!data.selected && !data.unavailable) {
    col.append(h('p', {className: 'hint', textContent: 'No exact live-session match. Choose a conversation from this project; it will not be resumed or modified.'}));
    const select = h('select', {}, new Option('Choose conversation…', ''));
    select.setAttribute('aria-label', 'Choose conversation');
    for (const c of data.candidates || []) select.append(new Option(`${c.sessionId.slice(0, 8)} · ${new Date(c.modified).toLocaleString()}`, c.id));
    select.onchange = () => view.choose?.(select.value);
    col.append(data.candidates?.length ? select : h('p', {className: 'hint', textContent: 'No matching transcripts found.'}));
  }
  for (const warning of data.warnings || []) if (!/incomplete final record/.test(warning)) col.append(h('p', {className: 'hint', textContent: warning}));

  for (const item of items) {
    if (item.role === 'tool') {
      user = null;
      if (kindOf(item.name) === 'agent') { flush(); const s = subagent(item, ctx); if (s.running) running++; col.append(s.card); used.add(results.get(item.id)); }
      else { calls.push(item); used.add(results.get(item.id)); }
      continue;
    }
    if (item.role === 'result') { if (!used.has(item)) { calls.push({id: item.id, name: 'Output', text: ''}); results.set(item.id, item); } continue; }
    flush();
    if (item.role === 'user' || item.role === 'attachment') {
      if (!user) { user = h('div', {className: 'you'}); col.append(user); }
      if (item.role === 'attachment') user.append(item.image ? thumb(item.image) : h('span', {className: 'att'}, icon(item.name === 'file' ? 'read' : 'image', 13), item.text || 'Image'));
      else { if (item.name) user.append(h('span', {className: 'skill', textContent: item.name})); user.append(h('div', {className: 'bubble', textContent: item.text})); }
      continue;
    }
    user = null;
    if (item.role === 'assistant') col.append(h('div', {className: 'said'}, markdown(item.text)));
    else col.append(h('p', {className: item.role === 'error' ? 'note error' : 'note', textContent: item.role === 'error' ? 'Error: ' + item.text : item.text}));
  }
  flush();
  // Messages sent from this page that the transcript doesn't show yet (Claude writes queued messages when it picks them up).
  const norm = t => String(t || '').replace(/\s+/g, ' ').trim();
  const seen = items.filter(i => i.role === 'user').map(i => norm(i.text));
  view.pending = (view.pending || []).filter(p => Date.now() - p.at < 10 * 60 * 1000 && !(p.text ? seen.some(t => t.endsWith(norm(p.text))) : false));
  for (const p of view.pending) {
    const node = h('div', {className: 'you pending'});
    for (const f of p.files) node.append(h('span', {className: 'att'}, icon('image', 13), f));
    if (p.text) node.append(h('div', {className: 'bubble', textContent: p.text}));
    node.append(h('span', {className: 'sending', textContent: p.failed ? 'Not sent' : !p.sent ? 'Sending…' : data.working ? 'Queued' : 'Sent'}));
    col.append(node);
  }
  // The agent is stopped at a choice in its terminal (permission prompts and the like).
  if (view.prompt) {
    const card = h('div', {className: 'ask'}, h('div', {className: 'ask-head'}, h('span', {className: 'label', textContent: 'Needs your answer'})), h('p', {className: 'ask-q', textContent: view.prompt.question || 'The agent is waiting for a choice.'}));
    const list = h('div', {className: 'ask-options'});
    for (const o of view.prompt.options) list.append(h('button', {type: 'button', className: o.current ? 'current' : '', onclick: () => view.answer?.(o.key)}, h('kbd', {textContent: o.key}), h('span', {className: 'ask-option'}, h('span', {textContent: o.label}), o.detail ? h('small', {textContent: o.detail}) : null)));
    card.append(list, h('button', {type: 'button', className: 'ask-term', textContent: 'Open terminal', onclick: () => view.openTerminal?.()}));
    col.append(card);
  }
  if (data.working) col.append(h('div', {className: 'working'}, h('span', {className: 'pulse'}), 'Working', data.since ? ' for ' : '', data.since ? live(data.since, offset) : null));
  if (data.selected && !items.length) col.append(h('p', {className: 'hint', textContent: 'Waiting for transcript messages…'}));
  container.replaceChildren(col);
  if (follow) container.scrollTop = container.scrollHeight;
  return running;
}
