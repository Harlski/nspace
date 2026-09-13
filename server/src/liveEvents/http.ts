import type { Express, NextFunction, Request, Response } from "express";
import { isGuestSession, type SessionPayload } from "../auth.js";
import { isLiveEventWallet, liveEventAllowlistConfigured } from "./allowlist.js";
import { acceptLiveEvent } from "./receive.js";
import type { WorldEffect } from "./types.js";

type SessionResolver = (req: Request) => SessionPayload | null;

export function registerLiveEventRoutes(
  app: Express,
  opts: {
    requireJwt: (req: Request, res: Response, next: NextFunction) => void;
    jwtSessionFromReq: SessionResolver;
    onWorldEffect: (effect: WorldEffect) => void;
  }
): void {
  app.post("/api/live-events", opts.requireJwt, (req, res) => {
    const session = opts.jwtSessionFromReq(req);
    if (!session) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (isGuestSession(session)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (!liveEventAllowlistConfigured() || !isLiveEventWallet(session.sub)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    let result: ReturnType<typeof acceptLiveEvent>;
    try {
      result = acceptLiveEvent(req.body);
    } catch (err) {
      console.error("[live-events] persist failed", err);
      res.status(500).json({ error: "internal" });
      return;
    }
    if (!result.ok) {
      res.status(400).json({ error: "invalid_body", detail: result.detail });
      return;
    }
    if (result.duplicate) {
      res.status(409).json({ ok: true, duplicate: true });
      return;
    }
    if (result.effect) {
      try {
        opts.onWorldEffect(result.effect);
      } catch (err) {
        console.error("[live-events] World Effect apply failed", err);
      }
      res.status(200).json({
        ok: true,
        duplicate: false,
        effect: {
          kind: result.effect.kind,
          earnMultiplier: result.effect.earnMultiplier,
          untilMs: result.effect.untilMs,
        },
      });
      return;
    }
    res.status(200).json({ ok: true, duplicate: false, ignored: true });
  });
}
