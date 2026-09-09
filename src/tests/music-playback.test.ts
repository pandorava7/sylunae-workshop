import { describe, expect, it } from 'vitest'
import { adjacentTrack, playbackQueue } from '../music/playback'
import type { MusicTrack } from '../shared/types'

const makeTrack = (id: string, albumId: string | null, missing = false): MusicTrack => ({
  id,
  path: `${id}.mp3`,
  title: id,
  artist: 'artist',
  album: albumId || '未知专辑',
  albumArtist: '',
  albumId,
  duration: 120,
  cover: '',
  missing,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('music playback queue', () => {
  const tracks = [makeTrack('a1', 'album-a'), makeTrack('b1', 'album-b'), makeTrack('a2', 'album-a'), makeTrack('a3', 'album-a', true)]

  it('uses the whole playable library without an album source', () => {
    expect(playbackQueue(tracks, null).map((track) => track.id)).toEqual(['a1', 'b1', 'a2'])
  })

  it('keeps album playback inside that album and skips missing files', () => {
    expect(playbackQueue(tracks, 'album-a').map((track) => track.id)).toEqual(['a1', 'a2'])
  })

  it('wraps previous and next navigation within the active queue', () => {
    const queue = playbackQueue(tracks, 'album-a')
    expect(adjacentTrack(queue, 'a2', 1, false)?.id).toBe('a1')
    expect(adjacentTrack(queue, 'a1', -1, false)?.id).toBe('a2')
  })

  it('shuffles only among other tracks in the active queue', () => {
    const queue = playbackQueue(tracks, 'album-a')
    expect(adjacentTrack(queue, 'a1', 1, true, () => 0)?.id).toBe('a2')
  })
})
