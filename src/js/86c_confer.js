/* =============================================================================
   86c · THE CONFERENCE ROOM — shared work happens together
   -----------------------------------------------------------------------------
   Igor's standing rule: when more than one agent is working on the same task,
   they all go into the conference room (the Market Room) and work on it there,
   together. Each takes a chair at the table and works on the laptop set at its
   place, which opens as it sits down. When the task is done the laptops close
   and everyone goes back to their own desk. Idle visitors make way for a meeting.
   ============================================================================= */

const CONFER = { seats: () => (ROOM_OBJ.boardSeats || []).filter(s => s.side) };

/** A frame for typing at a conference seat: the seat's position and facing, flagged like a desk slot. */
function conferAnchor(seat) {
  if (!seat.anchor) {
    const g = new THREE.Group();
    g.position.set(seat.x, 0, seat.z);
    g.rotation.y = seat.face;
    g.userData.isSlot = true;
    g.userData.conference = true;
    scene.add(g);
    seat.anchor = g;
  }
  return seat.anchor;
}

/** The best free chair: beside teammates already at the table. */
function conferSeat(id, task) {
  const free = CONFER.seats().filter(s => !s.taken);
  if (!free.length) return null;
  const mates = taskMembers(task).filter(m => m !== id).map(m => AMB.agents[m] && AMB.agents[m].seat).filter(Boolean);
  const near = s => mates.reduce((d, o) => d + Math.hypot(o.x - s.x, o.z - s.z), 0);
  return free.sort((a, b) => near(a) - near(b))[0];
}

/** Visitors at the table who are not on the shared task go back to their desks. */
function conferMakeRoom() {
  for (const s of CONFER.seats()) {
    const o = s.taken;
    if (!o || !OFFICE_STATE.agents[o]) continue;
    const m = AMB.agents[o];
    if (m && !m.confer && m.phase === 'away' && !MOVE.walkers[o] && OFFICE_STATE.agents[o].location === 'board') returnToDesk(o);
  }
}

function conferGo(id, task) {
  const a = OFFICE_STATE.agents[id], w = WORLD.byId[id], m = ambOf(id);
  const D = DESTINATIONS.board;
  const seat = conferSeat(id, task);
  if (!seat) return conferMakeRoom();
  if (movingCount() >= AMB.maxWalkers + 2) return;
  seat.taken = id; // reserved from the moment it sets off
  const extra = D.approach(seat);
  const node = D.node.reduce((best, n) => (Math.hypot(NAV.nodes[n].x - extra[0][0], NAV.nodes[n].z - extra[0][1]) < Math.hypot(NAV.nodes[best].x - extra[0][0], NAV.nodes[best].z - extra[0][1]) ? n : best), D.node[0]);
  Object.assign(m, { phase: 'out', key: 'board', node, seat, extra, idleSince: null, starting: true, confer: true });
  a.location = 'walking';
  BUS.emit('agent', a);
  w.fig.setMode('stand');
  const pts = routeFromSeat(w.slot, node).concat(extra);
  setTimeout(() => {
    m.starting = false;
    MOVE.walk(id, pts, { face: seat.face, onArrive: () => conferSit(id) });
  }, 600);
}

