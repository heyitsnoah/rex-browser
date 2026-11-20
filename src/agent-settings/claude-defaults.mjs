// Run with Node on the pane's computer (see agent-settings-actions.ts). Claude Code's /model and
// /effort also save themselves as the default for new sessions in ~/.claude/settings.json; this
// reads those two settings, or puts saved values back, and prints one framed, gzipped result.
import { readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const request = JSON.parse(
  Buffer.from(process.argv.at(-1), 'base64').toString(),
)
const file = path.join(homedir(), '.claude/settings.json')
const settings = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'))
if (request.restore) {
  // Only these two keys change; anything else written meanwhile stays.
  for (const key of ['model', 'modelSettings']) {
    if (request.restore[key] === null) delete settings[key]
    else settings[key] = request.restore[key]
  }
  await writeFile(
    `${file}.rex-browser`,
    `${JSON.stringify(settings, null, 2)}\n`,
  )
  await rename(`${file}.rex-browser`, file)
}
const out = {
  model: settings.model ?? null,
  modelSettings: settings.modelSettings ?? null,
}
process.stdout.write(
  `\nREXB64:${gzipSync(JSON.stringify(out)).toString('base64')}:REXEND\n`,
)
