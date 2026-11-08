/* =============================================================================
   86 · AMBIENT LIFE — idle agents leave their desks, driven by status alone
   -----------------------------------------------------------------------------
   Presentation only. Nobody sits idle at a desk: an agent that goes IDLE (or is
   paused) gets up after a moment and takes a seat in one of the two sitting
   area — the lounge, round the house model — and only
   when both are full, the Forum or the Market Room. A seat is reserved the
   moment someone sets off for it, so no two agents ever take the same one, and
   the seat chosen is the one that faces whoever is already there (and needs the
   fewest knees stepped past). Seated together, they look at each other now and
   then, and at the model or the screen in between. Any WORKING / THINKING /
   WAITING status calls an agent straight back (a sprint when work has arrived).
   Because this layer reads status, never the simulation, a live feed from the
   Studio looks the same. Up to four agents walk at once.
   ============================================================================= */

const AMB = { agents: {}, lastTick: 0, idleBeforeWalk: 2.5, maxWalkers: 4 };

const ambOf = id => (AMB.agents[id] = AMB.agents[id] || { phase: 'desk', idleSince: null });
/** Walkers plus anyone about to set off (a walk starts a beat after standing up). */
const movingCount = () => OFFICE_STATE.order.filter(id => MOVE.walkers[id] || (AMB.agents[id] && AMB.agents[id].starting)).length + (MOVE.walkers.courier ? 1 : 0);
const isBusy = a => a.status === 'WORKING' || a.status === 'THINKING' || a.status === 'WAITING';
/** The two sitting areas first, in random order; then the overflow seats. */
const SIT_ORDER = () => ['lounge'].concat(Math.random() < 0.5 ? ['screen', 'board'] : ['board', 'screen']);

function ambTick() {
  const now = SIM.clock();
  if (now - AMB.lastTick < 0.4) return;
  AMB.lastTick = now;
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id];
    if (a.zone === 'personal') continue; // the study's pair keep their desks; the lounge and the Forum are the crew's
    const m = ambOf(id);
    if (a.location === 'desk') {
      if (isBusy(a) || a.status === 'DONE') {
        m.idleSince = null;
        continue;
      }
      // someone has the pointer on it (hovering, pushing it about): it stays put, and its idle clock starts again
      const held = typeof UI !== 'undefined' && (UI.hoverId === id || (UI._botDrag && WORLD.byId[id] && UI._botDrag.fig === WORLD.byId[id].fig));
      if (held) {
        m.idleSince = now;
        continue;
      }
      if (m.idleSince == null) {
        m.idleSince = now;
        m.leaveAfter = (AMB.idleBeforeWalk + rand(0, 4)) / SIM.speed; // not everyone stands up at once
      }
      if (now - m.idleSince > m.leaveAfter && movingCount() < AMB.maxWalkers) {
        const key = SIT_ORDER().find(k => destinationFree(k));
        if (key) goSomewhere(id, key);
      }
    } else if (DESTINATIONS[a.location] && m.phase === 'away') {
      if (isBusy(a) && !m.confer && movingCount() < AMB.maxWalkers + 2) returnToDesk(id); // work always gets through
    }
  }
  if (typeof conferTick === 'function') conferTick(); // shared work goes to the conference room
  converse(now);
}

function destinationFree(key) {
  const D = DESTINATIONS[key];
  if (key === 'board' && typeof sharedTaskOf === 'function' && OFFICE_STATE.tasks.some(t => t.column === 'progress' && t.with && t.with.length)) return false; // a meeting is on: the room is theirs
  if (D.seats) return D.seats().some(x => !x.taken);
  const nodes = Array.isArray(D.node) ? D.node : [D.node];
  return nodes.some(n => !OFFICE_STATE.order.some(o => AMB.agents[o] && AMB.agents[o].node === n && OFFICE_STATE.agents[o].location !== 'desk'));
}

