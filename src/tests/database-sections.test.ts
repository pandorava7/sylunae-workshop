import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDefaultSnapshot } from '../shared/defaults'

const testEnvironment = vi.hoisted(() => ({ dataDirectory: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => testEnvironment.dataDirectory },
}))

describe('desktop section storage', () => {
  beforeEach(() => {
    testEnvironment.dataDirectory = mkdtempSync(join(tmpdir(), 'sylunae-storage-'))
    vi.resetModules()
  })

  afterEach(async () => {
    const database = await import('../../electron/main/database')
    database.closeDatabase()
    rmSync(testEnvironment.dataDirectory, { recursive: true, force: true })
  })

  it('migrates a legacy snapshot and updates only the requested section', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.tracks = [{
      id: 'track-1', path: 'song.mp3', title: 'Song', artist: 'Artist', album: 'Album', albumArtist: 'Artist',
      albumId: null, duration: 1, cover: `data:image/png;base64,${'a'.repeat(50_000)}`, missing: false,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]
    const path = join(testEnvironment.dataDirectory, 'sylunae-workshop.sqlite')
    const legacy = new Database(path)
    legacy.exec('CREATE TABLE schema_meta (version INTEGER NOT NULL); INSERT INTO schema_meta(version) VALUES (1); CREATE TABLE app_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);')
    legacy.prepare('INSERT INTO app_state(id, payload, updated_at) VALUES (1, ?, ?)').run(JSON.stringify(snapshot), '2026-01-01T00:00:00.000Z')
    legacy.close()

    const database = await import('../../electron/main/database')
    expect(database.loadSnapshot().tracks).toEqual(snapshot.tracks)

    const notes = [{
      id: 'note-1', title: 'Only this domain changes', content: { type: 'doc' }, folderId: null, tags: [], pinned: false,
      deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]
    database.saveSnapshotPatch({ notes })

    const verification = new Database(path, { readonly: true })
    const rows = verification.prepare('SELECT section, payload FROM app_state_sections').all() as Array<{ section: string; payload: string }>
    expect(rows).toHaveLength(13)
    expect(JSON.parse(rows.find((row) => row.section === 'notes')!.payload)).toEqual(notes)
    expect(JSON.parse(rows.find((row) => row.section === 'tracks')!.payload)).toEqual(snapshot.tracks)
    expect((verification.prepare('SELECT COUNT(*) AS count FROM app_state').get() as { count: number }).count).toBe(0)
    verification.close()
  })
})
