import { useRef, useState } from 'react'
import { Disc3, ImagePlus, Music2, Play, Trash2 } from 'lucide-react'
import type { MusicAlbum, MusicTrack } from '../shared/types'
import { albumCover } from '../music/albums'
import { formatDuration } from '../utils'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './ui/sheet'

export function MusicAlbumSheet({ album, tracks, onClose, onSave, onPlay }: {
  album: MusicAlbum
  tracks: MusicTrack[]
  onClose: () => void
  onSave: (cover: string) => void
  onPlay: (track: MusicTrack) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [cover, setCover] = useState(album.cover)
  const [error, setError] = useState('')
  const inferredCover = albumCover({ ...album, cover: '' }, tracks)
  const displayCover = cover || inferredCover
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)

  const selectCover = (file: File) => {
    setError('')
    if (file.size > 12 * 1024 * 1024) { setError('封面文件需小于 12 MB。'); return }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') { setError('封面仅支持 JPEG 或 PNG。'); return }
    const reader = new FileReader()
    reader.onload = () => setCover(String(reader.result))
    reader.onerror = () => setError('无法读取这张图片。')
    reader.readAsDataURL(file)
  }

  return <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
    <SheetContent className="detail-drawer music-album-drawer" showCloseButton>
      <SheetHeader className="metadata-sheet-header">
        <SheetTitle>{album.title}</SheetTitle>
        <SheetDescription>{album.artist} · {tracks.length} 首歌曲 · {formatDuration(totalDuration)}</SheetDescription>
      </SheetHeader>
      <div className="album-sheet-body">
        <div className="album-cover-editor">
          <div className="album-cover-preview">{displayCover ? <img src={displayCover} alt={`${album.title}封面`} /> : <Disc3 size={52} strokeWidth={1.1} />}</div>
          <div className="album-cover-copy"><strong>专辑封面</strong><p>没有独立封面的歌曲会自动使用这里的封面，不会修改原音频文件。</p><div><Button className="button primary" disabled={!tracks.some((track) => !track.missing)} onClick={() => { const first = tracks.find((track) => !track.missing); if (first) onPlay(first) }}><Play size={16} fill="currentColor" />播放专辑</Button><Button variant="outline" className="button secondary" onClick={() => input.current?.click()}><ImagePlus size={16} />选择图片</Button><Button variant="ghost" className="button metadata-remove-cover" disabled={!cover} onClick={() => setCover('')}><Trash2 size={16} />移除自定义封面</Button></div></div>
          <input ref={input} hidden type="file" accept="image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectCover(file); event.currentTarget.value = '' }} />
        </div>
        {error && <div className="notice error">{error}</div>}
        <div className="album-track-list"><h3>收录歌曲</h3>{tracks.map((track, index) => <button type="button" className="album-track-item" key={track.id} disabled={track.missing} onClick={() => onPlay(track)} aria-label={track.missing ? `${track.title}，文件已移动或删除` : `从 ${track.title} 开始播放专辑`}><span className="album-track-number"><span>{index + 1}</span><Play size={13} fill="currentColor" /></span><div>{track.cover ? <img src={track.cover} alt="" /> : displayCover ? <img src={displayCover} alt="" /> : <Music2 size={15} />}</div><strong>{track.title}</strong><small>{track.missing ? '缺失' : formatDuration(track.duration)}</small></button>)}</div>
      </div>
      <SheetFooter className="metadata-sheet-footer"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button className="button primary" onClick={() => { onSave(cover); onClose() }}>保存专辑封面</Button></SheetFooter>
    </SheetContent>
  </Sheet>
}
