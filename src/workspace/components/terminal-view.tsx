'use client'

import { useLayoutEffect, useRef } from 'react'

const KEYS = new Map([
  ['ArrowDown', '\x1b[B'],
  ['ArrowLeft', '\x1b[D'],
  ['ArrowRight', '\x1b[C'],
  ['ArrowUp', '\x1b[A'],
  ['Backspace', '\x7f'],
  ['Enter', '\r'],
  ['Escape', '\x1b'],
  ['Tab', '\t'],
])

/** The pane's screen as text. With direct typing on, keys and pastes go to the pane. */
export function TerminalView(props: {
  readonly content: string
  readonly label: string
  readonly onFocus: () => void
  readonly onInput: (data: string) => void
  readonly typing: boolean
}) {
  const pre = useRef<HTMLPreElement>(null)
  // Read by the scroll handler and the layout effect, not by render: whether the reader is at the bottom.
  const atBottom = useRef(true)
  // Follow new output unless the reader scrolled up.
  useLayoutEffect(() => {
    if (atBottom.current && pre.current) {
      pre.current.scrollTop = pre.current.scrollHeight
    }
  }, [props.content])
  return (
    <pre
      aria-label={props.label}
      className="h-full min-h-0 overflow-auto px-3.5 py-3 font-mono text-[0.8rem] leading-normal whitespace-pre outline-offset-[-2px]"
      onFocus={props.onFocus}
      onKeyDown={(event) => {
        if (!props.typing || event.metaKey) return
        const data =
          event.ctrlKey && event.key.length === 1
            ? String.fromCharCode(event.key.toUpperCase().charCodeAt(0) & 31)
            : (KEYS.get(event.key) ??
              (event.key.length === 1 ? event.key : undefined))
        if (data === undefined) return
        event.preventDefault()
        props.onInput(data)
      }}
      onPaste={(event) => {
        if (!props.typing) return
        event.preventDefault()
        props.onInput(event.clipboardData.getData('text'))
      }}
      onScroll={(event) => {
        const node = event.currentTarget
        atBottom.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 30
      }}
      ref={pre}
      tabIndex={0}
    >
      {props.content}
    </pre>
  )
}