/** The best free seat: facing whoever is already sitting there, and reached without stepping past them. */
function chooseSeat(D) {
  const seats = D.seats();
  const free = seats.filter(s => !s.taken);
  if (!free.length) return null;
  const taken = seats.filter(s => s.taken);
  const score = s => {
    let v = Math.random() * 0.2;
    for (const o of taken) {
      const dx = o.x - s.x, dz = o.z - s.z;
      const d = Math.hypot(dx, dz) || 1;
      v += ((Math.sin(s.face) * dx + Math.cos(s.face) * dz) / d) * 0.8; // facing them
      if (d < 0.75) v -= 0.6; // not shoulder to shoulder when there is a choice
    }
    // the way in: count the occupied seats whose knees the approach passes
    const path = D.approach(s);
    for (const o of taken) for (const [x, z] of path.slice(0, -1)) if (Math.hypot(x - o.x - Math.sin(o.face) * 0.5, z - o.z - Math.cos(o.face) * 0.5) < 0.55) v -= 1.2;
    return v;
  };
  return free.sort((a, b) => score(b) - score(a))[0];
}

/** Sends an idle agent somewhere calm. `forceKey` picks the destination (used by tests). */
function goSomewhere(id, forceKey) {
  if (movingCount() >= AMB.maxWalkers) return false;
  const a = OFFICE_STATE.agents[id];
  const w = WORLD.byId[id];
  if (!a || !w || a.location !== 'desk') return false;
  const options = (forceKey ? [forceKey] : pb(id).go || ['lounge']).filter(k => DESTINATIONS[k] && destinationFree(k));
  if (!options.length) return false;
  const key = pick(options);
  const D = DESTINATIONS[key];
  const m = ambOf(id);
  let node = Array.isArray(D.node) ? null : D.node;
  let seat = null;
  let extra = [];
  if (D.seats) {
    seat = chooseSeat(D);
    if (!seat) return false;
    seat.taken = id; // reserved from the moment we set off
    extra = D.approach(seat);
    if (!node) node = D.node.reduce((best, n) => (Math.hypot(NAV.nodes[n].x - extra[0][0], NAV.nodes[n].z - extra[0][1]) < Math.hypot(NAV.nodes[best].x - extra[0][0], NAV.nodes[best].z - extra[0][1]) ? n : best), D.node[0]);
  } else if (Array.isArray(D.node)) {
    node = D.node.find(n => !OFFICE_STATE.order.some(o => AMB.agents[o] && AMB.agents[o].node === n && OFFICE_STATE.agents[o].location !== 'desk')) || D.node[0];
  }
  Object.assign(m, { phase: 'out', key, node, seat, extra, idleSince: null, starting: true });
  a.location = 'walking';
  BUS.emit('agent', a);
  w.fig.setMode('stand');
  const pts = routeFromSeat(w.slot, node).concat(extra);
  setTimeout(() => {
    m.starting = false;
    MOVE.walk(id, pts, {
      face: seat ? seat.face : D.face,
      // the way there will not clear (a jam in a narrow place): give the seat up and go back to the desk instead
      onStuck: wk => {
        if (m.phase !== 'out') return false;
        const home = homeFrom(id, wk.fig.root.position.x, wk.fig.root.position.z);
        if (!home) return false;
        if (m.seat) m.seat.taken = false;
        Object.assign(m, { phase: 'back', seat: null, extra: [] });
        wk.pts = home;
        wk.face = STATION_YAW;
        wk.onArrive = () => {
          sitAtDesk(id);
          a.location = 'desk';
          Object.assign(m, { phase: 'desk', node: null, seat: null, extra: [], idleSince: null });
          BUS.emit('agent', a);
        };
        return true;
      },
      onArrive: () => {
        a.location = key;
        m.phase = 'away';
        m.until = Infinity; // stays until there is work again
        const lift = seat ? seat.lift || 0 : D.lift || 0;
        if (seat) {
          // from in front of the seat, back onto it as it sits: once no one is passing right there
          w.fig._seated = false;
          w.fig.setMode('stand');
          const tok0 = w.fig._seatTok;
          laneClear(w.fig, w.fig.root.position.x, w.fig.root.position.z).then(() => {
            if (w.fig._seatTok !== tok0 || m.phase !== 'away' || m.seat !== seat || MOVE.walkers[id]) return;
            seatDown(w.fig, seat, D.pose, lift);
          });
        } else {
          w.fig.setMode(D.pose);
          w.fig.root.position.y = lift;
        }
        if (SIM.enabled) pushLog(id, D.log); // live logs stay real
        BUS.emit('agent', a);
        if (isBusy(a)) m.until = 0; // called back while walking: turn round
      },
    });
  }, 700);
  return true;
}

