import type { Express, NextFunction, Request, Response } from "express";

import {
  abandonTutorial,
  getTutorialDoorQuote,
  ackTutorialDoorSent,
  grantTutorialUnlockPad,
  unstickTutorialGate,
} from "../tutorialSessionService.js";
import { refreshTutorialRuntimeLayoutFromTemplate, tutorialHubExitDoorForWallet } from "../rooms.js";
import { isAdmin } from "../config.js";
import { isTutorialFeatureEnabled, TUTORIAL_ROOM_ID } from "./config.js";
import { TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID } from "../tutorialTemplate/bootstrapShell.js";

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
    const hubExitDoor = tutorialHubExitDoorForWallet(signer);
    res.json({
      ok: true,
      idempotent: result.idempotent,
      ...(hubExitDoor ? { hubExitDoor } : {}),
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
}
