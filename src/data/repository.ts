import Dexie, { type EntityTable } from 'dexie'
import { createDefaultSnapshot } from '../shared/defaults'
import type { AppSnapshot } from '../shared/types'

interface StateRow { id: number; snapshot: AppSnapshot }

class SiyueDatabase extends Dexie {
  state!: EntityTable<StateRow, 'id'>
  constructor() {
    super('siyue-workshop')
    this.version(1).stores({ state: 'id' })
  }
}

const db = new SiyueDatabase()

function normalize(snapshot: Partial<AppSnapshot> | undefined): AppSnapshot {
  const defaults = createDefaultSnapshot()
  if (!snapshot) return defaults
  return {
    ...defaults,
    ...snapshot,
    version: 1,
    settings: { ...defaults.settings, ...snapshot.settings },
    tracks: snapshot.tracks ?? [],
    folders: snapshot.folders ?? [],
    notes: snapshot.notes ?? [],
    goals: snapshot.goals ?? [],
    bangumi: snapshot.bangumi ?? null,
  }
}

export const repository = {
  isDesktop: Boolean(window.siyue),
  async load(): Promise<AppSnapshot> {
    if (window.siyue) return normalize(await window.siyue.storage.load())
    const row = await db.state.get(1)
    const snapshot = normalize(row?.snapshot)
    if (!row) await db.state.put({ id: 1, snapshot })
    return snapshot
  },
  async save(snapshot: AppSnapshot): Promise<void> {
    if (window.siyue) await window.siyue.storage.save(snapshot)
    else await db.state.put({ id: 1, snapshot })
  },
  async replace(snapshot: AppSnapshot): Promise<void> {
    const safe = normalize(snapshot)
    if (window.siyue) await window.siyue.storage.replace(safe)
    else await db.state.put({ id: 1, snapshot: safe })
  },
}