/** From where a walker stands, the way back to its own desk: the nearest node it can walk straight to, then on. */
function homeFrom(id, x, z) {
  const w = WORLD.byId[id];
  if (!w || w.slot == null) return null;
  const near = Object.keys(NAV.nodes).sort((p, q) => Math.hypot(NAV.nodes[p].x - x, NAV.nodes[p].z - z) - Math.hypot(NAV.nodes[q].x - x, NAV.nodes[q].z - z));
  for (const n of near.slice(0, 6)) if (lineFree(x, z, NAV.nodes[n].x, NAV.nodes[n].z)) return routeToSeat(n, w.slot);
  return null;
}

/** Back to the desk: a calm walk, or a sprint when work has arrived. */
function returnToDesk(id) {
  const a = OFFICE_STATE.agents[id];
  const w = WORLD.byId[id];
  const m = ambOf(id);
  m.phase = 'back';
  a.location = 'walking';
  BUS.emit('agent', a);
  w.fig.attend = null;
  // off a seat: up and forward to the spot in front of it first (never walking out of the seat itself)
  const fromSeat = m.seat && SEATED_MODES.has(w.fig.mode);
  w.fig._seatTok = (w.fig._seatTok || 0) + 1; // (anything still waiting to sit is off)
  const spot = m.extra[m.extra.length - 1] || (m.seat ? frontOf(m.seat, seatFront(m.seat)) : null);
  const seatRef = m.seat;
  const up = fromSeat ? laneClear(w.fig, spot[0], spot[1]).then(() => seatUp(w.fig, seatRef, spot)) : null;
  if (!fromSeat) {
    w.fig.setMode('stand');
    w.fig.root.position.y = 0;
  }
  const back = m.extra.slice(0, -1).reverse();
  const pts = back.concat(routeToSeat(m.node, w.slot));
  (up || Promise.resolve()).then(() => setTimeout(() => {
    if (m.seat) m.seat.taken = false;
    const rush = isBusy(a);
    MOVE.walk(id, pts, {
      face: STATION_YAW,
      speed: rush ? 2.5 : 1.1,
      gait: rush ? 'run' : 'walk',
      onArrive: () => {
        sitAtDesk(id);
        a.location = 'desk';
        Object.assign(m, { phase: 'desk', node: null, seat: null, extra: [], idleSince: null });
        BUS.emit('agent', a);
      },
    });
  }, fromSeat ? 120 : isBusy(a) ? 250 : 600));
}

/** Waits (a few seconds at most) until no walker is passing close by a spot: sitting down or getting up never steps into one. */
function laneClear(fig, x, z, gap = 0.8, maxMs = 6000) {
  const t0 = performance.now();
  return new Promise(res => {
    const check = () => {
      const busy = Object.values(MOVE.walkers).some(o => o.fig !== fig && (Math.hypot(o.fig.root.position.x - x, o.fig.root.position.z - z) < gap || routeGap(o, x, z, 1.6) < gap * 0.8));
      if (!busy || performance.now() - t0 > maxMs) res();
      else setTimeout(check, 200);
    };
    check();
  });
}

/**
 * Sitting down: standing in front of the seat (where the approach ends), the sitter lowers back onto it,
 * the knees bending as the hips travel back. In the root's own frame or the world, whichever it is in.
 */
