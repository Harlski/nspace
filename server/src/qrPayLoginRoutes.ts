import type { Express, Request, Response } from "express";

import {
  createQrPayLoginTicket,
  expectedLoginMessageForTicket,
  fulfillQrPayLoginTicket,
  getQrPayLoginChallenge,
  getQrPayLoginTicket,
  pollQrPayLoginTicket,
} from "./qrPayLogin.js";
import {
  issueWalletSessionFromSignedLogin,
  type WalletLoginVerifyBody,
} from "./walletLoginSession.js";

export type QrPayLoginRouteDeps = {
  jwtSecret: string;
  publicBaseUrl: string;
  devAuthBypass: boolean;
};

export function registerQrPayLoginRoutes(app: Express, deps: QrPayLoginRouteDeps): void {
  /** Desktop: create a short-lived QR login ticket (claim secret stays on this device). */
  app.post("/api/auth/qr-login", (_req: Request, res: Response) => {
    const created = createQrPayLoginTicket(deps.publicBaseUrl);
    res.json(created);
  });

  /** Phone: public challenge (nonce + message). Never returns JWT or claim secret. */
  app.get("/api/auth/qr-login/:ticketId/challenge", (req: Request, res: Response) => {
    const ticketId = String(req.params.ticketId ?? "");
    res.json(getQrPayLoginChallenge(ticketId));
  });

  /**
   * Desktop poll. Requires `claimSecret` (query or JSON body). Fulfilled tickets return the
   * session once and are consumed.
   */
  app.get("/api/auth/qr-login/:ticketId", (req: Request, res: Response) => {
    const ticketId = String(req.params.ticketId ?? "");
    const claimSecret = String(req.query.claimSecret ?? "");
    const result = pollQrPayLoginTicket(ticketId, claimSecret);
    if (result.status === "forbidden") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (result.status === "expired") {
      res.status(410).json({ status: "expired" });
      return;
    }
    if (result.status === "pending") {
      res.json({ status: "pending", expiresAt: result.expiresAt });
      return;
    }
    res.json({
      status: "fulfilled",
      token: result.session.token,
      address: result.session.address,
      nimiqPay: result.session.nimiqPay,
      usernamePrompt: result.session.usernamePrompt,
      tutorial: result.session.tutorial,
    });
  });

  /** Phone: sign `Login:v1:{nonce}` in Nimiq Pay and attach the JWT to the ticket for desktop. */
  app.post("/api/auth/qr-login/:ticketId/complete", async (req: Request, res: Response) => {
    const ticketId = String(req.params.ticketId ?? "");
    const ticket = getQrPayLoginTicket(ticketId);
    if (!ticket) {
      res.status(410).json({ error: "expired" });
      return;
    }
    if (ticket.expiresAt < Date.now()) {
      res.status(410).json({ error: "expired" });
      return;
    }
    if (ticket.status === "fulfilled") {
      res.status(409).json({ error: "already_fulfilled" });
      return;
    }

    const body = req.body as WalletLoginVerifyBody;
    const issued = await issueWalletSessionFromSignedLogin({
      expectedMessage: expectedLoginMessageForTicket(ticket),
      body,
      jwtSecret: deps.jwtSecret,
      devAuthBypass: deps.devAuthBypass,
    });
    if (!issued.ok) {
      res.status(issued.status).json(issued.body);
      return;
    }

    const fulfilled = fulfillQrPayLoginTicket(ticketId, {
      token: issued.token,
      address: issued.address,
      nimiqPay: issued.nimiqPay,
      usernamePrompt: issued.usernamePrompt,
      tutorial: issued.tutorial,
    });
    if (!fulfilled.ok) {
      const status =
        fulfilled.error === "expired"
          ? 410
          : fulfilled.error === "already_fulfilled"
            ? 409
            : 404;
      res.status(status).json({ error: fulfilled.error });
      return;
    }

    res.json({
      ok: true,
      address: issued.address,
      nimiqPay: issued.nimiqPay,
    });
  });
}
