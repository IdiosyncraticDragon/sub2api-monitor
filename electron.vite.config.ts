import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // 把 electron-store 打进主进程 bundle，使 asar 不依赖 node_modules 布局
    // （cnpm/pnpm 的 .store 符号链接布局下 electron-builder 收不全依赖，会导致
    //  打包后主进程 `Cannot find module 'electron-store'`）。electron 本身仍外置。
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
