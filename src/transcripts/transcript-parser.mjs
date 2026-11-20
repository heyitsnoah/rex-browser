export function parseTranscript(text, agent) {
  const warnings = [], records = [];
  const lines = text.split('\n');
  if (lines.at(-1)) warnings.push('Waiting for an incomplete final record.');
  lines.pop();
  for (const line of lines) { if (!line.trim()) continue; try { records.push(JSON.parse(line)); } catch { warnings.push('Skipped a malformed record.'); } }
  let active = records;
  if (agent === 'pi' || agent === 'claude') {
    const idKey = agent === 'pi' ? 'id' : 'uuid', parentKey = agent === 'pi' ? 'parentId' : 'parentUuid';
    const linked = records.filter(r => r[idKey] && (agent !== 'claude' || !r.isSidechain));
    const index = new Map(linked.map(r => [r[idKey], r]));
    let leaf = linked.at(-1);
    if (leaf && parentKey in leaf) {
      active = []; const seen = new Set();
      while (leaf && !seen.has(leaf[idKey])) { seen.add(leaf[idKey]); active.unshift(leaf); leaf = index.get(leaf[parentKey]); }
    }
  }
  const items = [];
  function add(role, text, name = '', id = '') {
    if (text === undefined || text === null || text === '') return;
    items.push({id: id || String(items.length), role, name, text: typeof text === 'string' ? text : JSON.stringify(text, null, 2)});
  }
  function content(role, value, id) {
    if (typeof value === 'string') { add(role, value, '', id); return; }
    for (const [i, part] of (Array.isArray(value) ? value : []).entries()) {
      const partId = `${id}:${i}`;
      if (['text','input_text','output_text'].includes(part.type)) add(role, part.text, '', partId);
      else if (['tool_use','toolCall'].includes(part.type)) add('tool', part.input ?? part.arguments, part.name, part.id || partId);
      else if (part.type === 'tool_result') add('result', typeof part.content === 'string' ? part.content : (part.content || []).map(c=>c.text || `[${c.type}]`).join('\n'), part.tool_use_id, partId);
      else if (['image','input_image'].includes(part.type)) add('attachment','Image attachment (open Terminal for the original view).','',partId);
    }
  }
  for (const [i, r] of active.entries()) {
    const id = r.uuid || r.id || String(i);
    if (agent === 'codex') {
      const p=r.payload || {};
      // response_item is the canonical content; event_msg often repeats the same text.
      if (r.type === 'response_item') {
        if (p.type === 'message' && ['user','assistant'].includes(p.role)) content(p.role,p.content,id);
        else if (['function_call','custom_tool_call'].includes(p.type)) add('tool',p.arguments ?? p.input,p.name,p.call_id || id);
        else if (['function_call_output','custom_tool_call_output'].includes(p.type)) add('result',p.output,p.call_id,id);
      } else if (r.type === 'compacted') add('summary',p.message || 'Earlier context compacted.','',id);
    } else if (r.type === 'compaction' || r.type === 'branch_summary' || (r.type === 'system' && r.subtype === 'compact_boundary')) {
      add('summary',r.summary || 'Context compacted.','',id);
    } else if (r.message && !r.isSidechain && !r.isMeta) {
      const role=r.message.role || r.type;
      if (['user','assistant','toolResult'].includes(role)) content(role === 'toolResult' ? 'result' : role,r.message.content,id);
    }
  }
  return {items:items.slice(-500),warnings:[...new Set([...warnings,...(items.length>500?['Showing the latest 500 transcript items.']:[])])]};
}
