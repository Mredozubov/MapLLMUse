const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function resolveRepoRoot() {
  const candidates = [
    path.join(__dirname, "..", ".."),
    path.join(__dirname, ".."),
    process.cwd(),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "script.py"))) {
      return path.resolve(p);
    }
  }
  return path.resolve(path.join(__dirname, "..", ".."));
}

function resolveScriptPath(repoRoot) {
  const candidates = [
    path.join(repoRoot, "script.py"),
    path.join(__dirname, "script.py"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: "Invalid JSON body" }),
    };
  }

  const target = String(body.target || "").trim();
  if (!target || target.length > 2048) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: "target is required (max 2048 characters)" }),
    };
  }
  if (/[\r\n\0]/.test(target)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: "Invalid target" }),
    };
  }

  const repoRoot = resolveRepoRoot();
  const scriptPath = resolveScriptPath(repoRoot);
  if (!scriptPath) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: "script.py not found on server" }),
    };
  }

  const pythonDeps = path.join(repoRoot, "python_deps");
  const extraPaths = [];
  if (fs.existsSync(pythonDeps)) {
    extraPaths.push(pythonDeps);
  }
  if (process.env.PYTHONPATH) {
    extraPaths.push(process.env.PYTHONPATH);
  }
  const pythonBin = process.env.PYTHON_PATH || "python3";
  const timeoutMs = Number(process.env.SCAN_TIMEOUT_MS) || 240000;

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    ...(extraPaths.length ? { PYTHONPATH: extraPaths.join(path.delimiter) } : {}),
  };

  const result = await new Promise((resolve) => {
    const chunks = [];
    const errChunks = [];
    const child = spawn(pythonBin, [scriptPath, "--target", target, "--json"], {
      cwd: repoRoot,
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
    return {
      statusCode: 504,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Scan timed out. Try a smaller repository or increase SCAN_TIMEOUT_MS.",
      }),
    };
  }

  const trimmed = result.stdout.trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Invalid scan output from Python",
        detail: trimmed.slice(0, 800),
        stderr: result.stderr.slice(0, 800),
      }),
    };
  }

  if (!parsed.ok) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify(parsed),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(parsed),
  };
};
