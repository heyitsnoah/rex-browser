'use client'

import { renderToHtml } from '@pierre/words'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { sanitizeMarkdownHtml } from '@/workspace/sanitize-markdown'

const decoder = new TextDecoder()

export function MarkdownText(props: { readonly text: string }) {
  const html = useMemo(
    () =>
      withCopyButtons(
        sanitizeMarkdownHtml(
          decoder.decode(renderToHtml(props.text, { skipHtml: true })),
        ),
      ),
    [props.text],
  )
  return (
    <div
      className="prose prose-sm dark:prose-invert prose-pre:border prose-pre:bg-subtle prose-pre:text-foreground prose-pre:pr-16 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:font-normal prose-a:text-primary max-w-none text-[0.9rem] leading-relaxed [overflow-wrap:anywhere] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:block [&_table]:overflow-x-auto"
      // Sanitized: only inert elements and safe links survive (sanitize-markdown.ts); the copy buttons are ours.
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        if (!(event.target instanceof Element)) return
        const button = event.target.closest('button[data-copy]')
        const code = button?.parentElement?.querySelector('pre')?.textContent
        if (!button || code === undefined) return
        function copied() {
          if (!button) return
          button.textContent = 'Copied'
          setTimeout(() => (button.textContent = 'Copy'), 1500)
        }
        navigator.clipboard
          .writeText(code)
          .then(copied, () =>
            toast.error('Copy failed: the browser blocked clipboard access.'),
          )
      }}
    />
  )
}

/** Wraps each code block with a Copy button (handled by the click listener above). */
function withCopyButtons(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const pre of template.content.querySelectorAll('pre')) {
    const wrapper = document.createElement('div')
    wrapper.className = 'relative'
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.copy = ''
    button.className =
      'bg-card text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 rounded-md border px-2 py-0.5 font-mono text-xs'
    button.textContent = 'Copy'
    pre.replaceWith(wrapper)
    wrapper.append(pre, button)
  }
  return template.innerHTML
}
