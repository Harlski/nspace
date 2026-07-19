"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const payoutExample = path.join(root, "payout-service", ".env.example");
const payoutEnv = path.join(root, "payout-service", ".env");
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

function writeEnvMap(filePath, map) {
  const lines = [];
  for (const [key, value] of map.entries()) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function upsertEnvKeys(filePath, patch) {
  const map = readEnvMap(filePath);
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") continue;
    const cur = map.get(key);
    if (cur !== value) {
      map.set(key, value);
      changed = true;
    }
  }
  if (changed) writeEnvMap(filePath, map);
  return changed;
}

if (!fs.existsSync(payoutEnv) && fs.existsSync(payoutExample)) {
  fs.copyFileSync(payoutExample, payoutEnv);
  console.log("[dev] Created payout-service/.env from .env.example");
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
