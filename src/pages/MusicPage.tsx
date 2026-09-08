import { useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, FileMusic, ListMusic, LocateFixed, Music2, Pause, Play, Plus, Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward, Trash2, Volume1, Volume2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { MusicTrack } from '../shared/types'
import { formatDuration } from '../utils'
import { EmptyState } from '../components/Icons'

type RepeatMode = 'off' | 'all' | 'one'

export function MusicPage() {
  const { snapshot, update } = useAppStore()
  const tracks = snapshot?.tracks || []
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [playerError, setPlayerError] = useState('')
  const audio = useRef<HTMLAudioElement>(null)
  const current = tracks.find((track) => track.id === currentId) || null
  const filtered = useMemo(() => tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.toLowerCase())), [tracks, query])

  useEffect(() => {
    if (!window.siyue || tracks.length === 0) return
    void window.siyue.music.checkPaths(tracks.map((track) => track.path)).then((result) => {
      if (tracks.some((track) => track.missing === result[track.path])) {
        update((state) => ({ ...state, tracks: state.tracks.map((track) => ({ ...track, missing: !result[track.path] })) }))
      }
    })
  }, [])

  useEffect(() => { if (audio.current) audio.current.volume = volume }, [volume])

  const addTracks = async () => {
    if (!window.siyue) return
    const picked = await window.siyue.music.pick()
    if (!picked.length) return
    update((state) => {
      const paths = new Set(state.tracks.map((track) => track.path))
      return { ...state, tracks: [...state.tracks, ...picked.filter((track) => !paths.has(track.path))] }
    })
  }

  const playTrack = async (track: MusicTrack) => {
    if (!window.siyue || track.missing) return
    setPlayerError('')
    try {
      const url = await window.siyue.music.getAudioUrl(track.path)
      if (currentId !== track.id && audio.current) {
        audio.current.src = url
        setCurrentId(track.id)
      }
      await audio.current?.play()
      setPlaying(true)
    } catch { setPlayerError('无法播放这个文件，请确认文件仍然存在。') }
  }

  const adjacent = (direction: 1 | -1) => {
    if (!tracks.length) return
    let next: MusicTrack
    if (shuffle && tracks.length > 1) {
      const candidates = tracks.filter((track) => track.id !== currentId && !track.missing)
      next = candidates[Math.floor(Math.random() * candidates.length)] || tracks[0]
    } else {
      const index = Math.max(0, tracks.findIndex((track) => track.id === currentId))
      next = tracks[(index + direction + tracks.length) % tracks.length]
    }
    void playTrack(next)
  }

  const togglePlay = () => {
    if (!current) { if (tracks[0]) void playTrack(tracks[0]); return }
    if (!audio.current) return
    if (playing) { audio.current.pause(); setPlaying(false) } else void audio.current.play().then(() => setPlaying(true))
  }

  const onEnded = () => {
    if (repeat === 'one' && audio.current) { audio.current.currentTime = 0; void audio.current.play(); return }
    if (repeat === 'off' && currentId === tracks.at(-1)?.id && !shuffle) { setPlaying(false); return }
    adjacent(1)
  }

  const remove = (track: MusicTrack) => {
    if (!confirm(`从资料库移除《${track.title}》？\n原始音乐文件不会被删除。`)) return
    if (currentId === track.id) { audio.current?.pause(); setCurrentId(null); setPlaying(false) }
    update((state) => ({ ...state, tracks: state.tracks.filter((item) => item.id !== track.id) }))
  }

  const relocate = async (track: MusicTrack) => {
    if (!window.siyue) return
    const replacement = await window.siyue.music.relocate(track.id)
    if (!replacement) return
    update((state) => ({ ...state, tracks: state.tracks.map((item) => item.id === track.id ? { ...replacement, createdAt: item.createdAt } : item) }))
  }

  if (!window.siyue) return <section className="page"><header className="page-header"><div><span className="eyebrow">MUSIC</span><h1>音乐</h1><p>属于桌面端的安静播放器</p></div></header><EmptyState icon={<Music2 size={27} />} title="桌面版专属能力" description="浏览器无法长期、安全地保留本地音乐路径。安装并打开丝月工坊桌面版后，即可建立你的音乐资料库。" /></section>

  return <section className="page music-page">
    <header className="page-header"><div><span className="eyebrow">MUSIC</span><h1>音乐</h1><p>{tracks.length ? `${tracks.length} 首本地音乐` : '让喜欢的声音留在手边'}</p></div><button className="button primary" onClick={() => void addTracks()}><Plus size={17} />添加音乐</button></header>
    <div className="music-hero">
      <div className="hero-art">{current?.cover ? <img src={current.cover} alt="" /> : <Disc3 size={48} strokeWidth={1.2} />}</div>
      <div className="hero-copy"><span>正在播放</span><h2>{current?.title || '还没有选择音乐'}</h2><p>{current ? `${current.artist} · ${current.album}` : '从资料库中选择一首，给此刻一点声音。'}</p></div>
      <div className="hero-bars" aria-hidden>{[1,2,3,4,5,6,7,8,9,10,11,12].map((bar) => <i key={bar} className={playing ? 'playing' : ''} style={{ '--delay': `${bar * -0.11}s` } as React.CSSProperties} />)}</div>
    </div>
    <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索歌曲、艺术家或专辑" /></label></div>
    {playerError && <div className="notice error">{playerError}</div>}
    {tracks.length === 0 ? <EmptyState icon={<FileMusic size={26} />} title="资料库还是空的" description="选择电脑里的音频文件。丝月工坊只保存索引，不会移动或复制原文件。" action={<button className="button primary" onClick={() => void addTracks()}><Plus size={16} />添加第一首音乐</button>} /> :
      <div className="track-table"><div className="track-head"><span>#</span><span>歌曲</span><span>专辑</span><span>时长</span><span /></div>{filtered.map((track, index) => <div key={track.id} className={`track-row ${currentId === track.id ? 'active' : ''} ${track.missing ? 'missing' : ''}`} onDoubleClick={() => void playTrack(track)}>
        <button className="track-play" disabled={track.missing} onClick={() => currentId === track.id ? togglePlay() : void playTrack(track)}>{currentId === track.id && playing ? <Pause size={15} /> : <span>{index + 1}</span>}</button>
        <div className="track-title"><div className="tiny-cover">{track.cover ? <img src={track.cover} alt="" /> : <Music2 size={15} />}</div><div><strong>{track.title}</strong><span>{track.missing ? '文件已移动或删除' : track.artist}</span></div></div>
        <span className="track-album">{track.album}</span><span>{formatDuration(track.duration)}</span>
        <div className="track-actions">{track.missing && <button onClick={() => void relocate(track)} title="重新定位"><LocateFixed size={16} /></button>}<button onClick={() => remove(track)} title="移除索引"><Trash2 size={16} /></button></div>
      </div>)}</div>}

    <div className={`player-bar ${current ? 'visible' : ''}`}>
      <audio ref={audio} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={onEnded} onError={() => { setPlayerError('音频加载失败'); setPlaying(false) }} />
      <div className="player-track"><div className="tiny-cover large">{current?.cover ? <img src={current.cover} alt="" /> : <ListMusic size={17} />}</div><div><strong>{current?.title || '未选择'}</strong><span>{current?.artist || '—'}</span></div></div>
      <div className="player-center"><div className="player-controls"><button className={shuffle ? 'active' : ''} onClick={() => setShuffle(!shuffle)}><Shuffle size={16} /></button><button onClick={() => adjacent(-1)}><SkipBack size={18} fill="currentColor" /></button><button className="play-main" onClick={togglePlay}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button onClick={() => adjacent(1)}><SkipForward size={18} fill="currentColor" /></button><button className={repeat !== 'off' ? 'active' : ''} onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}>{repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}</button></div>
        <div className="progress-control"><span>{formatDuration(position)}</span><input type="range" min={0} max={duration || 0} value={Math.min(position, duration || 0)} onChange={(event) => { if (audio.current) audio.current.currentTime = Number(event.target.value) }} /><span>{formatDuration(duration)}</span></div></div>
      <div className="volume-control">{volume < 0.05 ? <Volume1 size={17} /> : <Volume2 size={17} />}<input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
    </div>
  </section>
}
