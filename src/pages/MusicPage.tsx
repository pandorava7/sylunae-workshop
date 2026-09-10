import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Album, Disc3, FileMusic, ListMusic, LocateFixed, Music2, Pause, PencilLine, Play, Plus, Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward, Trash2, Volume1, Volume2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { MusicAlbum, MusicMetadataUpdate, MusicTrack } from '../shared/types'
import { formatDuration } from '../utils'
import { albumCover, reconcileMusicLibrary, trackCover } from '../music/albums'
import { EmptyState } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Slider } from '../components/ui/slider'
import { MusicMetadataSheet } from '../components/MusicMetadataSheet'
import { MusicAlbumSheet } from '../components/MusicAlbumSheet'
import { MusicImportDialog } from '../components/MusicImportDialog'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { AudioWaveform } from '../components/AudioWaveform'
import { adjacentTrack, playbackQueue } from '../music/playback'
import { usePersistentState } from '../lib/usePersistentState'

type RepeatMode = 'off' | 'all' | 'one'

export function MusicPage({ onNowPlayingChange }: { onNowPlayingChange: (track: MusicTrack | null) => void }) {
  const { snapshot, update } = useAppStore()
  const tracks = snapshot?.tracks || []
  const albums = snapshot?.albums || []
  const [view, setView] = usePersistentState<'tracks' | 'albums'>('navigation.musicView', 'tracks')
  const [query, setQuery] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [queueAlbumId, setQueueAlbumId] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [removeTarget, setRemoveTarget] = useState<MusicTrack | null>(null)
  const [editTarget, setEditTarget] = useState<MusicTrack | null>(null)
  const [albumTarget, setAlbumTarget] = useState<MusicAlbum | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const releasingForEdit = useRef(false)
  const current = tracks.find((track) => track.id === currentId) || null
  const currentCover = current ? trackCover(current, albums, tracks) : ''
  const filtered = useMemo(() => tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.toLowerCase())), [tracks, query])
  const filteredAlbums = useMemo(() => albums.filter((album) => `${album.title} ${album.artist}`.toLowerCase().includes(query.toLowerCase())), [albums, query])
  const queue = useMemo(() => playbackQueue(tracks, queueAlbumId), [tracks, queueAlbumId])

  useEffect(() => {
    if (!window.sylunae || tracks.length === 0) return
    void window.sylunae.music.checkPaths(tracks.map((track) => track.path)).then((result) => {
      if (tracks.some((track) => track.missing === result[track.path])) {
        update((state) => ({ ...state, tracks: state.tracks.map((track) => ({ ...track, missing: !result[track.path] })) }))
      }
    })
  }, [])

  useEffect(() => { if (audio.current) audio.current.volume = volume }, [volume])

  useEffect(() => {
    onNowPlayingChange(playing && current ? { ...current, cover: currentCover } : null)
  }, [current, currentCover, playing, onNowPlayingChange])

  const addImportedTracks = (picked: MusicTrack[]) => {
    update((state) => {
      const paths = new Set(state.tracks.map((track) => track.path))
      const additions = picked.filter((track) => {
        if (paths.has(track.path)) return false
        paths.add(track.path)
        return true
      })
      const library = reconcileMusicLibrary([...state.tracks, ...additions], state.albums)
      return { ...state, ...library }
    })
  }

  const playTrack = async (track: MusicTrack, albumId: string | null = null) => {
    if (!window.sylunae || track.missing) return
    setQueueAlbumId(albumId)
    setPlayerError('')
    try {
      const url = await window.sylunae.music.getAudioUrl(track.path)
      setAudioUrl(url)
      if (currentId !== track.id && audio.current) {
        audio.current.src = url
        setCurrentId(track.id)
      }
      await audio.current?.play()
      setPlaying(true)
    } catch { setPlayerError('无法播放这个文件，请确认文件仍然存在。') }
  }

  const adjacent = (direction: 1 | -1) => {
    const next = adjacentTrack(queue, currentId, direction, shuffle)
    if (next) void playTrack(next, queueAlbumId)
  }

  const togglePlay = () => {
    if (!current) { if (tracks[0]) void playTrack(tracks[0]); return }
    if (!audio.current) return
    if (playing) { audio.current.pause(); setPlaying(false) } else void audio.current.play().then(() => setPlaying(true))
  }

  const onEnded = () => {
    if (repeat === 'one' && audio.current) { audio.current.currentTime = 0; void audio.current.play(); return }
    if (repeat === 'off' && currentId === queue.at(-1)?.id && !shuffle) { setPlaying(false); return }
    adjacent(1)
  }

  const remove = (track: MusicTrack) => {
    if (currentId === track.id) { audio.current?.pause(); setCurrentId(null); setAudioUrl(''); setPlaying(false) }
    update((state) => ({ ...state, ...reconcileMusicLibrary(state.tracks.filter((item) => item.id !== track.id), state.albums) }))
  }

  const relocate = async (track: MusicTrack) => {
    if (!window.sylunae) return
    const replacement = await window.sylunae.music.relocate(track.id)
    if (!replacement) return
    update((state) => ({ ...state, ...reconcileMusicLibrary(state.tracks.map((item) => item.id === track.id ? { ...replacement, createdAt: item.createdAt } : item), state.albums) }))
  }

  const saveMetadata = async (input: MusicMetadataUpdate) => {
    if (!window.sylunae) return
    const element = audio.current
    const isCurrent = currentId === input.id && Boolean(element?.src)
    const wasPlaying = isCurrent && playing
    const resumeAt = isCurrent ? element?.currentTime || 0 : 0
    if (isCurrent && element) {
      releasingForEdit.current = true
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
    try {
      const replacement = await window.sylunae.music.updateMetadata(input)
      update((state) => ({ ...state, ...reconcileMusicLibrary(state.tracks.map((item) => item.id === input.id ? { ...replacement, createdAt: item.createdAt } : item), state.albums) }))
    } finally {
      if (isCurrent && element) {
        try {
          const url = await window.sylunae.music.getAudioUrl(input.path)
          element.src = url
          await new Promise<void>((resolve, reject) => {
            const loaded = () => { cleanup(); resolve() }
            const failed = () => { cleanup(); reject(new Error('reload failed')) }
            const cleanup = () => { element.removeEventListener('loadedmetadata', loaded); element.removeEventListener('error', failed) }
            element.addEventListener('loadedmetadata', loaded)
            element.addEventListener('error', failed)
            element.load()
          })
          element.currentTime = Math.min(resumeAt, element.duration || resumeAt)
          if (wasPlaying) await element.play()
        } catch {
          setPlayerError('元信息已保存，但播放器重新加载文件失败。')
        } finally {
          releasingForEdit.current = false
        }
      }
    }
  }

  const saveAlbumCover = (albumId: string, cover: string) => {
    update((state) => ({ ...state, albums: state.albums.map((album) => album.id === albumId ? { ...album, cover, updatedAt: new Date().toISOString() } : album) }))
  }

  if (!window.sylunae) return <section className="page"><header className="page-header"><div><span className="eyebrow">MUSIC</span><h1>音乐</h1><p>属于桌面端的安静播放器</p></div></header><EmptyState icon={<Music2 size={27} />} title="桌面版专属能力" description="浏览器无法长期、安全地保留本地音乐路径。安装并打开丝月工坊桌面版后，即可建立你的音乐资料库。" /></section>

  return <section className="page music-page">
    <header className="page-header"><div><span className="eyebrow">MUSIC</span><h1>音乐</h1><p>{tracks.length ? `${tracks.length} 首本地音乐` : '让喜欢的声音留在手边'}</p></div><Button className="button primary" onClick={() => setImportOpen(true)}><Plus size={17} />添加音乐</Button></header>
    <div
      className={`music-hero ${playing && currentCover ? 'is-playing' : ''}`}
      style={{ '--music-hero-cover': currentCover ? `url(${currentCover})` : 'none' } as CSSProperties}
    >
      <div className="hero-art">{currentCover ? <img src={currentCover} alt="" /> : <Disc3 size={48} strokeWidth={1.2} />}</div>
      <div className="hero-copy"><span>正在播放</span><h2>{current?.title || '还没有选择音乐'}</h2><p>{current ? `${current.artist} · ${current.album}` : '从资料库中选择一首，给此刻一点声音。'}</p></div>
      {current && audioUrl ? <AudioWaveform media={audio.current} src={audioUrl} /> : <div className="audio-waveform-placeholder" aria-hidden><span /></div>}
    </div>
    <div className="toolbar music-library-toolbar">
      <Tabs value={view} onValueChange={(value) => setView(value as 'tracks' | 'albums')}><TabsList variant="line" aria-label="音乐资料库视图"><TabsTrigger value="tracks"><Music2 />歌曲 <span>{tracks.length}</span></TabsTrigger><TabsTrigger value="albums"><Album />专辑 <span>{albums.length}</span></TabsTrigger></TabsList></Tabs>
      <label className="search-box"><Search size={17} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'tracks' ? '搜索歌曲、艺术家或专辑' : '搜索专辑或艺术家'} /></label>
    </div>
    {playerError && <div className="notice error">{playerError}</div>}
    {tracks.length === 0 ? <EmptyState icon={<FileMusic size={26} />} title="资料库还是空的" description="可以索引电脑中的音频，也可以从 YouTube 或音频链接下载到本地。" action={<Button className="button primary" onClick={() => setImportOpen(true)}><Plus size={16} />添加第一首音乐</Button>} /> :
      view === 'tracks' ? <div className="track-table"><div className="track-head"><span>#</span><span>歌曲</span><span>专辑</span><span>时长</span><span /></div>{filtered.map((track, index) => <div key={track.id} className={`track-row ${currentId === track.id ? 'active' : ''} ${track.missing ? 'missing' : ''}`} onDoubleClick={() => void playTrack(track)}>
        <button className="track-play" disabled={track.missing} onClick={() => currentId === track.id ? togglePlay() : void playTrack(track)}>{currentId === track.id && playing ? <Pause size={15} /> : <span>{index + 1}</span>}</button>
        <div className="track-title"><div className="tiny-cover">{trackCover(track, albums, tracks) ? <img src={trackCover(track, albums, tracks)} alt="" /> : <Music2 size={15} />}</div><div><strong>{track.title}</strong><span>{track.missing ? '文件已移动或删除' : track.artist}</span></div></div>
        {(() => { const album = track.albumId ? albums.find((item) => item.id === track.albumId) : undefined; return album ? <button type="button" className="track-album track-album-link" onClick={() => setAlbumTarget(album)}>{track.album}</button> : <span className="track-album">{track.album}</span> })()}<span>{formatDuration(track.duration)}</span>
        <div className="track-actions">{track.missing && <button onClick={() => void relocate(track)} title="重新定位"><LocateFixed size={16} /></button>}<button disabled={track.missing} onClick={() => setEditTarget(track)} title="编辑元信息"><PencilLine size={16} /></button><button onClick={() => setRemoveTarget(track)} title="移除索引"><Trash2 size={16} /></button></div>
      </div>)}</div> : filteredAlbums.length ? <div className="music-album-grid">{filteredAlbums.map((album) => {
        const albumTracks = tracks.filter((track) => track.albumId === album.id)
        const cover = albumCover(album, albumTracks)
        return <button className="music-album-card" key={album.id} onClick={() => setAlbumTarget(album)}><div className="music-album-cover">{cover ? <img src={cover} alt="" /> : <Disc3 size={42} strokeWidth={1.1} />}</div><div className="music-album-info"><strong>{album.title}</strong><span>{album.artist}</span><small>{albumTracks.length} 首歌曲</small></div></button>
      })}</div> : <EmptyState icon={<Album size={26} />} title="没有匹配的专辑" description="已导入且包含专辑名称的歌曲会自动归类到这里。" />}

    <div className={`player-bar ${current ? 'visible' : ''}`}>
      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => { if (!releasingForEdit.current) setPlaying(false) }} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={onEnded} onError={() => { if (!releasingForEdit.current) { setPlayerError('音频加载失败'); setPlaying(false) } }} />
      <div className="player-track"><div className="tiny-cover large">{currentCover ? <img src={currentCover} alt="" /> : <ListMusic size={17} />}</div><div><strong>{current?.title || '未选择'}</strong><span>{current?.artist || '—'}</span></div></div>
      <div className="player-center"><div className="player-controls"><button className={shuffle ? 'active' : ''} onClick={() => setShuffle(!shuffle)}><Shuffle size={16} /></button><button onClick={() => adjacent(-1)}><SkipBack size={18} fill="currentColor" /></button><button className="play-main" onClick={togglePlay}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button onClick={() => adjacent(1)}><SkipForward size={18} fill="currentColor" /></button><button className={repeat !== 'off' ? 'active' : ''} onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}>{repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}</button></div>
        <div className="progress-control"><span>{formatDuration(position)}</span><Slider min={0} max={Math.max(duration, 1)} step={1} value={[Math.min(position, duration || 0)]} onValueChange={([value]) => { if (audio.current) audio.current.currentTime = value }} aria-label="播放进度" /><span>{formatDuration(duration)}</span></div></div>
      <div className="volume-control">{volume < 0.05 ? <Volume1 size={17} /> : <Volume2 size={17} />}<Slider min={0} max={1} step={0.01} value={[volume]} onValueChange={([value]) => setVolume(value)} aria-label="音量" /></div>
    </div>
    {editTarget && <MusicMetadataSheet track={editTarget} albums={albums} onClose={() => setEditTarget(null)} onSave={saveMetadata} />}
    {albumTarget && <MusicAlbumSheet album={albumTarget} tracks={tracks.filter((track) => track.albumId === albumTarget.id)} onClose={() => setAlbumTarget(null)} onSave={(cover) => saveAlbumCover(albumTarget.id, cover)} onPlay={(track) => { void playTrack(track, albumTarget.id); setAlbumTarget(null) }} />}
    <MusicImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={addImportedTracks} />
    <ConfirmDialog open={Boolean(removeTarget)} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }} title="从资料库移除？" description={removeTarget ? `将移除《${removeTarget.title}》的索引，原始音乐文件不会被删除。` : ''} confirmLabel="移除索引" destructive icon={<Trash2 />} onConfirm={() => { if (removeTarget) remove(removeTarget); setRemoveTarget(null) }} />
  </section>
}
