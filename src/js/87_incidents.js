/* =============================================================================
   87 · INCIDENTS — when a step stalls, the screen pays for it
   -----------------------------------------------------------------------------
   After two documented repairs and a fresh recheck establish a human-only dependency, Crimson signals the escalation. It stands, steps up to
   the desk, leans over and takes the display by its sides, tears it off its
   cable, turns away from the desk, raises it overhead, arches back and spikes
   it into the floor. Glass and aluminium fly; the stand skids away.
   Moments later the lift opens and a courier carries a boxed replacement in,
   round to the back of the desk. It sets the carton down, slits the tape, opens
   the flaps, lifts the display out of its foam, carries it to the desk and sets
   it on its place, routes the cable, peels the film and powers it on; then it
   closes the empty carton, sweeps the pieces and carries it out the way it came.
   Nothing floats: while a robot holds something, the object is placed every
   frame from where its palms actually are (HELD, after the arm IK has run), so
   it moves only as the hands do; the hands go onto grips just outside the
   object's edges, and fingertips stop at the surfaces they touch.
   One incident at a time, at least two minutes apart
   (?incidents=0 turns them off; window.AgentOffice.smash(id) runs one now).
   ============================================================================= */

const INCIDENT = {
  active: null,
  escalations: [],
  played: new Set(),
  lastAt: -Infinity,
  minGap: 120,
  enabled: new URLSearchParams(location.search).get('incidents') !== '0',
  shards: [],
  sparks: null,
  dust: [],
  flash: null,
  props: [],
  courier: null,
  owns(id) {
    return !!(this.active && this.active.id === id && this.active.phase !== 'done');
  },
};

const wait = ms => new Promise(r => setTimeout(r, ms));
const SHARD_GEO = new THREE.BoxGeometry(1, 1, 1);
const GLASS_SHARD_MAT = new THREE.MeshPhysicalMaterial({ color: lin('#0b0c0f'), roughness: 0.05, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 0.85, envMapIntensity: 1.4, fog: false });
const CARTON_MAT = new THREE.MeshStandardMaterial({ color: lin('#f1f1ee'), roughness: 0.82, metalness: 0, fog: false });
const CARTON_IN_MAT = new THREE.MeshStandardMaterial({ color: lin('#d9d6cf'), roughness: 0.9, metalness: 0, fog: false });
const FOAM_MAT = new THREE.MeshStandardMaterial({ color: lin('#f7f7f5'), roughness: 0.95, metalness: 0, fog: false });
const TAPE_MAT = new THREE.MeshStandardMaterial({ color: lin('#e8e8e4'), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
const FILM_MAT = new THREE.MeshPhysicalMaterial({ color: lin('#e9eef2'), roughness: 0.15, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false });
const CABLE_MAT = new THREE.MeshStandardMaterial({ color: lin('#141416'), roughness: 0.55, metalness: 0.1, fog: false });

// The dramatic visual is reserved for a proved human escalation. A slow job is only a timing signal.
function pendingEscalationIncident() {
  if (!INCIDENT.enabled || REDUCED_MOTION || INCIDENT.active || !INCIDENT.escalations.length || SIM.clock()-INCIDENT.lastAt<INCIDENT.minGap) return;
  const a=OFFICE_STATE.agents.crimson,w=WORLD.byId.crimson;
  if(!a || !w || a.location!=='desk' || MOVE.walkers.crimson || w.fig.root.parent!==w.st.figureSlot || !w.st.monitor.visible) return;
  for(const r of INCIDENT.escalations){
    const key='bco-office-escalation:'+r.id;
    if(INCIDENT.played.has(key)) continue;
    try { if(localStorage.getItem(key)==='played'){INCIDENT.played.add(key);continue;} } catch(_) {}
    INCIDENT.played.add(key);
    try {localStorage.setItem(key,'played');}catch(_){}
    smashScreen('crimson',r);break;
  }
}

/* ---------- small tools -------------------------------------------------------------- */

/** A frame-driven tween that resolves when done. */
function tween(dur, fn) {
  return new Promise(res => VIEW.tweens.push({ t: 0, dur, fn: k => (fn(k), k >= 1 && res()) }));
}
/** Resolves on the first frame pred() holds (checked after the figures have moved), or after max seconds. */
function until(pred, max = 1.2) {
  return new Promise(res => {
    const tw = { t: 0, dur: max, fn: k => { if (k >= 1 || pred()) { tw.t = 1; res(); } } };
    VIEW.tweens.push(tw);
  });
}
const easeIn3 = k => k * k * k;
const worldOf = (obj, x, y, z) => obj.localToWorld(new THREE.Vector3(x, y, z));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Bounds of an object's meshes in its own frame (any monitor model, any carton); skip(o) leaves a mesh out. */
function localBounds(obj, skip = null) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry || (skip && skip(o))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.multiplyMatrices(inv, o.matrixWorld);
    box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(m));
  });
  return box;
}

/** The figure's rig, with graceful fallbacks: a figure without hands-on control still plays the simple version. */
function rig(fig) {
  return {
    full: typeof fig.reach === 'function' && typeof fig.palm === 'function',
    reach: (side, p, wgt = 1) => fig.reach && fig.reach(side, p, wgt),
    free: () => fig.reach && (fig.reach(-1, null), fig.reach(1, null)),
    bend: k => fig.bend && fig.bend(k),
    crouch: k => fig.crouch && fig.crouch(k),
    look: p => (fig.lookAt ? fig.lookAt(p) : (fig.attend = p)),
    recoil: () => fig.recoil && fig.recoil(),
  };
}

/* ---------- holding: the object follows the palms ------------------------------------ */

/**
 * A two-handed hold. Every frame, after the figures have moved (heldLate, from the main loop), each held
 * object is placed from where the two palms actually are: their midpoint, the line from the left palm to the
 * right one, and world up. So a held object cannot drift from the hands, lag them or float ahead of them;
 * to move it, the hands move. h.pitch turns it about the line between the palms (a display tipped back
 * overhead); h.drive(h, dt) sets the hands' targets each frame before the figures move (heldEarly), for a
 * carry that walks, turns and crouches with the body.
 */
const HELD = { list: [] };
/** The arm IK aims the hand's axis; the palm's surface sits this far inboard of it. */
const PALM_OFF = 0.016;
/** Palm centre to the fingertips (fingers lightly curled): a hand that touches a point stops this far short of it. */
const TIP = 0.088;
/** How far a grip on a thin panel sits toward the holder: the palm on the near half of the edge, the fingers just round the far one. */
const NEAR = 0.045;
/** How far in front of the courier the carton sits on the floor: past its knees as it stoops (knees bent, back bent), within reach. */
const CARTON_AT = 0.72;
const _hl = V3(), _hr = V3(), _hx = V3(), _hy = V3(), _hz = V3(), _hm = V3();
const _hM = new THREE.Matrix4(), _hX = new THREE.Matrix4(), _hS = V3(), _hP = V3(), _hQ = new THREE.Quaternion();

/** The frame two hand points make: origin between them, x from the left one to the right one, y as near world up as x allows. */
function frameFrom(L, R, out) {
  const x = _hx.subVectors(R, L);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = _hy.set(0, 1, 0).addScaledVector(x, -x.y).normalize();
  const z = _hz.crossVectors(x, y);
  return out.makeBasis(x, y, z).setPosition(_hm.addVectors(L, R).multiplyScalar(0.5));
}
function palmFrame(fig, out) {
  return frameFrom(fig.palm(-1).getWorldPosition(_hl), fig.palm(1).getWorldPosition(_hr), out);
}

/**
 * Take hold of obj. With T (from holdTargets) the hold is set as it should be, palms exactly on the grips,
 * and the object eases into the hands over a tenth of a second (any last centimetre is taken up by the object
 * settling into the grip, never by the hands passing into it).
 */
function grab(obj, fig, T = null) {
  release(obj);
  scene.attach(obj);
  obj.updateMatrixWorld(true);
  const F = T ? frameFrom(T.pL, T.pR, new THREE.Matrix4()) : palmFrame(fig, new THREE.Matrix4());
  const rel = F.invert().multiply(obj.matrixWorld);
  const h = { obj, fig, rel, pitch: 0, drive: null, k: T ? 0 : 1, p0: obj.position.clone(), q0: obj.quaternion.clone() };
  HELD.list.push(h);
  return h;
}
function release(obj) {
  HELD.list = HELD.list.filter(h => h.obj !== obj);
}
/**
 * Before the figures move: every carry sets its hands' targets from where its body is now (after the walkers have
 * stepped and turned), so the arm IK never chases a target left over from the body's last pose.
 */
function heldEarly(dt) {
  for (const h of HELD.list) if (h.drive && h.obj.parent) h.drive(h, dt);
}
/** Place every held object from its holder's palms (run after the figures and the tweens, before the render). */
function heldLate(dt) {
  for (const h of HELD.list) {
    if (!h.obj.parent) continue;
    palmFrame(h.fig, _hM);
    if (h.pitch) _hM.multiply(_hX.makeRotationX(h.pitch));
    _hM.multiply(h.rel);
    _hM.decompose(_hP, _hQ, _hS);
    if (h.k < 1) {
      h.k = Math.min(1, h.k + dt / 0.12);
      const e = easeOut(h.k);
      h.obj.position.lerpVectors(h.p0, _hP, e);
      h.obj.quaternion.slerpQuaternions(h.q0, _hQ, e);
    } else {
      h.obj.position.copy(_hP);
      h.obj.quaternion.copy(_hQ);
    }
    h.obj.updateMatrixWorld(true);
  }
}

