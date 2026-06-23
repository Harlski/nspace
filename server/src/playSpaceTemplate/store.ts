import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isInviteLobbyRoomId } from "../directInvite/config.js";
import {
  type BuildShell,
  buildShellFromLegacyPlaySpaceLayout,
} from "./buildShell.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.WORLD_STATE_DIR
  ? path.resolve(process.env.WORLD_STATE_DIR)
  : path.join(__dirname, "..", "..", "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "play-space-templates.json");

export const DEFAULT_TEMPLATE_DISPLAY_NAME = "Default lounge";

export type PlaySpaceTemplateRecord = {
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
  templates: PlaySpaceTemplateRecord[];
};

const templatesById = new Map<string, PlaySpaceTemplateRecord>();

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

export function _resetPlaySpaceTemplateStoreForTests(): void {
  templatesById.clear();
}

export function loadPlaySpaceTemplateStore(): void {
  templatesById.clear();
  if (!fs.existsSync(TEMPLATES_FILE)) return;
  try {
    const raw = JSON.parse(
      fs.readFileSync(TEMPLATES_FILE, "utf8")
    ) as PersistedTemplatesFile;
    if (raw.version !== 1 || !Array.isArray(raw.templates)) return;
    for (const t of raw.templates) {
      if (!t?.id || typeof t.displayName !== "string" || !t.buildShell) continue;
      templatesById.set(t.id, {
        id: t.id,
        displayName: t.displayName.trim(),
        description: typeof t.description === "string" ? t.description : "",
        archived: t.archived === true,
        isDefault: t.isDefault === true,
        sourceRoomId:
          typeof t.sourceRoomId === "string" && t.sourceRoomId.trim()
            ? t.sourceRoomId.trim()
            : null,
        buildShell: t.buildShell,
        createdAtMs: t.createdAtMs,
        updatedAtMs: t.updatedAtMs,
        lastSyncedAtMs:
          typeof t.lastSyncedAtMs === "number" ? t.lastSyncedAtMs : null,
      });
    }
  } catch (e) {
    console.error("[play-space-templates] failed to load store", e);
  }
}

export function bootstrapDefaultPlaySpaceTemplateIfEmpty(nowMs = Date.now()): void {
  if (templatesById.size > 0) return;
  const id = crypto.randomUUID();
  const shell = buildShellFromLegacyPlaySpaceLayout();
  templatesById.set(id, {
    id,
    displayName: DEFAULT_TEMPLATE_DISPLAY_NAME,
    description: "Auto-created from the legacy Play Space lounge layout.",
    archived: false,
    isDefault: true,
    sourceRoomId: null,
    buildShell: shell,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    lastSyncedAtMs: null,
  });
  persistTemplatesFile();
}

export function initPlaySpaceTemplateStore(): void {
  loadPlaySpaceTemplateStore();
  bootstrapDefaultPlaySpaceTemplateIfEmpty();
}

export function listPlaySpaceTemplates(opts?: {
  includeArchived?: boolean;
}): PlaySpaceTemplateRecord[] {
  const out = [...templatesById.values()];
  if (!opts?.includeArchived) {
    return out.filter((t) => !t.archived);
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getPlaySpaceTemplate(id: string): PlaySpaceTemplateRecord | null {
  return templatesById.get(id) ?? null;
}

export function getDefaultPlaySpaceTemplate(): PlaySpaceTemplateRecord | null {
  for (const t of templatesById.values()) {
    if (t.isDefault && !t.archived) return t;
  }
  for (const t of templatesById.values()) {
    if (!t.archived) return t;
  }
  return null;
}

export function resolveTemplateIdForPlaySpaceCreate(
  isAdmin: boolean,
  requestedTemplateId: string | undefined
): { ok: true; templateId: string } | { ok: false; reason: string } {
  if (isAdmin && requestedTemplateId) {
    const t = getPlaySpaceTemplate(requestedTemplateId);
    if (!t) return { ok: false, reason: "Template not found." };
    if (t.archived) return { ok: false, reason: "Template is archived." };
    return { ok: true, templateId: t.id };
  }
  const d = getDefaultPlaySpaceTemplate();
  if (!d) {
    return { ok: false, reason: "No default Play Space template configured." };
  }
  return { ok: true, templateId: d.id };
}

export function isValidPlaySpaceTemplateSourceRoom(roomId: string): boolean {
  const id = roomId.trim();
  if (!id || isInviteLobbyRoomId(id)) return false;
  if (id.includes("match-pitch")) return false;
  return true;
}

export function isTemplateSourceRoomAvailable(
  sourceRoomId: string | null,
  roomExists: (roomId: string) => boolean
): boolean {
  if (!sourceRoomId) return false;
  return roomExists(sourceRoomId);
}

export function createPlaySpaceTemplate(input: {
  displayName: string;
  description?: string;
  sourceRoomId: string;
  buildShell: BuildShell;
  nowMs?: number;
}): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, reason: "Template name is required." };
  if (!isValidPlaySpaceTemplateSourceRoom(input.sourceRoomId)) {
    return { ok: false, reason: "Invalid template source room." };
  }
  const nowMs = input.nowMs ?? Date.now();
  const id = crypto.randomUUID();
  const template: PlaySpaceTemplateRecord = {
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

export function updatePlaySpaceTemplateMetadata(
  id: string,
  patch: { displayName?: string; description?: string }
): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (!name) return { ok: false, reason: "Template name is required." };
    t.displayName = name;
  }
  if (patch.description !== undefined) {
    t.description = patch.description.trim();
  }
  t.updatedAtMs = Date.now();
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function setDefaultPlaySpaceTemplate(
  id: string
): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
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

export function setPlaySpaceTemplateArchived(
  id: string,
  archived: boolean
): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  t.archived = archived;
  if (archived && t.isDefault) {
    t.isDefault = false;
    const fallback = [...templatesById.values()].find((x) => !x.archived && x.id !== id);
    if (fallback) fallback.isDefault = true;
  }
  t.updatedAtMs = Date.now();
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function reassignPlaySpaceTemplateSource(
  id: string,
  sourceRoomId: string
): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  if (!isValidPlaySpaceTemplateSourceRoom(sourceRoomId)) {
    return { ok: false, reason: "Invalid template source room." };
  }
  t.sourceRoomId = sourceRoomId.trim();
  t.updatedAtMs = Date.now();
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function resyncPlaySpaceTemplate(
  id: string,
  buildShell: BuildShell,
  sourceAvailable: boolean
): { ok: true; template: PlaySpaceTemplateRecord } | { ok: false; reason: string } {
  const t = templatesById.get(id);
  if (!t) return { ok: false, reason: "Template not found." };
  if (!sourceAvailable || !t.sourceRoomId) {
    return { ok: false, reason: "Template source room is unavailable." };
  }
  const nowMs = Date.now();
  t.buildShell = buildShell;
  t.updatedAtMs = nowMs;
  t.lastSyncedAtMs = nowMs;
  persistTemplatesFile();
  return { ok: true, template: t };
}

export function wireTemplateForTests(template: PlaySpaceTemplateRecord): void {
  templatesById.set(template.id, template);
}
