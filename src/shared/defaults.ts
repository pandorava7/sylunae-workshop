import type { AppSnapshot } from './types'
import { normalizeThemePalettes } from './theme'

export function createDefaultSnapshot(): AppSnapshot {
  const now = new Date().toISOString()
  return {
    version: 1,
    settings: {
      theme: 'system',
      themePalettes: normalizeThemePalettes(),
      lastTool: 'library',
      sidebarCollapsed: false,
      bangumiUsername: '',
      updatedAt: now,
    },
    bangumi: null,
    tracks: [],
    albums: [],
    folders: [],
    notes: [],
    goals: [],
  }
}