/**
 * The two palm targets that hold an object by its ±x faces at (±half, y, z) of its own frame, for the
 * figure's own left and right hands. pL/pR: where the palms' surfaces go (on the faces, 2 mm proud);
 * L/R: the IK targets, PALM_OFF further out, because the IK aims the hand's axis, not the palm.
 */
function holdTargets(fig, obj, half, y, z, near = 0) {
  obj.updateWorldMatrix(true, false);
  if (near) {
    // the palms sit on the near half of the faces, so the fingers wrap the far edge instead of reaching past it
    const me = obj.worldToLocal(fig.root.getWorldPosition(V3()));
    z += Math.sign(me.z - z || 1) * near;
  }
  const a = worldOf(obj, half + 0.002, y, z), b = worldOf(obj, -half - 0.002, y, z);
  const ax = V3().subVectors(a, b).normalize();
  const ta = a.clone().addScaledVector(ax, PALM_OFF), tb = b.clone().addScaledVector(ax, -PALM_OFF);
  const left = V3(1, 0, 0).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
  return a.dot(left) >= b.dot(left) ? { L: ta, R: tb, pL: a, pR: b } : { L: tb, R: ta, pL: b, pR: a };
}
/** Both hands to a hold (or let go with null). */
function handsTo(fig, T) {
  fig.reach(-1, T ? T.L : null);
  fig.reach(1, T ? T.R : null);
}
/** How far the palms still are from a hold's grips (metres, the worse hand). */
function palmErr(fig, T) {
  return Math.max(fig.palm(-1).getWorldPosition(_hl).distanceTo(T.pL), fig.palm(1).getWorldPosition(_hr).distanceTo(T.pR));
}
/** A hold moved by an offset (world). */
const holdShift = (T, d) => ({ L: T.L.clone().add(d), R: T.R.clone().add(d), pL: T.pL.clone().add(d), pR: T.pR.clone().add(d) });
/** A hold re-expressed in the figure's root frame (so it can ride with the body), and back. */
function holdToLocal(fig, T) {
  fig.root.updateWorldMatrix(true, false);
  const f = v => fig.root.worldToLocal(v.clone());
  return { L: f(T.L), R: f(T.R), pL: f(T.pL), pR: f(T.pR) };
}
function holdLerp(A, B, e) {
  return { L: A.L.clone().lerp(B.L, e), R: A.R.clone().lerp(B.R, e), pL: A.pL.clone().lerp(B.pL, e), pR: A.pR.clone().lerp(B.pR, e) };
}
/** A hold in the root frame: grips half apart (palm surfaces), at height y, depth z in front of the body. */
function bodyHold(half, y, z) {
  const s = half + 0.002, t = s + PALM_OFF;
  return { L: V3(t, y, z), R: V3(-t, y, z), pL: V3(s, y, z), pR: V3(-s, y, z) };
}
/** A drive that keeps the hands on a hold given in the root frame (walks, turns and crouches with the body). */
function bodyDrive(get) {
  const a = V3(), b = V3();
  return h => {
    const r = h.fig.root;
    r.updateWorldMatrix(true, false);
    const T = get();
    h.fig.reach(-1, r.localToWorld(a.copy(T.L)));
    h.fig.reach(1, r.localToWorld(b.copy(T.R)));
  };
}
/** One hand's target that brings its fingertips to p, the hand coming from `from` (a direction toward the hand). */
const touchAt = (p, from, dist = TIP) => p.clone().addScaledVector(from.clone().normalize(), dist);

/** The display's hand-holds and parts, measured from whatever the station built (its own frame: origin at the foot). */
function monitorGeom(st) {
  const mon = st.monitor;
  const P = st.monitorParts || {};
  // measure in the display's own frame (where it stands now does not matter)
  const bb = localBounds(P.panel || mon);
  if (P.panel) {
    const corners = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(mon.worldToLocal(P.panel.localToWorld(V3(x, y, z))));
    bb.makeEmpty();
    corners.forEach(v => bb.expandByPoint(v));
  }
  const all = localBounds(mon, o => o === P.cable);
  const half = (bb.max.x - bb.min.x) / 2; // the panel's true half width: the palms go outside it
  const panelH = Math.min(0.42, (bb.max.y - bb.min.y) * (P.panel ? 1 : 0.62));
  const top = bb.max.y, midY = top - panelH / 2, zc = (bb.min.z + bb.max.z) / 2;
  const gripY = top - 0.05; // near the top of the sides: the palm's 8 cm sit just under the top edge
  return {
    mon, P, half, midY, top, panelH, zc, gripY, all,
    /** The screen's facing (world): the panel's -z. */
    facing: () => V3(0, 0, -1).applyQuaternion(mon.getWorldQuaternion(new THREE.Quaternion())),
    port: () => (P.cablePort ? P.cablePort.getWorldPosition(V3()) : worldOf(mon, 0, midY - panelH * 0.32, zc + 0.012)),
    power: () => (P.powerButton ? P.powerButton.getWorldPosition(V3()) : worldOf(mon, half - 0.03, midY - panelH / 2 + 0.006, zc + 0.01)),
  };
}

/* ---------- the smash ---------------------------------------------------------------- */

/** Where the current incident has got to (tests and the inspector read it). */
const mark = step => INCIDENT.active && ((INCIDENT.active.step = step), (INCIDENT.active.stepT = 0));

/** The station's frame: a point there → the world, a world point → there, and yaw both ways (the station turns only about y). */
const stYaw = st => {
  const q = st.group.getWorldQuaternion(new THREE.Quaternion());
  const v = V3(0, 0, 1).applyQuaternion(q);
  return Math.atan2(v.x, v.z);
};
const stPt = (st, x, z, y = 0) => st.group.localToWorld(V3(x, y, z));
const toSt = (st, p) => st.group.worldToLocal(p.clone());

/**
 * A few steps for a seated agent's standing body: its slot carries it to (x, z) facing yaw, all in its station's
 * frame (the station keeps the standing root at (0, 0, rz) inside the slot), and the legs step as it goes.
 * each(e) runs every frame with the eased progress (a held display riding along, a look).
 */
async function stepTo(fig, st, x, z, yaw, dur, each = null) {
  const slot = st.figureSlot;
  const rz = fig.root.position.z;
  const tx = x - rz * Math.sin(yaw), tz = z - rz * Math.cos(yaw);
  const p0x = slot.position.x, p0z = slot.position.z, y0 = slot.rotation.y;
  const dy = wrapAngle(yaw - y0);
  const dist = Math.hypot(tx - p0x, tz - p0z) + Math.abs(dy) * 0.3;
  const steps = Math.max(1, Math.round(dist / 0.3));
  const ph0 = fig.walkPhase;
  fig.setMode('walk');
  await tween(dur, k => {
    const e = easeInOut(k);
    slot.position.set(lerp(p0x, tx, e), 0, lerp(p0z, tz, e));
    slot.rotation.y = y0 + dy * e;
    fig.walkPhase = ph0 + steps * Math.PI * e;
    if (each) each(e);
  });
  fig.setMode('stand');
}
/** The slot back to where the station built it (the agent can sit again). */
function slotHome(st) {
  st.figureSlot.position.set(0, 0, 0);
  st.figureSlot.rotation.set(0, 0, 0);
}

/** The whole incident: smash, wait, courier in, install, courier out. */
async function smashScreen(id, escalation=null) {
  const a = OFFICE_STATE.agents[id];
  const w = WORLD.byId[id];
  if (!a || !w || INCIDENT.active || a.location !== 'desk' || w.fig.root.parent !== w.st.figureSlot || MOVE.walkers[id]) return false;
  const { fig, st } = w;
  if (!st.monitor.visible) return false;
  INCIDENT.active = { id, phase: 'lift', t: 0 };
  INCIDENT.lastAt = SIM.clock();
  const s = SIM.agents[id];
  if (SIM.enabled && s) s.until = Infinity; // the work waits for the new screen
  const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
  pushLog(id, escalation ? `Two repair attempts and a fresh check: ${escalation.dependency}` : 'Screen incident demonstration', 'stuck');
  const R = rig(fig);
  const mon = st.monitor;
  const home = { parent: mon.parent, pos: mon.position.clone(), rot: mon.rotation.clone() };
  INCIDENT.active.home = home;
  try {
    const G = monitorGeom(st);
    INCIDENT.active.G = G;
    // the last straw: hands to the head, then up out of the chair
    fig.setMode('upset');
    await wait(900);
    fig.setMode('stand');
    await wait(650);
    if (R.full) await smashHandsOn(fig, st, R, G);
    else await smashSimple(fig, st);
    // impact: where the panel hits
    const land = worldOf(mon, 0, G.midY, G.zc);
    land.y = 0.02;
    release(mon);
    mon.visible = false;
    burst(land, st, fig);
    mark('impact');
    R.recoil();
    R.free();
    await wait(220);
    R.bend(0);
    fig.setMode('upset');
    if (typeof UI !== 'undefined') UI.toast(escalation ? `Crimson needs your decision: ${escalation.dependency}` : `${nm} smashed a screen — a replacement is on its way`);
    if (SIM.enabled) setAgentStatus(id, 'THINKING', { stuck: true, detail: 'Waiting for a new screen' });
    await wait(2400);
    // back to the desk and down into the chair to wait
    R.look(null);
    if (R.full) await stepTo(fig, st, 0, fig.root.position.z, 0, 0.9);
    slotHome(st);
    fig.setMode('think');
    INCIDENT.active.phase = 'courier';
    await courierRun(w, a, home);
  } catch (err) {
    console.warn('[incident] recovered from', err);
    incidentRecover(w, home);
  }
  INCIDENT.active.phase = 'done';
  INCIDENT.active = null;
  pushLog(id, SIM.enabled ? 'New screen installed — back to it' : 'Screen animation complete; Studio job status is unchanged');
  if (SIM.enabled && a.stuck) setAgentStatus(id, a.status, { stuck: false, detail: 'New screen installed — back to it' }); // the wait is over
  if (SIM.enabled && s) s.until = SIM.clock() + 1.5;
  VIEW.sync(id);
  return true;
}

