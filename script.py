import pandas as pd
import zipfile
import requests
import io
import os
import argparse
import re

# ----------------------------
# CONFIG
# ----------------------------
REFERENCE_ZIP = 'project_data.zip'
REFERENCE_CSV = 'all_c_cpp_release2.0.csv'

# ----------------------------
# CWE + FUNCTION PATTERNS (ENHANCED)
# ----------------------------
CWE_PATTERNS = {
    "buffer overflow": 5,
    "sql injection": 5,
    "command injection": 5,
    "xss": 4,
    "cross site scripting": 4,
    "use after free": 5,
    "race condition": 4,
    "integer overflow": 3,
    "path traversal": 4
}

DANGEROUS_FUNCTIONS = {
    r"\bstrcpy\b": 5,
    r"\bstrcat\b": 4,
    r"\bgets\b": 5,
    r"\bsprintf\b": 4,
    r"\bsystem\s*\(": 5,
    r"\bpopen\s*\(": 4,
    r"\bmemcpy\b": 3,
    r"\beval\s*\(": 5
}

parser = argparse.ArgumentParser()
parser.add_argument("--target", required=True)
args = parser.parse_args()


# ----------------------------
# ANALYSIS ENGINE
# ----------------------------
def analyze_content(content):
    content = content.lower()
    findings = []

    # CWE keyword scan
    for k, score in CWE_PATTERNS.items():
        if k in content:
            findings.append((k, score))

    # regex function scan
    for pattern, score in DANGEROUS_FUNCTIONS.items():
        matches = re.findall(pattern, content)
        if matches:
            findings.append((pattern, score * len(matches)))

    return findings


# ----------------------------
# GITHUB SCANNER
# ----------------------------
def scan_github(url):
    print("Analyzing GitHub repository...")

    zip_url = url.rstrip('/') + "/archive/refs/heads/main.zip"
    r = requests.get(zip_url)

    if r.status_code != 200:
        zip_url = url.rstrip('/') + "/archive/refs/heads/master.zip"
        r = requests.get(zip_url)

    if r.status_code != 200:
        raise Exception("Failed to download repo")

    results = []

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        for file in z.namelist():

            if file.endswith(('.c', '.cpp', '.h', '.hpp', '.js', '.py')):
                try:
                    with z.open(file) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                        results.extend(analyze_content(content))
                except:
                    pass

    return results


# ----------------------------
# WEBSITE SCANNER
# ----------------------------
def scan_web(url):
    r = requests.get(url, timeout=10)
    return analyze_content(r.text)


# ----------------------------
# MAIN
# ----------------------------
def main():
    print("CISC 4900: Security Risk Analysis")
    print("Target:", args.target)

    target = args.target if args.target.startswith("http") else "https://" + args.target

    if "github.com" in target:
        findings = scan_github(target)
    else:
        findings = scan_web(target)

    if not findings:
        print("\nNo vulnerabilities detected.")
        return

    df = pd.DataFrame(findings, columns=["Vulnerability", "Score"])
    summary = df.groupby("Vulnerability").sum().sort_values("Score", ascending=False).head(10)

    print("\nTOP SECURITY RISKS:")
    print(summary)

    html = f"""
    <html>
    <head><title>Security Report</title></head>
    <body>
        <h2>Security Scan Report</h2>
        <p><b>Target:</b> {target}</p>
        {summary.to_html()}
    </body>
    </html>
    """

    with open("index.html", "w") as f:
        f.write(html)

    print("\nReport generated: index.html")


if __name__ == "__main__":
    main()