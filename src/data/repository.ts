import Dexie, { type EntityTable } from 'dexie'
import { createDefaultSnapshot } from '../shared/defaults'
import type { AppSnapshot, AppSnapshotPatch, DeskCompanionCharacter, DeskCompanionSettings, HomeQuickActionId } from '../shared/types'
import { migrateDefaultThemePalettes } from '../shared/theme'
import { reconcileMusicLibrary } from '../music/albums'
import { normalizeImageLibrary } from '../images/library'
import { normalizeGoal } from '../goals/tracking'
import { normalizeCountdowns } from '../countdowns/normalize'
import { joinSnapshotSections, snapshotPatchEntries, splitSnapshot, type SnapshotSectionKey } from './snapshotSections'

interface StateRow { id: number; snapshot: AppSnapshot }
interface BangumiCoverRow { url: string; blob: Blob; cachedAt: string }
interface SectionRow { key: SnapshotSectionKey; value: unknown }

class SylunaeDatabase extends Dexie {
  state!: EntityTable<StateRow, 'id'>
  bangumiCovers!: EntityTable<BangumiCoverRow, 'url'>
  sections!: EntityTable<SectionRow, 'key'>
  constructor() {
    super('siyue-workshop')
    this.version(1).stores({ state: 'id' })
    this.version(2).stores({ state: 'id', bangumiCovers: 'url, cachedAt' })
    this.version(3).stores({ state: 'id', bangumiCovers: 'url, cachedAt', sections: 'key' })
  }
}

const db = new SylunaeDatabase()

function normalizeBundledCompanionAsset(source: string): string {
  return source.startsWith('/resources/fun/desk-companion/') ? source.slice(1) : source
}

type LegacyCompanionSettings = Partial<DeskCompanionSettings> & {
  sound?: boolean
  dialogues?: string[]
  characterImage?: string
  characterImageName?: string
  pressSound?: string
  pressSoundName?: string
  releaseSound?: string
  releaseSoundName?: string
}

function normalizeCompanionCharacter(value: Partial<DeskCompanionCharacter>, fallback: DeskCompanionCharacter, index: number): DeskCompanionCharacter {
  const dialogues = Array.isArray(value.dialogues)
    ? value.dialogues.filter((line): line is string => typeof line === 'string' && Boolean(line.trim())).slice(0, 30)
    : fallback.dialogues
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `companion-${index + 1}`,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : `小伙伴 ${index + 1}`,
    image: typeof value.image === 'string' && value.image ? normalizeBundledCompanionAsset(value.image) : fallback.image,
    dialogues,
    pressSound: typeof value.pressSound === 'string' ? normalizeBundledCompanionAsset(value.pressSound) : fallback.pressSound,
    pressSoundName: typeof value.pressSoundName === 'string' ? value.pressSoundName : fallback.pressSoundName,
    releaseSound: typeof value.releaseSound === 'string' ? normalizeBundledCompanionAsset(value.releaseSound) : fallback.releaseSound,
    releaseSoundName: typeof value.releaseSoundName === 'string' ? value.releaseSoundName : fallback.releaseSoundName,
  }
}

async function ensureSectionStorage(): Promise<void> {
  if (await db.sections.count() > 0) return
  const legacy = await db.state.get(1)
  const snapshot = normalize(legacy?.snapshot)
  await db.transaction('rw', db.sections, db.state, async () => {
    await db.sections.bulkPut(splitSnapshot(snapshot))
    await db.state.clear()
  })
}

