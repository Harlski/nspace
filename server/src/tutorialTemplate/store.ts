import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildShell } from "../playSpaceTemplate/buildShell.js";
import {
  buildDefaultTutorialBootstrapShell,
  isValidTutorialTemplateSourceRoom,
} from "./bootstrapShell.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.WORLD_STATE_DIR
  ? path.resolve(process.env.WORLD_STATE_DIR)
  : path.join(__dirname, "..", "..", "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "tutorial-templates.json");

export const DEFAULT_TUTORIAL_TEMPLATE_NAME = "Default tutorial";

export type TutorialTemplateRecord = {
  id: string;
  displayName: string;
  description: string;
  archived: boolean;
  isDefault: boolean;
  sourceRoomId: string | null;
  buildShell: BuildShell;
  createdAtMs: number;
  updatedAtMs: number;
  lastSyncedAtMs: number | null;
};

type PersistedTemplatesFile = {
  version: 1;
  templates: TutorialTemplateRecord[];
};

const templatesById = new Map<string, TutorialTemplateRecord>();

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function persistTemplatesFile(): void {
  ensureDataDir();
  const payload: PersistedTemplatesFile = {
    version: 1,
    templates: [...templatesById.values()],
  };
  const tmp = `${TEMPLATES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, TEMPLATES_FILE);
}

export function _resetTutorialTemplateStoreForTests(): void {
  templatesById.clear();
}

export function loadTutorialTemplateStore(): void {
  templatesById.clear();
  if (!fs.existsSync(TEMPLATES_FILE)) return;
  try {
    const raw = JSON.parse(
      fs.readFileSync(TEMPLATES_FILE, "utf8")
    ) as PersistedTemplatesFile;
    if (raw.version !== 1 || !Array.isArray(raw.templates)) return;
    for (const t of raw.templates) {
      if (!t?.id || typeof t.displayName !== "string" || !t.buildShell) continue;
      templatesById.set(t.id, { ...t });
    }
  } catch (e) {
    console.error("[tutorial-templates] failed to load store", e);
  }
}

export function bootstrapDefaultTutorialTemplateIfEmpty(nowMs = Date.now()): void {
  if (templatesById.size > 0) return;
  const id = crypto.randomUUID();
  templatesById.set(id, {
    id,
    displayName: DEFAULT_TUTORIAL_TEMPLATE_NAME,
    description: "Auto-created bootstrap tutorial layout.",
    archived: false,
    isDefault: true,
    sourceRoomId: null,
    buildShell: buildDefaultTutorialBootstrapShell(),
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    lastSyncedAtMs: null,
  });
  persistTemplatesFile();
}

export function initTutorialTemplateStore(): void {
  loadTutorialTemplateStore();
  bootstrapDefaultTutorialTemplateIfEmpty();
}

export function listTutorialTemplates(opts?: {
  includeArchived?: boolean;
}): TutorialTemplateRecord[] {
  const out = [...templatesById.values()];
  if (!opts?.includeArchived) return out.filter((t) => !t.archived);
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getTutorialTemplate(id: string): TutorialTemplateRecord | null {
  return templatesById.get(id) ?? null;
}

export function getDefaultTutorialTemplate(): TutorialTemplateRecord | null {
  for (const t of templatesById.values()) {
    if (t.isDefault && !t.archived) return t;
  }
  for (const t of templatesById.values()) {
    if (!t.archived) return t;
  }
  return null;
}

export function createTutorialTemplate(input: {
  displayName: string;
  description?: string;
  sourceRoomId: string;
  buildShell: BuildShell;
  nowMs?: number;
}): { ok: true; template: TutorialTemplateRecord } | { ok: false; reason: string } {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, reason: "Template name is required." };
  if (!isValidTutorialTemplateSourceRoom(input.sourceRoomId)) {
    return { ok: false, reason: "Invalid template source room." };
  }
  const nowMs = input.nowMs ?? Date.now();
  const id = crypto.randomUUID();
  const template: TutorialTemplateRecord = {
    id,
    displayName,
    description: input.description?.trim() ?? "",
    archived: false,
    isDefault: false,
    sourceRoomId: input.sourceRoomId.trim(),
    buildShell: input.buildShell,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    lastSyncedAtMs: nowMs,
  };
  templatesById.set(id, template);
  persistTemplatesFile();
  return { ok: true, template };
}

export function setDefaultTutorialTemplate(
  id: string
): { ok: true; template: TutorialTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  if (t.archived) return { ok: false, reason: "Archived templates cannot be default." };
  for (const other of templatesById.values()) {
    other.isDefault = other.id === id;
  }
  t.updatedAtMs = Date.now();
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function resyncTutorialTemplate(
  id: string,
  buildShell: BuildShell
): { ok: true; template: TutorialTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  const nowMs = Date.now();
  t.buildShell = buildShell;
  t.updatedAtMs = nowMs;
  t.lastSyncedAtMs = nowMs;
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function applyDefaultTutorialTemplateToRuntimeShell(): BuildShell {
  const d = getDefaultTutorialTemplate();
  return d?.buildShell ?? buildDefaultTutorialBootstrapShell();
}

export function wireTutorialTemplateForTests(template: TutorialTemplateRecord): void {
  templatesById.set(template.id, template);
}
