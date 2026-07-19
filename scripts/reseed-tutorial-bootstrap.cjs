#!/usr/bin/env node
/**
 * Apply the code Tutorial Path bootstrap to a running server (default template +
 * live Tutorial Room reload).
 *
 * Usage:
 *   ADMIN_JWT=<jwt> npm run tutorial:reseed-bootstrap
 *   ADMIN_JWT=<jwt> npm run tutorial:reseed-bootstrap -- --url https://nimiq.space
 *
 * Requires a deployed build that includes POST /api/admin/tutorial/reseed-bootstrap.
 */
"use strict";

const args = process.argv.slice(2);
let baseUrl = process.env.NSPACE_API_BASE || "http://127.0.0.1:3001";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    baseUrl = String(args[++i]).replace(/\/$/, "");
  }
}

const jwt = process.env.ADMIN_JWT || process.env.NSPACE_ADMIN_JWT || "";
if (!jwt.trim()) {
  console.error(
    "Set ADMIN_JWT (or NSPACE_ADMIN_JWT) to an admin session token, then retry."
  );
  process.exit(1);
}

const url = `${baseUrl}/api/admin/tutorial/reseed-bootstrap`;

(async () => {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.trim()}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, body);
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