/** Sits at the table, opens its laptop, and points its hands at that keyboard. */
function conferSit(id) {
  const a = OFFICE_STATE.agents[id], w = WORLD.byId[id], m = ambOf(id), fig = w.fig, seat = m.seat;
  a.location = 'board';
  m.phase = 'away';
  m.until = Infinity;
  const anchor = conferAnchor(seat);
  anchor.attach(fig.root); // (from the gap beside the chair: it lowers across onto the seat, once the aisle by it is clear)
  fig._seated = false;
  fig.setMode('stand');
  const tok0 = fig._seatTok;
  const at = fig.root.getWorldPosition(new THREE.Vector3());
  laneClear(fig, at.x, at.z, 0.7).then(() => {
    if (fig._seatTok !== tok0 || m.phase !== 'away' || m.seat !== seat || MOVE.walkers[id]) return;
    seatDown(fig, seat, 'meet', seat.lift || 0);
  });
  if (!fig._stationDesk) fig._stationDesk = fig.desk;
  const lap = seat.laptop;
  if (lap && lap.setOpen) lap.setOpen(true);
  anchor.updateMatrixWorld(true);
  // figure.desk lives in the root's parent frame (here the seat anchor, as a desk slot at a station):
  // the laptop's keys and trackpad come over from world space; with no laptop (older room), the table edge
  const kbW = lap && lap.kb ? lap.kb.clone() : anchor.localToWorld(new THREE.Vector3(0, DESK.top + 0.012, 0.47));
  const padW = lap && lap.pad ? lap.pad.clone() : anchor.localToWorld(new THREE.Vector3(0, DESK.top + 0.008, 0.36));
  const keys = lap && lap.keyboard && lap.keyboard.keys ? lap.keyboard.keys.map(k => {
    const v = anchor.worldToLocal(new THREE.Vector3(k.x, k.y, k.z));
    return { x: v.x, y: v.y, z: v.z, w: k.w, d: k.d, row: k.row, label: k.label };
  }) : null;
  const keyboard = keys && keys.length ? { keys, press: i => lap.keyboard.press(i) } : null;
  fig.desk = { kb: anchor.worldToLocal(kbW), pad: anchor.worldToLocal(padW), keyboard, conference: true };
  // a bot without legs works at the table as it does at its desk: without the chair (it comes back when it leaves)
  if (fig.noChair && seat.chair && seat.chair.visible) {
    seat.chair.visible = false;
    m.hidChair = seat.chair;
  }
  BUS.emit('agent', a);
}

/** Done together: the laptop closes, the desk keyboard is its own again, and back it goes. */
function conferLeave(id) {
  const w = WORLD.byId[id], m = ambOf(id), fig = w.fig;
  const lap = m.seat && m.seat.laptop;
  if (lap && lap.setOpen) lap.setOpen(false);
  if (m.hidChair) {
    m.hidChair.visible = true;
    m.hidChair = null;
  }
  if (fig._stationDesk) {
    fig.desk = fig._stationDesk;
    fig._stationDesk = null;
  }
  m.confer = false;
  returnToDesk(id);
}

/** At the table the pose follows the work: typing or reading on the laptop, thinking it through, or listening. */
function conferPose(id) {
  const a = OFFICE_STATE.agents[id], w = WORLD.byId[id], m = AMB.agents[id];
  if (!a || !w || !m || !m.confer || a.location !== 'board' || MOVE.walkers[id] || a.status === 'WAITING' || w.fig._seated === false) return;
  w.fig.setMode(a.status === 'WORKING' ? (a.activity === 'browsing' ? 'browse' : 'type') : a.status === 'THINKING' ? 'think' : a.status === 'DONE' ? 'done' : 'meet');
}

/** Is anyone on the way into or out of the Market Room right now? Its aisle takes one at a time. */
const boardTraffic = () => OFFICE_STATE.order.some(o => {
  const m = AMB.agents[o];
  return m && m.key === 'board' && (m.starting || (MOVE.walkers[o] && (m.phase === 'out' || m.phase === 'back')));
});

/** Every ambient tick: members of a shared task head for the table, one at a time; when it is done they head home, one at a time. */
function conferTick() {
  if (!ROOM_OBJ.boardSeats || typeof sharedTaskOf !== 'function') return;
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id], m = ambOf(id), w = WORLD.byId[id];
    if (!w || a.paused || MOVE.walkers[id] || m.starting) continue;
    if (typeof INCIDENT !== 'undefined' && INCIDENT.owns(id)) continue;
    const task = sharedTaskOf(id);
    if (task) {
      if (m.confer) continue;
      if (a.location === 'desk') {
        if (!boardTraffic()) conferGo(id, task); // they trickle in: the next sets off once the last is through
      }
      else if (DESTINATIONS[a.location] && m.phase === 'away') returnToDesk(id); // home first; the next tick takes it to the table
    } else if (m.confer && a.location === 'board' && m.phase === 'away' && !boardTraffic()) conferLeave(id);
  }
}

// the pose at the table follows status (VIEW.sync would otherwise give every board sitter the listening pose)
(() => {
  if (typeof VIEW === 'undefined' || !VIEW.sync) return;
  const base = VIEW.sync.bind(VIEW);
  VIEW.sync = id => {
    base(id);
    conferPose(id);
  };
})();
