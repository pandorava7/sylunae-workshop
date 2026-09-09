import { z } from 'zod'
import type { AppSnapshot, BackupEnvelope } from '../shared/types'
import { normalizeThemePalettes } from '../shared/theme'

const timestamp = z.string().min(1)
const jsonContentSchema: z.ZodType<Record<string, unknown>> = z.lazy(() => z.object({ type: z.string().optional(), text: z.string().optional(), attrs: z.record(z.string(), z.unknown()).optional(), marks: z.array(z.unknown()).optional(), content: z.array(jsonContentSchema).optional() }).passthrough())
const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  themePalettes: z.object({
    light: z.record(z.string(), z.string()),
    dark: z.record(z.string(), z.string()),
  }).optional(),
  lastTool: z.enum(['library', 'music', 'notes', 'goals', 'settings']),
  sidebarCollapsed: z.boolean(),
  bangumiUsername: z.string(),
  updatedAt: timestamp,
})
const bangumiItemSchema = z.object({
  subjectId: z.number().int(), subjectType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]), collectionType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  name: z.string(), nameCn: z.string(), summary: z.string(), cover: z.string(), score: z.number(), rank: z.number().nullable(), rate: z.number(), comment: z.string(), tags: z.array(z.string()),
  epStatus: z.number(), volStatus: z.number(), totalEpisodes: z.number(), airDate: z.string(), platform: z.string(), updatedAt: timestamp, url: z.string(),
})
const trackSchema = z.object({ id: z.string(), path: z.string(), title: z.string(), artist: z.string(), album: z.string(), duration: z.number().nonnegative(), cover: z.string(), missing: z.boolean(), createdAt: timestamp, updatedAt: timestamp })
const folderSchema = z.object({ id: z.string(), name: z.string(), createdAt: timestamp, updatedAt: timestamp })
const noteSchema = z.object({ id: z.string(), title: z.string(), content: jsonContentSchema, folderId: z.string().nullable(), tags: z.array(z.string()), pinned: z.boolean(), deletedAt: timestamp.nullable(), createdAt: timestamp, updatedAt: timestamp })
const milestoneSchema = z.object({ id: z.string(), title: z.string(), dueDate: z.string(), completed: z.boolean(), createdAt: timestamp, updatedAt: timestamp })
const goalSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), status: z.enum(['active', 'completed', 'archived']), startDate: z.string(), dueDate: z.string(), milestones: z.array(milestoneSchema), createdAt: timestamp, updatedAt: timestamp })

const envelopeSchema = z.object({
  format: z.literal('siyue-workshop-backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  snapshot: z.object({
    version: z.literal(1),
    settings: settingsSchema,
    bangumi: z.object({ username: z.string(), items: z.array(bangumiItemSchema), syncedAt: timestamp }).nullable(),
    tracks: z.array(trackSchema),
    folders: z.array(folderSchema),
    notes: z.array(noteSchema),
    goals: z.array(goalSchema),
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
    },
  } as BackupEnvelope
}

export function backupSummary(backup: BackupEnvelope): string {
  const { snapshot } = backup
  return `笔记 ${snapshot.notes.length} 条、目标 ${snapshot.goals.length} 个、音乐索引 ${snapshot.tracks.length} 首`
}
