import type { BuildShell } from "../playSpaceTemplate/buildShell.js";
import { BUILD_SHELL_VERSION } from "../playSpaceTemplate/buildShell.js";
import { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID } from "../tutorial/roomIds.js";

/** Default bounds for tutorial rooms before a template is published. */
export const TUTORIAL_DEFAULT_BOUNDS = {
  minX: -4,
  maxX: 4,
  minZ: -4,
  maxZ: 4,
} as const;

export function buildDefaultTutorialBootstrapShell(): BuildShell {
  return {
    version: BUILD_SHELL_VERSION,
    bounds: { ...TUTORIAL_DEFAULT_BOUNDS },
    obstacles: [
      {
        tile: "-2,0,0",
        props: {
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: true,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          cubeRotX: 0,
          cubeRotY: 0,
          cubeRotZ: 0,
          colorRgb: 0xf59e0b,
          locked: false,
          tutorialMineSlot: true,
          claimable: true,
          active: true,
        },
      },
      {
        tile: "0,0,0",
        props: {
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: true,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          cubeRotX: 0,
          cubeRotY: 0,
          cubeRotZ: 0,
          colorRgb: 0xf59e0b,
          locked: false,
          tutorialMineSlot: true,
          claimable: true,
          active: true,
        },
      },
      {
        tile: "2,0,0",
        props: {
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: true,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          cubeRotX: 0,
          cubeRotY: 0,
          cubeRotZ: 0,
          colorRgb: 0xf59e0b,
          locked: false,
          tutorialMineSlot: true,
          claimable: true,
          active: true,
        },
      },
      {
        tile: "3,-2,0",
        props: {
          passable: false,
          half: false,
          quarter: false,
          hex: false,
          pyramid: false,
          pyramidBaseScale: 1,
          hexRadiusScale: 1,
          sphere: false,
          sphereRadiusScale: 1,
          ramp: false,
          rampDir: 0,
          cubeRotX: 0,
          cubeRotY: 0,
          cubeRotZ: 0,
          colorRgb: 0x22c55e,
          locked: false,
          gate: {
            adminAddress: "SYSTEM",
            authorizedAddresses: ["SYSTEM"],
            exitX: 3,
            exitZ: -1,
          },
        },
      },
    ],
    extraFloor: [],
    baseFloorColors: [],
    removedBaseFloor: [],
    backgroundHueDeg: 200,
    backgroundNeutral: null,
    joinSpawn: { x: -3, z: 0 },
  };
}

export function isValidTutorialTemplateSourceRoom(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return id === TUTORIAL_STAGING_ROOM_ID;
}

export function isTutorialTemplateRuntimeRoom(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return id === TUTORIAL_ROOM_ID || id === TUTORIAL_STAGING_ROOM_ID;
}
