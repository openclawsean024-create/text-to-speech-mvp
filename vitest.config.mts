import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * 測試一律在「測試模式」執行（GOAL AC-003）：
 * - NODE_ENV=test、TTS_PROVIDER=mock → 所有合成路徑只用 MockTtsProvider。
 * - tests/setup.ts 把 global.fetch 換成「呼叫即拋錯」的 stub，測試不得連網。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next', '.vercel'],
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      TTS_PROVIDER: 'mock',
    },
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
})
