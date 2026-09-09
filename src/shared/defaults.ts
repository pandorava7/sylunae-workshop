import type { AppSnapshot } from './types'
import { normalizeThemePalettes } from './theme'

export function createDefaultSnapshot(): AppSnapshot {
  const now = new Date().toISOString()
  return {
    version: 1,
    settings: {
      theme: 'system',
      themePalettes: normalizeThemePalettes(),
      lastTool: 'home',
      sidebarCollapsed: false,
      bangumiUsername: '',
      homeWallpaper: '',
      weatherLocation: {
        name: '吉隆坡',
        country: '马来西亚',
        admin1: '',
        latitude: 3.139,
        longitude: 101.6869,
        timezone: 'Asia/Kuala_Lumpur',
      },
      weatherCache: null,
      recentTools: [],
      toolUsage: {},
      updatedAt: now,
    },
    bangumi: null,
    tracks: [],
    albums: [],
    folders: [],
    notes: [],
    goals: [],
    todos: [],
    pomodoro: {
      mode: 'focus',
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      completedSessions: 0,
      secondsRemaining: 25 * 60,
      running: false,
      endsAt: null,
    },
    clipboardSnippets: [],
    launcherLinks: [],
  }
}
