'use client'

import type { ComponentProps } from 'react'

import type { Layout, Tab } from '@/workspace/workspace-listing'

import { PaneView } from '@/workspace/components/pane-view'

type PaneProps = Omit<
  ComponentProps<typeof PaneView>,
  'active' | 'solo' | 'target' | 'title'
>

/** The tab's panes, placed as Rex tiles them. */
export function PaneGrid(props: {
  readonly active: string | undefined
  readonly host: string
  readonly pane: (block: string) => PaneProps
  readonly session: string
  readonly tab: Tab
}) {
  const titles = new Map(props.tab.panes.map((pane) => [pane.id, pane.title]))
  const slots = props.tab.layouts
    .flatMap(leaves)
    .filter((leaf) => titles.has(leaf.block_id))
  if (!slots.length) {
    return (
      <p className="text-muted-foreground grid h-full place-items-center text-sm">
        No terminal panes in this tab.
      </p>
    )
  }
  const solo = slots.length === 1
  return (
    <div className={`relative h-full ${solo ? '' : 'm-2.5'}`}>
      {slots.map((slot) => (
        <div
          className={`absolute min-h-0 min-w-0 ${solo ? '' : 'p-1.5'}`}
          key={slot.block_id}
          style={{
            height: `${slot.rect[3] * 100}%`,
            left: `${slot.rect[0] * 100}%`,
            top: `${slot.rect[1] * 100}%`,
            width: `${slot.rect[2] * 100}%`,
          }}
        >
          <PaneView
            {...props.pane(slot.block_id)}
            active={props.active === slot.block_id}
            solo={solo}
            target={{
              block: slot.block_id,
              host: props.host,
              session: props.session,
            }}
            title={titles.get(slot.block_id) ?? ''}
          />
        </div>
      ))}
    </div>
  )
}

function leaves(layout: Layout): Extract<Layout, { block_id: string }>[] {
  return 'split' in layout
    ? [...leaves(layout.split.before), ...leaves(layout.split.after)]
    : [layout]
}
