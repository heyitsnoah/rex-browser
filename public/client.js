import {renderVT} from './ghostty.js';
import {renderConversation, tick} from './conversation.js';

const $ = id => document.getElementById(id);
const tree = $('tree'), work = $('work'), notice = $('notice'), feedback = $('feedback'), command = $('command'), sendButton = $('send');
const TERMINAL = 'com.superlogical.terminal';
const key = (host, session) => host + '|' + session;

// Rex stays the source of truth: this only caches what it reported.
const state = {
  hosts: [], hostError: '',
  sessions: new Map(),   // host id -> {items} | {error} | undefined while loading
  listings: new Map(),   // host|session -> {windows, blocks} | {error} | undefined while loading
  open: new Set(),       // expanded host|session keys
  host: '', session: '', tab: '', block: '',
  typing: false, naming: '', filter: '',
};
let generation = 0, busy = false, queue = Promise.resolve(), pollFailed = false;

async function api(route, target, text) {
  const response = await fetch('/api/' + route + '?' + new URLSearchParams(target), {method: text === undefined ? 'GET' : 'POST', headers: {'x-rex-token': window.rexToken}, ...(text === undefined ? {} : {body: JSON.stringify({text})})});
  // A refused token means the bridge was set up again; reload once (not more than every 30 s).
  if (response.status === 403) { try { const last = Number(sessionStorage.getItem('rex-reloaded') || 0); if (Date.now() - last > 30000) { sessionStorage.setItem('rex-reloaded', String(Date.now())); location.reload(); } } catch {} }
  const data = await response.json().catch(() => ({error: 'Request failed (' + response.status + '). Refresh this page.'}));
  if (!response.ok) throw Error(data.error);
  return data;
}

function remember() { try { localStorage.setItem('rex-target', JSON.stringify({host: state.host, session: state.session, tab: state.tab})); } catch {} }
function remembered() { try { return JSON.parse(localStorage.getItem('rex-target')) || {}; } catch { return {}; } }

// Last known computers, sessions, tabs and the open conversation, shown at once on the next load
// while fresh data arrives. Rex stays the source of truth; this only remembers what it reported.
const CACHE = 'rex-cache-v1', CONV = 'rex-conv-v1';
function saveCache() {
  try {
    const ok = ([, v]) => v && !v.error;
    localStorage.setItem(CACHE, JSON.stringify({hosts: state.hosts, sessions: [...state.sessions].filter(ok), listings: [...state.listings].filter(ok), open: [...state.open]}));
  } catch {}
}
function restoreCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE));
    if (!c?.hosts?.length) return false;
    state.hosts = c.hosts; state.sessions = new Map(c.sessions); state.listings = new Map(c.listings); state.open = new Set(c.open);
    return true;
  } catch { return false; }
}
function saveConversation(slot, data) {
  try {
    const items = (data.items || []).slice(-200).map(i => i.role === 'result' && i.text.length > 4000 ? {...i, text: i.text.slice(0, 4000) + '\n…'} : i);
    localStorage.setItem(CONV, JSON.stringify({key: key(state.host, state.session) + '|' + slot.dataset.block, label: slot.agentLabel, data: {...data, items}}));
  } catch {}
}
function cachedConversation(block) {
  try { const c = JSON.parse(localStorage.getItem(CONV)); return c?.key === key(state.host, state.session) + '|' + block ? c : null; } catch { return null; }
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(child => child !== null && child !== undefined && child !== ''));
  return node;
}
function icon(path, size = 12) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'})) svg.setAttribute(name, value);
  svg.innerHTML = `<path d="${path}"/>`;
  return svg;
}
const CHEVRON = 'm9 18 6-6-6-6', DOWN = 'm6 9 6 6 6-6', PLUS = 'M5 12h14M12 5v14';

function setState(text, kind = '') { $('state').className = 'label ' + kind; $('state-text').textContent = text; }
function setNotice(text, bad = false) { notice.textContent = text; notice.className = bad ? 'bad' : ''; }
function setFeedback(text, bad = false) { feedback.textContent = text; feedback.className = bad ? 'bad' : ''; }
function setTyping(on) { state.typing = on; $('typing-on').setAttribute('aria-pressed', String(on)); $('typing-off').setAttribute('aria-pressed', String(!on)); }

