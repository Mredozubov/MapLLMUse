/**
 * Node implementation of the scanner (mirrors backend/script.py core behavior).
 * Used by Netlify Functions — no Python subprocess.
 */
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const CWE_PATTERNS = {
  "buffer overflow": 5,
  "sql injection": 5,
  "command injection": 5,
  xss: 4,
  "use after free": 5,
  "race condition": 4,
  "integer overflow": 3,
  "path traversal": 4,
};

/** Same patterns/weights as script.py; label matches Python's display string for groupby. */
const DANGEROUS_FUNCTIONS = [
  [/\bstrcpy\b/g, "strcpy", 5],
  [/\bstrcat\b/g, "strcat", 4],
  [/\bgets\b/g, "gets", 5],
  [/\bsprintf\b/g, "sprintf", 4],
  [/\bsystem\s*\(/g, "system(", 5],
  [/\bpopen\s*\(/g, "popen(", 4],
  [/\bmemcpy\b/g, "memcpy", 3],
  [/\beval\s*\(/g, "eval(", 5],
];

const REFERENCE_CSV = "all_c_cpp_release2.0.csv";

function riskLevelForScore(scoreNum) {
  if (scoreNum > 100) return "High";
  if (scoreNum >= 50) return "Medium";
  return "Low";
}

function vulnerabilitiesToJson(summaryRows) {
  return summaryRows.map(([vuln, scoreNum]) => {
    const scoreDisplay = scoreNum === Math.trunc(scoreNum) ? Math.trunc(scoreNum) : scoreNum;
    return {
      name: String(vuln),
      score: scoreDisplay,
      riskLevel: riskLevelForScore(scoreNum),
    };
  });
}

/**
 * Naive CSV field extractor for the reference export (latin1, 3 logical columns).
 * Good enough for unique-token extraction matching pandas' column-based reads.
 */
function loadKnownRisksFromZipBuffer(zipBuffer) {
  const out = new Set();
  try {
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntry(REFERENCE_CSV);
    if (!entry) return out;
    const raw = entry.getData().toString("latin1");
    const lines = raw.split(/\r?\n/);
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const parts = line.split(",");
      for (const p of parts) {
        const t = p.trim().replace(/^"|"$/g, "");
        if (t && t.length < 500) out.add(t);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function tryLoadKnownRisks(repoRoot) {
  const zp = path.join(repoRoot, "backend", "project_data.zip");
  if (!fs.existsSync(zp)) return new Set();
  try {
    const buf = fs.readFileSync(zp);
    return loadKnownRisksFromZipBuffer(buf);
  } catch {
    return new Set();
  }
}

function analyzeContent(content, knownRisks) {
  const lower = String(content).toLowerCase();
  const findings = [];

  for (const risk of knownRisks) {
    const riskStr = String(risk).toLowerCase();
    if (!riskStr) continue;
    if (lower.includes(riskStr)) {
      let n = 0;
      let idx = 0;
      while (true) {
        const j = lower.indexOf(riskStr, idx);
        if (j === -1) break;
        n += 1;
        idx = j + riskStr.length;
      }
      findings.push([risk, n]);
    }
  }

  for (const [key, score] of Object.entries(CWE_PATTERNS)) {
    if (lower.includes(key)) {
      findings.push([key.toUpperCase(), score]);
    }
  }

  for (const [re, label, weight] of DANGEROUS_FUNCTIONS) {
    re.lastIndex = 0;
    const matches = lower.match(re);
    if (matches && matches.length) {
      findings.push([label, weight * matches.length]);
    }
  }

  return findings;
}

/** Turn SDK / Google JSON errors into a short message for the dashboard. */
function tryParseGoogleErrorJson(s) {
  const t = String(s).trim();
  if (t.startsWith("{")) {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i === -1 || j <= i) return null;
  try {
    return JSON.parse(t.slice(i, j + 1));
  } catch {
    return null;
  }
}

function formatGeminiError(err) {
  const friendlyKey =
    "Gemini could not run: the API key is missing, invalid, or expired. " +
    "Create a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in Netlify (or backend/.env locally). " +
    "The pattern scores above are still from the code scan.";

  let raw = err && err.message ? String(err.message) : String(err);
  const status = err && typeof err.status === "number" ? err.status : undefined;

  const j = tryParseGoogleErrorJson(raw);
  if (j) {
    const inner = j && j.error ? j.error : j;
    const msg = inner && inner.message ? String(inner.message) : "";
    const details = inner && Array.isArray(inner.details) ? inner.details : [];
    const reason0 = details[0] && details[0].reason ? String(details[0].reason) : "";
    if (
      reason0 === "API_KEY_INVALID" ||
      /API key expired|invalid api key|API_KEY_INVALID/i.test(msg + raw)
    ) {
      return friendlyKey;
    }
    if (msg) {
      return `Gemini request failed: ${msg}${status ? ` (${status})` : ""}`;
    }
  }

  if (/API key expired|API_KEY_INVALID|invalid api key|INVALID_ARGUMENT.*key/i.test(raw)) {
    return friendlyKey;
  }
  if (status === 401 || status === 403) {
    return friendlyKey;
  }

  const short = raw.length > 420 ? `${raw.slice(0, 400)}…` : raw;
  return `Gemini request failed: ${short}`;
}

async function getAiAnalysisNode(target, findingsSummary) {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key.trim()) {
    return "AI analysis skipped: No API Key found in .env file.";
  }
  try {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key.trim() });
    const prompt =
      `Act as a Senior Security Architect. Analyze these scan results for ${target}: ` +
      `\n${findingsSummary}\n` +
      `Provide a 3-sentence executive summary focusing on the risk impact.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = response.text;
    return text || "AI analysis returned an empty response.";
  } catch (e) {
    return formatGeminiError(e);
  }
}

function aggregateTop10(allFindings) {
  const map = new Map();
  for (const [vuln, score] of allFindings) {
    const prev = map.get(vuln) || 0;
    const n = Number(score) || 0;
    map.set(vuln, prev + n);
  }
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return rows;
}

function resolveRepoRoot() {
  const candidates = [
    path.join(__dirname, "..", ".."),
    path.join(__dirname, ".."),
    process.cwd(),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "backend", "script.py"))) {
      return path.resolve(p);
    }
    if (fs.existsSync(path.join(p, "script.py"))) {
      return path.resolve(p);
    }
  }
  return path.resolve(path.join(__dirname, "..", ".."));
}

/**
 * @returns {Promise<{ ok: true, target: string, vulnerabilities: object[], aiSummary: string } | { ok:false, error:string }>}
 */
async function runScanNode(targetRaw) {
  let target = String(targetRaw || "").trim();
  if (!target.startsWith("http")) {
    target = `https://${target}`;
  }
  const cleanUrl = target.replace("github/", "github.com/");
  const zipMain = `${cleanUrl.replace(/\/$/, "")}/archive/refs/heads/main.zip`;
  const zipMaster = `${cleanUrl.replace(/\/$/, "")}/archive/refs/heads/master.zip`;

  const zipTimeoutMs = Number(process.env.SCAN_ZIP_FETCH_MS) || 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), zipTimeoutMs);

  let res;
  try {
    res = await fetch(zipMain, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      res = await fetch(zipMaster, { signal: controller.signal, redirect: "follow" });
    }
  } catch (e) {
    clearTimeout(timer);
    const msg = String(e && e.name === "AbortError" ? "Download timed out" : e && e.message ? e.message : e);
    return { ok: false, error: `Could not download repository archive: ${msg}` };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return { ok: false, error: `Could not connect to ${cleanUrl} (HTTP ${res.status}).` };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const maxMb = Number(process.env.SCAN_MAX_ZIP_MB) || 80;
  if (buf.length > maxMb * 1024 * 1024) {
    return { ok: false, error: `Repository archive exceeds ${maxMb} MB limit.` };
  }

  const repoRoot = resolveRepoRoot();
  const knownRisks = tryLoadKnownRisks(repoRoot);

  const allFindings = [];
  try {
    const z = new AdmZip(buf);
    for (const entry of z.getEntries()) {
      if (entry.isDirectory) continue;
      const n = entry.entryName;
      if (!/\.(c|cpp|h|js|py)$/i.test(n)) continue;
      const content = entry.getData().toString("utf8");
      allFindings.push(...analyzeContent(content, knownRisks));
    }
  } catch (e) {
    return { ok: false, error: `Invalid or unreadable zip: ${e && e.message ? e.message : String(e)}` };
  }

  if (allFindings.length === 0) {
    const emptyMsg = "No vulnerability patterns were detected in the scanned sources.";
    return {
      ok: true,
      target,
      vulnerabilities: [],
      aiSummary: emptyMsg,
    };
  }

  const summaryRows = aggregateTop10(allFindings);
  const findingsSummary = summaryRows.map(([v, s]) => `${v}\t${s}`).join("\n");
  const aiReport = await getAiAnalysisNode(target, findingsSummary);

  return {
    ok: true,
    target,
    vulnerabilities: vulnerabilitiesToJson(summaryRows),
    aiSummary: aiReport,
  };
}

module.exports = { runScanNode, resolveRepoRoot };
