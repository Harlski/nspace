/** Code-defined achievements (v1 — not admin-editable). */

import { HUB_ROOM_ID } from "./roomLayouts.js";

export const ACHIEVEMENT_COLLECTION = "Achievements";
export const COMMONS_ROOM_ID = HUB_ROOM_ID;

/** Achievement-only cosmetic catalog entries seeded at init. */

export type AchievementCategory =
  | "onboarding"
  | "commons_build"
  | "mining"
  | "worldcup_match"
  | "worldcup_field"
  | "social";

export type AchievementCounterKey =
  | "blocks_placed"
  | "blocks_placed_commons"
  | "blocks_mined"
  | "matches_won"
  | "matches_played"
  | "match_win_streak"
  | "field_goals_scored"
  | "chat_messages_sent";

export type AchievementEventKey =
  | "enter_commons"
  | "open_profile"
  | "open_wardrobe"
  | "equip_cosmetic"
  | "send_emote"
  | "visit_room"
  | "create_room"
  | "match_won"
  | "match_lost"
  | "match_draw"
  | "challenge_raised"
  | "challenge_accepted"
  | "golden_goal_win"
  | "opponent_left_win"
  | "match_goals_peak_1"
  | "match_goals_peak_2"
  | "match_goals_peak_3"
  | "match_goals_peak_5"
  | "match_goals_peak_10"
  | "field_goal_scored"
  | "field_goal_contested"
  | "field_goal_solo"
  | "country_picked"
  | "flag_emote_sent"
  | "login_streak_7"
  | "login_streak_30"
  | "login_streak_top";

/** World Cup seasonal counters — progress pauses when WORLDCUP_ENABLED is off. */
export const WORLDCUP_ACHIEVEMENT_COUNTERS: ReadonlySet<AchievementCounterKey> =
  new Set([
    "matches_won",
    "matches_played",
    "match_win_streak",
    "field_goals_scored",
  ]);

/** World Cup seasonal one-time events — not fired when WORLDCUP_ENABLED is off. */
export const WORLDCUP_ACHIEVEMENT_EVENTS: ReadonlySet<AchievementEventKey> =
  new Set([
    "match_won",
    "match_lost",
    "match_draw",
    "challenge_raised",
    "challenge_accepted",
    "golden_goal_win",
    "opponent_left_win",
    "match_goals_peak_1",
    "match_goals_peak_2",
    "match_goals_peak_3",
    "match_goals_peak_5",
    "match_goals_peak_10",
    "field_goal_scored",
    "field_goal_contested",
    "field_goal_solo",
    "country_picked",
    "flag_emote_sent",
  ]);

