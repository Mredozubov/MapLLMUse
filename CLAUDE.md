# MapLLMUse — project context for AI assistants

This file summarizes the repository so you can work on it without rediscovering layout, behavior, and constraints.

## What this project is

**MapLLMUse** is a CISC 4900–style research project that **characterizes AI and human risk when coding**, using ideas from vulnerability datasets (e.g. BigVul-style references), CWE-related keywords, and **pattern-based scanning** of repository source code. It combines:

- Heuristic scans (CWE-ish keywords, “dangerous” C/API and scripting patterns).
- Optional enrichment from a **local reference CSV** inside `project_data.zip` (vulnerability classifications, CWE IDs, CVE IDs) to grow a set of string tokens to search for in code.
- Optional **Gemini**–based executive summary of the top aggregated findings.

The public narrative and demo UI live in static HTML; the **executable pipeline** is a single Python script.

## Repository layout

| Path | Role |
|------|------|
| `script.py` | Main CLI: downloads a GitHub repo as ZIP, scans selected extensions, aggregates scores, calls Gemini if configured. |
| `project_data.zip` | Large local asset; contains `all_c_cpp_release2.0.csv` used to build `known_risks` string set (columns: `vulnerability_classification`, `cwe_id`, `cve_id`). **Not committed in all clones** — if missing, the scanner still runs but without that vocabulary. |
| `.env` | **Local secrets only** (gitignored in typical setups). Expected key: `GEMINI_API_KEY`. Never commit real keys into docs or chat logs. |
| `index.html` | Marketing / project landing page (dark theme): overview, method, interactive **sample** findings filter, links to GitHub, YouTube, release notes. |
| `Data/index.html` | Example **generated-style** report (Bootstrap): table of top pattern scores + AI panel; content in repo is illustrative (e.g. target `python/cpython`). |
| `LLM_summary.txt` | Curated list of Hugging Face Space URLs related to LLM coding / security (references, not code dependencies). |
| `test_pipeline.ps1` | Minimal smoke script (`Write-Host 'SUCCESS: Pipeline is active!'`). |
| `README.md` | Short description, contributors, video, Netlify demo URL, release notes link. |
| `Docs/` | Placeholder / time log (`time_log.md` may be empty). |
| `Results/` | e.g. `results.jpg` (figures); `.gitkeep` style placeholders. |

## How the scanner works (`script.py`)

1. **CLI**: `python script.py --target <url-or-host>`  
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

Install equivalent packages in your environment before running `script.py`.

## Environment

Create a `.env` in the project root (same directory as `script.py`):

```env
GEMINI_API_KEY=your_key_here
```

If the key is invalid, revoked, or blocked, Gemini calls fail and the script surfaces the error string in the “AI” section (see sample in `Data/index.html`).

## External links (from README / site)

- **Video**: https://www.youtube.com/watch?v=fO07jD9j4wI  
- **Netlify site**: https://agent-6a026d6691482--glittery-travesseiro-c17f8e.netlify.app/  
- **Release notes (Google Doc)**: https://docs.google.com/document/d/1u-RiW2BLiMWl29UT704ccU3txAmQd_xoVWAsQ6mRvLc/edit?usp=sharing  
- **GitHub** (as linked from HTML): https://github.com/Mredozubov/MapLLMUse  

## Contributors (academic)

- Hui Chen (faculty advisor)  
- Shawn Belykh  
- Michael Redozubov  

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
