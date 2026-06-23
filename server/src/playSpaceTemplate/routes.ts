import type { Request, Response } from "express";

import { hasRoom, normalizeRoomId } from "../roomLayouts.js";
import { extractBuildShellForPlaySpaceTemplate } from "../rooms.js";
import {
  createPlaySpaceTemplate,
  getPlaySpaceTemplate,
  isTemplateSourceRoomAvailable,
  isValidPlaySpaceTemplateSourceRoom,
  listPlaySpaceTemplates,
  reassignPlaySpaceTemplateSource,
  resyncPlaySpaceTemplate,
  setDefaultPlaySpaceTemplate,
  setPlaySpaceTemplateArchived,
  updatePlaySpaceTemplateMetadata,
} from "./store.js";
import type { PlaySpaceTemplateRecord } from "./store.js";

function templateWire(t: PlaySpaceTemplateRecord) {
  const sourceAvailable = isTemplateSourceRoomAvailable(
    t.sourceRoomId,
    (roomId) => hasRoom(normalizeRoomId(roomId))
  );
  return {
    id: t.id,
    displayName: t.displayName,
    description: t.description,
    archived: t.archived,
    isDefault: t.isDefault,
    sourceRoomId: t.sourceRoomId,
    sourceAvailable,
    createdAtMs: t.createdAtMs,
    updatedAtMs: t.updatedAtMs,
    lastSyncedAtMs: t.lastSyncedAtMs,
  };
}

export function registerPlaySpaceTemplateAdminRoutes(
  app: import("express").Express,
  requireSystemAdmin: (
    req: Request,
    res: Response,
    next: import("express").NextFunction
  ) => void
): void {
  app.get("/api/admin/play-space-templates", requireSystemAdmin, (req, res) => {
    const includeArchived = req.query.includeArchived === "1";
    const templates = listPlaySpaceTemplates({ includeArchived }).map(templateWire);
    res.json({ templates });
  });

  app.post("/api/admin/play-space-templates", requireSystemAdmin, (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sourceRoomId = String(body.sourceRoomId ?? "").trim();
    const displayName = String(body.displayName ?? "").trim();
    const description =
      typeof body.description === "string" ? body.description : undefined;
    if (!isValidPlaySpaceTemplateSourceRoom(sourceRoomId)) {
      res.status(400).json({ error: "invalid_source_room" });
      return;
    }
    if (!hasRoom(normalizeRoomId(sourceRoomId))) {
      res.status(404).json({ error: "source_room_not_found" });
      return;
    }
    const shell = extractBuildShellForPlaySpaceTemplate(sourceRoomId);
    if (!shell) {
      res.status(400).json({ error: "source_not_snapshotable" });
      return;
    }
    const created = createPlaySpaceTemplate({
      displayName,
      description,
      sourceRoomId,
      buildShell: shell,
    });
    if (!created.ok) {
      res.status(400).json({ error: "create_failed", message: created.reason });
      return;
    }
    res.status(201).json({ template: templateWire(created.template) });
  });

  app.get("/api/admin/play-space-templates/:id", requireSystemAdmin, (req, res) => {
    const t = getPlaySpaceTemplate(String(req.params.id ?? ""));
    if (!t) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ template: templateWire(t), buildShell: t.buildShell });
  });

  app.patch("/api/admin/play-space-templates/:id", requireSystemAdmin, (req, res) => {
    const id = String(req.params.id ?? "");
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.setDefault === true) {
      const set = setDefaultPlaySpaceTemplate(id);
      if (!set.ok) {
        res.status(400).json({ error: "set_default_failed", message: set.reason });
        return;
      }
      res.json({ template: templateWire(set.template) });
      return;
    }
    if (body.archived === true || body.archived === false) {
      const archived = setPlaySpaceTemplateArchived(id, body.archived === true);
      if (!archived.ok) {
        res.status(400).json({ error: "archive_failed", message: archived.reason });
        return;
      }
      res.json({ template: templateWire(archived.template) });
      return;
    }
    if (typeof body.reassignSourceRoomId === "string") {
      const nextSource = body.reassignSourceRoomId.trim();
      if (!hasRoom(normalizeRoomId(nextSource))) {
        res.status(404).json({ error: "source_room_not_found" });
        return;
      }
      const reassigned = reassignPlaySpaceTemplateSource(id, nextSource);
      if (!reassigned.ok) {
        res.status(400).json({ error: "reassign_failed", message: reassigned.reason });
        return;
      }
      res.json({ template: templateWire(reassigned.template) });
      return;
    }
    const updated = updatePlaySpaceTemplateMetadata(id, {
      displayName:
        typeof body.displayName === "string" ? body.displayName : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
    });
    if (!updated.ok) {
      res.status(400).json({ error: "update_failed", message: updated.reason });
      return;
    }
    res.json({ template: templateWire(updated.template) });
  });

  app.post(
    "/api/admin/play-space-templates/:id/resync",
    requireSystemAdmin,
    (req, res) => {
      const id = String(req.params.id ?? "");
      const t = getPlaySpaceTemplate(id);
      if (!t) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (!t.sourceRoomId) {
        res.status(409).json({ error: "source_unavailable" });
        return;
      }
      const sourceAvailable = isTemplateSourceRoomAvailable(
        t.sourceRoomId,
        (roomId) => hasRoom(normalizeRoomId(roomId))
      );
      if (!sourceAvailable) {
        res.status(409).json({ error: "source_unavailable" });
        return;
      }
      const shell = extractBuildShellForPlaySpaceTemplate(t.sourceRoomId);
      if (!shell) {
        res.status(400).json({ error: "source_not_snapshotable" });
        return;
      }
      const synced = resyncPlaySpaceTemplate(id, shell, true);
      if (!synced.ok) {
        res.status(409).json({ error: "resync_failed", message: synced.reason });
        return;
      }
      res.json({ template: templateWire(synced.template) });
    }
  );
}

export { resolveTemplateIdForPlaySpaceCreate } from "./store.js";
