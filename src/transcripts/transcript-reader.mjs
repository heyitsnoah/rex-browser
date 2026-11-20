// Runs on the machine that owns the agent; reads only approved transcript roots.
import {readdir,open,readFile,realpath,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const request=JSON.parse(Buffer.from(process.argv[2],'base64').toString());
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
  else if(entry.isFile()&&entry.name.endsWith('.jsonl'))files.push(file);
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
const candidates=[];
for(const file of files){
 const handle=await open(file,'r');let prefix;
 try{const buf=Buffer.alloc(65536);const {bytesRead}=await handle.read(buf,0,buf.length,0);prefix=buf.subarray(0,bytesRead).toString();}finally{await handle.close();}
 const rows=prefix.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
 const meta=rows.find(r=>r.type==='session_meta')?.payload || rows.find(r=>r.type==='session') || rows.find(r=>r.cwd) || {};
 const exact=(exactId&&path.basename(file)===exactId+'.jsonl')||openPaths.includes(file);
 if(!exact&&meta.cwd!==request.cwd)continue;
 const info=await stat(file);
 candidates.push({id:Buffer.from(path.relative(root,file)).toString('base64url'),sessionId:meta.sessionId||meta.id||path.basename(file,'.jsonl'),modified:info.mtime.toISOString(),exact:Boolean(exact)});
}
candidates.sort((a,b)=>b.modified.localeCompare(a.modified));
const exact=candidates.filter(c=>c.exact);
const chosen=request.id?candidates.find(c=>c.id===request.id):exact.length===1?exact[0]:undefined;
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
console.log(JSON.stringify({candidates:candidates.slice(0,100),selected:chosen?.id,text}));
