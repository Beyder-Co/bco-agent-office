/* =============================================================================
   80 · NAVIGATION & MOVEMENT — calm walks along the aisles
   -----------------------------------------------------------------------------
   Three east–west aisles (behind the back row, between the rows, in front of the
   front row), corridors between neighbouring desks, and the places idle agents
   visit. Walkers follow shortest paths, turn smoothly, give way to each other
   (the one behind slows; two meeting head-on both keep right), and approach
   every seat from the open side — round a bench's end, between chairs, in front
   of an armchair — never through the furniture. The glass door slides.
   Nobody shuttles: progress toward the goal is measured, and a walker that stops
   gaining ground resolves it once, calmly — the lower rank steps aside and waits
   for the other to pass; someone standing idle in the way shuffles aside; seated
   legs tuck in and the passer squeezes by; anything else is walked round.
   ============================================================================= */

const NAV = { nodes: {}, adj: {} };
function navNode(id, x, z) {
  NAV.nodes[id] = { id, x, z };
  NAV.adj[id] = NAV.adj[id] || [];
}
function navLink(a, b) {
  if (!NAV.adj[a].includes(b)) NAV.adj[a].push(b);
  if (!NAV.adj[b].includes(a)) NAV.adj[b].push(a);
}
const navChain = ids => ids.forEach((id, i) => i && navLink(ids[i - 1], id));

/** Where each slot's agent steps out to (beside the desk, on the open side). */
const SLOT_EXIT = {};
/** A seated agent's step-out point, relative to its seat (the station is turned by STATION_YAW). */
const EXIT_LOCAL = [-0.86, 0.08];
const exitOffset = () => {
  const c = Math.cos(STATION_YAW), s = Math.sin(STATION_YAW);
  return [EXIT_LOCAL[0] * c + EXIT_LOCAL[1] * s, -EXIT_LOCAL[0] * s + EXIT_LOCAL[1] * c];
};
/** The Market Room: the aisle behind the watching chairs (halfway between the glass and the chair backs), and the step between two chairs. */
const BOARD_STEP = 0.5;
const BOARD_AISLE_Z = () => (ROOM.board.zEdge + ROOM.board.tz + 0.84 + 0.25) / 2;
/** World x-extent of a station around its seat (desk, a chair pushed back, the figure). */
const STATION_SPAN = [-0.6, 1.26];

function buildNav() {
  const BZ = -3.15, MZ = 0.13, FZ = 3.2;
  const OZ = ROOM.board.zEdge + 0.35, IZ = BOARD_AISLE_Z(); // outside and inside the Market Room's south glass
  const S = ROOM.slots;
  const back = [0, 1, 2, 3, 9], front = [8, 4, 5, 6, 7];
  const [ex, ez] = exitOffset();
  const corridors = idx => {
    const xs = idx.map(i => S[i].x).sort((a, b) => a - b);
    const out = [];
    for (let k = 0; k < xs.length - 1; k++) {
      const a = xs[k] + STATION_SPAN[1], b = xs[k + 1] + STATION_SPAN[0];
      if (b - a > 0.7) out.push((a + b) / 2);
    }
    return out;
  };
  const rowNodes = (prefix, z, list) => {
    list.sort((a, b) => a[1] - b[1]);
    list.forEach(([id, x]) => navNode(id, x, z));
    navChain(list.map(n => n[0]));
  };

  // the middle aisle runs from the lift, through the door, to the east glass
  const mid = [['LIFT', -10.25], ['VEST', -8.9], ['DOOR_IN', -7.4], ['M_w', -6.55]];
  const backCor = corridors(back), frontCor = corridors(front);
  backCor.forEach((x, k) => mid.push(['M_kb' + k, x]));
  frontCor.forEach((x, k) => mid.push(['M_kf' + k, x]));
  mid.push(['M_e', 7.15]);
  back.forEach(i => mid.push(['M_x' + i, S[i].x + ex]));
  rowNodes('M', MZ, mid);

  // the back aisle, west of the Market Room
  const bk = [['B_w', -6.55], ['B_srv', ROOM.server.x], ['B_fl', -2.0], ['B_fr', 2.0], ['B_e', 3.1]];
  backCor.forEach((x, k) => x < 3.05 && bk.push(['B_kb' + k, x]));
  rowNodes('B', BZ, bk);

  // the front aisle, from the lounge to the east glass
  const fr = [['L1', -6.55], ['F_lc', -4.75], ['F_read', ROOM.reading.x], ['F_e', 7.15]];
  frontCor.forEach((x, k) => fr.push(['F_kf' + k, x]));
  front.forEach(i => fr.push(['F_x' + i, S[i].x + ex]));
  rowNodes('F', FZ, fr);

  // corridors between desks
  navLink('M_w', 'B_w');
  navLink('M_w', 'L1');
  navLink('M_e', 'F_e');
  backCor.forEach((x, k) => {
    if (x < 3.05) navLink('M_kb' + k, 'B_kb' + k);
    else {
      navNode('O_k' + k, x, OZ);
      navLink('M_kb' + k, 'O_k' + k);
    }
  });
  frontCor.forEach((x, k) => navLink('M_kf' + k, 'F_kf' + k));

  // the Market Room: in through the opening at its south-west corner
  navNode('O_b0', 3.1, OZ);
  navNode('O_b', 3.95, OZ);
  navLink('B_e', 'O_b0');
  navLink('O_b0', 'O_b');
  backCor.forEach((x, k) => x >= 3.05 && navLink('O_b', 'O_k' + k));
  navNode('I_b0', 3.95, IZ);
  navLink('O_b', 'I_b0');
  const seatsIn = ROOM_OBJ.boardSeats.filter(s => s.side);
  seatsIn.forEach((s, i) => {
    navNode('I_b' + (i + 1), s.x + BOARD_STEP, IZ);
    navLink(i ? 'I_b' + i : 'I_b0', 'I_b' + (i + 1));
  });

  // the server cabinet, in the back-left corner: approach its east-facing rack from the back aisle
  navNode('SRV', ROOM.server.x, ROOM.server.z);
  navLink('SRV', 'B_srv');

  // slot exits: seat → beside the desk → its aisle
  Object.keys(S).forEach(k => {
    const i = Number(k);
    const id = 'X' + i;
    navNode(id, S[i].x + ex, S[i].z + ez);
    navLink(id, back.includes(i) ? 'M_x' + i : 'F_x' + i);
    SLOT_EXIT[i] = id;
  });
}

