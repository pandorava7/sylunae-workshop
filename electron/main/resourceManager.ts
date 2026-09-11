import { app, dialog } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseFile } from 'music-metadata'
import { whiteNoiseCatalog } from '../../src/resources/whiteNoiseCatalog'
import type { ResourceDownloadProgress, ResourceItem, ResourceSummary } from '../../src/shared/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus'])
const MAX_RESOURCE_BYTES = 128 * 1024 * 1024
const remoteBaseUrl = (import.meta.env.MAIN_VITE_RESOURCE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
const activeDownloads = new Map<string, Promise<ResourceItem>>()

interface CustomWhiteNoiseRecord {
  id: string
  title: string
  path: string
  size: number
  duration: number
  createdAt: string
}

interface ResourceStateFile {
  version: 1
  customWhiteNoise: CustomWhiteNoiseRecord[]
}

function resourceRoot(): string {
  return join(app.getPath('userData'), 'resources')
}

function whiteNoiseRoot(): string {
  return join(resourceRoot(), 'white-noise')
}

function customWhiteNoiseRoot(): string {
  return join(whiteNoiseRoot(), 'custom')
}

function statePath(): string {
  return join(resourceRoot(), 'state.json')
}

async function ensureDirectories(): Promise<void> {
  await Promise.all([
    mkdir(whiteNoiseRoot(), { recursive: true }),
    mkdir(customWhiteNoiseRoot(), { recursive: true }),
  ])
}

async function readState(): Promise<ResourceStateFile> {
  await ensureDirectories()
  try {
    const parsed = JSON.parse(await readFile(statePath(), 'utf8')) as Partial<ResourceStateFile>
    return { version: 1, customWhiteNoise: Array.isArray(parsed.customWhiteNoise) ? parsed.customWhiteNoise : [] }
  } catch {
    return { version: 1, customWhiteNoise: [] }
  }
}

async function saveState(state: ResourceStateFile): Promise<void> {
  await ensureDirectories()
  const temporary = `${statePath()}.tmp`
  await writeFile(temporary, JSON.stringify(state, null, 2), 'utf8')
  await rename(temporary, statePath())
}

function officialLocalPath(id: string): string {
  return join(whiteNoiseRoot(), `${id}.opus`)
}

function remoteResourceUrl(resourcePath: string): string {
  const base = new URL(`${remoteBaseUrl}/`)
  const loopback = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '::1'
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) throw new Error('公开资源地址必须使用 HTTPS')
  return new URL(resourcePath.replace(/^\/+/, ''), base).toString()
}

function bundledLocalPath(audioPath: string): string {
  return app.isPackaged
    ? join(app.getAppPath(), 'out', 'renderer', ...audioPath.split('/'))
    : join(process.cwd(), 'public', ...audioPath.split('/'))
}

function officialItem(id: string): ResourceItem {
  const item = whiteNoiseCatalog.find((entry) => entry.id === id)
  if (!item) throw new Error('资源不存在')
  const localPath = item.builtin ? bundledLocalPath(item.audioPath) : officialLocalPath(item.id)
  const installed = existsSync(localPath)
  return {
    ...item,
    origin: item.builtin ? 'builtin' : 'official',
    state: item.builtin ? 'builtin' : installed ? 'installed' : 'available',
    installedSize: installed ? item.size : 0,
    ...(installed ? { localPath } : {}),
  }
}

function customItem(record: CustomWhiteNoiseRecord): ResourceItem {
  return {
    id: record.id,
    kind: 'white-noise',
    title: record.title,
    description: '从本地添加的白噪音',
    tags: ['自定义', '本地'],
    coverPath: '',
    audioPath: '',
    duration: record.duration,
    size: record.size,
    sha256: '',
    builtin: false,
    attribution: { creator: '用户导入', sourceTitle: basename(record.path), sourceUrl: '', license: '本地文件', licenseUrl: '' },
    origin: 'custom',
    state: existsSync(record.path) ? 'installed' : 'error',
    installedSize: existsSync(record.path) ? record.size : 0,
    localPath: record.path,
    createdAt: record.createdAt,
  }
}

export async function listResources(): Promise<ResourceSummary> {
  const state = await readState()
  const items = [...whiteNoiseCatalog.map((item) => officialItem(item.id)), ...state.customWhiteNoise.map(customItem)]
  return {
    items,
    installedBytes: items.reduce((sum, item) => sum + item.installedSize, 0),
    availableBytes: items.filter((item) => item.state === 'available').reduce((sum, item) => sum + item.size, 0),
    remoteConfigured: Boolean(remoteBaseUrl),
  }
}

