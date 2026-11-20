import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

export async function rex(host: string, args: string[]) {
  const { stdout } = await execFileAsync('rex', ['-S', host, ...args], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15_000,
  })
  return stdout
}

export async function rexJson<T extends z.ZodType>(props: {
  args: string[]
  host: string
  schema: T
}) {
  return props.schema.parse(JSON.parse(await rex(props.host, props.args)))
}

export const rexIdSchema = z.string().regex(/^(session|block|window):[\w-]+$/)
