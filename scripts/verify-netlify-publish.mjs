/**
 * Run after `npm run build`. Fails with a clear message if the folder Netlify
 * must publish (frontend/dist) is missing — helps when the dashboard publish
 * path is wrong or the build never ran in `frontend/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publishDir = path.join(root, 'frontend', 'dist')
const indexHtml = path.join(publishDir, 'index.html')

function log(msg) {
  console.log(`[verify-netlify-publish] ${msg}`)
}

if (!fs.existsSync(publishDir)) {
  console.error(`[verify-netlify-publish] Missing directory: ${publishDir}`)
  console.error(
    '[verify-netlify-publish] Fix: run a full build from the repo root (`npm run build`). Netlify publish path must be `frontend/dist` (from repo root).',
  )
  process.exit(1)
}

if (!fs.existsSync(indexHtml)) {
  console.error(`[verify-netlify-publish] Missing file: ${indexHtml}`)
  console.error(
    '[verify-netlify-publish] Fix: ensure Vite built the SPA (frontend/vite default outDir is `dist` → `frontend/dist/index.html`).',
  )
  process.exit(1)
}

log(`OK — deploy this directory: ${publishDir}`)
log(
  'Netlify UI: leave Base directory empty unless netlify.toml sets [build].base. Clear Package directory unless you use a per-package netlify.toml (this repo uses root netlify.toml only).',
)
log(
  'If the dashboard will not save Publish: push this repo; netlify.toml [build].publish should still apply over stale UI values once the file is on the branch Netlify builds.',
)