const hostLabel = id => state.hosts.find(h => h.id === id)?.label ?? id;
const sessionLabel = (host, id) => state.sessions.get(host)?.items?.find(s => s.session_id === id)?.label ?? '';
const terminalPanes = (listing, tab) => listing.blocks.filter(b => b.window_id === tab && b.creator_name === TERMINAL);
const paneTitle = block => block.terminal_title || block.label;
// Rex labels a window nobody named "Window <last 8 of its id>". For those, show what is running in it instead.
function tabLabel(listing, tab) {
  if (tab.label !== 'Window ' + tab.window_id.slice(-8)) return tab.label;
  const panes = terminalPanes(listing, tab.window_id);
  return (panes.find(b => b.block_id === tab.focused_block_id) ?? panes[0])?.terminal_title || tab.label;
}

// ---- Rail ---------------------------------------------------------------

function renderTree() {
  const scroll = tree.scrollTop, words = state.filter.trim().toLowerCase();
  const matches = text => !words || text.toLowerCase().includes(words);
  const nodes = [];
  if (state.hostError) nodes.push(el('div', {className: 'host'}, el('span', {className: 'n bad', textContent: state.hostError})));
  for (const host of state.hosts) {
    const entry = state.sessions.get(host.id);
    const count = !host.online ? 'offline' : !entry ? 'loading' : entry.error ? 'failed' : entry.items.length ? entry.items.length + (entry.items.length === 1 ? ' session' : ' sessions') : 'no sessions';
    const rows = [];
    for (const session of entry?.items ?? []) {
      const id = key(host.id, session.session_id), listing = state.listings.get(id), open = state.open.has(id) || Boolean(words && listing?.windows);
      const tabs = (listing?.windows ?? []).filter(w => matches(tabLabel(listing, w)) || matches(session.label));
      if (words && !matches(session.label) && !tabs.length) continue;
      rows.push(el('button', {className: 'sess', onclick: () => toggleSession(host.id, session.session_id)}, icon(open ? DOWN : CHEVRON), el('span', {className: 'trunc', textContent: session.label}), listing?.windows ? el('span', {className: 'n', textContent: listing.windows.length}) : null));
      rows.at(-1).setAttribute('aria-expanded', String(open));
      if (!open) continue;
      const group = el('div', {className: 'tabs'});
      if (!listing) group.append(el('span', {className: 'hint', textContent: 'Loading tabs…'}));
      else if (listing.error) group.append(el('span', {className: 'hint bad', textContent: listing.error}));
      else {
        for (const tab of tabs) {
          const panes = terminalPanes(listing, tab.window_id).length;
          const row = el('button', {className: 'tab', onclick: () => selectTab(host.id, session.session_id, tab.window_id)}, el('span', {className: 'trunc', textContent: tabLabel(listing, tab), title: tab.label}), panes > 1 ? el('span', {className: 'n', textContent: panes}) : null);
          if (state.host === host.id && state.session === session.session_id && state.tab === tab.window_id) row.setAttribute('aria-current', 'true');
          group.append(row);
        }
        if (!listing.windows.length) group.append(el('span', {className: 'hint', textContent: 'No tabs in this session.'}));
        group.append(state.naming === id ? nameField(host.id, session.session_id) : el('button', {className: 'tab new', onclick: () => { state.naming = id; renderTree(); tree.querySelector('.name')?.focus(); }}, icon(PLUS), el('span', {textContent: 'New tab'})));
      }
      rows.push(group);
    }
    if (words && !rows.length && !matches(host.label)) continue;
    nodes.push(el('div', {className: 'host label'}, el('span', {className: 'dot' + (host.online ? '' : ' off')}), el('span', {className: 'trunc', textContent: host.label}), el('span', {className: 'n' + (entry?.error ? ' bad' : ''), textContent: count, title: entry?.error ?? ''})), ...rows);
  }
  tree.replaceChildren(...nodes);
  tree.scrollTop = scroll;
}

function nameField(host, session) {
  const input = el('input', {className: 'name', value: 'Terminal', maxLength: 128});
  input.setAttribute('aria-label', 'New tab name. Enter creates it, Escape cancels.');
  const close = () => { if (state.naming) { state.naming = ''; renderTree(); } };
  input.onkeydown = async e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Enter' || !input.value.trim() || input.disabled) return;
    input.disabled = true; setFeedback('Creating tab…');
    try {
      const result = await api('new-tab', {host, session}, input.value);
      setFeedback('Tab created.'); state.naming = '';
      await loadTabs(host, session);
      if (result.window_id) selectTab(host, session, result.window_id);
    } catch (error) { setFeedback('Could not create tab: ' + error.message, true); input.disabled = false; input.focus(); }
  };
  input.onblur = () => { if (!input.disabled) close(); };
  queueMicrotask(() => input.select());
  return input;
}

