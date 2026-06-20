import type { Request, Response, NextFunction } from "express";
import type { AppConfig } from "./config.js";

export function bearerApiAuth(cfg: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const h = req.headers.authorization;
    const token =
      typeof h === "string" && h.startsWith("Bearer ")
        ? h.slice("Bearer ".length).trim()
        : "";
    if (!token || token !== cfg.apiSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}
