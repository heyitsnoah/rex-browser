import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {parseTranscript} from './transcript-parser.mjs';
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
 const connection=config[host];
 if(!connection)return {agent,unavailable:'Transcript access is not configured for this computer. Terminal is still available.'};
 const request=Buffer.from(JSON.stringify({agent,cwd:processInfo.foreground?.cwd||processInfo.child?.cwd,pids:processes.map(p=>p.pid),id})).toString('base64');
 let output;
 if(connection.local===true)output=await execute(process.execPath,[new URL('./transcript-reader.mjs',import.meta.url).pathname,request]);
 else{
  if(typeof connection.ssh!=='string'||!/^([a-zA-Z0-9_.-]+@)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(connection.ssh))throw Error('Invalid transcript SSH configuration');
  const source=await readFile(new URL('./transcript-reader.mjs',import.meta.url),'utf8');
  output=await execute('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5',connection.ssh,'node --input-type=module - '+request],source);
 }
 const data=JSON.parse(output);
 return {agent,candidates:data.candidates,selected:data.selected,...(typeof data.text==='string'?parseTranscript(data.text,agent):{})};
}
