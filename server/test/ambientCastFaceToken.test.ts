import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearFaceTokenCacheForTests,
  dataUrlFromFaceToken,
  faceTokenForWallet,
  isFaceToken,
  normalizeIdenticonSvg,
  walletIdenticonDataUrl,
} from "../src/ambientCast/faceToken.js";

const SAMPLE_WALLET = "NQ37 37NM 361M 3H8A 4P7T R2P9 4JTN RGY7 71NX";

describe("Ambient Cast Face Token", () => {
  it("yields the same normalized identicon SVG as the wallet address", async () => {
    clearFaceTokenCacheForTests();
    const token = faceTokenForWallet(SAMPLE_WALLET);
    const fromWallet = normalizeIdenticonSvg(
      await walletIdenticonDataUrl(SAMPLE_WALLET)
    );
    const fromToken = normalizeIdenticonSvg(await dataUrlFromFaceToken(token));
    assert.equal(fromToken, fromWallet);
  });

  it("is not a Nimiq address and does not embed the wallet string", () => {
    clearFaceTokenCacheForTests();
    const token = faceTokenForWallet(SAMPLE_WALLET);
    assert.ok(isFaceToken(token));
    assert.ok(!token.includes("NQ"));
    assert.ok(!token.includes(SAMPLE_WALLET.replace(/\s+/g, "")));
    assert.ok(!/^NQ[A-Z0-9 ]+$/i.test(token));
  });

  it("returns the same token on a second lookup", () => {
    clearFaceTokenCacheForTests();
    const a = faceTokenForWallet(SAMPLE_WALLET);
    const b = faceTokenForWallet(SAMPLE_WALLET);
    assert.equal(a, b);
  });
});
