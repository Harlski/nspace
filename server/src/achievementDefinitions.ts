/** Code-defined achievements (v1 - not admin-editable). */

import { HUB_ROOM_ID } from "./roomLayouts.js";

export const ACHIEVEMENT_COLLECTION = "Achievements";
export const COMMONS_ROOM_ID = HUB_ROOM_ID;

/** Achievement-only cosmetic catalog entries seeded at init. */

export type AchievementCategory =
  | "onboarding"
  | "commons_build"
  | "mining"
  | "pixel"
  | "football_match"
  | "football_free_play"
  | "social"
  | "exploration"
  | "worldcraft"
  | "play_space"
  | "meta"
  | "misc";

export type AchievementCategoryGroup = "minigames" | "building";

export type AchievementCounterKey =
  | "blocks_placed"
  | "blocks_placed_commons"
  | "blocks_mined"
  | "mine_cooldown_attempts"
  | "billboard_dwell_ms"
  | "pixels_painted"
  | "pixel_monochrome_streak"
  | "matches_won"
  | "matches_played"
  | "match_win_streak"
  | "field_goals_scored"
  | "field_goal_daily_streak"
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
  | "match_clean_sheet"
  | "match_comeback_win"
  | "golden_patience_win"
  | "match_full_time"
  | "match_own_goal_win"
  | "handshake_rival"
  | "field_goal_rush_hour"
  | "field_underdog_country"
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
  | "feedback_submitted"
  | "impatient_miner"
  | "paid_in_full"
  | "pixel_collaborator"
  | "prefab_author"
  | "signpost_scribe"
  | "gatekeeper"
  | "trust_circle"
  | "beat_the_creator"
  | "feedback_reply_seen"
  | "teleporter_activated";

/** World Cup seasonal counters - progress pauses when WORLDCUP_ENABLED is off. */
export const WORLDCUP_ACHIEVEMENT_COUNTERS: ReadonlySet<AchievementCounterKey> =
  new Set([
    "matches_won",
    "matches_played",
    "match_win_streak",
    "field_goals_scored",
    "field_goal_daily_streak",
  ]);

