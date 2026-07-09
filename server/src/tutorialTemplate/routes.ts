import type { Request, Response } from "express";

import { hasRoom, normalizeRoomId } from "../roomLayouts.js";
import { extractBuildShellForTutorialTemplate } from "../rooms.js";
import { TUTORIAL_STAGING_ROOM_ID } from "../tutorial/config.js";
import {
  createTutorialTemplate,
  getDefaultTutorialTemplate,
  getTutorialTemplate,
  listTutorialTemplates,
  resyncTutorialTemplate,
  setDefaultTutorialTemplate,
  type TutorialTemplateRecord,
} from "./store.js";

function templateWire(t: TutorialTemplateRecord) {
  return {
    id: t.id,
    displayName: t.displayName,
    description: t.description,
    archived: t.archived,
    isDefault: t.isDefault,
    sourceRoomId: t.sourceRoomId,
    sourceAvailable: Boolean(
      t.sourceRoomId && hasRoom(normalizeRoomId(t.sourceRoomId))
    ),
    createdAtMs: t.createdAtMs,
    updatedAtMs: t.updatedAtMs,
    lastSyncedAtMs: t.lastSyncedAtMs,
  };
}

export function registerTutorialTemplateAdminRoutes(
  app: import("express").Express,
  requireSystemAdmin: (
    req: Request,
    res: Response,
    next: import("express").NextFunction
  ) => void
): void {
  app.get("/api/admin/tutorial-templates", requireSystemAdmin, (_req, res) => {
    res.json({ templates: listTutorialTemplates().map(templateWire) });
  });

  app.post("/api/admin/tutorial-templates", requireSystemAdmin, (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const displayName = String(body.displayName ?? "").trim();
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const sourceRoomId = TUTORIAL_STAGING_ROOM_ID;
    if (!hasRoom(sourceRoomId)) {
      res.status(404).json({ error: "staging_room_not_found" });
      return;
    }
    const shell = extractBuildShellForTutorialTemplate(sourceRoomId);
    if (!shell) {
      res.status(400).json({ error: "source_not_snapshotable" });
      return;
    }
    const created = createTutorialTemplate({
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

  app.post(
    "/api/admin/tutorial-templates/:id/sync",
    requireSystemAdmin,
    (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const t = getTutorialTemplate(id);
      if (!t) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const sourceRoomId = t.sourceRoomId ?? TUTORIAL_STAGING_ROOM_ID;
      const shell = extractBuildShellForTutorialTemplate(sourceRoomId);
      if (!shell) {
        res.status(400).json({ error: "source_not_snapshotable" });
        return;
      }
      const synced = resyncTutorialTemplate(id, shell);
      if (!synced.ok) {
        res.status(400).json({ error: "sync_failed", message: synced.reason });
        return;
      }
      res.json({ template: templateWire(synced.template) });
    }
  );

  app.post(
    "/api/admin/tutorial-templates/:id/default",
    requireSystemAdmin,
    (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const result = setDefaultTutorialTemplate(id);
      if (!result.ok) {
        res.status(400).json({ error: "set_default_failed", message: result.reason });
        return;
      }
      res.json({ template: templateWire(result.template) });
    }
  );

  app.get("/api/admin/tutorial-templates/default", requireSystemAdmin, (_req, res) => {
    const d = getDefaultTutorialTemplate();
    if (!d) {
      res.status(404).json({ error: "no_default" });
      return;
    }
    res.json({ template: templateWire(d) });
  });
}
