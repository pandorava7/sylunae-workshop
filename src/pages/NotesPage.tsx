import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { ArchiveRestore, Bold, CheckSquare, Code2, Folder, FolderPlus, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, NotebookPen, Pin, PinOff, Plus, Quote, Search, Strikethrough, Trash2, Undo2 } from 'lucide-react'
import { NodeSelection } from '@tiptap/pm/state'
import { useAppStore } from '../app/AppStore'
import type { Note } from '../shared/types'
import { extractText, formatDate, newId, nowIso } from '../utils'
import { EmptyState } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteTagsInput } from '../components/NoteTagsInput'
import { PromptDialog } from '../components/PromptDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { MarkdownPaste } from '../editor/markdownPaste'
import { applyNotePatch } from '../editor/notePatch'
import { isImageNodeSelection, NoteImage, readImageFile } from '../editor/noteImage'

type FolderFilter = 'all' | 'trash' | string

export function NotesPage({ createOnOpen = false }: { createOnOpen?: boolean }) {
  const { snapshot, update } = useAppStore()
  const notes = snapshot?.notes || []
  const folders = snapshot?.folders || []
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const createdOnOpen = useRef(false)
  const selected = notes.find((note) => note.id === selectedId) || null

  const visibleNotes = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return notes.filter((note) => {
      const trashMatch = folderFilter === 'trash' ? Boolean(note.deletedAt) : !note.deletedAt
      const folderMatch = folderFilter === 'all' || folderFilter === 'trash' || note.folderId === folderFilter
      const textMatch = !clean || `${note.title} ${note.tags.join(' ')} ${extractText(note.content)}`.toLowerCase().includes(clean)
      return trashMatch && folderMatch && textMatch
    }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes, folderFilter, query])

  useEffect(() => {
    if (selectedId && !visibleNotes.some((note) => note.id === selectedId)) setSelectedId(visibleNotes[0]?.id || null)
    else if (!selectedId && visibleNotes[0]) setSelectedId(visibleNotes[0].id)
  }, [visibleNotes, selectedId])

  const saveNote = (id: string, patch: Partial<Note>) => update((state) => {
    const index = state.notes.findIndex((note) => note.id === id)
    if (index < 0) return state
    const nextNote = applyNotePatch(state.notes[index], patch, nowIso())
    if (nextNote === state.notes[index]) return state
    const nextNotes = [...state.notes]
    nextNotes[index] = nextNote
    return { ...state, notes: nextNotes }
  })
  const addNote = () => {
    const now = nowIso()
    const note: Note = { id: newId(), title: '无标题笔记', content: { type: 'doc', content: [{ type: 'paragraph' }] }, folderId: folderFilter !== 'all' && folderFilter !== 'trash' ? folderFilter : null, tags: [], pinned: false, deletedAt: null, createdAt: now, updatedAt: now }
    update((state) => ({ ...state, notes: [note, ...state.notes] }))
    setFolderFilter('all'); setSelectedId(note.id)
  }
  useEffect(() => {
    if (!createOnOpen || createdOnOpen.current) return
    createdOnOpen.current = true
    addNote()
  }, [createOnOpen])
  const addFolder = (name: string) => {
    const now = nowIso(); const id = newId()
    update((state) => ({ ...state, folders: [...state.folders, { id, name, createdAt: now, updatedAt: now }] }))
    setFolderFilter(id)
  }
  const moveToTrash = (note: Note) => saveNote(note.id, { deletedAt: nowIso() })
  const restore = (note: Note) => saveNote(note.id, { deletedAt: null })
  const destroy = (note: Note) => {
    update((state) => ({ ...state, notes: state.notes.filter((item) => item.id !== note.id) }))
    setSelectedId(null)
  }

  return <section className="page notes-page">
    <header className="page-header compact"><div><span className="eyebrow">NOTES</span><h1>笔记</h1></div><Button className="button primary" onClick={addNote}><Plus size={17} />新建笔记</Button></header>
    <div className="notes-workspace">
      <aside className="folder-pane">
        <button className={folderFilter === 'all' ? 'active' : ''} onClick={() => setFolderFilter('all')}><NotebookPen size={17} />全部笔记<span>{notes.filter((note) => !note.deletedAt).length}</span></button>
        <div className="pane-label"><span>文件夹</span><button onClick={() => setCreatingFolder(true)} title="新建文件夹"><FolderPlus size={15} /></button></div>
        {folders.map((folder) => <button key={folder.id} className={folderFilter === folder.id ? 'active' : ''} onClick={() => setFolderFilter(folder.id)}><Folder size={16} /><span className="user-content">{folder.name}</span><span>{notes.filter((note) => note.folderId === folder.id && !note.deletedAt).length}</span></button>)}
        <button className={`trash-link ${folderFilter === 'trash' ? 'active' : ''}`} onClick={() => setFolderFilter('trash')}><Trash2 size={16} />回收站<span>{notes.filter((note) => note.deletedAt).length}</span></button>
      </aside>
      <div className="note-list-pane">
        <label className="search-box small"><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记" /></label>
        <div className="note-list">{visibleNotes.map((note) => <button key={note.id} className={selectedId === note.id ? 'active' : ''} onClick={() => setSelectedId(note.id)}>
          <div><strong className={note.title ? 'private-note-title' : undefined}>{note.title || '无标题笔记'}</strong>{note.pinned && <Pin size={12} fill="currentColor" />}</div><p className={extractText(note.content).trim() ? 'private-note-preview' : undefined}>{extractText(note.content).trim() || '空白笔记'}</p><span>{formatDate(note.updatedAt, true)}</span>
        </button>)}</div>
      </div>
      <div className="editor-pane">{selected ? <NoteEditor key={selected.id} note={selected} folders={folders} inTrash={Boolean(selected.deletedAt)} onSave={(patch) => saveNote(selected.id, patch)} onTrash={() => moveToTrash(selected)} onRestore={() => restore(selected)} onDestroy={() => setDeleteTarget(selected)} /> : <EmptyState icon={<NotebookPen size={25} />} title={folderFilter === 'trash' ? '回收站是空的' : '开始写一点什么'} description={folderFilter === 'trash' ? '删除的笔记会在这里等待你决定。' : '新建一条笔记，记下此刻的想法。'} action={folderFilter !== 'trash' ? <Button className="button primary" onClick={addNote}>新建笔记</Button> : undefined} />}</div>
    </div>
    <PromptDialog open={creatingFolder} onOpenChange={setCreatingFolder} title="新建文件夹" description="为笔记创建一个新分类。" placeholder="文件夹名称" confirmLabel="创建" onSubmit={addFolder} />
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} title="永久删除笔记？" description={deleteTarget ? <><span>《</span><span className="user-content">{deleteTarget.title}</span><span>》将被永久删除，此操作无法撤销。</span></> : ''} confirmLabel="永久删除" destructive icon={<Trash2 />} onConfirm={() => { if (deleteTarget) destroy(deleteTarget); setDeleteTarget(null) }} />
  </section>
}