async function loadTabs(host, session) {
  const id = key(host, session);
  try { state.listings.set(id, await api('blocks', {host, session})); }
  catch (error) { state.listings.set(id, {error: error.message}); }
  renderTree(); saveCache();
  return state.listings.get(id);
}

function toggleSession(host, session) {
  const id = key(host, session);
  if (state.open.has(id)) state.open.delete(id);
  else { state.open.add(id); if (!state.listings.get(id)?.windows) { state.listings.delete(id); loadTabs(host, session); } }
  renderTree();
}

async function loadAll(quiet = false) {
  // quiet: the cached view is on screen; refresh behind it without clearing anything.
  const version = quiet ? generation : ++generation, wanted = state.tab ? {host: state.host, session: state.session, tab: state.tab} : remembered();
  if (!quiet) { setTyping(false); clearPanes(); setState('Loading'); setNotice('Discovering Rex computers…'); state.sessions.clear(); state.listings.clear(); }
  state.hostError = '';
  try { state.hosts = (await api('hosts', {})).hosts; }
  catch (error) { state.hosts = []; state.hostError = 'Discovery failed'; renderTree(); setState('Error', 'bad'); setNotice('Computer discovery failed: ' + error.message, true); return; }
  if (version !== generation) return;
  renderTree();
  const online = state.hosts.filter(h => h.online);
  if (!online.length) { setState('Offline'); setNotice(state.hosts.length ? 'All Rex computers are offline.' : 'No Tailscale computers tagged tag:rex found.'); return; }
  setNotice('Connecting…');
  await Promise.all(online.map(async host => {
    try { state.sessions.set(host.id, {items: (await api('sessions', {host: host.id})).sessions}); }
    catch (error) { state.sessions.set(host.id, {error: error.message}); }
    if (version === generation) renderTree();
  }));
  if (version !== generation) return;
  // Reopen what was open, then land on the previous tab when it still exists.
  const has = (host, session) => state.sessions.get(host)?.items?.some(s => s.session_id === session);
  const target = has(wanted.host, wanted.session) ? wanted : (() => { const host = online.find(h => state.sessions.get(h.id)?.items?.length); return host ? {host: host.id, session: state.sessions.get(host.id).items[0].session_id} : null; })();
  for (const id of [...state.open]) { const [host, session] = id.split('|'); if (has(host, session)) loadTabs(host, session); else state.open.delete(id); }
  if (!target) { setState('Idle'); setNotice('No sessions on any Rex computer.'); return; }
  state.open.add(key(target.host, target.session)); renderTree();
  const listing = await loadTabs(target.host, target.session);
  if (version !== generation) return;
  saveCache();
  if (listing.error) { setState('Error', 'bad'); setNotice(listing.error, true); return; }
  const tab = listing.windows.find(w => w.window_id === target.tab) ?? listing.windows[0];
  // Already showing it from cache: keep the panes (they're polling live) unless the layout changed.
  const same = quiet && tab && state.host === target.host && state.session === target.session && state.tab === tab.window_id
    && slots().map(s => s.dataset.block).join() === terminalPanes(listing, tab.window_id).map(b => b.block_id).join();
  if (same) renderTree();
  else if (tab) selectTab(target.host, target.session, tab.window_id);
  else { setState('Idle'); setNotice('No tabs in this session.'); }
}

// ---- Workspace ----------------------------------------------------------

function clearPanes() { for (const slot of work.querySelectorAll('.slot')) slot.remove(); state.block = ''; showTarget(); }
const slots = () => [...work.querySelectorAll('.slot')];

function showTarget() {
  const listing = state.listings.get(key(state.host, state.session)), block = listing?.blocks?.find(b => b.block_id === state.block);
  $('to-label').textContent = block ? 'Send to' : 'No pane selected';
  $('to-title').textContent = block ? paneTitle(block) : '';
  const slot = block && slots().find(s => s.dataset.block === block.block_id);
  $('to-id').textContent = block ? (slot?.agentLabel ? hostLabel(state.host) + ' · ' + slot.agentLabel : block.block_id.slice(-6)) : '';
  updateSend();
  $('dest').textContent = block ? (slot?.agentLabel ? hostLabel(state.host) + ' · ' + slot.agentLabel : paneTitle(block)) : '';
}

