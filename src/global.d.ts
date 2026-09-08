import type { SiyueAPI } from './shared/types'

declare global {
  interface Window {
    siyue?: SiyueAPI
  }
}

export {}
