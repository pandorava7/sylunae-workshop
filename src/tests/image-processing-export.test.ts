// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const state = vi.hoisted(() => ({ root: '', selected: '', handlers: new Map<string, (...args: any[]) => Promise<any>>(), openPath: vi.fn(async () => '') }))
vi.mock('electron', () => ({
  app: { getPath: (name: string) => join(state.root, name) },
  ipcMain: { handle: (name: string, handler: (...args: any[]) => Promise<any>) => state.handlers.set(name, handler) },
  dialog: { showOpenDialog: async () => ({ canceled: !state.selected, filePaths: state.selected ? [state.selected] : [] }) },
  shell: { openPath: state.openPath },
}))
const call = (name: string, ...args: unknown[]) => state.handlers.get(`image-processing:${name}`)!(undefined, ...args)

beforeEach(async () => {
  state.root = await mkdtemp(join(tmpdir(), 'sylunae-image-export-'))
  state.selected = ''
  state.handlers.clear()
  state.openPath.mockClear()
  await mkdir(join(state.root, 'userData'))
  vi.resetModules()
  const { registerImageProcessing } = await import('../../electron/main/imageProcessing')
  registerImageProcessing()
})
afterEach(async () => { await rm(state.root, { recursive: true, force: true }) })

describe('desktop image output', () => {
  it('keeps concurrent exports distinct and never overwrites existing images', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const paths = await Promise.all([call('save', 'photo.png', bytes), call('save', 'photo.png', bytes), call('save', 'photo.png', bytes)])
    expect(new Set(paths).size).toBe(3)
    for (const path of paths) expect(await readFile(path)).toEqual(Buffer.from(bytes))
  })
  it('confines filenames to the chosen folder and rejects invalid payloads', async () => {
    const directory = await call('get-directory')
    const path = await call('save', '../escape.png', new Uint8Array([1]).buffer)
    expect(dirname(path)).toBe(directory)
    await expect(call('save', 'bad.exe', new Uint8Array([1]).buffer)).rejects.toThrow('无效')
    await expect(call('save', 'bad.png', new ArrayBuffer(0))).rejects.toThrow('无效')
  })
  it('remembers the selected output directory and opens it', async () => {
    state.selected = join(state.root, 'chosen')
    expect(await call('pick-directory')).toBe(state.selected)
    expect(JSON.parse(await readFile(join(state.root, 'userData', 'image-processing.json'), 'utf8')).directory).toBe(state.selected)
    vi.resetModules()
    const { registerImageProcessing } = await import('../../electron/main/imageProcessing')
    registerImageProcessing()
    expect(await call('get-directory')).toBe(state.selected)
    await call('open-directory')
    expect(state.openPath).toHaveBeenCalledWith(state.selected)
    expect(await readdir(state.selected)).toEqual([])
  })
  it('keeps the previous directory when the picker is cancelled', async () => {
    const original = await call('get-directory')
    expect(await call('pick-directory')).toBeNull()
    expect(await call('get-directory')).toBe(original)
  })
})
