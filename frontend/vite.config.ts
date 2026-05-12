import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'

/**
 * Netlify Dev (`lambda-local`) caps **synchronous** functions at 30s when the site is
 * unlinked or the CLI falls back to default site info — ignoring `netlify.toml` timeouts.
 * In dev, handle `POST /.netlify/functions/scan` in the Vite Node process so long scans work
 * when you use the app at http://localhost:5173 (including while `netlify dev` runs Vite).
 *
 * Set `VITE_INLINE_NETLIFY_SCAN=0` to force proxying to `VITE_FUNCTIONS_PROXY_TARGET` instead.
 */
function readRequestBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer | string) => {
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function inlineNetlifyScanPlugin(repoRoot: string, enabled: boolean): Plugin {
  return {
    name: 'inline-netlify-scan',
    configureServer(server) {
      if (!enabled) return

      const scanModulePath = path.join(repoRoot, 'netlify', 'functions', 'scan.js')
      const require = createRequire(import.meta.url)

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url?.split('?')[0] ?? '').replace(/\/$/, '') || '/'
        if (pathname !== '/.netlify/functions/scan') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.end()
          return
        }

        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const bodyText = await readRequestBody(req)
          const mod = require(scanModulePath) as { handler: (event: { httpMethod: string; body: string }) => Promise<unknown> }
          const lambdaResult = (await mod.handler({
            httpMethod: 'POST',
            body: bodyText,
          })) as { statusCode: number; headers?: Record<string, string | undefined>; body: string }

          res.statusCode = lambdaResult.statusCode
          const hdrs = lambdaResult.headers ?? {}
          for (const [key, value] of Object.entries(hdrs)) {
            if (value !== undefined && value !== '') res.setHeader(key, value)
          }
          res.end(lambdaResult.body ?? '')
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(
            JSON.stringify({
              ok: false,
              error: 'Function error',
              detail: String(err instanceof Error ? err.message : err).slice(0, 800),
            }),
          )
        }
      })
    },
  }
}

/**
 * Proxy `/.netlify/functions/*` (except scan when inlined) to Netlify Dev (default :8888).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const functionsProxyTarget = env.VITE_FUNCTIONS_PROXY_TARGET || 'http://127.0.0.1:8888'
  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  const inlineScan =
    mode === 'development' && env.VITE_INLINE_NETLIFY_SCAN !== '0'

  return {
    plugins: [inlineNetlifyScanPlugin(repoRoot, inlineScan), tailwindcss()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/.netlify/functions': {
          target: functionsProxyTarget,
          changeOrigin: true,
          // Default proxy timeouts (~30s) cut off long scans; match function budget.
          timeout: 900_000,
          proxyTimeout: 900_000,
        },
      },
    },
  }
})
