import Dexie, { type EntityTable } from 'dexie'
import { createDefaultSnapshot } from '../shared/defaults'
import type { AppSnapshot } from '../shared/types'
import { migrateDefaultThemePalettes } from '../shared/theme'
import { reconcileMusicLibrary } from '../music/albums'
import { normalizeImageLibrary } from '../images/library'

interface StateRow { id: number; snapshot: AppSnapshot }
interface BangumiCoverRow { url: string; blob: Blob; cachedAt: string }

class SylunaeDatabase extends Dexie {
  state!: EntityTable<StateRow, 'id'>
  bangumiCovers!: EntityTable<BangumiCoverRow, 'url'>
  constructor() {
    super('siyue-workshop')
    this.version(1).stores({ state: 'id' })
    this.version(2).stores({ state: 'id', bangumiCovers: 'url, cachedAt' })
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
  const legacyTool = snapshot.settings?.lastTool as string | undefined
  const migratedTool = legacyTool === 'goals' ? 'tasks' : legacyTool === 'library' ? 'collection' : legacyTool
  const lastTool = ['home', 'tasks', 'notes', 'music', 'collection', 'tools', 'settings'].includes(migratedTool ?? '') ? migratedTool! : defaults.settings.lastTool
  return {
    ...defaults,
    ...snapshot,
    version: 1,
    settings: { ...defaults.settings, ...snapshot.settings, lastTool: lastTool as AppSnapshot['settings']['lastTool'], themePalettes: migrateDefaultThemePalettes(snapshot.settings?.themePalettes) },
    tracks: music.tracks,
    albums: music.albums,
    folders: snapshot.folders ?? [],
    notes: snapshot.notes ?? [],
    goals: snapshot.goals ?? [],
    todos: snapshot.todos ?? [],
    pomodoro: { ...defaults.pomodoro, ...snapshot.pomodoro },
    clipboardSnippets: snapshot.clipboardSnippets ?? [],
      launcherLinks: snapshot.launcherLinks ?? [],
      imageLibrary: normalizeImageLibrary(snapshot.imageLibrary),
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

/** Persistent cover cache kept separate from the user's exported application data. */
export const bangumiCoverCache = {
  async get(url: string): Promise<Blob | null> {
    return (await db.bangumiCovers.get(url))?.blob ?? null
  },
  async put(url: string, blob: Blob): Promise<void> {
    await db.bangumiCovers.put({ url, blob, cachedAt: new Date().toISOString() })
  },
  async clear(): Promise<void> {
    await db.bangumiCovers.clear()
  },
}
