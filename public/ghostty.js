const {instance} = await WebAssembly.instantiate(await (await fetch('/ghostty-vt.wasm')).arrayBuffer(), {env:{log(){}}});
const api = instance.exports;
const decoder = new TextDecoder();
const ptr = api.ghostty_type_json();
const layout = JSON.parse(decoder.decode(new Uint8Array(api.memory.buffer,ptr)).split('\0')[0]);
function check(result) { if(result !== 0) throw Error('Ghostty error '+result); }
export function renderVT(text) {
  const handle = api.ghostty_wasm_alloc_opaque();
  check(api.ghostty_terminal_new(0,handle,160,48));
  const terminal = api.ghostty_wasm_take_opaque(handle);
  const bytes = new TextEncoder().encode(text);
  const input = api.ghostty_wasm_alloc(bytes.length);
  new Uint8Array(api.memory.buffer,input,bytes.length).set(bytes);
  api.ghostty_terminal_vt_write(terminal,input,bytes.length);
  api.ghostty_wasm_free(input,bytes.length);
  check(api.ghostty_formatter_terminal_new(0,handle,terminal));
  const formatter = api.ghostty_wasm_take_opaque(handle);
  const option = api.ghostty_wasm_alloc(4);
  new DataView(api.memory.buffer).setInt32(option,layout.types.GhosttyFormatterFormat.values.PLAIN,true);
  check(api.ghostty_formatter_set(formatter,layout.types.GhosttyFormatterOption.values.EMIT,option));
  const length = api.ghostty_wasm_alloc(layout.abi.usize_size);
  check(api.ghostty_formatter_format_alloc(formatter,0,handle,length));
  const out = api.ghostty_wasm_take_opaque(handle);
  const size = new DataView(api.memory.buffer).getUint32(length,true);
  const result = decoder.decode(new Uint8Array(api.memory.buffer,out,size));
  api.ghostty_free(0,out,size);
  api.ghostty_wasm_free(length,layout.abi.usize_size);
  api.ghostty_wasm_free(option,4);
  api.ghostty_wasm_free_opaque(handle);
  api.ghostty_formatter_free(formatter);
  api.ghostty_terminal_free(terminal);
  return result;
}
