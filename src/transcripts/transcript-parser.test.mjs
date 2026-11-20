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
