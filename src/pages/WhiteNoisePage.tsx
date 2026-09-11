import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CloudRain, Coffee, Download, Droplets, Flame, Headphones, LoaderCircle, Moon, Pause, Play, Plus, SkipBack, SkipForward, Sparkles, Timer, TrainFront, Trees, Volume2, Waves, Wind } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
import { whiteNoiseCatalog, defaultWhiteNoiseId } from '../resources/whiteNoiseCatalog'
import type { ResourceDownloadProgress, ResourceItem } from '../shared/types'
import { formatDuration } from '../utils'
import { usePersistentState } from '../lib/usePersistentState'

const noiseIcons: Record<string, typeof CloudRain> = {
  'window-rain': CloudRain,
  'misty-forest': Trees,
  'midnight-ocean': Waves,
  'warm-fireplace': Flame,
  'morning-cafe': Coffee,
  'night-train': TrainFront,
  'mountain-wind': Wind,
  'quiet-night': Moon,
  'forest-stream': Droplets,
  'distant-thunder': CloudRain,
}

const browserItems: ResourceItem[] = whiteNoiseCatalog.map((item) => ({
  ...item,
  origin: item.builtin ? 'builtin' : 'official',
  state: item.builtin ? 'builtin' : 'available',
  installedSize: item.builtin ? item.size : 0,
}))

function coverStyle(item: ResourceItem): CSSProperties {
  return item.coverPath
    ? ({ '--noise-cover': `url("/${item.coverPath}")` } as CSSProperties)
    : {}
}

function isReady(item: ResourceItem): boolean {
  return item.state === 'builtin' || item.state === 'installed'
}

