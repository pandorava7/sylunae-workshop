import { Extension, type Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export function looksLikeMarkdown(value: string) {
  const blockSyntax = /(^|\n)\s{0,3}(#{1,6}\s+|```|~~~|>\s+|[-*+]\s+|\d+[.)]\s+|- \[[ xX]\]\s+|(?:[-*_]\s*){3,}$)/m
  const setextHeadingOrTable = /(^|\n).+\n\s*(?:={3,}|-{3,})\s*$|(^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m
  const inlineSyntax = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|(^|\W)\*[^*\n]+\*(?=\W|$)|(^|\W)_[^_\n]+_(?=\W|$)|!?\[[^\]]+\]\([^\s)]+\))/m
  return blockSyntax.test(value) || setextHeadingOrTable.test(value) || inlineSyntax.test(value)
}

export function handleMarkdownPaste(editor: Editor | null, event: ClipboardEvent) {
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
