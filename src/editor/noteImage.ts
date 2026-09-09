import { mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const imageSelectionKey = new PluginKey('noteImageSelection')

function imageBeforeCursor(state: EditorState) {
  const { selection } = state
  if (!selection.empty) return null

  const { $from } = selection
  if ($from.parent.isTextblock && $from.parentOffset !== 0) return null

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const index = $from.index(depth)
    if (index === 0) continue

    const node = $from.node(depth).child(index - 1)
    if (node.type.name !== 'image') return null

    const boundary = $from.posAtIndex(index, depth)
    return { from: boundary - node.nodeSize, to: boundary }
  }

  return null
}

export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => attributes.caption ? { 'data-caption': attributes.caption } : {},
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const { 'data-caption': caption, ...imageAttributes } = HTMLAttributes
    const figureAttributes = caption ? { 'data-caption': caption } : {}
    const children: unknown[] = ['figure', mergeAttributes({ 'data-type': 'note-image' }, figureAttributes), ['img', mergeAttributes(this.options.HTMLAttributes, imageAttributes, figureAttributes)]]
    if (caption) children.push(['figcaption', {}, caption])
    return children as [string, Record<string, unknown>, ...unknown[]]
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: imageSelectionKey,
        props: {
          decorations: (state) => {
            const adjacent = imageBeforeCursor(state)
            if (!adjacent) return DecorationSet.empty
            return DecorationSet.create(state.doc, [Decoration.node(adjacent.from, adjacent.to, { class: 'image-cursor-adjacent' })])
          },
        },
      }),
    ]
  },
})

export function isImageNodeSelection(selection: EditorState['selection']): selection is NodeSelection {
  return selection instanceof NodeSelection && selection.node.type.name === 'image'
}

export function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取图片'))
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'))
    reader.readAsDataURL(file)
  })
}