function seatDown(fig, seat, pose, lift, dur = null) {
  const r = fig.root, tok = (fig._seatTok = (fig._seatTok || 0) + 1);
  fig._seated = false;
  const p0 = r.position.clone(), y0 = r.rotation.y;
  const to = r.parent && r.parent !== scene ? new THREE.Vector3(0, lift, 0) : new THREE.Vector3(seat.x, lift, seat.z);
  if (dur == null) dur = clamp(0.55 + Math.hypot(to.x - p0.x, to.z - p0.z) * 0.55, 0.6, 1.1); // a deep seat takes a moment longer
  const yaw = r.parent && r.parent !== scene ? 0 : seat.face;
  fig.setMode(pose);
  return tween(dur, k => {
    if (fig._seatTok !== tok) return;
    const e = easeInOut(k);
    r.position.set(lerp(p0.x, to.x, e), lerp(p0.y, to.y, smooth(0.3, 1, k)), lerp(p0.z, to.z, e));
    r.rotation.y = y0 + wrapAngle(yaw - y0) * e;
  }).then(() => {
    if (fig._seatTok === tok) fig._seated = true;
  });
}
/**
 * Getting up: off the seat to the spot in front of it (or the gap beside it), in the world. The hips leave the
 * seat first, knees still bent; only once they are clear of it do the legs straighten (so no leg ever stands
 * up through the seat).
 */
function seatUp(fig, seat, spot, dur = null) {
  const r = fig.root, tok = (fig._seatTok = (fig._seatTok || 0) + 1);
  fig._seated = false;
  if (r.parent !== scene) scene.attach(r);
  const [fx, fz] = spot || frontOf(seat, seatFront(seat));
  const p0 = r.position.clone();
  if (dur == null) dur = clamp(0.6 + Math.hypot(fx - p0.x, fz - p0.z) * 0.5, 0.7, 1.1);
  let up = false;
  return tween(dur, k => {
    if (fig._seatTok !== tok) return;
    const e = easeInOut(k);
    r.position.set(lerp(p0.x, fx, e), lerp(p0.y, 0, smooth(0.35, 0.85, k)), lerp(p0.z, fz, e));
    if (!up && e > 0.42) {
      up = true;
      fig.setMode('stand');
    }
  }).then(() => fig.setMode('stand'));
}

function sitAtDesk(id) {
  const w = WORLD.byId[id];
  w.st.figureSlot.attach(w.fig.root);
  w.fig.root.position.set(0, 0, 0);
  w.fig.root.rotation.set(0, 0, 0);
  w.fig.root.scale.set(1, 1, 1);
  w.fig.attend = null;
}

/** Seated together: look at each other now and then, and at the model or the screen in between. */
const FOCAL = {
  lounge: () => (ROOM_OBJ.holoHouse ? ROOM_OBJ.holoHouse.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.45, 0)) : null),
  screen: () => new THREE.Vector3(ROOM.screen.x, ROOM.screen.y, ROOM.screen.z),
  board: () => new THREE.Vector3(ROOM.hot.x, ROOM.hot.y, ROOM.hot.z),
};
function converse(now) {
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id], m = AMB.agents[id], w = WORLD.byId[id];
    if (!w || !m || m.phase !== 'away' || !DESTINATIONS[a.location] || MOVE.walkers[id]) continue;
    if (m.lookUntil && now < m.lookUntil) continue;
    const mates = OFFICE_STATE.order.filter(o => o !== id && OFFICE_STATE.agents[o].location === a.location && AMB.agents[o] && AMB.agents[o].phase === 'away');
    const focal = FOCAL[a.location] ? FOCAL[a.location]() : null;
    if (mates.length && Math.random() < 0.6) {
      const o = WORLD.byId[pick(mates)];
      w.fig.attend = o.fig.head.getWorldPosition(new THREE.Vector3());
    } else w.fig.attend = focal;
    m.lookUntil = now + rand(3, 7) / SIM.speed;
  }
}