export function WhiteNoisePage({ onNowPlayingChange }: { onNowPlayingChange: (item: ResourceItem | null) => void }) {
  const [items, setItems] = useState<ResourceItem[]>(browserItems)
  const [selectedId, setSelectedId] = useState(defaultWhiteNoiseId)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(whiteNoiseCatalog[0].duration)
  const [volume, setVolume] = usePersistentState('whiteNoise.volume', 0.68)
  const [busyId, setBusyId] = useState('')
  const [progress, setProgress] = useState<Record<string, ResourceDownloadProgress>>({})
  const [error, setError] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const SelectedIcon = noiseIcons[selected?.id] ?? Headphones
  const readyItems = useMemo(() => items.filter(isReady), [items])

  const refresh = async () => {
    if (!window.sylunae) return
    const summary = await window.sylunae.resources.list()
    setItems(summary.items)
  }

  useEffect(() => {
    void refresh().catch(() => setError('无法读取本地资源状态。'))
    const onChanged = () => void refresh()
    window.addEventListener('sylunae-resources-changed', onChanged)
    const disposeProgress = window.sylunae?.resources.onDownloadProgress((value) => {
      setProgress((current) => ({ ...current, [value.id]: value }))
    })
    return () => {
      window.removeEventListener('sylunae-resources-changed', onChanged)
      disposeProgress?.()
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    onNowPlayingChange(playing ? selected : null)
  }, [onNowPlayingChange, playing, selected])

  const getAudioUrl = async (item: ResourceItem): Promise<string> => {
    if (window.sylunae) return window.sylunae.resources.getAudioUrl(item.id)
    if (item.builtin) return `/${item.audioPath}`
    throw new Error('按需下载仅在桌面端可用')
  }

  const download = async (item: ResourceItem): Promise<ResourceItem> => {
    if (!window.sylunae) throw new Error('按需下载仅在桌面端可用')
    setBusyId(item.id)
    const installed = await window.sylunae.resources.download(item.id)
    await refresh()
    window.dispatchEvent(new Event('sylunae-resources-changed'))
    return installed
  }

  const playItem = async (item: ResourceItem) => {
    audioRef.current?.pause()
    setError('')
    setSelectedId(item.id)
    try {
      const playable = isReady(item) ? item : await download(item)
      const url = await getAudioUrl(playable)
      const audio = audioRef.current
      if (!audio) return
      if (audio.src !== new URL(url, window.location.href).href) {
        audio.src = url
        audio.load()
        setPosition(0)
        setDuration(playable.duration)
      }
      audio.volume = volume
      await audio.play()
    } catch (cause) {
      audioRef.current?.pause()
      setPlaying(false)
      setError(cause instanceof Error ? cause.message : '暂时无法播放这个白噪音。')
    } finally {
      setBusyId('')
    }
  }

  const toggleSelected = () => {
    const audio = audioRef.current
    if (!audio || !selected) return
    if (playing) audio.pause()
    else void playItem(selected)
  }

  const move = (direction: 1 | -1) => {
    if (!selected || readyItems.length === 0) return
    const currentIndex = readyItems.findIndex((item) => item.id === selected.id)
    const index = currentIndex < 0 ? 0 : (currentIndex + direction + readyItems.length) % readyItems.length
    void playItem(readyItems[index])
  }

  const importAudio = async () => {
    if (!window.sylunae) {
      setError('添加自己的白噪音仅在桌面端可用。')
      return
    }
    setBusyId('import')
    setError('')
    try {
      const imported = await window.sylunae.resources.importWhiteNoise()
      if (imported) {
        await refresh()
        window.dispatchEvent(new Event('sylunae-resources-changed'))
        await playItem(imported)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法添加这个音频。')
    } finally {
      setBusyId('')
    }
  }

  if (!selected) return null

  const selectedProgress = progress[selected.id]
  const selectedBusy = busyId === selected.id

  return <section className="page white-noise-page">
    <audio ref={audioRef} loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || selected.duration)} onError={() => { setPlaying(false); setError('音频文件无法读取，请检查资源是否完整。') }} />

    <header className="page-header"><div><span className="eyebrow">AMBIENCE</span><h1>白噪音</h1><p>留一点自然的声音，让此刻慢下来</p></div><div className="white-noise-header-actions"><Button variant="outline" className="button secondary" onClick={() => void importAudio()} disabled={Boolean(busyId)}><Plus />{busyId === 'import' ? '正在添加…' : '添加白噪音'}</Button><button className="white-noise-timer" type="button" title="定时功能即将开放"><Timer size={16} /><span>定时关闭</span><small>即将开放</small></button></div></header>

    <div className={`white-noise-hero ${playing ? 'is-playing' : ''}`} style={coverStyle(selected)}>
      <div className="white-noise-glow" aria-hidden />
      <div className="white-noise-orb">{selected.coverPath ? <img src={`/${selected.coverPath}`} alt="" /> : <SelectedIcon size={44} strokeWidth={1.25} />}</div>
      <div className="white-noise-hero-copy"><span>{selectedBusy ? '正在获取资源' : playing ? '正在播放' : isReady(selected) ? '已在本地' : '可按需下载'}</span><h2>{selected.title}</h2><p>{selected.description}</p><div>{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{selectedBusy && <div className="white-noise-hero-download"><i style={{ width: `${selectedProgress?.percent ?? 0}%` }} /><small>{selectedProgress?.message ?? '正在准备下载'}</small></div>}</div>
      <button className="white-noise-hero-play" type="button" onClick={toggleSelected} disabled={Boolean(busyId)} aria-label={selectedBusy ? `正在下载${selected.title}` : playing ? `暂停${selected.title}` : isReady(selected) ? `播放${selected.title}` : `下载并播放${selected.title}`}>
        {selectedBusy ? <LoaderCircle className="spin" size={21} /> : playing ? <Pause size={21} fill="currentColor" /> : isReady(selected) ? <Play size={21} fill="currentColor" /> : <Download size={20} />}
      </button>
      <div className="ambient-lines" aria-hidden>{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--line-index': index } as CSSProperties} />)}</div>
    </div>

    {error && <div className="notice error white-noise-error">{error}</div>}
    <div className="white-noise-section-heading"><div><Sparkles size={16} /><h2>选择你喜欢的氛围</h2></div></div>
    <div className="white-noise-grid">{items.map((item) => {
      const Icon = noiseIcons[item.id] ?? Headphones
      const active = selected.id === item.id
      const downloading = busyId === item.id
      return <button type="button" key={item.id} className={`white-noise-card ${active ? 'active' : ''}`} style={coverStyle(item)} onClick={() => active && playing ? audioRef.current?.pause() : void playItem(item)} disabled={Boolean(busyId) && !downloading} aria-pressed={active}>
        <div className="white-noise-card-art">{item.coverPath ? <img src={`/${item.coverPath}`} alt="" /> : <Icon size={31} strokeWidth={1.35} />}<span className="white-noise-card-action">{downloading ? <LoaderCircle className="spin" size={15} /> : active && playing ? <Pause size={15} fill="currentColor" /> : isReady(item) ? <Play size={15} fill="currentColor" /> : <Download size={14} />}</span></div>
        <div className="white-noise-card-copy"><strong>{item.title}</strong><small>{item.description}</small><div>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}<span className="white-noise-card-state">{item.origin === 'custom' ? '本地添加' : item.state === 'builtin' ? '内置' : item.state === 'installed' ? '已下载' : downloading ? `${progress[item.id]?.percent ?? 0}%` : '需下载'}</span></div></div>
        {downloading && <i className="white-noise-card-download" style={{ width: `${progress[item.id]?.percent ?? 0}%` }} />}
      </button>
    })}</div>

    <div className="player-bar white-noise-player visible">
      <div className="player-track white-noise-player-track"><div className="tiny-cover large">{selected.coverPath ? <img src={`/${selected.coverPath}`} alt="" /> : <SelectedIcon size={18} />}</div><div><strong>{selected.title}</strong><span>{isReady(selected) ? '环境白噪音 · 循环播放' : '尚未下载'}</span></div></div>
      <div className="player-center"><div className="player-controls"><button onClick={() => move(-1)} aria-label="上一个本地白噪音"><SkipBack size={18} fill="currentColor" /></button><button className="play-main" onClick={toggleSelected} disabled={Boolean(busyId)} aria-label={playing ? '暂停' : isReady(selected) ? '播放' : '下载并播放'}>{selectedBusy ? <LoaderCircle className="spin" size={18} /> : playing ? <Pause size={18} fill="currentColor" /> : isReady(selected) ? <Play size={18} fill="currentColor" /> : <Download size={17} />}</button><button onClick={() => move(1)} aria-label="下一个本地白噪音"><SkipForward size={18} fill="currentColor" /></button></div>
        <div className="progress-control"><span>{formatDuration(position)}</span><Slider min={0} max={Math.max(duration, 1)} step={1} value={[Math.min(position, duration || 0)]} onValueChange={([value]) => { if (audioRef.current) audioRef.current.currentTime = value }} disabled={!isReady(selected)} aria-label="播放进度" /><span>{formatDuration(duration)}</span></div></div>
      <div className="volume-control"><Volume2 size={17} /><Slider min={0} max={1} step={0.01} value={[volume]} onValueChange={([value]) => setVolume(value)} aria-label="白噪音音量" /></div>
    </div>
  </section>
}
