import pandas as pd
import zipfile
import requests
import io
import os
import argparse
import re
from google import genai
from dotenv import load_dotenv # NEW: Industry standard secret management

# --- SECURE CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_ZIP = os.path.join(BASE_DIR, 'project_data.zip')
REFERENCE_CSV = 'all_c_cpp_release2.0.csv'

# Load the hidden .env file automatically
load_dotenv(os.path.join(BASE_DIR, '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

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
    args = parser.parse_args()

    print("\n" + "="*50)
    print("CISC 4900: AI-AUGMENTED SECURITY SCANNER (v2026)")
    print("="*50)
    
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
            print(f"[*] Library Loaded: {len(known_risks)} unique patterns.")

        all_findings = []
        print(f"[*] Analyzing Source: {target}...")
        
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
            print("[!] No vulnerabilities detected.")
            return

        df = pd.DataFrame(all_findings, columns=["Vulnerability", "Score"])
        summary = df.groupby("Vulnerability").sum().sort_values("Score", ascending=False).head(10)
        
        print("[*] Requesting AI Expert Analysis (2026 SDK)...")
        ai_report = get_ai_analysis(target, summary.to_string())

        print("\n" + "-"*30 + "\nTOP SECURITY RISKS:\n" + "-"*30)
        print(summary)
        print("\n" + "-"*30 + "\nAI EXECUTIVE SUMMARY:\n" + "-"*30)
        print(ai_report + "\n" + "-"*30)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()