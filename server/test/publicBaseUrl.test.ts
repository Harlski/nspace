import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicBaseUrl } from "../src/publicBaseUrl.js";

test("resolvePublicBaseUrl respects explicit env and production default", () => {
  const prev = process.env.PUBLIC_BASE_URL;
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.PUBLIC_BASE_URL = "https://custom.example/";
    assert.equal(resolvePublicBaseUrl("development"), "https://custom.example");
    delete process.env.PUBLIC_BASE_URL;
    process.env.NODE_ENV = "production";
    assert.equal(resolvePublicBaseUrl("production"), "https://nimiq.space");
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prev;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  }
});
