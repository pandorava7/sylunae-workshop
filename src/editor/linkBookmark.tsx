import { mergeAttributes, Node } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { Check, Clipboard, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { LinkPreview } from '../shared/types'

let bookmarkSequence = 0

function bookmarkId() {
  bookmarkSequence += 1
  return `bookmark-${Date.now()}-${bookmarkSequence}`
}

export function bookmarkAttributes(href: string) {
  const url = new URL(href)
  const host = url.hostname.replace(/^www\./i, '')
  return { href, host, label: host, description: '', iconUrl: '', bookmarkId: bookmarkId() }
}

export function isStandaloneHttpUrl(value: string) {
  return /^https?:\/\/[^\s]+$/i.test(value.trim())
}

function previewFromPage(url: string): Promise<LinkPreview | null> {
  if (window.sylunae) return window.sylunae.system.getLinkPreview(url)
  return fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml' } }).then(async (response) => {
    if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return null
    const page = new URL(response.url)
    const html = await response.text()
    const document = new DOMParser().parseFromString(html, 'text/html')
    const title = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute('content') || document.title || page.hostname
    const description = document.querySelector('meta[property="og:description"], meta[name="twitter:description"], meta[name="description"]')?.getAttribute('content') || ''
    const icon = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')?.getAttribute('href')
    return { url: page.toString(), host: page.hostname.replace(/^www\./i, ''), title: title.trim().slice(0, 300), description: description.trim().slice(0, 500), iconUrl: icon ? new URL(icon, page).toString() : new URL('/favicon.ico', page).toString() }
  }).catch(() => null)
}

function LinkBookmarkView({ node, updateAttributes }: ReactNodeViewProps) {
  const { href, host, label, description, iconUrl } = node.attrs as Record<string, string>
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label || host || href)
  const [copied, setCopied] = useState(false)
  const saveTitle = () => {
    const nextTitle = draft.trim() || host || href
    updateAttributes({ label: nextTitle })
    setDraft(nextTitle)
    setEditing(false)
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = href
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.append(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const details = <>
    {iconUrl ? <img src={iconUrl} alt="" data-bookmark-icon /> : <span data-bookmark-icon aria-hidden="true">{host.slice(0, 1).toUpperCase()}</span>}
    <span data-bookmark-content>
      {editing ? <input aria-label="书签标题" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={saveTitle} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveTitle() } if (event.key === 'Escape') { event.preventDefault(); setDraft(label || host || href); setEditing(false) } }} /> : <span data-bookmark-label>{label || host || href}</span>}
      {description && <span data-bookmark-description>{description}</span>}
      <span data-bookmark-host>{host}</span>
    </span>
  </>

  return <NodeViewWrapper className="link-bookmark-view" data-type="link-bookmark" contentEditable={false}>
    {editing ? <div className="link-bookmark-main">{details}</div> : <a className="link-bookmark-main" href={href} target="_blank" rel="noreferrer">{details}</a>}
    <span className="bookmark-actions">
      <button type="button" className="bookmark-action" title="编辑标题" aria-label="编辑标题" onClick={() => { setDraft(label || host || href); setEditing(true) }}><Pencil size={14} /></button>
      <button type="button" className="bookmark-action" title={copied ? '已复制' : '复制链接'} aria-label={copied ? '已复制链接' : '复制链接'} onClick={() => void copyLink()}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>
    </span>
  </NodeViewWrapper>
}

/** Fetches metadata after the placeholder is visible, so a slow webpage never delays a paste. */
export function enrichBookmark(editor: Editor, id: string, url: string) {
  void previewFromPage(url).then((preview) => {
    if (!preview || editor.isDestroyed) return
    let position: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'linkBookmark' && node.attrs.bookmarkId === id) { position = pos; return false }
      return true
    })
    if (position === null) return
    const node = editor.state.doc.nodeAt(position)
    if (!node) return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      href: preview.url,
      host: preview.host,
      label: preview.title || preview.host,
      description: preview.description,
      iconUrl: preview.iconUrl || '',
    }))
  })
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
      description: { default: '' },
      iconUrl: { default: '' },
      bookmarkId: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-bookmark"]' }]
  },

  renderMarkdown(node) {
    const attrs = node.attrs ?? {}
    const href = typeof attrs.href === 'string' ? attrs.href : ''
    const label = typeof attrs.label === 'string' ? attrs.label : ''
    const host = typeof attrs.host === 'string' ? attrs.host : ''
    return href ? `[${(label || host || href).replace(/[\[\]]/g, '\\$&')}](${href.replace(/[()]/g, '\\$&')})` : ''
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkBookmarkView)
  },

  renderHTML({ HTMLAttributes }) {
    const { href, host, label, description, iconUrl } = HTMLAttributes
    const icon = iconUrl ? ['img', { src: iconUrl, alt: '', 'data-bookmark-icon': '' }] : ['span', { 'data-bookmark-icon': '', 'aria-hidden': 'true' }, host.slice(0, 1).toUpperCase()]
    const content = ['span', { 'data-bookmark-content': '' }, ['span', { 'data-bookmark-label': '' }, label || host || href]]
    if (description) content.push(['span', { 'data-bookmark-description': '' }, description])
    content.push(['span', { 'data-bookmark-host': '' }, host])
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-bookmark' }), ['a', { href, target: '_blank', rel: 'noreferrer', contenteditable: 'false' }, icon, content, ['span', { 'data-bookmark-url': '' }, href]]]
  },
})