function selectPane(id) {
  if (state.block !== id) generation++;
  state.block = id; setTyping(false);
  for (const slot of slots()) slot.classList.toggle('active', slot.dataset.block === id);
  showTarget(); refreshHeader();
}

function selectTab(host, session, tab) {
  setNav(false);
  if (host !== state.host) checkUploads(host);
  generation++; setTyping(false); setFeedback('');
  Object.assign(state, {host, session, tab});
  state.open.add(key(host, session)); remember(); renderTree();
  clearPanes();
  const listing = state.listings.get(key(host, session)), current = listing?.windows?.find(w => w.window_id === tab);
  if (!current) { $('title').textContent = 'Rex'; $('meta').textContent = ''; setState('Idle'); setNotice('No tabs in this session.'); return; }
  const panes = terminalPanes(listing, tab);
  $('title').textContent = tabLabel(listing, current);
  $('meta').textContent = [hostLabel(host), sessionLabel(host, session), panes.length + (panes.length === 1 ? ' pane' : ' panes')].filter(Boolean).join(' / ');
  document.title = tabLabel(listing, current) + ' · Rex';
  function draw(node) {
    if (node.split) { draw(node.split.before); draw(node.split.after); return; }
    const item = panes.find(b => b.block_id === node.block_id);
    if (!item) return;
    const [x, y, w, h] = node.rect;
    const slot = el('section', {className: 'slot'}); slot.dataset.block = item.block_id;
    Object.assign(slot.style, {left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%'});
    const pre = el('pre', {tabIndex: 0}); pre.setAttribute('aria-label', paneTitle(item));
    pre.onfocus = () => { if (state.block !== item.block_id) selectPane(item.block_id); };
    const head = el('button', {className: 'pane-head', onclick: () => { selectPane(item.block_id); (slot.agent && !slot.drawer ? conversation : pre).focus(); }}, el('span', {className: 'trunc', textContent: paneTitle(item)}), el('span', {className: 'id', textContent: item.block_id.slice(-6)}));
    const conversation = el('div', {className: 'conversation', tabIndex: -1});
    conversation.onfocus = () => { if (state.block !== item.block_id) selectPane(item.block_id); };
    conversation.onclick = () => { if (state.block !== item.block_id) selectPane(item.block_id); };
    const handle = el('div', {className: 'drawer-handle', title: 'Drag to resize'});
    handle.onpointerdown = e => {
      handle.setPointerCapture(e.pointerId);
      const pane = slot.querySelector('.pane').getBoundingClientRect();
      handle.onpointermove = m => { drawerHeight = Math.round(Math.min(pane.height * .75, Math.max(140, pane.bottom - m.clientY))); for (const s of slots()) s.style.setProperty('--drawer', drawerHeight + 'px'); };
      handle.onpointerup = () => { handle.onpointermove = null; };
    };
    slot.style.setProperty('--drawer', drawerHeight + 'px');
    slot.view = {open: new Set(), choose: id => { slot.transcriptId = id; slot.lastTranscriptPoll = 0; run(update); },
      answer: key => { selectPane(item.block_id); send(key).then(() => { slot.view.prompt = null; slot.lastPromptPoll = 0; slot.lastTranscriptPoll = 0; rerender(slot); }, error => setFeedback('Answer failed: ' + error.message, true)); },
      openTerminal: () => { selectPane(item.block_id); if (!slot.drawer) toggleDrawer(slot); }};
    slot.append(el('div', {className: 'pane'}, head, conversation, handle, pre));
    const cached = cachedConversation(item.block_id);
    if (cached) queueMicrotask(() => { setAgent(slot, true, cached.label); slot.lastData = cached.data; slot.running = renderConversation(conversation, cached.data, slot.view); conversation.scrollTop = 1e9; });
    work.append(slot);
  }
  for (const layer of current.layers.filter(l => l.kind === 'tiled')) draw(layer.layout);
  work.classList.toggle('solo', slots().length === 1);
  selectPane(panes.some(p => p.block_id === current.focused_block_id) ? current.focused_block_id : panes[0]?.block_id || '');
  if (slots().length) { setState('Loading'); setNotice(''); run(update); }
  else { setState('Idle'); setNotice('No terminal panes in this tab.'); }
}

// ---- Agent panes: conversation first, terminal in a drawer (Ctrl+J) ----
let drawerHeight = 280;
const activeSlot = () => slots().find(s => s.dataset.block === state.block);

function setAgent(slot, agent, label = '') {
  if (slot.agent === agent && slot.agentLabel === label) return;
  slot.agent = agent; slot.agentLabel = label;
  if (!agent) { slot.drawer = false; slot.lastTranscript = undefined; slot.transcriptId = undefined; slot.running = 0; }
  slot.classList.toggle('agent', agent); slot.classList.toggle('drawer', Boolean(slot.drawer));
  refreshHeader(); showTarget();
}

function toggleDrawer(slot = activeSlot()) {
  if (!slot?.agent) return;
  slot.drawer = !slot.drawer; slot.classList.toggle('drawer', slot.drawer);
  slot.lastContent = undefined; refreshHeader();
  if (slot.drawer) { slot.querySelector('.pane > pre').focus(); run(update); } else { setTyping(false); slot.querySelector('.conversation').focus(); }
}

function refreshHeader() {
  const slot = activeSlot(), toggle = $('term-toggle');
  toggle.hidden = !slot?.agent;
  toggle.setAttribute('aria-pressed', String(Boolean(slot?.drawer)));
  toggle.title = slot?.drawer ? 'Hide terminal (Ctrl+J)' : 'Show terminal (Ctrl+J)';
  // Direct typing only means something while a terminal is on screen.
  document.querySelector('.seg').hidden = Boolean(slot?.agent && !slot.drawer);
  command.placeholder = slot?.agentLabel ? 'Reply to ' + slot.agentLabel : 'Text or command';
  const running = slots().reduce((n, s) => n + (s.running || 0), 0);
  $('agents').hidden = !running;
  $('agents-text').textContent = running === 1 ? '1 agent running' : running + ' agents running';
}

const AGENT_NAMES = {claude: 'Claude Code', codex: 'Codex', pi: 'Pi'};

// A numbered choice menu at the bottom of the agent's screen ("❯ 1. Yes … Esc to cancel").
// The question and option descriptions wrap over several lines, so contiguous lines are joined.
function detectPrompt(text) {
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).slice(-60);
  const end = lines.findLastIndex(l => /Esc to cancel|Enter to confirm|to select|Tab to amend/.test(l));
  if (end < 0) return null;
  const options = [];
  let first = -1;
  for (let i = Math.max(0, end - 30); i < end; i++) {
    const m = lines[i].match(/^\s*([❯›>])?\s*(\d{1,2})[.)]\s+(.+)$/);
    if (m) { if (first < 0) first = i; options.push({key: m[2], label: m[3].trim(), detail: '', current: Boolean(m[1])}); }
    else if (options.length && lines[i].trim() && !/^[\s─━-]+$/.test(lines[i])) {
      const last = options.at(-1);
      last.detail = (last.detail + ' ' + lines[i].trim()).trim();
    }
  }
  if (options.length < 2) return null;
  const question = [];
  for (let i = first - 1; i >= Math.max(0, first - 12); i--) {
    const t = lines[i].trim();
    if (!t || /^[─━-]+$/.test(t) || /^[←☐☒✔□■]/.test(t)) { if (question.length) break; continue; }
    question.unshift(t);
  }
  return {question: question.join(' '), options};
}


