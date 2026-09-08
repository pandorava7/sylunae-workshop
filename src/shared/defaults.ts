import type { AppSnapshot } from './types'

export function createDefaultSnapshot(): AppSnapshot {
  const now = new Date().toISOString()
  return {
    version: 1,
    settings: {
      theme: 'system',
      lastTool: 'library',
      sidebarCollapsed: false,
      bangumiUsername: '',
      updatedAt: now,
    },
    bangumi: null,
    tracks: [],
    folders: [],
    notes: [],
    goals: [],
  }
}
