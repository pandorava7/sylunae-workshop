import type { JSONContent } from '@tiptap/react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ToolId = 'library' | 'music' | 'notes' | 'goals' | 'settings'

export interface AppSettings {
  theme: ThemeMode
  lastTool: ToolId
  sidebarCollapsed: boolean
  bangumiUsername: string
  updatedAt: string
}

export type BangumiSubjectType = 1 | 2 | 3 | 4 | 6
export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5

export interface BangumiCollectionItem {
  subjectId: number
  subjectType: BangumiSubjectType
  collectionType: BangumiCollectionType
  name: string
  nameCn: string
  summary: string
  cover: string
  score: number
  rank: number | null
  rate: number
  comment: string
  tags: string[]
  epStatus: number
  volStatus: number
  totalEpisodes: number
  airDate: string
  platform: string
  updatedAt: string
  url: string
}

export interface BangumiProfileCache {
  username: string
  items: BangumiCollectionItem[]
  syncedAt: string
}

export interface MusicTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: number
  cover: string
  missing: boolean
  createdAt: string
  updatedAt: string
}

export interface NoteFolder {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: JSONContent
  folderId: string | null
  tags: string[]
  pinned: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  title: string
  dueDate: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export type GoalStatus = 'active' | 'completed' | 'archived'

export interface Goal {
  id: string
  title: string
  description: string
  status: GoalStatus
  startDate: string
  dueDate: string
  milestones: Milestone[]
  createdAt: string
  updatedAt: string
}

export interface AppSnapshot {
  version: 1
  settings: AppSettings
  bangumi: BangumiProfileCache | null
  tracks: MusicTrack[]
  folders: NoteFolder[]
  notes: Note[]
  goals: Goal[]
}

export interface BackupSummary {
  notes: number
  goals: number
  tracks: number
  bangumiItems: number
  exportedAt: string
}

export interface BackupEnvelope {
  format: 'siyue-workshop-backup'
  version: 1
  exportedAt: string
  snapshot: AppSnapshot
}

export interface SiyueAPI {
  platform: 'electron'
  storage: {
    load: () => Promise<AppSnapshot>
    save: (snapshot: AppSnapshot) => Promise<void>
    replace: (snapshot: AppSnapshot) => Promise<void>
  }
  music: {
    pick: () => Promise<MusicTrack[]>
    relocate: (trackId: string) => Promise<MusicTrack | null>
    checkPaths: (paths: string[]) => Promise<Record<string, boolean>>
    getAudioUrl: (path: string) => Promise<string>
  }
  backup: {
    exportFile: (contents: string) => Promise<boolean>
    importFile: () => Promise<string | null>
  }
  system: {
    getTheme: () => Promise<'light' | 'dark'>
    openExternal: (url: string) => Promise<void>
  }
}
