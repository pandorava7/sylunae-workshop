import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, MusicImportProgress, SiyueAPI } from '../../src/shared/types'

const api: SiyueAPI = {
  platform: 'electron',
  storage: {
    load: () => ipcRenderer.invoke('storage:load'),
    save: (snapshot: AppSnapshot) => ipcRenderer.invoke('storage:save', snapshot),
    replace: (snapshot: AppSnapshot) => ipcRenderer.invoke('storage:replace', snapshot),
  },
  music: {
    pick: () => ipcRenderer.invoke('music:pick'),
    getDownloadDirectory: () => ipcRenderer.invoke('music:get-download-directory'),
    pickDownloadDirectory: (currentDirectory) => ipcRenderer.invoke('music:pick-download-directory', currentDirectory),
    importRemote: (input) => ipcRenderer.invoke('music:import-remote', input),
    onImportProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: MusicImportProgress) => listener(progress)
      ipcRenderer.on('music:import-progress', handler)
      return () => ipcRenderer.removeListener('music:import-progress', handler)
    },
    relocate: (trackId) => ipcRenderer.invoke('music:relocate', trackId),
    checkPaths: (paths) => ipcRenderer.invoke('music:check-paths', paths),
    getAudioUrl: (path) => ipcRenderer.invoke('music:get-url', path),
    readMetadata: (path) => ipcRenderer.invoke('music:read-metadata', path),
    updateMetadata: (update) => ipcRenderer.invoke('music:update-metadata', update),
  },
  backup: {
    exportFile: (contents) => ipcRenderer.invoke('backup:export', contents),
    importFile: () => ipcRenderer.invoke('backup:import'),
  },
  system: {
    getTheme: () => ipcRenderer.invoke('system:get-theme'),
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
  },
}

contextBridge.exposeInMainWorld('siyue', api)
