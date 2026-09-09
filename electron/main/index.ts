import { app, BrowserWindow, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { closeDatabase, loadSnapshot, saveSnapshot } from './database'
import type { AppSnapshot, MusicEditableMetadata, MusicMetadataUpdate, MusicTrack } from '../../src/shared/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus'])
const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.opus': 'audio/ogg',
}
const sessionMediaPaths = new Set<string>()
let tagLibPromise: ReturnType<typeof initializeTagLib> | null = null

protocol.registerSchemesAsPrivileged([
  { scheme: 'siyue-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
])

function isIndexedPath(filePath: string): boolean {
  return sessionMediaPaths.has(filePath) || loadSnapshot().tracks.some((track) => track.path === filePath)
}

async function initializeTagLib() {
  const { TagLib } = await import('taglib-wasm')
  return TagLib.initialize()
}

function getTagLib() {
  tagLibPromise ??= initializeTagLib()
  return tagLibPromise
}

function assertEditableAudioPath(filePath: string): void {
  if (typeof filePath !== 'string' || !isIndexedPath(filePath) || !existsSync(filePath) || !AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    throw new Error('音乐文件不可用或未加入资料库')
  }
}

async function readEditableMetadata(filePath: string): Promise<MusicEditableMetadata> {
  assertEditableAudioPath(filePath)
  const { parseFile } = await import('music-metadata')
  const parsed = await parseFile(filePath)
  const indexed = loadSnapshot().tracks.find((track) => track.path === filePath)
  const picture = parsed.common.picture?.[0]
  const indexedArtist = indexed?.artist === '未知艺术家' ? '' : indexed?.artist
  const indexedAlbum = indexed?.album === '未知专辑' ? '' : indexed?.album
  return {
    title: parsed.common.title?.trim() || indexed?.title || basename(filePath, extname(filePath)),
    artist: parsed.common.artist?.trim() || indexedArtist || '',
    album: parsed.common.album?.trim() || indexedAlbum || '',
    genre: parsed.common.genre?.filter(Boolean).join('; ') || '',
    year: parsed.common.year || null,
    track: parsed.common.track.no || null,
    comment: parsed.common.comment?.map((item) => item.text?.trim()).filter(Boolean).join('\n') || '',
    cover: picture
      ? `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`
      : indexed?.cover || '',
  }
}

function checkedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label}内容无效`)
  return value.trim()
}

function checkedNumber(value: unknown, label: string): number {
  if (value === null) return 0
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 9999) throw new Error(`${label}内容无效`)
  return Number(value)
}

function checkedCover(update: MusicMetadataUpdate['cover']): MusicMetadataUpdate['cover'] {
  if (!update || !['keep', 'remove', 'replace'].includes(update.mode)) throw new Error('封面操作无效')
  if (update.mode !== 'replace') return update
  const data = new Uint8Array(update.data)
  if (data.byteLength === 0 || data.byteLength > 12 * 1024 * 1024) throw new Error('封面文件需小于 12 MB')
  const isJpeg = update.mimeType === 'image/jpeg' && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  const isPng = update.mimeType === 'image/png' && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  if (!isJpeg && !isPng) throw new Error('仅支持 JPEG 或 PNG 封面')
  return { mode: 'replace', data, mimeType: update.mimeType }
}

async function updateTrackMetadata(update: MusicMetadataUpdate): Promise<MusicTrack> {
  if (!update || typeof update.id !== 'string') throw new Error('曲目信息无效')
  assertEditableAudioPath(update.path)
  const metadata = {
    title: checkedText(update.metadata?.title, '标题', 1024),
    artist: checkedText(update.metadata?.artist, '艺术家', 1024),
    album: checkedText(update.metadata?.album, '专辑', 1024),
    genre: checkedText(update.metadata?.genre, '流派', 1024),
    comment: checkedText(update.metadata?.comment, '备注', 10_000),
    year: checkedNumber(update.metadata?.year, '年份'),
    track: checkedNumber(update.metadata?.track, '音轨号'),
  }
  const cover = checkedCover(update.cover)
  const tagLib = await getTagLib()
  await tagLib.edit(update.path, (file) => {
    file.tag()
      .setTitle(metadata.title)
      .setArtist(metadata.artist)
      .setAlbum(metadata.album)
      .setGenre(metadata.genre)
      .setYear(metadata.year)
      .setTrack(metadata.track)
      .setComment(metadata.comment)
    if (cover.mode === 'remove') file.removePictures()
    if (cover.mode === 'replace') file.setPictures([{ type: 'FrontCover', mimeType: cover.mimeType, data: cover.data, description: 'Album cover' }])
  })
  return parseTrack(update.path, update.id)
}

async function parseTrack(filePath: string, id: string = crypto.randomUUID()): Promise<MusicTrack> {
  const { parseFile } = await import('music-metadata')
  const metadata = await parseFile(filePath, { duration: true })
  const picture = metadata.common.picture?.[0]
  const cover = picture
    ? `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`
    : ''
  const now = new Date().toISOString()
  return {
    id,
    path: filePath,
    title: metadata.common.title?.trim() || basename(filePath, extname(filePath)),
    artist: metadata.common.artist?.trim() || '未知艺术家',
    album: metadata.common.album?.trim() || '未知专辑',
    albumArtist: metadata.common.albumartist?.trim() || '',
    albumId: null,
    duration: metadata.format.duration || 0,
    cover,
    missing: false,
    createdAt: now,
    updatedAt: now,
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f7f7f7',
    icon: app.isPackaged ? undefined : fileURLToPath(new URL('../../build/icon.png', import.meta.url)),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#6f6f6f', height: 42 },
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)))
}

function registerIpc(): void {
  ipcMain.handle('storage:load', () => loadSnapshot())
  ipcMain.handle('storage:save', (_event, snapshot: AppSnapshot) => saveSnapshot(snapshot))
  ipcMain.handle('storage:replace', (_event, snapshot: AppSnapshot) => saveSnapshot(snapshot))

  ipcMain.handle('music:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择音乐文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '音频文件', extensions: [...AUDIO_EXTENSIONS].map((value) => value.slice(1)) }],
    })
    if (result.canceled) return []
    const tracks: MusicTrack[] = []
    for (const filePath of result.filePaths) {
      try { const track = await parseTrack(filePath); tracks.push(track); sessionMediaPaths.add(track.path) } catch { /* Ignore unreadable files. */ }
    }
    return tracks
  })
  ipcMain.handle('music:relocate', async (_event, trackId: string) => {
    const result = await dialog.showOpenDialog({
      title: '重新定位音乐文件',
      properties: ['openFile'],
      filters: [{ name: '音频文件', extensions: [...AUDIO_EXTENSIONS].map((value) => value.slice(1)) }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    try { const track = await parseTrack(result.filePaths[0], trackId); sessionMediaPaths.add(track.path); return track } catch { return null }
  })
  ipcMain.handle('music:check-paths', (_event, paths: string[]) =>
    Object.fromEntries(paths.map((filePath) => [filePath, existsSync(filePath)])),
  )
  ipcMain.handle('music:get-url', (_event, filePath: string) => {
    if (!isIndexedPath(filePath) || !existsSync(filePath) || !AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase())) {
      throw new Error('音乐文件不可用或未加入资料库')
    }
    return `siyue-media://audio/${Buffer.from(filePath).toString('base64url')}`
  })
  ipcMain.handle('music:read-metadata', (_event, filePath: string) => readEditableMetadata(filePath))
  ipcMain.handle('music:update-metadata', (_event, update: MusicMetadataUpdate) => updateTrackMetadata(update))

  ipcMain.handle('backup:export', async (_event, contents: string) => {
    const result = await dialog.showSaveDialog({
      title: '导出丝月工坊备份',
      defaultPath: `siyue-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, contents, 'utf8')
    return true
  })
  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入丝月工坊备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return readFileSync(result.filePaths[0], 'utf8')
  })
  ipcMain.handle('system:get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  ipcMain.handle('system:open-external', (_event, url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  const rendererOrigin = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : 'null'
  protocol.handle('siyue-media', async (request) => {
    const requestOrigin = request.headers.get('Origin')
    if (requestOrigin && requestOrigin !== rendererOrigin) return new Response('Forbidden', { status: 403 })
    const encoded = new URL(request.url).pathname.slice(1)
    const filePath = Buffer.from(encoded, 'base64url').toString('utf8')
    if (!isIndexedPath(filePath) || !existsSync(filePath) || !AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase())) {
      return new Response('Not found', { status: 404 })
    }
    const size = statSync(filePath).size
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': rendererOrigin,
      'Content-Type': AUDIO_MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
    })
    const range = request.headers.get('Range')
    if (!range) {
      headers.set('Content-Length', String(size))
      return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit, { status: 200, headers })
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    const suffixLength = match[1] ? null : Number(match[2])
    const start = suffixLength === null ? Number(match[1]) : Math.max(0, size - suffixLength)
    const end = match[2] && suffixLength === null ? Math.min(Number(match[2]), size - 1) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    headers.set('Content-Length', String(end - start + 1))
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as BodyInit, { status: 206, headers })
  })
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', closeDatabase)
