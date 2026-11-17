import {renderVT} from './ghostty.js';

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
  const data = await response.json().catch(() => ({error: 'Request failed (' + response.status + '). Refresh this page.'}));
  if (!response.ok) throw Error(data.error);
  return data;
}

function remember() { try { localStorage.setItem('rex-target', JSON.stringify({host: state.host, session: state.session, tab: state.tab})); } catch {} }
function remembered() { try { return JSON.parse(localStorage.getItem('rex-target')) || {}; } catch { return {}; } }

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
  renderTree();
  return state.listings.get(id);
}

function toggleSession(host, session) {
  const id = key(host, session);
  if (state.open.has(id)) state.open.delete(id);
  else { state.open.add(id); if (!state.listings.get(id)?.windows) { state.listings.delete(id); loadTabs(host, session); } }
  renderTree();
}

async function loadAll() {
  const version = ++generation, wanted = state.tab ? {host: state.host, session: state.session, tab: state.tab} : remembered();
  setTyping(false); clearPanes(); setState('Loading'); setNotice('Discovering Rex computers…');
  state.hostError = ''; state.sessions.clear(); state.listings.clear();
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
  if (listing.error) { setState('Error', 'bad'); setNotice(listing.error, true); return; }
  const tab = listing.windows.find(w => w.window_id === target.tab) ?? listing.windows[0];
  if (tab) selectTab(target.host, target.session, tab.window_id);
  else { setState('Idle'); setNotice('No tabs in this session.'); }
}

// ---- Workspace ----------------------------------------------------------

function clearPanes() { for (const slot of work.querySelectorAll('.slot')) slot.remove(); state.block = ''; showTarget(); }
const slots = () => [...work.querySelectorAll('.slot')];

function showTarget() {
  const listing = state.listings.get(key(state.host, state.session)), block = listing?.blocks?.find(b => b.block_id === state.block);
  $('to-label').textContent = block ? 'Send to' : 'No pane selected';
  $('to-title').textContent = block ? paneTitle(block) : '';
  $('to-id').textContent = block ? block.block_id.slice(-6) : '';
  sendButton.disabled = !block;
}

function selectPane(id) {
  if (state.block !== id) generation++;
  state.block = id; setTyping(false);
  for (const slot of slots()) slot.classList.toggle('active', slot.dataset.block === id);
  showTarget();
}

function selectTab(host, session, tab) {
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
    const head = el('button', {className: 'pane-head', onclick: () => { selectPane(item.block_id); pre.focus(); }}, el('span', {className: 'trunc', textContent: paneTitle(item)}), el('span', {className: 'id', textContent: item.block_id.slice(-6)}));
    slot.append(el('div', {className: 'pane'}, head, pre));
    work.append(slot);
  }
  for (const layer of current.layers.filter(l => l.kind === 'tiled')) draw(layer.layout);
  selectPane(panes.some(p => p.block_id === current.focused_block_id) ? current.focused_block_id : panes[0]?.block_id || '');
  if (slots().length) { setState('Loading'); setNotice(''); run(update); }
  else { setState('Idle'); setNotice('No terminal panes in this tab.'); }
}

async function update() {
  const panes = slots();
  if (busy || !panes.length) return;
  busy = true;
  const version = generation, target = {host: state.host, session: state.session};
  try {
    await Promise.all(panes.map(async slot => {
      const data = await api('screen', {...target, block: slot.dataset.block});
      if (version !== generation || data.content === slot.lastContent) return;
      const pre = slot.querySelector('pre'), follow = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 30;
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

sendButton.onclick = async () => {
  if (!command.value) return;
  const text = command.value;
  sendButton.disabled = true; setFeedback('Sending…');
  try { await send(text + '\r'); if (command.value === text) command.value = ''; setFeedback('Sent to Rex.'); await update(); }
  catch (error) { setFeedback('Send failed: ' + error.message, true); }
  finally { sendButton.disabled = !state.block; }
};
command.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!sendButton.disabled) sendButton.click(); } };

work.addEventListener('keydown', e => {
  if (e.target.tagName !== 'PRE' || !state.typing || e.metaKey) return;
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
$('typing-off').onclick = () => setTyping(false);
$('refresh').onclick = () => run(loadAll);
$('filter').oninput = e => { state.filter = e.target.value; renderTree(); };
$('theme').onclick = () => {
  const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('rex-theme', root.dataset.theme); } catch {}
};
run(loadAll);
setInterval(update, 800);
