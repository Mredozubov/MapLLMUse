/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API origin for scan requests (e.g. `http://127.0.0.1:8888`). */
  readonly VITE_SCAN_API_BASE?: string
  /** Proxy target for `/.netlify/functions` during `vite` dev (see `vite.config.ts`). */
  readonly VITE_FUNCTIONS_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
