import type { ChunkHarborApi } from '../../preload/index'

declare global {
  interface Window {
    api: ChunkHarborApi
  }
}

export {}
