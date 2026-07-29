"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const payoutExample = path.join(root, "payout-service", ".env.example");
const payoutEnv = path.join(root, "payout-service", ".env");
const serverExample = path.join(root, "server", ".env.example");
const serverEnv = path.join(root, "server", ".env");

const DEV_PAYOUT_SECRET = "dev-insecure-local-payout-secret";

function readEnvMap(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const out = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return out;
}

/** Upsert keys while preserving comments and unrelated lines. */
function upsertEnvKeys(filePath, patch) {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  // Drop trailing empty line from split so we can rejoin cleanly
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const present = new Set();
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    present.add(key);
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = patch[key];
    if (value == null || value === "") continue;
    const next = `${key}=${value}`;
    if (lines[i] !== next) {
      lines[i] = next;
      changed = true;
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") continue;
    if (present.has(key)) continue;
    lines.push(`${key}=${value}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  }
  return changed;
}

if (!fs.existsSync(payoutEnv) && fs.existsSync(payoutExample)) {
  fs.copyFileSync(payoutExample, payoutEnv);
  console.log("[dev] Created payout-service/.env from .env.example");
}

if (!fs.existsSync(serverEnv) && fs.existsSync(serverExample)) {
  fs.copyFileSync(serverExample, serverEnv);
  console.log("[dev] Created server/.env from .env.example");
}

// Repair incomplete server/.env (e.g. only payout keys written earlier)
const serverMapEarly = readEnvMap(serverEnv);
if (
  fs.existsSync(serverExample) &&
  fs.existsSync(serverEnv) &&
  !serverMapEarly.get("JWT_SECRET")
) {
  const exampleMap = readEnvMap(serverExample);
  const repair = {};
  for (const [key, value] of exampleMap.entries()) {
    if (!serverMapEarly.has(key)) repair[key] = value;
  }
  if (Object.keys(repair).length > 0) {
    upsertEnvKeys(serverEnv, repair);
    console.log(
      "[dev] Merged missing keys from server/.env.example into server/.env"
    );
  }
}

const serverMap = readEnvMap(serverEnv);
const payoutMap = readEnvMap(payoutEnv);

const legacyKey = serverMap.get("NIM_PAYOUT_PRIVATE_KEY") ?? "";
const legacyNetwork = serverMap.get("NIM_NETWORK") ?? "";

const payoutPatch = {};
if (!payoutMap.get("NIM_PAYOUT_PRIVATE_KEY") && legacyKey) {
  payoutPatch.NIM_PAYOUT_PRIVATE_KEY = legacyKey;
  console.log(
    "[dev] Copied NIM_PAYOUT_PRIVATE_KEY from server/.env to payout-service/.env (sidecar signer)."
  );
}
if (legacyNetwork && payoutMap.get("NIM_NETWORK") !== legacyNetwork) {
  payoutPatch.NIM_NETWORK = legacyNetwork;
}

if (Object.keys(payoutPatch).length > 0) {
  upsertEnvKeys(payoutEnv, payoutPatch);
}

const serverPatch = {
  PAYOUT_SERVICE_URL: "http://127.0.0.1:3091",
  PAYOUT_SERVICE_API_SECRET: DEV_PAYOUT_SECRET,
  NIM_PAYOUT_DEV_FAKE_BALANCE: "1",
};
if (upsertEnvKeys(serverEnv, serverPatch)) {
  console.log(
    "[dev] Ensured PAYOUT_SERVICE_* + NIM_PAYOUT_DEV_FAKE_BALANCE on server/.env"
  );
}

if (!legacyKey && !readEnvMap(payoutEnv).get("NIM_PAYOUT_PRIVATE_KEY")) {
  console.log(
    "[dev] NIM_PAYOUT_PRIVATE_KEY unset in payout-service/.env — HUD balance stays empty until a funded wallet is configured."
  );
}
