import {transcriptAccess, transcriptImage} from './src/transcripts/transcript-access.ts';
import {upload, uploadAvailable, UPLOAD_LIMIT} from './src/uploads.ts';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
const exec = promisify(execFile);
// The page token survives restarts (private file), so open pages keep working when the bridge restarts.
const tokenFile = homedir() + '/.local/state/rex-browser/token';
const token = await readFile(tokenFile, 'utf8').then(t => t.trim()).catch(() => '') || await (async () => {
  const fresh = randomBytes(24).toString('hex');
  await mkdir(homedir() + '/.local/state/rex-browser', {recursive: true, mode: 0o700});
  await writeFile(tokenFile, fresh, {mode: 0o600});
  return fresh;
})();
if (!/^[a-f0-9]{48}$/.test(token)) throw Error('Invalid token file: ' + tokenFile);
const port = Number(process.env.REX_BROWSER_PORT) || 4317;
const tailnetHost = process.env.REX_BROWSER_HOST ?? '', tailnetLogin = process.env.REX_BROWSER_LOGIN ?? '';
let hosts = new Map<string, {id:string,label:string,online:boolean}>();
async function discover() {
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
  return discovered;
}
const server = createServer(async (req, res) => {
  try {
    // Loopback is always allowed. A tailnet name is allowed only when REX_BROWSER_HOST and
    // REX_BROWSER_LOGIN are set and Tailscale Serve reports that login for the request.
    const requestHost = req.headers.host ?? '';
    const viaTailnet = Boolean(tailnetHost && tailnetLogin) && requestHost === tailnetHost && req.headers['tailscale-user-login'] === tailnetLogin;
    if (!['127.0.0.1:'+port,'localhost:'+port].includes(requestHost) && !viaTailnet) { res.writeHead(403).end(); return; }
    const url = new URL(req.url!, 'http://127.0.0.1:'+port);
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-rex-token'] !== token) { res.writeHead(403).end(); return; }
      if(url.pathname === '/api/hosts') {
        const discovered = await discover();
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({hosts:discovered}));return;
      }
      if (url.pathname === '/api/image') {
        const image = transcriptImage(url.searchParams.get('id') || '');
        if (!image) { res.writeHead(404).end(); return; }
        res.writeHead(200, {'Content-Type': image.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff'}).end(image.bytes); return;
      }
      const host = url.searchParams.get('host');
      // After a restart the first request may come before the page asks for hosts: discover on demand.
      if (host && !hosts.has(host)) await discover();
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
        case '/api/transcript':
          if(!session || !block)throw Error('Select a pane');
          res.setHeader('Content-Type','application/json');
          res.end(JSON.stringify(await transcriptAccess(host,session,block,url.searchParams.get('transcript') || undefined)));return;
        case '/api/upload': {
          if (req.method !== 'POST') throw Error('Invalid upload request');
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > UPLOAD_LIMIT) throw Error('File is larger than 25 MB'); chunks.push(chunk); }
          res.setHeader('Content-Type','application/json');
          res.end(JSON.stringify({path: await upload(host, url.searchParams.get('name') || 'upload', Buffer.concat(chunks), session || '')})); return;
        }
        case '/api/upload-available':
          res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({available: await uploadAvailable(host)})); return;
        case '/api/paste': {
          if (req.method !== 'POST' || !session || !block) throw Error('Invalid paste request');
          let body = ''; for await (const chunk of req) { body += chunk; if(body.length > 65536) throw Error('Paste too large'); }
          const data = JSON.parse(body);
          if (typeof data.text !== 'string') throw Error('Invalid text');
          args.push('api','call','-s',session,'block.event',JSON.stringify({session_id:session,block_id:block,event:{type:'paste',payload:{text:data.text}}})); break;
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
    const files = {'/':'index.html','/client.js':'client.js','/conversation.js':'conversation.js','/ghostty.js':'ghostty.js','/ghostty-vt.wasm':'ghostty-vt.wasm','/vendor/words/no-math.js':'vendor/words/no-math.js','/vendor/words/core.js':'vendor/words/core.js','/vendor/words/words-no-math.wasm.mjs':'vendor/words/words-no-math.wasm.mjs'};
    if (!(url.pathname in files)) {res.writeHead(404).end(); return;}
    const file = files[url.pathname as keyof typeof files];
    let content = await readFile(new URL('./public/'+file, import.meta.url));
    if(file === 'index.html') content = Buffer.from(content.toString().replace('__TOKEN__',token));
    res.setHeader('Content-Type',file.endsWith('wasm')?'application/wasm':file.endsWith('js')?'text/javascript':'text/html');
    res.end(content);
  } catch (error) { res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:error instanceof Error ? error.message : 'Request failed'})); }
});
server.listen(port,'127.0.0.1',()=>console.log('Rex browser: http://127.0.0.1:'+port));
