import { describe, expect, it } from 'vitest'
import { albumCover, reconcileMusicLibrary, trackCover } from '../music/albums'
import type { MusicTrack } from '../shared/types'

function makeTrack(id: string, overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id,
    path: `C:\\Music\\${id}.mp3`,
    title: id,
    artist: '歌手',
    album: '同一张专辑',
    albumArtist: '',
    albumId: null,
    duration: 180,
    cover: '',
    missing: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('music albums', () => {
  it('groups tracks with the same album and leaves unknown albums ungrouped', () => {
    const result = reconcileMusicLibrary([
      makeTrack('one', { artist: '甲' }),
      makeTrack('two', { artist: '乙' }),
      makeTrack('unknown', { album: '未知专辑' }),
    ], [])

    expect(result.albums).toHaveLength(1)
    expect(result.albums[0].artist).toBe('群星')
    expect(result.tracks[0].albumId).toBe(result.albums[0].id)
    expect(result.tracks[1].albumId).toBe(result.albums[0].id)
    expect(result.tracks[2].albumId).toBeNull()
  })

  it('uses track art before album art and lets sibling art represent an album', () => {
    const own = makeTrack('own', { cover: 'data:image/jpeg;base64,own' })
    const sibling = makeTrack('sibling')
    const library = reconcileMusicLibrary([own, sibling], [])
    const album = library.albums[0]

    expect(albumCover(album, library.tracks)).toBe(own.cover)
    expect(trackCover(library.tracks[1], library.albums, library.tracks)).toBe(own.cover)

    album.cover = 'data:image/png;base64,album'
    expect(trackCover(library.tracks[0], library.albums, library.tracks)).toBe(own.cover)
    expect(trackCover(library.tracks[1], library.albums, library.tracks)).toBe(album.cover)
  })
})
