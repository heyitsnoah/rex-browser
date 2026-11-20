import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'

import { runHidden } from '@/rex/hidden-terminal'
import { readConnection } from '@/rex/rex-connections'

export const UPLOAD_LIMIT = 25 * 1024 * 1024

// Runs in a hidden terminal: raw mode (no echo, no line limit), reads base64 until '.', writes the file, prints its path.
const RECEIVER = `import {mkdirSync,writeFileSync} from 'node:fs';import {homedir} from 'node:os';import {randomUUID} from 'node:crypto';import {gzipSync} from 'node:zlib';import path from 'node:path';
const name=process.argv.at(-1);let buf='';
process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('\\nREXREADY\\n');
process.stdin.on('data',d=>{buf+=d.toString('latin1');const end=buf.indexOf('.');if(end<0)return;
 const dir=path.join(homedir(),'.local/state/rex-browser/uploads',randomUUID());mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,name);writeFileSync(file,Buffer.from(buf.slice(0,end),'base64'),{mode:0o600});
 process.stdout.write('\\nREXB64:'+gzipSync(JSON.stringify({path:file})).toString('base64')+':REXEND\\n');process.exit(0);});`

/** Writes the file on the computer that runs the pane and returns its path there. */
export async function uploadFile(props: {
  bytes: Buffer
  host: string
  name: string
  session: string
}) {
  const name =
    path
      .basename(props.name)
      .replace(/[^\w.-]+/g, '_')
      .replace(/^\.+/, '')
      .slice(-120) || 'upload'
  const connection = await readConnection(props.host)
  const dir = `.local/state/rex-browser/uploads/${randomUUID()}`
  if (!connection) {
    const result = await runHidden({
      command: ['node', '--input-type=module', '-e', RECEIVER, name],
      host: props.host,
      input: `${props.bytes.toString('base64')}.`,
      session: props.session,
      timeoutMs: 120_000,
    })
    return z.object({ path: z.string() }).parse(result).path
  }
  if ('local' in connection) {
    const full = path.join(homedir(), dir)
    await mkdir(full, { mode: 0o700, recursive: true })
    await writeFile(path.join(full, name), props.bytes, { mode: 0o600 })
    return path.join(full, name)
  }
  // dir and name contain only [\w./-], so double quotes are safe.
  const script = `umask 077 && mkdir -p "$HOME/${dir}" && cat > "$HOME/${dir}/${name}" && printf %s "$HOME/${dir}/${name}"`
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'StrictHostKeyChecking=yes',
        '-o',
        'ConnectTimeout=5',
        connection.ssh,
        script,
      ],
      { timeout: 60_000 },
      (error, stdout) => {
        if (error) reject(new Error(error.message, { cause: error }))
        else resolve(stdout.trim())
      },
    )
    child.stdin?.end(props.bytes)
  })
}
