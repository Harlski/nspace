import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectCampaignImageFormat,
  isCampaignCreativeUploadUrl,
  parseCampaignImageBuffer,
  parseCampaignImageDataUrl,
} from "../src/campaignImageUpload.js";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("parseCampaignImageBuffer accepts valid PNG bytes", () => {
  const buf = Buffer.from(TINY_PNG_B64, "base64");
  const parsed = parseCampaignImageBuffer(buf);
  assert.ok(!("error" in parsed));
  assert.equal(parsed.format, "png");
});

test("parseCampaignImageDataUrl accepts valid PNG data URL", () => {
  const parsed = parseCampaignImageDataUrl(
    "data:image/png;base64," + TINY_PNG_B64
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.format, "png");
  assert.equal(detectCampaignImageFormat(parsed.buffer), "png");
});

test("parseCampaignImageDataUrl rejects mismatched declared type", () => {
  const parsed = parseCampaignImageDataUrl(
    "data:image/jpeg;base64," + TINY_PNG_B64
  );
  assert.ok("error" in parsed);
  assert.equal(parsed.error, "invalid_image_format");
});

test("parseCampaignImageDataUrl rejects garbage", () => {
  const parsed = parseCampaignImageDataUrl("not-a-data-url");
  assert.ok("error" in parsed);
  assert.equal(parsed.error, "invalid_image_data");
});

const UPLOAD_PATH =
  "/advertise/uploads/11111111-1111-1111-1111-111111111111.png";

test("isCampaignCreativeUploadUrl accepts a same-origin upload path", () => {
  assert.equal(isCampaignCreativeUploadUrl(UPLOAD_PATH), true);
  assert.equal(
    isCampaignCreativeUploadUrl(
      "/advertise/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"
    ),
    true
  );
});

test("isCampaignCreativeUploadUrl rejects remote URLs and unsafe paths", () => {
  assert.equal(isCampaignCreativeUploadUrl("https://example.com/ad.png"), false);
  assert.equal(isCampaignCreativeUploadUrl("http://example.com/ad.png"), false);
  assert.equal(isCampaignCreativeUploadUrl("/advertise/uploads/../secret.png"), false);
  assert.equal(isCampaignCreativeUploadUrl("/other/uploads/11111111-1111-1111-1111-111111111111.png"), false);
  assert.equal(isCampaignCreativeUploadUrl(""), false);
});
