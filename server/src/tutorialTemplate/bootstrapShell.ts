import type { BuildShell, BuildShellObstacle } from "../playSpaceTemplate/buildShell.js";
import { BUILD_SHELL_VERSION } from "../playSpaceTemplate/buildShell.js";
import { blockKey } from "../grid.js";
import type { TerrainProps } from "../grid.js";
import { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID } from "../tutorial/roomIds.js";

/**
 * Portrait Tutorial Path footprint (7 wide × 15 deep).
 * Learners walk south → north: Mine → Pay gate → Exit.
 * @see docs/adr/0006-tutorial-room-portrait-path.md
 */
export const TUTORIAL_DEFAULT_BOUNDS = {
  minX: -3,
  maxX: 3,
  minZ: -7,
  maxZ: 7,
} as const;

const COLOR = {
  wall: 0x4b5563,
  wallTop: 0x64748b,
  hex: 0x38bdf8,
  half: 0x475569,
  mine: 0xf59e0b,
  gate: 0x22c55e,
  path: 0x0f766e,
} as const;

/** Geometric mid of Z -7..7. */
const GATE_Z = 0;
const EXIT = { x: 0, z: 1 } as const;
const JOIN_SPAWN = { x: 0, z: -6 } as const;
const MINE_Z = -5;

function baseProps(overrides: Partial<TerrainProps> & Pick<TerrainProps, "colorRgb">): TerrainProps {
  return {
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
    locked: false,
    ...overrides,
  };
}

function obstacle(x: number, z: number, y: number, props: TerrainProps): BuildShellObstacle {
  return { tile: blockKey(x, z, y), props };
}

function buildTutorialPathObstacles(): BuildShellObstacle[] {
  const out: BuildShellObstacle[] = [];
  const { minX, maxX, minZ, maxZ } = TUTORIAL_DEFAULT_BOUNDS;

  // East / west corridor walls (y=0 + y=1 rim).
  for (let z = minZ; z <= maxZ; z++) {
    for (const x of [minX, maxX] as const) {
      out.push(obstacle(x, z, 0, baseProps({ colorRgb: COLOR.wall })));
      out.push(obstacle(x, z, 1, baseProps({ colorRgb: COLOR.wallTop })));
    }
  }

  // Closed south wall behind spawn.
  for (let x = minX + 1; x <= maxX - 1; x++) {
    out.push(obstacle(x, minZ, 0, baseProps({ colorRgb: COLOR.wall })));
    out.push(obstacle(x, minZ, 1, baseProps({ colorRgb: COLOR.wallTop })));
  }

  // U-alcove: decorative cheeks above spawn flanks (y=1 only so the floor stays walkable),
  // plus short arms north of the mine row (inset) so the three slots read as a pocket.
  for (const x of [-2, 2] as const) {
    out.push(obstacle(x, JOIN_SPAWN.z, 1, baseProps({ colorRgb: COLOR.wallTop })));
  }
  for (const x of [-1, 1] as const) {
    out.push(obstacle(x, MINE_Z + 1, 0, baseProps({ colorRgb: COLOR.wall })));
  }

  // Three Tutorial Mine Slots inside the alcove (south band).
  for (const x of [-1, 0, 1] as const) {
    out.push(
      obstacle(
        x,
        MINE_Z,
        0,
        baseProps({
          colorRgb: COLOR.mine,
          pyramid: true,
          tutorialMineSlot: true,
          claimable: true,
          active: true,
        })
      )
    );
  }

  // Sparse hex pillars and half ledges along the walk (not in the lane center).
  out.push(obstacle(-2, -2, 0, baseProps({ colorRgb: COLOR.hex, hex: true })));
  out.push(obstacle(2, -1, 0, baseProps({ colorRgb: COLOR.hex, hex: true })));
  out.push(obstacle(-2, 3, 0, baseProps({ colorRgb: COLOR.half, half: true })));
  out.push(obstacle(2, 4, 0, baseProps({ colorRgb: COLOR.half, half: true })));

  // Pay choke at mid Z: solid cubes with a center gate; exit lands north.
  for (const x of [-2, -1, 1, 2] as const) {
    out.push(obstacle(x, GATE_Z, 0, baseProps({ colorRgb: COLOR.wall })));
  }
  out.push(
    obstacle(
      0,
      GATE_Z,
      0,
      baseProps({
        colorRgb: COLOR.gate,
        gate: {
          adminAddress: "SYSTEM",
          authorizedAddresses: ["SYSTEM"],
          exitX: EXIT.x,
          exitZ: EXIT.z,
        },
      })
    )
  );

  return out;
}

function buildPathFloor(): BuildShell["extraFloor"] {
  const tiles: BuildShell["extraFloor"] = [];
  // Tint from spawn through exit landing and a short north pad in the exit band.
  for (let z = JOIN_SPAWN.z; z <= EXIT.z + 2; z++) {
    for (let x = -1; x <= 1; x++) {
      tiles.push({ x, z, colorRgb: COLOR.path });
    }
  }
  return tiles;
}

export function buildDefaultTutorialBootstrapShell(): BuildShell {
  return {
    version: BUILD_SHELL_VERSION,
    bounds: { ...TUTORIAL_DEFAULT_BOUNDS },
    obstacles: buildTutorialPathObstacles(),
    extraFloor: buildPathFloor(),
    baseFloorColors: [],
    removedBaseFloor: [],
    backgroundHueDeg: 200,
    backgroundNeutral: null,
    joinSpawn: { ...JOIN_SPAWN },
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
