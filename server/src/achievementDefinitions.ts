/** Code-defined achievements (v1 — not admin-editable). */

import { HUB_ROOM_ID } from "./roomLayouts.js";

export const ACHIEVEMENT_COLLECTION = "Achievements";
export const COMMONS_ROOM_ID = HUB_ROOM_ID;

/** Achievement-only cosmetic catalog entries seeded at init. */

export type AchievementCategory = "onboarding" | "commons_build" | "mining";

export type AchievementCounterKey =
  | "blocks_placed"
  | "blocks_placed_commons"
  | "blocks_mined";

export type AchievementEventKey =
  | "enter_commons"
  | "open_profile"
  | "open_wardrobe"
  | "equip_cosmetic"
  | "send_emote"
  | "visit_room"
  | "create_room";

export type AchievementCriteria =
  | {
      type: "counter";
      counter: AchievementCounterKey;
      threshold: number;
      /** When set, only increments from matching room scope apply to this achievement. */
      roomScope?: "any" | "commons";
    }
  | { type: "event"; event: AchievementEventKey };

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  points: number;
  sortOrder: number;
  criteria: AchievementCriteria;
  /** Dedicated achievement-only cosmetic SKU granted on completion. */
  rewardSku?: string;
};

export const ACHIEVEMENT_REWARD_CATALOG = [
  {
    cosmeticSku: "ach-trail-commons-starter",
    presetId: "trail-sparkle",
    displayName: "Commons Spark Trail",
    description: "Unlocked by placing your first block in the Commons.",
    sortOrder: 1,
  },
  {
    cosmeticSku: "ach-trail-commons-builder",
    presetId: "trail-linger-cyan",
    displayName: "Commons Builder Trail",
    description: "Unlocked by placing 100 blocks in the Commons.",
    sortOrder: 2,
  },
  {
    cosmeticSku: "ach-trail-miner",
    presetId: "trail-linger-gold",
    displayName: "Miner Trail",
    description: "Unlocked by mining 100 claimable blocks.",
    sortOrder: 3,
  },
] as const;

