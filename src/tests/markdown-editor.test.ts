// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown, MarkdownPaste } from '../editor/markdownPaste'
import { applyNotePatch } from '../editor/notePatch'
import type { Note } from '../shared/types'

function pasteEvent(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => type === 'text/plain' ? text : '' },
  })
  return event
}

describe('note editor markdown paste', () => {
  it('inserts markdown as structured rich text', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        StarterKit.configure({ link: false }),
        Link.configure({ openOnClick: false }),
        Image.configure({ allowBase64: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Markdown,
        MarkdownPaste,
      ],
      content: '',
    })

    const event = pasteEvent('# 标题\n\n**粗体**、*斜体*与[链接](https://example.com)\n\n- 第一项\n- 第二项\n\n- [x] 已完成\n- [ ] 待处理')
    expect(editor.view.dom.dispatchEvent(event)).toBe(false)
    expect(event.defaultPrevented).toBe(true)

    const content = editor.getJSON().content
    expect(content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
    expect(content?.[1].content?.[0]).toMatchObject({ type: 'text', marks: [{ type: 'bold' }] })
    expect(content?.[1].content?.[2]).toMatchObject({ type: 'text', marks: [{ type: 'italic' }] })
    expect(content?.[1].content?.[4]).toMatchObject({ type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] })
    expect(content?.[2]).toMatchObject({ type: 'bulletList' })
    expect(content?.[3]).toMatchObject({
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true } },
        { type: 'taskItem', attrs: { checked: false } },
      ],
    })

    editor.destroy()
  })

  it('recognizes inline emphasis and leaves ordinary text to the normal paste handler', () => {
    expect(looksLikeMarkdown('*斜体*')).toBe(true)
    expect(looksLikeMarkdown('**粗体**')).toBe(true)
    expect(looksLikeMarkdown('普通文本')).toBe(false)
  })
})

describe('note updates', () => {
  const note: Note = {
    id: 'note-1',
    title: '笔记',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文' }] }] },
    folderId: null,
    tags: ['标签'],
    pinned: false,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('keeps the original note and timestamp for equivalent editor content', () => {
    const result = applyNotePatch(note, { content: structuredClone(note.content) }, '2026-02-01T00:00:00.000Z')
    expect(result).toBe(note)
    expect(result.updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('updates the timestamp only when a field actually changes', () => {
    const result = applyNotePatch(note, { title: '新标题' }, '2026-02-01T00:00:00.000Z')
    expect(result).not.toBe(note)
    expect(result).toMatchObject({ title: '新标题', updatedAt: '2026-02-01T00:00:00.000Z' })
  })
})