/** Dijkstra over the little graph; returns node ids. */
function navPath(from, to) {
  if (from === to) return [from];
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]), done = new Set();
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist[n] < dist[cur]) cur = n;
    open.delete(cur);
    done.add(cur);
    if (cur === to) break;
    const a = NAV.nodes[cur];
    for (const nb of NAV.adj[cur]) {
      if (done.has(nb)) continue;
      const b = NAV.nodes[nb];
      const d = dist[cur] + Math.hypot(a.x - b.x, a.z - b.z);
      if (dist[nb] === undefined || d < dist[nb]) {
        dist[nb] = d;
        prev[nb] = cur;
        open.add(nb);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

/** The spot in front of a seat where one stands before sitting down. */
const frontOf = (s, d = 0.56) => [s.x + Math.sin(s.face) * d, s.z + Math.cos(s.face) * d];
/**
 * Where a sitter stands, clear of the seat's front edge: every approach ends here, facing out; the sitter then
 * lowers back onto the seat (seatDown), and getting up it rises forward to here again (seatUp) before walking off.
 * No one walks into a seat or out of one.
 */
const SEAT_FRONT = 0.45;
/** The standing spot's distance for a seat: deeper seats (the lounge's armchairs and sofa, the reading chairs) need more. */
const seatFront = s => s.front || (s.area === 'lounge' ? (s.face <= 0 ? 0.82 : 0.62) : s.area === 'reading' ? 0.72 : SEAT_FRONT);

/** Places an idle agent may visit: where to sit or stand, how to face, what they do there, and the way in. */
const DESTINATIONS = {
  server: { node: 'SRV', label: 'At the server cabinet', pose: 'look', face: ROOM.server.ry - HALF_PI, log: 'At the server cabinet — checking job health' },
  screen: {
    node: ['B_fl', 'B_fr'], seats: () => ROOM_OBJ.forumSeats, label: 'At the Forum', pose: 'watch', log: 'At the Forum — reading the main screen',
    // round the outer end of the bench, then in front of it, then sit
    approach: s => {
      const e = s.x < 0 ? -2.0 : 2.0;
      return [[e, -3.7], [e, -5.32], [s.x, -5.32], frontOf(s, seatFront(s))];
    },
  },
  lounge: {
    node: ['L1', 'F_lc'], seats: () => ROOM_OBJ.loungeSeats, label: 'In the lounge', pose: 'review', log: 'In the lounge — reviewing the house model with the team',
    // the sofa from its north end; the armchairs from the open floor in front of them
    // the sofa: in past its north arm (clear of the lamp), then along the inside of the curve, in front of anyone
    // already sitting (they tuck their feet in), to the seat chosen. The armchairs: down the open floor in front of them.
    approach: s => {
      if (s.face <= 0) return [[-4.82, 3.3], [-4.82, s.z], frontOf(s, seatFront(s))];
      const sofa = ROOM_OBJ.loungeSeats.filter(o => o.face > 0);
      return [[-6.2, 3.45], ...sofa.slice(0, sofa.indexOf(s) + 1).map(o => frontOf(o, 0.75)), frontOf(s, seatFront(s))];
    },
  },
  reading: {
    node: 'F_read', seats: () => ROOM_OBJ.readingSeats, label: 'In the reading corner', pose: 'sofa', log: 'Reading corner — reviewing notes',
    // down between the two chairs, then to the front of the one chosen
    approach: s => [[ROOM.reading.x + 0.05, 3.72], [ROOM.reading.x + 0.05, 4.4], frontOf(s, seatFront(s))],
  },
  board: {
    node: ['I_b1', 'I_b2', 'I_b3'], seats: () => ROOM_OBJ.boardSeats.filter(s => s.side), label: 'In the Market Room', pose: 'meet', log: 'Market Room — reading the pipeline',
    // along the aisle behind the chairs and into the gap beside the chosen one; the table is too close to stand in
    // front of it, so the sitter lowers sideways from the gap onto the seat (and rises back into the gap)
    approach: s => [[s.x + BOARD_STEP, BOARD_AISLE_Z()], [s.x + BOARD_STEP, s.z]],
  },
};

/* ---------- movement: local avoidance, keep-right passing, the walking high five ---------- */

const STRIDE = { walk: 1.4, carry: 1.3, run: 2.6 }; // metres per full gait cycle
const AVOID = { sep: 0.58, hard: 0.47, look: 1.6, pass: 0.4,
  knee: 0.48, // a seated body is the line from the hips to the knees (the feet tuck in as someone passes)
  seatHard: 0.26, // never closer than this to that line: the passer's half-depth plus the legs
  seatSep: 0.36 }; // a gentle push away from seated legs inside this
const HIGH5 = { range: 1.6, pairGap: 150, selfGap: 60, last: {}, pairs: {} };

/** Furniture footprints for steering: oriented boxes at body height, built once from the colliders. */
const OBST = { list: null, stations: -1 };
function obstacles() {
  if (OBST.list && OBST.stations === WORLD.stations.length) return OBST.list;
  OBST.stations = WORLD.stations.length;
  OBST.list = [];
  const s = new THREE.Vector3(), q = new THREE.Quaternion(), pos = new THREE.Vector3();
  for (const c of COLLIDERS.list) {
    if (c.tag.startsWith('chair:')) continue; // chairs move; their sitters are handled as bodies
    c.group.updateMatrixWorld(true);
    const m = new THREE.Matrix4().multiplyMatrices(c.group.matrixWorld, c.rel);
    const wb = c.box.clone().applyMatrix4(m);
    if (wb.max.y < 0.15 || wb.min.y > 1.7) continue;
    if (wb.max.x - wb.min.x < 0.03 && wb.max.z - wb.min.z < 0.03) continue;
    m.decompose(pos, q, s);
    OBST.list.push({ inv: m.clone().invert(), box: c.box, scale: s.clone(), wb });
  }
  return OBST.list;
}
const _o = new THREE.Vector3();
/** Is a body (radius r) standing at (x, z) inside any furniture? */
function blockedAt(x, z, r = 0.2) {
  for (const o of obstacles()) {
    if (x < o.wb.min.x - r || x > o.wb.max.x + r || z < o.wb.min.z - r || z > o.wb.max.z + r) continue;
    _o.set(x, clamp(0.9, o.wb.min.y, o.wb.max.y), z).applyMatrix4(o.inv);
    const ex = r / (Math.abs(o.scale.x) || 1), ez = r / (Math.abs(o.scale.z) || 1);
    if (_o.x > o.box.min.x - ex && _o.x < o.box.max.x + ex && _o.z > o.box.min.z - ez && _o.z < o.box.max.z + ez) return true;
  }
  return false;
}

/** A figure's body on the floor: a point for anyone standing, a short segment (hips to knees) for anyone seated. */
const _bp = new THREE.Vector3(), _bf = new THREE.Vector3(), _bq = new THREE.Quaternion();
function bodyOf(f) {
  f.root.getWorldPosition(_bp);
  if (SEATED_MODES.has(f.mode)) {
    f.root.getWorldQuaternion(_bq);
    _bf.set(0, 0, f.kneeReach != null ? f.kneeReach : AVOID.knee).applyQuaternion(_bq);
    return { ax: _bp.x, az: _bp.z, bx: _bp.x + _bf.x, bz: _bp.z + _bf.z, seated: true, f };
  }
  return { ax: _bp.x, az: _bp.z, bx: _bp.x, bz: _bp.z, seated: false, f };
}
/** Places too narrow for two bots to pass (the Market Room: the aisle behind its chairs and the gaps between them).
 *  One walker at a time inside; anyone else about to enter waits outside until it is clear. */
const SINGLE_FILE = [
  { id: 'board', test: (x, z) => x > ROOM.board.x0 + 0.05 && z < ROOM.board.zEdge - 0.05 && z > ROOM.z0 + 0.3 },
];
const zoneAt = (x, z) => SINGLE_FILE.find(Z => Z.test(x, z)) || null;

/** Half the hard gap between two standing bodies (each bot may declare its own footprint). */
const radiusOf = f => (f && f.radius) || AVOID.hard / 2;
/** Length of a polyline of floor points. */
function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
/** Is (x, z) clear of furniture and at least `gap` from every body but `skip`? */
function spotFree(x, z, gap, skip = []) {
  if (blockedAt(x, z, 0.2)) return false;
  for (const f of WORLD.figures) {
    if (skip.includes(f)) continue;
    const b = bodyOf(f);
    if (nearestOn(b, x, z).d < gap) return false;
  }
  return true;
}
/** Is the straight floor line from a to b clear of furniture (sampled every 15 cm)? */
function lineFree(ax, az, bx, bz, r = 0.18) {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15));
  for (let i = 1; i <= n; i++) if (blockedAt(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r)) return false;
  return true;
}

