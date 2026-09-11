import type { AppSnapshot } from './types'
import { normalizeThemePalettes } from './theme'
import { DESK_COMPANION_PRESETS, createDeskCompanionPreset } from './deskCompanionPresets'

export function createDefaultSnapshot(): AppSnapshot {
  const now = new Date().toISOString()
  return {
    version: 1,
    settings: {
      theme: 'system',
      themePalettes: normalizeThemePalettes(),
      privateMode: false,
      lastTool: 'home',
      sidebarCollapsed: false,
      sidebarWidth: 300,
      pomodoroAlarmPath: '',
      displayName: 'Pandora',
      bangumiUsername: '',
      homeWallpaper: '',
      homeWallpapers: [],
      homeQuickActions: ['new-note', 'new-todo', 'pomodoro', 'music', 'collection'],
      weatherLocation: {
        name: '吉隆坡',
        country: '马来西亚',
        admin1: '',
        latitude: 3.139,
        longitude: 101.6869,
        timezone: 'Asia/Kuala_Lumpur',
      },
      weatherCache: null,
      deskCompanion: {
        enabled: false,
        scale: 1,
        dialogueMode: 'sequential',
        activeCharacterId: 'default-companion',
        characters: DESK_COMPANION_PRESETS.map((preset) => createDeskCompanionPreset(preset.id)!),
      },
      recentTools: [],
      toolUsage: {},
      updatedAt: now,
    },
    bangumi: null,
    imageLibrary: { roots: [], collections: [], assets: [] },
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
