import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

const tailscaleStatusSchema = z.object({
  BackendState: z.string(),
  Peer: z
    .record(
      z.string(),
      z.object({
        DNSName: z.string(),
        HostName: z.string(),
        Online: z.boolean().optional(),
        Tags: z.array(z.string()).optional(),
      }),
    )
    .optional(),
})

export type RexHost = Awaited<ReturnType<typeof discoverHosts>>[number]

let known = new Map<string, RexHost>()

/** Rex computers are the Tailscale peers tagged `tag:rex`. */
export async function discoverHosts() {
  const { stdout } = await execFileAsync('tailscale', ['status', '--json'], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 10_000,
  })
  const status = tailscaleStatusSchema.parse(JSON.parse(stdout))
  if (status.BackendState !== 'Running') {
    throw new Error('Tailscale is not connected. Connect it and refresh.')
  }
  const hosts = Object.values(status.Peer ?? {})
    .filter((peer) => peer.Tags?.includes('tag:rex'))
    .map((peer) => ({
      id: peer.DNSName.replace(/\.$/, ''),
      label: peer.HostName,
      online: peer.Online === true,
    }))
    .filter((host) => /^[a-zA-Z0-9.-]+$/.test(host.id))
    .sort((a, b) => a.label.localeCompare(b.label))
  known = new Map(hosts.map((host) => [host.id, host]))
  return hosts
}

/** Only discovered, online computers can be reached. */
export async function requireHost(id: string) {
  // After a restart a request can arrive before anyone asked for the host list.
  if (!known.has(id)) await discoverHosts()
  const host = known.get(id)
  if (!host) throw new Error('Unknown Rex computer. Refresh the list.')
  if (!host.online) throw new Error(`${host.label} is offline.`)
  return host.id
}
