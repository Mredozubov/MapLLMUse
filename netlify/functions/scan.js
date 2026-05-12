const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * Parse the scan script stdout into a single JSON object.
 * Python may print warnings or other noise before/after the JSON line; `JSON.parse` on the
 * whole buffer then fails ("invalid JSON" on the frontend after the function wraps it).
 */
function extractJsonObjectFromStdout(rawStdout) {
  const trimmed = String(rawStdout || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!trimmed) return null;

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const isScanObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);

  let parsed = tryParse(trimmed);
  if (isScanObject(parsed)) return parsed;

  const lines = trimmed.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const slice = lines.slice(i).join("\n").trim();
    if (!slice.startsWith("{")) continue;
    parsed = tryParse(slice);
    if (isScanObject(parsed)) return parsed;
  }

  let start = trimmed.indexOf("{");
  while (start !== -1) {
    let depth = 0;
    for (let j = start; j < trimmed.length; j++) {
      const c = trimmed[j];
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = trimmed.slice(start, j + 1);
          parsed = tryParse(candidate);
          if (isScanObject(parsed)) return parsed;
          break;
        }
      }
    }
    start = trimmed.indexOf("{", start + 1);
  }

  return null;
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

function resolveScriptPath(repoRoot) {
  const candidates = [
    path.join(repoRoot, "backend", "script.py"),
    path.join(repoRoot, "script.py"),
    path.join(__dirname, "script.py"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function resolveBackendCwd(repoRoot, scriptPath) {
  const backend = path.join(repoRoot, "backend");
  if (fs.existsSync(path.join(backend, "script.py"))) {
    return path.resolve(backend);
  }
  return path.dirname(scriptPath);
}

/** Prefer explicit PYTHON_PATH, then an activated venv (POSIX), then python3. */
function resolvePythonBin() {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  const ve = process.env.VIRTUAL_ENV;
  if (ve) {
    const p3 = path.join(ve, "bin", "python3");
    const p = path.join(ve, "bin", "python");
    if (fs.existsSync(p3)) return p3;
    if (fs.existsSync(p)) return p;
  }
  return "python3";
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
    }

    const target = String(body.target || "").trim();
    if (!target || target.length > 2048) {
      return jsonResponse(400, { ok: false, error: "target is required (max 2048 characters)" });
    }
    if (/[\r\n\0]/.test(target)) {
      return jsonResponse(400, { ok: false, error: "Invalid target" });
    }

    const repoRoot = resolveRepoRoot();
    const scriptPath = resolveScriptPath(repoRoot);
    if (!scriptPath) {
      return jsonResponse(500, { ok: false, error: "script.py not found on server" });
    }

    const backendCwd = resolveBackendCwd(repoRoot, scriptPath);

    const pythonDeps = path.join(repoRoot, "python_deps");
    const extraPaths = [];
    if (fs.existsSync(pythonDeps)) {
      extraPaths.push(pythonDeps);
    }
    if (process.env.PYTHONPATH) {
      extraPaths.push(process.env.PYTHONPATH);
    }
    const pythonBin = resolvePythonBin();
    // Prefer explicit SCAN_TIMEOUT_MS; else stay under Lambda/Netlify function limit when known.
    const lambdaTimeoutSec = Number(process.env.AWS_LAMBDA_FUNCTION_TIMEOUT);
    const defaultSubprocessMs =
      Number.isFinite(lambdaTimeoutSec) && lambdaTimeoutSec > 0
        ? Math.max(10_000, lambdaTimeoutSec * 1000 - 8000)
        : 240_000;
    const timeoutMs = Number(process.env.SCAN_TIMEOUT_MS) || defaultSubprocessMs;

    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      ...(extraPaths.length ? { PYTHONPATH: extraPaths.join(path.delimiter) } : {}),
    };

    const result = await new Promise((resolve) => {
      const chunks = [];
      const errChunks = [];
      const child = spawn(pythonBin, [scriptPath, "--target", target, "--json"], {
        cwd: backendCwd,
        env,
        shell: false,
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve({
          code: -1,
          stdout: Buffer.concat(chunks).toString("utf8"),
          stderr: Buffer.concat(errChunks).toString("utf8"),
          timedOut: true,
        });
      }, timeoutMs);

      child.stdout.on("data", (d) => chunks.push(d));
      child.stderr.on("data", (d) => errChunks.push(d));
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          code,
          stdout: Buffer.concat(chunks).toString("utf8"),
          stderr: Buffer.concat(errChunks).toString("utf8"),
          timedOut: false,
        });
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          code: -1,
          stdout: Buffer.concat(chunks).toString("utf8"),
          stderr: String(err),
          timedOut: false,
        });
      });
    });

    if (result.timedOut) {
      return jsonResponse(504, {
        ok: false,
        error:
          "Scan timed out before Python finished. Try a smaller repository, raise [functions.scan] timeout in netlify.toml, or set SCAN_TIMEOUT_MS.",
      });
    }

    const rawOut = result.stdout;
    const rawErr = result.stderr;
    const parsed = extractJsonObjectFromStdout(rawOut);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[scan] Could not parse JSON from Python stdout", {
        exitCode: result.code,
        stdoutHead: String(rawOut).slice(0, 500),
        stdoutTail: String(rawOut).slice(-500),
        stderrHead: String(rawErr).slice(0, 800),
      });
      return jsonResponse(500, {
        ok: false,
        error: "Invalid scan output from Python (no parseable JSON object on stdout)",
        detail: String(rawOut).trim().slice(0, 1200),
        stderr: String(rawErr).trim().slice(0, 1200),
        exitCode: result.code,
      });
    }

    if (!("ok" in parsed)) {
      console.warn("[scan] Parsed stdout JSON missing ok field", { keys: Object.keys(parsed) });
      return jsonResponse(500, {
        ok: false,
        error: "Invalid scan output from Python (JSON missing ok field)",
        detail: String(rawOut).trim().slice(0, 800),
        stderr: String(rawErr).trim().slice(0, 800),
      });
    }

    if (!parsed.ok) {
      return jsonResponse(422, parsed);
    }

    return jsonResponse(200, parsed);
  } catch (err) {
    console.error("[scan] Unhandled error", err);
    return jsonResponse(500, {
      ok: false,
      error: "Function error",
      detail: String(err && err.message ? err.message : err).slice(0, 800),
    });
  }
};
