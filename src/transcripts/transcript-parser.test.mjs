import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTranscript} from './transcript-parser.mjs';
const jsonl=rows=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
test('Claude follows the active branch, excludes sidechains and shows tool calls/results',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'user',message:{role:'user',content:'hello'}},{uuid:'old',parentUuid:'a',type:'assistant',message:{role:'assistant',content:'abandoned'}},{uuid:'new',parentUuid:'a',type:'assistant',message:{role:'assistant',content:[{type:'tool_use',id:'call',name:'Read',input:{file:'example.ts'}}]}},{uuid:'result',parentUuid:'new',type:'user',message:{role:'user',content:[{type:'tool_result',tool_use_id:'call',content:'contents'}]}},{uuid:'side',parentUuid:null,isSidechain:true,message:{role:'assistant',content:'hidden'}}];
 const {items}=parseTranscript(jsonl(rows),'claude');assert.deepEqual(items.map(i=>i.role),['user','tool','result']);assert(!JSON.stringify(items).includes('abandoned'));
});
test('Codex uses response items without duplicating event messages',()=>{
 const {items}=parseTranscript(jsonl([{type:'event_msg',payload:{type:'agent_message',message:'answer'}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'answer'}]}},{type:'response_item',payload:{type:'function_call',name:'exec',arguments:'{"cmd":"pwd"}',call_id:'1'}},{type:'response_item',payload:{type:'function_call_output',call_id:'1',output:'/project'}}]),'codex');assert.deepEqual(items.map(i=>i.role),['assistant','tool','result']);assert.equal(items[0].text,'answer');
});
test('Pi follows parent IDs and preserves compaction boundaries',()=>{
 const {items}=parseTranscript(jsonl([{type:'session',id:'session',cwd:'/project'},{type:'message',id:'a',parentId:null,message:{role:'user',content:'first'}},{type:'message',id:'b',parentId:'a',message:{role:'assistant',content:'discarded branch'}},{type:'compaction',id:'c',parentId:'a',summary:'Earlier context'},{type:'message',id:'d',parentId:'c',message:{role:'assistant',content:[{type:'text',text:'current'}]}}]),'pi');assert.deepEqual(items.map(i=>i.text),['first','Earlier context','current']);
});
test('an incomplete appended line waits until newline; malformed complete lines are reported',()=>{
 const good=jsonl([{type:'response_item',payload:{type:'message',role:'user',content:'hi'}}]);const result=parseTranscript(good+'not json\n{"type":','codex');assert.equal(result.items.length,1);assert.equal(result.warnings.length,2);
});
test('hostile transcript text remains text, never markup',()=>{
 const {items}=parseTranscript(jsonl([{type:'response_item',payload:{type:'message',role:'assistant',content:'<script>alert(1)</script>'}}]),'codex');assert.equal(items[0].text,'<script>alert(1)</script>');
});
test('Claude slash commands, mid-turn messages and image tags read as plain user messages',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'user',message:{role:'user',content:'<command-message>design</command-message>\n<command-name>/design</command-name>\n<command-args>redo the ui</command-args>'}},{uuid:'b',parentUuid:'a',type:'attachment',attachment:{type:'queued_command',prompt:'and the toggle [Image #2]',humanTurn:true}},{uuid:'c',parentUuid:'b',type:'attachment',attachment:{type:'queued_command',prompt:'<task-notification><tool-use-id>t1</tool-use-id><status>completed</status></task-notification>',humanTurn:true}}];
 const {items,finished}=parseTranscript(jsonl(rows),'claude');
 assert.deepEqual(items.map(i=>[i.name,i.text]),[['/design','redo the ui'],['','and the toggle']]);
 assert.deepEqual(finished,{t1:'completed'});
});
test('Claude is working until the turn_duration record',()=>{
 const base=[{uuid:'a',parentUuid:null,type:'user',timestamp:'2026-11-20T10:00:00Z',message:{role:'user',content:'go'}},{uuid:'b',parentUuid:'a',type:'assistant',message:{role:'assistant',content:[{type:'tool_use',id:'x',name:'Bash',input:{}}]}}];
 const busy=parseTranscript(jsonl(base),'claude');assert.equal(busy.working,true);assert.equal(busy.since,'2026-11-20T10:00:00Z');
 const idle=parseTranscript(jsonl([...base,{uuid:'c',parentUuid:'b',type:'system',subtype:'turn_duration'}]),'claude');assert.equal(idle.working,false);
});
test('a parallel tool result on a sibling branch is kept',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'user',timestamp:'1',message:{role:'user',content:'go'}},{uuid:'b',parentUuid:'a',type:'assistant',timestamp:'2',message:{role:'assistant',content:[{type:'tool_use',id:'p1',name:'Bash',input:{}},{type:'tool_use',id:'p2',name:'Bash',input:{}}]}},{uuid:'r1',parentUuid:'b',type:'user',timestamp:'3',message:{role:'user',content:[{type:'tool_result',tool_use_id:'p1',content:'one'}]}},{uuid:'r2',parentUuid:'b',type:'user',timestamp:'4',message:{role:'user',content:[{type:'tool_result',tool_use_id:'p2',content:'two'}]}},{uuid:'d',parentUuid:'r2',type:'assistant',timestamp:'5',message:{role:'assistant',content:'done'}}];
 const {items}=parseTranscript(jsonl(rows),'claude');assert.deepEqual(items.filter(i=>i.role==='result').map(i=>i.text).sort(),['one','two']);
});
test('a mid-turn message with an image keeps its text and an image item',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'attachment',attachment:{type:'queued_command',humanTurn:true,prompt:[{type:'text',text:'[Image #5] Can you see this'},{type:'image',source:{type:'base64',data:'x'}}]}}];
 const {items}=parseTranscript(jsonl(rows),'claude');assert.deepEqual(items.map(i=>[i.role,i.text]),[['user','Can you see this'],['attachment','Image']]);
});
test('two messages queued in one turn both show, and a later notification does not mean working',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'user',timestamp:'1',message:{role:'user',content:'go'}},{uuid:'q1',parentUuid:'a',type:'attachment',timestamp:'2',attachment:{type:'queued_command',humanTurn:true,prompt:'one'}},{uuid:'q2',parentUuid:'a',type:'attachment',timestamp:'3',attachment:{type:'queued_command',humanTurn:true,prompt:'two'}},{uuid:'b',parentUuid:'q2',type:'assistant',timestamp:'4',message:{role:'assistant',content:'ok'}},{uuid:'t',parentUuid:'b',type:'system',subtype:'turn_duration',timestamp:'5'},{uuid:'n',parentUuid:'t',type:'user',timestamp:'6',message:{role:'user',content:'<task-notification><tool-use-id>x</tool-use-id><status>completed</status></task-notification>'}}];
 const r=parseTranscript(jsonl(rows),'claude');assert.deepEqual(r.items.filter(i=>i.role==='user').map(i=>i.text),['go','one','two']);assert.equal(r.working,false);
});
test('uploaded file paths become file attachments',()=>{
 const rows=[{uuid:'a',parentUuid:null,type:'user',message:{role:'user',content:'/home/u/.local/state/rex-browser/uploads/0f3a-11/notes.md What is in it?'}}];
 const {items}=parseTranscript(jsonl(rows),'claude');assert.deepEqual(items.map(i=>[i.role,i.text,i.name]),[['user','What is in it?',''],['attachment','notes.md','file']]);
});
test('Codex injected context is not shown as user messages',()=>{
 const {items}=parseTranscript(jsonl([{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'# AGENTS.md instructions\n\n<INSTRUCTIONS>x</INSTRUCTIONS>'},{type:'input_text',text:'<environment_context>\n<cwd>/p</cwd>\n</environment_context>'}]}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'hi'}]}}]),'codex');
 assert.deepEqual(items.map(i=>i.text),['hi']);
});
test('a failed Pi reply shows its error',()=>{
 const {items}=parseTranscript(jsonl([{type:'message',id:'a',parentId:null,message:{role:'user',content:'hi'}},{type:'message',id:'b',parentId:'a',message:{role:'assistant',content:[],stopReason:'error',errorMessage:'Token refresh failed (401): {\n  "error": {"message": "Please sign in again."}}'}}]),'pi');
 assert.deepEqual(items.map(i=>[i.role,i.text]),[['user','hi'],['error','Token refresh failed (401): Please sign in again.']]);
});