async function update() {
  const panes = slots();
  if (busy || !panes.length) return;
  busy = true;
  const version = generation, target = {host: state.host, session: state.session};
  try {
    await Promise.all(panes.map(async slot => {
      if (!slot.lastTranscriptPoll || Date.now() - slot.lastTranscriptPoll > 3000) {
        slot.lastTranscriptPoll = Date.now();
        try {
          const transcript = await api('transcript', {...target, block: slot.dataset.block, ...(slot.transcriptId ? {transcript: slot.transcriptId} : {})});
          if (version !== generation) return;
          // A fresh agent has no transcript yet: keep the terminal until one exists.
          const empty = transcript.agent && !transcript.selected && !transcript.candidates?.length && !slot.transcriptId;
          if (transcript.agent && !transcript.unavailable && !empty) {
            setAgent(slot, true, AGENT_NAMES[transcript.agent] || transcript.agent);
            const serialized = JSON.stringify(transcript);
            if (serialized !== slot.lastTranscript || slot.view.pending?.length) {
              slot.running = renderConversation(slot.querySelector('.conversation'), transcript, slot.view);
              slot.lastTranscript = serialized; slot.lastData = transcript; refreshHeader();
              if (slot.dataset.block === state.block) saveConversation(slot, transcript);
            }
          } else {
            // No agent, or no transcript access on this computer: plain terminal, no dead end.
            setAgent(slot, false);
            slot.querySelector('.pane-head').title = transcript.unavailable || '';
          }
        } catch (error) {
          if (version !== generation) return;
          if (slot.agent) { setAgent(slot, false); setFeedback('Conversation unavailable: ' + error.message, true); }
        }
      }
      if (slot.agent) tick(slot);
      // While the agent works, watch its screen for a choice it's waiting on.
      if (slot.agent && !slot.drawer) {
        if (slot.lastData?.working && (!slot.lastPromptPoll || Date.now() - slot.lastPromptPoll > 2000)) {
          slot.lastPromptPoll = Date.now();
          const screen = await api('screen', {...target, block: slot.dataset.block});
          if (version !== generation) return;
          const prompt = detectPrompt(renderVT(screen.content));
          if (JSON.stringify(prompt) !== JSON.stringify(slot.view.prompt ?? null)) { slot.view.prompt = prompt; rerender(slot, false); }
        } else if (!slot.lastData?.working && slot.view.prompt) { slot.view.prompt = null; rerender(slot, false); }
        return;
      }
      const data = await api('screen', {...target, block: slot.dataset.block});
      if (version !== generation || data.content === slot.lastContent) return;
      const pre = slot.querySelector('.pane > pre'), follow = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 30;
      pre.textContent = renderVT(data.content);
      if (follow) pre.scrollTop = pre.scrollHeight;
      slot.lastContent = data.content;
    }));
    if (version === generation) { setState('Live', 'live'); setNotice(''); if (pollFailed) { pollFailed = false; setFeedback(''); } }
  } catch (error) { if (version === generation) { pollFailed = true; setState('Error', 'bad'); setFeedback(error.message, true); } }
  finally { busy = false; }
}

