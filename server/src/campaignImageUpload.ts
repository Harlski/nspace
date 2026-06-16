import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { campaignSqlitePath } from "./advertiseConfig.js";

/** Max decoded image size (2.5 MiB). */
export const CAMPAIGN_IMAGE_UPLOAD_MAX_BYTES = 2_621_440;

export type CampaignImageFormat = "png" | "jpeg" | "webp";

const DATA_URL_RE =
  /^data:image\/(png|jpeg|jpg|webp);base64,([a-z0-9+/=\r\n]+)$/i;

export function campaignUploadsDir(): string {
  const custom = process.env.CAMPAIGN_UPLOAD_DIR?.trim();
  if (custom) return path.resolve(custom);
  const sqlite = path.resolve(campaignSqlitePath());
  return path.join(path.dirname(sqlite), "advertise-uploads");
}

export function ensureCampaignUploadsDir(): void {
  fs.mkdirSync(campaignUploadsDir(), { recursive: true });
}

function normalizeWalletFolder(wallet: string): string {
  const compact = String(wallet || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!compact || compact.length < 4) return "unknown";
  return compact.slice(0, 12);
}

export function detectCampaignImageFormat(
  buffer: Buffer
): CampaignImageFormat | null {
  if (buffer.length < 12) return null;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function parseCampaignImageBuffer(
  buffer: Buffer
): { buffer: Buffer; format: CampaignImageFormat } | { error: string } {
  if (!buffer.length) return { error: "invalid_image_data" };
  if (buffer.length > CAMPAIGN_IMAGE_UPLOAD_MAX_BYTES) {
    return { error: "image_too_large" };
  }
  const format = detectCampaignImageFormat(buffer);
  if (!format) return { error: "invalid_image_format" };
  return { buffer, format };
}

export function isCampaignImageUploadContentType(contentType: string): boolean {
  const ct = String(contentType ?? "").split(";")[0]!.trim().toLowerCase();
  return (
    ct === "image/png" ||
    ct === "image/jpeg" ||
    ct === "image/jpg" ||
    ct === "image/webp" ||
    ct === "application/octet-stream"
  );
}

export function parseCampaignImageDataUrl(
  dataUrl: string
): { buffer: Buffer; format: CampaignImageFormat } | { error: string } {
  const raw = String(dataUrl ?? "").trim();
  const m = DATA_URL_RE.exec(raw);
  if (!m) return { error: "invalid_image_data" };
  const declared = m[1]!.toLowerCase();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(m[2]!.replace(/\s+/g, ""), "base64");
  } catch {
    return { error: "invalid_image_data" };
  }
  if (!buffer.length) return { error: "invalid_image_data" };
  if (buffer.length > CAMPAIGN_IMAGE_UPLOAD_MAX_BYTES) {
    return { error: "image_too_large" };
  }
  const detected = detectCampaignImageFormat(buffer);
  if (!detected) return { error: "invalid_image_format" };
  const declaredFormat: CampaignImageFormat =
    declared === "jpg" || declared === "jpeg" ? "jpeg" : (declared as CampaignImageFormat);
  if (declaredFormat !== detected) {
    return { error: "invalid_image_format" };
  }
  return { buffer, format: detected };
}

export function fileExtensionForFormat(format: CampaignImageFormat): string {
  if (format === "jpeg") return "jpg";
  return format;
}

/**
 * Persist an uploaded campaign image and return a same-origin URL path
 * accepted by {@link isAllowedBillboardImageUrl}.
 */
export function saveCampaignImageUpload(
  ownerWallet: string,
  buffer: Buffer,
  format: CampaignImageFormat
): string {
  ensureCampaignUploadsDir();
  const folder = normalizeWalletFolder(ownerWallet);
  const dir = path.join(campaignUploadsDir(), folder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = fileExtensionForFormat(format);
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `/advertise/uploads/${folder}/${filename}`;
}
