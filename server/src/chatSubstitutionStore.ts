import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Same cap as public chat lines in rooms.ts. */
export const CHAT_SUBSTITUTION_MAX_LEN = 256;

export const CHAT_SUBSTITUTION_BEDWET_JOKE = "I wet the bed and I can't stop.";

export type ChatSubstitution = {
  id: string;
  trigger: string;
  replacement: string;
  enabled: boolean;
};

export type ChatSubstitutionApplyResult = {
  text: string;
  substitutedFrom: string | null;
};

export type ChatSubstitutionStoreError =
  | "empty_trigger"
  | "empty_replacement"
  | "duplicate_trigger"
  | "not_found";

export type ChatSubstitutionStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ChatSubstitutionStoreError };

const DEFAULT_SUBSTITUTIONS: ChatSubstitution[] = [
  {
    id: "seed-ascii-i",
    trigger: ".I.",
    replacement: CHAT_SUBSTITUTION_BEDWET_JOKE,
    enabled: true,
  },
  {
    id: "seed-dotless-i",
    trigger: ".ı.",
    replacement: CHAT_SUBSTITUTION_BEDWET_JOKE,
    enabled: true,
  },
  {
    id: "seed-dotted-i",
    trigger: ".İ.",
    replacement: CHAT_SUBSTITUTION_BEDWET_JOKE,
    enabled: true,
  },
];

type StoreFile = { substitutions: ChatSubstitution[] };

function storeFilePath(): string {
  return process.env.CHAT_SUBSTITUTION_STORE_FILE
    ? path.resolve(process.env.CHAT_SUBSTITUTION_STORE_FILE)
    : path.join(__dirname, "..", "data", "chat-substitutions.json");
}

function ensureDir(): void {
  const dir = path.dirname(storeFilePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizeChatField(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, CHAT_SUBSTITUTION_MAX_LEN);
}

function parseSubstitution(raw: unknown): ChatSubstitution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const trigger = sanitizeChatField(String(o.trigger ?? ""));
  const replacement = sanitizeChatField(String(o.replacement ?? ""));
  if (!id || !trigger || !replacement) return null;
  return {
    id,
    trigger,
    replacement,
    enabled: o.enabled === undefined ? true : Boolean(o.enabled),
  };
}

function cloneList(list: ChatSubstitution[]): ChatSubstitution[] {
  return list.map((s) => ({ ...s }));
}

let mem: { path: string; substitutions: ChatSubstitution[] } | null = null;

function remember(file: string, substitutions: ChatSubstitution[]): void {
  mem = { path: file, substitutions: cloneList(substitutions) };
}

function readStore(): StoreFile {
  const file = storeFilePath();
  if (mem && mem.path === file) {
    return { substitutions: cloneList(mem.substitutions) };
  }
  if (!fs.existsSync(file)) {
    const seeded: StoreFile = { substitutions: cloneList(DEFAULT_SUBSTITUTIONS) };
    writeStore(seeded);
    return seeded;
  }
  try {
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") {
      const seeded: StoreFile = { substitutions: cloneList(DEFAULT_SUBSTITUTIONS) };
      writeStore(seeded);
      return seeded;
    }
    const arr = (j as Record<string, unknown>).substitutions;
    if (!Array.isArray(arr)) {
      const seeded: StoreFile = { substitutions: cloneList(DEFAULT_SUBSTITUTIONS) };
      writeStore(seeded);
      return seeded;
    }
    const substitutions: ChatSubstitution[] = [];
    const seenIds = new Set<string>();
    const seenTriggers = new Set<string>();
    for (const item of arr) {
      const row = parseSubstitution(item);
      if (!row) continue;
      if (seenIds.has(row.id) || seenTriggers.has(row.trigger)) continue;
      seenIds.add(row.id);
      seenTriggers.add(row.trigger);
      substitutions.push(row);
    }
    remember(file, substitutions);
    return { substitutions };
  } catch {
    const seeded: StoreFile = { substitutions: cloneList(DEFAULT_SUBSTITUTIONS) };
    writeStore(seeded);
    return seeded;
  }
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const file = storeFilePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, file);
  remember(file, data.substitutions);
}

export function applyChatSubstitution(
  trimmedText: string,
  substitutions: readonly ChatSubstitution[]
): ChatSubstitutionApplyResult {
  for (const rule of substitutions) {
    if (!rule.enabled) continue;
    if (rule.trigger === trimmedText) {
      return { text: rule.replacement, substitutedFrom: trimmedText };
    }
  }
  return { text: trimmedText, substitutedFrom: null };
}

export function listChatSubstitutions(): ChatSubstitution[] {
  return cloneList(readStore().substitutions);
}

export function applyStoredChatSubstitution(
  trimmedText: string
): ChatSubstitutionApplyResult {
  return applyChatSubstitution(trimmedText, listChatSubstitutions());
}

export function addChatSubstitution(input: {
  trigger: string;
  replacement: string;
  enabled?: boolean;
}): ChatSubstitutionStoreResult<ChatSubstitution> {
  const trigger = sanitizeChatField(input.trigger);
  const replacement = sanitizeChatField(input.replacement);
  if (!trigger) return { ok: false, error: "empty_trigger" };
  if (!replacement) return { ok: false, error: "empty_replacement" };
  const cur = readStore();
  if (cur.substitutions.some((s) => s.trigger === trigger)) {
    return { ok: false, error: "duplicate_trigger" };
  }
  const row: ChatSubstitution = {
    id: randomUUID(),
    trigger,
    replacement,
    enabled: input.enabled === undefined ? true : Boolean(input.enabled),
  };
  cur.substitutions.push(row);
  writeStore(cur);
  return { ok: true, value: { ...row } };
}

export function patchChatSubstitution(
  id: string,
  patch: { trigger?: string; replacement?: string; enabled?: boolean }
): ChatSubstitutionStoreResult<ChatSubstitution> {
  const key = String(id ?? "").trim();
  const cur = readStore();
  const idx = cur.substitutions.findIndex((s) => s.id === key);
  if (idx < 0) return { ok: false, error: "not_found" };
  const next: ChatSubstitution = { ...cur.substitutions[idx]! };
  if (patch.trigger !== undefined) {
    const trigger = sanitizeChatField(patch.trigger);
    if (!trigger) return { ok: false, error: "empty_trigger" };
    next.trigger = trigger;
  }
  if (patch.replacement !== undefined) {
    const replacement = sanitizeChatField(patch.replacement);
    if (!replacement) return { ok: false, error: "empty_replacement" };
    next.replacement = replacement;
  }
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (
    cur.substitutions.some((s, i) => i !== idx && s.trigger === next.trigger)
  ) {
    return { ok: false, error: "duplicate_trigger" };
  }
  cur.substitutions[idx] = next;
  writeStore(cur);
  return { ok: true, value: { ...next } };
}

export function removeChatSubstitution(
  id: string
): ChatSubstitutionStoreResult<true> {
  const key = String(id ?? "").trim();
  const cur = readStore();
  const idx = cur.substitutions.findIndex((s) => s.id === key);
  if (idx < 0) return { ok: false, error: "not_found" };
  cur.substitutions.splice(idx, 1);
  writeStore(cur);
  return { ok: true, value: true };
}
