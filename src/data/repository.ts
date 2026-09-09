import Dexie, { type EntityTable } from 'dexie'
import { createDefaultSnapshot } from '../shared/defaults'
import type { AppSnapshot } from '../shared/types'
import { migrateDefaultThemePalettes } from '../shared/theme'
import { reconcileMusicLibrary } from '../music/albums'

interface StateRow { id: number; snapshot: AppSnapshot }

class SylunaeDatabase extends Dexie {
  state!: EntityTable<StateRow, 'id'>
  constructor() {
    super('siyue-workshop')
    this.version(1).stores({ state: 'id' })
  }
}

class LegacySiyueDatabase extends Dexie {
  state!: EntityTable<StateRow, 'id'>
  constructor() {
    super('siyue-workshop')
    this.version(1).stores({ state: 'id' })
  }
}

const db = new SylunaeDatabase()
const legacyDb = new LegacySiyueDatabase()

let browserMigration: Promise<void> | null = null

async function migrateLegacyBrowserDatabase(): Promise<void> {
  if (await Dexie.exists('siyue-workshop') === false) return

  const currentRows = await db.state.toArray()
  if (currentRows.length > 0) return

  const legacyRows = await legacyDb.state.toArray()
  if (legacyRows.length > 0) await db.state.bulkPut(legacyRows)
}

function ensureBrowserMigration(): Promise<void> {
  browserMigration ??= migrateLegacyBrowserDatabase()
  return browserMigration
}

function normalize(snapshot: Partial<AppSnapshot> | undefined): AppSnapshot {
  const defaults = createDefaultSnapshot()
  if (!snapshot) return defaults
  const music = reconcileMusicLibrary(snapshot.tracks ?? [], snapshot.albums ?? [])
  return {
    ...defaults,
    ...snapshot,
    version: 1,
    settings: { ...defaults.settings, ...snapshot.settings, themePalettes: migrateDefaultThemePalettes(snapshot.settings?.themePalettes) },
    tracks: music.tracks,
    albums: music.albums,
    folders: snapshot.folders ?? [],
    notes: snapshot.notes ?? [],
    goals: snapshot.goals ?? [],
    bangumi: null,
  }
}

export const repository = {
  isDesktop: Boolean(window.sylunae),
  async load(): Promise<AppSnapshot> {
    if (window.sylunae) return normalize(await window.sylunae.storage.load())
    await ensureBrowserMigration()
    const row = await db.state.get(1)
    const snapshot = normalize(row?.snapshot)
    if (!row) await db.state.put({ id: 1, snapshot })
    return snapshot
  },
  async save(snapshot: AppSnapshot): Promise<void> {
    if (window.sylunae) await window.sylunae.storage.save(snapshot)
    else {
      await ensureBrowserMigration()
      await db.state.put({ id: 1, snapshot })
    }
  },
  async replace(snapshot: AppSnapshot): Promise<void> {
    const safe = normalize(snapshot)
    if (window.sylunae) await window.sylunae.storage.replace(safe)
    else {
      await ensureBrowserMigration()
      await db.state.put({ id: 1, snapshot: safe })
    }
  },
}
