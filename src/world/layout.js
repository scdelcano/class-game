/*
 * Where everything goes. One unit ≈ one foot-ish; a chibi kid is ~1.3 tall.
 * Top view (camera looks from the front-right corner):
 *
 *            back wall (z = -6): bookshelf · chalkboard · teacher desk · plant
 *   left     ┌──────────────────────────────────────────────┐
 *   wall     │ rug   [board ]                  [teacher]    │
 *   windows  │                                              │
 *   cubbies  │        desks: 5 columns × 4 rows             │  (open side)
 *   door     │                                              │
 *            └──────────────────────────────────────────────┘
 *                               (open front)
 * Students sit facing the board (-z).
 */

export const ROOM = { width: 16, depth: 12, height: 5.5, wall: 0.35 };
export const HALF_W = ROOM.width / 2;
export const HALF_D = ROOM.depth / 2;

export const MAX_SEATS = 20;
export const START_SEATS = 12;

/** Direction a seated student faces (rotation around y; 0 = facing +z). */
export const SEAT_FACING = Math.PI;

const SEAT_COLUMNS = [1.6, -0.4, 3.6, -2.4, 5.6]; // filled centre-out
const SEAT_ROWS = [-1.3, 0.6, 2.5, 4.4]; // filled front (board) to back

/** Desk spots in the order they are filled as students are added. */
export const SEAT_SLOTS = SEAT_ROWS.flatMap((z) => SEAT_COLUMNS.map((x) => ({ x, z })));

export const PLACES = {
  board: { x: 0 },
  teacherDesk: { x: 4.6, z: -4.2 },
  clock: { x: 5.3, y: 4.35 },
  bookshelf: { x: -5.6 },
  rug: { x: -5.3, z: -3.2, r: 1.9 },
  cubbies: { z: 2.1, length: 4.2 },
  fishbowl: { z: 0.6 },
  door: { z: 5.0 },
  windows: [-3.2, 1.9],
  plant: { x: 7.1, z: -5.2 },
  posters: [
    { kind: 'kind', wall: 'back', x: -5.6, y: 3.3 },
    { kind: 'shapes', wall: 'back', x: 6.9, y: 3.6 },
    { kind: 'rainbow', wall: 'left', z: -0.65, y: 3.2 },
    { kind: 'numbers', wall: 'left', z: 4.95, y: 4.3, small: true },
  ],
};

/** Part of the floor students can walk on (inside the walls, with a margin). */
export const WALK_AREA = { minX: -HALF_W + 0.35, maxX: HALF_W - 0.35, minZ: -HALF_D + 0.35, maxZ: HALF_D - 0.3 };

/** Where new students walk in (just inside the door). */
export const DOOR_SPOT = { x: -HALF_W + 0.7, z: PLACES.door.z };

/**
 * Fun places students like to wander to during free play.
 * Add more to make them visit new corners.
 */
export const HOTSPOTS = [
  { x: -5.3, z: -3.2 }, // reading rug
  { x: -4.6, z: -2.6 }, // edge of the rug
  { x: -5.6, z: -4.9 }, // bookshelf
  { x: -6.9, z: 0.6 }, // fish bowl
  { x: -6.8, z: -3.2 }, // window
  { x: -6.8, z: 2.0 }, // cubbies
  { x: 0, z: -4.7 }, // chalkboard
  { x: 2.2, z: -4.8 }, // chalkboard
  { x: 4.6, z: -3.0 }, // teacher's desk
  { x: 6.4, z: -4.3 }, // plant
  { x: 6.9, z: 2.5 }, // open corner
  { x: 3.0, z: 5.4 }, // front
  { x: -3.8, z: 4.8 }, // front
];

/**
 * Furniture footprints (axis-aligned rectangles on the floor) that walking
 * students must go around. Chairs are left out: students walk to them to sit.
 */
export function getObstacles(seatCount) {
  const rects = [
    { minX: 3.35, maxX: 5.85, minZ: -6, maxZ: -3.65 }, // teacher desk + chair
    { minX: -6.8, maxX: -4.4, minZ: -6, maxZ: -5.45 }, // bookshelf
    { minX: -8, maxX: -7.25, minZ: 0, maxZ: 4.2 }, // cubbies
    { minX: 6.7, maxX: 7.5, minZ: -5.6, maxZ: -4.8 }, // plant
  ];
  for (const { x, z } of SEAT_SLOTS.slice(0, seatCount)) {
    rects.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.375, maxZ: z + 0.375 });
  }
  return rects;
}
