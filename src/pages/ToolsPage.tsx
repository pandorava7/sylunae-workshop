import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Clipboard, Copy, ExternalLink, FileImage, ImageDown, Link2, Plus, Search, Trash2, WandSparkles } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { ClipboardSnippet, LauncherLink } from '../shared/types'
import { newId, nowIso } from '../utils'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'

type ToolView = 'home' | 'clipboard' | 'launcher' | 'image'

const toolCards = [
  { id: 'clipboard' as const, title: '剪贴板', description: '保存常用文本、代码、颜文字和 Prompt，需要时一键复制。', icon: Clipboard, accent: 'lilac' },
  { id: 'launcher' as const, title: '链接启动器', description: '集中常用网站和页面，让重要链接不再散落各处。', icon: Link2, accent: 'blue' },
  { id: 'image' as const, title: '图片转换 / 压缩', description: '在本地转换 JPG、PNG、WebP，并自由控制图片质量。', icon: FileImage, accent: 'green' },
]

export function ToolsPage({ initialView = 'home' }: { initialView?: ToolView }) {
  const [view, setView] = useState<ToolView>(initialView)
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }) }, [view])
  return <section ref={pageRef} className="page tools-page">
    <header className="page-header"><div><span className="eyebrow">UTILITY BOX</span><h1>工具箱</h1><p>{view === 'home' ? '轻量、顺手，并且只在需要时出现' : <button className="back-link" onClick={() => setView('home')}>← 返回全部工具</button>}</p></div></header>
    {view === 'home' && <><div className="tools-hero"><div><span>MORE TOOLS</span><h2>把零散的小动作，<br />变成顺手的日常。</h2><p>所有数据优先保存在本地，与你的工作节奏保持一致。</p></div><WandSparkles size={70} strokeWidth={1} /></div><div className="tool-card-grid">{toolCards.map(({ id, title, description, icon: Icon, accent }) => <button key={id} className="tool-entry-card" onClick={() => setView(id)}><span className={`tool-entry-icon ${accent}`}><Icon size={23} /></span><strong>{title}</strong><p>{description}</p><span className="tool-entry-action">打开工具 <span>→</span></span></button>)}</div></>}
    {view === 'clipboard' && <ClipboardTool />}
    {view === 'launcher' && <LauncherTool />}
    {view === 'image' && <ImageTool />}
  </section>
}