function NoteEditor({ note, folders, inTrash, onSave, onTrash, onRestore, onDestroy }: { note: Note; folders: { id: string; name: string }[]; inTrash: boolean; onSave: (patch: Partial<Note>) => void; onTrash: () => void; onRestore: () => void; onDestroy: () => void }) {
  const [promptKind, setPromptKind] = useState<'link' | 'image-link' | null>(null)
  const [imageSourceOpen, setImageSourceOpen] = useState(false)
  const [captionPosition, setCaptionPosition] = useState<number | null>(null)
  const [titleDraft, setTitleDraft] = useState(note.title)
  const imageInput = useRef<HTMLInputElement>(null)
  const saveRef = useRef(onSave)
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContent = useRef<Note['content'] | null>(null)
  const pendingTitle = useRef<string | null>(null)
  saveRef.current = onSave

  const commitContent = () => {
    if (contentTimer.current) { clearTimeout(contentTimer.current); contentTimer.current = null }
    if (pendingContent.current === null) return
    const content = pendingContent.current
    pendingContent.current = null
    saveRef.current({ content })
  }
  const scheduleContent = (content: Note['content']) => {
    pendingContent.current = content
    if (contentTimer.current) clearTimeout(contentTimer.current)
    contentTimer.current = setTimeout(commitContent, 500)
  }
  const commitTitle = () => {
    if (titleTimer.current) { clearTimeout(titleTimer.current); titleTimer.current = null }
    if (pendingTitle.current === null) return
    const title = pendingTitle.current
    pendingTitle.current = null
    saveRef.current({ title })
  }
  const scheduleTitle = (title: string) => {
    setTitleDraft(title)
    pendingTitle.current = title
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(commitTitle, 500)
  }
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false, autolink: true }), NoteImage.configure({ allowBase64: true }), Placeholder.configure({ placeholder: '从这里开始书写…' }), TaskList, TaskItem.configure({ nested: true }), Markdown, MarkdownPaste],
    content: note.content,
    editable: !inTrash,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleClickOn: (view, _pos, node, nodePos, _event, direct) => {
        if (!direct || node.type.name !== 'image' || inTrash) return false
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
        setCaptionPosition(nodePos)
        return true
      },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter' || inTrash || !isImageNodeSelection(view.state.selection)) return false
        event.preventDefault()
        setCaptionPosition(view.state.selection.from)
        return true
      },
      handleDrop: (view, event) => {
        if (inTrash) return false
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'))
        if (!files.length) return false

        event.preventDefault()
        const dropPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
        void Promise.all(files.map(readImageFile)).then((sources) => {
          const position = Math.min(dropPosition, view.state.doc.content.size)
          const images = sources.map((src) => ({ type: 'image', attrs: { src } }))
          editor?.chain().focus().insertContentAt(position, images).run()
        })
        return true
      },
    },
    onUpdate: ({ editor: instance }) => scheduleContent(instance.getJSON()),
    onBlur: commitContent,
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!inTrash)
    editor.commands.setContent(note.content, { emitUpdate: false })
  }, [note.id, inTrash])

  useEffect(() => setTitleDraft(note.title), [note.title])

  useEffect(() => () => {
    if (contentTimer.current) clearTimeout(contentTimer.current)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    if (pendingContent.current !== null) saveRef.current({ content: pendingContent.current })
    if (pendingTitle.current !== null) saveRef.current({ title: pendingTitle.current })
  }, [])

  if (!editor) return null
  const setLink = (url: string) => {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  const addImage = (url: string) => editor.chain().focus().setImage({ src: url }).run()
  const addImageFile = async (file: File) => addImage(await readImageFile(file))
  const caption = captionPosition === null ? '' : editor.state.doc.nodeAt(captionPosition)?.attrs.caption || ''
  const saveCaption = (value: string) => {
    if (captionPosition === null) return
    editor.chain().focus().command(({ tr }) => {
      const image = tr.doc.nodeAt(captionPosition)
      if (image?.type.name !== 'image') return false
      tr.setNodeMarkup(captionPosition, undefined, { ...image.attrs, caption: value || null })
      return true
    }).run()
  }
  const deleteCaptionedImage = () => {
    if (captionPosition === null) return
    editor.chain().focus().command(({ tr }) => {
      const image = tr.doc.nodeAt(captionPosition)
      if (image?.type.name !== 'image') return false
      tr.delete(captionPosition, captionPosition + image.nodeSize)
      return true
    }).run()
    setCaptionPosition(null)
  }
  const action = (active: boolean, title: string, icon: React.ReactNode, run: () => void) => <button className={active ? 'active' : ''} title={title} onClick={run}>{icon}</button>

  return <div className="note-editor-wrap">
    <div className="note-editor-top"><Select value={note.folderId || 'none'} disabled={inTrash} onValueChange={(value) => onSave({ folderId: value === 'none' ? null : value })}><SelectTrigger className="select-control"><SelectValue className={note.folderId ? 'user-content' : undefined} /></SelectTrigger><SelectContent><SelectItem value="none">无文件夹</SelectItem>{folders.map((folder) => <SelectItem key={folder.id} value={folder.id}><span className="user-content">{folder.name}</span></SelectItem>)}</SelectContent></Select><div>
      {!inTrash && <button className="icon-button" onClick={() => onSave({ pinned: !note.pinned })} title={note.pinned ? '取消置顶' : '置顶'}>{note.pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>}
      {inTrash ? <><button className="icon-button" onClick={onRestore} title="恢复"><ArchiveRestore size={17} /></button><button className="icon-button danger" onClick={onDestroy} title="永久删除"><Trash2 size={17} /></button></> : <button className="icon-button" onClick={onTrash} title="移至回收站"><Trash2 size={17} /></button>}
    </div></div>
    <Input className="note-title-input" value={titleDraft} disabled={inTrash} onChange={(event) => scheduleTitle(event.target.value)} onBlur={commitTitle} placeholder="无标题笔记" />
    <NoteTagsInput tags={note.tags} disabled={inTrash} onChange={(tags) => onSave({ tags })} />
    {!inTrash && <div className="editor-toolbar">
      {action(editor.isActive('bold'), '粗体', <Bold size={16} />, () => { editor.chain().focus().toggleBold().run() })}
      {action(editor.isActive('italic'), '斜体', <Italic size={16} />, () => { editor.chain().focus().toggleItalic().run() })}
      {action(editor.isActive('strike'), '删除线', <Strikethrough size={16} />, () => { editor.chain().focus().toggleStrike().run() })}
      <i />
      {action(editor.isActive('heading', { level: 2 }), '二级标题', <Heading2 size={17} />, () => { editor.chain().focus().toggleHeading({ level: 2 }).run() })}
      {action(editor.isActive('bulletList'), '项目列表', <List size={17} />, () => { editor.chain().focus().toggleBulletList().run() })}
      {action(editor.isActive('orderedList'), '编号列表', <ListOrdered size={17} />, () => { editor.chain().focus().toggleOrderedList().run() })}
      {action(editor.isActive('taskList'), '待办列表', <CheckSquare size={16} />, () => { editor.chain().focus().toggleTaskList().run() })}
      {action(editor.isActive('blockquote'), '引用', <Quote size={16} />, () => { editor.chain().focus().toggleBlockquote().run() })}
      {action(editor.isActive('codeBlock'), '代码块', <Code2 size={16} />, () => { editor.chain().focus().toggleCodeBlock().run() })}
      <i />
      {action(editor.isActive('link'), '链接', <Link2 size={16} />, () => setPromptKind('link'))}
      {action(false, '图片', <ImagePlus size={16} />, () => setImageSourceOpen(true))}
      {action(false, '撤销', <Undo2 size={16} />, () => { editor.chain().focus().undo().run() })}
    </div>}
    <EditorContent className="note-editor-content" editor={editor} />
    <div className="editor-status">{inTrash ? `删除于 ${formatDate(note.deletedAt || '', true)}` : `自动保存 · ${formatDate(note.updatedAt, true)}`}</div>
    <PromptDialog open={promptKind === 'link'} onOpenChange={(open) => { if (!open) setPromptKind(null) }} title="添加链接" description="为当前选中文字设置链接。" initialValue={editor.getAttributes('link').href || 'https://'} placeholder="https://example.com" confirmLabel="应用链接" validate={(value) => /^https?:\/\//i.test(value) ? null : '请输入 http 或 https 链接'} onSubmit={setLink} />
    <Dialog open={imageSourceOpen} onOpenChange={setImageSourceOpen}><DialogContent className="image-source-dialog"><DialogHeader><DialogTitle>插入图片</DialogTitle><DialogDescription>通过网络链接或从本地文件夹选择图片。</DialogDescription></DialogHeader><div className="image-source-actions"><Button variant="outline" className="button secondary" onClick={() => { setImageSourceOpen(false); setPromptKind('image-link') }}><Link2 size={17} />使用图片链接</Button><Button className="button primary" onClick={() => imageInput.current?.click()}><Folder size={17} />从文件夹选择</Button></div><input ref={imageInput} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setImageSourceOpen(false); void addImageFile(file) } event.currentTarget.value = '' }} /></DialogContent></Dialog>
    <PromptDialog open={promptKind === 'image-link'} onOpenChange={(open) => { if (!open) setPromptKind(null) }} title="通过链接插入图片" description="请输入可直接访问的 HTTPS 图片地址。" placeholder="https://example.com/image.png" confirmLabel="插入图片" validate={(value) => /^https:\/\//i.test(value) ? null : '请输入 HTTPS 图片地址'} onSubmit={addImage} />
    <PromptDialog open={captionPosition !== null} onOpenChange={(open) => { if (!open) setCaptionPosition(null) }} title="图片说明" description="为图片添加 caption；留空保存可移除已有说明。" initialValue={caption} placeholder="输入图片说明" confirmLabel="保存说明" destructiveLabel="删除图片" allowEmpty onSubmit={saveCaption} onDestructive={deleteCaptionedImage} />
  </div>
}
