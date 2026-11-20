import { execFile } from 'node:child_process'

import { decodeFramed, runHidden } from '@/rex/hidden-terminal'
import { readConnection } from '@/rex/rex-connections'

/**
 * Runs a Node ES module on the computer `host` with `request` (JSON, base64-encoded
 * so it's safe in any shell) as its last argument and returns its framed result (see `decodeFramed`): locally, over
 * SSH, or in a hidden Rex terminal when `.rex-transcripts.json` has no entry.
 */
export async function runRemoteProgram(props: {
  host: string
  request: unknown
  session: string
  source: string
}) {
  const request = Buffer.from(JSON.stringify(props.request)).toString('base64')
  const connection = await readConnection(props.host)
  if (!connection) {
    return runHidden({
      command: ['node', '--input-type=module', '-e', props.source, request],
      host: props.host,
      session: props.session,
    })
  }
  const [command, args] =
    'local' in connection
      ? [process.execPath, ['--input-type=module', '-', request]]
      : [
          'ssh',
          [
            '-o',
            'BatchMode=yes',
            '-o',
            'StrictHostKeyChecking=yes',
            '-o',
            'ConnectTimeout=5',
            connection.ssh,
            `node --input-type=module - ${request}`,
          ],
        ]
  const output = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { maxBuffer: 40 * 1024 * 1024, timeout: 20_000 },
      (error, stdout) => {
        if (error) reject(new Error(error.message, { cause: error }))
        else resolve(stdout)
      },
    )
    child.stdin?.end(props.source)
  })
  return decodeFramed(output)
}