/** Something went wrong mid-incident: put the desk right (the display home and lit), the agent back, the courier gone. */
function incidentRecover(w, home) {
  const st = w.st, mon = st.monitor;
  HELD.list = [];
  w.fig.reach && (w.fig.reach(-1, null), w.fig.reach(1, null), w.fig.bend(0), w.fig.crouch(0), w.fig.lookAt(null));
  slotHome(st);
  w.fig.setMode('think');
  home.parent.attach(mon);
  mon.position.copy(home.pos);
  mon.rotation.copy(home.rot);
  mon.scale.setScalar(1);
  mon.visible = true;
  if (st.monitorParts && st.monitorParts.cable) st.monitorParts.cable.visible = true;
  st.screenObj.state = 'think';
  if (st.screenMesh && st.screenMesh.material && st.screenMesh.material.map === INCIDENT.black && st._realMap) st.screenMesh.material.map = st._realMap;
  for (const p of INCIDENT.props) p.parent && p.parent.remove(p);
  INCIDENT.props = [];
  const c = INCIDENT.courier;
  if (c) {
    delete MOVE.walkers.courier;
    c.root.parent && c.root.parent.remove(c.root);
    WORLD.figures = WORLD.figures.filter(f => f !== c);
    delete WORLD.byId.courier;
    INCIDENT.courier = null;
  }
  ROOM_OBJ.lift.target = 0;
}

/**
 * Hands on. Step up to the desk square to the display, lean over and take it by its sides (palms on the
 * edges, outside the panel), tear it off the cable, turn away from the desk with it, raise it overhead and
 * arch back, then spike it into the floor. The display is held throughout: it goes where the hands go.
 */
async function smashHandsOn(fig, st, R, G) {
  const mon = G.mon;
  const P = G.P;
  // 1 · up to the desk: square to the display, thighs just clear of the desk's front edge
  const c = toSt(st, worldOf(mon, 0, G.gripY, G.zc));
  const qInv = st.group.getWorldQuaternion(new THREE.Quaternion()).invert();
  const n = G.facing().applyQuaternion(qInv); // the screen's facing in the station's frame (toward the agent)
  const zIn = DESK.nearZ - 0.15;
  const D = Math.abs(n.z) > 0.2 ? (zIn - c.z) / n.z : 0.75;
  const inX = c.x + n.x * D, inZ = c.z + n.z * D, inYaw = Math.atan2(-n.x, -n.z);
  R.look(worldOf(mon, 0, G.midY, G.zc));
  await stepTo(fig, st, inX, inZ, inYaw, 0.75);
  // 2 · lean over, both hands to the sides of the panel
  mark('grab');
  R.bend(1);
  const T = holdTargets(fig, mon, G.half, G.gripY, G.zc, NEAR);
  handsTo(fig, T);
  await until(() => palmErr(fig, T) < 0.01, 0.9);
  const h = grab(mon, fig, T);
  // 3 · tear it free: a tug against the cable, the cable gives, then it comes away up and toward the body
  const toward = G.facing(); // the screen faces the agent
  await tween(0.2, k => handsTo(fig, holdShift(T, toward.clone().multiplyScalar(0.035 * Math.sin(k * Math.PI)))));
  if (P.cable) P.cable.visible = false;
  spark(G.port(), 14, 0.5);
  const T1 = holdShift(T, toward.clone().multiplyScalar(0.17).add(V3(0, 0.11, 0)));
  await tween(0.34, k => {
    const e = easeOut(k);
    handsTo(fig, holdLerp(T, T1, e));
    R.bend(1 - 0.55 * e);
  });
  // 4 · turn away from the desk with it, to open floor (toward the agent's free side), the display at the chest
  const side = spikeSide(st, fig);
  const A = holdToLocal(fig, T1);
  const chest = bodyHold(G.half, 1.3, 0.34); // high enough that the foot clears the keyboard as it turns
  let mix = 0;
  h.drive = bodyDrive(() => holdLerp(A, chest, mix));
  await stepTo(fig, st, side.x, side.z, side.yaw, 0.95, e => {
    mix = e;
    R.bend(0.45 * (1 - e));
  });
  // 5 · overhead, arching back: the display rises in an arc and tips back over the head
  const headY = fig.root.worldToLocal(fig.head.getWorldPosition(V3())).y;
  const over = bodyHold(G.half, headY + 0.27, -0.05);
  let arc = 0;
  h.drive = bodyDrive(() => {
    const H = holdLerp(chest, over, mix);
    const lift = Math.sin(mix * Math.PI) * 0.1;
    for (const k of ['L', 'R', 'pL', 'pR']) H[k].z += lift + arc;
    return H;
  });
  mix = 0;
  await tween(0.85, k => {
    const e = easeInOut(k);
    mix = e;
    h.pitch = 0.6 * e;
    R.bend(-0.62 * e); // into the wind-up arch
  });
  // a beat at the top, trembling
  mark('overhead');
  await tween(0.5, k => {
    arc = Math.sin(k * 47) * 0.008;
    h.pitch = 0.6 + Math.sin(k * 31) * 0.03;
  });
  arc = 0;
  // 6 · the spike: everything forward and down at once; the hands let go as the arms come through
  mark('spike');
  const throwAt = bodyHold(G.half, 1.28, 0.42);
  h.drive = bodyDrive(() => holdLerp(over, throwAt, mix));
  mix = 0;
  await tween(0.15, k => {
    const e = easeIn3(k);
    mix = e;
    h.pitch = 0.6 - 1.2 * e;
    R.bend(-0.62 + 1.3 * Math.min(1, k * 1.4));
  });
  release(mon);
  // free flight to the floor in front, turning face-down as it goes (placed by the panel's centre, which lands)
  const fwd = V3(0, 0, 1).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
  const p1 = mon.position.clone(), q1 = mon.quaternion.clone();
  const lateral = V3().crossVectors(V3(0, 1, 0), fwd).normalize();
  const qLand = new THREE.Quaternion().setFromAxisAngle(lateral, 1.25).multiply(q1).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), 0.35));
  const hit = fig.root.getWorldPosition(V3()).addScaledVector(fwd, 0.8);
  hit.y = 0.09;
  const land = hit.clone().sub(V3(0, G.midY, G.zc).applyQuaternion(qLand));
  const follow = bodyHold(G.half, 0.82, 0.52);
  fig.reach(-1, fig.root.localToWorld(follow.L.clone()));
  fig.reach(1, fig.root.localToWorld(follow.R.clone()));
  R.bend(1);
  await tween(0.17, k => {
    const e = easeIn3(k);
    mon.position.lerpVectors(p1, land, e);
    mon.quaternion.slerpQuaternions(q1, qLand, e);
  });
}

/** Where the agent turns to throw: the free side of its spot (station frame), the landing clear of furniture. */
function spikeSide(st, fig) {
  const rz = fig.root.position.z;
  for (const yaw of [HALF_PI, -HALF_PI]) {
    const at = { x: 0, z: rz - 0.02, yaw };
    const landing = stPt(st, at.x + Math.sin(yaw) * 0.8, at.z + Math.cos(yaw) * 0.8);
    if (!blockedAt(landing.x, landing.z, 0.36)) return at;
  }
  return { x: 0, z: rz - 0.02, yaw: HALF_PI };
}

/** No hands-on rig: the old poses carry it (lift, shake, slam). */
async function smashSimple(fig, st) {
  fig.setMode('lift');
  const mon = st.monitor;
  const from = { p: mon.position.clone(), ry: mon.rotation.y, rx: mon.rotation.x };
  const over = V3(0.0, 1.58, 0.1);
  await tween(0.75, k => {
    const e = easeInOut(k);
    mon.position.lerpVectors(from.p, over, e);
    mon.position.y += Math.sin(e * Math.PI) * 0.12;
    mon.rotation.set(lerp(from.rx, -0.35, e), lerp(from.ry, 0, e), 0);
  });
  await tween(0.8, k => {
    mon.position.set(over.x + Math.sin(k * 40) * 0.025, over.y + Math.abs(Math.sin(k * 23)) * 0.03, over.z);
    mon.rotation.z = Math.sin(k * 31) * 0.12;
  });
  fig.setMode('slam');
  const land = V3(-0.78, 0.02, 0.34);
  const p0 = mon.position.clone();
  await tween(0.24, k => {
    const e = easeIn3(k);
    mon.position.lerpVectors(p0, land, e);
    mon.rotation.set(lerp(-0.35, -1.9, e), 0, lerp(0, 0.7, e));
  });
}

