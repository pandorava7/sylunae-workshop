import { z } from 'zod'
import type { AppSnapshot, BackupEnvelope } from '../shared/types'
import { normalizeThemePalettes } from '../shared/theme'
import { normalizeImageLibrary } from '../images/library'

const timestamp = z.string().min(1)
const jsonContentSchema: z.ZodType<Record<string, unknown>> = z.lazy(() => z.object({ type: z.string().optional(), text: z.string().optional(), attrs: z.record(z.string(), z.unknown()).optional(), marks: z.array(z.unknown()).optional(), content: z.array(jsonContentSchema).optional() }).passthrough())
const weatherLocationSchema = z.object({ name: z.string(), country: z.string(), admin1: z.string(), latitude: z.number(), longitude: z.number(), timezone: z.string() })
const defaultWeatherLocation = { name: '吉隆坡', country: '马来西亚', admin1: '', latitude: 3.139, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur' }
const weatherSnapshotSchema = z.object({ location: weatherLocationSchema, temperature: z.number(), apparent: z.number(), code: z.number(), daily: z.array(z.object({ minimum: z.number(), maximum: z.number(), code: z.number() })), fetchedAt: timestamp })
const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  themePalettes: z.object({
    light: z.record(z.string(), z.string()),
    dark: z.record(z.string(), z.string()),
  }).optional(),
  lastTool: z.enum(['library', 'goals', 'home', 'tasks', 'notes', 'music', 'collection', 'tools', 'settings']),
  sidebarCollapsed: z.boolean(),
  bangumiUsername: z.string(),
  homeWallpaper: z.string().optional().default(''),
  weatherLocation: weatherLocationSchema.optional().default(defaultWeatherLocation),
  weatherCache: weatherSnapshotSchema.nullable().optional().default(null),
  recentTools: z.array(z.enum(['tasks', 'notes', 'music', 'collection', 'tools'])).optional().default([]),
  toolUsage: z.partialRecord(z.enum(['tasks', 'notes', 'music', 'collection', 'tools']), z.string()).optional().default({}),
  updatedAt: timestamp,
})
const bangumiItemSchema = z.object({
  subjectId: z.number().int(), subjectType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]), collectionType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  name: z.string(), nameCn: z.string(), summary: z.string(), cover: z.string(), score: z.number(), rank: z.number().nullable(), rate: z.number(), comment: z.string(), tags: z.array(z.string()),
  epStatus: z.number(), volStatus: z.number(), totalEpisodes: z.number(), airDate: z.string(), platform: z.string(), updatedAt: timestamp, url: z.string(),
})
const trackSchema = z.object({ id: z.string(), path: z.string(), title: z.string(), artist: z.string(), album: z.string(), albumArtist: z.string().optional().default(''), albumId: z.string().nullable().optional().default(null), duration: z.number().nonnegative(), cover: z.string(), missing: z.boolean(), createdAt: timestamp, updatedAt: timestamp })
const albumSchema = z.object({ id: z.string(), title: z.string(), artist: z.string(), cover: z.string(), createdAt: timestamp, updatedAt: timestamp })
const folderSchema = z.object({ id: z.string(), name: z.string(), createdAt: timestamp, updatedAt: timestamp })
const noteSchema = z.object({ id: z.string(), title: z.string(), content: jsonContentSchema, folderId: z.string().nullable(), tags: z.array(z.string()), pinned: z.boolean(), deletedAt: timestamp.nullable(), createdAt: timestamp, updatedAt: timestamp })
const milestoneSchema = z.object({ id: z.string(), title: z.string(), dueDate: z.string(), completed: z.boolean(), createdAt: timestamp, updatedAt: timestamp })
const goalSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), status: z.enum(['active', 'completed', 'archived']), startDate: z.string(), dueDate: z.string(), milestones: z.array(milestoneSchema), createdAt: timestamp, updatedAt: timestamp })
const todoSchema = z.object({ id: z.string(), title: z.string(), priority: z.enum(['low', 'medium', 'high']), dueDate: z.string(), completed: z.boolean(), createdAt: timestamp, updatedAt: timestamp })
const pomodoroSchema = z.object({ mode: z.enum(['focus', 'shortBreak', 'longBreak']), focusMinutes: z.number(), shortBreakMinutes: z.number(), longBreakMinutes: z.number(), sessionsBeforeLongBreak: z.number(), completedSessions: z.number(), secondsRemaining: z.number(), running: z.boolean(), endsAt: z.string().nullable() })
const clipboardSchema = z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string(), createdAt: timestamp, updatedAt: timestamp })
const launcherSchema = z.object({ id: z.string(), title: z.string(), url: z.string(), description: z.string(), createdAt: timestamp, updatedAt: timestamp })
const imageRootSchema = z.object({ id: z.string(), path: z.string(), name: z.string(), recursive: z.boolean(), identity: z.string(), missing: z.boolean(), createdAt: timestamp, updatedAt: timestamp, lastScannedAt: timestamp.nullable(), collectionId: z.string().nullable().optional() })
const imageCollectionSchema = z.object({ id: z.string(), name: z.string(), createdAt: timestamp, updatedAt: timestamp })
const imageAssetSchema = z.object({ id: z.string(), rootId: z.string().nullable().optional(), collectionIds: z.array(z.string()).optional(), path: z.string(), relativePath: z.string(), name: z.string(), extension: z.string(), size: z.number().nonnegative(), mtimeMs: z.number().nonnegative(), width: z.number().nonnegative(), height: z.number().nonnegative(), aspectType: z.enum(['landscape', 'portrait', 'square']), identity: z.string(), hash: z.string(), missing: z.boolean(), metadata: z.record(z.string(), z.unknown()).optional().default({}), createdAt: timestamp, updatedAt: timestamp })