// ---- Input --------------------------------------------------------------

function send(text) {
  const target = {host: state.host, session: state.session, block: state.block};
  if (!target.block) return Promise.reject(Error('Select a terminal pane.'));
  const version = generation;
  const task = queue.then(() => { if (version !== generation) throw Error('Pane changed; input was not sent.'); return api('input', target, text); });
  queue = task.catch(() => {});
  return task;
}

// ---- Composer: optimistic send, attachments, auto-grow ----
const atts = [];
const attBox = $('atts');
function renderAtts() {
  attBox.hidden = !atts.length;
  attBox.replaceChildren(...atts.map(a => {
    const remove = el('button', {type: 'button', title: 'Remove', onclick: () => { atts.splice(atts.indexOf(a), 1); renderAtts(); }});
    remove.innerHTML = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    return el('span', {className: 'att-chip ' + a.status, title: a.error || a.name}, el('span', {className: 'trunc', textContent: a.status === 'busy' ? 'Uploading ' + a.name : a.name}), remove);
  }));
  updateSend();
}
function updateSend() { sendButton.disabled = !state.block || atts.some(a => a.status === 'busy') || (!command.value.trim() && !atts.some(a => a.status === 'ok')); }
function grow() { command.style.height = 'auto'; command.style.height = Math.min(command.scrollHeight, 180) + 'px'; }
command.addEventListener('input', () => { grow(); updateSend(); });

async function uploadFile(file) {
  const item = {name: file.name, status: 'busy', host: state.host, session: state.session};
  atts.push(item); renderAtts();
  try {
    if (file.size > 25 * 1024 * 1024) throw Error('Larger than 25 MB');
    const response = await fetch('/api/upload?' + new URLSearchParams({host: state.host, session: state.session, name: file.name}), {method: 'POST', headers: {'x-rex-token': window.rexToken}, body: file});
    const data = await response.json().catch(() => ({error: 'Upload failed (' + response.status + ')'}));
    if (!response.ok) throw Error(data.error);
    Object.assign(item, {status: 'ok', path: data.path});
  } catch (error) { Object.assign(item, {status: 'bad', error: error.message}); setFeedback('Upload failed: ' + error.message, true); }
  renderAtts();
}
$('attach').onclick = () => $('file').click();
$('file').onchange = e => { for (const file of e.target.files) uploadFile(file); e.target.value = ''; };
command.addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])]; if (files.length && !$('attach').hidden) { e.preventDefault(); files.forEach(uploadFile); } });

