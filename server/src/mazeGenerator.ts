/**
 * Maze generator for the canvas room
 * Uses recursive backtracking to create a perfect maze with one solution
 */

type MazeCell = {
  x: number;
  z: number;
  walls: {
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
  };
  visited: boolean;
};

/**
 * Generate a maze using recursive backtracking algorithm
 * Returns a set of wall coordinates (obstacles to place)
 */
export function generateMaze(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  spawnX: number,
  spawnZ: number,
  exitX: number,
  exitZ: number,
  seed: number
): Set<string> {
  // Simple seeded random number generator
  let rngState = seed;
  const random = (): number => {
    rngState = (rngState * 1664525 + 1013904223) | 0;
    return Math.abs(rngState) / 2147483648;
  };

  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  };

  // Calculate maze dimensions - we'll use every other tile for cells
  // This creates corridors between walls
  const cellWidth = Math.floor((maxX - minX + 1) / 2);
  const cellHeight = Math.floor((maxZ - minZ + 1) / 2);

  // Initialize cells
  const cells: MazeCell[][] = [];
  for (let z = 0; z < cellHeight; z++) {
    cells[z] = [];
    for (let x = 0; x < cellWidth; x++) {
      cells[z]![x] = {
        x,
        z,
        walls: { north: true, south: true, east: true, west: true },
        visited: false,
      };
    }
  }

  // Helper to get cell at grid position
  const getCell = (x: number, z: number): MazeCell | undefined => {
    if (x < 0 || x >= cellWidth || z < 0 || z >= cellHeight) return undefined;
    return cells[z]?.[x];
  };

  // Recursive backtracking maze generation
  const carvePath = (x: number, z: number): void => {
    const cell = getCell(x, z);
    if (!cell || cell.visited) return;

    cell.visited = true;

    // Randomize direction order
    const directions = shuffle([
      { dx: 0, dz: -1, dir: "north" as const, opposite: "south" as const },
      { dx: 0, dz: 1, dir: "south" as const, opposite: "north" as const },
      { dx: 1, dz: 0, dir: "east" as const, opposite: "west" as const },
      { dx: -1, dz: 0, dir: "west" as const, opposite: "east" as const },
    ]);

    for (const { dx, dz, dir, opposite } of directions) {
      const nx = x + dx;
      const nz = z + dz;
      const neighbor = getCell(nx, nz);

      if (neighbor && !neighbor.visited) {
        // Remove walls between current cell and neighbor
        cell.walls[dir] = false;
        neighbor.walls[opposite] = false;
        carvePath(nx, nz);
      }
    }
  };

  // Start carving from a random cell
  const startCellX = Math.floor(random() * cellWidth);
  const startCellZ = Math.floor(random() * cellHeight);
  carvePath(startCellX, startCellZ);

  // Convert maze cells to obstacle walls
  const walls = new Set<string>();

  // Helper to convert cell coords to world coords
  const cellToWorld = (cx: number, cz: number): { x: number; z: number } => ({
    x: minX + cx * 2 + 1,
    z: minZ + cz * 2 + 1,
  });

  // Place walls based on cell walls
  for (let cz = 0; cz < cellHeight; cz++) {
    for (let cx = 0; cx < cellWidth; cx++) {
      const cell = cells[cz]?.[cx];
      if (!cell) continue;

      const world = cellToWorld(cx, cz);

      // Place walls
      if (cell.walls.north && cz > 0) {
        // Wall above this cell
        walls.add(`${world.x},${world.z - 1}`);
      }
      if (cell.walls.south && cz < cellHeight - 1) {
        // Wall below this cell
        walls.add(`${world.x},${world.z + 1}`);
      }
      if (cell.walls.east && cx < cellWidth - 1) {
        // Wall to the right
        walls.add(`${world.x + 1},${world.z}`);
      }
      if (cell.walls.west && cx > 0) {
        // Wall to the left
        walls.add(`${world.x - 1},${world.z}`);
      }

      // Add corner walls to make it look nicer
      if (cell.walls.north && cell.walls.west) {
        walls.add(`${world.x - 1},${world.z - 1}`);
      }
      if (cell.walls.north && cell.walls.east) {
        walls.add(`${world.x + 1},${world.z - 1}`);
      }
      if (cell.walls.south && cell.walls.west) {
        walls.add(`${world.x - 1},${world.z + 1}`);
      }
      if (cell.walls.south && cell.walls.east) {
        walls.add(`${world.x + 1},${world.z + 1}`);
      }
    }
  }

  // Add perimeter walls
  for (let x = minX; x <= maxX; x++) {
    walls.add(`${x},${minZ}`);
    walls.add(`${x},${maxZ}`);
  }
  for (let z = minZ; z <= maxZ; z++) {
    walls.add(`${minX},${z}`);
    walls.add(`${maxX},${z}`);
  }

  // Ensure spawn and exit are not blocked
  walls.delete(`${spawnX},${spawnZ}`);
  walls.delete(`${exitX},${exitZ}`);

  // Clear path around spawn
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      walls.delete(`${spawnX + dx},${spawnZ + dz}`);
    }
  }

  // Clear path to exit
  walls.delete(`${exitX},${exitZ - 1}`);
  walls.delete(`${exitX},${exitZ + 1}`);
  walls.delete(`${exitX - 1},${exitZ}`);
  walls.delete(`${exitX + 1},${exitZ}`);

  console.log(`[maze] Generated maze with ${walls.size} wall blocks`);
  return walls;
}