const envelopeSchema = z.object({
  format: z.literal('siyue-workshop-backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  snapshot: z.object({
    version: z.literal(1),
    settings: settingsSchema,
    bangumi: z.object({ username: z.string(), items: z.array(bangumiItemSchema), syncedAt: timestamp }).nullable(),
    tracks: z.array(trackSchema),
    albums: z.array(albumSchema).optional().default([]),
    folders: z.array(folderSchema),
    notes: z.array(noteSchema),
    goals: z.array(goalSchema),
    todos: z.array(todoSchema).optional().default([]),
    pomodoro: pomodoroSchema.optional().default({ mode: 'focus', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, completedSessions: 0, secondsRemaining: 1500, running: false, endsAt: null }),
    clipboardSnippets: z.array(clipboardSchema).optional().default([]),
    launcherLinks: z.array(launcherSchema).optional().default([]),
    imageLibrary: z.object({ roots: z.array(imageRootSchema), collections: z.array(imageCollectionSchema).optional().default([]), assets: z.array(imageAssetSchema) }).optional().default({ roots: [], collections: [], assets: [] }),
  }),
})

export function createBackup(snapshot: AppSnapshot): BackupEnvelope {
  return { format: 'siyue-workshop-backup', version: 1, exportedAt: new Date().toISOString(), snapshot }
}

export function parseBackup(contents: string): BackupEnvelope {
  const backup = envelopeSchema.parse(JSON.parse(contents))
  return {
    ...backup,
    snapshot: {
      ...backup.snapshot,
      settings: { ...backup.snapshot.settings, themePalettes: normalizeThemePalettes(backup.snapshot.settings.themePalettes) },
      imageLibrary: normalizeImageLibrary(backup.snapshot.imageLibrary),
    },
  } as BackupEnvelope
}

export function backupSummary(backup: BackupEnvelope): string {
  const { snapshot } = backup
  return `笔记 ${snapshot.notes.length} 条、目标 ${snapshot.goals.length} 个、音乐索引 ${snapshot.tracks.length} 首、图片索引 ${snapshot.imageLibrary.assets.length} 张`
}
