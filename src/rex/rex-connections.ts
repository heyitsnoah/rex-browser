import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const connectionsSchema = z.record(
  z.string(),
  z.union([
    z.object({ local: z.literal(true) }),
    z.object({
      ssh: z.string().regex(/^([\w.-]+@)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/),
    }),
  ]),
)

/**
 * A faster path to a computer from `.rex-transcripts.json` (gitignored, keyed
 * by Rex DNS name): `local` or an SSH alias. Undefined means go through Rex.
 */
export async function readConnection(host: string) {
  try {
    return connectionsSchema.parse(
      JSON.parse(
        await readFile(
          path.join(process.cwd(), '.rex-transcripts.json'),
          'utf8',
        ),
      ),
    )[host]
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
