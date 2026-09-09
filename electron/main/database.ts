import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { createDefaultSnapshot } from '../../src/shared/defaults'
import type { AppSnapshot } from '../../src/shared/types'
import { normalizeThemePalettes } from '../../src/shared/theme'

let database: Database.Database | null = null

function migrateDatabaseFile(): void {
  const userData = app.getPath('userData')
  const legacyPath = join(userData, 'siyue-workshop.sqlite')
  const currentPath = join(userData, 'sylunae-workshop.sqlite')

  // Never overwrite a database that already exists under the new name.
  if (existsSync(currentPath) || !existsSync(legacyPath)) return

  // SQLite may have active WAL/shared-memory sidecars. Move them together
  // before opening the database under its new name.
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const source = `${legacyPath}${suffix}`
    const target = `${currentPath}${suffix}`
    if (existsSync(source) && !existsSync(target)) renameSync(source, target)
  }
}

function getDatabase(): Database.Database {
  if (database) return database
  migrateDatabaseFile()
  database = new Database(join(app.getPath('userData'), 'sylunae-workshop.sqlite'))
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
    const legacyTool = parsed.settings?.lastTool as string | undefined
    const migratedTool = legacyTool === 'goals' ? 'tasks' : legacyTool === 'library' ? 'collection' : legacyTool
    const lastTool = ['tasks', 'notes', 'music', 'collection', 'tools', 'settings'].includes(migratedTool ?? '') ? migratedTool! : defaults.settings.lastTool
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...parsed.settings, lastTool: lastTool as AppSnapshot['settings']['lastTool'], themePalettes: normalizeThemePalettes(parsed.settings?.themePalettes) },
      todos: parsed.todos ?? [],
      pomodoro: { ...defaults.pomodoro, ...parsed.pomodoro },
      clipboardSnippets: parsed.clipboardSnippets ?? [],
      launcherLinks: parsed.launcherLinks ?? [],
    }
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
