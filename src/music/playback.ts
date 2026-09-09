import type { MusicTrack } from '../shared/types'

export function playbackQueue(tracks: MusicTrack[], albumId: string | null): MusicTrack[] {
  return tracks.filter((track) => !track.missing && (!albumId || track.albumId === albumId))
}

export function adjacentTrack(
  queue: MusicTrack[],
  currentId: string | null,
  direction: 1 | -1,
  shuffle: boolean,
  random = Math.random,
): MusicTrack | null {
  if (!queue.length) return null
  if (shuffle && queue.length > 1) {
    const candidates = queue.filter((track) => track.id !== currentId)
    return candidates[Math.floor(random() * candidates.length)] || queue[0]
  }

  const index = queue.findIndex((track) => track.id === currentId)
  if (index < 0) return direction === 1 ? queue[0] : queue.at(-1) || null
  return queue[(index + direction + queue.length) % queue.length]
}