function normalize(snapshot: Partial<AppSnapshot> | undefined): AppSnapshot {
  const defaults = createDefaultSnapshot()
  const imageLibrary = normalizeImageLibrary(snapshot?.imageLibrary)
  if (!snapshot) return defaults
  const music = reconcileMusicLibrary(snapshot.tracks ?? [], snapshot.albums ?? [])
  const legacyTool = snapshot.settings?.lastTool as string | undefined
  const migratedTool = legacyTool === 'goals' ? 'tasks' : legacyTool === 'library' ? 'collection' : legacyTool
  const lastTool = ['home', 'tasks', 'notes', 'music', 'collection', 'tools', 'settings'].includes(migratedTool ?? '') ? migratedTool! : defaults.settings.lastTool
  const homeWallpapers = snapshot.settings?.homeWallpapers?.length
    ? snapshot.settings.homeWallpapers.slice(0, 5)
    : snapshot.settings?.homeWallpaper
      ? [{ id: 'legacy-home-wallpaper', image: snapshot.settings.homeWallpaper, title: '换一张喜欢的壁纸', description: '让每一次打开，都有好心情。' }]
      : []
  const validHomeQuickActions: HomeQuickActionId[] = ['new-note', 'new-todo', 'pomodoro', 'music', 'collection']
  const homeQuickActions = snapshot.settings?.homeQuickActions?.filter((id, index, items) => validHomeQuickActions.includes(id) && items.indexOf(id) === index)
  const companion = snapshot.settings?.deskCompanion as LegacyCompanionSettings | undefined
  const defaultCharacter = defaults.settings.deskCompanion.characters[0]
  const legacyCharacter: Partial<DeskCompanionCharacter> = {
    id: 'default-companion',
    name: companion?.characterImageName,
    image: companion?.characterImage,
    dialogues: companion?.dialogues,
    pressSound: typeof companion?.pressSound === 'string' ? companion.pressSound : companion?.sound === false ? '' : undefined,
    pressSoundName: typeof companion?.pressSoundName === 'string' ? companion.pressSoundName : companion?.sound === false ? '' : undefined,
    releaseSound: typeof companion?.releaseSound === 'string' ? companion.releaseSound : companion?.sound === false ? '' : undefined,
    releaseSoundName: typeof companion?.releaseSoundName === 'string' ? companion.releaseSoundName : companion?.sound === false ? '' : undefined,
  }
  const characters = (Array.isArray(companion?.characters) && companion.characters.length
    ? companion.characters.slice(0, 12).map((character, index) => normalizeCompanionCharacter(character, defaultCharacter, index))
    : [normalizeCompanionCharacter(legacyCharacter, defaultCharacter, 0)])
    .map((character) => character.id === 'default-companion' && character.name === '默认小伙伴'
      ? { ...character, name: defaultCharacter.name }
      : character)
  const activeCharacterId = characters.some((character) => character.id === companion?.activeCharacterId)
    ? companion!.activeCharacterId!
    : characters[0].id
  const deskCompanion: DeskCompanionSettings = {
    enabled: companion?.enabled === true,
    scale: typeof companion?.scale === 'number' && Number.isFinite(companion.scale)
      ? Math.min(1.4, Math.max(0.7, companion.scale))
      : defaults.settings.deskCompanion.scale,
    dialogueMode: companion?.dialogueMode === 'random' ? 'random' : 'sequential',
    activeCharacterId,
    characters,
  }
  return {
    ...defaults,
    ...snapshot,
    version: 1,
    settings: { ...defaults.settings, ...snapshot.settings, homeWallpapers, homeQuickActions: homeQuickActions?.length ? homeQuickActions : defaults.settings.homeQuickActions, lastTool: lastTool as AppSnapshot['settings']['lastTool'], themePalettes: migrateDefaultThemePalettes(snapshot.settings?.themePalettes), deskCompanion },
    tracks: music.tracks,
    albums: music.albums,
    folders: snapshot.folders ?? [],
    notes: snapshot.notes ?? [],
    goals: (snapshot.goals ?? []).map(normalizeGoal),
    todos: snapshot.todos ?? [],
    recurringTodos: snapshot.recurringTodos ?? [],
    todoCompletionRecords: snapshot.todoCompletionRecords ?? [],
    pomodoro: { ...defaults.pomodoro, ...snapshot.pomodoro },
    countdowns: normalizeCountdowns(snapshot.countdowns ?? [], imageLibrary.assets),
    clipboardSnippets: (snapshot.clipboardSnippets ?? []).map((snippet) => ({ ...snippet, copyCount: snippet.copyCount ?? 0 })),
      launcherLinks: snapshot.launcherLinks ?? [],
      imageLibrary,
      bangumi: null,
  }
}

export const repository = {
  isDesktop: Boolean(window.sylunae),
  async load(): Promise<AppSnapshot> {
    if (window.sylunae) return normalize(await window.sylunae.storage.load())
    await ensureSectionStorage()
    return normalize(joinSnapshotSections(await db.sections.toArray()))
  },
  async save(patch: AppSnapshotPatch): Promise<void> {
    const entries = snapshotPatchEntries(patch)
    if (entries.length === 0) return
    if (window.sylunae) await window.sylunae.storage.save(patch)
    else {
      await ensureSectionStorage()
      await db.sections.bulkPut(entries)
    }
  },
  async replace(snapshot: AppSnapshot): Promise<void> {
    const safe = normalize(snapshot)
    if (window.sylunae) await window.sylunae.storage.replace(safe)
    else {
      await ensureSectionStorage()
      await db.transaction('rw', db.sections, async () => {
        await db.sections.clear()
        await db.sections.bulkPut(splitSnapshot(safe))
      })
    }
  },
}

/** Persistent cover cache kept separate from the user's exported application data. */
export const bangumiCoverCache = {
  async get(url: string): Promise<Blob | null> {
    return (await db.bangumiCovers.get(url))?.blob ?? null
  },
  async put(url: string, blob: Blob): Promise<void> {
    await db.bangumiCovers.put({ url, blob, cachedAt: new Date().toISOString() })
  },
  async clear(): Promise<void> {
    await db.bangumiCovers.clear()
  },
}
