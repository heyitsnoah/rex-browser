'use client'

import { renderToHtml } from '@pierre/words'
import { useMemo } from 'react'

import { sanitizeMarkdownHtml } from '@/workspace/sanitize-markdown'

const decoder = new TextDecoder()

export function MarkdownText(props: { readonly text: string }) {
  const html = useMemo(
    () =>
      sanitizeMarkdownHtml(
        decoder.decode(renderToHtml(props.text, { skipHtml: true })),
      ),
    [props.text],
  )
  return (
    <div
      className="prose prose-sm dark:prose-invert prose-pre:border prose-pre:bg-subtle prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:font-normal prose-a:text-primary max-w-none text-[0.9rem] leading-relaxed [overflow-wrap:anywhere] [&_table]:block [&_table]:overflow-x-auto"
      // Sanitized: only inert elements and safe links survive (sanitize-markdown.ts).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
