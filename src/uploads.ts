// Writes an uploaded file on the computer that runs the pane, so its path can be pasted into the pane.
// Uses the same per-host access as transcripts (.rex-transcripts.json): `local` or an SSH alias.
// Computers without an entry go through Rex: a hidden terminal there receives the file as typed base64.
// (Rex's own upload_begin needs its binary data protocol, which isn't documented yet.)
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {runHidden, decode} from './transcripts/transcript-access.ts';

export const UPLOAD_LIMIT = 25 * 1024 * 1024;

function safeName(name: string) {
  const base = path.basename(name).replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(-120);
  return base || 'upload';
}

async function connection(host: string) {
  let config: Record<string, {local?: boolean, ssh?: string}> = {};
  try { config = JSON.parse(await readFile(new URL('../.rex-transcripts.json', import.meta.url), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return config[host];
}

export async function uploadAvailable(_host: string) { return true; }

// Runs in the hidden terminal: raw mode (no echo, no line limits), read base64 until '.', write the file, report the path.
const RECEIVER = `import {mkdirSync,writeFileSync} from 'node:fs';import {homedir} from 'node:os';import {randomUUID} from 'node:crypto';import {gzipSync} from 'node:zlib';import path from 'node:path';
const name=process.argv.at(-1);let buf='';
process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('\\nREXREADY\\n');
process.stdin.on('data',d=>{buf+=d.toString('latin1');const end=buf.indexOf('.');if(end<0)return;
 const dir=path.join(homedir(),'.local/state/rex-browser/uploads',randomUUID());mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,name);writeFileSync(file,Buffer.from(buf.slice(0,end),'base64'),{mode:0o600});
 process.stdout.write('\\nREXB64:'+gzipSync(JSON.stringify({path:file})).toString('base64')+':REXEND\\n');process.exit(0);});`;

export async function upload(host: string, name: string, bytes: Buffer, session = ''): Promise<string> {
  const target = await connection(host);
  if (!target) {
    if (!session) throw Error('Select a pane first.');
    const output = await runHidden(host, session, ['node', '--input-type=module', '-e', RECEIVER, safeName(name)], 120000, bytes.toString('base64') + '.');
    return decode(output).path;
  }
  const dir = `.local/state/rex-browser/uploads/${randomUUID()}`, file = safeName(name);
  if (target.local === true) {
    const full = path.join(homedir(), dir);
    await mkdir(full, {recursive: true, mode: 0o700});
    await writeFile(path.join(full, file), bytes, {mode: 0o600});
    return path.join(full, file);
  }
  if (typeof target.ssh !== 'string' || !/^([a-zA-Z0-9_.-]+@)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(target.ssh)) throw Error('Invalid upload SSH configuration');
  // dir and file contain only [\w./-], so double quotes are safe here.
  const script = `umask 077 && mkdir -p "$HOME/${dir}" && cat > "$HOME/${dir}/${file}" && printf %s "$HOME/${dir}/${file}"`;
  return new Promise((resolve, reject) => {
    const child = execFile('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=5', target.ssh!, script], {timeout: 60000, maxBuffer: 1024 * 1024},
      (error, stdout) => error ? reject(Error('Upload failed. Check SSH access to this computer.')) : resolve(stdout.trim()));
    child.stdin?.end(bytes);
  });
}