export const ACHIEVEMENT_DEFINITIONS: ReadonlyArray<AchievementDefinition> = [
  {
    id: "enter-commons",
    title: "Welcome to the Commons",
    description: "Enter the Commons for the first time.",
    category: "onboarding",
    points: 10,
    sortOrder: 10,
    criteria: { type: "event", event: "enter_commons" },
  },
  {
    id: "open-profile",
    title: "Know Thyself",
    description: "Open your player profile.",
    category: "onboarding",
    points: 5,
    sortOrder: 20,
    criteria: { type: "event", event: "open_profile" },
  },
  {
    id: "open-wardrobe",
    title: "Dress the Part",
    description: "Open your Wardrobe.",
    category: "onboarding",
    points: 5,
    sortOrder: 30,
    criteria: { type: "event", event: "open_wardrobe" },
  },
  {
    id: "equip-cosmetic",
    title: "Suited Up",
    description: "Equip a cosmetic in your loadout.",
    category: "onboarding",
    points: 10,
    sortOrder: 40,
    criteria: { type: "event", event: "equip_cosmetic" },
  },
  {
    id: "first-block",
    title: "First Block",
    description: "Place your first block.",
    category: "onboarding",
    points: 10,
    sortOrder: 50,
    criteria: {
      type: "counter",
      counter: "blocks_placed",
      threshold: 1,
      roomScope: "any",
    },
  },
  {
    id: "first-mine",
    title: "First Claim",
    description: "Mine your first claimable block.",
    category: "onboarding",
    points: 10,
    sortOrder: 60,
    criteria: { type: "counter", counter: "blocks_mined", threshold: 1 },
  },
  {
    id: "first-emote",
    title: "Express Yourself",
    description: "Send an emote from the Action Wheel.",
    category: "onboarding",
    points: 5,
    sortOrder: 70,
    criteria: { type: "event", event: "send_emote" },
  },
  {
    id: "visit-room",
    title: "Explorer",
    description: "Visit another room.",
    category: "onboarding",
    points: 10,
    sortOrder: 80,
    criteria: { type: "event", event: "visit_room" },
  },
  {
    id: "create-room",
    title: "Room Maker",
    description: "Create your own room.",
    category: "onboarding",
    points: 15,
    sortOrder: 90,
    criteria: { type: "event", event: "create_room" },
  },
  {
    id: "commons-first-block",
    title: "Commons Contributor",
    description: "Place your first block in the Commons.",
    category: "commons_build",
    points: 15,
    sortOrder: 95,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 1,
      roomScope: "commons",
    },
    rewardSku: "ach-trail-commons-starter",
  },
  {
    id: "commons-place-10",
    title: "Commons Builder I",
    description: "Place 10 blocks in the Commons.",
    category: "commons_build",
    points: 25,
    sortOrder: 100,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 10,
      roomScope: "commons",
    },
  },
  {
    id: "commons-place-100",
    title: "Commons Builder II",
    description: "Place 100 blocks in the Commons.",
    category: "commons_build",
    points: 50,
    sortOrder: 110,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 100,
      roomScope: "commons",
    },
    rewardSku: "ach-trail-commons-builder",
  },
  {
    id: "commons-place-250",
    title: "Commons Builder III",
    description: "Place 250 blocks in the Commons.",
    category: "commons_build",
    points: 75,
    sortOrder: 120,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 250,
      roomScope: "commons",
    },
  },
  {
    id: "commons-place-500",
    title: "Commons Builder IV",
    description: "Place 500 blocks in the Commons.",
    category: "commons_build",
    points: 100,
    sortOrder: 130,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 500,
      roomScope: "commons",
    },
  },
  {
    id: "mine-10",
    title: "Miner I",
    description: "Mine 10 claimable blocks.",
    category: "mining",
    points: 25,
    sortOrder: 200,
    criteria: { type: "counter", counter: "blocks_mined", threshold: 10 },
  },
  {
    id: "mine-100",
    title: "Miner II",
    description: "Mine 100 claimable blocks.",
    category: "mining",
    points: 50,
    sortOrder: 210,
    criteria: { type: "counter", counter: "blocks_mined", threshold: 100 },
    rewardSku: "ach-trail-miner",
  },
  {
    id: "mine-250",
    title: "Miner III",
    description: "Mine 250 claimable blocks.",
    category: "mining",
    points: 75,
    sortOrder: 220,
    criteria: { type: "counter", counter: "blocks_mined", threshold: 250 },
  },
  {
    id: "mine-500",
    title: "Miner IV",
    description: "Mine 500 claimable blocks.",
    category: "mining",
    points: 100,
    sortOrder: 230,
    criteria: { type: "counter", counter: "blocks_mined", threshold: 500 },
  },
];

const definitionById = new Map(
  ACHIEVEMENT_DEFINITIONS.map((d) => [d.id, d] as const)
);

const definitionsByEvent = new Map<AchievementEventKey, AchievementDefinition[]>();
const definitionsByCounter = new Map<
  AchievementCounterKey,
  AchievementDefinition[]
>();

for (const def of ACHIEVEMENT_DEFINITIONS) {
  if (def.criteria.type === "event") {
    const list = definitionsByEvent.get(def.criteria.event) ?? [];
    list.push(def);
    definitionsByEvent.set(def.criteria.event, list);
  } else {
    const list = definitionsByCounter.get(def.criteria.counter) ?? [];
    list.push(def);
    definitionsByCounter.set(def.criteria.counter, list);
  }
}

export function getAchievementDefinition(
  id: string
): AchievementDefinition | undefined {
  return definitionById.get(id);
}

export function listAchievementsForEvent(
  event: AchievementEventKey
): ReadonlyArray<AchievementDefinition> {
  return definitionsByEvent.get(event) ?? [];
}

export function listAchievementsForCounter(
  counter: AchievementCounterKey
): ReadonlyArray<AchievementDefinition> {
  return definitionsByCounter.get(counter) ?? [];
}

export function isAchievementOnlySku(sku: string): boolean {
  return String(sku ?? "")
    .trim()
    .toLowerCase()
    .startsWith("ach-");
}
