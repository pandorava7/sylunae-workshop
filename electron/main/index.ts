import { app, BrowserWindow, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { basename, extname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { create as createYoutubeDl } from 'youtube-dl-exec'
import { closeDatabase, loadSnapshot, saveSnapshot } from './database'
import type { AppSnapshot, MusicEditableMetadata, MusicImportProgress, MusicImportStage, MusicMetadataUpdate, MusicRemoteImport, MusicTrack } from '../../src/shared/types'

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
const sessionDownloadDirectories = new Set<string>()
let tagLibPromise: ReturnType<typeof initializeTagLib> | null = null
const MAX_REMOTE_AUDIO_BYTES = 1024 * 1024 * 1024
type ProgressReporter = (progress: Omit<MusicImportProgress, 'taskId' | 'source'>) => void

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

function unpackedPath(filePath: string): string {
  return app.isPackaged ? filePath.replace('app.asar', 'app.asar.unpacked') : filePath
}

function getDefaultMusicDirectory(): string {
  const directory = resolve(app.getPath('userData'), 'music')
  mkdirSync(directory, { recursive: true })
  sessionDownloadDirectories.add(directory)
  return directory
}

function sanitizeFileName(value: string): string {
  const clean = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim()
  return (clean || '未命名音频').slice(0, 180)
}

function uniqueFilePath(directory: string, fileName: string): string {
  const extension = extname(fileName)
  const stem = basename(fileName, extension)
  let candidate = join(directory, fileName)
  for (let index = 2; existsSync(candidate); index += 1) candidate = join(directory, `${stem} (${index})${extension}`)
  return candidate
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  return isIP(host) === 6 && (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb'))
}

function checkedRemoteImport(input: MusicRemoteImport): { taskId: string; source: MusicRemoteImport['source']; url: URL; directory: string } {
  if (!input || typeof input.taskId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(input.taskId) || !['youtube', 'audio-url'].includes(input.source) || typeof input.url !== 'string' || input.url.length > 4096 || typeof input.directory !== 'string') {
    throw new Error('导入参数无效')
  }
  const directory = resolve(input.directory)
  if (!sessionDownloadDirectories.has(directory)) throw new Error('请先选择文件保存位置')
  let url: URL
  try { url = new URL(input.url) } catch { throw new Error('请输入有效的链接') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('仅支持 HTTP 或 HTTPS 链接')
  if (input.source === 'youtube') {
    const host = url.hostname.toLowerCase()
    if (host !== 'youtu.be' && host !== 'youtube.com' && !host.endsWith('.youtube.com')) throw new Error('请输入 YouTube 视频链接')
  } else if (isPrivateHost(url.hostname)) {
    throw new Error('不支持本机或局域网链接')
  }
  mkdirSync(directory, { recursive: true })
  return { taskId: input.taskId, source: input.source, url, directory }
}

function extensionFromResponse(url: URL, contentType: string): string {
  const fromUrl = extname(url.pathname).toLowerCase()
  if (AUDIO_EXTENSIONS.has(fromUrl)) return fromUrl
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return ({
    'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav',
    'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'application/ogg': '.ogg', 'audio/flac': '.flac',
    'audio/x-flac': '.flac', 'audio/opus': '.opus',
  } as Record<string, string>)[mime] || ''
}

function responseFileName(response: Response, url: URL, extension: string): string {
  const disposition = response.headers.get('content-disposition') || ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1]
  let supplied = encoded ? decodeURIComponent(encoded) : plain
  supplied ||= basename(url.pathname) || `下载音频${extension}`
  const suppliedExtension = extname(supplied).toLowerCase()
  return `${sanitizeFileName(basename(supplied, suppliedExtension))}${AUDIO_EXTENSIONS.has(suppliedExtension) ? suppliedExtension : extension}`
}

async function importAudioUrl(url: URL, directory: string, report: ProgressReporter): Promise<MusicTrack> {
  report({ stage: 'reading', message: '正在连接音频地址…', percent: null })
  const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Siyue-Workshop/0.1' } })
  if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）`)
  const finalUrl = new URL(response.url)
  if (!['http:', 'https:'].includes(finalUrl.protocol) || isPrivateHost(finalUrl.hostname)) throw new Error('下载地址重定向到了不受支持的位置')
  const contentType = response.headers.get('content-type') || ''
  const extension = extensionFromResponse(finalUrl, contentType)
  if (!extension) throw new Error('链接返回的内容不是支持的音频文件')
  const declaredSize = Number(response.headers.get('content-length') || 0)
  const totalBytes = Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : null
  if (totalBytes && totalBytes > MAX_REMOTE_AUDIO_BYTES) throw new Error('音频文件不能超过 1 GB')
  const filePath = uniqueFilePath(directory, responseFileName(response, finalUrl, extension))
  const partialPath = `${filePath}.part`
  let received = 0
  let lastReportAt = 0
  report({ stage: 'downloading', message: '正在下载音频…', percent: totalBytes ? 0 : null, receivedBytes: 0, totalBytes })
  const sizeLimit = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      const now = Date.now()
      if (now - lastReportAt >= 100 || (totalBytes !== null && received >= totalBytes)) {
        const percent = totalBytes ? Math.min(100, Math.round((received / totalBytes) * 100)) : null
        report({ stage: 'downloading', message: percent === null ? '正在下载音频…' : `正在下载音频 ${percent}%`, percent, receivedBytes: received, totalBytes })
        lastReportAt = now
      }
      callback(received > MAX_REMOTE_AUDIO_BYTES ? new Error('音频文件不能超过 1 GB') : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(response.body as never), sizeLimit, createWriteStream(partialPath, { flags: 'wx' }))
    const { rename } = await import('node:fs/promises')
    await rename(partialPath, filePath)
    report({ stage: 'metadata', message: '正在读取音频信息…', percent: 100, receivedBytes: received, totalBytes })
    const track = await parseTrack(filePath)
    sessionMediaPaths.add(filePath)
    report({ stage: 'complete', message: '导入完成', percent: 100, receivedBytes: received, totalBytes })
    return track
  } catch (error) {
    if (existsSync(partialPath)) unlinkSync(partialPath)
    if (existsSync(filePath)) unlinkSync(filePath)
    throw error
  }
}

async function importYoutube(url: URL, directory: string, report: ProgressReporter): Promise<MusicTrack> {
  if (!ffmpegPath) throw new Error('FFmpeg 组件不可用，请重新安装桌面端')
  const ytDlpBinary = unpackedPath(join(app.getAppPath(), 'node_modules', 'youtube-dl-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'))
  const youtubeDl = createYoutubeDl(ytDlpBinary)
  report({ stage: 'reading', message: '正在读取视频信息…', percent: null })
  const metadata = await youtubeDl(url.toString(), { dumpSingleJson: true, skipDownload: true, noPlaylist: true, noWarnings: true })
  if (typeof metadata === 'string' || !metadata.id || !metadata.title) throw new Error('无法读取这个 YouTube 视频的信息')
  if (metadata.is_live) throw new Error('暂不支持直播内容')
  const stem = sanitizeFileName(`${metadata.title} [${metadata.id}]`)
  const filePath = uniqueFilePath(directory, `${stem}.mp3`)
  const output = `${filePath.slice(0, -4).replace(/%/g, '%%')}.%(ext)s`
  const stageOrder: Record<MusicImportStage, number> = { reading: 0, downloading: 1, converting: 2, metadata: 3, complete: 4 }
  let currentStage: MusicImportStage = 'downloading'
  const reportStage = (stage: MusicImportStage, message: string, percent: number | null = null) => {
    if (stageOrder[stage] < stageOrder[currentStage]) return
    currentStage = stage
    report({ stage, message, percent })
  }
  try {
    reportStage('downloading', '正在下载 YouTube 音频…', 0)
    const subprocess = youtubeDl.exec(url.toString(), {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
      addMetadata: true,
      embedThumbnail: true,
      ffmpegLocation: unpackedPath(ffmpegPath),
      maxFilesize: '1G',
      noPlaylist: true,
      noWarnings: true,
      noOverwrites: true,
      newline: true,
      output,
      windowsFilenames: process.platform === 'win32',
    })
    const readProgress = (chunk: Buffer | string) => {
      const outputText = chunk.toString()
      const download = /\[download\]\s+(\d+(?:\.\d+)?)%/i.exec(outputText)
      if (download) {
        const percent = Math.min(100, Math.round(Number(download[1])))
        reportStage('downloading', `正在下载 YouTube 音频 ${percent}%`, percent)
      }
      if (/\[(?:ExtractAudio|FFmpeg|VideoConvertor|Merger)\]/i.test(outputText)) reportStage('converting', '正在使用 FFmpeg 转换为 MP3…')
      if (/\[(?:Metadata|EmbedThumbnail)\]/i.test(outputText)) reportStage('metadata', '正在写入标题、作者与封面…')
    }
    ;(subprocess.stdout as unknown as NodeJS.ReadableStream | null)?.on('data', readProgress)
    ;(subprocess.stderr as unknown as NodeJS.ReadableStream | null)?.on('data', readProgress)
    await subprocess
    if (!existsSync(filePath)) throw new Error('YouTube 音频转换完成，但未找到输出文件')
    reportStage('metadata', '正在整理音乐元信息…')
    const track = await parseTrack(filePath)
    sessionMediaPaths.add(filePath)
    reportStage('complete', '导入完成', 100)
    return track
  } catch (error) {
    if (existsSync(filePath)) unlinkSync(filePath)
    throw error
  }
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
  ipcMain.handle('music:get-download-directory', () => getDefaultMusicDirectory())
  ipcMain.handle('music:pick-download-directory', async (_event, currentDirectory: string) => {
    const defaultPath = typeof currentDirectory === 'string' && sessionDownloadDirectories.has(resolve(currentDirectory))
      ? resolve(currentDirectory)
      : getDefaultMusicDirectory()
    const result = await dialog.showOpenDialog({
      title: '选择音乐保存位置',
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const directory = resolve(result.filePaths[0])
    sessionDownloadDirectories.add(directory)
    return directory
  })
  ipcMain.handle('music:import-remote', async (event, input: MusicRemoteImport) => {
    const checked = checkedRemoteImport(input)
    const report: ProgressReporter = (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('music:import-progress', { ...progress, taskId: checked.taskId, source: checked.source } satisfies MusicImportProgress)
    }
    return checked.source === 'youtube'
      ? importYoutube(checked.url, checked.directory, report)
      : importAudioUrl(checked.url, checked.directory, report)
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
