const ALLOWED = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'INPUT',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

/**
 * Keeps only inert Markdown elements: no scripts, styles, images or event
 * handlers, and links only to http(s), mailto or in-page anchors. Transcripts
 * hold web pages and tool output, so their Markdown is untrusted.
 */
export function sanitizeMarkdownHtml(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html
  clean(template.content)
  return template.innerHTML
}

function clean(node: DocumentFragment | Element) {
  for (const child of [...node.children]) {
    if (!ALLOWED.has(child.tagName)) {
      child.replaceWith(document.createTextNode(child.textContent))
      continue
    }
    for (const attribute of [...child.attributes]) {
      if (!keepAttribute(child.tagName, attribute)) {
        child.removeAttribute(attribute.name)
      }
    }
    if (child instanceof HTMLInputElement) child.disabled = true
    if (child instanceof HTMLAnchorElement) {
      child.target = '_blank'
      child.rel = 'noopener noreferrer'
    }
    clean(child)
  }
}

function keepAttribute(tag: string, attribute: Attr) {
  switch (tag) {
    case 'A':
      return (
        attribute.name === 'href' &&
        /^(https?:|mailto:|#)/i.test(attribute.value.trim())
      )
    case 'CODE':
      return (
        attribute.name === 'class' && /^language-[\w-]+$/.test(attribute.value)
      )
    case 'INPUT':
      return (
        (attribute.name === 'type' && attribute.value === 'checkbox') ||
        attribute.name === 'checked'
      )
    case 'TD':
    case 'TH':
      return attribute.name === 'align'
    default:
      return false
  }
}
