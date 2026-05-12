# MapLLMUse — project context for AI assistants

This file summarizes the repository so you can work on it without rediscovering layout, behavior, and constraints.

## What this project is

**MapLLMUse** is a CISC 4900–style research project that **characterizes AI and human risk when coding**, using ideas from vulnerability datasets (e.g. BigVul-style references), CWE-related keywords, and **pattern-based scanning** of repository source code. It combines:

- Heuristic scans (CWE-ish keywords, “dangerous” C/API and scripting patterns).
- Optional enrichment from a **local reference CSV** inside `project_data.zip` (vulnerability classifications, CWE IDs, CVE IDs) to grow a set of string tokens to search for in code.
- Optional **Gemini**–based executive summary of the top aggregated findings.

The **scanner UI** is a **Vite + TypeScript** app under `frontend/`; the **reference CLI** is **`backend/script.py`**. Production scans on **Netlify** use **`netlify/functions/scan-core.js`** (Node) so the same UX works without Python on the host.

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite app: dashboard scanner, marketing (`#/marketing`), embedded report (`#/report`), Tailwind UI. Built output: `frontend/dist/` (Netlify `publish`). |
| `backend/script.py` | Main CLI: downloads a GitHub repo as ZIP, scans selected extensions, aggregates scores, calls Gemini if configured. |
| `backend/project_data.zip` | Large local asset (optional); CSV used to build `known_risks` string set. Lives next to `script.py`. |
| `backend/.env` | **Local secrets** (gitignored). Expected key: `GEMINI_API_KEY`. |
| `backend/Data/` | Generated `index.html` + `ai_summary.txt` from CLI runs; synced into `frontend/public/Data` for dev/build when present. |
| `netlify/functions/scan.js` | Netlify handler: optional `SCAN_PROXY_URL`; else **`scan-core.js`** (pure Node: zip + heuristics + Gemini). |
| `netlify/functions/scan-core.js` | Node implementation of the scan pipeline (mirrors `backend/script.py` for production; no Python on Netlify). |
| `package.json` (repo root) | Root **`dependencies`**: `adm-zip`, `@google/genai` for Netlify function bundling. **`npm run build`** starts with **`npm ci`** here so those modules exist before esbuild packages `netlify/functions`. |
| `backend/scan_http_service.py` | Optional stdlib HTTP service if you still want a separate Python host behind `SCAN_PROXY_URL`. |
| `render.yaml` | Optional [Render Blueprint](https://render.com/docs/infrastructure-as-code) for `scan_http_service.py`. |
| `netlify.toml` | Build (`npm run build` from root), `publish = "frontend/dist"`, functions use esbuild. |

## How the scanner works (`backend/script.py`)

1. **CLI**: `python backend/script.py --target <url-or-host>` (from repo root), or `cd backend && python script.py ...`  
   - If `--target` does not start with `http`, `https://` is prepended.
   - `github/` in the target is normalized to `github.com/`.

2. **Reference data** (optional): If `project_data.zip` exists next to `script.py`, it reads `all_c_cpp_release2.0.csv` with `encoding='latin1'` and loads unique non-null values from `vulnerability_classification`, `cwe_id`, `cve_id` into a `set` used as substring tokens (via `analyze_content`).

3. **Source acquisition**: Builds GitHub archive URLs:
   - `{repo}/archive/refs/heads/main.zip` first, then `master.zip` if 404.

4. **Files scanned inside the ZIP**: Paths ending in `.c`, `.cpp`, `.h`, `.js`, `.py`. Each file is decoded as UTF-8 with `errors='ignore'`.

5. **Analysis** (`analyze_content`):
   - Lowercases content.
   - Matches any **reference risk string** contained in the file (counts occurrences).
   - Matches **CWE_PATTERNS** keywords (fixed severity scores).
   - Regex-matches **DANGEROUS_FUNCTIONS** (e.g. `strcpy`, `gets`, `system(`, `eval(`) and scores by match count × weight.

6. **Output**: Top 10 vulnerability rows by summed score (pandas `groupby`). Then optional Gemini summary.

7. **Gemini** (`get_ai_analysis`): Uses `google.genai` client with `model='gemini-2.5-flash'`. If `GEMINI_API_KEY` is unset, returns a skip message instead of calling the API.

## Dependencies (Python)

There is **no** `requirements.txt` in-repo as of this writing. Imports imply:

- `pandas`
- `requests`
- `python-dotenv` (`from dotenv import load_dotenv`)
- `google-genai` (`from google import genai`)

Install equivalent packages in your environment before running `backend/script.py` (e.g. `pip install -r backend/requirements.txt` in a venv).

## Environment

Create `backend/.env` next to `backend/script.py`:

```env
GEMINI_API_KEY=your_key_here
```

If the key is invalid, revoked, or blocked, Gemini calls fail and the script surfaces the error string in the “AI” section (see sample under `backend/Data/` or the synced `frontend/dist/Data/index.html`).

## External links (from README / site)

- **Video**: https://www.youtube.com/watch?v=fO07jD9j4wI  
- **Netlify site**: https://agent-6a026d6691482--glittery-travesseiro-c17f8e.netlify.app/  
- **Release notes (Google Doc)**: https://docs.google.com/document/d/1u-RiW2BLiMWl29UT704ccU3txAmQd_xoVWAsQ6mRvLc/edit?usp=sharing  
- **GitHub** (as linked from HTML): https://github.com/Mredozubov/MapLLMUse  

## Contributors (academic)

- Hui Chen (faculty advisor)  
- Shawn Belykh  
- Michael Redozubov  

## Netlify production build (dashboard vs repo)

The Vite app lives under `frontend/`; deployable files are **`frontend/dist`** (not `dist/client` and not repo-root `dist`). In the Netlify UI under **Site configuration → Build & deploy → Build settings**, keep **Base directory** empty (repository root). Setting base to **`main`** is a common mistake (that is the default Git branch, not a path). This repo’s root **`package.json`** defines `npm run build` so the build command can stay the standard `npm run build` while still running `npm ci` / `npm run build` inside `frontend/`.

**If the Publish directory field will not clear or save:** (1) Check **Package directory** on the same screen — it is **only configurable in the UI** ([monorepo docs](https://docs.netlify.com/build/configure-builds/monorepos/)). It must be **empty** for this repo so Netlify reads the root **`netlify.toml`**. If Package directory is set to `frontend`, Netlify looks for config under `frontend/` first and you can get confusing publish paths. (2) Confirm the branch Netlify builds actually contains **`netlify.toml` at the repo root** (push if you only changed files locally). (3) Open the latest deploy log: after a successful build you should see **`[verify-netlify-publish] OK`** from `scripts/verify-netlify-publish.mjs`; if the build fails earlier, fix that error first. (4) Per Netlify, **`netlify.toml` overrides conflicting UI settings** when the file is present — if deploys still ignore `frontend/dist`, try **Clear cache and deploy site** once.

### Scanning on Netlify (Node, no Python)

The **`scan`** function runs **pure Node.js**: it downloads the GitHub `main`/`master` zip, scans `.c`/`.cpp`/`.h`/`.js`/`.py` with the same CWE / dangerous-function heuristics as **`backend/script.py`**, aggregates the top 10, and calls **Gemini** when **`GEMINI_API_KEY`** is set in Netlify (same as local). Optional reference tokens from **`backend/project_data.zip`** are loaded when that file exists in the deployed repo (large; usually omitted on Netlify).

Optional **`SCAN_PROXY_URL`** still forwards to an external HTTP scanner if you prefer Python there.

### Optional: Python scan API on Render (`SCAN_PROXY_URL`)

Only if you want the scanner to run **on Python** elsewhere: this repo includes **`render.yaml`** for a free Render Web Service running **`backend/scan_http_service.py`**. Set Netlify **`SCAN_PROXY_URL`** to `https://<service>.onrender.com/scan`. For most deployments, **skip this** — Netlify already runs **`scan-core.js`** in Node.

1. Push **`render.yaml`** to GitHub.
2. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint** → connect the repo → apply **`render.yaml`**.
3. When Live, set **`SCAN_PROXY_URL`** on Netlify to `https://<subdomain>.onrender.com/scan`.
4. (Optional) **`GEMINI_API_KEY`** on Render; **`SCAN_HTTP_TOKEN`** + Netlify **`SCAN_PROXY_AUTHORIZATION`** for auth.
5. **Cold starts:** ping **`GET /health`** every ~10 min (e.g. [cron-job.org](https://cron-job.org)) on the free tier.

## Local development and Netlify function timeouts

- **`netlify dev` on http://localhost:8888** uses `lambda-local` with a **30 second** cap for synchronous functions when the repo is **not linked** to a Netlify site (or the CLI falls back to default site info). `[functions.scan] timeout` in `netlify.toml` does **not** override that dev path. See [netlify/cli#6481](https://github.com/netlify/cli/issues/6481) and related discussions.
- **Workaround (default):** With Vite dev running (including when started by `netlify dev`), open the app at **http://localhost:5173**. The Vite config runs the `scan` function handler in the same Node process for `POST /.netlify/functions/scan`, so scans are only limited by Netlify’s function timeout / `SCAN_TIMEOUT_MS`, not the 30s lambda-local timer. Set **`VITE_INLINE_NETLIFY_SCAN=0`** in the environment used by Vite if you need to force proxying to `VITE_FUNCTIONS_PROXY_TARGET` instead.
- **Alternative:** Run **`netlify link`**, then raise **Functions → timeout** for the site in the Netlify UI so the API returns a higher `functions_timeout` for local dev.

## Limitations and caveats for implementers

- Scanning is **not** a full SAST product: substring and regex heuristics produce false positives/negatives.
- **Default branch** must be `main` or `master` for the ZIP download logic to succeed.
- **Binary / other languages** are ignored by extension filter.
- **Rate limits / auth**: Unauthenticated `requests.get` to GitHub may hit rate limits for heavy use.
- **Large repos**: Full ZIP download and in-memory scan can be slow or memory-heavy.

## What to do when extending the project

- When you change **`CWE_PATTERNS`**, **`DANGEROUS_FUNCTIONS`**, or zip/file rules in **`backend/script.py`**, update **`netlify/functions/scan-core.js`** the same way so Netlify stays aligned with the CLI.
- Add `requirements.txt` (or `pyproject.toml`) pinning versions.
- Consider GitHub API + token for rate limits and branch discovery.
- Separate “data acquisition”, “analysis”, and “reporting” into modules if the script grows.
- Keep `.env` out of version control; document keys only by **name** in markdown.

---

*Generated as a handoff document: attach this file or keep it as `CLAUDE.md` in the repo root so Claude (or similar tools) load consistent project context.*
