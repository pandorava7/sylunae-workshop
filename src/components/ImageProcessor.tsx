import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Crop, Download, FileImage, FolderOpen, Plus, RotateCcw, RotateCw, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { centeredCrop, encodeImage, outputName, type CropRect, type ImageEdits } from '../lib/imageProcessing'

interface SourceImage extends ImageEdits { id: string; file: File; url: string; width: number; height: number }
interface EncodedImage { id: string; name: string; blob: Blob; url: string; width: number; height: number; originalSize: number }
interface ResultImage extends EncodedImage { path?: string; saved: boolean; error?: string }
interface WebDirectory {
  name: string
  getFileHandle: (name: string, options?: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> }>
}
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`
const errorLabel = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '处理失败'

function CropNumberInput({ label, value, min, onCommit }: { label: string; value: number; min: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value)))
  const editing = useRef(false)
  useEffect(() => { if (!editing.current) setDraft(String(Math.round(value))) }, [value])
  return <label>{label}<Input type="number" min={min} value={draft}
    onFocus={() => { editing.current = true }} onChange={(event) => setDraft(event.target.value)}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
    onBlur={() => { editing.current = false; const number = Number(draft); if (draft !== '' && Number.isFinite(number)) onCommit(Math.round(number)); setDraft(String(Math.round(value))) }} /></label>
}

export function ImageProcessor() {
  const input = useRef<HTMLInputElement>(null)
  const resultSection = useRef<HTMLElement>(null)
  const urls = useRef(new Set<string>())
  const alive = useRef(true)
  const [items, setItems] = useState<SourceImage[]>([])
  const [activeId, setActiveId] = useState('')
  const [format, setFormat] = useState('image/webp')
  const [quality, setQuality] = useState(82)
  const [cropping, setCropping] = useState(false)
  const [ratio, setRatio] = useState('free')
  const [preview, setPreview] = useState<{ key: string; images: EncodedImage[]; errors: string[] } | null>(null)
  const [results, setResults] = useState<ResultImage[]>([])
  const [viewResult, setViewResult] = useState<ResultImage | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [directory, setDirectory] = useState('')
  const [webDirectory, setWebDirectory] = useState<WebDirectory | null>(null)
  const drag = useRef<{ x: number; y: number; previous: CropRect | null; mode: 'move' | 'draw' | 'resize'; corner?: string } | null>(null)
  const active = items.find((item) => item.id === activeId) ?? items[0]
  const key = useMemo(() => JSON.stringify([items.map(({ id, crop, rotation }) => [id, crop, rotation]), format, quality]), [items, format, quality])
  const currentPreview = preview?.key === key ? preview : null
  const activePreview = currentPreview?.images.find((item) => item.id === active?.id)
  const webPicker = (window as Window & { showDirectoryPicker?: () => Promise<WebDirectory> }).showDirectoryPicker
  const makeUrl = (blob: Blob) => { const url = URL.createObjectURL(blob); urls.current.add(url); return url }
  const release = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url) }

  useEffect(() => {
    alive.current = true
    if (window.sylunae) void window.sylunae.imageProcessing.getDirectory().then((path) => { if (alive.current) setDirectory(path) }).catch((reason) => { if (alive.current) setError(errorLabel(reason)) })
    return () => { alive.current = false; urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current.clear() }
  }, [])

  useEffect(() => {
    if (results.length) resultSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [results])

  useEffect(() => {
    let cancelled = false
    const generated: string[] = []
    const timer = window.setTimeout(() => {
      void (async () => {
        const images: EncodedImage[] = []
        const errors: string[] = []
        for (const item of items) {
          if (cancelled) return
          try {
            const encoded = await encodeImage(item.file, item, format, quality)
            if (cancelled) return
            const url = makeUrl(encoded.blob)
            generated.push(url)
            images.push({ ...encoded, id: item.id, name: outputName(item.file.name, format), url, originalSize: item.file.size })
          } catch (reason) { errors.push(`${item.file.name}：${errorLabel(reason)}`) }
        }
        if (!cancelled) setPreview({ key, images, errors })
      })()
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer); generated.forEach(release) }
  }, [key])

  const addFiles = async (files: File[]) => {
    setLoading(true)
    setError('')
    const next: SourceImage[] = []
    const failures: string[] = []
    for (const file of files) {
      try {
        const bitmap = await createImageBitmap(file)
        const dimensions = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
        if (!alive.current) return
        next.push({ id: crypto.randomUUID(), file, url: makeUrl(file), ...dimensions, crop: null, rotation: 0 })
      } catch { failures.push(`${file.name}：无法读取图片`) }
    }
    if (!alive.current) return
    setItems((previous) => [...previous, ...next])
    if (next.length) setActiveId(next[0].id)
    setCropping(false)
    setError(failures.join('；'))
    setLoading(false)
  }
  const patchActive = (patch: Partial<ImageEdits>) => setItems((previous) => previous.map((item) => item.id === active?.id ? { ...item, ...patch } : item))
  const rotate = (delta: number, all = false) => setItems((previous) => previous.map((item) => all || item.id === active?.id ? { ...item, rotation: (item.rotation + delta + 360) % 360 } : item))
  const cropRatio = ratio === 'original' && active ? active.width / active.height : ratio === 'free' ? null : Number(ratio)
  const changeRatio = (value: string) => {
    setRatio(value)
    if (!active) return
    const number = value === 'original' ? active.width / active.height : value === 'free' ? null : Number(value)
    if (number) patchActive({ crop: centeredCrop(active.width, active.height, number) })
  }
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(active!.width, (event.clientX - rect.left) / rect.width * active!.width)), y: Math.max(0, Math.min(active!.height, (event.clientY - rect.top) / rect.height * active!.height)) }
  }
  const cropMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !active) return
    const end = point(event)
    const start = drag.current
    if (start.mode === 'move' && start.previous) {
      const previous = start.previous
      patchActive({ crop: { ...previous, x: Math.max(0, Math.min(active.width - previous.width, previous.x + end.x - start.x)), y: Math.max(0, Math.min(active.height - previous.height, previous.y + end.y - start.y)) } })
      return
    }
    const anchor = start.mode === 'resize' && start.previous ? { x: start.corner?.includes('w') ? start.previous.x + start.previous.width : start.previous.x, y: start.corner?.includes('n') ? start.previous.y + start.previous.height : start.previous.y } : start
    let width = Math.abs(end.x - anchor.x)
    let height = Math.abs(end.y - anchor.y)
    if (cropRatio) {
      width = Math.min(width, height * cropRatio)
      height = width / cropRatio
    }
    if (width >= 1 && height >= 1) patchActive({ crop: { x: end.x < anchor.x ? anchor.x - width : anchor.x, y: end.y < anchor.y ? anchor.y - height : anchor.y, width, height } })
  }
  const pickDirectory = async () => {
    try {
      if (window.sylunae) {
        const path = await window.sylunae.imageProcessing.pickDirectory()
        if (path) setDirectory(path)
      } else if (webPicker) {
        const handle = await webPicker.call(window)
        setWebDirectory(handle)
        setDirectory(handle.name)
      }
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(errorLabel(reason)) }
  }
  const openDirectory = async () => {
    try { await window.sylunae?.imageProcessing.openDirectory() } catch (reason) { setError(errorLabel(reason)) }
  }
  const download = (item: EncodedImage) => {
    const anchor = document.createElement('a')
    anchor.href = item.url
    anchor.download = item.name
    anchor.click()
  }
  const exportImages = async () => {
    if (!currentPreview?.images.length || busy) return
    setBusy(true)
    setError('')
    const exported: ResultImage[] = []
    try {
      for (const [index, image] of currentPreview.images.entries()) {
        setProgress(`${index + 1} / ${currentPreview.images.length}`)
        const result: ResultImage = { ...image, url: makeUrl(image.blob), saved: false }
        try {
          if (window.sylunae) {
            result.path = await window.sylunae.imageProcessing.save(image.name, await image.blob.arrayBuffer())
            result.name = result.path.split(/[\\/]/).pop() ?? image.name
            result.saved = true
          } else if (webDirectory) {
            let name = image.name
            let suffix = 1
            while (true) {
              try { await webDirectory.getFileHandle(name); name = image.name.replace(/(\.[^.]+)$/, ` (${suffix++})$1`) }
              catch (reason) { if (reason instanceof DOMException && reason.name === 'NotFoundError') break; throw reason }
            }
            const writable = await (await webDirectory.getFileHandle(name, { create: true })).createWritable()
            await writable.write(image.blob)
            await writable.close()
            result.name = name
            result.saved = true
          }
        } catch (reason) { result.error = errorLabel(reason) }
        exported.push(result)
      }
      if (!alive.current) { exported.forEach((item) => release(item.url)); return }
      results.forEach((item) => release(item.url))
      setViewResult(null)
      setResults(exported)
    } finally { if (alive.current) { setBusy(false); setProgress('') } }
  }

  return <div className="tool-workspace image-processor">
    <div className="panel-heading"><h2>图片处理</h2><Button onClick={() => input.current?.click()} disabled={busy || loading}><Plus size={16} />{loading ? '正在读取…' : '添加图片'}</Button></div>
    <input ref={input} type="file" accept="image/*" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void addFiles(files) }} />
    {error && <p className="image-processing-error" role="alert">{error}</p>}
    <div className="image-tool-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy && !loading) void addFiles(Array.from(event.dataTransfer.files)) }}>
      <div className="image-edit-area">
        {!active ? <button className="image-dropzone" disabled={loading} onClick={() => input.current?.click()}><FileImage size={38} /><strong>选择或拖入图片</strong><span>可批量选择</span></button> : <>
          <div className="image-source-list" aria-label="待处理图片">{items.map((item) => <div key={item.id} className={`image-source-item ${item.id === active?.id ? 'active' : ''}`}>
            <button disabled={busy} onClick={() => { setActiveId(item.id); setCropping(false); setRatio('free') }}><img src={item.url} alt="" /><span>{item.file.name}</span></button>
            <Button variant="ghost" size="icon" aria-label={`移除 ${item.file.name}`} disabled={busy} onClick={() => { release(item.url); setItems((previous) => previous.filter((value) => value.id !== item.id)); setCropping(false) }}><X size={14} /></Button>
          </div>)}</div>
          <div className="image-preview-stage">
            <div className={`image-crop-surface ${cropping ? 'cropping' : ''}`}
              onPointerDown={(event) => {
                if (!cropping || busy) return
                event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
                const position = point(event)
                const corner = (event.target as HTMLElement).closest<HTMLElement>('[data-crop-handle]')?.dataset.cropHandle
                const rect = active.crop
                const inside = rect && position.x >= rect.x && position.x <= rect.x + rect.width && position.y >= rect.y && position.y <= rect.y + rect.height
                drag.current = { ...position, previous: rect, mode: corner ? 'resize' : inside ? 'move' : 'draw', corner }
              }}
              onPointerMove={cropMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { if (drag.current) patchActive({ crop: drag.current.previous }); drag.current = null }}>
              <img src={cropping ? active.url : activePreview?.url ?? active.url} alt={cropping ? '裁剪原图' : '输出预览'} draggable={false} />
              {cropping && active.crop && <div className="image-crop-selection" style={{ left: `${active.crop.x / active.width * 100}%`, top: `${active.crop.y / active.height * 100}%`, width: `${active.crop.width / active.width * 100}%`, height: `${active.crop.height / active.height * 100}%` }}><span /><span />{['nw', 'ne', 'sw', 'se'].map((corner) => <span key={corner} className={`image-crop-handle ${corner}`} data-crop-handle={corner} />)}</div>}
            </div>
          </div>
          <div className="image-preview-meta"><strong>{cropping ? '裁剪' : '输出预览'}</strong><span>{activePreview ? `${activePreview.width} × ${activePreview.height} · ${sizeLabel(activePreview.blob.size)}` : '正在生成预览…'}</span></div>
          <div className="image-edit-toolbar"><Button variant={cropping ? 'default' : 'outline'} disabled={busy} onClick={() => setCropping(!cropping)}><Crop size={16} />{cropping ? '完成裁剪' : '裁剪'}</Button><Button variant="outline" disabled={busy} onClick={() => rotate(-90)}><RotateCcw size={16} />左转 90°</Button><Button variant="outline" disabled={busy} onClick={() => rotate(90)}><RotateCw size={16} />右转 90°</Button><Button variant="ghost" disabled={busy} onClick={() => patchActive({ crop: null, rotation: 0 })}>重置</Button></div>
          {cropping && <div className="image-crop-controls"><label>裁剪比例<Select value={ratio} onValueChange={changeRatio}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['free', '自由'], ['original', '原图'], ['1', '1:1'], ['1.3333333333333333', '4:3'], ['0.75', '3:4'], ['1.7777777777777777', '16:9'], ['0.5625', '9:16'], ['1.5', '3:2']].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
            {(['x', 'y', 'width', 'height'] as const).map((field) => <CropNumberInput key={`${active.id}-${field}`} label={({ x: 'X', y: 'Y', width: '宽', height: '高' })[field]} min={field === 'x' || field === 'y' ? 0 : 1} value={(active.crop ?? { x: 0, y: 0, width: active.width, height: active.height })[field]} onCommit={(value) => {
              const rect = { ...(active.crop ?? { x: 0, y: 0, width: active.width, height: active.height }), [field]: value }
              rect.x = Math.max(0, Math.min(active.width - 1, rect.x)); rect.y = Math.max(0, Math.min(active.height - 1, rect.y))
              rect.width = Math.max(1, Math.min(active.width - rect.x, rect.width)); rect.height = Math.max(1, Math.min(active.height - rect.y, rect.height))
              if (cropRatio && (field === 'width' || field === 'height')) {
                rect.width = Math.min(field === 'height' ? rect.height * cropRatio : rect.width, active.width - rect.x, (active.height - rect.y) * cropRatio)
                rect.height = rect.width / cropRatio
              }
              patchActive({ crop: rect })
            }} />)}<Button variant="ghost" onClick={() => patchActive({ crop: null })}>取消裁剪</Button></div>}
        </>}
      </div>
      <div className="image-options">
        <label>输出格式<Select value={format} onValueChange={setFormat} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image/webp">WebP</SelectItem><SelectItem value="image/jpeg">JPG · 白色背景</SelectItem><SelectItem value="image/png">PNG</SelectItem></SelectContent></Select></label>
        <label>编码质量<output>{format === 'image/png' ? '无损' : `${quality}%`}</output><Slider aria-label="编码质量" min={20} max={100} step={1} value={[quality]} onValueChange={([value]) => setQuality(value)} disabled={busy || format === 'image/png'} /></label>
        {items.length > 1 && <div className="image-batch-actions"><strong>批量旋转</strong><div><Button variant="outline" disabled={busy} onClick={() => rotate(-90, true)}>全部左转 90°</Button><Button variant="outline" disabled={busy} onClick={() => rotate(90, true)}>全部右转 90°</Button></div></div>}
        <div className="image-output-directory"><strong>输出文件夹</strong><span>{directory || '浏览器下载'}</span><div>{(window.sylunae || webPicker) && <Button variant="outline" disabled={busy} onClick={() => void pickDirectory()}>更改位置</Button>}{window.sylunae && <Button variant="outline" disabled={busy || !directory} onClick={() => void openDirectory()}><FolderOpen size={16} />打开文件夹</Button>}</div></div>
        <div className="image-output-summary" aria-live="polite"><span>{items.length} 张图片</span><strong>{currentPreview ? `预计输出 ${sizeLabel(currentPreview.images.reduce((sum, item) => sum + item.blob.size, 0))}` : items.length ? '正在计算大小…' : '尚未选择图片'}</strong>{currentPreview && <span>原图 {sizeLabel(items.reduce((sum, item) => sum + item.file.size, 0))}</span>}</div>
        {currentPreview?.errors.map((message) => <p key={message} className="image-processing-error" role="alert">{message}</p>)}
        <Button disabled={busy || loading || !currentPreview?.images.length} onClick={() => void exportImages()}><Download size={16} />{busy ? `正在输出 ${progress}` : window.sylunae || webDirectory ? `保存 ${currentPreview?.images.length ?? items.length} 张图片` : '生成输出结果'}</Button>
      </div>
    </div>
    {results.length > 0 && <section ref={resultSection} className="image-results"><div className="panel-heading"><h3 aria-live="polite">输出结果 · {results.length}</h3><div>{window.sylunae && <Button variant="outline" onClick={() => void openDirectory()}><FolderOpen size={16} />打开文件夹</Button>}<Button variant="ghost" disabled={busy} onClick={() => { setViewResult(null); results.forEach((item) => release(item.url)); setResults([]) }}><Trash2 size={16} />清空结果</Button></div></div><div className="image-result-grid">{results.map((result) => <article className="image-result-card" key={result.id}><button onClick={() => setViewResult(result)}><img src={result.url} alt={result.name} /><strong>{result.name}</strong></button><span>{result.width} × {result.height} · {sizeLabel(result.blob.size)}</span><span className={result.error ? 'image-processing-error' : ''}>{result.error ?? (result.saved ? '已保存' : '待下载')}</span><Button variant="outline" onClick={() => download(result)}><Download size={15} />下载</Button></article>)}</div></section>}
    <Dialog open={!!viewResult} onOpenChange={(open) => { if (!open) setViewResult(null) }}><DialogContent className="image-result-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>{viewResult?.name}</DialogTitle></DialogHeader>{viewResult && <><img src={viewResult.url} alt={viewResult.name} /><span>{viewResult.width} × {viewResult.height} · {sizeLabel(viewResult.blob.size)}</span><Button onClick={() => download(viewResult)}><Download size={16} />下载图片</Button></>}</DialogContent></Dialog>
  </div>
}