async function performDownload(id: string, report: (progress: ResourceDownloadProgress) => void): Promise<ResourceItem> {
  const item = whiteNoiseCatalog.find((entry) => entry.id === id)
  if (!item || item.builtin) throw new Error('这个资源不需要下载')
  if (!remoteBaseUrl) throw new Error('尚未配置公开资源地址')
  await ensureDirectories()
  const target = officialLocalPath(id)
  const temporary = `${target}.part`
  const url = remoteResourceUrl(item.audioPath)
  report({ id, receivedBytes: 0, totalBytes: item.size, percent: 0, stage: 'downloading', message: `正在下载 ${item.title}` })
  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）`)
    const headerSize = Number(response.headers.get('content-length') || item.size)
    const totalBytes = Number.isFinite(headerSize) && headerSize > 0 ? headerSize : item.size
    if (totalBytes > MAX_RESOURCE_BYTES) throw new Error('资源大小超过安全限制')
    let receivedBytes = 0
    const hash = createHash('sha256')
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length
        if (receivedBytes > MAX_RESOURCE_BYTES) return callback(new Error('资源大小超过安全限制'))
        hash.update(chunk)
        report({ id, receivedBytes, totalBytes, percent: Math.min(100, Math.round((receivedBytes / totalBytes) * 100)), stage: 'downloading', message: `正在下载 ${item.title}` })
        callback(null, chunk)
      },
    })
    await pipeline(Readable.fromWeb(response.body as never), progress, createWriteStream(temporary))
    report({ id, receivedBytes, totalBytes, percent: 100, stage: 'verifying', message: '正在校验资源完整性' })
    if (receivedBytes !== item.size || hash.digest('hex') !== item.sha256) throw new Error('资源校验失败，请稍后重试')
    await rename(temporary, target)
    report({ id, receivedBytes, totalBytes, percent: 100, stage: 'complete', message: `${item.title} 已可离线使用` })
    return officialItem(id)
  } catch (error) {
    if (existsSync(temporary)) await unlink(temporary).catch(() => undefined)
    report({ id, receivedBytes: 0, totalBytes: item.size, percent: null, stage: 'error', message: error instanceof Error ? error.message : '资源下载失败' })
    throw error
  }
}

export function downloadResource(id: string, report: (progress: ResourceDownloadProgress) => void): Promise<ResourceItem> {
  const existing = activeDownloads.get(id)
  if (existing) return existing
  const task = performDownload(id, report).finally(() => activeDownloads.delete(id))
  activeDownloads.set(id, task)
  return task
}

export async function importWhiteNoise(): Promise<ResourceItem | null> {
  const result = await dialog.showOpenDialog({
    title: '添加白噪音',
    properties: ['openFile'],
    filters: [{ name: '音频文件', extensions: [...AUDIO_EXTENSIONS].map((value) => value.slice(1)) }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const source = resolve(result.filePaths[0])
  const sourceInfo = await stat(source)
  if (!sourceInfo.isFile() || sourceInfo.size > MAX_RESOURCE_BYTES) throw new Error('音频文件不可用或超过 128 MB')
  const extension = extname(source).toLowerCase()
  if (!AUDIO_EXTENSIONS.has(extension)) throw new Error('不支持这个音频格式')
  const metadata = await parseFile(source, { duration: true })
  const id = `custom-${randomUUID()}`
  const target = join(customWhiteNoiseRoot(), `${id}${extension}`)
  await ensureDirectories()
  await copyFile(source, target)
  const record: CustomWhiteNoiseRecord = {
    id,
    title: metadata.common.title?.trim() || basename(source, extension),
    path: target,
    size: sourceInfo.size,
    duration: metadata.format.duration || 0,
    createdAt: new Date().toISOString(),
  }
  const state = await readState()
  state.customWhiteNoise.push(record)
  await saveState(state)
  return customItem(record)
}

export async function removeResource(id: string): Promise<void> {
  const official = whiteNoiseCatalog.find((item) => item.id === id)
  if (official?.builtin) throw new Error('内置资源不能删除')
  if (official) {
    const path = officialLocalPath(id)
    if (existsSync(path)) await unlink(path)
    return
  }
  const state = await readState()
  const custom = state.customWhiteNoise.find((item) => item.id === id)
  if (!custom) throw new Error('资源不存在')
  if (existsSync(custom.path)) await unlink(custom.path)
  state.customWhiteNoise = state.customWhiteNoise.filter((item) => item.id !== id)
  await saveState(state)
}

export async function getResourceAudioPath(id: string): Promise<string> {
  const official = whiteNoiseCatalog.find((item) => item.id === id)
  if (official) {
    const item = officialItem(id)
    if (!item.localPath) throw new Error('请先下载这个资源')
    return item.localPath
  }
  const state = await readState()
  const custom = state.customWhiteNoise.find((item) => item.id === id)
  if (!custom || !existsSync(custom.path)) throw new Error('本地资源不可用')
  const root = resolve(customWhiteNoiseRoot())
  const localPath = resolve(custom.path)
  const relativePath = relative(root, localPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('资源路径无效')
  return localPath
}