/** How close (x, z) comes to the next ~2 m of a walker's route, from where it stands now (every leg, not just the first). */
function routeGap(o, x, z, ahead = 2.2) {
  const p = o.fig.root.position;
  let ax = p.x, az = p.z, left = ahead, best = Math.hypot(x - ax, z - az);
  for (const q of o.pts) {
    const L = Math.hypot(q[0] - ax, q[1] - az);
    if (L < 1e-6) continue;
    const f = Math.min(1, left / L), ex = ax + (q[0] - ax) * f, ez = az + (q[1] - az) * f;
    const dx = ex - ax, dz = ez - az, L2 = dx * dx + dz * dz;
    const t = L2 > 1e-9 ? clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    left -= L * f;
    if (left <= 1e-6) break;
    ax = q[0];
    az = q[1];
  }
  return best;
}

/** Closest point of a body to (x, z) and the distance to it. */
function nearestOn(b, x, z) {
  const dx = b.bx - b.ax, dz = b.bz - b.az;
  const L2 = dx * dx + dz * dz;
  const t = L2 > 1e-6 ? clamp(((x - b.ax) * dx + (z - b.az) * dz) / L2, 0, 1) : 0;
  const px = b.ax + dx * t, pz = b.az + dz * t;
  return { px, pz, d: Math.hypot(x - px, z - pz) };
}

