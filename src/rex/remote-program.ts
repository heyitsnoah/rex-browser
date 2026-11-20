import { execFile } from 'node:child_process'

import { decodeFramed, runHidden } from '@/rex/hidden-terminal'
import { readConnection } from '@/rex/rex-connections'

/**
 * Runs a Node ES module on the computer `host` with `request` as its last
 * argument and returns its framed result (see `decodeFramed`): locally, over
 * SSH, or in a hidden Rex terminal when `.rex-transcripts.json` has no entry.
 */
export async function runRemoteProgram(props: {
  host: string
  request: string
  session: string
  source: string
}) {
  const connection = await readConnection(props.host)
  if (!connection) {
    return runHidden({
      command: [
        'node',
        '--input-type=module',
        '-e',
        props.source,
        props.request,
      ],
      host: props.host,
      session: props.session,
    })
  }
  const [command, args] =
    'local' in connection
      ? [process.execPath, ['--input-type=module', '-', props.request]]
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
            `node --input-type=module - ${props.request}`,
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
