import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

function gitVersion() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

/** Publishes the service worker with the exact list of files in this build. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync('public', { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => `${entry.parentPath.replace(/^public\/?/, '')}/${entry.name}`.replace(/^\//, ''))
      const files = ['./', ...Object.keys(bundle), ...publicFiles].map((file) =>
        file === './' ? file : `./${file}`,
      )
      // The page's own contents matter too, so it's part of what makes a new version.
      const page = bundle['index.html']
      const pageSource = page?.type === 'asset' ? String(page.source) : ''
      const version = createHash('sha256').update(files.join()).update(pageSource).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: readFileSync('src/sw/sw.template.js', 'utf8')
          .replace('__VERSION__', version)
          .replace('__FILES__', JSON.stringify(files)),
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(gitVersion()) },
  preview: { port: 5173, strictPort: true },
  test: { exclude: ['**/node_modules/**', '.opencv-build/**'] },
})