/** World Cup seasonal one-time events - not fired when WORLDCUP_ENABLED is off. */
export const WORLDCUP_ACHIEVEMENT_EVENTS: ReadonlySet<AchievementEventKey> =
  new Set([
    "match_won",
    "match_lost",
    "match_draw",
    "challenge_raised",
    "challenge_accepted",
    "golden_goal_win",
    "opponent_left_win",
    "match_clean_sheet",
    "match_comeback_win",
    "golden_patience_win",
    "match_full_time",
    "match_own_goal_win",
    "handshake_rival",
    "field_goal_rush_hour",
    "field_underdog_country",
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
    "beat_the_creator",
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
  | { type: "login_streak"; threshold: number }
  | { type: "onboarding_complete" }
  | { type: "dedupe_count"; seenPrefix: string; threshold: number }
  | { type: "daily_set"; requiredKeys: string[]; utcDayScope: true }
  | { type: "composite"; requirements: AchievementCriteria[] }
  | {
      type: "streak_counter";
      counter: AchievementCounterKey;
      threshold: number;
      resetOn: string;
    }
  | { type: "ap_threshold"; threshold: number }
  | { type: "category_complete"; category: AchievementCategory }
  | { type: "room_maker_deluxe" }
  | { type: "owned_room_furnisher" }
  | { type: "rainbow_floor" };

/** Top-tier login-streak achievement - threshold resolved from env at runtime. */
export const SOCIAL_LOGIN_TOP_ACHIEVEMENT_ID = "social-login-top";

/** Sunny Side Up build milestone - threshold resolved from env at runtime (placeholder v1). */
export const SUNNY_SIDE_UP_ACHIEVEMENT_ID = "build-sunny-side-up";

/** Marathon I - distinct grid tiles walked (lifetime dedupe). */
export const MARATHON_I_ACHIEVEMENT_ID = "exploration-marathon-1";
export const MARATHON_II_ACHIEVEMENT_ID = "exploration-marathon-2";
export const MARATHON_III_ACHIEVEMENT_ID = "exploration-marathon-3";
export const GRAND_TOUR_ACHIEVEMENT_ID = "exploration-grand-tour";

export const ROOM_MAKER_DELUXE_ACHIEVEMENT_ID = "worldcraft-room-maker-deluxe";
export const RAINBOW_FLOOR_ACHIEVEMENT_ID = "worldcraft-rainbow-floor";
export const ROOM_FURNISHER_ACHIEVEMENT_ID = "worldcraft-room-furnisher";
export const TELEPORTER_ENGINEER_ACHIEVEMENT_ID = "worldcraft-teleporter-engineer";
export const BEAT_THE_CREATOR_ACHIEVEMENT_ID = "match-beat-the-creator";
export const THEY_HEARD_YOU_ACHIEVEMENT_ID = "social-they-heard-you";
export const POINT_HUNTER_I_ACHIEVEMENT_ID = "meta-point-hunter-1";
export const POINT_HUNTER_II_ACHIEVEMENT_ID = "meta-point-hunter-2";

/** Wallet address for Beat the Creator (win a Match against this player). */
export const BEAT_THE_CREATOR_WALLET =
  "NQ974M1T4TGDVC7FLHLQY2DY425N5CVHM02Y";

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  /** Optional display-only navigator grouping (e.g. minigames). */
  categoryGroup?: AchievementCategoryGroup;
  points: number;
  sortOrder: number;
  criteria: AchievementCriteria;
  /** Dedicated achievement-only cosmetic SKU granted on completion. */
  rewardSku?: string;
};

/** Achievement-exclusive cosmetics - reference Style Line variants (shop uses distinct SKUs later). */
export const ACHIEVEMENT_REWARD_CATALOG: ReadonlyArray<{
  cosmeticSku: string;
  presetId: string;
  displayName: string;
  description: string;
  sortOrder: number;
}> = [
  {
    cosmeticSku: "ach-trail-spark-cyan",
    presetId: "trail-ref-spark-cyan",
    displayName: "Spark Path: Cyan",
    description: "Unlocked by Commons Builder II.",
    sortOrder: 10,
  },
  {
    cosmeticSku: "ach-trail-spark-gold",
    presetId: "trail-ref-spark-path",
    displayName: "Spark Path: Gold",
    description: "Unlocked by Commons Builder III.",
    sortOrder: 20,
  },
  {
    cosmeticSku: "ach-trail-spark-violet",
    presetId: "trail-ref-spark-violet",
    displayName: "Spark Path: Violet",
    description: "Unlocked by Commons Builder IV.",
    sortOrder: 30,
  },
  {
    cosmeticSku: "ach-trail-spark-lime",
    presetId: "trail-ref-spark-lime",
    displayName: "Spark Path: Lime",
    description: "Unlocked by Miner II.",
    sortOrder: 40,
  },
  {
    cosmeticSku: "ach-trail-spark-rose",
    presetId: "trail-ref-spark-rose",
    displayName: "Spark Path: Rose",
    description: "Unlocked by Pixel Painter.",
    sortOrder: 50,
  },
  {
    cosmeticSku: "ach-aura-magic-ring",
    presetId: "aura-ref-magic-ring",
    displayName: "Magic Ring",
    description: "Unlocked by Miner IV.",
    sortOrder: 60,
  },
  {
    cosmeticSku: "ach-aura-sigil-magic-01",
    presetId: "aura-ref-sigil-magic-01",
    displayName: "Sigil: Magic 01",
    description: "Unlocked by First Victory.",
    sortOrder: 70,
  },
  {
    cosmeticSku: "ach-aura-sigil-magic-02",
    presetId: "aura-ref-sigil-magic-02",
    displayName: "Sigil: Magic 02",
    description: "Unlocked by Match Winner.",
    sortOrder: 80,
  },
  {
    cosmeticSku: "ach-aura-sigil-magic-03",
    presetId: "aura-ref-sigil-magic-03",
    displayName: "Sigil: Magic 03",
    description: "Unlocked by Throw Down.",
    sortOrder: 90,
  },
  {
    cosmeticSku: "ach-aura-sigil-magic-04",
    presetId: "aura-ref-sigil-magic-04",
    displayName: "Sigil: Magic 04",
    description: "Unlocked by Game On.",
    sortOrder: 100,
  },
  {
    cosmeticSku: "ach-aura-sigil-magic-05",
    presetId: "aura-ref-sigil-magic-05",
    displayName: "Sigil: Magic 05",
    description: "Unlocked by Golden Moment.",
    sortOrder: 110,
  },
  {
    cosmeticSku: "ach-aura-sigil-twirl-01",
    presetId: "aura-ref-sigil-twirl-01",
    displayName: "Sigil: Twirl 01",
    description: "Unlocked by Clean Sheet.",
    sortOrder: 120,
  },
  {
    cosmeticSku: "ach-aura-sigil-twirl-02",
    presetId: "aura-ref-sigil-twirl-02",
    displayName: "Sigil: Twirl 02",
    description: "Unlocked by On a Roll.",
    sortOrder: 130,
  },
  {
    cosmeticSku: "ach-aura-sigil-twirl-03",
    presetId: "aura-ref-sigil-twirl-03",
    displayName: "Sigil: Twirl 03",
    description: "Unlocked by Regular.",
    sortOrder: 140,
  },
];

/** Capstone cosmetic unlocks - reserved for Achievement Unlock Modal when wired on client. */
export const ACHIEVEMENT_COSMETIC_CAPSTONE_IDS: ReadonlySet<string> = new Set([
  "mine-500",
  "match-golden-goal",
  "match-clean-sheet",
]);

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
    categoryGroup: "building",
    points: 15,
    sortOrder: 95,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 1,
      roomScope: "commons",
    },
  },
  {
    id: "commons-place-10",
    title: "Commons Builder I",
    description: "Place 10 blocks in the Commons.",
    category: "commons_build",
    categoryGroup: "building",
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
    categoryGroup: "building",
    points: 50,
    sortOrder: 110,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 100,
      roomScope: "commons",
    },
    rewardSku: "ach-trail-spark-cyan",
  },
  {
    id: "commons-place-250",
    title: "Commons Builder III",
    description: "Place 250 blocks in the Commons.",
    category: "commons_build",
    categoryGroup: "building",
    points: 75,
    sortOrder: 120,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 250,
      roomScope: "commons",
    },
    rewardSku: "ach-trail-spark-gold",
  },
  {
    id: "commons-place-500",
    title: "Commons Builder IV",
    description: "Place 500 blocks in the Commons.",
    category: "commons_build",
    categoryGroup: "building",
    points: 100,
    sortOrder: 130,
    criteria: {
      type: "counter",
      counter: "blocks_placed_commons",
      threshold: 500,
      roomScope: "commons",
    },
    rewardSku: "ach-trail-spark-violet",
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
    rewardSku: "ach-trail-spark-lime",
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
    rewardSku: "ach-aura-magic-ring",
  },
  {
    id: "mining-impatient-miner",
    title: "Impatient Miner",
    description: "Direct-click an adjacent claimable block to mine it.",
    category: "mining",
    points: 10,
    sortOrder: 240,
    criteria: { type: "event", event: "impatient_miner" },
  },
  {
    id: "mining-dry-spell",
    title: "Dry Spell",
    description:
      "Try to mine a block on cooldown and see “There's no NIM left here :(” 10 times.",
    category: "mining",
    points: 15,
    sortOrder: 250,
    criteria: {
      type: "counter",
      counter: "mine_cooldown_attempts",
      threshold: 10,
    },
  },
  {
    id: SUNNY_SIDE_UP_ACHIEVEMENT_ID,
    title: "Sunny Side Up",
    description: "Place 7119 blocks.",
    category: "commons_build",
    categoryGroup: "building",
    points: 100,
    sortOrder: 140,
    criteria: {
      type: "counter",
      counter: "blocks_placed",
      threshold: 7119,
      roomScope: "any",
    },
  },
  {
    id: "pixel-we-made-this",
    title: "We made this",
    description: "Paint your first pixel on the Pixel room board.",
    category: "pixel",
    categoryGroup: "building",
    points: 10,
    sortOrder: 150,
    criteria: {
      type: "counter",
      counter: "pixels_painted",
      threshold: 1,
    },
  },
  {
    id: "pixel-64bit",
    title: "64bit",
    description: "Paint 64 pixels on the Pixel room board.",
    category: "pixel",
    categoryGroup: "building",
    points: 15,
    sortOrder: 160,
    criteria: {
      type: "counter",
      counter: "pixels_painted",
      threshold: 64,
    },
  },
  {
    id: "pixel-500",
    title: "Pixel Painter",
    description: "Paint 500 pixels on the Pixel room board.",
    category: "pixel",
    categoryGroup: "building",
    points: 35,
    sortOrder: 165,
    criteria: {
      type: "counter",
      counter: "pixels_painted",
      threshold: 500,
    },
    rewardSku: "ach-trail-spark-rose",
  },
  {
    id: "pixel-i-made-this",
    title: "I made this",
    description: "Paint 1000 pixels on the Pixel room board.",
    category: "pixel",
    categoryGroup: "building",
    points: 50,
    sortOrder: 170,
    criteria: {
      type: "counter",
      counter: "pixels_painted",
      threshold: 1000,
    },
  },
  {
    id: "pixel-corner-to-corner",
    title: "Corner to Corner",
    description: "Paint tiles in all four corners of the Pixel room board.",
    category: "pixel",
    categoryGroup: "building",
    points: 40,
    sortOrder: 180,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "pixel-corner:",
      threshold: 4,
    },
  },
  {
    id: "pixel-collaborator",
    title: "Collaborator",
    description:
      "Paint a tile next to another player's pixel while they are in the Pixel room.",
    category: "pixel",
    categoryGroup: "building",
    points: 25,
    sortOrder: 190,
    criteria: { type: "event", event: "pixel_collaborator" },
  },
  {
    id: "pixel-monochrome-discipline",
    title: "Monochrome Discipline",
    description:
      "Paint 64 pixels in a row using the same hue without changing color mid-run.",
    category: "pixel",
    categoryGroup: "building",
    points: 35,
    sortOrder: 200,
    criteria: {
      type: "streak_counter",
      counter: "pixel_monochrome_streak",
      threshold: 64,
      resetOn: "hue_change",
    },
  },
  {
    id: "match-first-win",
    title: "First Victory",
    description: "Win your first World Cup Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 1000,
    criteria: { type: "event", event: "match_won" },
    rewardSku: "ach-aura-sigil-magic-01",
  },
  {
    id: "match-first-loss",
    title: "Good Sport",
    description: "Lose your first World Cup Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 1010,
    criteria: { type: "event", event: "match_lost" },
  },
  {
    id: "match-first-draw",
    title: "Hard Fought",
    description: "Draw your first World Cup Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 1020,
    criteria: { type: "event", event: "match_draw" },
  },
  {
    id: "match-challenge-raised",
    title: "Throw Down",
    description: "Raise your first Challenge.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 5,
    sortOrder: 1030,
    criteria: { type: "event", event: "challenge_raised" },
    rewardSku: "ach-aura-sigil-magic-03",
  },
  {
    id: "match-challenge-accepted",
    title: "Game On",
    description: "Accept someone else's Challenge.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 5,
    sortOrder: 1040,
    criteria: { type: "event", event: "challenge_accepted" },
    rewardSku: "ach-aura-sigil-magic-04",
  },
  {
    id: "match-golden-goal",
    title: "Golden Moment",
    description: "Win a Match via Golden Goal.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 1050,
    criteria: { type: "event", event: "golden_goal_win" },
    rewardSku: "ach-aura-sigil-magic-05",
  },
  {
    id: "match-walkover",
    title: "Walkover",
    description: "Win because your opponent left the Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 5,
    sortOrder: 1060,
    criteria: { type: "event", event: "opponent_left_win" },
  },
  {
    id: "match-goals-headshot",
    title: "Headshot",
    description: "Score one goal in a single Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 1070,
    criteria: { type: "event", event: "match_goals_peak_1" },
  },
  {
    id: "match-goals-double",
    title: "Double Kill",
    description: "Score two goals in a single Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 1080,
    criteria: { type: "event", event: "match_goals_peak_2" },
  },
  {
    id: "match-goals-hattrick",
    title: "Three of a Kind",
    description: "Score three goals in a single Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 1090,
    criteria: { type: "event", event: "match_goals_peak_3" },
  },
  {
    id: "match-goals-five",
    title: "Why Not Make It Six?",
    description: "Score five goals in a single Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 30,
    sortOrder: 1100,
    criteria: { type: "event", event: "match_goals_peak_5" },
  },
  {
    id: "match-goals-ten",
    title: "Probably Cheating or Lag",
    description: "Score ten or more goals in a single Match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 50,
    sortOrder: 1110,
    criteria: { type: "event", event: "match_goals_peak_10" },
  },
  {
    id: "match-wins-1",
    title: "Match Winner",
    description: "Win 1 1v1 match.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 1120,
    criteria: { type: "counter", counter: "matches_won", threshold: 1 },
    rewardSku: "ach-aura-sigil-magic-02",
  },
  {
    id: "match-wins-10",
    title: "Match Winner X",
    description: "Win 10 1v1 matches.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 25,
    sortOrder: 1130,
    criteria: { type: "counter", counter: "matches_won", threshold: 10 },
  },
  {
    id: "match-wins-50",
    title: "Match Winner L",
    description: "Win 50 1v1 matches.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 50,
    sortOrder: 1140,
    criteria: { type: "counter", counter: "matches_won", threshold: 50 },
  },
  {
    id: "match-wins-100",
    title: "Match Winner C",
    description: "Win 100 1v1 matches.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 75,
    sortOrder: 1150,
    criteria: { type: "counter", counter: "matches_won", threshold: 100 },
  },
  {
    id: "match-wins-1000",
    title: "Match Winner M",
    description: "Win 1000 1v1 matches.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 100,
    sortOrder: 1160,
    criteria: { type: "counter", counter: "matches_won", threshold: 1000 },
  },
  {
    id: "match-played-10",
    title: "Regular",
    description: "Complete 10 1v1 matches.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 1170,
    criteria: { type: "counter", counter: "matches_played", threshold: 10 },
    rewardSku: "ach-aura-sigil-twirl-03",
  },
  {
    id: "match-streak-3",
    title: "On a Roll",
    description: "Win 3 1v1 matches in a row.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 1180,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 3 },
    rewardSku: "ach-aura-sigil-twirl-02",
  },
  {
    id: "match-streak-5",
    title: "Unstoppaball",
    description: "Win 5 1v1 matches in a row.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 25,
    sortOrder: 1190,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 5 },
  },
  {
    id: "match-streak-10",
    title: "Probably Cheating or Lag",
    description: "Win 10 1v1 matches in a row.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 50,
    sortOrder: 1200,
    criteria: { type: "counter", counter: "match_win_streak", threshold: 10 },
  },
  {
    id: "match-clean-sheet",
    title: "Clean Sheet",
    description: "Win a World Cup Match without conceding a goal.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 25,
    sortOrder: 1210,
    criteria: { type: "event", event: "match_clean_sheet" },
    rewardSku: "ach-aura-sigil-twirl-01",
  },
  {
    id: "match-comeback-kid",
    title: "Comeback Kid",
    description: "Win a Match after trailing by at least two goals.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 30,
    sortOrder: 1220,
    criteria: { type: "event", event: "match_comeback_win" },
  },
  {
    id: "match-golden-patience",
    title: "Golden Patience",
    description:
      "Win via Golden Goal after regulation ended tied - not in the first golden minute.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 25,
    sortOrder: 1230,
    criteria: { type: "event", event: "golden_patience_win" },
  },
  {
    id: "match-handshake-rival",
    title: "Handshake Rival",
    description:
      "Accept a Challenge from someone you already challenged earlier the same UTC day.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 1240,
    criteria: { type: "event", event: "handshake_rival" },
  },
  {
    id: "match-full-time",
    title: "Full Time",
    description:
      "Complete a Match through regulation and golden time without a walkover.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 1250,
    criteria: { type: "event", event: "match_full_time" },
  },
  {
    id: "match-own-goal-hero",
    title: "Own Goal Hero",
    description: "Score an own goal in a Match you still win.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 1260,
    criteria: { type: "event", event: "match_own_goal_win" },
  },
  {
    id: "field-first-goal",
    title: "Field Goal",
    description: "Score your first credited goal on the Free Play Field.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 2000,
    criteria: { type: "event", event: "field_goal_scored" },
  },
  {
    id: "field-goals-10",
    title: "Field Striker I",
    description: "Score 10 credited goals on the Free Play Field.",
    category: "football_free_play",
    categoryGroup: "minigames",
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
    category: "football_free_play",
    categoryGroup: "minigames",
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
    category: "football_free_play",
    categoryGroup: "minigames",
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
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 2040,
    criteria: { type: "event", event: "field_goal_contested" },
  },
  {
    id: "field-solo",
    title: "Practice Makes Perfect",
    description: "Score your first Solo Goal on the Free Play Field.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 10,
    sortOrder: 2050,
    criteria: { type: "event", event: "field_goal_solo" },
  },
  {
    id: "field-country",
    title: "Fly the Flag",
    description: "Pick a country in the Country Picker.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 5,
    sortOrder: 2060,
    criteria: { type: "event", event: "country_picked" },
  },
  {
    id: "field-flag-emote",
    title: "Represent",
    description: "Send your Flag Emote.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 5,
    sortOrder: 2070,
    criteria: { type: "event", event: "flag_emote_sent" },
  },
  {
    id: "field-rush-hour",
    title: "Rush Hour",
    description:
      "Score a Contested Free Play Field goal with at least four players on the pitch.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 25,
    sortOrder: 2075,
    criteria: { type: "event", event: "field_goal_rush_hour" },
  },
  {
    id: "field-daily-streak",
    title: "Daily Streak",
    description: "Score on three consecutive UTC calendar days on the Free Play Field.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 2078,
    criteria: {
      type: "counter",
      counter: "field_goal_daily_streak",
      threshold: 3,
    },
  },
  {
    id: "field-underdog-country",
    title: "Underdog Country",
    description:
      "Score for a country outside today's top three on the leaderboard.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 15,
    sortOrder: 2079,
    criteria: { type: "event", event: "field_underdog_country" },
  },
  {
    id: "mining-paid-in-full",
    title: "Paid in Full",
    description: "Receive at least 1 NIM from a Free Play Field goal payout.",
    category: "football_free_play",
    categoryGroup: "minigames",
    points: 20,
    sortOrder: 2080,
    criteria: { type: "event", event: "paid_in_full" },
  },
  {
    id: "social-feedback-first",
    title: "Voice Heard",
    description: "Submit your first feedback ticket.",
    category: "social",
    points: 5,
    sortOrder: 2990,
    criteria: { type: "event", event: "feedback_submitted" },
  },
  {
    id: "social-login-7",
    title: "Week Warrior",
    description: "Log in on 7 consecutive UTC calendar days.",
    category: "social",
    points: 15,
    sortOrder: 3000,
    criteria: { type: "login_streak", threshold: 7 },
  },
  {
    id: "social-login-30",
    title: "Monthly Devotee",
    description: "Log in on 30 consecutive UTC calendar days.",
    category: "social",
    points: 40,
    sortOrder: 3010,
    criteria: { type: "login_streak", threshold: 30 },
  },
  {
    id: SOCIAL_LOGIN_TOP_ACHIEVEMENT_ID,
    title: "Time of Kaan",
    description: "Log in on 54 consecutive UTC calendar days.",
    category: "social",
    points: 100,
    sortOrder: 3020,
    criteria: { type: "login_streak", threshold: 54 },
  },
  {
    id: "social-chatter-first",
    title: "Hello World",
    description: "Send your first in-game chat message.",
    category: "social",
    points: 5,
    sortOrder: 3025,
    criteria: {
      type: "counter",
      counter: "chat_messages_sent",
      threshold: 1,
    },
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
  {
    id: "mining-billboard-audience",
    title: "Billboard Audience",
    description:
      "Spend 60 seconds near a live campaign billboard while at least two players are in the room.",
    category: "misc",
    points: 25,
    sortOrder: 3100,
    criteria: {
      type: "counter",
      counter: "billboard_dwell_ms",
      threshold: 60_000,
    },
  },
  {
    id: MARATHON_I_ACHIEVEMENT_ID,
    title: "Marathon I",
    description: "Walk 1,000 distinct tiles in grid rooms.",
    category: "exploration",
    points: 25,
    sortOrder: 4000,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "tile:",
      threshold: 1000,
    },
  },
  {
    id: MARATHON_II_ACHIEVEMENT_ID,
    title: "Marathon II",
    description: "Walk 10,000 distinct tiles in grid rooms.",
    category: "exploration",
    points: 50,
    sortOrder: 4010,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "tile:",
      threshold: 10_000,
    },
  },
  {
    id: MARATHON_III_ACHIEVEMENT_ID,
    title: "Marathon III",
    description: "Walk 100,000 distinct tiles in grid rooms.",
    category: "exploration",
    points: 100,
    sortOrder: 4020,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "tile:",
      threshold: 100_000,
    },
  },
  {
    id: "exploration-room-tourist-1",
    title: "Room Tourist I",
    description: "Enter 5 unique rooms.",
    category: "exploration",
    points: 25,
    sortOrder: 4030,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "room:",
      threshold: 5,
    },
  },
  {
    id: "exploration-room-tourist-2",
    title: "Room Tourist II",
    description: "Enter 15 unique rooms.",
    category: "exploration",
    points: 50,
    sortOrder: 4040,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "room:",
      threshold: 15,
    },
  },
  {
    id: "exploration-room-tourist-3",
    title: "Room Tourist III",
    description: "Enter 30 unique rooms.",
    category: "exploration",
    points: 100,
    sortOrder: 4050,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "room:",
      threshold: 30,
    },
  },
  {
    id: GRAND_TOUR_ACHIEVEMENT_ID,
    title: "Grand Tour",
    description:
      "Visit the Hub, Commons, Pixel, Free Play Field, and The Shaper in one UTC day.",
    category: "exploration",
    points: 75,
    sortOrder: 4060,
    criteria: {
      type: "daily_set",
      requiredKeys: ["chamber", "hub", "pixel", "field", "cosmetic-gallery"],
      utcDayScope: true,
    },
  },
  {
    id: "exploration-door-crasher",
    title: "Door Crasher",
    description: "Use 10 different doors and teleporter portals.",
    category: "exploration",
    points: 40,
    sortOrder: 4070,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "door:",
      threshold: 10,
    },
  },
  {
    id: "exploration-teleporter-tourist",
    title: "Teleporter Tourist",
    description: "Ride a teleporter to 3 different destination rooms.",
    category: "exploration",
    points: 30,
    sortOrder: 4080,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "teleporter-dest:",
      threshold: 3,
    },
  },
  {
    id: "exploration-outfield-explorer",
    title: "Outfield Explorer",
    description:
      "Stand on 50 distinct outfield margin tiles on the Free Play Field.",
    category: "exploration",
    points: 40,
    sortOrder: 4090,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "outfield:",
      threshold: 50,
    },
  },
  {
    id: "worldcraft-palette-painter-1",
    title: "Palette Painter I",
    description: "Recolor 50 distinct floor tiles outside the Pixel room.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 25,
    sortOrder: 5000,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "recolor:",
      threshold: 50,
    },
  },
  {
    id: "worldcraft-palette-painter-2",
    title: "Palette Painter II",
    description: "Recolor 200 distinct floor tiles outside the Pixel room.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 50,
    sortOrder: 5010,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "recolor:",
      threshold: 200,
    },
  },
  {
    id: RAINBOW_FLOOR_ACHIEVEMENT_ID,
    title: "Rainbow Floor",
    description:
      "Use 12 distinct hues on floor tiles in one editable room.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 40,
    sortOrder: 5020,
    criteria: { type: "rainbow_floor" },
  },
  {
    id: "worldcraft-architect-toolkit",
    title: "Architect's Toolkit",
    description:
      "Place at least one cube, hex, pyramid, sphere, and ramp block.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 35,
    sortOrder: 5030,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "shape:",
      threshold: 5,
    },
  },
  {
    id: "worldcraft-prefab-author",
    title: "Prefab Author",
    description: "Publish your first public object prefab.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 30,
    sortOrder: 5040,
    criteria: { type: "event", event: "prefab_author" },
  },
  {
    id: "worldcraft-prefab-curator",
    title: "Prefab Curator",
    description:
      "Have 5 public prefabs each placed at least once by another player.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 75,
    sortOrder: 5050,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "prefab-adoption:",
      threshold: 5,
    },
  },
  {
    id: "worldcraft-signpost-scribe",
    title: "Signpost Scribe",
    description: "Place a signpost with a message of at least 40 characters.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 20,
    sortOrder: 5060,
    criteria: { type: "event", event: "signpost_scribe" },
  },
  {
    id: "worldcraft-signpost-reader",
    title: "Signpost Reader",
    description: "Open 10 distinct signposts authored by other players.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 30,
    sortOrder: 5070,
    criteria: {
      type: "dedupe_count",
      seenPrefix: "signpost-read:",
      threshold: 10,
    },
  },
  {
    id: "worldcraft-gatekeeper",
    title: "Gatekeeper",
    description: "Open a gate you do not own in the Hub.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 15,
    sortOrder: 5080,
    criteria: { type: "event", event: "gatekeeper" },
  },
  {
    id: "worldcraft-trust-circle",
    title: "Trust Circle",
    description:
      "Walk through someone else's gate while you are on their access list.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 25,
    sortOrder: 5090,
    criteria: { type: "event", event: "trust_circle" },
  },
  {
    id: ROOM_MAKER_DELUXE_ACHIEVEMENT_ID,
    title: "Room Maker Deluxe",
    description:
      "Create a room and furnish it with 25 blocks, a join spawn, and 5 recolored floor tiles.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 50,
    sortOrder: 5100,
    criteria: { type: "room_maker_deluxe" },
  },
  {
    id: TELEPORTER_ENGINEER_ACHIEVEMENT_ID,
    title: "Teleporter Engineer",
    description:
      "Place a teleporter and set its destination so it is ready to use.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 30,
    sortOrder: 5110,
    criteria: { type: "event", event: "teleporter_activated" },
  },
  {
    id: ROOM_FURNISHER_ACHIEVEMENT_ID,
    title: "Room Furnisher",
    description:
      "Place 150 blocks in a room you own using at least 10 different colors.",
    category: "worldcraft",
    categoryGroup: "building",
    points: 60,
    sortOrder: 5120,
    criteria: { type: "owned_room_furnisher" },
  },
  {
    id: BEAT_THE_CREATOR_ACHIEVEMENT_ID,
    title: "Beat the Creator",
    description: "Win a World Cup Match against the creator.",
    category: "football_match",
    categoryGroup: "minigames",
    points: 50,
    sortOrder: 1270,
    criteria: { type: "event", event: "beat_the_creator" },
  },
  {
    id: THEY_HEARD_YOU_ACHIEVEMENT_ID,
    title: "They Heard You",
    description: "Read an admin reply on one of your feedback tickets.",
    category: "social",
    points: 15,
    sortOrder: 2985,
    criteria: { type: "event", event: "feedback_reply_seen" },
  },
  {
    id: POINT_HUNTER_I_ACHIEVEMENT_ID,
    title: "Point Hunter I",
    description: "Earn 500 achievement points.",
    category: "meta",
    points: 25,
    sortOrder: 6000,
    criteria: { type: "ap_threshold", threshold: 500 },
  },
  {
    id: POINT_HUNTER_II_ACHIEVEMENT_ID,
    title: "Point Hunter II",
    description: "Earn 1000 achievement points.",
    category: "meta",
    points: 50,
    sortOrder: 6010,
    criteria: { type: "ap_threshold", threshold: 1000 },
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
const definitionsByDedupePrefix = new Map<string, AchievementDefinition[]>();
const definitionsByStreakCounter = new Map<
  AchievementCounterKey,
  AchievementDefinition[]
>();
const dailySetAchievements: AchievementDefinition[] = [];
const loginStreakAchievements: AchievementDefinition[] = [];
const apThresholdAchievements: AchievementDefinition[] = [];

for (const def of ACHIEVEMENT_DEFINITIONS) {
  if (def.criteria.type === "event") {
    const list = definitionsByEvent.get(def.criteria.event) ?? [];
    list.push(def);
    definitionsByEvent.set(def.criteria.event, list);
  } else if (def.criteria.type === "counter") {
    const list = definitionsByCounter.get(def.criteria.counter) ?? [];
    list.push(def);
    definitionsByCounter.set(def.criteria.counter, list);
  } else if (def.criteria.type === "login_streak") {
    loginStreakAchievements.push(def);
  } else if (def.criteria.type === "ap_threshold") {
    apThresholdAchievements.push(def);
  } else if (def.criteria.type === "dedupe_count") {
    const list = definitionsByDedupePrefix.get(def.criteria.seenPrefix) ?? [];
    list.push(def);
    definitionsByDedupePrefix.set(def.criteria.seenPrefix, list);
  } else if (def.criteria.type === "daily_set") {
    dailySetAchievements.push(def);
  } else if (def.criteria.type === "streak_counter") {
    const list = definitionsByStreakCounter.get(def.criteria.counter) ?? [];
    list.push(def);
    definitionsByStreakCounter.set(def.criteria.counter, list);
  }
}

export function listDailySetAchievements(): ReadonlyArray<AchievementDefinition> {
  return dailySetAchievements;
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

export function listLoginStreakAchievements(): ReadonlyArray<AchievementDefinition> {
  return loginStreakAchievements;
}

export function listApThresholdAchievements(): ReadonlyArray<AchievementDefinition> {
  return apThresholdAchievements;
}

export function listAchievementsForDedupePrefix(
  seenPrefix: string
): ReadonlyArray<AchievementDefinition> {
  return definitionsByDedupePrefix.get(seenPrefix) ?? [];
}

export function listAchievementsForStreakCounter(
  counter: AchievementCounterKey
): ReadonlyArray<AchievementDefinition> {
  return definitionsByStreakCounter.get(counter) ?? [];
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