function ClipboardTool() {
  const { snapshot, update } = useAppStore()
  const items = snapshot?.clipboardSnippets ?? []
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const visible = useMemo(() => items.filter((item) => `${item.title} ${item.content} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [items, query])
  const save = (input: Omit<ClipboardSnippet, 'id' | 'createdAt' | 'updatedAt'>) => { const now = nowIso(); update((state) => ({ ...state, clipboardSnippets: [{ ...input, id: newId(), createdAt: now, updatedAt: now }, ...state.clipboardSnippets] })); setCreating(false) }
  const copy = async (item: ClipboardSnippet) => { await navigator.clipboard.writeText(item.content); setCopied(item.id); window.setTimeout(() => setCopied(null), 1400) }
  return <div className="tool-workspace"><div className="panel-heading"><div><h2>剪贴板</h2><p>{items.length} 条常用内容，点击即可复制</p></div><Button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />新建内容</Button></div><div className="toolbar"><label className="search-box"><Search size={16} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题、内容或分类" /></label></div><div className="snippet-grid">{visible.map((item) => <article className="snippet-card" key={item.id}><div><span>{item.category || '未分类'}</span><button className="icon-button danger" onClick={() => update((state) => ({ ...state, clipboardSnippets: state.clipboardSnippets.filter((value) => value.id !== item.id) }))}><Trash2 size={15} /></button></div><h3>{item.title}</h3><pre>{item.content}</pre><Button variant="outline" className="button secondary full" onClick={() => void copy(item)}>{copied === item.id ? <Check size={16} /> : <Copy size={16} />}{copied === item.id ? '已复制' : '复制内容'}</Button></article>)}</div>{!visible.length && <ToolEmpty icon={<Clipboard />} text="还没有匹配的剪贴内容" />}{creating && <SnippetDialog onClose={() => setCreating(false)} onSave={save} />}</div>
}

function SnippetDialog({ onClose, onSave }: { onClose: () => void; onSave: (value: Omit<ClipboardSnippet, 'id' | 'createdAt' | 'updatedAt'>) => void }) {
  const [title, setTitle] = useState(''); const [category, setCategory] = useState(''); const [content, setContent] = useState('')
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="modal-card"><DialogHeader className="modal-title"><div><span className="eyebrow">NEW CLIP</span><DialogTitle>新建剪贴内容</DialogTitle><DialogDescription>保存之后，随时一键复制。</DialogDescription></div></DialogHeader><label>标题<Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：常用项目介绍" /></label><label>分类<Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：Prompt、代码、颜文字" /></label><label>内容<Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} placeholder="粘贴要保存的内容…" /></label><DialogFooter className="modal-actions"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button className="button primary" disabled={!title.trim() || !content.trim()} onClick={() => onSave({ title: title.trim(), category: category.trim(), content })}>保存</Button></DialogFooter></DialogContent></Dialog>
}

function LauncherTool() {
  const { snapshot, update } = useAppStore(); const links = snapshot?.launcherLinks ?? []; const [creating, setCreating] = useState(false)
  const open = (url: string) => window.sylunae?.system.openExternal(url) ?? window.open(url, '_blank', 'noopener,noreferrer')
  const save = (input: Omit<LauncherLink, 'id' | 'createdAt' | 'updatedAt'>) => { const now = nowIso(); update((state) => ({ ...state, launcherLinks: [{ ...input, id: newId(), createdAt: now, updatedAt: now }, ...state.launcherLinks] })); setCreating(false) }
  return <div className="tool-workspace"><div className="panel-heading"><div><h2>链接启动器</h2><p>把常去的地方放在触手可及的位置</p></div><Button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />添加链接</Button></div><div className="launcher-grid">{links.map((link) => { let host = ''; try { host = new URL(link.url).hostname.replace(/^www\./, '') } catch { host = link.url }; return <article className="launcher-card" key={link.id}><button className="launcher-open" onClick={() => open(link.url)}><span className="site-favicon">{link.title.slice(0, 1).toUpperCase()}</span><div><strong>{link.title}</strong><small>{host}</small></div><ExternalLink size={16} /></button><p>{link.description || '未添加说明'}</p><button className="launcher-delete" onClick={() => update((state) => ({ ...state, launcherLinks: state.launcherLinks.filter((item) => item.id !== link.id) }))}><Trash2 size={14} />移除</button></article> })}</div>{!links.length && <ToolEmpty icon={<Link2 />} text="添加一个常用链接，下一次打开会更快" />}{creating && <LinkDialog onClose={() => setCreating(false)} onSave={save} />}</div>
}

function LinkDialog({ onClose, onSave }: { onClose: () => void; onSave: (value: Omit<LauncherLink, 'id' | 'createdAt' | 'updatedAt'>) => void }) {
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [description, setDescription] = useState('')
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="modal-card"><DialogHeader className="modal-title"><div><span className="eyebrow">NEW LINK</span><DialogTitle>添加链接</DialogTitle><DialogDescription>网址图标会以简洁的首字母样式呈现。</DialogDescription></div></DialogHeader><label>名称<Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：个人博客" /></label><label>网址<Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" /></label><label>说明<Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="这个链接是做什么的？" /></label><DialogFooter className="modal-actions"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button className="button primary" disabled={!title.trim() || !url.trim()} onClick={() => onSave({ title: title.trim(), url: normalized, description: description.trim() })}>添加</Button></DialogFooter></DialogContent></Dialog>
}

function ImageTool() {
  const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [format, setFormat] = useState('image/webp'); const [quality, setQuality] = useState(82); const [busy, setBusy] = useState(false)
  const convert = async () => { if (!file) return; setBusy(true); try { const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d')!.drawImage(bitmap, 0, 0); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality / 100)); if (!blob) return; const extension = format.split('/')[1].replace('jpeg', 'jpg'); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${file.name.replace(/\.[^.]+$/, '')}.${extension}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000) } finally { setBusy(false) } }
  return <div className="tool-workspace"><div className="panel-heading"><div><h2>图片转换 / 压缩</h2><p>处理在浏览器本地完成，图片不会上传</p></div></div><div className="image-tool-card"><button className={`image-dropzone ${file ? 'has-file' : ''}`} onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />{file ? <><ImageDown size={34} /><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · 点击更换图片</span></> : <><FileImage size={38} /><strong>选择一张图片</strong><span>支持 PNG、JPG 与 WebP，单次处理一张</span></>}</button><div className="image-options"><label>输出格式<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image/webp">WebP</SelectItem><SelectItem value="image/jpeg">JPG</SelectItem><SelectItem value="image/png">PNG</SelectItem></SelectContent></Select></label><label>图片质量 <output>{quality}%</output><input type="range" min="20" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} disabled={format === 'image/png'} /></label><Button className="button primary" disabled={!file || busy} onClick={() => void convert()}><ImageDown size={17} />{busy ? '正在处理…' : '转换并下载'}</Button></div></div><div className="privacy-note"><Check size={16} />整个过程只使用设备本地计算，不会传输或保存原图。</div></div>
}

function ToolEmpty({ icon, text }: { icon: ReactNode; text: string }) { return <div className="tool-empty">{icon}<strong>{text}</strong><span>从右上角的新建按钮开始。</span></div> }
