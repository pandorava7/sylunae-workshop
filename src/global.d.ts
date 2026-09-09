import type { SylunaeAPI } from './shared/types'

declare global {
  interface Window {
    sylunae?: SylunaeAPI
  }
}

export {}
