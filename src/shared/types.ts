import type { JSONContent } from '@tiptap/react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type WorkspaceToolId = 'tasks' | 'notes' | 'music' | 'collection' | 'tools'
export type ToolId = 'home' | WorkspaceToolId | 'settings'
export type HomeQuickActionId = 'new-note' | 'new-todo' | 'pomodoro' | 'music' | 'collection'

export interface ThemePalette {
  bg: string
  surface: string
  surface2: string
  surface3: string
  sidebarBg: string
  text: string
  mutedText: string
  faint: string
  line: string
  brand: string
  accentSoft: string
  accentDeep: string
  danger: string
  dangerSoft: string
  success: string
  successSoft: string
}

export interface ThemePalettes {
  light: ThemePalette
  dark: ThemePalette
}

export interface HomeWallpaper {
  id: string
  image: string
  title: string
  description: string
}

export interface AppSettings {
  theme: ThemeMode
  themePalettes: ThemePalettes
  lastTool: ToolId
  sidebarCollapsed: boolean
  sidebarWidth: number
  pomodoroAlarmPath: string
  displayName: string
  bangumiUsername: string
  homeWallpaper: string
  homeWallpapers: HomeWallpaper[]
  homeQuickActions: HomeQuickActionId[]
  weatherLocation: WeatherLocation
  weatherCache: WeatherSnapshot | null
  recentTools: WorkspaceToolId[]
  toolUsage: Partial<Record<WorkspaceToolId, string>>
  updatedAt: string
}

export interface WeatherLocation {
  name: string
  country: string
  admin1: string
  latitude: number
  longitude: number
  timezone: string
}

