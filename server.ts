import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
const exec = promisify(execFile);
const token = randomBytes(24).toString('hex');
let hosts = new Map<string, {id:string,label:string,online:boolean}>();
const server = createServer(async (req, res) => {
  try {
    if (!['127.0.0.1:4317','localhost:4317'].includes(req.headers.host ?? '')) { res.writeHead(403).end(); return; }
    const url = new URL(req.url!, 'http://127.0.0.1:4317');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-rex-token'] !== token) { res.writeHead(403).end(); return; }
      if(url.pathname === '/api/hosts') {
        const result = await exec('tailscale',['status','--json'],{timeout:10000,maxBuffer:8*1024*1024});
        const state = JSON.parse(result.stdout);
        if(state.BackendState !== 'Running')throw Error('Tailscale is not connected. Connect it and click Refresh.');
        const discovered = Object.values(state.Peer ?? {}).flatMap((value: unknown)=>{
          const peer = value as {DNSName?:string,HostName?:string,Tags?:string[],Online?:boolean};
          if(!peer.Tags?.includes('tag:rex') || !peer.DNSName)return [];
          const id=peer.DNSName.replace(/\.$/,'');
          if(!/^[a-zA-Z0-9.-]+$/.test(id))return [];
          return [{id,label:peer.HostName || id,online:peer.Online===true}];
        }).sort((a,b)=>a.label.localeCompare(b.label));
        hosts = new Map(discovered.map(h=>[h.id,h]));
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({hosts:discovered}));return;
      }
      const host = url.searchParams.get('host');
      if (!host || !hosts.has(host)) throw Error('Choose a discovered Rex host. Click Refresh to update the list.');
      if(!hosts.get(host)!.online)throw Error('This Rex host is offline. Click Refresh after it reconnects.');
      const args = ['-S', host];
      const session = url.searchParams.get('session');
      const block = url.searchParams.get('block');
      const id = /^(session|block):[a-zA-Z0-9-]+$/;
      if (session && !id.test(session) || block && !id.test(block)) throw Error('Invalid target');
      switch (url.pathname) {
        case '/api/sessions': args.push('ls', '--json'); break;
        case '/api/blocks':
          if (!session) throw Error('Select a session');
          {
          const run = async (extra: string[]) => JSON.parse((await exec('rex',[...args,...extra],{timeout:15000,maxBuffer:8*1024*1024})).stdout);
          const [listing, tabs] = await Promise.all([run(['block','ls','-s',session,'--json']),run(['window','ls','-s',session,'--json'])]);
          const windows = new Map(tabs.windows.map((w: {window_id:string,label:string})=>[w.window_id,w.label]));
          const blocks = await Promise.all(listing.blocks.map(async (b: {block_id:string,label:string,window_id?:string,creator_name:string})=>{
            if(b.creator_name !== 'com.superlogical.terminal')return b;
            let title = '';
            try { title = (await run(['block','call','-s',session!,'-b',b.block_id,'title'])).title; } catch { /* Closed panes still retain their fallback label. */ }
            return {...b, terminal_title:title, window_label:windows.get(b.window_id), label:[windows.get(b.window_id),title || b.label,b.block_id.slice(-6)].filter(Boolean).join(' / ')};
          }));
          res.setHeader('Content-Type','application/json');res.end(JSON.stringify({blocks, windows:tabs.windows}));return;
          }
        case '/api/new-tab': {
          if(req.method !== 'POST' || !session)throw Error('Select a session');
          let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Tab name too long');}
          const data=JSON.parse(body);
          if(typeof data.text!=='string'||!data.text.trim()||data.text.length>128)throw Error('Enter a tab name (1–128 characters)');
          args.push('api','call','-s',session,'session.new_window',JSON.stringify({session_id:session,focus:false,window_label:data.text.trim(),layout:{block:{flavor:'com.superlogical.terminal.shell'}}}));
          break;
        }
        case '/api/screen':
          if (!session || !block) throw Error('Select a pane');
          args.push('block','call','-s',session,'-b',block,'format',JSON.stringify({format:'vt',extra_cursor:true})); break;
        case '/api/input': {
          if (req.method !== 'POST' || !session || !block) throw Error('Invalid input request');
          let body = ''; for await (const chunk of req) { body += chunk; if(body.length > 65536) throw Error('Input too large'); }
          const data = JSON.parse(body);
          if (typeof data.text !== 'string') throw Error('Invalid text');
          args.push('block','call','-s',session,'-b',block,'write',JSON.stringify({data:data.text})); break;
        }
        default: res.writeHead(404).end(); return;
      }
      const result = await exec('rex', args, {timeout:15000,maxBuffer:8*1024*1024});
      res.setHeader('Content-Type','application/json'); res.end(result.stdout); return;
    }
    const files = {'/':'index.html','/client.js':'client.js','/ghostty.js':'ghostty.js','/ghostty-vt.wasm':'ghostty-vt.wasm'};
    if (!(url.pathname in files)) {res.writeHead(404).end(); return;}
    const file = files[url.pathname as keyof typeof files];
    let content = await readFile(new URL('./public/'+file, import.meta.url));
    if(file === 'index.html') content = Buffer.from(content.toString().replace('__TOKEN__',token));
    res.setHeader('Content-Type',file.endsWith('wasm')?'application/wasm':file.endsWith('js')?'text/javascript':'text/html');
    res.end(content);
  } catch (error) { res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:error instanceof Error ? error.message : 'Request failed'})); }
});
server.listen(4317,'127.0.0.1',()=>console.log('Rex browser: http://127.0.0.1:4317'));
