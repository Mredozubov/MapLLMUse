#!/usr/bin/env python3
"""
HTTP bridge so Netlify (Node-only functions) can run the real scanner on a Python host.

Netlify: set env `SCAN_PROXY_URL` to this service’s URL (e.g. `https://your-app.railway.app/scan`).
Optional shared secret: set `SCAN_HTTP_TOKEN` here and `SCAN_PROXY_AUTHORIZATION` on Netlify
to the same value (with or without a `Bearer ` prefix).

Run (example):
  cd backend && pip install -r requirements.txt && python3 scan_http_service.py

Env:
  PORT              Listen port (Render/Railway inject this; default 8787).
  SCAN_HTTP_PORT    Fallback if PORT unset.
  SCAN_HTTP_TOKEN   If non-empty, require matching Authorization header.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
SCRIPT = BACKEND_DIR / "script.py"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: str) -> None:
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _auth_ok(self) -> bool:
        token = (os.environ.get("SCAN_HTTP_TOKEN") or "").strip()
        if not token:
            return True
        auth = self.headers.get("Authorization") or ""
        return auth == f"Bearer {token}" or auth == token

    def do_POST(self) -> None:
        if not self._auth_ok():
            self._send(401, json.dumps({"ok": False, "error": "Unauthorized"}))
            return

        if self.path not in ("/", "/scan"):
            self._send(404, json.dumps({"ok": False, "error": "Not found"}))
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._send(400, json.dumps({"ok": False, "error": "Invalid JSON"}))
            return

        target = str(payload.get("target") or "").strip()
        if not target or len(target) > 2048 or any(c in target for c in "\r\n\0"):
            self._send(400, json.dumps({"ok": False, "error": "target is required (max 2048 chars, no newlines)"}))
            return

        try:
            proc = subprocess.run(
                [sys.executable, str(SCRIPT), "--target", target, "--json"],
                cwd=str(BACKEND_DIR),
                capture_output=True,
                text=True,
                timeout=840,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        except subprocess.TimeoutExpired as exc:
            self._send(
                504,
                json.dumps(
                    {
                        "ok": False,
                        "error": "Scan timed out",
                        "stdout": ((exc.stdout or "")[:800]),
                    }
                ),
            )
            return
        except OSError as exc:
            self._send(500, json.dumps({"ok": False, "error": str(exc)}))
            return

        out = proc.stdout or ""
        err = proc.stderr or ""
        parsed = None
        try:
            parsed = json.loads(out.strip() or "{}")
        except json.JSONDecodeError:
            for line in reversed(out.splitlines()):
                line = line.strip()
                if not line.startswith("{"):
                    continue
                try:
                    parsed = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue

        if not isinstance(parsed, dict) or "ok" not in parsed:
            self._send(
                500,
                json.dumps(
                    {
                        "ok": False,
                        "error": "Invalid scan output",
                        "stderr": err[:1200],
                        "stdout_sample": out[:1200],
                        "exitCode": proc.returncode,
                    }
                ),
            )
            return

        status = 200 if parsed.get("ok") else 422
        self._send(status, json.dumps(parsed))

    def do_GET(self) -> None:
        if self.path in ("/", "/health"):
            self._send(200, json.dumps({"ok": True, "service": "mapllmuse-scan-proxy"}))
            return
        self._send(404, json.dumps({"ok": False, "error": "Not found"}))


def main() -> None:
    port = int(os.environ.get("PORT", os.environ.get("SCAN_HTTP_PORT", "8787")))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"scan_http_service listening on 0.0.0.0:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
