import { app, dialog, ipcMain, shell } from 'electron'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let directory: string | null = null
let settingsWrite: Promise<void> = Promise.resolve()
const settingsPath = () => join(app.getPath('userData'), 'image-processing.json')

async function getDirectory() {
  if (directory) return directory
  try {
    const settings = JSON.parse(await readFile(settingsPath(), 'utf8'))
    if (typeof settings.directory === 'string' && settings.directory) directory = settings.directory
  } catch { /* First use or damaged preferences use the default directory. */ }
  directory ??= join(app.getPath('pictures'), '丝月工坊', '图片处理')
  return directory
}

export function registerImageProcessing() {
  ipcMain.handle('image-processing:get-directory', getDirectory)
  ipcMain.handle('image-processing:pick-directory', async () => {
    const selected = await dialog.showOpenDialog({ title: '图片输出文件夹', defaultPath: await getDirectory(), properties: ['openDirectory', 'createDirectory'] })
    if (selected.canceled || !selected.filePaths[0]) return null
    const path = selected.filePaths[0]
    const write = settingsWrite.catch(() => {}).then(async () => {
      const temporary = `${settingsPath()}.tmp`
      await writeFile(temporary, JSON.stringify({ directory: path }), 'utf8')
      await rename(temporary, settingsPath())
      directory = path
    })
    settingsWrite = write
    await write
    return path
  })
  ipcMain.handle('image-processing:open-directory', async () => {
    const path = await getDirectory()
    await mkdir(path, { recursive: true })
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })
  ipcMain.handle('image-processing:save', async (_event, name: unknown, bytes: unknown) => {
    if (typeof name !== 'string' || !/\.(png|jpg|webp)$/i.test(name) || !(bytes instanceof ArrayBuffer) || bytes.byteLength === 0 || bytes.byteLength > 256 * 1024 * 1024) throw new Error('无效的图片输出')
    // Accept a filename only; renderer input can never select an arbitrary path.
    const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(-180)
    const path = await getDirectory()
    await mkdir(path, { recursive: true })
    for (let suffix = 0; suffix < 10000; suffix++) {
      const candidate = join(path, suffix ? safeName.replace(/(\.[^.]+)$/, ` (${suffix})$1`) : safeName)
      let handle
      try { handle = await open(candidate, 'wx') }
      catch (reason) { if ((reason as NodeJS.ErrnoException).code === 'EEXIST') continue; throw reason }
      try {
        await handle.writeFile(Buffer.from(bytes))
        await handle.close()
        return candidate
      } catch (reason) {
        await handle.close().catch(() => {})
        await unlink(candidate).catch(() => {})
        throw reason
      }
    }
    throw new Error('同名文件过多，请更换输出文件夹')
  })
}
