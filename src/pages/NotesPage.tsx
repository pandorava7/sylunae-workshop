import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { ArchiveRestore, Bold, CheckSquare, Code2, Folder, FolderPlus, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, NotebookPen, Pin, PinOff, Plus, Quote, Search, Strikethrough, Trash2, Undo2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { Note } from '../shared/types'
import { extractText, formatDate, newId, nowIso } from '../utils'
import { EmptyState } from '../components/Icons'

type FolderFilter = 'all' | 'trash' | string

export function NotesPage() {
  const { snapshot, update } = useAppStore()
  const notes = snapshot?.notes || []
  const folders = snapshot?.folders || []
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  const saveNote = (id: string, patch: Partial<Note>) => update((state) => ({ ...state, notes: state.notes.map((note) => note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note) }))
  const addNote = () => {
    const now = nowIso()
    const note: Note = { id: newId(), title: '无标题笔记', content: { type: 'doc', content: [{ type: 'paragraph' }] }, folderId: folderFilter !== 'all' && folderFilter !== 'trash' ? folderFilter : null, tags: [], pinned: false, deletedAt: null, createdAt: now, updatedAt: now }
    update((state) => ({ ...state, notes: [note, ...state.notes] }))
    setFolderFilter('all'); setSelectedId(note.id)
  }
  const addFolder = () => {
    const name = prompt('文件夹名称')?.trim()
    if (!name) return
    const now = nowIso(); const id = newId()
    update((state) => ({ ...state, folders: [...state.folders, { id, name, createdAt: now, updatedAt: now }] }))
    setFolderFilter(id)
  }
  const moveToTrash = (note: Note) => saveNote(note.id, { deletedAt: nowIso() })
  const restore = (note: Note) => saveNote(note.id, { deletedAt: null })
  const destroy = (note: Note) => {
    if (!confirm(`永久删除《${note.title}》？此操作无法撤销。`)) return
    update((state) => ({ ...state, notes: state.notes.filter((item) => item.id !== note.id) }))
    setSelectedId(null)
  }

  return <section className="page notes-page">
    <header className="page-header compact"><div><span className="eyebrow">NOTES</span><h1>笔记</h1></div><button className="button primary" onClick={addNote}><Plus size={17} />新建笔记</button></header>
    <div className="notes-workspace">
      <aside className="folder-pane">
        <button className={folderFilter === 'all' ? 'active' : ''} onClick={() => setFolderFilter('all')}><NotebookPen size={17} />全部笔记<span>{notes.filter((note) => !note.deletedAt).length}</span></button>
        <div className="pane-label"><span>文件夹</span><button onClick={addFolder} title="新建文件夹"><FolderPlus size={15} /></button></div>
        {folders.map((folder) => <button key={folder.id} className={folderFilter === folder.id ? 'active' : ''} onClick={() => setFolderFilter(folder.id)}><Folder size={16} />{folder.name}<span>{notes.filter((note) => note.folderId === folder.id && !note.deletedAt).length}</span></button>)}
        <button className={`trash-link ${folderFilter === 'trash' ? 'active' : ''}`} onClick={() => setFolderFilter('trash')}><Trash2 size={16} />回收站<span>{notes.filter((note) => note.deletedAt).length}</span></button>
      </aside>
      <div className="note-list-pane">
        <label className="search-box small"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记" /></label>
        <div className="note-list">{visibleNotes.map((note) => <button key={note.id} className={selectedId === note.id ? 'active' : ''} onClick={() => setSelectedId(note.id)}>
          <div><strong>{note.title || '无标题笔记'}</strong>{note.pinned && <Pin size={12} fill="currentColor" />}</div><p>{extractText(note.content).trim() || '空白笔记'}</p><span>{formatDate(note.updatedAt, true)}</span>
        </button>)}</div>
      </div>
      <div className="editor-pane">{selected ? <NoteEditor note={selected} folders={folders} inTrash={Boolean(selected.deletedAt)} onSave={(patch) => saveNote(selected.id, patch)} onTrash={() => moveToTrash(selected)} onRestore={() => restore(selected)} onDestroy={() => destroy(selected)} /> : <EmptyState icon={<NotebookPen size={25} />} title={folderFilter === 'trash' ? '回收站是空的' : '开始写一点什么'} description={folderFilter === 'trash' ? '删除的笔记会在这里等待你决定。' : '新建一条笔记，记下此刻的想法。'} action={folderFilter !== 'trash' ? <button className="button primary" onClick={addNote}>新建笔记</button> : undefined} />}</div>
    </div>
  </section>
}

function NoteEditor({ note, folders, inTrash, onSave, onTrash, onRestore, onDestroy }: { note: Note; folders: { id: string; name: string }[]; inTrash: boolean; onSave: (patch: Partial<Note>) => void; onTrash: () => void; onRestore: () => void; onDestroy: () => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false, autolink: true }), Image.configure({ allowBase64: true }), Placeholder.configure({ placeholder: '从这里开始书写…' }), TaskList, TaskItem.configure({ nested: true })],
    content: note.content,
    editable: !inTrash,
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onUpdate: ({ editor: instance }) => onSave({ content: instance.getJSON() }),
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!inTrash)
    editor.commands.setContent(note.content, { emitUpdate: false })
  }, [note.id, inTrash])

  if (!editor) return null
  const setLink = () => {
    const url = prompt('输入链接地址', editor.getAttributes('link').href || 'https://')?.trim()
    if (!url) { editor.chain().focus().unsetLink().run(); return }
    if (!/^https?:\/\//i.test(url)) return alert('只支持 http 或 https 链接')
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  const addImage = () => {
    const url = prompt('输入图片地址（https 或 data URL）')?.trim()
    if (url && (/^https:\/\//i.test(url) || /^data:image\//i.test(url))) editor.chain().focus().setImage({ src: url }).run()
  }
  const action = (active: boolean, title: string, icon: React.ReactNode, run: () => void) => <button className={active ? 'active' : ''} title={title} onClick={run}>{icon}</button>

  return <div className="note-editor-wrap">
    <div className="note-editor-top"><select value={note.folderId || ''} disabled={inTrash} onChange={(event) => onSave({ folderId: event.target.value || null })}><option value="">无文件夹</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><div>
      {!inTrash && <button className="icon-button" onClick={() => onSave({ pinned: !note.pinned })} title={note.pinned ? '取消置顶' : '置顶'}>{note.pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>}
      {inTrash ? <><button className="icon-button" onClick={onRestore} title="恢复"><ArchiveRestore size={17} /></button><button className="icon-button danger" onClick={onDestroy} title="永久删除"><Trash2 size={17} /></button></> : <button className="icon-button" onClick={onTrash} title="移至回收站"><Trash2 size={17} /></button>}
    </div></div>
    <input className="note-title-input" value={note.title} disabled={inTrash} onChange={(event) => onSave({ title: event.target.value })} placeholder="无标题笔记" />
    <input className="tag-input" value={note.tags.join(', ')} disabled={inTrash} onChange={(event) => onSave({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="添加标签，用逗号分隔" />
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
      {action(editor.isActive('link'), '链接', <Link2 size={16} />, setLink)}
      {action(false, '图片', <ImagePlus size={16} />, addImage)}
      {action(false, '撤销', <Undo2 size={16} />, () => { editor.chain().focus().undo().run() })}
    </div>}
    <EditorContent editor={editor} />
    <div className="editor-status">{inTrash ? `删除于 ${formatDate(note.deletedAt || '', true)}` : `自动保存 · ${formatDate(note.updatedAt, true)}`}</div>
  </div>
}
