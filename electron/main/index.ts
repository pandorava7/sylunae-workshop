import { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, protocol, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { closeDatabase, loadSnapshot, saveSnapshot } from './database'
import type { AppSnapshot, MusicTrack } from '../../src/shared/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus'])
const sessionMediaPaths = new Set<string>()

protocol.registerSchemesAsPrivileged([
  { scheme: 'siyue-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
])

function isIndexedPath(filePath: string): boolean {
  return sessionMediaPaths.has(filePath) || loadSnapshot().tracks.some((track) => track.path === filePath)
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
  protocol.handle('siyue-media', (request) => {
    const encoded = new URL(request.url).pathname.slice(1)
    const filePath = Buffer.from(encoded, 'base64url').toString('utf8')
    if (!isIndexedPath(filePath) || !existsSync(filePath) || !AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase())) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', closeDatabase)
