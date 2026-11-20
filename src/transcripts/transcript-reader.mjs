// Runs on the machine that owns the agent; reads only approved transcript roots.
import {readdir,open,readFile,realpath,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
// Exported as one function so the same code runs locally, over SSH, or in a hidden Rex terminal (see transcript-access.ts).
export async function readTranscripts(request){
if(!['claude','codex','pi'].includes(request.agent))throw Error('Unknown agent');
const home=homedir();
const root=path.join(home,{claude:'.claude/projects',codex:'.codex/sessions',pi:'.pi/agent/sessions'}[request.agent]);
const files=[];let visited=0;
async function walk(dir,depth=0){
 if(depth>6)return;
 for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])){
  if(++visited>20000)throw Error('Transcript discovery limit reached.');
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())await walk(file,depth+1);
  else if(entry.isFile()&&entry.name.endsWith('.jsonl')&&!dir.endsWith(path.sep+'subagents'))files.push(file);
 }
}
await walk(root);
let exactId='';
for(const pid of request.pids || []){
 if(!Number.isSafeInteger(pid)||pid<=0)continue;
 if(request.agent==='claude'){
  try{const info=JSON.parse(await readFile(path.join(home,'.claude/sessions',pid+'.json'),'utf8'));if(info.sessionId)exactId=info.sessionId;}catch{}
 }
}
let openPaths=[];
try{
 const pids=(request.pids||[]).filter(p=>Number.isSafeInteger(p)&&p>0);
 if(pids.length)openPaths=execFileSync('lsof',['-a','-p',pids.join(','),'-Fn'],{timeout:2000,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\n').filter(l=>l.startsWith('n')).map(l=>l.slice(1));
}catch{}
// When the agent process started (seconds ago, via ps; works on Linux and macOS).
let started=0;
try{
 const pid=(request.pids||[]).find(p=>Number.isSafeInteger(p)&&p>0);
 // etime is [[dd-]hh:]mm:ss on both Linux and macOS (etimes is Linux-only).
 const m=pid&&execFileSync('ps',['-o','etime=','-p',String(pid)],{timeout:2000,encoding:'utf8'}).trim().match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/);
 if(m)started=Date.now()-(((Number(m[1]||0)*24+Number(m[2]||0))*60+Number(m[3]))*60+Number(m[4]))*1000;
}catch{}
const candidates=[];
for(const file of files){
 const handle=await open(file,'r');let prefix;
 try{const buf=Buffer.alloc(65536);const {bytesRead}=await handle.read(buf,0,buf.length,0);prefix=buf.subarray(0,bytesRead).toString();}finally{await handle.close();}
 const rows=prefix.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
 const meta=rows.find(r=>r.type==='session_meta')?.payload || rows.find(r=>r.type==='session') || rows.find(r=>r.cwd) || {};
 const exact=(exactId&&path.basename(file)===exactId+'.jsonl')||openPaths.includes(file);
 if(!exact&&meta.cwd!==request.cwd)continue;
 const info=await stat(file);
 const created=info.birthtimeMs>0?info.birthtimeMs:info.mtimeMs;
 candidates.push({id:Buffer.from(path.relative(root,file)).toString('base64url'),sessionId:meta.sessionId||meta.id||path.basename(file,'.jsonl'),modified:info.mtime.toISOString(),created,exact:Boolean(exact)});
}
candidates.sort((a,b)=>b.modified.localeCompare(a.modified));
const exact=candidates.filter(c=>c.exact);
// No exact match (Codex, Pi): the newest transcript in this project created after the agent started is the live one.
const since=started?candidates.filter(c=>c.created>=started-10000).sort((a,b)=>b.created-a.created):[];
const chosen=request.id?candidates.find(c=>c.id===request.id):exact.length===1?exact[0]:since[0];
let text;
if(chosen){
 const file=await realpath(path.join(root,Buffer.from(chosen.id,'base64url').toString()));
 const canonicalRoot=await realpath(root);
 if(!file.startsWith(canonicalRoot+path.sep))throw Error('Transcript is outside the permitted root.');
 const handle=await open(file,'r');try{
 const info=await handle.stat();if(info.size>32*1024*1024)throw Error('Transcript exceeds the 32 MiB reader limit.');
 text=await handle.readFile('utf8');
 }finally{await handle.close();}
}
// Claude subagents: <session>/subagents/agent-<id>.jsonl with a .meta.json beside it.
async function subagents(file){
 const dir=file.replace(/\.jsonl$/,'')+path.sep+'subagents';
 const out=[];
 for(const name of (await readdir(dir).catch(()=>[])).filter(n=>n.endsWith('.meta.json')).slice(-20)){
  try{
   const meta=JSON.parse(await readFile(path.join(dir,name),'utf8'));
   const log=path.join(dir,name.replace(/\.meta\.json$/,'.jsonl'));
   const info=await stat(log);
   const handle=await open(log,'r');let body;
   try{const size=Math.min(info.size,4*1024*1024);const buf=Buffer.alloc(size);await handle.read(buf,0,size,info.size-size);body=buf.toString();}finally{await handle.close();}
   const rows=body.split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
   const steps=[];let started='',lastAssistant;
   for(const r of rows){
    if(!started&&r.timestamp)started=r.timestamp;
    if(r.type!=='assistant')continue;lastAssistant=r;
    for(const part of Array.isArray(r.message?.content)?r.message.content:[])if(part.type==='tool_use')steps.push({tool:part.name,input:part.input,time:r.timestamp});
   }
   const done=Boolean(lastAssistant)&&!(lastAssistant.message?.content||[]).some(p=>p.type==='tool_use')&&lastAssistant.message?.stop_reason!=null;
   out.push({toolUseId:meta.toolUseId,description:meta.description,type:meta.agentType,background:meta.requestShape==='background',started,updated:info.mtime.toISOString(),done,tools:steps.length,recent:steps.slice(-4)});
  }catch{}
 }
 return out;
}
let agents=[];
if(chosen&&request.agent==='claude')agents=await subagents(await realpath(path.join(root,Buffer.from(chosen.id,'base64url').toString())));
return {candidates:candidates.slice(0,100),selected:chosen?.id,text,subagents:agents};
}
