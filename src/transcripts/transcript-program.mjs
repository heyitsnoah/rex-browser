// Entry point appended to transcript-reader.mjs and transcript-parser.mjs and run with Node on the
// computer that owns the transcripts (see transcript-access.ts). Prints one framed, gzipped result.
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const request = JSON.parse(
  Buffer.from(process.argv.at(-1), 'base64').toString(),
)
let out
try {
  const data = await readTranscripts(request)
  const parsed =
    typeof data.text === 'string'
      ? parseTranscript(data.text, request.agent)
      : undefined
  if (data.truncated && parsed) {
    parsed.warnings.push('Showing the most recent part of a long conversation.')
  }
  if (data.branch && parsed && !parsed.status.branch) {
    parsed.status.branch = data.branch
  }
  const known = new Set(request.known || [])
  for (const item of parsed?.items || []) {
    if (!item.image || typeof item.image === 'string') continue
    const id = createHash('sha256')
      .update(Buffer.from(item.image.data, 'base64'))
      .digest('hex')
      .slice(0, 32)
    item.image = known.has(id) ? id : { ...item.image, id }
  }
  out = {
    candidates: data.candidates,
    parsed,
    selected: data.selected,
    subagents: data.subagents,
  }
} catch (error) {
  out = { error: String(error?.message || error) }
}
process.stdout.write(
  `\nREXB64:${gzipSync(JSON.stringify(out)).toString('base64')}:REXEND\n`,
)
