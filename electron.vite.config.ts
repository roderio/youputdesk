import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const jsx = { jsx: 'automatic', jsxImportSource: 'preact' } as const

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    esbuild: jsx,
    build: {
      // Sandboxed preloads can only require('electron'): each must be one self-contained file.
      // So bundle dependencies in, and keep the small preloads (mini, auth-compat) free of runtime
      // imports shared with index, or Rollup would split the shared code into a chunk file.
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'auth-compat': resolve('src/preload/auth-compat.ts'),
          mini: resolve('src/preload/mini.ts'),
        },
        // Sandboxed preloads must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: { mini: resolve('src/renderer/mini/index.html') },
      },
    },
  },
})
