import {renderVT} from './ghostty.js';
const host=document.querySelector('#host'), session=document.querySelector('#session'), block=document.querySelector('#block'), screen=document.querySelector('#screen'), status=document.querySelector('#status'), enabled=document.querySelector('#input');
let generation=0, busy=false, last='', queue=Promise.resolve();
async function api(route, target, text) {
 const response=await fetch('/api/'+route+'?'+new URLSearchParams(target),{method:text===undefined?'GET':'POST',headers:{'x-rex-token':window.rexToken},...(text===undefined?{}:{body:JSON.stringify({text})})});
 const data=await response.json();if(!response.ok)throw Error(data.error);return data;
}
function target(){return {host:host.value,session:session.value,block:block.value};}
function options(select,items,key){select.replaceChildren(...items.map(item=>new Option(item.label,item[key])));}
async function loadSessions(){generation++;enabled.checked=false;screen.textContent='';status.textContent='Connecting…';options(session,(await api('sessions',{host:host.value})).sessions,'session_id');await loadBlocks();}
async function loadBlocks(){generation++;enabled.checked=false;last='';if(!session.value)return;options(block,(await api('blocks',target())).blocks.filter(b=>b.creator_name==='com.superlogical.terminal'),'block_id');await update();}
async function update(){if(busy||!block.value)return;busy=true;const version=generation;try{const data=await api('screen',target());if(version!==generation)return;if(data.content!==last){screen.textContent=renderVT(data.content);screen.scrollTop=screen.scrollHeight;last=data.content;}status.textContent=host.selectedOptions[0].text+' / '+session.selectedOptions[0].text+' / '+block.selectedOptions[0].text+' · Connected';}catch(e){status.textContent=e.message;}finally{busy=false;}}
function send(text){if(!enabled.checked){status.textContent='Enable typing before sending input.';return;}const selected=target();queue=queue.then(()=>api('input',selected,text)).then(update).catch(e=>{status.textContent=e.message;enabled.checked=false;});}
screen.addEventListener('keydown',e=>{if(!enabled.checked||e.metaKey)return;let text;const keys={Enter:'\r',Backspace:'\x7f',Tab:'\t',Escape:'\x1b',ArrowUp:'\x1b[A',ArrowDown:'\x1b[B',ArrowRight:'\x1b[C',ArrowLeft:'\x1b[D'};if(e.ctrlKey&&e.key.length===1)text=String.fromCharCode(e.key.toUpperCase().charCodeAt(0)&31);else text=keys[e.key]??(e.key.length===1?e.key:undefined);if(text!==undefined){e.preventDefault();send(text);}});
screen.addEventListener('paste',e=>{if(enabled.checked){e.preventDefault();send(e.clipboardData.getData('text'));}});
document.querySelector('#send').onclick=()=>send(document.querySelector('#command').value+'\r');
function run(fn){fn().catch(e=>status.textContent=e.message);}
host.onchange=()=>run(loadSessions);session.onchange=()=>run(loadBlocks);block.onchange=()=>{generation++;enabled.checked=false;last='';run(update);};document.querySelector('#refresh').onclick=()=>run(loadSessions);
run(loadSessions);setInterval(update,800);
