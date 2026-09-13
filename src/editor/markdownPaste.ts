import { Extension, type Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export function looksLikeMarkdown(value: string) {
  const blockSyntax = /(^|\n)\s{0,3}(#{1,6}\s+|```|~~~|>\s+|[-*+]\s+|\d+[.)]\s+|- \[[ xX]\]\s+|(?:[-*_]\s*){3,}$)/m
  const setextHeadingOrTable = /(^|\n).+\n\s*(?:={3,}|-{3,})\s*$|(^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m
  const inlineSyntax = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|(^|\W)\*[^*\n]+\*(?=\W|$)|(^|\W)_[^_\n]+_(?=\W|$)|!?\[[^\]]+\]\([^\s)]+\))/m
  return blockSyntax.test(value) || setextHeadingOrTable.test(value) || inlineSyntax.test(value)
}

function currentListItemType(editor: Editor) {
  const { $from } = editor.state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const type = $from.node(depth).type.name
    if (type === 'listItem' || type === 'taskItem') return type
  }

  return null
}

function handleListContinuationPaste(editor: Editor | null, event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain')
  if (!editor || !text || !text.includes('\n') || looksLikeMarkdown(text)) return false

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()

  const listItemType = currentListItemType(editor)
  if (!listItemType || lines.length < 2) return false

  event.preventDefault()
  const chain = editor.chain().focus().insertContent(lines[0])
  for (const line of lines.slice(1)) {
    chain.splitListItem(listItemType).insertContent(line)
  }

  return chain.run()
}

export function handleMarkdownPaste(editor: Editor | null, event: ClipboardEvent) {
  if (handleListContinuationPaste(editor, event)) return true

  const markdown = event.clipboardData?.getData('text/plain')
  if (!editor || !markdown || !looksLikeMarkdown(markdown)) return false

  event.preventDefault()
  return editor.chain().focus().insertContent(markdown, { contentType: 'markdown' }).run()
}

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      props: {
        handlePaste: (_view, event) => handleMarkdownPaste(editor, event),
      },
    })]
  },
})
