import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// Images stay out of the 3-second transcript poll: each is replaced by a hash and served once from /api/image.
const images = new Map<string, {mime: string, bytes: Buffer}>();
export function transcriptImage(id: string) { return images.get(id); }
function stash(parsed: {items?: {image?: {mime: string, data: string, id?: string} | string}[]}) {
  for (const item of parsed.items || []) {
    if (!item.image || typeof item.image === 'string') { if (typeof item.image === 'string' && !images.has(item.image)) delete item.image; continue; }
    if (!/^image\/(png|jpeg|gif|webp)$/.test(item.image.mime)) { delete item.image; continue; }
    const bytes = Buffer.from(item.image.data, 'base64');
    const id = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
    if (!images.has(id)) { images.set(id, {mime: item.image.mime, bytes}); if (images.size > 200) images.delete(images.keys().next().value!); }
    item.image = id;
  }
  return parsed;
}
function execute(command:string,args:string[],input?:string):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=execFile(command,args,{timeout:20000,maxBuffer:40*1024*1024},(error,stdout)=>error?reject(Error('Transcript reader failed. Check host access, Node, and the configured agent home.')):resolve(stdout));
  child.stdin?.end(input);
 });
}
export async function transcriptAccess(host:string,session:string,block:string,id?:string){
 const processInfo=JSON.parse(await execute('rex',['-S',host,'block','call','-s',session,'-b',block,'process']));
 const processes=[processInfo.foreground,...(processInfo.ancestors||[]),processInfo.child].filter(Boolean);
 let agent:string|undefined;
 for(const p of processes){
  const executable=[p.script,p.argv0,p.path,p.name].filter(Boolean).join(' ');
  if(/(?:^|[/\s])claude(?:$|[/\s-])|\/claude\/versions\//i.test(executable)){agent='claude';break;}
  if(/(?:^|[/\s])codex(?:$|[/\s-])/i.test(executable)){agent='codex';break;}
  if(/(?:^|[/\s])pi(?:$|[/\s])|pi-coding-agent/i.test(executable)){agent='pi';break;}
 }
 if(!agent)return {agent:null};
 let config;
 try{config=JSON.parse(await readFile(new URL('../../.rex-transcripts.json',import.meta.url),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;config={};}
 // No entry: go through Rex itself, which reaches every computer without extra setup.
 const connection=config[host]||{rex:true};
 const request=Buffer.from(JSON.stringify({agent,cwd:processInfo.foreground?.cwd||processInfo.child?.cwd,pids:processes.map(p=>p.pid),id,known:[...images.keys()]})).toString('base64');
 const key=[host,block,id||''].join('|');
 // One read per pane at a time; a slow remote read is shared by the polls that arrive meanwhile.
 if(!inflight.has(key))inflight.set(key,runProgram(host,session,connection,request).finally(()=>inflight.delete(key)));
 const data=await inflight.get(key);
 return {agent,candidates:data.candidates,selected:data.selected,subagents:data.subagents||[],now:new Date().toISOString(),...stash(data.parsed||{})};
}

const inflight=new Map<string,Promise<any>>();

// The reader and parser run together on the computer that owns the files and send back only the parsed
// conversation, gzipped and base64-framed (ASCII survives a terminal; 26 MB of JSONL becomes ~100 KB).
async function program(){
 const reader=(await readFile(new URL('./transcript-reader.mjs',import.meta.url),'utf8')).replace('export async function readTranscripts','async function readTranscripts');
 const parser=(await readFile(new URL('./transcript-parser.mjs',import.meta.url),'utf8')).replace('export function parseTranscript','function parseTranscript');
 return `import {gzipSync} from 'node:zlib';\nimport {createHash} from 'node:crypto';\n${reader}\n${parser}
const request=JSON.parse(Buffer.from(process.argv.at(-1),'base64').toString());
let out;
try{
 const data=await readTranscripts(request);
 const parsed=typeof data.text==='string'?parseTranscript(data.text,request.agent):undefined;
 const known=new Set(request.known||[]);
 for(const item of parsed?.items||[]){
  if(!item.image||typeof item.image==='string')continue;
  const id=createHash('sha256').update(Buffer.from(item.image.data,'base64')).digest('hex').slice(0,32);
  item.image=known.has(id)?id:{...item.image,id};
 }
 out={candidates:data.candidates,selected:data.selected,subagents:data.subagents,parsed};
}catch(error){out={error:String(error?.message||error)};}
process.stdout.write('\\nREXB64:'+gzipSync(JSON.stringify(out)).toString('base64')+':REXEND\\n');
`;
}
export function decode(output:string){
 const m=output.replace(/\s+/g,'').match(/REXB64:([A-Za-z0-9+/=]+):REXEND/);
 if(!m)throw Error('Transcript reader returned no result. Check that Node is installed on that computer.');
 const data=JSON.parse(gunzipSync(Buffer.from(m[1],'base64')).toString());
 if(data.error)throw Error(data.error);
 return data;
}
async function runProgram(host:string,session:string,connection:{local?:boolean,ssh?:string,rex?:boolean},request:string){
 const source=await program();
 if(connection.local===true)return decode(await execute(process.execPath,['--input-type=module','-',request],source));
 if(typeof connection.ssh==='string'){
  if(!/^([a-zA-Z0-9_.-]+@)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(connection.ssh))throw Error('Invalid transcript SSH configuration');
  return decode(await execute('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5',connection.ssh,'node --input-type=module - '+request],source));
 }
 return decode(await runHidden(host,session,['node','--input-type=module','-e',source,request]));
}

// Run a command in a hidden Rex terminal on that computer (a block that no window shows), wait for the
// end marker, read its output unwrapped, and close it.
export async function runHidden(host:string,session:string,command:string[],timeoutMs=20000,input?:string):Promise<string>{
 const rex=(args:string[])=>execute('rex',['-S',host,...args]);
 const created=JSON.parse(await rex(['api','call','-s',session,'session.new_block',JSON.stringify({session_id:session,flavor:'com.superlogical.terminal.shell',label:'rex-browser reader',options:{command,interactive:true,exit:{on_completion:false},size:{columns:4000,rows:50}}})]));
 const block=created.block_id;
 if(!block)throw Error('Rex could not start a reader on that computer.');
 try{
  const deadline=Date.now()+timeoutMs;
  for(let wait=150;;wait=Math.min(wait*1.5,800)){
   let reply=JSON.parse(await rex(['block','call','-s',session,'-b',block,'format',JSON.stringify({format:'text',unwrap:true,trim:true,max_bytes:983040})]));
   let text=reply.content||'';
   while(reply.id&&!reply.eof){reply=JSON.parse(await rex(['block','call','-s',session,'-b',block,'blob_read',JSON.stringify({id:reply.id})]));text+=reply.content||'';}
   if(text.includes(':REXEND'))return text;
   // A program that reads input prints REXREADY once its terminal is in raw mode; then the input is typed in chunks.
   if(input!==undefined&&text.includes('REXREADY')){
    for(let i=0;i<input.length;i+=60000)await rex(['block','call','-s',session,'-b',block,'write',JSON.stringify({data:input.slice(i,i+60000)})]); // one argument stays under Linux's 128 KB limit
    input=undefined;
   }
   if(Date.now()>deadline)throw Error('Transcript reader timed out on that computer.');
   await new Promise(r=>setTimeout(r,wait));
  }
 }finally{
  rex(['api','call','-s',session,'block.close',JSON.stringify({session_id:session,block_id:block})]).catch(()=>{});
 }
}