async function checkUploads(host) {
  $('attach').hidden = true;
  try { const {available} = await api('upload-available', {host}); if (host === state.host) $('attach').hidden = !available; } catch {}
}

function rerender(slot, toBottom = true) {
  if (!slot?.agent || !slot.lastData) return;
  slot.running = renderConversation(slot.querySelector('.conversation'), slot.lastData, slot.view);
  if (toBottom) slot.querySelector('.conversation').scrollTop = 1e9;
}
function pendingBubble(text, files) {
  const slot = activeSlot();
  if (!slot?.agent) return null;
  const entry = {text: text.trim(), files, at: Date.now(), sent: false};
  (slot.view.pending ??= []).push(entry); rerender(slot);
  return {sent() { entry.sent = true; rerender(slot); }, remove() { slot.view.pending = slot.view.pending.filter(p => p !== entry); rerender(slot); }};
}

sendButton.onclick = async () => {
  const text = command.value.trim() ? command.value : '';
  const ready = atts.filter(a => a.status === 'ok' && a.host === state.host);
  if (!text && !ready.length) return;
  // Clear right away; the transcript catches up on the next poll.
  command.value = ''; grow(); atts.length = 0; renderAtts();
  const bubble = pendingBubble(text, ready.map(a => a.name));
  setFeedback('Sending…');
  try {
    // Paste the text (and file paths) as one bracketed paste, then press Enter as its own keystroke.
    // Sent together, TUIs like Claude Code treat the Enter as part of the paste and don't submit.
    // File paths go in their own paste so Claude Code turns image paths into attachments.
    const target = {host: state.host, session: state.session, block: state.block};
    const pause = () => new Promise(r => setTimeout(r, 120));
    if (ready.length) { await api('paste', target, ready.map(a => a.path).join(' ') + ' '); await pause(); }
    if (text) { await api('paste', target, text); await pause(); await send('\r'); }
    setFeedback('Sent');
    const slot = activeSlot(); if (slot) { slot.lastTranscriptPoll = 0; slot.lastContent = undefined; }
    bubble?.sent();
  } catch (error) {
    bubble?.remove();
    if (!command.value) { command.value = text; grow(); }
    setFeedback('Send failed: ' + error.message, true);
  } finally { updateSend(); }
};
command.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!sendButton.disabled) sendButton.click(); } };

work.addEventListener('keydown', e => {
  if (e.target.tagName !== 'PRE' || e.target.closest('.conversation') || !state.typing || e.metaKey) return;
  const keys = {Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b', ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D'};
  const text = e.ctrlKey && e.key.length === 1 ? String.fromCharCode(e.key.toUpperCase().charCodeAt(0) & 31) : keys[e.key] ?? (e.key.length === 1 ? e.key : undefined);
  if (text !== undefined) { e.preventDefault(); send(text).catch(error => setFeedback('Input failed: ' + error.message, true)); }
});
work.addEventListener('paste', e => {
  if (e.target.tagName !== 'PRE' || !state.typing) return;
  e.preventDefault(); send(e.clipboardData.getData('text')).catch(error => setFeedback(error.message, true));
});

function run(fn) { fn().catch(error => setFeedback(error.message, true)); }
$('typing-on').onclick = () => setTyping(true);
$('term-toggle').onclick = () => toggleDrawer();
function setNav(open) { document.body.classList.toggle('nav-open', open); $('nav').setAttribute('aria-expanded', String(open)); }
$('nav').onclick = () => setNav(true);
$('nav-close').onclick = () => setNav(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false); });
document.addEventListener('keydown', e => { if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'j' && activeSlot()?.agent) { e.preventDefault(); e.stopPropagation(); toggleDrawer(); } }, true);
$('typing-off').onclick = () => setTyping(false);
$('refresh').onclick = () => run(loadAll);
$('filter').oninput = e => { state.filter = e.target.value; renderTree(); };
$('theme').onclick = () => {
  const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('rex-theme', root.dataset.theme); } catch {}
};
// Show the last view at once, then refresh behind it.
const wanted = remembered();
if (restoreCache() && state.listings.get(key(wanted.host, wanted.session))?.windows?.some(w => w.window_id === wanted.tab)) {
  renderTree(); selectTab(wanted.host, wanted.session, wanted.tab); run(() => loadAll(true));
} else run(loadAll);
setInterval(update, 800);
