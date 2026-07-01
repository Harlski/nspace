import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import {
  attachCosmeticPrefabSafe,
  avatarTrailMoving,
  disposeCosmeticPrefab,
  disposeCosmeticTrailPuffs,
  resetCosmeticPrefabTexturesForTests,
  syncCosmeticLoadoutVfx,
  tickCosmeticTrailSpawn,
  updateCosmeticTrailPuffs,
  updateCosmeticTrailPuffsForGroup,
} from "./cosmeticPrefabFactory.js";
import {
  AURA_REF_MAGIC_RING,
  cosmeticPresetPreviewSpriteFile,
  cosmeticPresetPreviewSpriteUrl,
  cosmeticPresetPreviewTint,
  getCosmeticPrefabDef,
  TRAIL_REF_SPARK_CYAN,
  TRAIL_REF_SPARK_PATH,
} from "./cosmeticPrefabRegistry.js";

afterEach(() => {
  resetCosmeticPrefabTexturesForTests();
});

describe("cosmetic prefab registry", () => {
  it("resolves reference trail and aura defs", () => {
    expect(getCosmeticPrefabDef(TRAIL_REF_SPARK_PATH.presetId)?.slot).toBe("trail");
    expect(getCosmeticPrefabDef(TRAIL_REF_SPARK_CYAN.presetId)?.slot).toBe("trail");
    expect(getCosmeticPrefabDef(AURA_REF_MAGIC_RING.presetId)?.slot).toBe("aura");
    expect(getCosmeticPrefabDef("aura-ref-sigil-magic-01")?.slot).toBe("aura");
    expect(getCosmeticPrefabDef("aura-ref-sigil-twirl-03")?.slot).toBe("aura");
  });

  it("returns null for unknown presetId", () => {
    expect(getCosmeticPrefabDef("trail-does-not-exist")).toBeNull();
  });

  it("resolves Kenney sprite URLs for trail and aura swatches", () => {
    expect(cosmeticPresetPreviewSpriteFile(TRAIL_REF_SPARK_CYAN.presetId)).toBe("spark_01.png");
    expect(cosmeticPresetPreviewSpriteUrl(TRAIL_REF_SPARK_CYAN.presetId)).toBe(
      "/assets/particles/kenney/spark_01.png"
    );
    expect(cosmeticPresetPreviewTint(TRAIL_REF_SPARK_CYAN.presetId)).toBe(0xaaeeff);
    expect(cosmeticPresetPreviewSpriteFile(AURA_REF_MAGIC_RING.presetId)).toBe("magic_01.png");
    expect(cosmeticPresetPreviewTint(AURA_REF_MAGIC_RING.presetId)).toBe(0xbb88ff);
    expect(cosmeticPresetPreviewSpriteUrl("aura-ref-sigil-twirl-02")).toBe(
      "/assets/particles/kenney/twirl_02.png"
    );
  });
});

describe("attachCosmeticPrefabSafe", () => {
  it("does not throw for unknown presetId", () => {
    const group = new THREE.Group();
    expect(() => attachCosmeticPrefabSafe(group, "missing-trail", "trail")).not.toThrow();
    expect(attachCosmeticPrefabSafe(group, "missing-trail", "trail")).toBe(false);
    expect(group.children.length).toBe(0);
  });

  it("attaches aura children for a known preset", () => {
    const group = new THREE.Group();
    expect(
      attachCosmeticPrefabSafe(group, AURA_REF_MAGIC_RING.presetId, "aura")
    ).toBe(true);
    expect(group.getObjectByName("cosmeticAuraMesh")).toBeTruthy();
  });

  it("records trail preset on the avatar group", () => {
    const group = new THREE.Group();
    expect(
      attachCosmeticPrefabSafe(group, TRAIL_REF_SPARK_PATH.presetId, "trail")
    ).toBe(true);
    expect(group.userData.cosmeticTrailPreset).toBe(TRAIL_REF_SPARK_PATH.presetId);
  });
});

describe("movement-gated trail spawn", () => {
  it("does not spawn decals when stationary", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    syncCosmeticLoadoutVfx(group, { cosmeticTrail: TRAIL_REF_SPARK_PATH.presetId }, false);
    tickCosmeticTrailSpawn(
      scene,
      group,
      TRAIL_REF_SPARK_PATH.presetId,
      0,
      0,
      0,
      false,
      1000
    );
    expect(scene.children.length).toBe(0);
  });

  it("lays ground decals when moving", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    syncCosmeticLoadoutVfx(group, { cosmeticTrail: TRAIL_REF_SPARK_PATH.presetId }, true);
    tickCosmeticTrailSpawn(
      scene,
      group,
      TRAIL_REF_SPARK_PATH.presetId,
      0,
      0,
      0,
      true,
      1000
    );
    tickCosmeticTrailSpawn(
      scene,
      group,
      TRAIL_REF_SPARK_PATH.presetId,
      1.5,
      0,
      0,
      true,
      1100
    );
    expect(scene.children.length).toBeGreaterThan(0);
  });

  it("avatarTrailMoving requires a position delta", () => {
    const group = new THREE.Group();
    expect(avatarTrailMoving(group, 0, 0)).toBe(false);
    expect(avatarTrailMoving(group, 0.2, 0)).toBe(true);
  });
});

describe("trail puff TTL cleanup", () => {
  it("removes expired decals on tick", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    syncCosmeticLoadoutVfx(group, { cosmeticTrail: TRAIL_REF_SPARK_PATH.presetId }, true);
    tickCosmeticTrailSpawn(scene, group, TRAIL_REF_SPARK_PATH.presetId, 0, 0, 0, true, 0);
    tickCosmeticTrailSpawn(scene, group, TRAIL_REF_SPARK_PATH.presetId, 2, 0, 0, true, 100);
    const before = scene.children.length;
    expect(before).toBeGreaterThan(0);
    const puffs = group.userData.cosmeticTrailPuffs as Array<{ bornAt: number; ttl: number }>;
    for (const puff of puffs) {
      puff.bornAt = 0;
      puff.ttl = 10;
    }
    updateCosmeticTrailPuffs(puffs as never, 100);
    expect(scene.children.length).toBe(0);
    expect(updateCosmeticTrailPuffsForGroup(group, 100)).toBe(false);
  });
});

describe("disposeCosmeticPrefab", () => {
  it("clears aura and trail state", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    syncCosmeticLoadoutVfx(
      group,
      {
        cosmeticAura: AURA_REF_MAGIC_RING.presetId,
        cosmeticTrail: TRAIL_REF_SPARK_PATH.presetId,
      },
      true
    );
    tickCosmeticTrailSpawn(scene, group, TRAIL_REF_SPARK_PATH.presetId, 0, 0, 0, true, 0);
    tickCosmeticTrailSpawn(scene, group, TRAIL_REF_SPARK_PATH.presetId, 2, 0, 0, true, 100);
    disposeCosmeticPrefab(group);
    expect(group.getObjectByName("cosmeticAuraMesh")).toBeFalsy();
    expect(group.userData.cosmeticTrailPreset).toBeUndefined();
    disposeCosmeticTrailPuffs(group);
    expect(scene.children.length).toBe(0);
  });
});
