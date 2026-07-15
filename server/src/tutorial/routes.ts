import type { Express, NextFunction, Request, Response } from "express";

import {
  abandonTutorial,
  getTutorialDoorQuote,
  ackTutorialDoorSent,
  grantTutorialUnlockPad,
  resetTutorialProgress,
  unstickTutorialGate,
} from "../tutorialSessionService.js";
import {
  clearSpentTutorialMineClaimsForWallet,
  refreshTutorialRuntimeLayoutFromTemplate,
} from "../rooms.js";
import { isAdmin } from "../config.js";
import { isTutorialFeatureEnabled, TUTORIAL_ROOM_ID } from "./config.js";
import { TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID } from "../tutorialTemplate/bootstrapShell.js";
import { reseedDefaultTutorialTemplateFromBootstrap } from "../tutorialTemplate/store.js";

type JwtResolver = (req: Request) => string | null;

function normalizeWalletId(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function tutorialDisabled(_req: Request, res: Response): void {
  res.status(404).json({ error: "tutorial_disabled" });
}

export function registerTutorialRoutes(
  app: Express,
  requireJwt: (req: Request, res: Response, next: NextFunction) => void,
  jwtAddressFromReq: JwtResolver
): void {
  app.get("/api/tutorial/door-quote", requireJwt, (req, res) => {
    if (!isTutorialFeatureEnabled()) {
      tutorialDisabled(req, res);
      return;
    }
    const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const quote = getTutorialDoorQuote(signer);
    if (!quote) {
      res.status(503).json({ error: "door_not_configured" });
      return;
    }
    res.json(quote);
  });

  app.post("/api/tutorial/door-sent", requireJwt, (req, res) => {
    if (!isTutorialFeatureEnabled()) {
      tutorialDisabled(req, res);
      return;
    }
    const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const result = ackTutorialDoorSent(signer);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    grantTutorialUnlockPad(
      signer,
      TUTORIAL_ROOM_ID,
      TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID
    );
    res.json({
      ok: true,
      idempotent: result.idempotent,
    });
  });

  app.post("/api/tutorial/unstick", requireJwt, (req, res) => {
    if (!isTutorialFeatureEnabled()) {
      tutorialDisabled(req, res);
      return;
    }
    const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    unstickTutorialGate(signer);
    grantTutorialUnlockPad(
      signer,
      TUTORIAL_ROOM_ID,
      TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID
    );
    res.json({ ok: true });
  });

  app.post("/api/tutorial/abandon", requireJwt, (req, res) => {
    if (!isTutorialFeatureEnabled()) {
      tutorialDisabled(req, res);
      return;
    }
    const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    abandonTutorial(signer);
    res.json({ ok: true });
  });

  app.post("/api/tutorial/reset-progress", requireJwt, (req, res) => {
    if (!isTutorialFeatureEnabled()) {
      tutorialDisabled(req, res);
      return;
    }
    const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
    if (!signer) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    // Own wallet only (jwtAddressFromReq): clears session so the learner can restart at Mine.
    const result = resetTutorialProgress(signer);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    clearSpentTutorialMineClaimsForWallet(signer);
    res.json({ ok: true });
  });

  app.post(
    "/api/admin/tutorial/reload-runtime",
    requireJwt,
    (req, res) => {
      const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
      if (!signer || !isAdmin(signer)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      refreshTutorialRuntimeLayoutFromTemplate();
      res.json({ ok: true });
    }
  );

  /**
   * Admin: copy code bootstrap into the default Tutorial Template, then reload
   * the live Tutorial Room. Prefer this over hand-editing tutorial-templates.json.
   */
  app.post(
    "/api/admin/tutorial/reseed-bootstrap",
    requireJwt,
    (req, res) => {
      const signer = normalizeWalletId(jwtAddressFromReq(req) ?? "");
      if (!signer || !isAdmin(signer)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      if (!isTutorialFeatureEnabled()) {
        tutorialDisabled(req, res);
        return;
      }
      const result = reseedDefaultTutorialTemplateFromBootstrap();
      refreshTutorialRuntimeLayoutFromTemplate();
      res.json({
        ok: true,
        templateId: result.template.id,
        created: result.created,
        runtimeReloaded: true,
      });
    }
  );
}
