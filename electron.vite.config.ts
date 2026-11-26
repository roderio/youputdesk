import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  // Dependencies stay external (build.externalizeDeps defaults to true): Electron loads them from node_modules.
  main: {},
  preload: {
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
      // Sandboxed preloads can only require('electron'): each must be one self-contained file.
      // So bundle dependencies in, and keep the small preloads (mini, updater, auth-compat) free of runtime
      // imports shared with index, or Rolldown would split the shared code into a chunk file.
      externalizeDeps: false,
      rolldownOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'auth-compat': resolve('src/preload/auth-compat.ts'),
          mini: resolve('src/preload/mini.ts'),
          updater: resolve('src/preload/updater.ts'),
        },
        // Sandboxed preloads must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rolldownOptions: {
        input: {
          mini: resolve('src/renderer/mini/index.html'),
          updater: resolve('src/renderer/updater/index.html'),
        },
      },
    },
  },
})