/* ---------- the debris ---------------------------------------------------------------- */

function burst(at, st, fig) {
  const plastic = st.monitor.children[0] && st.monitor.children[0].material ? st.monitor.children[0].material : MAT.alu;
  const mats = [GLASS_SHARD_MAT, GLASS_SHARD_MAT, GLASS_SHARD_MAT, MAT.black, plastic, MAT.alu];
  const away = fig ? new THREE.Vector3(0, 0, 1).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Vector3();
  for (let i = 0; i < 30; i++) {
    const mat = mats[i % mats.length];
    const glass = mat === GLASS_SHARD_MAT;
    const m = new THREE.Mesh(SHARD_GEO, mat);
    const sz = glass ? 0.025 + Math.random() * 0.09 : 0.012 + Math.random() * 0.05;
    m.scale.set(sz, glass ? 0.0035 : 0.006 + Math.random() * 0.012, sz * (0.35 + Math.random() * 0.9));
    m.position.copy(at).add(new THREE.Vector3(rand(-0.08, 0.08), 0.03 + Math.random() * 0.05, rand(-0.06, 0.06)));
    m.castShadow = true;
    const a = Math.random() * TAU, sp = (glass ? 0.9 : 0.6) + Math.random() * 1.8;
    const v = new THREE.Vector3(Math.cos(a) * sp, 0.6 + Math.random() * 1.6, Math.sin(a) * sp).addScaledVector(away, 0.6);
    m.userData = { v, spin: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), rest: false, slide: glass ? 0.82 : 0.55 };
    scene.add(m);
    INCIDENT.shards.push(m);
  }
  // the stand: it breaks off whole, bounces and skids
  const stand = new THREE.Mesh(roundedBoxGeometry(0.15, 0.2, 0.014, 0.004, 2), MAT.alu);
  stand.position.copy(at).add(new THREE.Vector3(0, 0.08, 0));
  stand.castShadow = true;
  stand.userData = { v: new THREE.Vector3(rand(-0.6, 0.6), 1.4, rand(-0.6, 0.6)).addScaledVector(away, 1.1), spin: new THREE.Vector3(rand(-9, 9), rand(-6, 6), rand(-9, 9)), rest: false, slide: 0.7 };
  scene.add(stand);
  INCIDENT.shards.push(stand);
  spark(at.clone().add(new THREE.Vector3(0, 0.04, 0)), 90, 1);
  // dust: a low ring that rolls out across the floor
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.24, 48), new THREE.MeshBasicMaterial({ color: lin('#d8d6d0'), transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, fog: false }));
  ring.rotation.x = -HALF_PI;
  ring.position.set(at.x, 0.012, at.z);
  ring.userData = { t: 0 };
  scene.add(ring);
  INCIDENT.dust.push(ring);
  // the crack of it: a cold flash at the floor. Light-coloured glows, not a light: a light added
  // mid-scene would make every material recompile, and the room would hitch at the worst moment
  if (!INCIDENT.flash) {
    const glow = (opacity) => new THREE.MeshBasicMaterial({ map: flashTexture(), color: lin('#e9f3ff'), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: lin('#e9f3ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    spr.scale.set(0.9, 0.9, 1);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), glow(0));
    pool.rotation.x = -HALF_PI;
    spr.renderOrder = pool.renderOrder = 6;
    spr.visible = pool.visible = false;
    INCIDENT.flash = { spr, pool, k: 0 };
    scene.add(spr, pool);
  }
  const F = INCIDENT.flash;
  F.spr.position.set(at.x, 0.22, at.z);
  F.pool.position.set(at.x, 0.006, at.z);
  F.k = 1;
  F.spr.visible = F.pool.visible = true;
}

let FLASH_TEX = null;
/** A soft white disc for flashes and glows (made once). */
function flashTexture() {
  if (FLASH_TEX) return FLASH_TEX;
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(240,247,255,0.6)');
  g.addColorStop(0.55, 'rgba(232,242,255,0.14)');
  g.addColorStop(1, 'rgba(232,242,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  FLASH_TEX = canvasTexture(c);
  return FLASH_TEX;
}

/** A spray of glass glints (or cable sparks) from a point. */
function spark(at, n, power) {
  const pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    pos.set([at.x, at.y, at.z], i * 3);
    const a = Math.random() * TAU, el = Math.random() * 1.25, sp = (0.8 + Math.random() * 2.4) * power;
    vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 0.4 * power, Math.sin(a) * Math.cos(el) * sp));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeef7ff, size: power > 0.7 ? 0.032 : 0.02, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }));
  pts.userData = { vel, t: 0, life: 0.6 + power * 0.5 };
  scene.add(pts);
  if (INCIDENT.sparks) INCIDENT.sparks.push ? INCIDENT.sparks.push(pts) : (INCIDENT.sparks = [INCIDENT.sparks, pts]);
  else INCIDENT.sparks = [pts];
}

/** Physics for the pieces (figurine-scale gravity), the glints, the dust and the flash. */
function updateIncidents(dt) {
  if (INCIDENT.escalations.length) pendingEscalationIncident();
  if (INCIDENT.active) INCIDENT.active.stepT = (INCIDENT.active.stepT || 0) + dt; // (how far into its step: the inspector and tests)
  for (const m of INCIDENT.shards) {
    const u = m.userData;
    if (u.fade != null) {
      u.fade -= dt * 1.6;
      m.scale.multiplyScalar(0.92);
      if (u.fade <= 0) m.visible = false;
      continue;
    }
    if (u.rest) continue;
    u.v.y -= 6.5 * dt;
    m.position.addScaledVector(u.v, dt);
    m.rotation.x += u.spin.x * dt;
    m.rotation.y += u.spin.y * dt;
    m.rotation.z += u.spin.z * dt;
    const floor = Math.max(0.006, m.scale.y / 2);
    if (m.position.y < floor) {
      m.position.y = floor;
      u.v.y *= -0.26;
      u.v.x *= u.slide;
      u.v.z *= u.slide;
      u.spin.multiplyScalar(0.45);
      if (Math.abs(u.v.y) < 0.15 && Math.hypot(u.v.x, u.v.z) < 0.12) {
        u.rest = true;
        m.rotation.x = 0;
        m.rotation.z = 0;
      }
    }
  }
  INCIDENT.shards = INCIDENT.shards.filter(m => {
    if (m.visible) return true;
    scene.remove(m);
    return false;
  });
  const list = INCIDENT.sparks ? (Array.isArray(INCIDENT.sparks) ? INCIDENT.sparks : [INCIDENT.sparks]) : [];
  for (const sp of list) {
    const u = sp.userData;
    u.t += dt;
    const pos = sp.geometry.attributes.position;
    u.vel.forEach((v, i) => {
      v.y -= 6 * dt;
      pos.setXYZ(i, pos.getX(i) + v.x * dt, Math.max(0.01, pos.getY(i) + v.y * dt), pos.getZ(i) + v.z * dt);
    });
    pos.needsUpdate = true;
    sp.material.opacity = Math.max(0, 1 - u.t / (u.life || 0.9));
  }
  INCIDENT.sparks = list.filter(sp => {
    if (sp.userData.t <= (sp.userData.life || 0.9)) return true;
    scene.remove(sp);
    return false;
  });
  for (const r of INCIDENT.dust) {
    r.userData.t += dt;
    const k = r.userData.t / 0.9;
    r.scale.setScalar(1 + k * 5);
    r.material.opacity = Math.max(0, 0.32 * (1 - k));
  }
  INCIDENT.dust = INCIDENT.dust.filter(r => {
    if (r.userData.t < 0.9) return true;
    scene.remove(r);
    return false;
  });
  const F = INCIDENT.flash;
  if (F && F.k > 0) {
    F.k = Math.max(0, F.k - dt * 7.5); // about an eighth of a second
    const e = F.k * F.k;
    F.spr.material.opacity = e * 0.95;
    F.pool.material.opacity = e * 0.6;
    if (F.k === 0) F.spr.visible = F.pool.visible = false;
  }
}

/* ---------- the replacement: a courier, a carton, and a careful setup -------------------- */

/**
 * A white retail carton sized to the display: it stands upright inside between two foam end caps, the screen
 * under a clear film; four top flaps and the seal tape. The packed display's pose (monAt, monQ, carton frame)
 * leaves a hand's width between each side of the panel and the carton's walls, so the hands can reach in.
 */
