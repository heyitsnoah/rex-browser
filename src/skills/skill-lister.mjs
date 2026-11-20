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
    pi: [
      path.join(home, '.pi/agent/skills'),
      path.join(request.cwd || '', '.pi/skills'),
    ],
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
    if (!text) continue
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] || ''
    const field = (key) => {
      const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(front)
      if (!match) return ''
      // Block scalars (">", "|", ">-") and plain multi-line values (nothing after the colon)
      // put the text on the following indented lines.
      if (/^([>|][-+]?)?$/.test(match[1].trim())) {
        const rest = front.slice(match.index + match[0].length + 1).split('\n')
        const block = []
        for (const line of rest) {
          if (line.trim() && !/^\s/.test(line)) break
          block.push(line.trim())
        }
        return block.join(' ').replace(/\s+/g, ' ').trim()
      }
      return match[1].replace(/^["']|["']$/g, '').trim()
    }
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
