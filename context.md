# MapLLMUse — project context for AI assistants

This file summarizes the repository so you can work on it without rediscovering layout, behavior, and constraints.

## What this project is

**MapLLMUse** is a CISC 4900–style research project that **characterizes AI and human risk when coding**, using ideas from vulnerability datasets (e.g. BigVul-style references), CWE-related keywords, and **pattern-based scanning** of repository source code. It combines:

- Heuristic scans (CWE-ish keywords, “dangerous” C/API and scripting patterns).
- Optional enrichment from a **local reference CSV** inside `project_data.zip` (vulnerability classifications, CWE IDs, CVE IDs) to grow a set of string tokens to search for in code.
- Optional **Gemini**–based executive summary of the top aggregated findings.

The **scanner UI** is a **Vite + TypeScript** app under `frontend/`; the **executable pipeline** is `backend/script.py`.

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite app: dashboard scanner, marketing (`#/marketing`), embedded report (`#/report`), Tailwind UI. Built output: `frontend/dist/` (Netlify `publish`). |
| `backend/script.py` | Main CLI: downloads a GitHub repo as ZIP, scans selected extensions, aggregates scores, calls Gemini if configured. |
| `backend/project_data.zip` | Large local asset (optional); CSV used to build `known_risks` string set. Lives next to `script.py`. |
| `backend/.env` | **Local secrets** (gitignored). Expected key: `GEMINI_API_KEY`. |
| `backend/Data/` | Generated `index.html` + `ai_summary.txt` from CLI runs; synced into `frontend/public/Data` for dev/build when present. |
| `netlify/functions/scan.js` | Serverless wrapper: runs `backend/script.py --json`. |
| `netlify.toml` | Build (`npm --prefix frontend ci && npm --prefix frontend run build`), `publish = "frontend/dist"`, `included_files` includes `backend/script.py`. |

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

## Local development and Netlify function timeouts

- **`netlify dev` on http://localhost:8888** uses `lambda-local` with a **30 second** cap for synchronous functions when the repo is **not linked** to a Netlify site (or the CLI falls back to default site info). `[functions.scan] timeout` in `netlify.toml` does **not** override that dev path. See [netlify/cli#6481](https://github.com/netlify/cli/issues/6481) and related discussions.
- **Workaround (default):** With Vite dev running (including when started by `netlify dev`), open the app at **http://localhost:5173**. The Vite config runs the `scan` function handler in the same Node process for `POST /.netlify/functions/scan`, so scans are only limited by `SCAN_TIMEOUT_MS` / the subprocess budget in `netlify/functions/scan.js`, not the 30s lambda-local timer. Set **`VITE_INLINE_NETLIFY_SCAN=0`** in the environment used by Vite if you need to force proxying to `VITE_FUNCTIONS_PROXY_TARGET` instead.
- **Alternative:** Run **`netlify link`**, then raise **Functions → timeout** for the site in the Netlify UI so the API returns a higher `functions_timeout` for local dev.

## Limitations and caveats for implementers

- Scanning is **not** a full SAST product: substring and regex heuristics produce false positives/negatives.
- **Default branch** must be `main` or `master` for the ZIP download logic to succeed.
- **Binary / other languages** are ignored by extension filter.
- **Rate limits / auth**: Unauthenticated `requests.get` to GitHub may hit rate limits for heavy use.
- **Large repos**: Full ZIP download and in-memory scan can be slow or memory-heavy.

## What to do when extending the project

- Add `requirements.txt` (or `pyproject.toml`) pinning versions.
- Consider GitHub API + token for rate limits and branch discovery.
- Separate “data acquisition”, “analysis”, and “reporting” into modules if the script grows.
- Keep `.env` out of version control; document keys only by **name** in markdown.

---

*Generated as a handoff document: attach this file or keep it as `CLAUDE.md` in the repo root so Claude (or similar tools) load consistent project context.*
