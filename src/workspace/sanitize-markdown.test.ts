import { renderToHtml } from '@pierre/words'
import { expect, test } from 'vitest'

import { sanitizeMarkdownHtml } from '@/workspace/sanitize-markdown'

function render(markdown: string) {
  return sanitizeMarkdownHtml(
    new TextDecoder().decode(renderToHtml(markdown, { skipHtml: true })),
  )
}

test('drops script links, images and raw HTML from agent Markdown', () => {
  const html = render(
    '[click](javascript:alert(1)) ![x](https://evil.example/p.png) <img src=x onerror=alert(1)> <script>alert(1)</script>',
  )
  expect(html).not.toMatch(/javascript:|<img|onerror|<script/i)
})

test('keeps ordinary formatting and safe links', () => {
  const html = render('**bold** `code` [site](https://example.com)')
  expect(html).toContain('<strong>bold</strong>')
  expect(html).toContain('<code>code</code>')
  expect(html).toContain('href="https://example.com"')
})
