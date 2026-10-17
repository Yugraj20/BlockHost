import type { BlockHostApi } from '../../preload/index'

declare global {
  interface Window {
    api: BlockHostApi
  }
}

export {}
