import type { Note } from '../shared/types'

function noteFieldEquals(current: Note[keyof Note], next: Note[keyof Note]) {
  if (Object.is(current, next)) return true
  if (typeof current !== 'object' || current === null || typeof next !== 'object' || next === null) return false
  return JSON.stringify(current) === JSON.stringify(next)
}

export function applyNotePatch(note: Note, patch: Partial<Note>, updatedAt: string) {
  const changed = (Object.keys(patch) as (keyof Note)[])
    .some((key) => !noteFieldEquals(note[key], patch[key] as Note[keyof Note]))

  return changed ? { ...note, ...patch, updatedAt } : note
}
