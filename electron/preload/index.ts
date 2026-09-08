import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, SiyueAPI } from '../../src/shared/types'

const api: SiyueAPI = {
  platform: 'electron',
  storage: {
    load: () => ipcRenderer.invoke('storage:load'),
    save: (snapshot: AppSnapshot) => ipcRenderer.invoke('storage:save', snapshot),
    replace: (snapshot: AppSnapshot) => ipcRenderer.invoke('storage:replace', snapshot),
  },
  music: {
    pick: () => ipcRenderer.invoke('music:pick'),
    relocate: (trackId) => ipcRenderer.invoke('music:relocate', trackId),
    checkPaths: (paths) => ipcRenderer.invoke('music:check-paths', paths),
    getAudioUrl: (path) => ipcRenderer.invoke('music:get-url', path),
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
