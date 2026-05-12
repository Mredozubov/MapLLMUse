import sys

# Before importing third-party libraries: in --json mode, route their incidental stdout
# (and any accidental print()) to stderr so the real stdout carries only the final JSON line.
_JSON_MODE = "--json" in sys.argv
_JSON_RESULT_STREAM = sys.stdout
if _JSON_MODE:
    sys.stdout = sys.stderr

import json
import zipfile
import requests
import io
import os
import argparse
import re
import html
import pandas as pd
from google import genai
from dotenv import load_dotenv  # NEW: Industry standard secret management
# --- SECURE CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_ZIP = os.path.join(BASE_DIR, 'project_data.zip')
REFERENCE_CSV = 'all_c_cpp_release2.0.csv'

# Load the hidden .env file automatically
load_dotenv(os.path.join(BASE_DIR, '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def emit_scan_json(payload):
    """In --json mode, write exactly one JSON object to the original stdout (strict JSON)."""
    if not _JSON_MODE:
        return
    try:
        line = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    except (ValueError, TypeError):
        line = json.dumps(
            {"ok": False, "error": "Scan produced a response that could not be encoded as strict JSON."},
            ensure_ascii=False,
            allow_nan=False,
        )
    _JSON_RESULT_STREAM.write(line + "\n")
    _JSON_RESULT_STREAM.flush()


# --- PATTERNS ---
CWE_PATTERNS = {
    "buffer overflow": 5, "sql injection": 5, "command injection": 5,
    "xss": 4, "use after free": 5, "race condition": 4,
    "integer overflow": 3, "path traversal": 4
}

DANGEROUS_FUNCTIONS = {
    r"\bstrcpy\b": 5, r"\bstrcat\b": 4, r"\bgets\b": 5,
    r"\bsprintf\b": 4, r"\bsystem\s*\(": 5, r"\bpopen\s*\(": 4,
    r"\bmemcpy\b": 3, r"\beval\s*\(": 5
}

def get_ai_analysis(target, findings_summary):
    if not GEMINI_API_KEY:
        return "AI analysis skipped: No API Key found in .env file."
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = (f"Act as a Senior Security Architect. Analyze these scan results for {target}: "
                  f"\n{findings_summary}\n"
                  f"Provide a 3-sentence executive summary focusing on the risk impact.")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"AI Analysis Error: {e}"

def build_report_html(target, summary_df, ai_report):
    """Bootstrap report page: hero header, striped risk table, AI summary, footer."""
    from datetime import datetime

    safe_target = html.escape(target, quote=True)
    safe_ai = html.escape(ai_report)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    table_rows = []
    for vuln, row in summary_df.iterrows():
        score_val = row["Score"]
        try:
            score_num = float(score_val)
        except (TypeError, ValueError):
            score_num = 0.0
        if score_num > 100:
            risk_label = "High"
            risk_badge = '<span class="badge rounded-pill risk-badge-high">High</span>'
        elif score_num >= 50:
            risk_label = "Medium"
            risk_badge = '<span class="badge rounded-pill risk-badge-medium">Medium</span>'
        else:
            risk_label = "Low"
            risk_badge = '<span class="badge rounded-pill risk-badge-low">Low</span>'
        vuln_safe = html.escape(str(vuln), quote=True)
        score_display = int(score_num) if score_num == int(score_num) else score_num
        table_rows.append(
            f"<tr data-risk=\"{html.escape(risk_label, quote=True)}\">"
            f"<th scope=\"row\">{vuln_safe}</th>"
            f"<td class=\"text-end fw-semibold\">{html.escape(str(score_display), quote=True)}</td>"
            f"<td>{risk_badge}</td></tr>"
        )
    table_body = "\n".join(table_rows)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Security Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
  <style>
    :root {{
      --report-header-bg: #0b1220;
      --report-accent: #7c3aed;
    }}
    body {{
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f4f6fb;
    }}
    .report-hero {{
      background: linear-gradient(135deg, var(--report-header-bg) 0%, #111827 55%, #1e1b4b 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }}
    .report-hero .target-line {{
      font-size: clamp(1.15rem, 2.4vw, 1.85rem);
      font-weight: 600;
      letter-spacing: -0.02em;
      word-break: break-word;
    }}
    .scan-status-pill {{
      font-weight: 600;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 24px rgba(25, 135, 84, 0.35);
    }}
    .table-scroll-wrap {{
      max-height: min(55vh, 520px);
      overflow-y: auto;
      border-radius: 0.5rem;
      border: 1px solid rgba(0,0,0,0.08);
      background: #fff;
    }}
    .table-scroll-wrap table {{
      margin-bottom: 0;
    }}
    .table-scroll-wrap thead th {{
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f8f9fa;
      box-shadow: 0 1px 0 rgba(0,0,0,0.08);
    }}
    .risk-badge-high {{
      background: #dc2626;
      color: #fff;
    }}
    .risk-badge-medium {{
      background: #f97316;
      color: #111827;
    }}
    .risk-badge-low {{
      background: #facc15;
      color: #422006;
    }}
    .ai-summary-card .card-header {{
      border-bottom: none;
    }}
    #ai-summary.ai-summary-body {{
      margin: 0;
      white-space: pre-wrap;
      font-family: inherit;
      font-size: 1.05rem;
      line-height: 1.65;
      color: #1f2937;
      border-left: 4px solid var(--report-accent);
      padding: 0.75rem 0 0.75rem 1.25rem;
      background: linear-gradient(90deg, rgba(124, 58, 237, 0.06), transparent 40%);
    }}
    main.container {{
      flex: 1;
    }}
    .report-footer {{
      border-top: 1px solid rgba(0,0,0,0.06);
      background: #fff;
    }}
  </style>
</head>
<body>
  <header class="report-hero text-white">
    <div class="container py-4 py-md-5">
      <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-4">
        <div class="flex-grow-1">
          <div class="text-white-50 small text-uppercase fw-semibold mb-2" style="letter-spacing: 0.12em;">
            Security scan · Target repository
          </div>
          <h1 class="h3 text-white-50 mb-3 mb-lg-2">🛡️ MapLLMUse report</h1>
          <p class="target-line mb-0 text-white" id="scan-target">{safe_target}</p>
        </div>
        <div class="align-self-lg-center">
          <span class="badge scan-status-pill bg-success rounded-pill px-4 py-3 fs-6">Scan Complete</span>
        </div>
      </div>
    </div>
  </header>

  <main class="container py-4 py-lg-5">
    <div class="bg-white rounded-3 shadow-sm p-4 p-md-4 mb-2">
      <h2 class="h5 text-secondary text-uppercase fw-semibold mb-3" style="letter-spacing: 0.06em;">
        Pattern matches
      </h2>
      <div class="table-scroll-wrap">
        <div class="table-responsive">
          <table class="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th scope="col">Vulnerability</th>
                <th scope="col" class="text-end">Score</th>
                <th scope="col">Risk level</th>
              </tr>
            </thead>
            <tbody>
              {table_body}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card ai-summary-card border-0 shadow-sm mt-4">
      <div class="card-header bg-dark text-white py-3 px-4 fs-5 fw-semibold">
        🤖 AI Executive Summary
      </div>
      <div class="card-body p-4">
        <div id="ai-summary" class="ai-summary-body">{safe_ai}</div>
      </div>
    </div>
  </main>

  <footer class="report-footer text-center text-muted small py-4 mt-auto">
    Generated by MapLLMUse · {html.escape(generated_at, quote=True)}
  </footer>
</body>
</html>
"""

def risk_level_for_score(score_num):
    if score_num > 100:
        return "High"
    if score_num >= 50:
        return "Medium"
    return "Low"


def vulnerabilities_to_json(summary_df):
    rows = []
    for vuln, row in summary_df.iterrows():
        score_val = row["Score"]
        try:
            score_num = float(score_val)
        except (TypeError, ValueError):
            score_num = 0.0
        if score_num != score_num:  # NaN
            score_num = 0.0
        elif score_num in (float("inf"), float("-inf")):
            score_num = 0.0
        score_display = int(score_num) if score_num == int(score_num) else score_num
        rows.append(
            {
                "name": str(vuln),
                "score": score_display,
                "riskLevel": risk_level_for_score(score_num),
            }
        )
    return rows


def analyze_content(content, known_risks):
    content = content.lower()
    findings = []
    for risk in known_risks:
        risk_str = str(risk).lower()
        if risk_str in content:
            findings.append((risk, content.count(risk_str)))
    for k, score in CWE_PATTERNS.items():
        if k in content:
            findings.append((k.upper(), score))
    for pattern, score in DANGEROUS_FUNCTIONS.items():
        matches = re.findall(pattern, content)
        if matches:
            findings.append((pattern.replace(r'\b', '').replace(r'\s*\(', '('), score * len(matches)))
    return findings

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--json", action="store_true", help="Emit a single JSON object on stdout (for serverless).")
    args = parser.parse_args()

    def log(*a, **k):
        if args.json:
            print(*a, file=sys.stderr, **k)
        else:
            print(*a, **k)

    log("\n" + "="*50)
    log("CISC 4900: AI-AUGMENTED SECURITY SCANNER (v2026)")
    log("="*50)

    target = args.target if args.target.startswith("http") else "https://" + args.target

    try:
        known_risks = set()
        if os.path.exists(REFERENCE_ZIP):
            with zipfile.ZipFile(REFERENCE_ZIP, 'r') as z:
                with z.open(REFERENCE_CSV) as f:
                    ref_df = pd.read_csv(f, encoding='latin1', usecols=['vulnerability_classification', 'cwe_id', 'cve_id'])
                    known_risks.update(ref_df['vulnerability_classification'].dropna().unique().tolist())
                    known_risks.update(ref_df['cwe_id'].dropna().unique().tolist())
                    known_risks.update(ref_df['cve_id'].dropna().unique().tolist())
            log(f"[*] Library Loaded: {len(known_risks)} unique patterns.")

        all_findings = []
        log(f"[*] Analyzing Source: {target}...")

        clean_url = target.replace("github/", "github.com/")
        zip_url = clean_url.rstrip('/') + "/archive/refs/heads/main.zip"

        r = requests.get(zip_url)
        if r.status_code != 200:
            r = requests.get(clean_url.rstrip('/') + "/archive/refs/heads/master.zip")

        if r.status_code != 200:
            raise Exception(f"Could not connect to {clean_url}.")

        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for file in z.namelist():
                if file.endswith(('.c', '.cpp', '.h', '.js', '.py')):
                    with z.open(file) as f:
                        all_findings.extend(analyze_content(f.read().decode('utf-8', errors='ignore'), known_risks))

        if not all_findings:
            empty_msg = "No vulnerability patterns were detected in the scanned sources."
            log("[!] No vulnerabilities detected.")
            if args.json:
                emit_scan_json({
                    "ok": True,
                    "target": target,
                    "vulnerabilities": [],
                    "aiSummary": empty_msg,
                })
            return

        df = pd.DataFrame(all_findings, columns=["Vulnerability", "Score"])
        summary = df.groupby("Vulnerability").sum().sort_values("Score", ascending=False).head(10)

        log("[*] Requesting AI Expert Analysis (2026 SDK)...")
        ai_report = get_ai_analysis(target, summary.to_string())

        data_dir = os.path.join(BASE_DIR, "Data")
        os.makedirs(data_dir, exist_ok=True)
        ai_summary_path = os.path.join(data_dir, "ai_summary.txt")
        with open(ai_summary_path, "w", encoding="utf-8") as f:
            f.write(ai_report)
        index_path = os.path.join(data_dir, "index.html")
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(build_report_html(target, summary, ai_report))

        if args.json:
            emit_scan_json({
                "ok": True,
                "target": target,
                "vulnerabilities": vulnerabilities_to_json(summary),
                "aiSummary": ai_report,
            })
        else:
            log("\n" + "-"*30 + "\nTOP SECURITY RISKS:\n" + "-"*30)
            log(summary)
            log("\n" + "-"*30 + "\nAI EXECUTIVE SUMMARY:\n" + "-"*30)
            log(ai_report + "\n" + "-"*30)

    except Exception as e:
        if args.json:
            emit_scan_json({"ok": False, "error": str(e)})
            sys.exit(1)
        log(f"Error: {e}")

if __name__ == "__main__":
    main()