export type AchievementCriteria =
  | {
      type: "counter";
      counter: AchievementCounterKey;
      threshold: number;
      /** When set, only increments from matching room scope apply to this achievement. */
      roomScope?: "any" | "commons";
    }
  | { type: "event"; event: AchievementEventKey }
  | { type: "onboarding_complete" };

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
  {
    cosmeticSku: "ach-trail-match-centurion",
    presetId: "trail-linger-gold",
    displayName: "Centurion Trail",
    description: "Unlocked by winning 100 World Cup Matches.",
    sortOrder: 4,
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
    id: "telescope",
    title: "Telescope",
    description:
      "Complete every Getting started achievement to unlock the Telescope.",
    category: "onboarding",
    points: 25,
    sortOrder: 95,
    criteria: { type: "onboarding_complete" },
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
  {
    id: "match-first-win",
    title: "First Victory",
    description: "Win your first World Cup Match.",
    category: "worldcup_match",
    points: 15,
    sortOrder: 1000,
    criteria: { type: "event", event: "match_won" },
  },
  {
    id: "match-first-loss",
    title: "Good Sport",
    description: "Lose your first World Cup Match.",
    category: "worldcup_match",
    points: 10,
    sortOrder: 1010,
    criteria: { type: "event", event: "match_lost" },
  },
  {
    id: "match-first-draw",
    title: "Hard Fought",
    description: "Draw your first World Cup Match.",
    category: "worldcup_match",
    points: 10,
    sortOrder: 1020,
    criteria: { type: "event", event: "match_draw" },
  },
  {
    id: "match-challenge-raised",
    title: "Throw Down",
    description: "Raise your first Challenge.",
    category: "worldcup_match",
    points: 5,
    sortOrder: 1030,
    criteria: { type: "event", event: "challenge_raised" },
  },
  {
    id: "match-challenge-accepted",
    title: "Game On",
    description: "Accept someone else's Challenge.",
    category: "worldcup_match",
    points: 5,
    sortOrder: 1040,
    criteria: { type: "event", event: "challenge_accepted" },
  },
  {
    id: "match-golden-goal",
    title: "Golden Moment",
    description: "Win a Match via Golden Goal.",
    category: "worldcup_match",
    points: 20,
    sortOrder: 1050,
    criteria: { type: "event", event: "golden_goal_win" },
  },
  {
    id: "match-walkover",
    title: "Walkover",
    description: "Win because your opponent left the Match.",
    category: "worldcup_match",
    points: 5,
    sortOrder: 1060,
    criteria: { type: "event", event: "opponent_left_win" },
  },
  {
    id: "match-goals-headshot",
    title: "Headshot",
    description: "Score one goal in a single Match.",
    category: "worldcup_match",
    points: 10,
    sortOrder: 1070,
    criteria: { type: "event", event: "match_goals_peak_1" },
  },
  {
    id: "match-goals-double",
    title: "Double Kill",
    description: "Score two goals in a single Match.",
    category: "worldcup_match",
    points: 15,
    sortOrder: 1080,
    criteria: { type: "event", event: "match_goals_peak_2" },
  },
  {
    id: "match-goals-hattrick",
    title: "Three of a Kind",
    description: "Score three goals in a single Match.",
    category: "worldcup_match",
    points: 20,
    sortOrder: 1090,
    criteria: { type: "event", event: "match_goals_peak_3" },
  },
  {
    id: "match-goals-five",
    title: "Why Not Make It Six?",
    description: "Score five goals in a single Match.",
    category: "worldcup_match",
    points: 30,
    sortOrder: 1100,
    criteria: { type: "event", event: "match_goals_peak_5" },
  },
  {
    id: "match-goals-ten",
    title: "Probably Cheating or Lag",
    description: "Score ten or more goals in a single Match.",
    category: "worldcup_match",
    points: 50,
    sortOrder: 1110,
    criteria: { type: "event", event: "match_goals_peak_10" },
  },
  {
    id: "match-wins-1",
    title: "Match Winner",
    description: "Win 1 World Cup Match.",
    category: "worldcup_match",
    points: 10,
    sortOrder: 1120,
    criteria: { type: "counter", counter: "matches_won", threshold: 1 },
  },
  {
    id: "match-wins-10",
    title: "Match Winner X",
    description: "Win 10 World Cup Matches.",
    category: "worldcup_match",
    points: 25,
    sortOrder: 1130,
    criteria: { type: "counter", counter: "matches_won", threshold: 10 },
  },
  {
    id: "match-wins-50",
    title: "Match Winner L",
    description: "Win 50 World Cup Matches.",
    category: "worldcup_match",
    points: 50,
    sortOrder: 1140,
    criteria: { type: "counter", counter: "matches_won", threshold: 50 },
  },
  {
    id: "match-wins-100",
    title: "Match Winner C",
    description: "Win 100 World Cup Matches.",
    category: "worldcup_match",
    points: 75,
    sortOrder: 1150,
    criteria: { type: "counter", counter: "matches_won", threshold: 100 },
    rewardSku: "ach-trail-match-centurion",
  },
  {
    id: "match-wins-1000",
    title: "Match Winner M",
    description: "Win 1000 World Cup Matches.",
    category: "worldcup_match",
    points: 100,
    sortOrder: 1160,
    criteria: { type: "counter", counter: "matches_won", threshold: 1000 },
  },
  {
    id: "match-played-10",
    title: "Regular",
    description: "Complete 10 World Cup Matches.",
    category: "worldcup_match",
    points: 20,
    sortOrder: 1170,
    criteria: { type: "counter", counter: "matches_played", threshold: 10 },
  },
  {
    id: "match-streak-3",
    title: "On a Roll",
    description: "Win 3 World Cup Matches in a row.",
    category: "worldcup_match",
    points: 15,
    sortOrder: 1180,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 3 },
  },
  {
    id: "match-streak-5",
    title: "Unstoppable",
    description: "Win 5 World Cup Matches in a row.",
    category: "worldcup_match",
    points: 25,
    sortOrder: 1190,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 5 },
  },
  {
    id: "match-streak-10",
    title: "Probably Cheating or Lag",
    description: "Win 10 World Cup Matches in a row.",
    category: "worldcup_match",
    points: 50,
    sortOrder: 1200,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 10 },
  },
  {
    id: "field-first-goal",
    title: "Field Goal",
    description: "Score your first credited goal on the Free Play Field.",
    category: "worldcup_field",
    points: 10,
    sortOrder: 2000,
    criteria: { type: "event", event: "field_goal_scored" },
  },
  {
    id: "field-goals-10",
    title: "Field Striker I",
    description: "Score 10 credited goals on the Free Play Field.",
    category: "worldcup_field",
    points: 20,
    sortOrder: 2010,
    criteria: {
      type: "counter",
      counter: "field_goals_scored",
      threshold: 10,
    },
  },
  {
    id: "field-goals-50",
    title: "Field Striker II",
    description: "Score 50 credited goals on the Free Play Field.",
    category: "worldcup_field",
    points: 40,
    sortOrder: 2020,
    criteria: {
      type: "counter",
      counter: "field_goals_scored",
      threshold: 50,
    },
  },
  {
    id: "field-goals-100",
    title: "Field Striker III",
    description: "Score 100 credited goals on the Free Play Field.",
    category: "worldcup_field",
    points: 60,
    sortOrder: 2030,
    criteria: {
      type: "counter",
      counter: "field_goals_scored",
      threshold: 100,
    },
  },
  {
    id: "field-contested",
    title: "Crowd Pleaser",
    description: "Score your first Contested goal on the Free Play Field.",
    category: "worldcup_field",
    points: 15,
    sortOrder: 2040,
    criteria: { type: "event", event: "field_goal_contested" },
  },
  {
    id: "field-solo",
    title: "Practice Makes Perfect",
    description: "Score your first Solo Goal on the Free Play Field.",
    category: "worldcup_field",
    points: 10,
    sortOrder: 2050,
    criteria: { type: "event", event: "field_goal_solo" },
  },
  {
    id: "field-country",
    title: "Fly the Flag",
    description: "Pick a country in the Country Picker.",
    category: "worldcup_field",
    points: 5,
    sortOrder: 2060,
    criteria: { type: "event", event: "country_picked" },
  },
  {
    id: "field-flag-emote",
    title: "Represent",
    description: "Send your Flag Emote.",
    category: "worldcup_field",
    points: 5,
    sortOrder: 2070,
    criteria: { type: "event", event: "flag_emote_sent" },
  },
  {
    id: "social-login-7",
    title: "Week Warrior",
    description: "Log in on 7 consecutive UTC calendar days.",
    category: "social",
    points: 15,
    sortOrder: 3000,
    criteria: { type: "event", event: "login_streak_7" },
  },
  {
    id: "social-login-30",
    title: "Monthly Devotee",
    description: "Log in on 30 consecutive UTC calendar days.",
    category: "social",
    points: 40,
    sortOrder: 3010,
    criteria: { type: "event", event: "login_streak_30" },
  },
  {
    id: "social-login-top",
    title: "Time of Kaan",
    description: "Reach the top login-streak milestone.",
    category: "social",
    points: 100,
    sortOrder: 3020,
    criteria: { type: "event", event: "login_streak_top" },
  },
  {
    id: "social-chatter-100",
    title: "Chatterbox I",
    description: "Send 100 in-game chat messages.",
    category: "social",
    points: 10,
    sortOrder: 3030,
    criteria: {
      type: "counter",
      counter: "chat_messages_sent",
      threshold: 100,
    },
  },
  {
    id: "social-chatter-500",
    title: "Chatterbox II",
    description: "Send 500 in-game chat messages.",
    category: "social",
    points: 25,
    sortOrder: 3040,
    criteria: {
      type: "counter",
      counter: "chat_messages_sent",
      threshold: 500,
    },
  },
  {
    id: "social-chatter-1000",
    title: "Chatterbox III",
    description: "Send 1000 in-game chat messages.",
    category: "social",
    points: 50,
    sortOrder: 3050,
    criteria: {
      type: "counter",
      counter: "chat_messages_sent",
      threshold: 1000,
    },
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
  } else if (def.criteria.type === "counter") {
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

export function isWorldCupAchievementCounter(
  counter: AchievementCounterKey
): boolean {
  return WORLDCUP_ACHIEVEMENT_COUNTERS.has(counter);
}

export function isWorldCupAchievementEvent(event: AchievementEventKey): boolean {
  return WORLDCUP_ACHIEVEMENT_EVENTS.has(event);
}