function makeCarton(G) {
  const W = Math.max(0.74, G.half * 2 + 0.16), D = 0.28, t = 0.004; // deep enough that hands on the panel stay inside
  const H = Math.max(0.5, G.all.max.y + 0.03);
  const g = new THREE.Group();
  const print = makeCanvas(512, 340);
  const ctx = print.getContext('2d');
  ctx.fillStyle = '#f1f1ee';
  ctx.fillRect(0, 0, 512, 340);
  ctx.strokeStyle = 'rgba(40,40,42,0.55)';
  ctx.lineWidth = 2.2;
  roundRect(ctx, 120, 70, 272, 160, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(236, 230);
  ctx.lineTo(248, 268);
  ctx.lineTo(264, 268);
  ctx.lineTo(276, 230);
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,40,42,0.7)';
  ctx.font = `600 18px ${BRAND.ui}`;
  spacedText(ctx, 'DISPLAY', 206, 304, 6);
  const printTex = canvasTexture(print);
  const face = new THREE.MeshStandardMaterial({ map: printTex, roughness: 0.8, metalness: 0, fog: false });
  const wall = (w, h, x, y, z, ry, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };
  wall(W, H, 0, H / 2, D / 2 - t / 2, 0, face);
  // the front (the courier's side) is a tear-away panel: its top strip folds down with the near flap, so the arms
  // reach in over a low front instead of through a wall
  const S = 0.14, lowH = H - S;
  const remapV = (geo, v0, v1) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
    uv.needsUpdate = true;
  };
  remapV(wall(W, lowH, 0, lowH / 2, -D / 2 + t / 2, Math.PI, face).geometry, 0, lowH / H);
  const front = new THREE.Group();
  front.position.set(0, lowH, -D / 2 + t / 2);
  g.add(front);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W, S, t), face);
  remapV(strip.geometry, lowH / H, 1);
  strip.rotation.y = Math.PI;
  strip.position.y = S / 2;
  front.add(strip);
  wall(D - 2 * t, H, W / 2 - t / 2, H / 2, 0, HALF_PI, CARTON_MAT);
  wall(D - 2 * t, H, -W / 2 + t / 2, H / 2, 0, HALF_PI, CARTON_MAT);
  g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(W, t, D), CARTON_MAT), 0, t / 2, 0));
  // inside faces, a shade darker
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 2.2 * t, H - t, D - 2.2 * t), CARTON_IN_MAT.clone());
  inner.material.side = THREE.BackSide;
  inner.position.y = H / 2 + t / 2;
  g.add(inner);
  // four flaps, hinged on the top edges
  const flaps = [];
  const flap = (w, d, hx, hz, axis, sign) => {
    const piv = new THREE.Group();
    piv.position.set(hx, H, hz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), CARTON_MAT);
    if (axis === 'x') m.position.z = (-sign * d) / 2;
    else m.position.x = (-sign * w) / 2;
    piv.add(m);
    piv.userData = { axis, sign, w, d };
    g.add(piv);
    flaps.push(piv);
    return piv;
  };
  flap(W, D / 2, 0, D / 2, 'x', 1);
  flap(W, D / 2, 0, -D / 2, 'x', -1);
  flap(D / 2 - 0.004, D - 0.01, W / 2, 0, 'z', 1);
  flap(D / 2 - 0.004, D - 0.01, -W / 2, 0, 'z', -1);
  flaps.forEach((p, i) => (p.position.y += i < 2 ? 0.0045 : 0)); // the long flaps fold over the short ones
  g.updateMatrixWorld(true);
  front.attach(flaps[1]); // the near long flap rides on the tear-away front
  const tape = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.0015, 0.05), TAPE_MAT);
  tape.position.set(0, H + 0.007, 0);
  g.add(tape);
  // foam end caps, either side of the panel's lower half (the hands go in above them)
  const capW = W / 2 - t - G.half - 0.004;
  const caps = [];
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(roundedBoxGeometry(capW, H * 0.52, D - 2.4 * t, 0.008, 2), FOAM_MAT);
    cap.position.set(sx * (W / 2 - t - capW / 2), t + (H * 0.52) / 2, 0);
    g.add(cap);
    caps.push(cap);
  }
  g.traverse(o => o.isMesh && (o.castShadow = true));
  // the display: upright, screen toward the carton's +z, the panel just ahead of centre (its foot behind it), on the carton's floor
  const monQ = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI);
  const monAt = V3(0, t, Math.min(0.02 + G.zc, D / 2 - t - 0.01 + G.all.min.z));
  return { group: g, flaps, tape, caps, front, strip, S, W, H, D, monAt, monQ, gy: H * 0.7 };
}

/** Opens (k = 1) or folds (k = 0) a carton flap about its hinge. */
function setFlap(piv, k) {
  const ang = k * 2.15 * piv.userData.sign;
  if (piv.userData.axis === 'x') piv.rotation.x = ang;
  else piv.rotation.z = -ang;
}
/** The middle of a flap's free edge (where a hand lifts it), world. */
function flapTip(piv) {
  const u = piv.userData;
  return u.axis === 'x' ? worldOf(piv, 0, 0.004, -u.sign * u.d * 0.85) : worldOf(piv, -u.sign * u.w * 0.85, 0.004, 0);
}

