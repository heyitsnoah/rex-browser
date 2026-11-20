import { z } from 'zod'

import { rexJson } from '@/rex/rex-cli'

type Layout =
  | { block_id: string; rect: [number, number, number, number] }
  | { split: { after: Layout; before: Layout } }

export async function listSessions(host: string) {
  const { sessions } = await rexJson({
    args: ['ls', '--json'],
    host,
    schema: z.object({
      sessions: z.array(
        z.object({ label: z.string(), session_id: z.string() }),
      ),
    }),
  })
  return sessions
}
const layoutSchema: z.ZodType<Layout> = z.lazy(() =>
  z.union([
    z.object({
      block_id: z.string(),
      rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
    z.object({
      split: z.object({ after: layoutSchema, before: layoutSchema }),
    }),
  ]),
)

/** A session's tabs (Rex windows) with their tiled layout and terminal titles. */
export type Tab = Awaited<ReturnType<typeof listTabs>>[number]

export async function listTabs(props: { host: string; session: string }) {
  const [{ windows }, { blocks }] = await Promise.all([
    rexJson({
      args: ['window', 'ls', '-s', props.session, '--json'],
      host: props.host,
      schema: z.object({
        windows: z.array(
          z.object({
            focused_block_id: z.string().optional(),
            label: z.string(),
            layers: z.array(
              z.object({ kind: z.string(), layout: layoutSchema }),
            ),
            window_id: z.string(),
          }),
        ),
      }),
    }),
    rexJson({
      args: ['block', 'ls', '-s', props.session, '--json'],
      host: props.host,
      schema: z.object({
        blocks: z.array(
          z.object({
            block_id: z.string(),
            creator_name: z.string(),
            label: z.string(),
            window_id: z.string().optional(),
          }),
        ),
      }),
    }),
  ])
  const terminals = await Promise.all(
    blocks
      .filter(
        (block) =>
          block.creator_name === 'com.superlogical.terminal' &&
          block.window_id !== undefined,
      )
      .map(async (block) => ({
        id: block.block_id,
        title: await rexJson({
          args: [
            'block',
            'call',
            '-s',
            props.session,
            '-b',
            block.block_id,
            'title',
          ],
          host: props.host,
          schema: z.object({ title: z.string() }),
        }).then(
          (result) => result.title || block.label,
          // A pane that just closed has no title; its label still names it.
          () => block.label,
        ),
        windowId: block.window_id,
      })),
  )
  return windows.map((window) => {
    const panes = terminals
      .filter((pane) => pane.windowId === window.window_id)
      .map((pane) => ({ id: pane.id, title: pane.title }))
    // Rex names unnamed windows "Window <last 8 of id>"; show the running program's title instead.
    const unnamed = window.label === `Window ${window.window_id.slice(-8)}`
    const focused =
      panes.find((pane) => pane.id === window.focused_block_id) ?? panes.at(0)
    return {
      focusedBlockId: window.focused_block_id,
      id: window.window_id,
      label: unnamed && focused ? focused.title : window.label,
      layouts: window.layers
        .filter((layer) => layer.kind === 'tiled')
        .map((layer) => layer.layout),
      panes,
    }
  })
}
export type { Layout }
