import {renderVT} from './ghostty.js';
const host=document.querySelector('#host'), session=document.querySelector('#session'), tab=document.querySelector('#tab'), block=document.querySelector('#block'), screen=document.querySelector('#screen'), status=document.querySelector('#status'), enabled=document.querySelector('#input'), feedback=document.querySelector('#feedback'), command=document.querySelector('#command'), sendButton=document.querySelector('#send');
let generation=0,busy=false,queue=Promise.resolve(),listing={blocks:[],windows:[]};
async function api(route,target,text){
 const response=await fetch('/api/'+route+'?'+new URLSearchParams(target),{method:text===undefined?'GET':'POST',headers:{'x-rex-token':window.rexToken},...(text===undefined?{}:{body:JSON.stringify({text})})});
 const data=await response.json().catch(()=>({error:'Request failed ('+response.status+'). Refresh this page.'}));
 if(!response.ok)throw Error(data.error);return data;
}
function target(){return {host:host.value,session:session.value,block:block.value};}
function options(select,items,key){select.replaceChildren(...items.map(item=>new Option(item.label,item[key])));}
async function loadSessions(){
 const version=++generation;enabled.checked=false;screen.replaceChildren();session.replaceChildren();tab.replaceChildren();block.replaceChildren();status.textContent='Connecting…';
 const data=await api('sessions',{host:host.value});if(version!==generation)return;
 options(session,data.sessions,'session_id');await loadBlocks();
}
async function loadBlocks(preferred){
 const version=++generation;enabled.checked=false;screen.replaceChildren();tab.replaceChildren();block.replaceChildren();
 if(!session.value){status.textContent='No sessions on this host.';return;}status.textContent='Loading tabs…';
 const data=await api('blocks',{host:host.value,session:session.value});if(version!==generation)return;listing=data;
 options(tab,data.windows,'window_id');if(preferred&&data.windows.some(w=>w.window_id===preferred))tab.value=preferred;showTab();
}
function selectPane(id){if(block.value!==id)generation++;block.value=id;enabled.checked=false;for(const pane of screen.children)pane.classList.toggle('active',pane.dataset.block===id);}
function showTab(){
 generation++;enabled.checked=false;screen.replaceChildren();
 const current=listing.windows.find(w=>w.window_id===tab.value);
 const panes=listing.blocks.filter(b=>b.window_id===tab.value&&b.creator_name==='com.superlogical.terminal');
 options(block,panes.map(b=>({...b,label:(b.terminal_title||b.label)+' · '+b.block_id.slice(-6)})),'block_id');
 if(!current){status.textContent='No tabs in this session.';return;}
 function draw(node){
  if(node.split){draw(node.split.before);draw(node.split.after);return;}
  const item=panes.find(b=>b.block_id===node.block_id);if(!item)return;
  const pane=document.createElement('section');pane.className='pane';pane.dataset.block=item.block_id;
  const [x,y,w,h]=node.rect;Object.assign(pane.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});
  const label=document.createElement('button');label.textContent=item.terminal_title||item.label;label.onclick=()=>{selectPane(item.block_id);pre.focus();};
  const pre=document.createElement('pre');pre.tabIndex=0;pre.setAttribute('aria-label',label.textContent);pre.onfocus=()=>{if(block.value!==item.block_id)selectPane(item.block_id);};
  pane.append(label,pre);screen.append(pane);
 }
 for(const layer of current.layers.filter(l=>l.kind==='tiled'))draw(layer.layout);
 selectPane(panes.some(p=>p.block_id===current.focused_block_id)?current.focused_block_id:panes[0]?.block_id||'');
 status.textContent=screen.children.length?'Loading terminal output…':'No terminal panes in this tab.';run(update);
}
async function update(){
 if(busy||!screen.children.length)return;busy=true;const version=generation;const selected=target();
 try{await Promise.all([...screen.children].map(async pane=>{
  const data=await api('screen',{...selected,block:pane.dataset.block});if(version!==generation)return;
  if(data.content!==pane.lastContent){const pre=pane.querySelector('pre');const follow=pre.scrollHeight-pre.scrollTop-pre.clientHeight<30;pre.textContent=renderVT(data.content);if(follow)pre.scrollTop=pre.scrollHeight;pane.lastContent=data.content;}
 }));if(version===generation)status.textContent=host.selectedOptions[0].text+' / '+session.selectedOptions[0].text+' / '+tab.selectedOptions[0].text+' · Connected';
 }catch(e){if(version===generation)status.textContent=e.message;}finally{busy=false;}
}
function send(text){
 const selected=target();if(!selected.block)return Promise.reject(Error('Select a terminal pane.'));
 const version=generation;
 const task=queue.then(()=>{if(version!==generation)throw Error('Pane changed; input was not sent.');return api('input',selected,text);});
 queue=task.catch(()=>{});return task;
}
sendButton.onclick=async()=>{
 if(!command.value)return;const text=command.value;sendButton.disabled=true;feedback.textContent='Sending…';
 try{await send(text+'\r');if(command.value===text)command.value='';feedback.textContent='Sent to Rex.';await update();}
 catch(e){feedback.textContent='Send failed: '+e.message;}finally{sendButton.disabled=false;}
};
command.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(!sendButton.disabled)sendButton.click();}};
screen.addEventListener('keydown',e=>{
 if(e.target.tagName!=='PRE'||!enabled.checked||e.metaKey)return;
 const keys={Enter:'\r',Backspace:'\x7f',Tab:'\t',Escape:'\x1b',ArrowUp:'\x1b[A',ArrowDown:'\x1b[B',ArrowRight:'\x1b[C',ArrowLeft:'\x1b[D'};
 let text=e.ctrlKey&&e.key.length===1?String.fromCharCode(e.key.toUpperCase().charCodeAt(0)&31):keys[e.key]??(e.key.length===1?e.key:undefined);
 if(text!==undefined){e.preventDefault();send(text).catch(e=>feedback.textContent='Input failed: '+e.message);}
});
screen.addEventListener('paste',e=>{if(e.target.tagName==='PRE'&&enabled.checked){e.preventDefault();send(e.clipboardData.getData('text')).catch(e=>feedback.textContent=e.message);}});
document.querySelector('#new-tab').onclick=async()=>{
 if(!session.value)return;const name=prompt('New Rex tab name','Terminal');if(!name?.trim())return;
 const button=document.querySelector('#new-tab'),selected=target(),version=generation;button.disabled=true;feedback.textContent='Creating tab…';
 try{const result=await api('new-tab',selected,name);feedback.textContent='Tab created.';if(version===generation)await loadBlocks(result.window_id);}
 catch(e){feedback.textContent='Could not create tab: '+e.message;}finally{button.disabled=false;}
};
function run(fn){fn().catch(e=>feedback.textContent=e.message);}
host.onchange=()=>run(loadSessions);session.onchange=()=>run(loadBlocks);tab.onchange=showTab;block.onchange=()=>selectPane(block.value);
document.querySelector('#refresh').onclick=()=>run(()=>loadBlocks(tab.value));
run(loadSessions);setInterval(update,800);