export interface WeatherSnapshot {
  location: WeatherLocation
  temperature: number
  apparent: number
  code: number
  daily: Array<{ minimum: number; maximum: number; code: number }>
  fetchedAt: string
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

export type ImageAspectType = 'landscape' | 'portrait' | 'square'

export interface ImageLibraryRoot {
  id: string
  path: string
  name: string
  recursive: boolean
  identity: string
  missing: boolean
  createdAt: string
  updatedAt: string
  lastScannedAt: string | null
  collectionId: string | null
}

export interface ImageCollection {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ImageAsset {
  id: string
  rootId: string | null
  collectionIds: string[]
  path: string
  relativePath: string
  name: string
  extension: string
  size: number
  mtimeMs: number
  width: number
  height: number
  aspectType: ImageAspectType
  identity: string
  hash: string
  missing: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ImageLibraryState {
  roots: ImageLibraryRoot[]
  collections: ImageCollection[]
  assets: ImageAsset[]
}

export type ImageScanStage = 'discovering' | 'indexing' | 'complete' | 'cancelled'

export interface ImageScanProgress {
  taskId: string
  stage: ImageScanStage
  message: string
  completed: number
  total: number | null
}

export interface MusicTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  albumArtist: string
  albumId: string | null
  duration: number
  cover: string
  missing: boolean
  createdAt: string
  updatedAt: string
}

export interface MusicAlbum {
  id: string
  title: string
  artist: string
  cover: string
  createdAt: string
  updatedAt: string
}

export interface MusicEditableMetadata {
  title: string
  artist: string
  album: string
  genre: string
  year: number | null
  track: number | null
  comment: string
  cover: string
}

export type MusicCoverUpdate =
  | { mode: 'keep' }
  | { mode: 'remove' }
  | { mode: 'replace'; data: Uint8Array; mimeType: 'image/jpeg' | 'image/png' }

export interface MusicMetadataUpdate {
  id: string
  path: string
  metadata: Omit<MusicEditableMetadata, 'cover'>
  cover: MusicCoverUpdate
}

export type MusicRemoteSource = 'youtube' | 'audio-url'

export type MusicImportStage = 'reading' | 'downloading' | 'converting' | 'metadata' | 'complete'

export interface MusicImportProgress {
  taskId: string
  source: MusicRemoteSource
  stage: MusicImportStage
  message: string
  percent: number | null
  receivedBytes?: number
  totalBytes?: number | null
}

export interface MusicRemoteImport {
  taskId: string
  source: MusicRemoteSource
  url: string
  directory: string
}

export interface MediaToolComponentStatus {
  id: 'ffmpeg' | 'yt-dlp'
  label: string
  version: string
  installed: boolean
  installedBytes: number
}

export interface MediaToolsStatus {
  ready: boolean
  installing: boolean
  components: MediaToolComponentStatus[]
  installedBytes: number
}

export interface MediaToolsProgress {
  stage: 'downloading' | 'verifying' | 'complete'
  tool: 'ffmpeg' | 'yt-dlp' | null
  message: string
  receivedBytes: number
  totalBytes: number | null
  percent: number | null
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

export type TodoPriority = 'low' | 'medium' | 'high'

export interface QuickTodo {
  id: string
  title: string
  priority: TodoPriority
  dueDate: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak'

export interface PomodoroState {
  mode: PomodoroMode
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
  completedSessions: number
  secondsRemaining: number
  running: boolean
  endsAt: string | null
}

export interface ClipboardSnippet {
  id: string
  title: string
  content: string
  category: string
  copyCount: number
  createdAt: string
  updatedAt: string
}

export interface LauncherLink {
  id: string
  title: string
  url: string
  description: string
  faviconUrl?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSnapshot {
  version: 1
  settings: AppSettings
  bangumi: BangumiProfileCache | null
  imageLibrary: ImageLibraryState
  tracks: MusicTrack[]
  albums: MusicAlbum[]
  folders: NoteFolder[]
  notes: Note[]
  goals: Goal[]
  todos: QuickTodo[]
  pomodoro: PomodoroState
  clipboardSnippets: ClipboardSnippet[]
  launcherLinks: LauncherLink[]
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

export type PartialBackupSection = 'home' | 'tasks' | 'notes' | 'music' | 'collection' | 'tools' | 'settings'

export interface PartialBackupEnvelope {
  format: 'siyue-workshop-partial-backup'
  version: 1
  section: PartialBackupSection
  exportedAt: string
  payload: unknown
}

export interface SylunaeAPI {
  platform: 'electron'
  storage: {
    load: () => Promise<AppSnapshot>
    save: (snapshot: AppSnapshot) => Promise<void>
    replace: (snapshot: AppSnapshot) => Promise<void>
  }
  music: {
    pick: () => Promise<MusicTrack[]>
    getDownloadDirectory: () => Promise<string>
    pickDownloadDirectory: (currentDirectory: string) => Promise<string | null>
    importRemote: (input: MusicRemoteImport) => Promise<MusicTrack>
    onImportProgress: (listener: (progress: MusicImportProgress) => void) => () => void
    getMediaToolsStatus: () => Promise<MediaToolsStatus>
    installMediaTools: () => Promise<MediaToolsStatus>
    onMediaToolsProgress: (listener: (progress: MediaToolsProgress) => void) => () => void
    relocate: (trackId: string) => Promise<MusicTrack | null>
    checkPaths: (paths: string[]) => Promise<Record<string, boolean>>
    getAudioUrl: (path: string) => Promise<string>
    readMetadata: (path: string) => Promise<MusicEditableMetadata>
    updateMetadata: (update: MusicMetadataUpdate) => Promise<MusicTrack>
  }
  images: {
    pick: () => Promise<ImageAsset[]>
    pickRoot: (recursive: boolean) => Promise<ImageLibraryRoot | null>
    scan: (taskId: string, library: ImageLibraryState, rootId?: string) => Promise<ImageLibraryState>
    cancelScan: (taskId: string) => Promise<void>
    onScanProgress: (listener: (progress: ImageScanProgress) => void) => () => void
    relocateRoot: (taskId: string, rootId: string, library: ImageLibraryState) => Promise<ImageLibraryState | null>
    relocateAsset: (assetId: string, library: ImageLibraryState) => Promise<ImageLibraryState | null>
    checkPaths: (paths: string[]) => Promise<Record<string, boolean>>
    getUrls: (paths: string[]) => Promise<Record<string, string>>
  }
  backup: {
    exportFile: (contents: string, defaultName?: string) => Promise<boolean>
    importFile: () => Promise<string | null>
  }
  system: {
    getTheme: () => Promise<'light' | 'dark'>
    openExternal: (url: string) => Promise<void>
    findFavicon: (url: string) => Promise<string | null>
    notifyPomodoroComplete: (focusCompleted: boolean) => Promise<void>
    pickPomodoroAlarm: () => Promise<string | null>
    getPomodoroAlarmUrl: (path: string) => Promise<string | null>
  }
}