const MOVE = {
  walkers: {},
  count() {
    return Object.keys(this.walkers).length;
  },
  /** Walk a figure along world points [[x,z],...]; face yaw at the end. */
  walk(id, points, { face = null, onArrive = null, onStuck = null, speed = 1.1, gait = 'walk' } = {}) {
    const w = WORLD.byId[id];
    if (!w) return;
    const fig = w.fig;
    if (fig.root.parent !== scene) scene.attach(fig.root);
    fig.root.position.y = 0;
    this.walkers[id] = { id, fig, pts: points.slice(), face, onArrive, onStuck, speed, gait, settle: 0, t: 0, started: performance.now(), side: 0, vx: 0, vz: 0, hf: null,
      bestRem: null, stall: 0, yieldTo: null, asked: {}, detourAt: -1e9, squeezeUntil: 0, ghostUntil: 0 };
    fig.setMode(gait);
  },
  /**
   * One calm resolution for a walker that has stopped gaining ground with `blk` in its way:
   *  - another walker: the lower rank steps off the lane (right, else left) and waits for it to pass;
   *  - someone standing idle (at the server, say): they shuffle half a metre aside, once;
   *  - seated legs: they tuck in and we squeeze past;
   *  - anything else (a courier at work, a shuffle with no room): walk round it on the freer side.
   */
  resolve(w, blk, { x, z, dir, right, tx, tz, now, intoSeat }) {
    const bid = blk.f.spec && blk.f.spec.id;
    const busy = bid === 'courier' || (typeof INCIDENT !== 'undefined' && INCIDENT.owns(bid));
    if (blk.walker && !busy && blk.walker.yieldTo !== w.id) {
      const o = blk.walker;
      if (this.rank(w) >= this.rank(o)) {
        if (w.stall < 2.5) return; // they give way to us
        // still in our way: ask them to step clear of our route; if they have no room and we do, we step aside instead
        if (!o.yieldTo && !o.zoneWait && now - (w.askedWay || -1e9) > 3) {
          w.askedWay = now;
          const theirs = this.asideSpot(o, w);
          if (theirs) {
            this.giveWay(o, w, theirs);
            w.bestRem = null;
            w.stall = 0;
            return;
          }
          const ours = this.asideSpot(w, o);
          if (ours) return this.giveWay(w, o, ours);
        }
        if (w.stall < 6) return;
        return this.detour(w, blk, { x, z, dir, right, tx, tz, now }); // they cannot (boxed in): walk round them
      }
      // gave way only a moment ago: no more stepping about — stand still and let them go round
      const recent = now - (w.lastYieldEnd || -1e9) < 6;
      const spot = recent ? null : this.asideSpot(w, o);
      if (!recent && !spot && !o.yieldTo) {
        // no room beside us (a narrow place): if there is room beside them, they step aside instead and we go on
        const theirs = this.asideSpot(o, w);
        if (theirs) {
          this.giveWay(o, w, theirs);
          w.bestRem = null;
          w.stall = 0;
          return;
        }
      }
      w.yieldTo = o.id;
      w.yieldT = 0;
      if (recent) w.yieldPhase = 'wait';
      else if (spot) {
        w.yieldSpot = spot;
        w.yieldPhase = 'aside';
        w.pts.unshift(spot);
      } else {
        // no room beside either of us: back out along our own trail to the first place that is clear of their way,
        // or as far as we came; then wait there
        const need = radiusOf(o.fig) + radiusOf(w.fig) + 0.12, gap = radiusOf(w.fig) + 0.28;
        const back = this.retreatPath(w, p => spotFree(p[0], p[1], gap, [w.fig, o.fig]) && routeGap(o, p[0], p[1]) > need) || this.retreatPath(w, null);
        if (back && back.length) {
          w.yieldSpot = back[back.length - 1];
          w.yieldPhase = 'aside';
          w.pts.unshift(...back);
        } else w.yieldPhase = 'wait';
      }
      w.bestRem = null;
      w.stall = 0;
      return;
    }
    if (blk.walker && blk.walker.yieldTo === w.id) {
      const o = blk.walker;
      // they are making way: keep coming. If they have stopped somewhere still in our way, they step again, clear of
      // our route; if they have nowhere to go, we step aside and they go first; failing both, we go round them
      if ((o.yieldPhase === 'wait' || o.stall > 1.5) && w.stall > 1.6 && now - (o.restepAt || -1e9) > 2.5) {
        o.restepAt = now;
        const again = this.asideSpot(o, w);
        if (again) {
          o.yieldSpot = again;
          o.yieldPhase = 'aside';
          o.pts.unshift(again);
          o.fig.setMode(o.gait);
          o.t = 0;
          w.bestRem = null;
          w.stall = 0;
          return;
        }
        const ours = this.asideSpot(w, o);
        if (ours) {
          o.yieldTo = o.yieldPhase = o.yieldSpot = null;
          o.lastYieldEnd = now;
          o.fig.setMode(o.gait);
          o.bestRem = null;
          o.stall = 0;
          o.t = 0;
          this.giveWay(w, o, ours);
          return;
        }
      }
      if ((o.yieldPhase === 'wait' || o.stall > 1.5) && w.stall > 2.4) this.detour(w, blk, { x, z, dir, right, tx, tz, now });
      return;
    }
    if (blk.seated) {
      if (intoSeat) return;
      w.squeezeUntil = now + 3;
      blk.f.tuckUntil = now + 3.5;
      if (w.stall < 2.6) return;
    } else if (!busy && OFFICE_STATE.agents[bid] && !this.walkers[bid] && now - (w.asked[bid] || -1e9) > 6) {
      w.asked[bid] = now;
      if (this.shuffleAside(blk.f, w, right, blk.lateral)) {
        w.bestRem = null;
        w.stall = 0;
        return;
      }
    }
    this.detour(w, blk, { x, z, dir, right, tx, tz, now });
  },
  /**
   * A place for walker `y` to stand while `p` goes by: beside y (either hand, near or a little farther), or a step back
   * and to the side, that is clear of furniture and of everyone, reachable in a straight line, and clear of p's route.
   */
  asideSpot(y, p) {
    const r = y.fig.root.position, x = r.x, z = r.z;
    const dir = y.dir && (y.dir[0] || y.dir[1]) ? y.dir : (() => { const a = y.fig.root.rotation.y; return [Math.sin(a), Math.cos(a)]; })();
    const right = [-dir[1], dir[0]];
    const gap = radiusOf(y.fig) + 0.28, need = radiusOf(y.fig) + radiusOf(p.fig) + 0.12;
    const cands = [0.65, -0.65, 0.42, -0.42, 0.9, -0.9].map(k => [x + right[0] * k, z + right[1] * k])
      .concat([0.35, -0.35, 0.7, -0.7].map(k => [x - dir[0] * 0.55 + right[0] * k, z - dir[1] * 0.55 + right[1] * k]));
    const pp = p.fig.root.position, body = radiusOf(y.fig) + radiusOf(p.fig) + 0.03;
    const clearOfThem = q => {
      // the straight way there must not run through them
      const dx = q[0] - x, dz = q[1] - z, L2 = dx * dx + dz * dz;
      const t = L2 > 1e-9 ? clamp(((pp.x - x) * dx + (pp.z - z) * dz) / L2, 0, 1) : 0;
      return Math.hypot(pp.x - (x + dx * t), pp.z - (z + dz * t)) > body || Math.hypot(pp.x - x, pp.z - z) < body - 0.02 && t === 0;
    };
    return cands.find(q => routeGap(p, q[0], q[1]) > need && spotFree(q[0], q[1], gap, [y.fig, p.fig]) && lineFree(x, z, q[0], q[1]) && clearOfThem(q)) || null;
  },
  /** A walker stepping aside has been unable to get there (someone in the way): find another place, or wait where it is. */
  reconsiderYield(w, now) {
    const o = this.walkers[w.yieldTo];
    const i = w.pts.indexOf(w.yieldSpot);
    if (i >= 0) w.pts.splice(0, i + 1);
    w.yieldSpot = null;
    w.restepAt = now;
    const spot = o ? this.asideSpot(w, o) : null;
    const need = o ? radiusOf(o.fig) + radiusOf(w.fig) + 0.12 : 0, gap = radiusOf(w.fig) + 0.28;
    const back = !spot && o ? this.retreatPath(w, q => spotFree(q[0], q[1], gap, [w.fig, o.fig]) && routeGap(o, q[0], q[1]) > need) : null;
    if (spot) {
      w.yieldSpot = spot;
      w.yieldPhase = 'aside';
      w.pts.unshift(spot);
    } else if (back && back.length) {
      w.yieldSpot = back[back.length - 1];
      w.yieldPhase = 'aside';
      w.pts.unshift(...back);
    } else {
      w.yieldPhase = 'wait';
      w.yieldT = 0;
    }
    w.bestRem = null;
    w.stall = 0;
  },
  /** Walker `y` steps to `spot` and waits there for `p` to go by. */
  giveWay(y, p, spot) {
    y.yieldTo = p.id;
    y.yieldT = 0;
    y.yieldSpot = spot;
    y.yieldPhase = 'aside';
    y.pts.unshift(spot);
    if (y.fig.mode !== y.gait) y.fig.setMode(y.gait);
    y.bestRem = null;
    y.stall = 0;
  },
  /** The way back along a walker's trail (nearest first) to the first point `ok` accepts; with no test, as far as the trail goes (up to ~2.5 m). */
  retreatPath(w, ok) {
    const tr = w.trail || [];
    const pts = [];
    for (let i = tr.length - 2; i >= 0 && pts.length < 10; i--) {
      pts.push(tr[i]);
      if (ok && ok(tr[i])) return pts;
    }
    return ok ? null : pts;
  },
  /** Walk round a body in the way, on the side it is not leaning into, if the floor allows. */
  detour(w, blk, { x, z, dir, right, tx, tz, now }) {
    if (w.stall < 2.4 || now - w.detourAt < 4) return;
    w.detourAt = now;
    const fp = blk.f.root.getWorldPosition(new THREE.Vector3()), sgn = blk.lateral > 0 ? -1 : 1; // world: a seated body sits in its chair's frame
    const base = radiusOf(w.fig) + radiusOf(blk.f);
    for (const [off, sd] of [0.3, 0.16, 0.5].flatMap(m => [[base + (blk.seated ? m + 0.25 : m), sgn], [base + (blk.seated ? m + 0.25 : m), -sgn]])) {
      const p1 = [fp.x + right[0] * sd * off - dir[0] * 0.35, fp.z + right[1] * sd * off - dir[1] * 0.35];
      const p2 = [fp.x + right[0] * sd * off + dir[0] * 0.55, fp.z + right[1] * sd * off + dir[1] * 0.55];
      if (spotFree(p1[0], p1[1], 0.3, [w.fig]) && spotFree(p2[0], p2[1], 0.3, [w.fig]) && lineFree(x, z, p1[0], p1[1]) && lineFree(p1[0], p1[1], p2[0], p2[1]) && lineFree(p2[0], p2[1], tx, tz)) {
        w.pts.unshift(p1, p2);
        w.bestRem = null;
        w.stall = 0;
        return;
      }
    }
  },
  /** Someone standing idle in a walker's way steps half a metre further off its lane, then resumes what it was doing. */
  shuffleAside(f, w, right, lateral) {
    const id = f.spec && f.spec.id;
    if (!id || !WORLD.byId[id]) return false;
    const fp = f.root.getWorldPosition(new THREE.Vector3()), sgn = lateral >= 0 ? 1 : -1;
    for (const [k, fwd] of [[0.6, 0.1], [0.45, 0.25], [-0.75, 0.1]]) {
      const spot = [fp.x + right[0] * sgn * k + w.dir[0] * fwd, fp.z + right[1] * sgn * k + w.dir[1] * fwd];
      if (!spotFree(spot[0], spot[1], radiusOf(f) + 0.22, [f]) || !lineFree(fp.x, fp.z, spot[0], spot[1])) continue;
      const mode = f.mode, yaw = f.root.rotation.y, attend = f.attend;
      this.walk(id, [spot], { face: yaw, speed: 0.7, onArrive: () => { f.setMode(mode); f.attend = attend; } });
      return true;
    }
    return false;
  },
  /** Priority in a standoff: a sprint back to work first, then whoever set off first. */
  rank(w) {
    return (w.gait === 'run' ? 1e9 : 0) - w.started;
  },
  update(dt) {
    const now = performance.now() / 1000;
    const list = Object.values(this.walkers);
    this.highFives(list, now);
    for (const w of list) {
      const id = w.id;
      const r = w.fig.root;
      w.t += dt;
      if (!w.pts.length) {
        if (w.face != null) r.rotation.y += wrapAngle(w.face - r.rotation.y) * (1 - Math.exp(-7 * dt));
        w.settle += dt;
        if (w.settle > 0.55) {
          delete this.walkers[id];
          if (w.face != null) r.rotation.y = w.face;
          w.fig.attend = null;
          w.onArrive && w.onArrive();
          if (typeof VIEW !== 'undefined') VIEW.sync(id);
        }
        continue;
      }
      // yielding: stepped off the lane for someone; stand still, watch them by, then carry on
      if (w.yieldTo && w.yieldPhase === 'wait') {
        const o = this.walkers[w.yieldTo];
        w.yieldT += dt;
        const op = o && o.fig.root.position;
        const past = op && Math.hypot(op.x - r.position.x, op.z - r.position.z) > 1.3 && (!o.dir || (op.x - r.position.x) * o.dir[0] + (op.z - r.position.z) * o.dir[1] > 0);
        if (o && !past && w.yieldT < 7) {
          if (w.fig.mode !== 'stand') w.fig.setMode('stand');
          w.vx = w.vz = 0;
          w.fig.attend = o.fig.head.getWorldPosition(new THREE.Vector3());
          continue;
        }
        w.yieldTo = w.yieldPhase = w.yieldSpot = null;
        w.lastYieldEnd = now;
        w.fig.setMode(w.gait);
        w.bestRem = null;
        w.stall = 0;
        w.t = 0; // ramp back in
      }
      const [tx, tz] = w.pts[0];
      const x = r.position.x, z = r.position.z;
      const dx = tx - x, dz = tz - z;
      const d = Math.hypot(dx, dz);
      const dir = d > 1e-4 ? [dx / d, dz / d] : [0, 0];
      w.dir = dir;
      const right = [-dir[1], dir[0]]; // the walker's right hand, on the floor
      const intoSeat = w.pts.length === 1 && d < 0.95; // the last step onto a seat or a desk chair is our own
      const squeeze = now < w.squeezeUntil;
      // a single-file place ahead: wait at its threshold while anyone else is walking inside
      const zNext = zoneAt(tx, tz), zHere = zoneAt(x, z);
      // someone getting up inside a single-file place waits, seated-height calm, for anyone already walking in there
      if (w.t < 0.05 && w.zoneStart == null) w.zoneStart = !!zHere;
      if (w.zoneStart && zHere) {
        const inside = Object.values(this.walkers).some(o => o !== w && o.pts.length && !o.zoneStart && !o.zoneWait && zoneAt(o.fig.root.position.x, o.fig.root.position.z) === zHere);
        if (inside) {
          if (w.fig.mode !== 'stand') w.fig.setMode('stand');
          w.vx = w.vz = 0;
          w.bestRem = null;
          w.stall = 0;
          w.t = 0;
          continue;
        }
        w.zoneStart = false;
        if (w.fig.mode !== w.gait) w.fig.setMode(w.gait);
      }
      if (zNext && zNext !== zHere) {
        const busy = Object.values(this.walkers).some(o => o !== w && o.pts.length && zoneAt(o.fig.root.position.x, o.fig.root.position.z) === zNext);
        if (busy) {
          if (w.fig.mode !== 'stand') w.fig.setMode('stand');
          w.zoneWait = true;
          w.vx = w.vz = 0;
          w.bestRem = null; // waiting our turn is not being stuck
          w.stall = 0;
          w.fig.attend = null;
          continue;
        }
        if (w.zoneWait) {
          w.zoneWait = false;
          w.fig.setMode(w.gait);
          w.t = 0;
        }
      }
      // progress: the distance still to go; a walker that stops gaining ground is stalled, whatever it is doing
      const rem = d + pathLen(w.pts);
      if (w.bestRem == null || rem < w.bestRem - 0.12) {
        w.bestRem = rem;
        w.stall = 0;
      } else w.stall += dt;
      // look ahead: who is in our lane, who is coming toward us, who is too close
      let slow = 1, wantSide = 0, push = [0, 0], glance = null, blk = null;
      for (const f of WORLD.figures) {
        if (f === w.fig) continue;
        const b = bodyOf(f);
        const n = nearestOn(b, x, z);
        const ox = n.px - x, oz = n.pz - z;
        const dist = n.d;
        if (dist > AVOID.look + 0.4) continue;
        const along = ox * dir[0] + oz * dir[1];
        const lateral = ox * right[0] + oz * right[1];
        const other = this.walkers[f.spec.id];
        // separation: a gentle push away from anyone inside our personal space
        const sep = b.seated ? AVOID.seatSep : (AVOID.sep * (radiusOf(w.fig) + radiusOf(f))) / AVOID.hard;
        if (dist < sep && dist > 1e-4 && !(intoSeat && b.seated)) {
          const k = (sep - dist) / sep;
          const g = b.seated ? (squeeze ? 0.15 : 0.6) : 1.4;
          push[0] -= (ox / dist) * k * g;
          push[1] -= (oz / dist) * k * g;
        }
        if (b.seated) {
          // passing in front of someone seated: they tuck their feet in, we ease past
          if (dist < 1.0) f.tuckUntil = now + 0.6;
          if (dist < AVOID.seatHard + 0.12 && !intoSeat) slow = Math.min(slow, 0.6);
          if (!intoSeat && dist < AVOID.seatHard + 0.25 && along > -0.1 && (!blk || dist < blk.dist)) blk = { f, dist, lateral, seated: true, walker: null };
          continue;
        }
        if (along <= 0.05 || along > AVOID.look) continue; // behind us, or far ahead
        if (Math.abs(lateral) > 0.9) continue; // clear of our lane
        if (dist < 1.4) glance = f;
        if (Math.abs(lateral) < 0.62 && dist < 1.15 && (!blk || dist < blk.dist)) blk = { f, dist, lateral, seated: false, walker: other || null };
        const hard = radiusOf(w.fig) + radiusOf(f);
        const headOn = other && other.dir && other.dir[0] * dir[0] + other.dir[1] * dir[1] < -0.3;
        if (headOn || !other) {
          // pass on the right of anyone coming toward us or standing in the way
          wantSide = Math.max(wantSide, lateral < -0.25 ? 0.2 : 1);
          if (dist < hard + 0.06) slow = Math.min(slow, 0.25);
        } else {
          // following, or crossing: the lower rank eases off; a big gap and we overtake on the right
          const yieldTo = this.rank(w) < this.rank(other);
          if (yieldTo) slow = Math.min(slow, clamp((dist - hard) / 0.5, 0, 1));
          else wantSide = Math.max(wantSide, 0.6);
        }
      }
      // keep right only where there is room: a sidestep that would meet furniture is not taken
      let side = wantSide * AVOID.pass;
      if (side > 0 && blockedAt(x + right[0] * (side + 0.12), z + right[1] * (side + 0.12), 0.18)) {
        side = blockedAt(x + right[0] * 0.18, z + right[1] * 0.18, 0.18) ? 0 : 0.14;
        if (side === 0) slow = Math.min(slow, 0.35); // the corridor is narrow: wait our turn
      }
      w.side = damp(w.side, side, 2.6, dt);
      // a standoff, resolved once and calmly — never by shuttling back and forth
      w.blkId = blk ? blk.f.spec.id : null; // (who is in our way, for diagnostics)
      if (blk && w.stall > 1.4 && !w.yieldTo) this.resolve(w, blk, { x, z, dir, right, tx, tz, now, intoSeat });
      else if (w.yieldTo && w.yieldPhase === 'aside' && w.stall > 2 && now - (w.restepAt || -1e9) > 2) this.reconsiderYield(w, now);
      if (w.stall > 8 && w.onStuck && !w.stuckAsked) {
        // nothing has worked for eight seconds: the caller may re-plan (an outing turns back for the desk)
        w.stuckAsked = true;
        if (w.onStuck(w) === true) {
          w.stall = 0;
          w.bestRem = null;
          w.yieldTo = w.yieldPhase = w.yieldSpot = null;
        }
      }
      if (w.stall > 12) {
        // and still nothing: slip past in a moment (the last resort)
        w.stall = 0;
        w.bestRem = null;
        w.ghostUntil = now + 1.4;
      }
      if (w.yieldTo && w.yieldPhase === 'wait') continue; // stepped aside in place: wait from the next frame
      // speed: a ramp in, any slowing, a 10 % dip through a high five
      const ramp = Math.min(1, w.t / (w.gait === 'run' ? 0.35 : 0.6));
      const five = w.hf ? 0.92 : 1;
      const v = w.speed * ramp * slow * five;
      // steer: toward the next point, offset to the right as needed, pushed out of personal space
      let sx = dir[0] + right[0] * w.side * 1.4 / Math.max(0.6, Math.min(d, 2)) + push[0];
      let sz = dir[1] + right[1] * w.side * 1.4 / Math.max(0.6, Math.min(d, 2)) + push[1];
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;
      let step = Math.min(d + Math.abs(w.side) * 0.3, v * dt);
      let nx = x + sx * step, nz = z + sz * step;
      // never step into anyone: hold position rather than overlap
      if (now >= w.ghostUntil)
        for (const f of WORLD.figures) {
          if (f === w.fig) continue;
          const b = bodyOf(f);
          if (b.seated) {
            // a seated body is a torso (a body like any other, a little forgiving) and, in front of it, a line of
            // legs the feet tuck back from; sitting down beside someone only the torso counts
            const tw = Math.hypot(nx - b.ax, nz - b.az), t0 = Math.hypot(x - b.ax, z - b.az);
            if (tw < (radiusOf(w.fig) + radiusOf(f)) * (intoSeat ? 0.85 : 0.92) && tw < t0) {
              nx = x;
              nz = z;
              step = 0;
              break;
            }
            if (intoSeat) continue;
          }
          const was = nearestOn(b, x, z).d, will = nearestOn(b, nx, nz).d;
          const hard = b.seated ? AVOID.seatHard * (squeeze ? 0.55 : 1) : radiusOf(w.fig) + radiusOf(f);
          if (will < hard && will < was) {
            nx = x;
            nz = z;
            step = 0;
            break;
          }
        }
      if (!intoSeat && step > 0 && blockedAt(nx, nz, 0.16) && !blockedAt(x, z, 0.16)) {
        // the push would take us into furniture: follow the path instead
        nx = x + dir[0] * step;
        nz = z + dir[1] * step;
      }
      r.position.x = nx;
      r.position.z = nz;
      // the way we came: a trail of points a quarter metre apart, to back out along if we must give way
      if (!w.trail) w.trail = [[x, z]];
      const lt = w.trail[w.trail.length - 1];
      if (Math.hypot(nx - lt[0], nz - lt[1]) > 0.25) {
        w.trail.push([nx, nz]);
        if (w.trail.length > 24) w.trail.shift();
      }
      w.vx = (nx - x) / Math.max(dt, 1e-4);
      w.vz = (nz - z) / Math.max(dt, 1e-4);
      if (step > 1e-5) {
        const yaw = Math.atan2(nx - x, nz - z);
        r.rotation.y += wrapAngle(yaw - r.rotation.y) * (1 - Math.exp(-8 * dt));
      }
      w.fig.walkPhase += (step / (STRIDE[w.gait] || STRIDE.walk)) * TAU;
      w.fig.attend = w.hf ? w.hf.otherHead : glance && !intoSeat ? glance.head.getWorldPosition(new THREE.Vector3()) : null;
      if (Math.hypot(tx - nx, tz - nz) < 0.035 || (w.pts.length > 1 && Math.hypot(tx - nx, tz - nz) < 0.3 && w.side > 0.05)) {
        const reached = w.pts.shift();
        if (w.yieldTo && reached === w.yieldSpot) {
          w.yieldPhase = 'wait'; // off the lane: now let them by
          w.yieldT = 0;
        }
      }
    }
    // the glass door slides for anyone near it
    let near = false;
    for (const w of Object.values(this.walkers)) {
      const p = w.fig.root.position;
      if (Math.hypot(p.x - ROOM.door.x, p.z - ROOM.door.zc) < 1.9) near = true;
    }
    if (ROOM_OBJ.door) ROOM_OBJ.door.target = near ? 1 : 0;
  },

  /** Two walkers passing each other: inner hands meet at the closest approach, nobody stops. */
  highFives(list, now) {
    for (const w of list) {
      if (!w.hf) continue;
      const h = w.hf;
      const o = this.walkers[h.other];
      const left = h.tc - now;
      if (!o || left < -0.55) {
        w.hf = null;
        w.fig.hf = null;
        continue;
      }
      const a = w.fig.root.position, b = o.fig.root.position;
      h.point = h.point || new THREE.Vector3();
      h.point.set((a.x + b.x) / 2, 1.66, (a.z + b.z) / 2);
      h.otherHead = o.fig.head.getWorldPosition(h.otherHead || new THREE.Vector3());
      // a bell around the moment of contact: up a beat before, through, and back into the swing
      const k = left > 0 ? smooth(0.62, 0.05, left) : smooth(-0.5, -0.04, left);
      w.fig.hf = { point: h.point, side: h.side, k, contact: Math.abs(left) < 0.09 };
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        if (A.hf || B.hf || A.gait !== 'walk' || B.gait !== 'walk' || !A.dir || !B.dir) continue;
        if (typeof INCIDENT !== 'undefined' && (INCIDENT.owns(A.id) || INCIDENT.owns(B.id))) continue;
        if (A.id === 'courier' || B.id === 'courier') continue;
        const key = [A.id, B.id].sort().join('~');
        if (now - (HIGH5.pairs[key] || -1e9) < HIGH5.pairGap || now - (HIGH5.last[A.id] || -1e9) < HIGH5.selfGap || now - (HIGH5.last[B.id] || -1e9) < HIGH5.selfGap) continue;
        const pa = A.fig.root.position, pb = B.fig.root.position;
        const rx = pb.x - pa.x, rz = pb.z - pa.z;
        const dist = Math.hypot(rx, rz);
        if (dist > HIGH5.range || dist < 0.6) continue;
        if (A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1] > 0.2) continue; // walking the same way: no
        // closing speed and the time to the closest approach
        const vx = B.vx - A.vx, vz = B.vz - A.vz;
        const v2 = vx * vx + vz * vz;
        if (v2 < 0.2) continue;
        const tca = -(rx * vx + rz * vz) / v2;
        if (tca < 0.35 || tca > 1.1) continue;
        const cx = rx + vx * tca, cz = rz + vz * tca;
        const miss = Math.hypot(cx, cz);
        if (miss > 1.05) continue; // they will pass too far apart to reach
        const sideOf = (P, dirP, Qx, Qz) => (Qx * -dirP[1] + Qz * dirP[0] > 0 ? 'R' : 'L'); // R: the other is on our right
        A.hf = { other: B.id, side: sideOf(pa, A.dir, rx, rz), tc: now + tca };
        B.hf = { other: A.id, side: sideOf(pb, B.dir, -rx, -rz), tc: now + tca };
        HIGH5.pairs[key] = now;
        HIGH5.last[A.id] = HIGH5.last[B.id] = now;
        HIGH5.count = (HIGH5.count || 0) + 1;
      }
  },
};

/** World point of a slot's seat. */
const slotSeat = i => [ROOM.slots[i].x, ROOM.slots[i].z];

/** Points from a slot seat out to its aisle node, then on to a node id. */
function routeFromSeat(slot, toNode) {
  const ex = SLOT_EXIT[slot];
  const path = navPath(ex, toNode) || [ex];
  return path.map(id => [NAV.nodes[id].x, NAV.nodes[id].z]);
}
function routeToSeat(fromNode, slot) {
  const ex = SLOT_EXIT[slot];
  const path = navPath(fromNode, ex) || [ex];
  return path.map(id => [NAV.nodes[id].x, NAV.nodes[id].z]).concat([slotSeat(slot)]);
}
