import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.join(__dirname, '..')
const repoRoot = path.join(frontendRoot, '..')
const dist = path.join(frontendRoot, 'dist')
const dataDest = path.join(dist, 'Data')
const files = ['index.html', 'ai_summary.txt']

const sources = [
  path.join(repoRoot, 'backend', 'Data'),
  path.join(repoRoot, 'Data'),
]

function pickSourceDir() {
  for (const d of sources) {
    if (fs.existsSync(d)) return d
  }
  return null
}

if (!fs.existsSync(dist)) {
  console.warn('[copy-data] dist/ missing; skip')
  process.exit(0)
}

const dataSrc = pickSourceDir()
if (!dataSrc) {
  console.warn('[copy-data] No backend/Data or Data folder; skip')
  process.exit(0)
}

fs.mkdirSync(dataDest, { recursive: true })
for (const f of files) {
  const from = path.join(dataSrc, f)
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(dataDest, f))
    console.log('[copy-data]', f, '→ dist/Data/')
  }
}
