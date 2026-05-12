const { runScanNode } = require("./scan-core");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

function scanProxyUrl() {
  const u = process.env.SCAN_PROXY_URL;
  return typeof u === "string" ? u.trim() : "";
}

/**
 * Optional: forward to an external scanner (same contract as runScanNode JSON).
 */
async function runScanViaProxy(target, timeoutMs) {
  const endpoint = scanProxyUrl();
  if (!endpoint) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const extraHeaders = {};
  const auth = process.env.SCAN_PROXY_AUTHORIZATION;
  if (auth) extraHeaders.Authorization = auth;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ target }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse(502, {
        ok: false,
        error: "Scan proxy returned non-JSON",
        detail: String(text).slice(0, 1200),
        status: res.status,
      });
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse(502, {
        ok: false,
        error: "Scan proxy returned invalid JSON root",
        detail: String(text).slice(0, 800),
      });
    }
    if (!("ok" in parsed)) {
      return jsonResponse(502, {
        ok: false,
        error: "Scan proxy JSON missing ok field",
        detail: String(text).slice(0, 800),
      });
    }
    if (!parsed.ok) {
      const code = res.status >= 400 && res.status < 600 ? res.status : 422;
      return jsonResponse(code, parsed);
    }
    if (!res.ok) {
      return jsonResponse(res.status || 502, {
        ok: false,
        error: "Scan proxy returned an error status with a success-shaped body",
        status: res.status,
        detail: String(text).slice(0, 800),
      });
    }
    return jsonResponse(200, parsed);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    return jsonResponse(502, {
      ok: false,
      error: "Scan proxy request failed",
      detail: msg.slice(0, 800),
    });
  } finally {
    clearTimeout(timer);
  }
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

    const lambdaTimeoutSec = Number(process.env.AWS_LAMBDA_FUNCTION_TIMEOUT);
    const defaultMs =
      Number.isFinite(lambdaTimeoutSec) && lambdaTimeoutSec > 0
        ? Math.max(10_000, lambdaTimeoutSec * 1000 - 8000)
        : 240_000;
    const timeoutMs = Number(process.env.SCAN_TIMEOUT_MS) || defaultMs;

    const proxied = await runScanViaProxy(target, timeoutMs);
    if (proxied) return proxied;

    const result = await runScanNode(target);
    if (!result.ok) {
      return jsonResponse(422, result);
    }
    return jsonResponse(200, result);
  } catch (err) {
    console.error("[scan] Unhandled error", err);
    return jsonResponse(500, {
      ok: false,
      error: "Function error",
      detail: String(err && err.message ? err.message : err).slice(0, 800),
    });
  }
};
