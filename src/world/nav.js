/**
 * Walking map of the classroom floor: a grid of small squares marked free or
 * blocked (furniture, walls), plus A* path finding so students walk around
 * desks instead of through them.
 */
export class NavGrid {
  constructor({ minX, maxX, minZ, maxZ, cell = 0.25 }) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.freeCells = [];
    // scratch buffers for A*
    const n = this.cols * this.rows;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.state = new Uint8Array(n); // 0 new, 1 open, 2 closed
    this.heap = [];
  }

  /**
   * @param {{minX: number, maxX: number, minZ: number, maxZ: number}[]} rects furniture footprints
   * @param {number} inflate keep this far away from furniture
   */
  setObstacles(rects, inflate = 0.28) {
    this.blocked.fill(0);
    for (const r of rects) {
      const c0 = Math.max(0, Math.floor((r.minX - inflate - this.minX) / this.cell));
      const c1 = Math.min(this.cols - 1, Math.floor((r.maxX + inflate - this.minX) / this.cell));
      const r0 = Math.max(0, Math.floor((r.minZ - inflate - this.minZ) / this.cell));
      const r1 = Math.min(this.rows - 1, Math.floor((r.maxZ + inflate - this.minZ) / this.cell));
      for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) this.blocked[row * this.cols + col] = 1;
    }
    this.freeCells = [];
    for (let i = 0; i < this.blocked.length; i++) if (!this.blocked[i]) this.freeCells.push(i);
  }

  indexAt(x, z) {
    const col = Math.floor((x - this.minX) / this.cell);
    const row = Math.floor((z - this.minZ) / this.cell);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  center(i) {
    return {
      x: this.minX + ((i % this.cols) + 0.5) * this.cell,
      z: this.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell,
    };
  }

  isFree(x, z) {
    const i = this.indexAt(x, z);
    return i >= 0 && !this.blocked[i];
  }

  /** Closest free square to a point (searches outward in rings). */
  nearestFreeIndex(x, z) {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)));
    if (!this.blocked[row * this.cols + col]) return row * this.cols + col;
    for (let ring = 1; ring < 30; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols || this.blocked[r * this.cols + c]) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = r * this.cols + c;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  nearestFree(x, z) {
    const i = this.nearestFreeIndex(x, z);
    return i < 0 ? null : this.center(i);
  }

  randomFree() {
    const i = this.freeCells[Math.floor(Math.random() * this.freeCells.length)];
    const p = this.center(i);
    const j = this.cell * 0.4;
    return { x: p.x + (Math.random() - 0.5) * j, z: p.z + (Math.random() - 0.5) * j };
  }

  /** True if a straight walk from a to b stays on free squares. */
  lineOfSight(a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(dist / (this.cell * 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /**
   * Waypoints from `from` to `to` (not including the start), smoothed into
   * straight runs. Either end may be inside furniture (a chair seat): the
   * path goes to the nearest free square, then steps straight in.
   * Returns null if there is no way through.
   */
  findPath(from, to) {
    const start = this.nearestFreeIndex(from.x, from.z);
    const goal = this.nearestFreeIndex(to.x, to.z);
    if (start < 0 || goal < 0) return null;
    const cells = this.astar(start, goal);
    if (!cells) return null;

    const points = [{ x: from.x, z: from.z }, ...cells.map((i) => this.center(i)), { x: to.x, z: to.z }];
    // string-pulling: skip every waypoint we can walk straight past
    const out = [];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !this.lineOfSight(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out;
  }

  astar(start, goal) {
    const { cols, g, parent, state } = this;
    state.fill(0);
    const heap = this.heap;
    heap.length = 0;
    const gx = goal % cols;
    const gz = Math.floor(goal / cols);
    const h = (i) => {
      const dx = Math.abs((i % cols) - gx);
      const dz = Math.abs(Math.floor(i / cols) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); // octile distance
    };
    g[start] = 0;
    parent[start] = -1;
    state[start] = 1;
    heapPush(heap, start, h(start));

    while (heap.length) {
      const cur = heapPop(heap);
      if (cur === goal) {
        const path = [];
        for (let i = goal; i !== -1; i = parent[i]) path.push(i);
        return path.reverse();
      }
      if (state[cur] === 2) continue;
      state[cur] = 2;
      const cc = cur % cols;
      const cr = Math.floor(cur / cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const c = cc + dc;
          const r = cr + dr;
          if (c < 0 || r < 0 || c >= cols || r >= this.rows) continue;
          const n = r * cols + c;
          if (this.blocked[n] || state[n] === 2) continue;
          // no cutting corners past furniture
          if (dr && dc && (this.blocked[cr * cols + c] || this.blocked[r * cols + cc])) continue;
          const cost = g[cur] + (dr && dc ? 1.414 : 1);
          if (state[n] === 1 && cost >= g[n]) continue;
          g[n] = cost;
          parent[n] = cur;
          state[n] = 1;
          heapPush(heap, n, cost + h(n));
        }
      }
    }
    return null;
  }
}

// --- tiny binary heap of [priority, index] pairs -------------------------
function heapPush(heap, index, priority) {
  heap.push([priority, index]);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p][0] <= heap[i][0]) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}

function heapPop(heap) {
  const top = heap[0][1];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}
