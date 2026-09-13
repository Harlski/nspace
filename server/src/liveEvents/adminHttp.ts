import type { Express, NextFunction, Request, Response } from "express";
import { LIVE_EVENT_INTERACTIONS } from "./interactions.js";
import {
  newOperatorMappingId,
  parseOperatorMappingInput,
} from "./operatorMapping.js";
import {
  deleteOperatorMapping,
  getOperatorMapping,
  insertOperatorMapping,
  listOperatorMappings,
  listSeenLiveEventTypes,
  updateOperatorMapping,
} from "./store.js";
import { LIVE_EVENT_TYPE_TEST } from "./types.js";

type AdminGuard = (req: Request, res: Response, next: NextFunction) => void;

export function registerLiveEventAdminRoutes(
  app: Express,
  opts: {
    requireSystemAdminWallet: AdminGuard;
    listRooms: () => Array<{ id: string; displayName: string }>;
    currentRoomId: () => string;
  }
): void {
  app.get(
    "/api/admin/live-events",
    opts.requireSystemAdminWallet,
    (_req, res) => {
      res.json({
        mappings: listOperatorMappings(),
        interactions: LIVE_EVENT_INTERACTIONS,
        seenTypes: listSeenLiveEventTypes(),
        rooms: opts.listRooms(),
        currentRoomId: opts.currentRoomId(),
        builtin: {
          eventType: LIVE_EVENT_TYPE_TEST,
          interactionKind: "live_boost",
          roomTarget: "current",
        },
      });
    }
  );

  app.post(
    "/api/admin/live-events/mappings",
    opts.requireSystemAdminWallet,
    (req, res) => {
      const parsed = parseOperatorMappingInput(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const now = Date.now();
      const mapping = {
        id: newOperatorMappingId(),
        ...parsed.value,
        createdAtMs: now,
        updatedAtMs: now,
      };
      const saved = insertOperatorMapping(mapping);
      if (!saved.ok) {
        res.status(409).json({ error: saved.error });
        return;
      }
      res.status(201).json({ ok: true, mapping: saved.mapping });
    }
  );

  app.put(
    "/api/admin/live-events/mappings/:id",
    opts.requireSystemAdminWallet,
    (req, res) => {
      const id = String(req.params.id ?? "").trim();
      if (!id || !getOperatorMapping(id)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const parsed = parseOperatorMappingInput(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const saved = updateOperatorMapping(id, {
        ...parsed.value,
        updatedAtMs: Date.now(),
      });
      if (!saved.ok) {
        const status = saved.error === "not_found" ? 404 : 409;
        res.status(status).json({ error: saved.error });
        return;
      }
      res.json({ ok: true, mapping: saved.mapping });
    }
  );

  app.delete(
    "/api/admin/live-events/mappings/:id",
    opts.requireSystemAdminWallet,
    (req, res) => {
      const id = String(req.params.id ?? "").trim();
      if (!deleteOperatorMapping(id)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ ok: true });
    }
  );
}
