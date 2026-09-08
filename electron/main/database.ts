import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { createDefaultSnapshot } from '../../src/shared/defaults'
import type { AppSnapshot } from '../../src/shared/types'
import { normalizeThemePalettes } from '../../src/shared/theme'

let database: Database.Database | null = null

function getDatabase(): Database.Database {
  if (database) return database
  database = new Database(join(app.getPath('userData'), 'siyue-workshop.sqlite'))
  database.pragma('journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  const meta = database.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | undefined
  if (!meta) database.prepare('INSERT INTO schema_meta(version) VALUES (?)').run(1)
  return database
}

export function loadSnapshot(): AppSnapshot {
  const db = getDatabase()
  const row = db.prepare('SELECT payload FROM app_state WHERE id = 1').get() as { payload: string } | undefined
  if (!row) {
    const initial = createDefaultSnapshot()
    saveSnapshot(initial)
    return initial
  }
  try {
    const parsed = JSON.parse(row.payload) as AppSnapshot
    const defaults = createDefaultSnapshot()
    return { ...defaults, ...parsed, settings: { ...defaults.settings, ...parsed.settings, themePalettes: normalizeThemePalettes(parsed.settings?.themePalettes) } }
  } catch {
    const fallback = createDefaultSnapshot()
    saveSnapshot(fallback)
    return fallback
  }
}

export function saveSnapshot(snapshot: AppSnapshot): void {
  getDatabase()
    .prepare(`
      INSERT INTO app_state(id, payload, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `)
    .run(JSON.stringify(snapshot), new Date().toISOString())
}

export function closeDatabase(): void {
  database?.close()
  database = null
}
