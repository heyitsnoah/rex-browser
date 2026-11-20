// Run with Node on the pane's computer (see skill-access.ts): lists the agent's skills from their
// SKILL.md frontmatter, user-wide and in the project, and prints one framed, gzipped result.
import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const request = JSON.parse(
  Buffer.from(process.argv.at(-1), 'base64').toString(),
)
const home = homedir()
const roots =
  {
    claude: [
      path.join(home, '.claude/skills'),
      path.join(request.cwd || '', '.claude/skills'),
    ],
    codex: [path.join(home, '.codex/skills')],
    pi: [path.join(home, '.pi/agent/skills')],
  }[request.agent] || []
roots.push(
  path.join(home, '.agents/skills'),
  path.join(request.cwd || '', '.agents/skills'),
)
const skills = new Map()
for (const root of roots) {
  for (const entry of await readdir(root, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const text = await readFile(
      path.join(root, entry.name, 'SKILL.md'),
      'utf8',
    ).catch(() => '')
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] || ''
    const field = (key) =>
      new RegExp(`^${key}:\\s*(.*)$`, 'm')
        .exec(front)?.[1]
        ?.replace(/^["'>|-]\s*|["']$/g, '')
        .trim() || ''
    const name = field('name') || entry.name
    if (!skills.has(name)) {
      skills.set(name, { description: field('description'), name })
    }
  }
}
const out = {
  skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
}
process.stdout.write(
  `\nREXB64:${gzipSync(JSON.stringify(out)).toString('base64')}:REXEND\n`,
)
