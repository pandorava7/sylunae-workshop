import { mergeAttributes, Node } from '@tiptap/core'

export function bookmarkAttributes(href: string) {
  const url = new URL(href)
  const host = url.hostname.replace(/^www\./i, '')
  return { href, host, label: host }
}

export function isStandaloneHttpUrl(value: string) {
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

export const LinkBookmark = Node.create({
  name: 'linkBookmark',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: '' },
      host: { default: '' },
      label: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-bookmark"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { href, host, label } = HTMLAttributes
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-bookmark' }), ['a', { href, target: '_blank', rel: 'noreferrer', contenteditable: 'false' }, ['span', { 'data-bookmark-label': '' }, label || host || href], ['span', { 'data-bookmark-host': '' }, host], ['span', { 'data-bookmark-url': '' }, href]]]
  },
})
