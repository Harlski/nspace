import type { Express, NextFunction, Request, Response } from "express";
import { isGuestSession, verifySession } from "../auth.js";
import { compactWalletKey } from "../walletAddresses.js";
import { RETURN_WALK_DEPOSIT_NIM } from "./constants.js";
import {
  getServerWalletAddress,
  isResidentWallet,
} from "./config.js";
import { invoiceToPublicJson } from "./invoiceJson.js";
import {
  createUnpaidInvoice,
  creditInvoice,
  findInvoiceByTxHash,
  getInvoice,
} from "./store.js";
import {
  depositMatchesInvoice,
  fetchDepositTx,
} from "./creditVerify.js";
import { getReturnWalkWorld } from "./world.js";

type JwtResolver = (req: Request) => string | null;

function jsonForbidden(res: Response): void {
  res.status(403).json({ error: "forbidden" });
}

function requireResident(
  req: Request,
  res: Response,
  jwtAddressFromReq: JwtResolver,
  jwtSecret: string
): string | null {
  const addr = jwtAddressFromReq(req);
  if (!addr) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const token = String(req.headers.authorization ?? "");
  const m = token.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) {
    try {
      const payload = verifySession(m[1].trim(), jwtSecret);
      if (isGuestSession(payload)) {
        jsonForbidden(res);
        return null;
      }
    } catch {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }
  }
  if (!isResidentWallet(addr)) {
    jsonForbidden(res);
    return null;
  }
  return compactWalletKey(addr);
}

export function registerReturnWalkRoutes(
  app: Express,
  requireJwt: (req: Request, res: Response, next: NextFunction) => void,
  jwtAddressFromReq: JwtResolver,
  jwtSecret: string
): void {
  app.post(
    "/api/resident/return-walk/invoices",
    requireJwt,
    (req, res) => {
      const wallet = requireResident(req, res, jwtAddressFromReq, jwtSecret);
      if (!wallet) return;
      const amountNim = Number((req.body as { amountNim?: unknown })?.amountNim);
      if (amountNim !== RETURN_WALK_DEPOSIT_NIM) {
        res.status(400).json({ error: "invalid_amount" });
        return;
      }
      const to = getServerWalletAddress();
      if (!to) {
        res.status(503).json({ error: "server_wallet_not_configured" });
        return;
      }
      const created = createUnpaidInvoice({
        residentWallet: wallet,
        toAddress: to,
      });
      if ("error" in created) {
        res.status(409).json({ error: "unpaid_invoice_exists" });
        return;
      }
      res.json(invoiceToPublicJson(created));
    }
  );

  app.get(
    "/api/resident/return-walk/invoices/:invoiceId",
    requireJwt,
    (req, res) => {
      const wallet = requireResident(req, res, jwtAddressFromReq, jwtSecret);
      if (!wallet) return;
      const invoiceId = String(req.params.invoiceId ?? "");
      const row = getInvoice(invoiceId);
      if (!row || compactWalletKey(row.residentWallet) !== wallet) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(invoiceToPublicJson(row));
    }
  );

  app.post(
    "/api/resident/return-walk/invoices/:invoiceId/tx",
    requireJwt,
    async (req, res) => {
      const wallet = requireResident(req, res, jwtAddressFromReq, jwtSecret);
      if (!wallet) return;
      const invoiceId = String(req.params.invoiceId ?? "");
      const row = getInvoice(invoiceId);
      if (!row || compactWalletKey(row.residentWallet) !== wallet) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (row.status === "credited") {
        res.json(invoiceToPublicJson(row));
        return;
      }
      if (row.status !== "unpaid") {
        res.status(409).json({ error: "invoice_not_unpaid" });
        return;
      }
      const txHash = String(
        (req.body as { txHash?: unknown })?.txHash ?? ""
      ).trim();
      if (!txHash) {
        res.status(400).json({ error: "tx_hash_required" });
        return;
      }
      const already = findInvoiceByTxHash(txHash);
      if (already) {
        res.json(invoiceToPublicJson(already));
        return;
      }
      const tx = await fetchDepositTx(txHash);
      if (!tx) {
        res.status(404).json({ error: "tx_not_found" });
        return;
      }
      if (
        !depositMatchesInvoice({
          tx,
          toAddress: row.toAddress,
          residentWallet: row.residentWallet,
        })
      ) {
        res.status(400).json({ error: "tx_mismatch" });
        return;
      }
      const credited = creditInvoice({ invoiceId, txHash });
      if ("error" in credited) {
        res.status(409).json({ error: credited.error });
        return;
      }
      res.json(invoiceToPublicJson(credited));
    }
  );

  app.get("/api/resident/public-rooms", requireJwt, (req, res) => {
    const wallet = requireResident(req, res, jwtAddressFromReq, jwtSecret);
    if (!wallet) return;
    const world = getReturnWalkWorld();
    res.json({ rooms: world ? world.listPublicRooms() : [] });
  });
}
