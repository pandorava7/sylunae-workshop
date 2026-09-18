import type { Editor } from '@tiptap/core'

/** Applies a link to selected text, or inserts a visible link when the cursor is collapsed. */
export function applyNoteLink(editor: Editor, href: string) {
  if (editor.state.selection.empty) {
    return editor.chain().focus().insertContent({
      type: 'text',
      text: href,
      marks: [{ type: 'link', attrs: { href } }],
    }).run()
  }

  return editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}