const SERIF = 'Didot, "Bodoni 72", "Bodoni Moda", "Playfair Display", serif';
/** The display's picture off (black) until powered; returns the switch that gives it back. */
function screenOff(st) {
  const mesh = st.screenMesh;
  if (!mesh || !mesh.material) return () => {};
  const real = mesh.material.map;
  st._realMap = real;
  if (!INCIDENT.black) {
    const c = makeCanvas(8, 8), x = c.getContext('2d');
    x.fillStyle = '#040405';
    x.fillRect(0, 0, 8, 8);
    INCIDENT.black = canvasTexture(c);
  }
  mesh.material.map = INCIDENT.black;
  mesh.material.needsUpdate = true;
  return () => {
    mesh.material.map = real;
    mesh.material.needsUpdate = true;
  };
}
/** A boot screen on the new display: black, the mark, a hairline of progress, then the work. */
async function bootScreen(st) {
  const mesh = st.screenMesh;
  if (!mesh || !mesh.material) return;
  const real = mesh.material.map;
  const c = makeCanvas(512, 300), ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  await tween(2.4, k => {
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, 512, 300);
    const a = clamp((k - 0.12) / 0.25, 0, 1) * (1 - clamp((k - 0.9) / 0.1, 0, 1));
    ctx.globalAlpha = a;
    ctx.font = `400 46px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f4f2';
    ctx.fillText('B', 216, 160);
    ctx.fillText('Co', 302, 160);
    ctx.fillStyle = BRAND.crimson;
    ctx.font = `italic 400 46px ${SERIF}`;
    ctx.fillText('&', 254, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(196, 196, 120, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(196, 196, 120 * clamp((k - 0.3) / 0.55, 0, 1), 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    tex.needsUpdate = true;
  });
  mesh.material.map = real;
  mesh.material.needsUpdate = true;
  tex.dispose();
}

/** A few steps for a free-standing figure (not a nav walker): to (x, z) facing yaw, all in the world. */
async function stepRoot(fig, x, z, yaw, dur, each = null, gait = 'walk') {
  const r = fig.root;
  const p0x = r.position.x, p0z = r.position.z, y0 = r.rotation.y;
  const dy = wrapAngle(yaw - y0);
  const dist = Math.hypot(x - p0x, z - p0z) + Math.abs(dy) * 0.3;
  const steps = Math.max(1, Math.round(dist / 0.3));
  const ph0 = fig.walkPhase;
  fig.setMode(gait);
  await tween(dur, k => {
    const e = easeInOut(k);
    r.position.set(lerp(p0x, x, e), 0, lerp(p0z, z, e));
    r.rotation.y = y0 + dy * e;
    fig.walkPhase = ph0 + steps * Math.PI * e;
    if (each) each(e);
  });
  fig.setMode('stand');
}
/** Walk the courier along world points (nav avoidance and all); resolves on arrival. Empty-handed, it walks; laden, it carries. */
function courierWalk(points, face, speed = 1.2, gait = 'carry') {
  return new Promise(res => MOVE.walk('courier', points, { face, speed, gait, onArrive: res, onStuck: () => false }));
}

/**
 * Where the courier works, in the station's frame. P: behind the display's place, facing the way the screen
 * faces (so it sets the display down from behind, cable side to it); at: where it puts the carton down and
 * unpacks (the carton 0.45 in front), with the way round the desk from the agent's step-out point.
 * The first layout whose spots, carton and lines are clear of furniture wins.
 */
function courierPlan(st, c, n, C) {
  const pz = DESK.nearZ + DESK.d + 0.17;
  const d = Math.abs(n.z) > 0.2 ? (pz - c.z) / -n.z : 0.4;
  const P = { x: c.x - n.x * d, z: c.z - n.z * d, yaw: Math.atan2(n.x, n.z) };
  const P2 = { x: P.x - n.x * 0.16, z: P.z - n.z * 0.16 }; // a step back from P, clear for the walk in
  const sx = DESK.w / 2 + 0.6, bz = DESK.nearZ + DESK.d + 0.5;
  const layouts = [
    { at: [-sx, bz + 0.1], yaw: 0, via: [[-sx, 0.32]] },
    { at: [-sx, bz + 0.12], yaw: -HALF_PI, via: [[-sx, 0.32]] },
    { at: [-sx, 0.95], yaw: -HALF_PI, via: [[-sx, 0.32]] },
    { at: [sx, bz + 0.1], yaw: 0, via: [[-sx, -0.75], [sx, -0.75], [sx, 0.32]] },
    { at: [sx, bz + 0.12], yaw: HALF_PI, via: [[-sx, -0.75], [sx, -0.75], [sx, 0.32]] },
    { at: [0.2, bz + 0.62], yaw: 0, via: [[-sx, 0.32], [-sx, bz + 0.62]] },
  ];
  const W = (x, z) => stPt(st, x, z);
  // furniture, and the other desks' chairs (they roll, so the steering map leaves them out) and anyone seated in them
  const chairs = WORLD.stations.filter(o => o !== st && o.chair && o.chair.visible).map(o => o.chair.getWorldPosition(V3()));
  const free = (p, r) => {
    const q = W(p[0], p[1]);
    return !blockedAt(q.x, q.z, r) && chairs.every(c => Math.hypot(c.x - q.x, c.z - q.z) > r + 0.42);
  };
  const line = (a, b, r) => { const p = W(a[0], a[1]), q = W(b[0], b[1]); return lineFree(p.x, p.z, q.x, q.z, r); };
  const ex = NAV.nodes[SLOT_EXIT[WORLD.byId[st.spec.id].slot]];
  const E = ex ? (() => { const q = toSt(st, V3(ex.x, 0, ex.z)); return [q.x, q.z]; })() : [-0.86, 0.08];
  for (const L of layouts) {
    const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
    const box = [L.at[0] + fx * CARTON_AT, L.at[1] + fz * CARTON_AT];
    const ends = [-1, -0.5, 0, 0.5, 1].map(s => [box[0] + fz * s * (C.W / 2), box[1] - fx * s * (C.W / 2)]);
    const way = [E, ...L.via, L.at];
    // (the first leg leaves the step-out point beside the desk: the body must clear it; the carton rides above the top)
    const ok = free(L.at, 0.28) && ends.every(p => free(p, 0.14)) && way.every((p, i) => i === 0 || line(way[i - 1], p, i === 1 ? 0.25 : 0.36)) && line(L.at, [P2.x, P2.z], 0.26) && free([P2.x, P2.z], 0.2);
    if (ok) return { P, P2, at: { x: L.at[0], z: L.at[1], yaw: L.yaw }, via: L.via, box, ok: true };
  }
  // none of those fits (a desk hemmed in by lounge seating or the glass): search the open floor round the desk
  const alt = courierSearch(E, P, P2, C, free, line);
  if (alt) return Object.assign({ P, P2, ok: true }, alt);
  const L = layouts[0];
  return { P, P2, at: { x: L.at[0], z: L.at[1], yaw: L.yaw }, via: L.via, box: [L.at[0], L.at[1] + CARTON_AT], ok: false };
}

/** Nav points for a carton carried at chest height: the corner by the lounge fig is taken wider than a walker takes it, so
 *  the box, swinging round as the courier turns, stays clear of the leaves. */
const CARRY_WIDE = { M_w: [0.3, 0], L1: [0.3, 0] };
const carryPts = keys => (keys || []).map(k => {
  const n = NAV.nodes[k], o = CARRY_WIDE[k] || [0, 0];
  return [n.x + o[0], n.z + o[1]];
});

/** The step-out point sits right beside the desk end: a courier turning there swings the carton over the end of the desk
 *  (and its name plate). With a carton in its arms it cuts straight from the aisle to the next point when that line is clear. */
function skipStepOut(path, i) {
  if (i <= 0 || i >= path.length - 1) return path;
  const a = path[i - 1], b = path[i + 1];
  return lineFree(a[0], a[1], b[0], b[1], 0.36) ? path.slice(0, i).concat(path.slice(i + 1)) : path;
}

/** For a desk none of the set layouts fits: the open spot nearest the back of the desk where the carton can stand clear of
 *  the placement, and a walkable route to it from the step-out point (a breadth-first search over a 10 cm grid, then
 *  pulled taut into a few straight legs). Station frame throughout; null if there is none. */
function courierSearch(E, P, P2, C, free, line) {
  const S = 0.1, X0 = -3.2, Z0 = -1.8, NX = 65, NZ = 54;
  const seat = (x, z) => x > -0.8 && x < 0.8 && z > -0.7 && z < DESK.nearZ; // the seated agent's place at the desk
  const open = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * S, z = Z0 + j * S;
      open[j * NX + i] = !seat(x, z) && (Math.hypot(x - E[0], z - E[1]) < 0.3 || free([x, z], 0.34)) ? 1 : 0;
    }
  const cell = (x, z) => {
    const i = Math.round((x - X0) / S), j = Math.round((z - Z0) / S);
    return i >= 0 && i < NX && j >= 0 && j < NZ ? j * NX + i : -1;
  };
  const s0 = cell(E[0], E[1]);
  if (s0 < 0) return null;
  const from = new Int32Array(NX * NZ).fill(-2);
  from[s0] = -1;
  const queue = [s0];
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h], i = k % NX, j = (k - i) / NX;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if ((!di && !dj) || ii < 0 || ii >= NX || jj < 0 || jj >= NZ) continue;
        const kk = jj * NX + ii;
        if (from[kk] !== -2 || !open[kk] || (di && dj && !(open[j * NX + ii] && open[jj * NX + i]))) continue; // no corner cutting
        from[kk] = k;
        queue.push(kk);
      }
  }
  const segD = (p, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
  };
  const pP = [P.x, P.z], pP2 = [P2.x, P2.z];
  const cands = [];
  for (let x = -2.4; x <= 2.41; x += 0.2)
    for (let z = -1.2; z <= 3.01; z += 0.2) for (const yaw of [0, HALF_PI, -HALF_PI, Math.PI]) cands.push([x, z, yaw, Math.hypot(x - P2.x, z - P2.z)]);
  cands.sort((a, b) => a[3] - b[3]);
  for (const [x, z, yaw] of cands) {
    const k = cell(x, z);
    if (k < 0 || from[k] === -2 || !free([x, z], 0.28)) continue;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hw = C.W / 2;
    const box = [x + fx * CARTON_AT, z + fz * CARTON_AT];
    const a = [box[0] - fz * hw, box[1] + fx * hw], b = [box[0] + fz * hw, box[1] - fx * hw];
    if (seat(box[0], box[1]) || segD(pP, a, b) < 0.45 || segD(pP2, a, b) < 0.45) continue; // the placement keeps its floor
    if (![-1, -0.5, 0, 0.5, 1].every(s => free([box[0] + fz * s * hw, box[1] - fx * s * hw], 0.14))) continue;
    // the walk to the desk with the display, and back: clear of furniture and of the carton itself
    if (!line([x, z], pP2, 0.26) || ![0.25, 0.5, 0.75, 1].every(t => segD([x + (P2.x - x) * t, z + (P2.z - z) * t], a, b) > 0.42)) continue;
    // the route in: the grid path, pulled taut
    const cells = [];
    for (let c = k; c >= 0; c = from[c]) cells.push(c);
    const pts = cells.reverse().map(c => [X0 + (c % NX) * S, Z0 + Math.floor(c / NX) * S]);
    pts[0] = E;
    pts[pts.length - 1] = [x, z];
    const via = [];
    let a0 = pts[0];
    for (let m = 2; m < pts.length; m++)
      if (!line(a0, pts[m], via.length ? 0.34 : 0.25)) {
        via.push(pts[m - 1]);
        a0 = pts[m - 1];
      }
    const way = [E, ...via, [x, z]];
    if (!way.every((p, m) => m === 0 || line(way[m - 1], p, m === 1 ? 0.25 : 0.3))) continue;
    return { at: { x, z, yaw }, via, box, searched: true };
  }
  return null;
}

/** The courier: lift → glass doors → round to the back of the desk, a carton in its arms; unboxes, installs, folds, sweeps, leaves. */
async function courierRun(w, a, home) {
  const st = w.st, mon = st.monitor, Pp = st.monitorParts || {};
  const spec = typeof COURIER_SPEC !== 'undefined' ? COURIER_SPEC : { id: 'courier', color: 'slate', bot: { shell: 'graphite', hands: 'graphite', eyes: 'pair' }, build: { torsoW: 1.0 } };
  const fig = new Figure(Object.assign({}, spec, { id: 'courier' }));
  const R = rig(fig);
  shadowAll(fig.root, true, true);
  fig.root.traverse(o => o.isMesh && (o.userData.agentId = null));
  WORLD.figures.push(fig);
  WORLD.byId.courier = { fig, st: null, slot: null };
  INCIDENT.courier = fig;
  scene.add(fig.root);
  fig.root.position.set(-10.55, 0, ROOM.door.zc);
  fig.root.rotation.set(0, HALF_PI, 0);
  fig.setMode('stand');
  fig.root.updateMatrixWorld(true);

  // the display's place, measured once: a stand-in at its home pose
  home.parent.updateMatrixWorld(true);
  const ghost = new THREE.Object3D();
  new THREE.Matrix4().multiplyMatrices(home.parent.matrixWorld, new THREE.Matrix4().compose(home.pos, new THREE.Quaternion().setFromEuler(home.rot), V3(1, 1, 1))).decompose(ghost.position, ghost.quaternion, ghost.scale);
  scene.add(ghost);
  ghost.updateMatrixWorld(true);
  const G = INCIDENT.active.G || monitorGeom(st);
  const sy = stYaw(st);
  const qInv = st.group.getWorldQuaternion(new THREE.Quaternion()).invert();
  const nW = V3(0, 0, -1).applyQuaternion(ghost.quaternion); // the screen's facing at home
  const n = nW.clone().applyQuaternion(qInv);
  const c = toSt(st, worldOf(ghost, 0, G.gripY, G.zc));

  // the carton, packed: the display upright in its foam, the screen under film, the flaps taped down
  const C = makeCarton(G);
  const box = C.group;
  scene.add(box);
  INCIDENT.props.push(box);
  const plan = courierPlan(st, c, n, C);
  INCIDENT.active.plan = plan;
  box.add(mon);
  mon.position.copy(C.monAt);
  mon.quaternion.copy(C.monQ);
  mon.scale.setScalar(1);
  mon.visible = false;
  st.screenObj.state = 'away';
  const screenOn = screenOff(st); // a new display is dark until it is powered
  const film = new THREE.Mesh(new THREE.PlaneGeometry(G.half * 2 - 0.012, G.panelH - 0.012), FILM_MAT.clone());
  const filmPiv = new THREE.Group(); // hinged on the screen's far edge from the corner the hand takes
  filmPiv.position.set(-(G.half - 0.006), G.midY, G.zc - 0.0165);
  film.position.set(G.half - 0.006, 0, 0);
  film.rotation.y = Math.PI;
  filmPiv.add(film);
  mon.add(filmPiv);

  // in its arms: the carton by its ends, at the chest
  const carryBox = bodyHold(C.W / 2, 1.14, 0.34); // the carton's bottom rides above desk height, clear of the body
  box.position.copy(fig.root.localToWorld(V3(0, 1.14 - C.gy, 0.34 + 0.03)));
  box.quaternion.copy(fig.root.quaternion);
  box.updateMatrixWorld(true);
  const toWorld = Hl => ({ L: fig.root.localToWorld(Hl.L.clone()), R: fig.root.localToWorld(Hl.R.clone()), pL: fig.root.localToWorld(Hl.pL.clone()), pR: fig.root.localToWorld(Hl.pR.clone()) });
  handsTo(fig, toWorld(carryBox));
  ROOM_OBJ.lift.target = 1;
  await wait(1100);
  const hb = grab(box, fig, toWorld(carryBox));
  hb.drive = bodyDrive(() => carryBox);

  // in through the doors and round to the back of the desk
  const slot = w.slot;
  const ex = NAV.nodes[SLOT_EXIT[slot]];
  const nav = carryPts(navPath('LIFT', SLOT_EXIT[slot]));
  const W2 = p => { const q = stPt(st, p[0], p[1]); return [q.x, q.z]; };
  const path = skipStepOut(nav.concat(plan.via.map(W2), [W2([plan.at.x, plan.at.z])]), nav.length - 1);
  let closed = false;
  const watcher = setInterval(() => {
    if (!closed && fig.root.position.x > ROOM.vestibule.x0 + 1.3) {
      ROOM_OBJ.lift.target = 0;
      closed = true;
    }
  }, 200);
  await courierWalk(path, sy + plan.at.yaw, 1.2);
  clearInterval(watcher);
  fig.setMode('stand');

  // 1 · set the carton down: a deep crouch, the hands on its ends all the way to the floor
  mark('setdown');
  const downBox = bodyHold(C.W / 2, C.gy, CARTON_AT - 0.03); // (far enough out that the knees stay clear in the crouch)
  let mix = 0;
  hb.drive = bodyDrive(() => holdLerp(carryBox, downBox, mix));
  await tween(1.0, k => {
    mix = easeInOut(k);
    R.crouch(0.7 * Math.sin(mix * HALF_PI));
    R.bend(mix);
  });
  await until(() => palmErr(fig, toWorld(downBox)) < 0.015, 0.4);
  release(box);
  const restP = fig.root.localToWorld(V3(0, 0, CARTON_AT)), restQ = fig.root.quaternion.clone();
  const b0 = box.position.clone(), bq0 = box.quaternion.clone();
  await tween(0.14, k => {
    box.position.lerpVectors(b0, restP, k);
    box.quaternion.slerpQuaternions(bq0, restQ, k);
  });
  box.updateMatrixWorld(true);
  // 2 · slit the tape: the left hand steadies the carton by its end, the right draws a blade along the seam
  mark('slit');
  R.crouch(0.55);
  R.bend(1);
  const steady = holdTargets(fig, box, C.W / 2, C.H - 0.06, -0.02);
  fig.reach(-1, steady.L);
  const up = V3(0, 1, 0), back = V3(0, 0, -1).applyQuaternion(fig.root.quaternion);
  const seamFrom = back.clone().multiplyScalar(0.45).add(up).normalize();
  R.look(worldOf(box, 0, C.H, 0));
  const xs = [-0.3, 0.02];
  await tween(1.0, k => {
    const e = easeInOut(k);
    const x = lerp(xs[0], xs[1], e);
    fig.reach(1, touchAt(worldOf(box, x, C.H + 0.006, 0), seamFrom));
    // the tape parts behind the blade: what is left runs from the blade to the far end
    const x0 = Math.max(-(C.W + 0.12) / 2, x), x1 = (C.W + 0.12) / 2;
    C.tape.scale.x = Math.max(0.001, (x1 - x0) / (C.W + 0.12));
    C.tape.position.x = (x0 + x1) / 2;
  });
  C.tape.visible = false;
  // 3 · open the flaps, long ones first, each lifted at its edge by a hand and pressed back
  mark('flaps');
  mon.visible = true;
  fig.reach(-1, null);
  for (let i = 0; i < 4; i++) {
    const p = C.flaps[i];
    const hand = i === 2 ? -1 : i === 3 ? 1 : i === 0 ? -1 : 1;
    if (i === 1) {
      // the front: a hand takes the strip's top edge and folds it down and out, the near flap with it
      await tween(0.6, k => {
        const e = easeInOut(k);
        C.front.rotation.x = -(HALF_PI + 0.35) * e;
        setFlap(p, e);
        fig.reach(hand, k < 0.7 ? touchAt(worldOf(C.front, 0, C.S * Math.max(0.3, 1 - e), -0.01), up.clone().add(back.clone().multiplyScalar(0.4)), TIP) : null);
      });
      fig.reach(hand, null);
      continue;
    }
    await tween(0.45, k => {
      const e = easeInOut(k);
      setFlap(p, e);
      // the hand lifts the flap's edge from above and flips it; past the top it falls open on its own
      fig.reach(hand, k < 0.62 ? touchAt(flapTip(p), up, TIP) : null);
    });
    fig.reach(hand, null);
  }
  // 4 · lift the display out of its foam: hands in either side of the panel, then straight up until it clears, then to the chest
  mark('liftout');
  R.crouch(0.6);
  R.bend(1);
  R.look(worldOf(mon, 0, G.midY, G.zc));
  const T = holdTargets(fig, mon, G.half, G.gripY, G.zc, NEAR);
  handsTo(fig, T);
  await until(() => palmErr(fig, T) < 0.01, 0.9);
  const hm = grab(mon, fig, T);
  const A = holdToLocal(fig, T);
  const lifted = holdShift(A, V3(0, C.H + 0.05 - C.monAt.y - G.all.min.y, 0)); // straight up until the foot clears the rim
  const carryMon = bodyHold(G.half, 1.25, 0.36);
  mix = 0;
  let phase2 = 0;
  hm.drive = bodyDrive(() => (phase2 ? holdLerp(lifted, carryMon, mix) : holdLerp(A, lifted, mix)));
  await tween(0.8, k => {
    mix = easeInOut(k);
    R.crouch(0.6 * (1 - 0.65 * mix));
    R.bend(1 - 0.8 * mix);
  });
  phase2 = 1;
  mix = 0;
  await tween(0.7, k => {
    mix = easeInOut(k);
    R.crouch(0.21 * (1 - mix));
    R.bend(0.2 * (1 - mix));
  });
  // 5 · carry it round to the desk, then the last step in
  mark('carry');
  hm.drive = bodyDrive(() => carryMon);
  const p2 = stPt(st, plan.P2.x, plan.P2.z);
  await courierWalk([[p2.x, p2.z]], sy + plan.P.yaw, 0.9);
  fig.setMode('stand');
  const pP = stPt(st, plan.P.x, plan.P.z);
  await stepRoot(fig, pP.x, pP.z, sy + plan.P.yaw, 0.6, null, 'carry');
  // 6 · onto its place: over the foot's spot, down, a small press until it seats; then let go
  mark('place');
  R.look(worldOf(ghost, 0, G.midY, G.zc));
  const Th = holdTargets(fig, ghost, G.half, G.gripY, G.zc, NEAR);
  const above = holdShift(Th, V3(0, 0.05, 0));
  const from = toWorld(carryMon);
  hm.drive = null;
  await tween(0.9, k => handsTo(fig, holdLerp(from, above, easeInOut(k))));
  await tween(0.4, k => handsTo(fig, holdLerp(above, Th, easeInOut(k))));
  await until(() => palmErr(fig, Th) < 0.012, 0.5);
  release(mon);
  const m0 = mon.position.clone(), mq0 = mon.quaternion.clone();
  await tween(0.16, k => {
    mon.position.lerpVectors(m0, ghost.position, k);
    mon.quaternion.slerpQuaternions(mq0, ghost.quaternion, k);
  });
  home.parent.attach(mon);
  mon.position.copy(home.pos);
  mon.rotation.copy(home.rot);
  mon.scale.setScalar(1);
  mon.updateMatrixWorld(true);
  await tween(0.25, k => handsTo(fig, holdShift(Th, V3(0, 0, 0).addScaledVector(nW, -0.06 * k).add(V3(0, 0.03 * k, 0)))));
  R.free();
  // 7 · the cable: picked up at the grommet and run up behind the stand to the input, the way it was
  mark('cable');
  const route = cableRoute(Pp.cable, mon);
  const cable = new THREE.Mesh(new THREE.BufferGeometry(), CABLE_MAT);
  scene.add(cable);
  INCIDENT.props.push(cable);
  const towardMe = nW.clone().negate();
  const hand = sideOf(fig, route.getPoint(1)) > 0 ? -1 : 1;
  R.bend(0.85);
  R.look(route.getPoint(0.2));
  await tween(0.6, k => fig.reach(hand, touchAt(route.getPoint(0.02), towardMe.clone().add(up), TIP)));
  await tween(1.3, k => {
    const s = 0.02 + 0.98 * easeInOut(k);
    const end = route.getPoint(s);
    fig.reach(hand, touchAt(end, towardMe.clone().multiplyScalar(1.2).add(up), TIP));
    R.bend(0.85 - 0.5 * k);
    drawRoute(cable, route, s);
  });
  spark(route.getPoint(1), 6, 0.25);
  if (Pp.cable) Pp.cable.visible = true;
  scene.remove(cable);
  fig.reach(hand, null);
  // 8 · peel the film: reach round the panel's edge, take the corner and draw it off the screen
  mark('peel');
  // the film's free corner (top, on the panel's +x side), swung off the screen about its hinge on the far edge
  const pCorner = ang => {
    const len = G.half * 2 - 0.012;
    return worldOf(mon, -(G.half - 0.006) + len * Math.cos(ang), G.midY + G.panelH / 2 - 0.02, G.zc - 0.0165 - len * Math.sin(ang));
  };
  const outX = V3(1, 0, 0).applyQuaternion(mon.getWorldQuaternion(new THREE.Quaternion())); // the panel's +x, world
  const peelHand = sideOf(fig, pCorner(0)) > 0 ? -1 : 1;
  const peelFrom = outX.clone().multiplyScalar(1).add(towardMe.clone().multiplyScalar(0.55)).add(up.clone().multiplyScalar(0.25));
  await tween(0.6, k => fig.reach(peelHand, touchAt(pCorner(0), peelFrom, TIP * 0.95)));
  await tween(1.0, k => {
    const e = easeInOut(k);
    const ang = 0.24 * e;
    filmPiv.rotation.y = ang;
    fig.reach(peelHand, touchAt(pCorner(ang), peelFrom, TIP * 0.95));
    film.material.opacity = 0.32 * (1 - clamp((k - 0.55) / 0.45, 0, 1));
  });
  mon.remove(filmPiv);
  fig.reach(peelHand, null);
  // 9 · power: a press on the button at the back, and it boots
  mark('power');
  const pw = G.power();
  const pwHand = sideOf(fig, pw) > 0 ? -1 : 1;
  await tween(0.5, k => fig.reach(pwHand, touchAt(pw, towardMe, TIP + 0.012 * (1 - Math.sin(k * Math.PI)))));
  await tween(0.3, k => fig.reach(pwHand, touchAt(pw, towardMe.clone().add(V3(0, 0.4, 0)), TIP + 0.1 * easeOut(k)))); // the hand comes away before it drops
  fig.reach(pwHand, null);
  R.bend(0);
  R.look(worldOf(mon, 0, G.midY, G.zc));
  screenOn();
  const booting = bootScreen(st);
  st.screenObj.state = 'think';
  // 10 · back to the carton: close the flaps and take it away, empty, the way it came in (by its ends)
  mark('fold');
  const back2 = stPt(st, plan.P2.x, plan.P2.z);
  await stepRoot(fig, back2.x, back2.z, sy + plan.P.yaw, 0.5);
  const atW = stPt(st, plan.at.x, plan.at.z);
  await courierWalk([[atW.x, atW.z]], sy + plan.at.yaw, 1.0, 'walk');
  fig.setMode('stand');
  R.look(worldOf(box, 0, C.H, 0));
  R.crouch(0.55);
  R.bend(1);
  for (const p of [C.flaps[3], C.flaps[2], C.flaps[1], C.flaps[0]]) {
    const i = C.flaps.indexOf(p);
    const hand = i === 2 ? -1 : i === 3 ? 1 : i === 0 ? -1 : 1;
    if (i === 1) {
      // the front folds back up, the near flap closing over the top with it
      await tween(0.55, k => {
        const e = 1 - easeInOut(k);
        C.front.rotation.x = -(HALF_PI + 0.35) * e;
        setFlap(p, e);
        fig.reach(hand, k > 0.3 ? touchAt(worldOf(C.front, 0, C.S * Math.max(0.3, 1 - e), -0.01), up.clone().add(back.clone().multiplyScalar(0.4)), TIP) : null);
      });
      fig.reach(hand, null);
      continue;
    }
    // flicked up from where it hangs, caught at the top and pressed down
    await tween(0.42, k => {
      setFlap(p, 1 - easeInOut(k));
      fig.reach(hand, k > 0.42 ? touchAt(flapTip(p), up, TIP) : null);
    });
    fig.reach(hand, null);
  }
  R.crouch(0.7);
  const Tf = holdTargets(fig, box, C.W / 2, C.gy, -0.03);
  handsTo(fig, Tf);
  await until(() => palmErr(fig, Tf) < 0.012, 0.7);
  const hf = grab(box, fig, Tf);
  const Af = holdToLocal(fig, Tf);
  mix = 0;
  hf.drive = bodyDrive(() => holdLerp(Af, carryBox, mix));
  await tween(0.9, k => {
    mix = easeInOut(k);
    R.crouch(0.7 * (1 - mix));
    R.bend(1 - mix);
  });
  hf.drive = bodyDrive(() => carryBox);
  // 11 · sweep the pieces, then away; the agent goes back to work at the new screen
  mark('sweep');
  for (const m of INCIDENT.shards) m.userData.fade = 1;
  await booting;
  R.look(null);
  const out = plan.via.slice().reverse().map(W2);
  const backPath = skipStepOut(out.concat(ex ? [[ex.x, ex.z]] : [], carryPts(navPath(SLOT_EXIT[slot], 'LIFT')).slice(1), [[-10.55, ROOM.door.zc]]), ex ? out.length : -1);
  let opened = false;
  const watcher2 = setInterval(() => {
    if (!opened && fig.root.position.x < ROOM.vestibule.x1 - 0.2) {
      ROOM_OBJ.lift.target = 1;
      opened = true;
    }
  }, 200);
  st.setActivity('work');
  await courierWalk(backPath, -HALF_PI, 1.35);
  clearInterval(watcher2);
  ROOM_OBJ.lift.target = 0;
  await wait(1300);
  release(box);
  scene.remove(box);
  scene.remove(ghost);
  INCIDENT.props = [];
  scene.remove(fig.root);
  WORLD.figures = WORLD.figures.filter(f => f !== fig);
  delete WORLD.byId.courier;
  INCIDENT.courier = null;
}

/** +1 if a world point is on the figure's own left, -1 on its right. */
function sideOf(fig, p) {
  const left = V3(1, 0, 0).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
  return Math.sign(V3().subVectors(p, fig.root.getWorldPosition(V3())).dot(left)) || 1;
}
/** The display cable's own route (world), from the grommet up to the input: the station's cable, followed back. */
function cableRoute(cableMesh, mon) {
  const path = cableMesh && cableMesh.geometry && cableMesh.geometry.parameters && cableMesh.geometry.parameters.path;
  mon.updateMatrixWorld(true);
  if (path && path.points) {
    const pts = path.points.map(p => p.clone().applyMatrix4(cableMesh.matrixWorld)).reverse();
    return new THREE.CatmullRomCurve3(pts);
  }
  const port = worldOf(mon, 0.06, 0.18, 0.01), foot = worldOf(mon, 0.07, 0.01, 0.16), grom = worldOf(mon, 0.17, -0.004, 0.2);
  return new THREE.CatmullRomCurve3([grom, foot, port]);
}
/** The run of cable from the grommet to s along the route. */
function drawRoute(mesh, curve, s) {
  const n = Math.max(3, Math.ceil(18 * s));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(curve.getPoint((s * i) / n));
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, n * 2), 0.0029, 6, false);
}

window.AgentOffice && (window.AgentOffice.smash = id => !resolveBridgeUrl() && smashScreen(id));
