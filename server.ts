import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
const exec = promisify(execFile);
const token = randomBytes(24).toString('hex');
const hosts = { mini: 'rex-mini.taila2391.ts.net', spark: 'rex-spark.taila2391.ts.net' };
const server = createServer(async (req, res) => {
  try {
    if (!['127.0.0.1:4317','localhost:4317'].includes(req.headers.host ?? '')) { res.writeHead(403).end(); return; }
    const url = new URL(req.url!, 'http://127.0.0.1:4317');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-rex-token'] !== token) { res.writeHead(403).end(); return; }
      const host = url.searchParams.get('host');
      if (host !== 'mini' && host !== 'spark') throw Error('Choose a host');
      const args = ['-S', hosts[host]];
      const session = url.searchParams.get('session');
      const block = url.searchParams.get('block');
      const id = /^(session|block):[a-zA-Z0-9-]+$/;
      if (session && !id.test(session) || block && !id.test(block)) throw Error('Invalid target');
      switch (url.pathname) {
        case '/api/sessions': args.push('ls', '--json'); break;
        case '/api/blocks':
          if (!session) throw Error('Select a session');
          args.push('block','ls','-s',session,'--json'); break;
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
