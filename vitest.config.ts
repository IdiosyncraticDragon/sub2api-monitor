import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 单元测试 + 组件测试配置。
// 纯逻辑（main/core）用 node 环境；React 组件用 happy-dom。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/main/core/**', 'src/main/services/**', 'src/renderer/components/**'],
      reporter: ['text', 'html']
    }
  }
})
