import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, FileAudio, FolderOpen, Link2, Video } from 'lucide-react'
import type { MusicImportProgress, MusicImportStage, MusicRemoteSource, MusicTrack } from '../shared/types'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Progress } from './ui/progress'

type ImportStep = 'choose' | MusicRemoteSource

const methodCopy: Record<MusicRemoteSource, { title: string; description: string; placeholder: string }> = {
  youtube: {
    title: '从 YouTube 链接导入',
    description: '下载视频中的最佳音频，转换为 MP3，并写入可获取的标题、作者与封面等信息。',
    placeholder: 'https://www.youtube.com/watch?v=…',
  },
  'audio-url': {
    title: '从音频链接下载',
    description: '把 HTTP 或 HTTPS 音频文件下载到本地，再加入音乐资料库。',
    placeholder: 'https://example.com/music.mp3',
  },
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return '导入失败，请稍后重试。'
  const message = error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  const lines = message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const useful = [...lines].reverse().find((line) => /^ERROR:/i.test(line)) || lines.at(-1)
  return useful?.replace(/^ERROR:\s*/i, '').slice(0, 400) || '导入失败，请稍后重试。'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const youtubeStages: Array<{ stage: Exclude<MusicImportStage, 'complete'>; label: string }> = [
  { stage: 'reading', label: '读取信息' },
  { stage: 'downloading', label: '下载音频' },
  { stage: 'converting', label: '转换 MP3' },
  { stage: 'metadata', label: '写入信息' },
]

export function MusicImportDialog({ open, onOpenChange, onImported }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (tracks: MusicTrack[]) => void
}) {
  const inputId = useId()
  const [step, setStep] = useState<ImportStep>('choose')
  const [url, setUrl] = useState('')
  const [directory, setDirectory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<MusicImportProgress | null>(null)
  const activeTaskId = useRef<string | null>(null)

  useEffect(() => window.sylunae?.music.onImportProgress((next) => {
    if (next.taskId === activeTaskId.current) setProgress(next)
  }), [])

  useEffect(() => {
    if (!open || !window.sylunae) return
    setStep('choose')
    setUrl('')
    setError('')
    setProgress(null)
    activeTaskId.current = null
    void window.sylunae.music.getDownloadDirectory().then(setDirectory).catch((reason) => setError(readableError(reason)))
  }, [open])

  const importFiles = async () => {
    if (!window.sylunae) return
    setError('')
    try {
      const tracks = await window.sylunae.music.pick()
      if (tracks.length) { onImported(tracks); onOpenChange(false) }
    } catch (reason) { setError(readableError(reason)) }
  }

  const chooseDirectory = async () => {
    if (!window.sylunae) return
    setError('')
    try {
      const selected = await window.sylunae.music.pickDownloadDirectory(directory)
      if (selected) setDirectory(selected)
    } catch (reason) { setError(readableError(reason)) }
  }

  const importRemote = async () => {
    if (!window.sylunae || step === 'choose') return
    const cleanUrl = url.trim()
    if (!cleanUrl) { setError('请输入链接'); return }
    try {
      const parsed = new URL(cleanUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch { setError('请输入有效的 HTTP 或 HTTPS 链接'); return }
    if (!directory) { setError('请先选择文件保存位置'); return }
    const taskId = crypto.randomUUID()
    activeTaskId.current = taskId
    setBusy(true)
    setError('')
    setProgress(null)
    try {
    const track = await window.sylunae.music.importRemote({ taskId, source: step, url: cleanUrl, directory })
      onImported([track])
      onOpenChange(false)
    } catch (reason) {
      setError(readableError(reason))
    } finally {
      activeTaskId.current = null
      setBusy(false)
    }
  }

  const copy = step === 'choose' ? null : methodCopy[step]

  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
    <DialogContent className="music-import-dialog" size="md">
      {step === 'choose' ? <>
        <DialogHeader>
          <DialogTitle>添加音乐</DialogTitle>
          <DialogDescription>选择一种方式加入音乐资料库。</DialogDescription>
        </DialogHeader>
        <div className="music-import-methods">
          <button type="button" onClick={() => void importFiles()}>
            <span><FileAudio /></span>
            <div><strong>从文件导入</strong><small>选择电脑中已有的一个或多个音频文件</small></div>
          </button>
          <button type="button" onClick={() => setStep('youtube')}>
            <span><Video /></span>
            <div><strong>从 YouTube 链接导入</strong><small>转换为 MP3，并提取视频元信息</small></div>
          </button>
          <button type="button" onClick={() => setStep('audio-url')}>
            <span><Link2 /></span>
            <div><strong>从音频链接下载</strong><small>下载在线音频文件并保存在本地</small></div>
          </button>
        </div>
        {error && <p className="music-import-error">{error}</p>}
      </> : <>
        <DialogHeader className="music-import-header">
          <button type="button" className="music-import-back" onClick={() => { setStep('choose'); setError('') }} disabled={busy} aria-label="返回导入方式"><ArrowLeft /></button>
          <div><DialogTitle>{copy?.title}</DialogTitle><DialogDescription>{copy?.description}</DialogDescription></div>
        </DialogHeader>
        <div className="music-import-form">
          <label htmlFor={inputId}>链接</label>
          <Input id={inputId} autoFocus value={url} onChange={(event) => { setUrl(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter' && !busy) void importRemote() }} placeholder={copy?.placeholder} disabled={busy} />
          <label>文件保存位置</label>
          <button type="button" className="music-import-directory" onClick={() => void chooseDirectory()} disabled={busy} title={directory || '选择文件保存位置'}>
            <FolderOpen /><span>{directory || '正在读取默认位置…'}</span><strong>更改</strong>
          </button>
          <p className="music-import-hint">下载完成后会自动加入资料库。默认保存在丝月工坊的应用数据文件夹中。</p>
          {busy && progress && <div className="music-import-progress" aria-live="polite">
            <div className="music-import-progress-label"><strong>{progress.message}</strong>{progress.source === 'audio-url' && <span>{progress.percent === null ? (progress.receivedBytes ? formatBytes(progress.receivedBytes) : '') : `${progress.percent}%`}</span>}</div>
            {progress.source === 'audio-url' ? <>
              <Progress value={progress.percent ?? 0} className={progress.percent === null ? 'indeterminate' : ''} />
              {progress.receivedBytes !== undefined && <small>{formatBytes(progress.receivedBytes)}{progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ' · 服务器未提供文件大小'}</small>}
            </> : <div className="music-import-stages">
              {youtubeStages.map((item, index) => {
                const currentIndex = progress.stage === 'complete' ? youtubeStages.length : youtubeStages.findIndex((candidate) => candidate.stage === progress.stage)
                const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : ''
                return <span key={item.stage} className={state}>{item.label}</span>
              })}
            </div>}
          </div>}
          {error && <p className="music-import-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={() => void importRemote()} disabled={busy || !url.trim() || !directory}>
            {busy && <span className="spinner small" aria-hidden />}{busy ? '正在处理…' : '下载并导入'}
          </Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>
}
