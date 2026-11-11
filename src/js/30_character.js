/* =============================================================================
   30 · THE ROBOTS — one family, eight different bots, at real scale
   -----------------------------------------------------------------------------
   Built in metres as premium products rather than costumes, in one design
   language: satin automotive paint under a clearcoat, gloss black, brushed
   metal, smoked glass and one soft light per robot (its eyes and a thin collar
   seam, crimson when it needs Igor). Every robot
   wears the B&Co crest on its left chest. The bodies differ:
     legs    a biped about 1.75 m standing, who sits in its desk chair
     hover   a tapered body floating over a pulsing ring, working without a chair
     ball    balanced on one painted sphere, leaning into its moves
     tracks  a compact tracked chassis whose treads and wheels roll with distance
   and so do the heads: a wraparound-visor helmet, a hard-hat dome, a rounded
   cube with a screen face, an orb with ring eyes, a tall capsule inside an orbit
   ring, a screen face with a boom mic, a cyclops camera lens with fins, a block
   with a dot-matrix face. Typing is solved, not faked: the arms reach the keys by
   IK and each fingertip travels to a real key and strikes it; sitting is solved
   so both feet land flat on the floor at whatever height the seat is.
   ============================================================================= */

const DIM = {
  thigh: 0.445, shin: 0.43, ankle: 0.075, // hip joint → knee → ankle → floor
  hipW: 0.088, // hip joints either side of centre
  shX: 0.184, shY: 0.468, // shoulder joints in the spine frame (hip joint = 0)
  upperArm: 0.295, foreArm: 0.255,
  headPivot: 0.6, // top of the neck (spine frame)
  seatTop: 0.47, // desk chair seat height
  hipAboveSeat: 0.095,
  headR: 0.118, // half the head's height (labels and audits)
};
DIM.sitHipY = DIM.seatTop + DIM.hipAboveSeat;
DIM.standHipY = DIM.thigh + DIM.shin + DIM.ankle - 0.004;
const HAND = { palmW: 0.084, palmL: 0.094, palmT: 0.027 };

const POSE_KEYS = ['hipY', 'rootZ', 'lean', 'twist', 'headYaw', 'headPitch', 'headRoll', 'shLx', 'shLy', 'shLz', 'elLx', 'wrLx', 'fingL', 'prL', 'shRx', 'shRy', 'shRz', 'elRx', 'wrRx', 'fingR', 'prR', 'hipLx', 'hipLz', 'kneeLx', 'hipRx', 'hipRz', 'kneeRx', 'footZ'];

const SEATED = {
  hipY: DIM.sitHipY, rootZ: 0, lean: 0.03, twist: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  shLx: -0.28, shLy: 0, shLz: 0.1, elLx: -1.0, wrLx: -0.15, fingL: 0.35, prL: 0.55,
  shRx: -0.28, shRy: 0, shRz: -0.1, elRx: -1.0, wrRx: -0.15, fingR: 0.35, prR: 0.55,
  hipLx: -1.45, hipLz: 0.05, kneeLx: 1.45, hipRx: -1.45, hipRz: -0.05, kneeRx: 1.45, footZ: 0.5,
};
const STANDING = {
  ...SEATED, hipY: DIM.standHipY, lean: 0, hipLx: 0, hipRx: 0, kneeLx: 0.02, kneeRx: 0.02, hipLz: 0.035, hipRz: -0.035,
  shLx: 0.03, shLz: 0.075, elLx: -0.14, wrLx: 0, fingL: 0.3, prL: 1, shRx: 0.03, shRz: -0.075, elRx: -0.14, wrRx: 0, fingR: 0.3, prR: 1,
};
/** The top speed of each pose value (rad/s; m/s for hipY, rootZ, footZ) outside walking and the quick choreography. */
const JOINT_VMAX = Object.fromEntries(POSE_KEYS.map(k => [k,
  /^sh/.test(k) ? 1.9 : /^el/.test(k) ? 2.4 : /^wr/.test(k) ? 3 : /^pr/.test(k) ? 3 : /^fing/.test(k) ? 5 : /^head/.test(k) ? 2.2
  : /^hip[LR]/.test(k) ? 2.4 : /^knee/.test(k) ? 2.8 : k === 'lean' ? 1.4 : k === 'twist' ? 1.4 : k === 'hipY' ? 0.9 : k === 'rootZ' ? 0.7 : k === 'footZ' ? 0.9 : 3]));
/** Modes in which the figure sits: the legs are solved onto the floor every frame. */
const SEATED_MODES = new Set(['type', 'browse', 'think', 'idle', 'done', 'paused', 'sofa', 'watch', 'review', 'meet']);

const glance = (t, ph) => Math.sin(t * 0.23 + ph) * 0.6 + Math.sin(t * 0.61 + ph * 1.7) * 0.3 + Math.sin(t * 1.3 + ph * 0.3) * 0.1;

/* Pose library (forward kinematics). Typing is refined by arm IK, sitting by leg IK, in update(). */
const POSES = {
  type(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = 0.11;
    o.headPitch = 0.2 + Math.sin(t * 0.8 + ph) * 0.025;
    o.headYaw = -0.12 + Math.sin(t * 0.33 + ph) * 0.05;
    o.hipY = DIM.sitHipY + Math.sin(t * 2.2 + ph) * 0.0015;
    o.prL = o.prR = 0.05;
    o.footZ = 0.47;
  },
  browse(o, t, ph) {
    POSES.type(o, t, ph);
    o.lean = 0.08;
    o.headYaw = -0.1 + Math.sin(t * 0.55 + ph) * 0.08;
    o.headPitch = 0.17 + Math.sin(t * 0.9 + ph) * 0.03;
  },
  /** Chin on the right hand, the left forearm across the lap. */
  think(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = 0.05;
    o.shRx = -1.0; o.shRz = 0.32; o.elRx = -2.38; o.wrRx = 0.3; o.fingR = 0.85; o.prR = 0.75;
    o.shLx = -0.1; o.shLz = 0.06; o.elLx = -1.08; o.wrLx = 0.12; o.fingL = 0.5; o.prL = 0.6;
    o.headRoll = -0.06 + Math.sin(t * 0.45 + ph) * 0.03;
    o.headYaw = 0.08 + glance(t * 0.6, ph) * 0.1;
    o.headPitch = -0.02;
    o.footZ = 0.5;
  },
  idle(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = -0.08;
    o.shLx = -0.18; o.shLz = 0.14; o.elLx = -0.95;
    o.shRx = -0.18; o.shRz = -0.14; o.elRx = -0.95;
    o.headYaw = glance(t, ph) * 0.5;
    o.headPitch = -0.02;
    o.footZ = 0.56;
  },
  /** Leaning back, hands laced behind the head. */
  done(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = -0.16;
    o.shLx = -2.75; o.shLz = 0.95; o.elLx = -2.2; o.fingL = 0.5; o.prL = 0.6;
    o.shRx = -2.75; o.shRz = -0.95; o.elRx = -2.2; o.fingR = 0.5; o.prR = 0.6;
    o.headPitch = -0.14;
    o.headYaw = Math.sin(t * 0.3 + ph) * 0.12;
    o.footZ = 0.6;
  },
  paused(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = 0.0;
    o.headPitch = 0.28;
    o.shLx = -0.2; o.shLz = 0.06; o.elLx = -1.05;
    o.shRx = -0.2; o.shRz = -0.06; o.elRx = -1.05;
    o.hipY = DIM.sitHipY + Math.sin(t * 0.9 + ph) * 0.002;
    o.footZ = 0.5;
  },
  stand(o, t, ph) {
    Object.assign(o, STANDING);
    o.headYaw = glance(t, ph) * 0.32;
    o.hipY = DIM.standHipY + Math.sin(t * 1.4 + ph) * 0.002;
  },
  wave(o, t, ph) {
    Object.assign(o, STANDING);
    o.shLx = -2.45 + Math.sin(t * 2.1) * 0.04; o.shLz = 0.35; o.fingL = 0.05; o.wrLx = 0; o.prL = 1;
    o.elLx = -0.5 + Math.sin(t * 6.2) * 0.25;
    o.headPitch = -0.12;
    o.headYaw = Math.sin(t * 0.7) * 0.07;
  },
  walk(o, t, ph, w) {
    Object.assign(o, STANDING);
    const p = w;
    o.hipY = DIM.standHipY - 0.012 + Math.abs(Math.cos(p)) * 0.016;
    o.hipLx = -Math.sin(p) * 0.4; o.hipRx = Math.sin(p) * 0.4;
    o.kneeLx = 0.06 + Math.max(0, Math.cos(p)) * 0.62;
    o.kneeRx = 0.06 + Math.max(0, -Math.cos(p)) * 0.62;
    o.shLx = Math.sin(p) * 0.3; o.shRx = -Math.sin(p) * 0.3;
    o.elLx = -0.25; o.elRx = -0.25;
    o.lean = 0.04;
    o.twist = Math.sin(p) * 0.045;
  },
  sofa(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = -0.16;
    o.shLx = -0.16; o.shLz = 0.16; o.elLx = -0.85;
    o.shRx = -0.16; o.shRz = -0.16; o.elRx = -0.85;
    o.headYaw = glance(t, ph) * 0.35;
    o.headPitch = -0.04;
    o.footZ = 0.62;
  },
  watch(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = -0.06;
    o.shLx = -0.36; o.shLz = 0.05; o.elLx = -1.0;
    o.shRx = -0.36; o.shRz = -0.05; o.elRx = -1.0;
    o.headPitch = -0.2 + Math.sin(t * 0.4 + ph) * 0.025;
    o.headYaw = Math.sin(t * 0.21 + ph) * 0.1;
    o.footZ = 0.52;
  },
  /** At the Forum table: upright, hands resting on the table's edge (solved in update), eyes on the wall screen. */
  meet(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = 0.04;
    o.headPitch = -0.2 + Math.sin(t * 0.4 + ph) * 0.03;
    o.headYaw = Math.sin(t * 0.21 + ph) * 0.12;
    o.fingL = o.fingR = 0.3;
    o.footZ = 0.5;
  },
  /** A sprint back to the desk: longer strides, arms pumping, leaning in. */
  run(o, t, ph, w) {
    Object.assign(o, STANDING);
    const p = w;
    o.hipY = DIM.standHipY - 0.04 + Math.abs(Math.cos(p)) * 0.05;
    o.hipLx = -Math.sin(p) * 0.72; o.hipRx = Math.sin(p) * 0.72;
    o.kneeLx = 0.25 + Math.max(0, Math.cos(p)) * 1.2;
    o.kneeRx = 0.25 + Math.max(0, -Math.cos(p)) * 1.2;
    o.shLx = Math.sin(p) * 0.8; o.shRx = -Math.sin(p) * 0.8;
    o.shLz = 0.12; o.shRz = -0.12;
    o.elLx = -1.45; o.elRx = -1.45; o.fingL = o.fingR = 0.9; o.prL = o.prR = 0.8;
    o.lean = 0.2;
    o.twist = Math.sin(p) * 0.08;
    o.headPitch = -0.1;
  },
  /** Walking with a box held in front (the courier). */
  carry(o, t, ph, w) {
    POSES.walk(o, t, ph, w);
    o.shLx = -0.55; o.shRx = -0.55; o.shLz = 0.36; o.shRz = -0.36;
    o.elLx = -1.0; o.elRx = -1.0; o.wrLx = 0.15; o.wrRx = 0.15; o.fingL = o.fingR = 0.75; o.prL = o.prR = 1;
    o.lean = -0.02;
    o.headPitch = 0.05;
  },
  /** Holding the display overhead. */
  lift(o, t, ph) {
    Object.assign(o, STANDING);
    o.shLx = -2.6 + Math.sin(t * 11) * 0.05; o.shRx = -2.6 + Math.sin(t * 11 + 1) * 0.05;
    o.shLz = 0.32; o.shRz = -0.32; o.elLx = -0.5; o.elRx = -0.5; o.fingL = o.fingR = 0.8; o.prL = o.prR = 1;
    o.lean = -0.06;
    o.headPitch = -0.28;
    o.headRoll = Math.sin(t * 9) * 0.05;
    o.hipY = DIM.standHipY + Math.abs(Math.sin(t * 6)) * 0.006;
  },
  /** The throw: arms driven down, leaning over it (knees give a little). */
  slam(o, t, ph) {
    Object.assign(o, STANDING);
    o.shLx = -0.85; o.shRx = -0.85; o.shLz = 0.18; o.shRz = -0.18; o.elLx = -0.2; o.elRx = -0.2; o.fingL = o.fingR = 0.25; o.prL = o.prR = 1;
    o.lean = 0.32;
    o.headPitch = 0.4;
    o.hipLx = o.hipRx = -0.22;
    o.kneeLx = o.kneeRx = 0.42;
    o.hipY = DIM.thigh * Math.cos(0.22) + DIM.shin * Math.cos(0.2) + DIM.ankle - 0.004; // soles on the floor
  },
  /** Upset: fists, head shaking at the wreck. */
  upset(o, t, ph) {
    Object.assign(o, STANDING);
    o.shLx = 0.08; o.shRx = 0.08; o.shLz = 0.26; o.shRz = -0.26; o.elLx = -0.55; o.elRx = -0.55; o.fingL = o.fingR = 1.0; o.prL = o.prR = 1;
    o.lean = 0.12;
    o.headPitch = 0.3;
    o.headYaw = Math.sin(t * 8.5) * 0.28;
    o.hipY = DIM.standHipY + Math.abs(Math.sin(t * 4.2)) * 0.005;
  },
  /** Lounge: seated round the house model, leaning in, one hand gesturing at it. */
  review(o, t, ph) {
    Object.assign(o, SEATED);
    o.lean = 0.06;
    const g = 0.5 + 0.5 * Math.sin(t * 0.45 + ph);
    o.shRx = -0.5 - 0.55 * g; o.shRz = -0.12; o.elRx = -1.2 + 0.55 * g; o.wrRx = 0.1; o.fingR = 0.25; o.prR = 0.7;
    o.shLx = -0.26; o.shLz = 0.03; o.elLx = -1.1;
    o.headPitch = 0.08 + Math.sin(t * 0.7 + ph) * 0.04;
    o.headYaw = Math.sin(t * 0.29 + ph) * 0.3;
    o.footZ = 0.56;
  },
  look(o, t, ph) {
    Object.assign(o, STANDING);
    o.shLx = 0.25; o.shLz = 0.08; o.elLx = -0.4;
    o.shRx = -0.85; o.shRz = 0.25; o.elRx = -1.5 + Math.sin(t * 0.8 + ph) * 0.07; o.prR = 0.4;
    o.headPitch = -0.1 + Math.sin(t * 0.5 + ph) * 0.03;
    o.headYaw = Math.sin(t * 0.4 + ph) * 0.09;
  },
};

/* ---------- materials ------------------------------------------------------------- */

const leather = (hex, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color: lin(hex), roughness: rough, clearcoat: 0.45, clearcoatRoughness: 0.32, envMapIntensity: 0.7, fog: false });
const INK_MAT = new THREE.MeshStandardMaterial({ color: lin('#1a1b1e'), roughness: 0.45, metalness: 0.25, envMapIntensity: 0.8, fog: false });
const SILVER_MAT = new THREE.MeshStandardMaterial({ color: lin('#d3d6da'), roughness: 0.25, metalness: 0.9, envMapIntensity: 1.1, fog: false });

/*
 * Every robot part shares one clearcoated physical material. A part carries its colour in the vertex colours and
 * its finish in the uv: u picks one texel of a small atlas whose channels are clearcoat (R), roughness (G) and
 * metalness (B). So a painted panel, a gloss-black visor and a brushed hub can sit in one mesh, one draw call.
 */
const RB_FINISH = {
  shell: [1, 0.34, 0.04], // clearcoated ceramic
  core: [0, 0.48, 0.32], // satin black: the mechanical core, the joints, the neck
  metal: [0.15, 0.3, 0.9], // brushed steel: hubs, rings, the collar
  alu: [0.55, 0.3, 0.82], // brushed aluminium
  matte: [0, 0.86, 0], // soles, panel seams
  gloss: [1, 0.12, 0], // glossy black
  satin: [0, 0.42, 0.55], // satin graphite hands
  graphite: [0.75, 0.36, 0.2], // graphite under a deeper clearcoat
  paint: [1, 0.32, 0.14], // satin automotive paint: a little metallic flake under the clearcoat
  pearl: [1, 0.24, 0.05], // pearl white
  ink: [1, 0.12, 0.1], // gloss black lacquer
  rubber: [0, 0.92, 0], // tyres and treads
  chrome: [0.6, 0.1, 1], // polished trim
};
const RB_KEYS = Object.keys(RB_FINISH);
const RB_W = 16;
const RB_ATLAS = (() => {
  const data = new Uint8Array(RB_W * 4);
  RB_KEYS.forEach((k, i) => data.set(RB_FINISH[k].map(v => Math.round(v * 255)).concat(255), i * 4));
  const t = new THREE.DataTexture(data, RB_W, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const RB_U = fin => (Math.max(0, RB_KEYS.indexOf(fin)) + 0.5) / RB_W;
const RB_MAT = new THREE.MeshPhysicalMaterial({
  vertexColors: true, roughness: 1, metalness: 1, roughnessMap: RB_ATLAS, metalnessMap: RB_ATLAS,
  clearcoat: 1, clearcoatMap: RB_ATLAS, clearcoatRoughness: 0.07, envMapIntensity: 0.85, fog: false,
});
// the hands are skinned (every finger joint in one mesh): the same material, with skinning on (three r128)
const RB_MAT_SKIN = RB_MAT.clone();
RB_MAT_SKIN.skinning = true;
const ROBOT_CORE = '#141518';
const PAINT_K = 0.58;
const FACE_BLACK = '#060709';
// smoked glass: dark, glossy, catching the room in its clearcoat; the eyes shine through it
const VISOR_GLASS = new THREE.MeshPhysicalMaterial({ color: lin('#07080a'), roughness: 0.04, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.03, reflectivity: 0.7, envMapIntensity: 1.25, transparent: true, opacity: 0.5, depthWrite: false, fog: false });

/** The second colour that pairs with each robot's paint (forearms, shins, joints, pelvis, details). */
const BOT_SECOND = {
  ink: { hex: '#0b0c0e', fin: 'ink', dark: true },
  graphite: { hex: '#2b2d32', fin: 'graphite', dark: true },
  pearl: { hex: '#eeece7', fin: 'pearl', dark: false },
  alu: { hex: '#c3c7cd', fin: 'alu', dark: false },
};
const BOT_HANDS = { ink: ['#111214', 'ink'], graphite: ['#2e3035', 'satin'], pearl: ['#e7e5e0', 'pearl'], metal: ['#b7bcc3', 'metal'] };

/**
 * The bots. `base`: legs | hover | ball | tracks. `head`: helm | dome | cube | orb | capsule | screen | lens | block.
 * `torso`: chest | broad | slim | round | compact | box. The paint is the agent's colour unless `paint` is given.
 */
const BOT_PRESETS = {
  helm: { base: 'legs', head: 'helm', torso: 'chest', second: 'ink', hands: 'ink', eyes: 'pair' },
  dome: { base: 'legs', head: 'dome', torso: 'broad', second: 'graphite', hands: 'graphite', eyes: 'bar', limb: 1.08 },
  cube: { base: 'legs', head: 'cube', torso: 'chest', second: 'graphite', hands: 'metal', eyes: 'square' },
  orb: { base: 'legs', head: 'orb', torso: 'slim', second: 'pearl', hands: 'pearl', eyes: 'rings', limb: 0.9 },
  // (no hover, wheeled or ball bots in the office: the capsule, screen, lens and block bots walk on legs like the rest)
  capsule: { base: 'legs', head: 'capsule', torso: 'slim', second: 'pearl', hands: 'metal', eyes: 'bar' },
  screen: { base: 'legs', head: 'screen', torso: 'round', second: 'pearl', hands: 'graphite', eyes: 'smile' },
  lens: { base: 'legs', head: 'lens', torso: 'compact', second: 'graphite', hands: 'metal', eyes: 'lens' },
  block: { base: 'legs', head: 'block', torso: 'box', second: 'alu', hands: 'metal', eyes: 'matrix' }, // (walks on legs; no treads)
  // the delivery robot: a neutral utility finish, clearly not one of the team
  courier: { base: 'legs', head: 'helm', torso: 'chest', second: 'graphite', hands: 'graphite', eyes: 'bar', paint: '#c9ccd1' },
};
/** The courier's spec (new Figure(COURIER_SPEC)): brushed-silver utility paint, graphite second, a light-bar helm. */
const COURIER_SPEC = { id: 'courier', color: 'slate', bot: { preset: 'courier' } };
/** Torso sections: overall width, depth and the superellipse exponent (2 round … 4 boxy). */
const TORSO_KINDS = {
  chest: { k: 1.0, d: 1.0, n: 3 },
  broad: { k: 1.08, d: 1.05, n: 3.4 },
  slim: { k: 0.95, d: 0.97, n: 2.6 },
  round: { k: 1.02, d: 1.1, n: 2.2 },
  compact: { k: 0.96, d: 1.0, n: 2.8 },
  box: { k: 1.08, d: 1.0, n: 4.2 },
};
/** Bodies without legs: hip height at the desk (a seated biped's, so the same keyboard works), while moving, and perched on a seat. */
const BASE_HIPS = {
  hover: { work: DIM.sitHipY, move: DIM.sitHipY + 0.035, perch: 0.3, r: 0.13 },
  ball: { work: DIM.sitHipY, move: DIM.sitHipY, perch: 0.4, r: 0.15 },
  tracks: { work: DIM.sitHipY, move: DIM.sitHipY, perch: 0.38, r: 0.2 },
};
/** How far a seated bot and its chair may be pushed or pulled at the desk (slot frame, metres and radians). */
const PUSH_LIM = { legs: { x: 0.1, z0: -0.2, z1: 0.02, yaw: 0.28 }, free: { x: 0.14, z0: -0.24, z1: 0.04, yaw: 0.45 } };

/* ---------- robot parts: a kit that bakes them into one mesh, and the shapes ---------- */

const _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new THREE.Vector3(), _ts = new THREE.Vector3();
/** A transform: position, rotation (Euler XYZ) and scale. */
function TM(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_tp.set(x, y, z), _tq.setFromEuler(_te.set(rx, ry, rz)), _ts.set(sx, sy, sz));
}

/** Parts on the robot material, each with a colour, a finish, a transform and (for a skinned hand) a bone, baked into one indexed mesh. */
class RobotKit {
  constructor(mat = RB_MAT) {
    this.parts = [];
    this.mat = mat;
  }
  add(geo, hex, fin, m, bone = 0) {
    const c = lin(hex);
    if (fin === 'paint') c.multiplyScalar(PAINT_K); // the white room lifts paint a long way: held down, it reads as its swatch
    this.parts.push({ geo, c, u: RB_U(fin), m: m || null, bone });
    return this;
  }
  geometry(skinned = false) {
    let nv = 0, ni = 0;
    for (const { geo } of this.parts) {
      nv += geo.attributes.position.count;
      ni += geo.index ? geo.index.count : geo.attributes.position.count;
    }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cl = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
    const SI = skinned ? new Uint16Array(nv * 4) : null, SW = skinned ? new Float32Array(nv * 4) : null;
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    for (const { geo, c, u, m, bone } of this.parts) {
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
      if (m) nm.getNormalMatrix(m);
      for (let i = 0; i < n; i++) {
        const k = vo + i;
        v.fromBufferAttribute(pos, i);
        if (m) v.applyMatrix4(m);
        P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
        v.fromBufferAttribute(nor, i);
        if (m) v.applyMatrix3(nm).normalize();
        N[k * 3] = v.x; N[k * 3 + 1] = v.y; N[k * 3 + 2] = v.z;
        Cl[k * 3] = c.r; Cl[k * 3 + 1] = c.g; Cl[k * 3 + 2] = c.b;
        U[k * 2] = u; U[k * 2 + 1] = 0.5;
        if (SI) { SI[k * 4] = bone; SW[k * 4] = 1; }
      }
      if (geo.index) {
        const A = geo.index.array, cnt = geo.index.count;
        for (let i = 0; i < cnt; i++) I[io + i] = A[i] + vo;
        io += cnt;
      } else {
        for (let i = 0; i < n; i++) I[io + i] = vo + i;
        io += n;
      }
      vo += n;
      geo.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(Cl, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (SI) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    }
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
  mesh(parent) {
    const mesh = new THREE.Mesh(this.geometry(), this.mat);
    if (parent) parent.add(mesh);
    return mesh;
  }
}

/** The torso's section by height in the spine frame (hip joint = 0): half-width, front depth, back depth. Narrow
    under the arms, so a hanging arm clears the chest, and broad across the upper chest under the shoulder actuators. */
const ROBOT_TORSO = {
  y: [0.0, 0.06, 0.11, 0.16, 0.21, 0.26, 0.31, 0.36, 0.405, 0.445, 0.48, 0.505, 0.525, 0.54, 0.552],
  W: [0.118, 0.116, 0.11, 0.108, 0.112, 0.118, 0.122, 0.125, 0.128, 0.137, 0.139, 0.128, 0.1, 0.07, 0.054],
  F: [0.086, 0.086, 0.085, 0.086, 0.09, 0.096, 0.1, 0.101, 0.1, 0.097, 0.09, 0.08, 0.066, 0.056, 0.05],
  B: [0.088, 0.088, 0.084, 0.084, 0.086, 0.088, 0.091, 0.093, 0.094, 0.094, 0.09, 0.081, 0.068, 0.057, 0.051],
};
/** The pelvis block in the hips frame, bottom to top: [y, half-width, front, back]. Its sides tuck in under the hip actuators. */
const ROBOT_PELVIS = [
  [-0.088, 0.004, 0.004, 0.004], [-0.086, 0.04, 0.033, 0.036], [-0.081, 0.064, 0.052, 0.056], [-0.071, 0.086, 0.066, 0.07],
  [-0.053, 0.102, 0.077, 0.081], [-0.03, 0.111, 0.083, 0.087], [-0.005, 0.114, 0.085, 0.088], [0.02, 0.112, 0.084, 0.087],
  [0.04, 0.106, 0.081, 0.084], [0.055, 0.1, 0.077, 0.08], [0.064, 0.094, 0.072, 0.075], [0.069, 0.087, 0.065, 0.068], [0.071, 0.078, 0.057, 0.06],
];

/** A smooth section-by-height function through a table (Catmull-Rom), scaled across by widthK. */
function tableEnv(T, widthK = 1) {
  const n = T.y.length;
  return y => {
    let i = 0;
    while (i < n - 2 && y > T.y[i + 1]) i++;
    const t = clamp((y - T.y[i]) / (T.y[i + 1] - T.y[i]), 0, 1);
    const cr = A => {
      const p0 = A[Math.max(i - 1, 0)], p1 = A[i], p2 = A[i + 1], p3 = A[Math.min(i + 2, n - 1)];
      return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    };
    return { w: cr(T.W) * widthK, f: cr(T.F) * widthK, b: cr(T.B) * widthK };
  };
}
const scaleRow = (E, y, k) => ({ y, w: E.w * k, f: E.f * k, b: E.b * k });
const sePow = (s, e) => Math.sign(s) * Math.pow(Math.abs(s), e);

/** A closed superellipse loft up +Y through rows of { y, w (half-width), f (front), b (back) }. */
function loftRing(rows, segs = 40, n = 2.5) {
  const pos = [], idx = [];
  for (const r of rows)
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * TAU, s = Math.sin(th), c = Math.cos(th);
      pos.push(Math.max(r.w, 0.0004) * sePow(s, 2 / n), r.y, Math.max(c >= 0 ? r.f : r.b, 0.0004) * sePow(c, 2 / n));
    }
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j, b = i * segs + ((j + 1) % segs), c = a + segs, d = b + segs;
      idx.push(a, b, d, a, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rows for a panel between two heights that follows an envelope (scaled by k), with rounded edges and an inward lip. */
function bandRows(env, y0, y1, { k = 1, e = 0.008, lip = 0.016, eTop = e, lipTop = lip, steps = 3, mid = 4 } = {}) {
  const pts = [[y0, e + lip]];
  for (let i = 0; i <= steps; i++) {
    const a = -HALF_PI + (i / steps) * HALF_PI;
    pts.push([y0 + e + Math.sin(a) * e, e - Math.cos(a) * e]);
  }
  for (let i = 1; i < mid; i++) pts.push([lerp(y0 + e, y1 - eTop, i / mid), 0]);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * HALF_PI;
    pts.push([y1 - eTop + Math.sin(a) * eTop, eTop - Math.cos(a) * eTop]);
  }
  pts.push([y1, eTop + lipTop]);
  return pts.map(([y, o]) => {
    const E = env(y);
    return { y, w: E.w * k - o, f: E.f * k - o, b: E.b * k - o };
  });
}

/** A limb shell along -Y from yTop to yBot: tapered (r0 → r1), oval (sx across, sz front to back), rounded rims. */
function limbShell(r0, r1, yTop, yBot, { sx = 1, sz = 1, e = 0.008, lip = 0.012, steps = 2, mid = 2, segs = 22 } = {}) {
  const env = y => {
    const r = lerp(r0, r1, (yTop - y) / (yTop - yBot));
    return { w: r * sx, f: r * sz, b: r * sz };
  };
  return loftRing(bandRows(env, yBot, yTop, { e, lip, steps, mid }), segs, 2);
}

/** A rounded puck on the Y axis (an actuator housing, a disc, a hub). */
function puckGeometry(r, h, e, radial = 24, steps = 3) {
  const pts = [new THREE.Vector2(0.0004, -h / 2)];
  for (let i = 0; i <= steps; i++) {
    const a = -HALF_PI + (i / steps) * HALF_PI;
    pts.push(new THREE.Vector2(r - e + Math.cos(a) * e, -h / 2 + e + Math.sin(a) * e));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * HALF_PI;
    pts.push(new THREE.Vector2(r - e + Math.cos(a) * e, h / 2 - e + Math.sin(a) * e));
  }
  pts.push(new THREE.Vector2(0.0004, h / 2));
  return new THREE.LatheGeometry(pts, radial);
}

/** A fine panel seam round a superellipse section at height y. */
function seamRing(env, y, k = 1.004, r = 0.0011, n = 2.5, segs = 48) {
  const E = env(y), pts = [];
  for (let j = 0; j < segs; j++) {
    const th = (j / segs) * TAU, s = Math.sin(th), c = Math.cos(th);
    pts.push(new THREE.Vector3(E.w * k * sePow(s, 2 / n), y, (c >= 0 ? E.f : E.b) * k * sePow(c, 2 / n)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), segs, r, 3, true);
}
/** A fine seam straight up the front centre between two heights. */
function seamLine(env, y0, y1, k = 1.004, r = 0.0011) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const y = lerp(y0, y1, i / 8);
    pts.push(new THREE.Vector3(0, y, env(y).f * k));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, r, 3, false);
}
/** A fine seam up one side of the torso (a clamshell's join), over the shoulder toward the neck. */
function seamSide(env, side, y0, y1, k = 1.004, r = 0.0011) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const y = lerp(y0, y1, i / 14);
    pts.push(new THREE.Vector3(side * env(y).w * k, y, 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 3, false);
}
/** The front surface of a superellipse section at (x, y): its depth and the yaw of its outward normal. */
function frontPoint(env, x, y, n = 2.5) {
  const E = env(y);
  const q = Math.min(Math.abs(x) / E.w, 0.999);
  const s = Math.pow(q, n / 2), c = Math.sqrt(1 - s * s);
  const z = E.f * Math.pow(c, 2 / n);
  const gx = (Math.sign(x) * Math.pow(q, n - 1)) / E.w, gz = Math.pow(z / E.f, n - 1) / E.f;
  return { z, yaw: Math.atan2(gx, gz) };
}

/** A patch of the shell's own surface, lifted `lift` metres along its normal (azimuth from the front, elevation up). */
function shellPatch(geo, az0, az1, el0, el1, lift, nx = 24, ny = 7) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const probe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const az = az0 + ((az1 - az0) * i) / nx, el = el0 + ((el1 - el0) * j) / ny;
      const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      ray.set(c.clone().addScaledVector(d, 0.5), d.clone().negate());
      const h = ray.intersectObject(probe, false)[0];
      const n = h && h.face ? h.face.normal.clone() : d;
      if (n.dot(d) < 0) n.negate();
      const p = h ? h.point.clone().addScaledVector(n, lift) : c.clone().addScaledVector(d, 0.12);
      pos.push(p.x, p.y, p.z);
      uv.push(i / nx, j / ny);
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c2 = a + nx + 1, d2 = c2 + 1;
      idx.push(a, b, d2, a, d2, c2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Fine panel seams projected onto the shell: over the crown ear to ear, and round the back at the visor's top. */
function shellSeams(geo, frontAz = 1.12, elev = 0.2) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const probe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  const onShell = d => {
    ray.set(c.clone().addScaledVector(d, 0.5), d.clone().negate());
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.addScaledVector(d, 0.0006) : null;
  };
  const crown = [], back = [];
  for (let i = 0; i <= 36; i++) {
    const a = 0.08 + (i / 36) * (Math.PI - 0.16);
    const p = onShell(new THREE.Vector3(Math.cos(a), Math.sin(a), -0.22).normalize());
    if (p) crown.push(p);
  }
  for (let i = 0; i <= 40; i++) {
    const az = frontAz + (i / 40) * (TAU - 2 * frontAz);
    const p = onShell(new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize());
    if (p) back.push(p);
  }
  const tubes = [crown, back].filter(pts => pts.length > 4).map(pts => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.round(pts.length * 1.5), 0.0009, 3, false));
  // one geometry, one draw call
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const t of tubes) {
    const P = t.attributes.position.array, N = t.attributes.normal.array, I = t.index.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
    base += P.length / 3;
    t.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

/** The B&Co pin: the client's own logo artwork, cropped into a disc. */
let PIN_TEX = null;
function makePinTexture(img) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2b2d';
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, TAU);
  ctx.clip();
  const w = 236, h = (w * img.height) / img.width;
  ctx.drawImage(img, 128 - w / 2, 128 - h / 2, w, h);
  ctx.restore();
  PIN_TEX = canvasTexture(c);
  PIN_TEX.center.set(0.5, 0.5);
  return PIN_TEX;
}

/* ---------- shapes for the heads and bases ---------------------------------------------------- */

/** Averages the normals along a sphere-topology seam (the duplicated column at u = 0 / 1). */
function weldSeamNormals(geo, W, H) {
  const nrm = geo.attributes.normal;
  for (let iy = 0; iy <= H; iy++) {
    const a = iy * (W + 1), b = a + W;
    const x = (nrm.getX(a) + nrm.getX(b)) / 2, y = (nrm.getY(a) + nrm.getY(b)) / 2, z = (nrm.getZ(a) + nrm.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l);
    nrm.setXYZ(b, x / l, y / l, z / l);
  }
}

/**
 * A superellipsoid (rx, ry, rz) about the origin: e1 shapes it top to bottom, e2 round its waist (1 = an ellipsoid,
 * below 1 boxier with rounded edges). Built on a sphere whose seam sits at the back; an optional band of latitude.
 */
function superEllipsoid(rx, ry, rz, e1 = 1, e2 = 1, wSeg = 56, hSeg = 40, th0 = 0, th1 = Math.PI) {
  const geo = new THREE.SphereGeometry(1, wSeg, hSeg, 0, TAU, th0, th1 - th0);
  geo.rotateY(-HALF_PI); // the seam to the back
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const lat = Math.asin(clamp(y, -1, 1)), lon = Math.atan2(x, z);
    const a = sePow(Math.cos(lat), e1);
    pos.setXYZ(i, rx * a * sePow(Math.sin(lon), e2), ry * sePow(Math.sin(lat), e1), rz * a * sePow(Math.cos(lon), e2));
  }
  geo.computeVertexNormals();
  weldSeamNormals(geo, wSeg, hSeg);
  geo.computeBoundingBox();
  return geo;
}

/** A probe for raycasting onto a shape built in place (identity transform). */
function shapeProbe(geo) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.updateMatrixWorld(true);
  return m;
}
const _ray = new THREE.Raycaster();
/** The point on a shape seen from the front at (x, y), with its outward normal. */
function surfaceAt(probe, x, y) {
  _ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
  const h = _ray.intersectObject(probe, false)[0];
  if (!h) return null;
  const n = h.face.normal.clone();
  if (n.z < 0) n.negate();
  return { p: h.point.clone(), n };
}
/** A flat decal (an eye, a lamp) lying on a shape at (x, y), lifted a little along its normal. */
function decalOn(probe, x, y, w, h, lift, mat) {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const s = surfaceAt(probe, x, y);
  if (s) {
    q.position.copy(s.p).addScaledVector(s.n, lift);
    q.lookAt(q.position.clone().add(s.n));
  } else q.position.set(x, y, 0.12);
  return q;
}
/** A raised ridge along a shape's centre line, from the front over the top to the back (a crest or a hard hat's rib). */
function ridgeOn(probe, c, el0, el1, r, flat = 0.5) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const el = lerp(el0, el1, i / 28);
    const d = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    _ray.set(c.clone().addScaledVector(d, 0.6), d.clone().negate());
    const h = _ray.intersectObject(probe, false)[0];
    if (h) pts.push(h.point.clone().addScaledVector(d, r * 0.35));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 6, false);
  g.translate(0, 0, 0);
  g.scale(flat, 1, 1); // narrow across, tall along: a fin rather than a pipe
  return g;
}

/* ---------- the lights: soft shapes drawn once, coloured live ---------------------------------- */

function glowTexture(w, h, draw) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  draw(ctx, w, h);
  return canvasTexture(c, { aniso: false });
}
/** A soft-edged pill: bright core, a gentle falloff (the eyes, the light bar, the collar seam). */
const EYE_TEX = (() => {
  const c = makeCanvas(128, 64), ctx = c.getContext('2d');
  ctx.save();
  ctx.scale(2, 1);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.restore();
  return canvasTexture(c, { aniso: false });
})();
const EYE_SHAPES = {
  // a rounded square (the cube's screen eyes)
  square: glowTexture(128, 128, ctx => { ctx.shadowBlur = 16; roundRect(ctx, 26, 26, 76, 76, 18); ctx.fill(); }),
  // a ring with a bright pupil (the orb's spectacles)
  rings: glowTexture(128, 128, ctx => {
    ctx.shadowBlur = 12; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(64, 64, 40, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 64, 11, 0, TAU); ctx.fill();
  }),
  // a happy crescent (the screen face)
  smile: glowTexture(128, 96, ctx => {
    ctx.shadowBlur = 12; ctx.lineWidth = 17; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(64, 74, 38, Math.PI + 0.42, TAU - 0.42); ctx.stroke();
  }),
  // a camera iris: two rings, eight blades, a pupil (the lens)
  lens: glowTexture(128, 128, ctx => {
    ctx.shadowBlur = 10; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(64, 64, 36, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18); ctx.lineTo(64 + Math.cos(a + 0.5) * 33, 64 + Math.sin(a + 0.5) * 33); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(64, 64, 12, 0, TAU); ctx.fill();
  }),
  // a 5 × 5 field of dots, the corners dim (the block's matrix eyes)
  matrix: glowTexture(128, 128, ctx => {
    ctx.shadowBlur = 8;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const edge = (i === 0 || i === 4) && (j === 0 || j === 4);
        if (edge) continue;
        const rim = i === 0 || i === 4 || j === 0 || j === 4;
        ctx.globalAlpha = rim ? 0.55 : 1;
        ctx.beginPath(); ctx.arc(20 + i * 22, 20 + j * 22, 7.5, 0, TAU); ctx.fill();
      }
    ctx.globalAlpha = 1;
  }),
  // a soft round dot (lamps, antenna tips, a beacon)
  dot: glowTexture(64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  }),
};
const lightMaterial = (map, hex) => new THREE.MeshBasicMaterial({ color: lin(hex), map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
let FLOOR_GLOW_TEX = null;
const floorGlowTex = () => FLOOR_GLOW_TEX || (FLOOR_GLOW_TEX = canvasTexture(GLOW_CANVAS, { aniso: false }));

/* ---------- the B&Co crest on every chest ------------------------------------------------------ */

let BADGE_MAT = null;
const CREST_SERIF = 'Didot, "Didot LP", "Bodoni 72", "Bodoni Moda", "Playfair Display", "Cormorant Garamond", "Times New Roman", serif';
/** The brand's circular crest, drawn on a canvas: black ring, white field, "B" and "Co" in black, the "&" in crimson italic. */
function drawCrest(c) {
  const S = c.width, ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = BRAND.ink;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.448, 0, TAU); ctx.fill();
  ctx.strokeStyle = BRAND.ink;
  ctx.lineWidth = S * 0.0065;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.418, 0, TAU); ctx.stroke();
  const font = (it, sz) => `${it ? 'italic ' : ''}400 ${sz}px ${CREST_SERIF}`;
  const widths = sz => {
    ctx.font = font(false, sz); const wb = ctx.measureText('B').width, wc = ctx.measureText('Co').width;
    ctx.font = font(true, sz * 1.04); const wa = ctx.measureText('&').width;
    return [wb, wa, wc];
  };
  let size = S * 0.4;
  let [wb, wa, wc] = widths(size);
  size *= Math.min(1.4, (S * 0.66) / (wb + wa + wc - size * 0.06));
  [wb, wa, wc] = widths(size);
  let x = S / 2 - (wb + wa + wc - size * 0.06) / 2;
  const base = S / 2 + size * 0.34;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = BRAND.ink;
  ctx.font = font(false, size);
  ctx.fillText('B', x, base);
  x += wb - size * 0.03;
  // drawn a fifth deeper, as Crimson's paint is: the room's light and the filmic tone curve lift it back to #a70008 on screen
  ctx.fillStyle = mixHex(BRAND.crimson, '#000000', 0.2);
  ctx.font = font(true, size * 1.04);
  ctx.fillText('&', x, base);
  x += wa - size * 0.03;
  ctx.fillStyle = BRAND.ink;
  ctx.font = font(false, size);
  ctx.fillText('Co', x, base);
}
function badgeMaterial() {
  if (BADGE_MAT) return BADGE_MAT;
  const c = makeCanvas(1024, 1024);
  drawCrest(c);
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  BADGE_MAT = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.5, fog: false });
  // the brand serif may arrive after the first robot is built: draw the crest again once the fonts are in
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawCrest(c); tex.needsUpdate = true; });
  return BADGE_MAT;
}
/** The crest as a part: a flat enamel face (facing +Z, at z = 0) in a thin polished rim, on a short collar that runs back
 *  into the chest, so it stands proud of any torso without a gap at its edge and without bending over the curve. */
function crestParts(r) {
  const face = new THREE.CircleGeometry(r, 72);
  const uv = face.attributes.uv, pos = face.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, pos.getY(i) / (2 * r) + 0.5);
  const rim = new THREE.TorusGeometry(r + 0.0006, 0.0019, 10, 84);
  rim.translate(0, 0, -0.0007);
  const collar = new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.03, 72, 1, true);
  collar.rotateX(HALF_PI);
  collar.translate(0, 0, -0.015 - 0.0012);
  return { face, rim, collar };
}

/* ---------- the heads ------------------------------------------------------------------------- */

/** A capsule between two points, as geometry (for a kit). */
function segGeo(a, b, r, radial = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = capsuleGeometry(r, Math.max(0.0001, len), 4, radial);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
/** A transform with a chosen Euler order (lamps and pucks that face outward round a curve). */
function TMo(x, y, z, rx, ry, rz, order = 'YXZ', s = 1) {
  return new THREE.Matrix4().compose(_tp.set(x, y, z), _tq.setFromEuler(new THREE.Euler(rx, ry, rz, order)), _ts.set(s, s, s));
}
/** A shell patch around the point of a shape seen from the front at (x, y): az/el half-spans in radians. */
function patchAt(geo, probe, x, y, daz, del, lift, nx = 10, ny = 4) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  const s = surfaceAt(probe, x, y);
  const p = s ? s.p.clone().sub(c) : new THREE.Vector3(x, y - c.y, 0.1);
  const az = Math.atan2(p.x, p.z), el = Math.asin(clamp(p.y / p.length(), -1, 1));
  return shellPatch(geo, az - daz, az + daz, el - del, el + del, lift, nx, ny);
}
/** The elevation (from the shape's box centre) of the front surface at height y. */
function elevationAt(geo, probe, y) {
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  const s = surfaceAt(probe, 0, y);
  const p = s ? s.p.clone().sub(c) : new THREE.Vector3(0, y - c.y, 0.1);
  return Math.asin(clamp(p.y / p.length(), -1, 1));
}

/**
 * Builds one head in the head frame (origin at the top of the neck, +Y up, +Z the face).
 * Returns the merged shell mesh, the glass, the light parts (blinking ones under an eye pivot), the box the
 * accessories fit to, and sample spheres for the collision audit.
 */
function buildBotHead(kind, B, P, F) {
  const K = new RobotKit(RB_MAT);
  const out = { glass: [], eyes: [], lights: [], spinner: null, samples: [], eyeY: 0.11 };
  const paint = P.paint, second = P.second;
  const eyeTex = B.eyes === 'square' || B.eyes === 'rings' || B.eyes === 'smile' || B.eyes === 'lens' || B.eyes === 'matrix' ? EYE_SHAPES[B.eyes] : null;
  const eyeMat = eyeTex ? F.extraLight(eyeTex) : F.glowMat;
  const solid = F.solidLight;
  const glass = geo => {
    const m = new THREE.Mesh(geo, VISOR_GLASS);
    m.renderOrder = 4;
    out.glass.push(m);
    return m;
  };
  const eye = (mesh, y) => {
    mesh.renderOrder = 5;
    out.eyes.push({ mesh, y });
  };
  const pucks = (x, y, z, r, h, hex, fin, hub = ['#c3c8cf', 'chrome']) => {
    for (const s of [-1, 1]) {
      K.add(puckGeometry(r, h, Math.min(0.004, h * 0.3), 24, 2), hex, fin, TM(s * x, y, z, 0, 0, HALF_PI));
      if (hub) K.add(puckGeometry(r * 0.42, 0.004, 0.0012, 16, 1), hub[0], hub[1], TM(s * (x + h / 2), y, z, 0, 0, HALF_PI));
    }
  };
  let shell; // the main shape (for the accessories' box)
  switch (kind) {
    case 'dome': {
      // a hard-hat dome over a face drum: a smoked visor slit with a light bar, a brim, a ridge and two lamps
      const prof = [[0.0005, 0.018], [0.05, 0.019], [0.083, 0.026], [0.1, 0.042], [0.106, 0.065], [0.108, 0.09], [0.11, 0.106]];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * HALF_PI;
        prof.push([Math.max(0.0005, 0.116 * Math.cos(a)), 0.112 + 0.098 * Math.sin(a)]);
      }
      shell = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
      shell.rotateY(Math.PI); // the lathe's seam to the back
      shell.computeVertexNormals();
      shell.computeBoundingBox();
      const probe = shapeProbe(shell);
      const ev = elevationAt(shell, probe, 0.068);
      K.add(shellPatch(shell, -1.08, 1.08, ev - 0.15, ev + 0.13, 0.0012, 30, 6), FACE_BLACK, 'ink');
      glass(shellPatch(shell, -1.02, 1.02, ev - 0.12, ev + 0.11, 0.0046, 28, 5));
      eye(new THREE.Mesh(shellPatch(shell, -0.6, 0.6, ev - 0.045, ev + 0.045, 0.0031, 10, 3), eyeMat), 0.068);
      out.eyeY = 0.068;
      K.add(new THREE.TorusGeometry(0.1175, 0.0064, 8, 80), second.hex, second.fin, TM(0, 0.108, 0, HALF_PI));
      const c = new THREE.Vector3();
      shell.boundingBox.getCenter(c);
      K.add(ridgeOn(probe, c, 0.42, Math.PI - 0.42, 0.011, 0.55), second.hex, second.fin);
      for (const s of [-1, 1]) {
        const az = s * 0.5, x = Math.sin(az) * 0.1165, z = Math.cos(az) * 0.1165;
        K.add(puckGeometry(0.0115, 0.009, 0.003, 20, 2), '#c9ccd1', 'chrome', TMo(x, 0.125, z, HALF_PI, az, 0));
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 24), solid);
        lamp.position.set(Math.sin(az) * 0.1218, 0.125, Math.cos(az) * 0.1218);
        lamp.rotation.set(0, az, 0);
        out.lights.push(lamp);
      }
      pucks(0.104, 0.07, -0.004, 0.026, 0.014, second.hex, second.fin);
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.11, 0, 0.112], [0, 0.07, 0.07, 0.05]];
      break;
    }
    case 'cube': {
      // a rounded cube with a black screen face and two square eyes, twin antennae with lit tips
      shell = superEllipsoid(0.1, 0.09, 0.094, 0.3, 0.3, 64, 48);
      shell.translate(0, 0.108, 0.006);
      shell.computeBoundingBox();
      K.add(roundedBoxGeometry(0.168, 0.12, 0.012, 0.016, 3), FACE_BLACK, 'ink', TM(0, 0.104, 0.096));
      const gl = glass(new THREE.PlaneGeometry(0.162, 0.114));
      gl.position.set(0, 0.104, 0.1025);
      for (const s of [-1, 1]) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.03), eyeMat);
        q.position.set(s * 0.036, 0.113, 0.1031);
        eye(q, 0.113);
        K.add(segGeo(new THREE.Vector3(s * 0.058, 0.192, -0.05), new THREE.Vector3(s * 0.0745, 0.262, -0.07), 0.0026), '#b8bdc4', 'metal');
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 16, 12), solid);
        tip.position.set(s * 0.0745, 0.2655, -0.0703);
        out.lights.push(tip);
        K.add(puckGeometry(0.009, 0.006, 0.002, 14, 1), second.hex, second.fin, TM(s * 0.058, 0.1955, -0.05));
      }
      out.eyeY = 0.113;
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.108, 0.006, 0.104], [0.07, 0.25, -0.07, 0.012], [-0.07, 0.25, -0.07, 0.012]];
      out.topAll = 0.275;
      break;
    }
    case 'orb': {
      // a sphere, paint over pearl, a round smoked face and two ring eyes
      const R = 0.104, split = 1.95, cy = 0.112, cz = 0.004;
      const up = new THREE.SphereGeometry(R, 64, 28, 0, TAU, 0, split), lo = new THREE.SphereGeometry(R, 64, 14, 0, TAU, split, Math.PI - split);
      for (const g of [up, lo]) { g.rotateY(-HALF_PI); g.translate(0, cy, cz); }
      shell = new THREE.SphereGeometry(R, 48, 32);
      shell.rotateY(-HALF_PI);
      shell.translate(0, cy, cz);
      shell.computeBoundingBox();
      const probe = shapeProbe(shell);
      K.add(new THREE.TorusGeometry(R * Math.sin(split), 0.0017, 6, 80), '#cfd3d8', 'chrome', TM(0, cy + R * Math.cos(split), cz, HALF_PI));
      K.add(shellPatch(shell, -0.9, 0.9, -0.52, 0.36, 0.0012, 26, 10), FACE_BLACK, 'ink');
      glass(shellPatch(shell, -0.84, 0.84, -0.46, 0.33, 0.0046, 24, 9));
      for (const s of [-1, 1]) eye(decalOn(probe, s * 0.037, 0.121, 0.044, 0.044, 0.0058, eyeMat), 0.121);
      out.eyeY = 0.121;
      pucks(0.1, 0.104, -0.004, 0.024, 0.014, second.hex, second.fin);
      K.add(up, paint.hex, 'paint');
      K.add(lo, second.hex, second.fin);
      out.samples = [[0, cy, cz, 0.106]];
      break;
    }
    case 'capsule': {
      // a tall capsule, paint over pearl, a narrow visor with one light bar, inside a slim orbit ring with two lit beads
      const cy = 0.134, cz = 0.004, split = 2.2;
      const up = superEllipsoid(0.08, 0.135, 0.087, 1, 1, 56, 34, 0, split), lo = superEllipsoid(0.08, 0.135, 0.087, 1, 1, 56, 14, split, Math.PI);
      for (const g of [up, lo]) g.translate(0, cy, cz);
      shell = superEllipsoid(0.08, 0.135, 0.087, 1, 1, 48, 36);
      shell.translate(0, cy, cz);
      shell.computeBoundingBox();
      const probe = shapeProbe(shell);
      const sy = cy + 0.135 * Math.cos(split), sx = 0.08 * Math.sin(split), sz = 0.087 * Math.sin(split);
      const ring = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; ring.push(new THREE.Vector3(Math.sin(a) * sx * 1.004, sy, cz + Math.cos(a) * sz * 1.004)); }
      K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 96, 0.0016, 5, true), '#cfd3d8', 'chrome');
      K.add(shellPatch(shell, -0.8, 0.8, -0.44, 0.3, 0.0012, 24, 10), FACE_BLACK, 'ink');
      glass(shellPatch(shell, -0.75, 0.75, -0.4, 0.28, 0.0046, 22, 9));
      eye(new THREE.Mesh(patchAt(shell, probe, 0, 0.158, 0.58, 0.05, 0.0031), eyeMat), 0.158);
      out.eyeY = 0.158;
      K.add(up, paint.hex, 'paint');
      K.add(lo, second.hex, second.fin);
      // the orbit ring
      const rg = new THREE.Group();
      rg.position.set(0, 0.166, cz);
      rg.rotation.set(HALF_PI + 0.2, 0, 0.14);
      const RK = new RobotKit(RB_MAT);
      RK.add(new THREE.TorusGeometry(0.118, 0.0033, 8, 120), '#d4d8dd', 'chrome');
      for (const s of [-1, 1]) RK.add(segGeo(new THREE.Vector3(s * 0.07, 0, 0), new THREE.Vector3(s * 0.117, 0, 0), 0.0019, 6), '#d4d8dd', 'chrome');
      RK.mesh(rg);
      const spin = new THREE.Group();
      for (const s of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 10), solid);
        b.position.set(0, s * 0.118, 0);
        spin.add(b);
      }
      rg.add(spin);
      out.spinner = spin;
      out.ring = rg;
      out.samples = [[0, cy + 0.06, cz, 0.082], [0, cy - 0.05, cz, 0.082]];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; out.ringPts = out.ringPts || []; out.ringPts.push([Math.cos(a) * 0.118, Math.sin(a) * 0.118]); }
      break;
    }
    case 'screen': {
      // a rounded screen head: a black glass face with two happy crescent eyes, ear pods and a boom mic
      shell = roundedBoxGeometry(0.235, 0.168, 0.112, 0.042, 5);
      shell.translate(0, 0.104, 0);
      shell.computeBoundingBox();
      K.add(roundedBoxGeometry(0.205, 0.136, 0.008, 0.026, 3), FACE_BLACK, 'ink', TM(0, 0.104, 0.0535));
      const gl = glass(new THREE.PlaneGeometry(0.2, 0.131));
      gl.position.set(0, 0.104, 0.0581);
      for (const s of [-1, 1]) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(0.054, 0.04), eyeMat);
        q.position.set(s * 0.047, 0.115, 0.0586);
        eye(q, 0.115);
      }
      out.eyeY = 0.115;
      pucks(0.1175, 0.098, -0.004, 0.03, 0.016, second.hex, second.fin);
      const mic = [new THREE.Vector3(-0.125, 0.088, 0.008), new THREE.Vector3(-0.119, 0.05, 0.056), new THREE.Vector3(-0.082, 0.034, 0.083), new THREE.Vector3(-0.042, 0.036, 0.088)];
      K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mic), 24, 0.0025, 6, false), '#16171a', 'satin');
      K.add(capsuleGeometry(0.0095, 0.022, 6, 14), '#121315', 'matte', TM(-0.03, 0.036, 0.088, 0, 0, HALF_PI));
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.104, 0, 0.075], [0.068, 0.104, 0, 0.06], [-0.068, 0.104, 0, 0.06], [-0.04, 0.036, 0.088, 0.014]];
      break;
    }
    case 'lens': {
      // a compact pod with one camera lens (barrel, chrome ring, glass, a lit iris) and two swept fins
      shell = superEllipsoid(0.088, 0.074, 0.084, 0.55, 0.6, 56, 40);
      shell.translate(0, 0.098, -0.004);
      shell.computeBoundingBox();
      K.add(puckGeometry(0.05, 0.03, 0.006, 40, 3), '#0d0e10', 'ink', TM(0, 0.098, 0.08, HALF_PI));
      K.add(puckGeometry(0.044, 0.012, 0.003, 40, 2), '#d2d6db', 'chrome', TM(0, 0.098, 0.0985, HALF_PI));
      K.add(new THREE.CircleGeometry(0.039, 48), FACE_BLACK, 'ink', TM(0, 0.098, 0.1048));
      const gl = glass(new THREE.CircleGeometry(0.039, 48));
      gl.position.set(0, 0.098, 0.1065);
      const iris = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), eyeMat);
      iris.position.set(0, 0.098, 0.1055);
      eye(iris, 0.098);
      out.eyeY = 0.098;
      for (const s of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.lineTo(0.088, 0.008);
        sh.quadraticCurveTo(0.07, 0.052, 0.018, 0.047);
        sh.lineTo(0, 0);
        const fin = new THREE.ExtrudeGeometry(sh, { depth: 0.0056, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 10 });
        fin.translate(0, 0, -0.0028);
        fin.rotateY(HALF_PI);
        fin.rotateZ(-s * 0.42);
        fin.translate(s * 0.05, 0.152, 0.03);
        K.add(fin, second.hex, second.fin);
      }
      pucks(0.086, 0.098, -0.004, 0.014, 0.008, '#c9ccd1', 'chrome', null);
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.098, -0.004, 0.088], [0, 0.098, 0.088, 0.05], [0.07, 0.17, -0.02, 0.03], [-0.07, 0.17, -0.02, 0.03]];
      break;
    }
    case 'block': {
      // a wide block: a brushed-aluminium bezel round a dot-matrix face, side vents, an antenna mast with a beacon
      shell = roundedBoxGeometry(0.25, 0.146, 0.15, 0.03, 5);
      shell.translate(0, 0.1, -0.006);
      shell.computeBoundingBox();
      K.add(roundedBoxGeometry(0.222, 0.118, 0.01, 0.018, 3), second.hex, second.fin, TM(0, 0.1, 0.067));
      K.add(roundedBoxGeometry(0.204, 0.1, 0.006, 0.012, 3), FACE_BLACK, 'ink', TM(0, 0.1, 0.0745));
      for (const s of [-1, 1]) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(0.054, 0.054), eyeMat);
        q.position.set(s * 0.048, 0.103, 0.0782);
        eye(q, 0.103);
        for (let i = 0; i < 3; i++) K.add(new THREE.BoxGeometry(0.004, 0.0055, 0.07), '#0e0f11', 'matte', TM(s * 0.1252, 0.08 + i * 0.017, -0.01));
      }
      out.eyeY = 0.103;
      K.add(puckGeometry(0.013, 0.01, 0.003, 18, 1), '#121315', 'ink', TM(-0.085, 0.177, -0.035));
      K.add(limbGeometry(0.0028, 0.0024, 0.12, 8), '#b8bdc4', 'metal', TM(-0.085, 0.296, -0.035));
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), solid);
      beacon.position.set(-0.085, 0.302, -0.035);
      out.lights.push(beacon);
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.1, -0.006, 0.08], [0.075, 0.1, -0.006, 0.07], [-0.075, 0.1, -0.006, 0.07], [-0.085, 0.29, -0.035, 0.012]];
      out.topAll = 0.31;
      break;
    }
    case 'helm':
    default: {
      // a helmet: paint over the crown and back, the face in gloss black under a wraparound smoked visor,
      // two soft eyes (or a light bar) behind it, with a clean crown beneath any headset
      shell = superEllipsoid(0.1, 0.12, 0.112, 0.86, 0.92, 64, 48);
      shell.translate(0, 0.108, 0.004);
      shell.computeBoundingBox();
      const probe = shapeProbe(shell);
      K.add(shellPatch(shell, -1.22, 1.22, -0.82, 0.2, 0.0012, 32, 10), FACE_BLACK, 'ink');
      glass(shellPatch(shell, -1.13, 1.13, -0.34, 0.17, 0.0048, 30, 9));
      const ey = 0.112;
      if (B.eyes === 'bar') eye(new THREE.Mesh(patchAt(shell, probe, 0, ey, 0.46, 0.05, 0.0031), eyeMat), ey);
      else for (const s of [-1, 1]) eye(new THREE.Mesh(patchAt(shell, probe, s * 0.034, ey, 0.13, 0.063, 0.0031, 8, 3), eyeMat), ey);
      out.eyeY = ey;
      pucks(0.098, 0.1, -0.012, 0.025, 0.012, second.hex, second.fin);
      K.add(shell, paint.hex, 'paint');
      out.samples = [[0, 0.108, 0.004, 0.112]];
      break;
    }
  }
  const bb = shell.boundingBox;
  out.info = { top: bb.max.y, side: bb.max.x, front: bb.max.z, bottom: bb.min.y };
  out.topAll = Math.max(out.topAll || 0, bb.max.y);
  out.mesh = new THREE.Mesh(K.geometry(), RB_MAT);
  return out;
}

/* ---------- head accessories --------------------------------------------------------- */

function buildHeadwear(kind, hm, mats) {
  const g = new THREE.Group();
  const top = hm.top, side = hm.side, cy = hm.cy || 0.11;
  switch (kind) {
    case 'headset': {
      // a slim business headset: band over the crown, one ear cushion, a boom to the mouth
      const band = new THREE.Mesh(new THREE.TorusGeometry(side + 0.012, 0.0055, 8, 48, Math.PI), INK_MAT);
      band.position.y = cy + 0.004;
      band.scale.set(1, (top - cy + 0.016) / (side + 0.012), 1);
      g.add(band);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.018, 28), INK_MAT);
      cup.rotation.z = HALF_PI;
      cup.position.set(-side - 0.006, cy - 0.012, -0.01);
      g.add(cup);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 20), INK_MAT);
      pad.rotation.z = HALF_PI;
      pad.position.set(side + 0.002, cy, -0.012);
      g.add(pad);
      // Route around the cheek before turning toward the mouth: a straight chord cut through the head.
      const a = new THREE.Vector3(-side - 0.012, cy - 0.03, 0.006);
      const b = new THREE.Vector3(-0.03, cy - 0.064, hm.front + 0.018);
      const boom = new THREE.CatmullRomCurve3([a,
        new THREE.Vector3(-side - 0.022, cy - 0.045, hm.front * 0.7),
        new THREE.Vector3(-side * 0.72, cy - 0.064, hm.front + 0.018), b]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(boom, 32, 0.0028, 8, false), INK_MAT));
      const mic = new THREE.Mesh(capsuleGeometry(0.0055, 0.012, 6, 12), INK_MAT);
      mic.position.copy(b);
      mic.rotation.z = HALF_PI;
      g.add(mic);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), mats.glow);
      led.position.set(-side - 0.016, cy - 0.016, 0.0);
      led.userData.keep = true;
      g.add(led);
      g.userData.ball = led;
      break;
    }
    case 'headphones': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(side + 0.03, 0.011, 10, 56, Math.PI), INK_MAT);
      band.scale.set(1, (top - cy + 0.03) / (side + 0.03), 1);
      band.position.y = cy;
      g.add(band);
      for (const s of [-1, 1]) {
        const cup = new THREE.Mesh(roundedBoxGeometry(0.036, 0.092, 0.075, 0.018, 3), INK_MAT);
        cup.position.set(s * (side + 0.022), cy - 0.012, -0.012);
        g.add(cup);
        const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 10, 28), mats.cushion);
        cushion.rotation.y = HALF_PI;
        cushion.scale.set(1, 1.25, 1);
        cushion.position.set(s * (side + 0.004), cy - 0.012, -0.012);
        g.add(cushion);
      }
      break;
    }
    default:
      break;
  }
  return g;
}


/** A robot foot shell in metres: origin at the ankle joint, toe toward +Z, resting on a sole at -DIM.ankle. */
function robotFootGeometry() {
  const L = 0.258, Wd = 0.09, Ht = 0.056;
  const g = roundedBoxGeometry(Wd, Ht, L, 0.02, 3);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = z / (L / 2);
    const sx = 1 - 0.2 * smooth(0.3, 1, k) - 0.12 * smooth(-0.5, -1, k);
    const sy = y > 0 ? 1 - 0.5 * smooth(-0.15, 1, k) : 1;
    pos.setXYZ(i, x * sx, y * sy, z);
    const nx = nrm.getX(i) / sx, ny = nrm.getY(i) / sy, nz = nrm.getZ(i), l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(i, nx / l, ny / l, nz / l);
  }
  g.translate(0, -DIM.ankle + 0.014 + Ht / 2, 0.064);
  return g;
}

/* ---------- the keyboard under the fingers -------------------------------------------------------- */

const SYNTH_KEY_U = 0.019; // key pitch
/** A laptop-style layout, the row nearest the typist first: [label, width in keys]. */
const KB_ROWS = [
  [['fn', 1], ['ctrl', 1], ['opt', 1], ['cmd', 1.25], [' ', 5], ['cmd', 1.25], ['opt', 1], ['left', 1], ['down', 1], ['right', 1]],
  [['shift', 2.25], ...'ZXCVBNM,./'.split('').map(c => [c, 1]), ['shift', 2.25]],
  [['caps', 1.75], ..."ASDFGHJKL;'".split('').map(c => [c, 1]), ['return', 1.75]],
  [['tab', 1.5], ...'QWERTYUIOP[]'.split('').map(c => [c, 1]), ['\\', 1]],
  [...'`1234567890-='.split('').map(c => [c, 1]), ['\b', 1.5]],
];
/** Until a station supplies its keys: a grid around desk.kb (same frame; the typist faces +Z, its right is -X). */
function synthKeyboard(kb) {
  const keys = [];
  KB_ROWS.forEach((row, r) => {
    const total = row.reduce((s, [, w]) => s + w, 0);
    let tx = (-total * SYNTH_KEY_U) / 2;
    for (const [label, w] of row) {
      const cx = tx + (w * SYNTH_KEY_U) / 2;
      keys.push({ x: kb.x - cx, y: kb.y, z: kb.z + (r - 2) * SYNTH_KEY_U, w: w * SYNTH_KEY_U - 0.002, d: SYNTH_KEY_U - 0.002, row: r, label });
      tx += w * SYNTH_KEY_U;
    }
  });
  return { keys, press: null };
}
/** Which finger strikes which key (touch typing): [hand, finger], fingers index 0 … little 3, thumb 4. */
const FINGER_OF = {};
[['L', 3, 'QAZ1`'], ['L', 2, 'WSX2'], ['L', 1, 'EDC3'], ['L', 0, 'RFVTGB45'], ['R', 0, 'YHNUJM67'], ['R', 1, 'IK,8'], ['R', 2, 'OL.9'], ['R', 3, "P;/0-=[]'\b"]]
  .forEach(([h, f, s]) => { for (const c of s) FINGER_OF[c] = [h, f]; });
const HOME_KEYS = { L: ['F', 'D', 'S', 'A'], R: ['J', 'K', 'L', ';'] };
const TYPE_WORDS = ['listing', 'closing', 'offer', 'buyer', 'seller', 'market', 'review', 'tour', 'price', 'deposit', 'contract', 'inspection', 'appraisal',
  'bergen', 'closter', 'alpine', 'tenafly', 'schedule', 'follow', 'update', 'pipeline', 'design', 'build', 'surface', 'report', 'client', 'private',
  'notes', 'draft', 'call', 'today', 'agent', 'home', 'estate', 'value', 'data', 'feed', 'merge', 'deploy', 'page', 'site', 'video', 'post', 'the', 'and', 'for', 'with'];
function normKeyLabel(l) {
  if (l == null) return null;
  const s = String(l);
  if (s === ' ' || /^space/i.test(s)) return ' ';
  if (s === '\b' || /^(delete|backspace|del|⌫)$/i.test(s)) return '\b';
  return s.toUpperCase();
}
/** label → key index; reads the layout by rows and positions when the keys carry no letters. */
function mapKeys(keys) {
  const map = {};
  keys.forEach((k, i) => {
    const L = normKeyLabel(k.label);
    if (L != null && map[L] == null) map[L] = i;
  });
  if (Object.keys(map).filter(c => /^[A-Z]$/.test(c)).length >= 20 && map[' '] != null) return map;
  const rows = new Map();
  keys.forEach((k, i) => {
    const r = k.row != null ? k.row : Math.round(k.z / SYNTH_KEY_U);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push(i);
  });
  const order = [...rows.values()].sort((a, b) => keys[a[0]].z - keys[b[0]].z); // nearest the typist first
  // the row with the widest key is the space row; the rest above it, nearest first
  let s = order.findIndex(row => row.some(i => keys[i].w > 4 * SYNTH_KEY_U));
  if (s < 0) s = 0;
  const widest = order[s].reduce((b, i) => (keys[i].w > keys[b].w ? i : b), order[s][0]);
  map[' '] = widest;
  order.slice(s + 1, s + 5).forEach((row, r) => {
    const tmpl = KB_ROWS[r + 1];
    const tw = tmpl.reduce((a, [, w]) => a + w, 0);
    const xs = row.map(i => keys[i].x), x0 = Math.max(...xs), x1 = Math.min(...xs); // typist's left (+X) to right
    let acc = 0;
    for (const [label, w] of tmpl) {
      const f = (acc + w / 2) / tw;
      acc += w;
      const L = normKeyLabel(label);
      if (map[L] != null) continue;
      const want = lerp(x0, x1, f);
      map[L] = row.reduce((b, i) => (Math.abs(keys[i].x - want) < Math.abs(keys[b].x - want) ? i : b), row[0]);
    }
  });
  return map;
}

/* ---------- the figure ------------------------------------------------------------ */

const KAPPA = 0.72; // a finger's end joint follows its middle joint
const TYPE_WRIST = { y: 0.078, z: 0.11 }; // typing: the wrist above and behind the centre of its home keys
const HAND_OUT = { L: 0.026, R: 0.037 }; // typing: the wrist's offset outward from the centre of its home keys (measured: each hand's four fingers then sit square over F D S A and J K L ;)

class Figure {
  /**
   * spec: { id, color, bot: { preset, …overrides }, headwear: 'headset' | 'headphones', build: { torsoW } }.
   * The courier: { id: 'courier', color: 'slate', bot: { preset: 'courier' } }.
   */
  constructor(spec) {
    this.spec = spec;
    const C = colorsOf(spec.color);
    this.colors = C;
    this.robot = true; // the view recolours the light (glowMat) for every figure
    const preset = (spec.bot && spec.bot.preset) || (spec.id === 'courier' ? 'courier' : 'helm');
    const Bt = Object.assign({}, BOT_PRESETS[preset] || BOT_PRESETS.helm, spec.bot || {});
    this.bot = Bt;
    this.base = ['legs', 'hover', 'ball', 'tracks'].includes(Bt.base) ? Bt.base : 'legs';
    this.noChair = this.base !== 'legs'; // the station hides its chair for a bot without legs
    this.person = { female: false, seed: 1 }; // a robot, not a person
    const TK = TORSO_KINDS[Bt.torso] || TORSO_KINDS.chest;
    const widthK = TK.k * ((spec.build && spec.build.torsoW) || 1);
    this.B = { torsoW: widthK };
    // the paint (the roster colour); `deep` darkens it under the bright room (Crimson reads as crimson, not scarlet)
    const paintHex = Bt.deep ? mixHex(Bt.paint || C.main, '#000000', Bt.deep) : Bt.paint || C.main;
    const second = BOT_SECOND[Bt.second] || BOT_SECOND.graphite;
    const P = (this.palette = { paint: { hex: paintHex }, second, seam: mixHex(paintHex, '#000000', 0.55) });
    const HANDS = BOT_HANDS[Bt.hands] || BOT_HANDS.graphite;
    const CORE = ROBOT_CORE;
    const LK = Bt.limb || 1; // heavier or lighter limbs (shells and actuators)

    this.ledBase = '#ffffff';
    this.ledMat = new THREE.MeshBasicMaterial({ color: lin('#ffffff'), toneMapped: false });
    // the one light: the eyes and a thin collar seam, in the agent's light colour; the view turns it crimson when the
    // agent needs Igor, grey while paused. Every other light on the robot follows it.
    this.glowMat = new THREE.MeshBasicMaterial({ color: lin(C.light), map: EYE_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.ledGlow = new THREE.MeshBasicMaterial({ color: lin('#9fe3a8'), toneMapped: false });
    this.solidLight = new THREE.MeshBasicMaterial({ color: lin(C.light), toneMapped: false, fog: false });
    this.lightMats = [this.solidLight];
    this.extraLight = tex => {
      const m = lightMaterial(tex, C.light);
      this.lightMats.push(m);
      return m;
    };

    const root = (this.root = new THREE.Group());
    root.name = 'figure:' + spec.id;
    const hips = (this.hips = new THREE.Group());
    root.add(hips);
    const spine = (this.spine = new THREE.Group());
    hips.add(spine);
    this.torso = new THREE.Object3D(); // the shared update breathes this; a robot does not
    const shX = DIM.shX * widthK;
    this.shoulderX = shX;
    this.shoulderY = DIM.shY;
    const env0 = tableEnv(ROBOT_TORSO, widthK);
    const env = y => {
      const E = env0(y);
      return { w: E.w, f: E.f * TK.d, b: E.b * TK.d };
    };
    const CN = TK.n;
    const RM = RB_MAT;
    const darkHub = second.dark;

    /** An actuator on the X axis: a housing in the second colour, a contrasting inner disc and a hub on each listed face (±1). */
    const actuator = (K, x, y, r, h, faces, housing = second.hex, hfin = second.fin, radial = 24) => {
      K.add(puckGeometry(r, h, Math.min(0.007, h * 0.3, r * 0.3), radial), housing, hfin, TM(x, y, 0, 0, 0, -HALF_PI));
      for (const s of faces) {
        K.add(puckGeometry(r * 0.62, 0.008, 0.002, 18, 1), darkHub ? '#a9afb7' : '#17181b', darkHub ? 'metal' : 'core', TM(x + s * (h / 2 + 0.0005), y, 0, 0, 0, -HALF_PI));
        K.add(puckGeometry(r * 0.24, 0.006, 0.0015, 10, 1), darkHub ? '#17181b' : '#c3c8cf', darkHub ? 'core' : 'metal', TM(x + s * (h / 2 + 0.0035), y, 0, 0, 0, -HALF_PI));
      }
    };

    // torso: a painted chest plate (a clamshell: fine seams up the sides and the front), a band in the second colour
    // under its edge, a ribbed abdomen over the satin-black core, the power-core module on the back, the neck
    const T = new RobotKit(RM);
    T.add(loftRing(bandRows(env, 0.244, 0.548, { e: 0.005, lip: 0.02, eTop: 0.004, lipTop: 0.004, steps: 3, mid: 18 }), 48, CN), paintHex, 'paint');
    T.add(seamLine(env, 0.27, 0.5), P.seam, 'matte');
    T.add(seamRing(env, 0.502, 1.004, 0.0011, CN), P.seam, 'matte');
    for (const s of [-1, 1]) T.add(seamSide(env, s, 0.252, 0.536), P.seam, 'matte');
    T.add(loftRing(bandRows(env, 0.233, 0.246, { k: 0.958, e: 0.003, lip: 0.01, steps: 2, mid: 1 }), 44, CN), second.hex, second.fin);
    for (const y0 of [0.079, 0.117, 0.155, 0.193])
      T.add(loftRing(bandRows(env, y0, y0 + 0.024, { k: 0.9, e: 0.005, lip: 0.012, steps: 2, mid: 1 }), 40, CN), second.dark ? '#26282c' : mixHex(second.hex, '#000000', 0.12), second.dark ? 'satin' : second.fin);
    T.add(loftRing([-0.01, 0.07, 0.15, 0.23, 0.27].map(y => scaleRow(env(y), y, 0.8)), 28, CN), CORE, 'core');
    const by = 0.36, bz = -env(by).b;
    T.add(roundedBoxGeometry(0.13 * widthK, 0.15, 0.04, 0.011, 2), second.hex, second.fin, TM(0, by, bz - 0.004));
    T.add(roundedBoxGeometry(0.09 * widthK, 0.105, 0.006, 0.0025, 1), CORE, 'core', TM(0, by, bz - 0.0245));
    for (const dy of [-0.036, -0.012, 0.012, 0.036]) T.add(new THREE.BoxGeometry(0.07 * widthK, 0.0042, 0.003), '#8d939b', 'metal', TM(0, by + dy, bz - 0.028));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) T.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 10), '#c3c8cf', 'metal', TM(sx * 0.053 * widthK, by + sy * 0.062, bz - 0.0255, HALF_PI));
    T.add(new THREE.CylinderGeometry(0.031, 0.036, 0.076, 24), CORE, 'core', TM(0, 0.564, 0));
    T.add(new THREE.SphereGeometry(0.032, 24, 16), CORE, 'core', TM(0, DIM.headPivot, 0));
    for (const y of [0.554, 0.578]) T.add(new THREE.TorusGeometry(0.034, 0.0024, 6, 28), '#9aa0a8', 'metal', TM(0, y, 0, HALF_PI));
    for (const s of [-1, 1]) T.add(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 14), CORE, 'core', TM(s * (shX - 0.045), DIM.shY, 0, 0, 0, HALF_PI));
    // the B&Co crest on the left chest, ~9 cm across: a flat enamel face tangent to the chest and standing a few mm proud,
    // a polished rim, and a short collar back into the shell (no gap at its edge on a curved torso, nothing bent over it)
    const bdy = 0.385, CR = clamp(env(bdy).w * 0.29, 0.04, 0.046), bx = Math.min(0.07 * widthK, env(bdy).w - CR - 0.03);
    const fp = frontPoint(env, bx, bdy, CN), fUp = frontPoint(env, bx, bdy + 0.012, CN), fDn = frontPoint(env, bx, bdy - 0.012, CN);
    const pitch = Math.atan2(fDn.z - fUp.z, 0.024); // the chest leaning back toward the shoulders
    const BM = new THREE.Matrix4().compose(new THREE.Vector3(bx, bdy, fp.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, fp.yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const lift = new THREE.Matrix4().makeTranslation(0, 0, 0.0045 + CR * Math.sin(Math.abs(fp.yaw)) * 0.5);
    BM.multiply(lift);
    const CP = crestParts(CR);
    T.add(CP.rim.applyMatrix4(BM), '#d2d6db', 'chrome');
    T.add(CP.collar.applyMatrix4(BM), '#2a2c30', 'satin');
    T.mesh(spine);
    const badge = new THREE.Mesh(CP.face, badgeMaterial());
    BM.decompose(badge.position, badge.quaternion, badge.scale);
    badge.userData.keep = true;
    spine.add(badge);
    this.badge = badge;
    this.crestR = CR;
    // the collar seam: a thin ring of light round the base of the neck (the eye light's material, at its brightest)
    const lg = new THREE.TorusGeometry(0.0415, 0.0022, 4, 40);
    for (let i = 0, uv = lg.attributes.uv; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
    const collarLight = new THREE.Mesh(lg, this.glowMat);
    collarLight.rotation.x = HALF_PI;
    collarLight.position.y = 0.5495;
    collarLight.renderOrder = 5;
    collarLight.userData.keep = true;
    spine.add(collarLight);

    // the head
    const head = (this.head = new THREE.Group());
    head.position.y = DIM.headPivot;
    spine.add(head);
    const HB = buildBotHead(Bt.head, Bt, P, this);
    const hm = HB.mesh;
    head.add(hm);
    this.headMesh = hm;
    for (const gl of HB.glass) hm.add(gl);
    const ePivot = new THREE.Group();
    ePivot.position.y = HB.eyeY;
    ePivot.userData.keep = true;
    for (const { mesh, y } of HB.eyes) {
      mesh.position.y -= y;
      mesh.userData.keep = true;
      ePivot.add(mesh);
    }
    hm.add(ePivot);
    this.eyePivot = ePivot;
    for (const l of HB.lights) {
      l.userData.keep = true;
      hm.add(l);
    }
    if (HB.ring) hm.add(HB.ring);
    this.spinner = HB.spinner;
    this.headSamples = HB.samples;
    this.headTop = HB.topAll;
    const bbH = HB.info;
    const acc = buildHeadwear(spec.headwear, { top: bbH.top, side: bbH.side, front: bbH.front, cy: (bbH.top + bbH.bottom) / 2 }, { glow: this.ledGlow, cushion: std('#2a2b2f', 0.9) });
    hm.add(acc);
    mergeByMaterial(acc);
    this.accessory = acc;
    // the head as built (shell, visor, headwear), in the head's frame: the poses that bring the hands up to it (a
    // stretch, fingers laced behind it, holding it) place them against this, never through it
    this.headBox = localBox(head, o => !!(o.material && o.material.transparent && (o.material.isMeshBasicMaterial || o.material.depthWrite === false)));

    // arms: a shoulder actuator, a painted upper-arm shell, an elbow actuator, a forearm shell in the second colour,
    // a steel ring at the wrist, and a jointed hand (skinned: every finger joint in one mesh)
    const mkArm = side => {
      const sh = new THREE.Group();
      sh.position.set(side * shX, DIM.shY, 0);
      const KU = new RobotKit(RM);
      actuator(KU, 0, 0, 0.05 * LK, 0.07, [side]);
      KU.add(limbGeometry(0.03, 0.027, DIM.upperArm, 12), CORE, 'core');
      KU.add(limbShell(0.05 * LK, 0.044 * LK, -0.054, -0.256, { sz: 1.04, e: 0.005 }), paintHex, 'paint');
      KU.mesh(sh);
      const el = new THREE.Group();
      el.position.y = -DIM.upperArm;
      sh.add(el);
      const KF = new RobotKit(RM);
      actuator(KF, 0, 0, 0.036 * LK, 0.066, [side]);
      KF.add(limbGeometry(0.026, 0.023, DIM.foreArm, 12), CORE, 'core');
      KF.add(limbShell(0.045 * LK, 0.036 * LK, -0.04, -0.212, { sz: 1.05, e: 0.005 }), second.hex, second.fin);
      KF.add(new THREE.TorusGeometry(0.0252, 0.0034, 4, 18), '#9aa0a8', 'metal', TM(0, -0.228, 0, HALF_PI));
      KF.mesh(el);
      const wr = new THREE.Group();
      wr.position.y = -DIM.foreArm;
      el.add(wr);
      const tw = new THREE.Group();
      wr.add(tw);
      spine.add(sh);
      const hand = this._buildHand(side, HANDS, paintHex, tw);
      return Object.assign({ sh, el, wr, tw, side, inv: new THREE.Matrix4() }, hand);
    };
    this.armL = mkArm(1);
    this.armR = mkArm(-1);

    // below the waist: legs, or a base
    if (this.base === 'legs') {
      new RobotKit(RM).add(loftRing(ROBOT_PELVIS.map(([y, w, f, b]) => ({ y, w: w * widthK, f: f * widthK, b: b * widthK })), 44, CN), second.hex, second.fin).mesh(hips);
      const mkLeg = side => {
        const hp = new THREE.Group();
        hp.position.set(side * DIM.hipW, 0, 0);
        const KT = new RobotKit(RM);
        KT.add(new THREE.SphereGeometry(0.056, 16, 12), CORE, 'core');
        actuator(KT, side * 0.066, 0, 0.053, 0.03, [side]);
        KT.add(limbGeometry(0.04, 0.034, DIM.thigh, 12), CORE, 'core');
        KT.add(limbShell(0.07, 0.058 * Math.min(LK, 1.04), -0.062, -0.385, { sz: 1.08, e: 0.005, segs: 24 }), paintHex, 'paint');
        KT.mesh(hp);
        const kn = new THREE.Group();
        kn.position.y = -DIM.thigh;
        hp.add(kn);
        const KS = new RobotKit(RM);
        actuator(KS, 0, 0, 0.046 * LK, 0.09, [-1, 1]);
        KS.add(roundedBoxGeometry(0.058, 0.064, 0.016, 0.007, 2), paintHex, 'paint', TM(0, -0.016, 0.047, -0.08));
        KS.add(limbGeometry(0.035, 0.029, DIM.shin, 12), CORE, 'core');
        KS.add(limbShell(0.058 * LK, 0.047 * LK, -0.052, -0.36, { sz: 1.1, e: 0.005, segs: 24 }), second.hex, second.fin);
        KS.mesh(kn);
        const an = new THREE.Group();
        an.position.y = -DIM.shin;
        kn.add(an);
        const KA = new RobotKit(RM);
        KA.add(limbGeometry(0.029, 0.029, 0.03, 12), CORE, 'core');
        actuator(KA, 0, 0, 0.03, 0.074, [-1, 1], second.hex, second.fin, 20);
        KA.add(robotFootGeometry(), paintHex, 'paint');
        KA.add(roundedBoxGeometry(0.096, 0.016, 0.266, 0.006, 2), '#121315', 'matte', TM(0, -DIM.ankle + 0.008, 0.064));
        KA.mesh(an);
        hips.add(hp);
        return { hp, kn, an, side };
      };
      this.legL = mkLeg(1);
      this.legR = mkLeg(-1);
    } else this._buildBase(P, second, CORE);
    this.radius = Math.max(shX + 0.06, this.base === 'tracks' ? 0.25 : this.base === 'legs' ? 0.24 : 0.2);
    // seated, the nav reads the body as a line from the hips this far forward along the floor: to the knees on legs, else the base's front
    this.kneeReach = { legs: 0.48, hover: 0.15, ball: 0.15, tracks: 0.2 }[this.base];
    this.baseY = 0;

    // label anchor above the head
    this.anchor = new THREE.Object3D();
    hips.add(this.anchor);
    this.anchor.position.y = DIM.headPivot + Math.max(0.4, this.headTop + 0.16);

    shadowAll(root, true, true);
    for (const arm of [this.armL, this.armR]) arm.hand.castShadow = false;
    root.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && (m.blending === THREE.AdditiveBlending || m === VISOR_GLASS || (m.isMeshBasicMaterial && !m.map && o !== this.badge))) o.castShadow = o.receiveShadow = false;
    });
    this.badge.castShadow = false;
    root.traverse(o => {
      if (o.isMesh) {
        o.userData.agentId = spec.id;
        o.userData.body = true; // the bot's own body (the hover reactions and its card key off this, not its desk or rug)
      }
    });

    this.pose = { ...SEATED };
    this.goal = { ...SEATED };
    this.poseV = Object.fromEntries(POSE_KEYS.map(k => [k, 0])); // each joint's speed: the pose eases on springs, never in jumps
    this._sp = { x: 0, v: 0 };
    this.mode = 'type';
    this.modeT = 0;
    this.phase = Math.random() * 100;
    this.walkPhase = 0;
    this.blinkIn = rand(1.5, 4.5);
    this.blink = 0;
    this.lambda = 9;
    this.desk = null; // keyboard + trackpad targets (root's parent frame) once seated: { kb, pad, keyboard? }
    this.station = null;
    this.strike = { L: 0, R: 0 };
    this.strikeT = { L: 0, R: 0 };
    this.react = { t: 0, kind: null };
    this.attend = null; // a world point to look toward (a neighbour, a screen)
    this.hf = null; // a walking high five in progress: { point, side, k, contact }
    this.spread = { L: 0, R: 0 };
    this.typK = 0;
    this.typ = null;
    // interaction: the pointer's hover, push and pull, and the choreography API (reach, lookAt, crouch, bend, recoil)
    this.hov = { on: false, k: 0, time: 0, look: new THREE.Vector3(), has: false, nodT: 0, liftT: 0, lifted: false };
    this.push = { held: false, w: new THREE.Vector3(), x: 0, z: 0, yaw: 0, rp: 0, rr: 0, v: { x: 0, z: 0, yaw: 0, rp: 0, rr: 0 }, mag: 0 };
    this.reachS = { 1: null, '-1': null };
    this.reachK = { 1: 0, '-1': 0 };
    this.lookAtP = null;
    this.crouchT = 0; this.crouchK = 0;
    this.bendT = 0; this.bendK = 0;
    this.recoilT = 0;
    this.dist = 0; this.vel = 0;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._t1 = new THREE.Vector3();
    this._t2 = new THREE.Vector3();
    this.LK = LK;
    this._pinv = new THREE.Matrix4();
    this._gq = [0, 1, 2, 3, 4, 5, 6].map(() => new THREE.Vector3());
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._wp = new THREE.Vector3();
    this._lp = null;
  }

  /** A hand: the palm (bone 0), four three-jointed fingers (bones 1–4 knuckles, 5–8 middle, 9–12 end joints), a two-jointed thumb (13, 14). */
  _buildHand(side, HANDS, paintHex, tw) {
    const K = new RobotKit(RB_MAT_SKIN);
    const bones = [];
    const rootB = new THREE.Bone();
    bones[0] = rootB;
    const f = [];
    const fx = [-0.0285, -0.0095, 0.0095, 0.0285], fl = [0.074, 0.081, 0.077, 0.061], fr = [0.0086, 0.0089, 0.0086, 0.0076];
    for (let i = 0; i < 4; i++) {
      const L1 = fl[i] * 0.46, L2 = fl[i] * 0.3, L3 = fl[i] * 0.24, r = fr[i];
      const bx = side * fx[i], byy = -HAND.palmL + 0.008;
      const mcp = new THREE.Bone();
      mcp.position.set(bx, byy, 0);
      mcp.rotation.order = 'ZXY';
      rootB.add(mcp);
      const pip = new THREE.Bone();
      pip.position.set(0, -L1, 0);
      mcp.add(pip);
      const dip = new THREE.Bone();
      dip.position.set(0, -L2, 0);
      pip.add(dip);
      bones[1 + i] = mcp;
      bones[5 + i] = pip;
      bones[9 + i] = dip;
      K.add(capsuleGeometry(r, Math.max(0.002, L1 - r * 1.6), 4, 12), HANDS[0], HANDS[1], TM(bx, byy - L1 / 2, 0), 1 + i);
      K.add(new THREE.SphereGeometry(r * 0.98, 12, 8), '#9aa0a8', 'metal', TM(bx, byy - L1, 0), 5 + i); // a steel knuckle at each middle joint
      K.add(capsuleGeometry(r * 0.92, Math.max(0.002, L2 - r * 1.5), 4, 12), HANDS[0], HANDS[1], TM(bx, byy - L1 - L2 / 2, 0), 5 + i);
      K.add(capsuleGeometry(r * 0.84, Math.max(0.002, L3 - r * 1.3), 4, 12), HANDS[0], HANDS[1], TM(bx, byy - L1 - L2 - L3 / 2 + 0.001, 0), 9 + i);
      K.add(roundedBoxGeometry(r * 1.2, L3 * 0.55, 0.0016, 0.0007, 1), paintHex, 'paint', TM(bx, byy - L1 - L2 - L3 * 0.55, r * 0.78), 9 + i); // a painted nail plate
      f.push({ mcp, pip, dip, L1, L2, L3, base: new THREE.Vector3(bx, byy, 0) });
    }
    const tx = -side * HAND.palmW * 0.44;
    const cmc = new THREE.Bone();
    cmc.position.set(tx, -0.02, -0.005);
    rootB.add(cmc);
    const ip = new THREE.Bone();
    ip.position.set(0, -0.037, 0);
    cmc.add(ip);
    bones[13] = cmc;
    bones[14] = ip;
    K.add(capsuleGeometry(0.0105, 0.026, 4, 12), HANDS[0], HANDS[1], TM(tx, -0.02 - 0.019, -0.005), 13);
    K.add(capsuleGeometry(0.0092, 0.018, 4, 12), HANDS[0], HANDS[1], TM(tx, -0.02 - 0.037 - 0.013, -0.005), 14);
    K.add(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 14), ROBOT_CORE, 'core', TM(0, 0.004, 0), 0);
    K.add(roundedBoxGeometry(HAND.palmW, HAND.palmL, HAND.palmT, 0.012, 2), HANDS[0], HANDS[1], TM(0, -HAND.palmL / 2 + 0.004, 0), 0);
    K.add(roundedBoxGeometry(HAND.palmW * 0.78, HAND.palmL * 0.54, 0.007, 0.0045, 1), paintHex, 'paint', TM(0, -HAND.palmL * 0.4, HAND.palmT / 2 - 0.0015), 0);
    K.add(roundedBoxGeometry(HAND.palmW * 0.96, 0.011, HAND.palmT * 0.84, 0.0045, 1), '#9aa0a8', 'metal', TM(0, -HAND.palmL + 0.011, 0), 0);
    const mesh = new THREE.SkinnedMesh(K.geometry(true), RB_MAT_SKIN);
    mesh.add(rootB);
    tw.add(mesh);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.userData.keep = true;
    // the palm's centre, for props held in the hand (palm(side).attach(obj))
    const palm = new THREE.Object3D();
    palm.position.set(0, -HAND.palmL * 0.55, -HAND.palmT * 0.55);
    tw.add(palm);
    return { hand: mesh, f, thumb: cmc, thumbIP: ip, palm };
  }

  /** The base of a bot without legs: the part that moves with the hips (this.lower) and the part on the floor or seat (this.baseG). */
  _buildBase(P, second, CORE) {
    const B = this.base, paint = P.paint.hex;
    const low = (this.lower = new THREE.Group());
    this.hips.add(low);
    const bg = (this.baseG = new THREE.Group());
    this.root.add(bg);
    const KL = new RobotKit(RB_MAT), KB = new RobotKit(RB_MAT);
    const lathe = (pts, radial = 56) => {
      const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), radial);
      g.rotateY(Math.PI);
      g.computeVertexNormals();
      return g;
    };
    if (B === 'hover') {
      // a tapered body to a polished emitter; a band in the second colour at its widest; below it a ring of light and a pool on the floor
      KL.add(lathe([[0.0005, 0.07], [0.098, 0.07], [0.116, 0.052], [0.126, 0.02], [0.128, -0.01], [0.122, -0.05], [0.108, -0.1], [0.088, -0.145], [0.064, -0.188], [0.042, -0.222], [0.03, -0.238], [0.0005, -0.24]], 64), paint, 'paint');
      KL.add(lathe([[0.1272, 0.012], [0.1318, 0.004], [0.1322, -0.024], [0.1262, -0.032]], 64), second.hex, second.fin);
      KL.add(puckGeometry(0.032, 0.016, 0.005, 28, 2), '#d2d6db', 'chrome', TM(0, -0.243, 0));
      const em = new THREE.Mesh(new THREE.CircleGeometry(0.024, 32), this.extraLight(EYE_SHAPES.dot));
      em.rotation.x = HALF_PI;
      em.position.y = -0.2515;
      em.userData.keep = true;
      low.add(em);
      const ringMat = new THREE.MeshBasicMaterial({ color: lin(this.colors.light), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, fog: false });
      this.lightMats.push(ringMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.0045, 8, 64), ringMat);
      ring.rotation.x = HALF_PI;
      ring.userData.keep = true;
      bg.add(ring);
      this.hoverRing = ring;
      const poolMat = new THREE.MeshBasicMaterial({ color: lin(this.colors.light), map: floorGlowTex(), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, fog: false });
      this.lightMats.push(poolMat);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), poolMat);
      pool.rotation.x = -HALF_PI;
      pool.position.y = 0.004;
      pool.userData.keep = true;
      pool.userData.noCollide = true;
      bg.add(pool);
      this.pool = pool;
    } else if (B === 'ball') {
      // a painted sphere with a dark band and steel hubs (it visibly rolls), a shroud over its shoulder with three rollers,
      // a telescoping strut up to a painted cowl under the torso
      const R = 0.14;
      const ball = (this.ball = new THREE.Group());
      ball.position.y = R;
      bg.add(ball);
      const KBall = new RobotKit(RB_MAT);
      KBall.add(new THREE.SphereGeometry(R, 48, 32), paint, 'paint');
      KBall.add(new THREE.TorusGeometry(R * 1.003, 0.0065, 8, 96), second.hex, second.fin, TM(0, 0, 0, 0, HALF_PI));
      for (const s of [-1, 1]) {
        KBall.add(puckGeometry(0.046, 0.008, 0.002, 32, 1), '#d2d6db', 'chrome', TM(s * R * 0.985, 0, 0, 0, 0, HALF_PI));
        KBall.add(puckGeometry(0.018, 0.012, 0.003, 18, 1), second.hex, second.fin, TM(s * R * 0.995, 0, 0, 0, 0, HALF_PI));
      }
      for (const a of [0.7, 2.3, 3.9, 5.5]) KBall.add(new THREE.SphereGeometry(0.012, 12, 8), second.hex, second.fin, TM(0, Math.cos(a) * R * 0.995, Math.sin(a) * R * 0.995, 0, 0, 0, 1, 1, 0.35));
      KBall.mesh(ball);
      KB.add(lathe([[0.094, 0.262], [0.128, 0.252], [0.15, 0.228], [0.153, 0.206], [0.144, 0.198]], 56), second.hex, second.fin);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        KB.add(new THREE.SphereGeometry(0.011, 12, 10), '#d2d6db', 'chrome', TM(Math.sin(a) * 0.118, 0.236, Math.cos(a) * 0.118));
      }
      KB.add(limbGeometry(0.042, 0.042, 0.15, 20), CORE, 'core', TM(0, 0.41, 0));
      KL.add(lathe([[0.0005, 0.07], [0.1, 0.07], [0.112, 0.042], [0.109, 0.0], [0.094, -0.05], [0.074, -0.09], [0.052, -0.104]], 56), paint, 'paint');
      KL.add(limbGeometry(0.032, 0.032, 0.25, 16), '#c7ccd2', 'metal', TM(0, -0.09, 0));
    } else {
      // tracks: two rubber belts round three wheels each (rolling with distance), painted fenders, a chassis, a strut
      const half = 0.12, rw = 0.07, wid = 0.075, cy = rw, xs = 0.122;
      this.trk = { half, rw, cy, xs, wid, n: 22 };
      const belt = new THREE.Shape();
      const stad = (sh, r) => {
        sh.moveTo(-half, cy - r);
        sh.lineTo(half, cy - r);
        sh.absarc(half, cy, r, -HALF_PI, HALF_PI, false);
        sh.lineTo(-half, cy + r);
        sh.absarc(-half, cy, r, HALF_PI, HALF_PI * 3, false);
      };
      stad(belt, rw);
      const hole = new THREE.Path();
      stad(hole, rw - 0.013);
      belt.holes.push(hole);
      for (const s of [-1, 1]) {
        const g = new THREE.ExtrudeGeometry(belt, { depth: wid, bevelEnabled: false, curveSegments: 18 });
        g.rotateY(-HALF_PI);
        g.translate(s * xs + wid / 2, 0, 0);
        KB.add(g, '#18191b', 'rubber');
        KB.add(roundedBoxGeometry(0.008, 0.1, 0.27, 0.003, 1), second.hex, second.fin, TM(s * (xs - wid / 2 - 0.006), cy, 0));
        KB.add(roundedBoxGeometry(wid + 0.014, 0.012, 2 * half + 0.06, 0.005, 2), paint, 'paint', TM(s * xs, cy + rw + 0.011, 0));
      }
      // the chassis: painted, a dark grille across its nose with two lamps, a brushed skid plate under it
      KB.add(roundedBoxGeometry(0.2, 0.15, 0.3, 0.034, 3), paint, 'paint', TM(0, 0.185, 0));
      KB.add(roundedBoxGeometry(0.15, 0.052, 0.01, 0.008, 2), '#0d0e10', 'ink', TM(0, 0.2, 0.149));
      KB.add(roundedBoxGeometry(0.16, 0.012, 0.26, 0.004, 1), second.hex, second.fin, TM(0, 0.104, 0));
      for (const s of [-1, 1]) {
        KB.add(puckGeometry(0.014, 0.008, 0.002, 20, 1), '#d2d6db', 'chrome', TM(s * 0.052, 0.2, 0.154, HALF_PI));
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 20), this.solidLight);
        lamp.position.set(s * 0.052, 0.2, 0.1585);
        lamp.userData.keep = true;
        bg.add(lamp);
      }
      KB.add(limbGeometry(0.05, 0.05, 0.16, 20), CORE, 'core', TM(0, 0.41, 0));
      const cleat = new THREE.InstancedMesh(new THREE.BoxGeometry(wid * 0.96, 0.009, 0.019), std('#232427', 0.88), 2 * this.trk.n);
      cleat.userData.keep = true;
      bg.add(cleat);
      this.cleats = cleat;
      const hubG = new RobotKit(RB_MAT);
      hubG.add(puckGeometry(0.05, 0.016, 0.004, 28, 2), '#c3c7cd', 'alu', TM(0, 0, 0, 0, 0, HALF_PI));
      for (let k = 0; k < 5; k++) hubG.add(new THREE.BoxGeometry(0.018, 0.006, 0.07), '#2a2c30', 'core', TM(0.009, 0, 0, (k / 5) * Math.PI));
      const hubs = new THREE.InstancedMesh(hubG.geometry(), RB_MAT, 6);
      hubs.userData.keep = true;
      bg.add(hubs);
      this.hubs = hubs;
      KL.add(lathe([[0.0005, 0.07], [0.11, 0.07], [0.122, 0.04], [0.118, 0.0], [0.1, -0.06], [0.072, -0.1], [0.06, -0.104]], 56), paint, 'paint');
      KL.add(limbGeometry(0.04, 0.04, 0.22, 16), '#c7ccd2', 'metal', TM(0, -0.09, 0));
      this._tracks(0);
    }
    if (KL.parts.length) KL.mesh(low);
    if (KB.parts.length) KB.mesh(bg);
  }

  /** Lays the cleats round the belts at a rolled distance, and turns the wheels. */
  _tracks(dist) {
    const R = this.trk, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const rc = R.rw + 0.002, L = 2 * R.half, P = 2 * L + TAU * rc;
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < R.n; i++) {
        let u = ((i / R.n) * P + dist) % P;
        if (u < 0) u += P;
        let y, z, a;
        if (u < L) { z = R.half - u; y = R.cy - rc; a = Math.PI; }
        else if (u < L + Math.PI * rc) { const th = (u - L) / rc; z = -R.half - rc * Math.sin(th); y = R.cy - rc * Math.cos(th); a = th + Math.PI; }
        else if (u < 2 * L + Math.PI * rc) { z = -R.half + (u - L - Math.PI * rc); y = R.cy + rc; a = 0; }
        else { const th = (u - 2 * L - Math.PI * rc) / rc; z = R.half + rc * Math.sin(th); y = R.cy + rc * Math.cos(th); a = th; }
        p.set((s ? 1 : -1) * R.xs, y, z);
        m.compose(p, q.setFromEuler(e.set(a, 0, 0)), one);
        this.cleats.setMatrixAt(s * R.n + i, m);
      }
    this.cleats.instanceMatrix.needsUpdate = true;
    const turn = dist / 0.05;
    let k = 0;
    for (const s of [-1, 1])
      for (const z of [-R.half, 0, R.half]) {
        p.set(s * (R.xs - 0.004), R.cy, z);
        m.compose(p, q.setFromEuler(e.set(turn, 0, 0)), one);
        this.hubs.setMatrixAt(k++, m);
      }
    this.hubs.instanceMatrix.needsUpdate = true;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    const moving = m => m === 'walk' || m === 'run' || m === 'carry';
    const up = m => ['stand', 'wave', 'look', 'lift', 'slam', 'upset'].includes(m);
    const big = moving(this.mode) !== moving(mode) || up(mode) !== up(this.mode);
    this.lambda = big ? 6 : 8;
    this._modeFrom = this.mode;
    this.mode = mode;
    this.modeT = 0;
  }

  /** Kept for the status layer; the view sets the light's colour directly (glowMat). */
  setEyes() {}

  /** A click: a glance at the viewer and a nod; a hover: a nod (the hover itself is hoverOn). */
  greet(kind = 'hover') {
    this.react.kind = kind;
    if (kind === 'click') this.react.t = 2.2;
    this.hov.nodT = 0.8;
  }

  /* ----- the pointer: hover and push/pull (wired by the UI) ----- */

  /** The pointer rests on the bot (true) or has left it (false). */
  hoverOn(on) {
    if (on === this.hov.on) return;
    this.hov.on = on;
    if (on) {
      this.hov.time = 0;
      this.hov.lifted = false;
      this.hov.nodT = 0.8;
    } else this.hov.has = false;
  }
  /** Where the pointer is (world): the head or visor follows it. */
  hoverLook(p) {
    this.hov.look.copy(p);
    this.hov.has = true;
  }
  /** Pressed and dragged: the world-space drag since the press. The bot (and its chair) follow on a damped spring. */
  pushDrag(worldDelta) {
    this.push.held = true;
    this.push.w.copy(worldDelta);
  }
  pushRelease() {
    this.push.held = false;
  }

  /** Which part a mesh of this robot belongs to: 'armL' | 'armR' | 'legL' | 'legR' | 'head' | 'torso'. */
  partOf(o) {
    for (let p = o; p && p !== this.root; p = p.parent) {
      if (p === this.head) return 'head';
      for (const k of ['armL', 'armR', 'legL', 'legR']) {
        const L = this[k];
        if (L && (p === L.sh || p === L.el || p === L.wr || p === L.tw || p === L.hp || p === L.kn || p === L.an)) return k;
      }
    }
    return 'torso';
  }
  /** A pointer takes one part (an arm, a leg, the head) at a world point: that part goes where it is pulled, within
   *  reach, and the body follows a beat later on its spring. The torso is the whole-body push (pushDrag). */
  grab(part, worldPoint) {
    const A = this[part];
    let anchor = null;
    if (part === 'armL' || part === 'armR') anchor = A.wr.getWorldPosition(new THREE.Vector3());
    else if (part === 'legL' || part === 'legR') anchor = A.an.getWorldPosition(new THREE.Vector3());
    else if (part === 'head') anchor = this.head.getWorldPosition(new THREE.Vector3());
    if (!anchor) return false;
    this.grabS = { part, on: true, k: (this.grabS && this.grabS.part === part ? this.grabS.k : 0), p0: worldPoint.clone(), d: new THREE.Vector3(), anchor };
    return true;
  }
  grabTo(worldPoint) {
    const G = this.grabS;
    if (!G || !G.on) return;
    G.d.subVectors(worldPoint, G.p0);
    if (G.d.length() > 0.45) G.d.setLength(0.45); // within reach
    // the body follows: a share of the pull goes to the whole-body spring (it lags, then settles)
    this.pushDrag(this._v.copy(G.d).multiplyScalar(G.part === 'head' ? 0.16 : G.part.startsWith('leg') ? 0.2 : 0.3));
  }
  grabRelease() {
    if (this.grabS) this.grabS.on = false;
    this.pushRelease();
  }
  /** The held part, after the pose is eased (and before the desk guard, which still has the last word). */
  _grabStep(dt) {
    const G = this.grabS;
    if (!G) return;
    G.k = damp(G.k, G.on ? 1 : 0, G.on ? 14 : 5, dt);
    if (!G.on && G.k < 0.01) { this.grabS = null; return; }
    const p = this.pose, k = G.k;
    this.root.updateMatrixWorld(true);
    if (G.part === 'armL' || G.part === 'armR') {
      const side = G.part === 'armL' ? 1 : -1;
      const T = this.root.worldToLocal(this._t1.copy(G.anchor).add(G.d));
      const s = this.solveArm(side, T, p);
      const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx'] : ['shRx', 'shRz', 'elRx', 'wrRx'];
      const keep = p[K[0]] + p[K[2]] + p[K[3]];
      p[K[0]] = lerp(p[K[0]], s.sx, k); p[K[1]] = lerp(p[K[1]], s.sz, k); p[K[2]] = lerp(p[K[2]], s.el, k);
      p[K[3]] = lerp(p[K[3]], keep - p[K[0]] - p[K[2]], k);
    } else if ((G.part === 'legL' || G.part === 'legR') && this.base === 'legs') {
      const L = G.part === 'legL';
      const A = this.root.worldToLocal(this._t1.copy(G.anchor).add(G.d));
      const seatedHere = SEATED_MODES.has(this.mode);
      // clamps: the foot stays on or over the floor; seated at a desk it stays in the knee room (under the top, ahead of the chair)
      const floorY = DIM.ankle - this.root.position.y;
      const atDesk = seatedHere && this._deskF;
      A.y = clamp(A.y, floorY, atDesk ? floorY + 0.1 : seatedHere ? DIM.sitHipY - 0.3 : DIM.standHipY - 0.35); // the knee stays under the desk's top
      if (seatedHere) A.z = clamp(A.z, 0.2, atDesk ? 0.56 : 0.62);
      const sl = this.solveLeg(A.y, A.z, p);
      const hx = L ? 'hipLx' : 'hipRx', kx = L ? 'kneeLx' : 'kneeRx', hz = L ? 'hipLz' : 'hipRz';
      const sideOut = clamp(Math.atan2(A.x - (L ? 1 : -1) * DIM.hipW, Math.max(0.2, p.hipY - A.y)), -0.35, 0.35);
      p[hx] = lerp(p[hx], sl.hip, k); p[kx] = lerp(p[kx], sl.knee, k); p[hz] = lerp(p[hz], (L ? 1 : 1) * sideOut, k);
    } else if (G.part === 'head') {
      const y = this._yawOf(this.root), c = Math.cos(y), sn = Math.sin(y);
      const lx = G.d.x * c - G.d.z * sn, lz = G.d.x * sn + G.d.z * c;
      p.headYaw = lerp(p.headYaw, clamp(lx * 2.6, -0.85, 0.85), k);
      p.headPitch = lerp(p.headPitch, clamp(-G.d.y * 2.4 + lz * 0.8, -0.55, 0.5), k);
      p.headRoll = lerp(p.headRoll, clamp(-lx * 1.4, -0.35, 0.35), k);
    }
  }

  /* ----- choreography API (the incidents drive these) ----- */

  /**
   * side: -1 the robot's left hand, +1 its right. target: a world point for the palm centre, or null to let go.
   * The arm IK takes over from the pose (about 0.1–0.15 s in and out); works standing, walking slowly, crouched, overhead.
   */
  reach(side, target, weight = 1) {
    const s = side < 0 ? 1 : -1; // (the rig's arm sides: +1 is the left arm, at +X)
    const R = this.reachS[s] || (this.reachS[s] = { target: null, local: new THREE.Vector3(), w: 0, has: false });
    if (target) {
      R.target = R.target || new THREE.Vector3();
      R.target.copy(target);
      R.w = clamp(weight, 0, 1);
      R.has = true;
    } else {
      R.target = null;
      R.w = 0;
    }
  }
  /** An Object3D at the palm centre that follows the hand (side -1 left, +1 right): palm(side).attach(prop). */
  palm(side) {
    return side < 0 ? this.armL.palm : this.armR.palm;
  }
  /** Aim the head (or visor) at a world point; null gives it back. */
  lookAt(p) {
    this.lookAtP = p ? (this.lookAtP || new THREE.Vector3()).copy(p) : null;
  }
  /** 0 standing … 1 low enough to lift something off the floor. */
  crouch(k) {
    this.crouchT = clamp(k, 0, 1);
  }
  /** -1 a big wind-up arch back … +1 a hard forward fold; reaches the pose in about a tenth of a second. */
  bend(k) {
    this.bendT = clamp(k, -1, 1);
  }
  /** A short shudder through the shoulders and torso (an impact). */
  recoil() {
    this.recoilT = 0.34;
  }

  /**
   * Small physical habits, a few seconds every so often: a lean back, a look
   * round, a roll of the shoulders, a swivel, a nod, a stretch when idle. While
   * typing only the body moves; the IK keeps the hands on the keys.
   */
  habits(g, dt, typing) {
    if (REDUCED_MOTION || ['walk', 'run', 'carry', 'wave', 'lift', 'slam', 'upset'].includes(this.mode)) return;
    this._actIn = (this._actIn == null ? rand(3, 10) : this._actIn) - dt;
    if (!this.act && this._actIn <= 0) {
      const m = this.mode;
      const opts = typing ? ['lean', 'look', 'shoulders', 'swivel', 'nod', 'look']
        : m === 'think' ? ['look', 'lean', 'swivel', 'shoulders']
        : m === 'idle' || m === 'done' || m === 'paused' ? ['stretch', 'look', 'swivel', 'lean']
        : m === 'stand' || m === 'look' ? ['look', 'shoulders']
        : ['look', 'lean', 'nod'];
      const kind = pick(opts);
      this.act = { kind, t: 0, dur: kind === 'stretch' ? rand(3.6, 4.6) : rand(1.8, 3.4), dir: Math.random() < 0.5 ? -1 : 1 };
      this._actIn = rand(6, 14);
    }
    const a = this.act;
    if (!a) return;
    a.t += dt;
    const k = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI) ** 2; // (squared: the habit starts and ends at rest, no kick)
    switch (a.kind) {
      case 'lean': g.lean -= 0.1 * k; g.headPitch -= 0.06 * k; break;
      case 'look': g.headYaw += a.dir * 0.6 * k; g.headPitch -= 0.05 * k; g.twist += a.dir * 0.06 * k; break;
      case 'shoulders': g.headRoll += Math.sin(a.t * 3.4) * 0.1 * k; g.twist += Math.sin(a.t * 2) * 0.05 * k; break;
      case 'swivel': g.twist += a.dir * 0.16 * k; g.headYaw += a.dir * 0.12 * k; break;
      case 'nod': g.headPitch += Math.sin(a.t * 6.5) * 0.09 * k; break;
      case 'stretch':
        if (!typing && SEATED_MODES.has(this.mode)) {
          // arms up in a wide V: the hands go above the head and out past its sides (and any headwear), so no part
          // of the arm passes through it on the way up or down. 9.2: they come up close in front of the chest first
          // (out of the lap, clear of the desk's edge) and only then rise, and come down the same way
          g.lean -= 0.12 * k; g.headPitch -= 0.14 * k;
          const B = this.headBox, cz = (B.min.z + B.max.z) / 2 - 0.02;
          const k1 = smooth(0, 0.45, k), k2 = smooth(0.3, 1, k);
          for (const side of [1, -1]) {
            const x = side * (Math.max(side > 0 ? B.max.x : -B.min.x, this.shoulderX) + 0.13);
            const top = this._headToRoot(g, x, B.max.y + 0.14, cz, this._t2, 0);
            const chest = this._t1.set(side * (this.shoulderX + 0.02), g.hipY + this.shoulderY - 0.12, 0.2);
            const s = this.solveArm(side, chest.lerp(top, k2), g, 0.05);
            const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
            g[K[0]] = lerp(g[K[0]], s.sx, k1); g[K[1]] = lerp(g[K[1]], s.sz, k1); g[K[2]] = lerp(g[K[2]], s.el, k1);
            g[K[3]] = lerp(g[K[3]], lerp(-0.3, 0.1, k2), k1); g[K[4]] = lerp(g[K[4]], lerp(0.6, 1, k2), k1); g[K[5]] = lerp(g[K[5]], 0.12, k1);
          }
        }
        break;
      default: break;
    }
    if (a.t >= a.dur) this.act = null;
  }

  /** A point in the head's frame → the root frame, for the goal pose g (the spine's lean and twist, the head's turn). */
  _headToRoot(g, x, y, z, out, yaw = g.headYaw) {
    const e = this._eH || (this._eH = new THREE.Euler());
    out.set(x, y, z).applyEuler(e.set(g.headPitch, yaw, g.headRoll, 'YXZ'));
    out.y += DIM.headPivot;
    out.applyEuler(e.set(g.lean, g.twist, 0, 'XYZ'));
    out.y += g.hipY;
    out.z += g.rootZ;
    return out;
  }

  /** Two-bone arm IK in the spine frame (Euler XYZ on the shoulder, X on the elbow). ext lengthens the forearm (a palm target). */
  solveArm(side, T, g, ext = 0) {
    const py = T.y - g.hipY, pz = T.z - g.rootZ;
    const cl = Math.cos(-g.lean), sl = Math.sin(-g.lean);
    const y1 = py * cl - pz * sl, z1 = py * sl + pz * cl, x1 = T.x;
    const ct = Math.cos(-g.twist), st = Math.sin(-g.twist);
    const x2 = x1 * ct + z1 * st, z2 = -x1 * st + z1 * ct;
    const dx = x2 - side * this.shoulderX, dy = y1 - this.shoulderY, dz = z2;
    const L1 = DIM.upperArm, L2 = DIM.foreArm + ext;
    const D = clamp(Math.hypot(dx, dy, dz), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);
    const e = -Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
    const A = L1 + L2 * Math.cos(e), Bz = -L2 * Math.sin(e);
    const gam = Math.asin(clamp(dx / A, -0.95, 0.95));
    const alpha = Math.atan2(dz, dy) - Math.atan2(Bz, -Math.cos(gam) * A);
    return { sx: alpha, sz: gam, el: e, wr: -HALF_PI - alpha - e - g.lean + 0.32 };
  }

  /**
   * Two-bone arm IK with the elbow sent a chosen way (`pole`, a direction in the spine frame): the shoulder turns on
   * all three axes (the plain solver keeps the upper arm's own turn at zero, so the elbow can only bend forward of
   * the body, and arms reaching behind the head went through it).
   */
  solveArmPole(side, T, pole, g, ext = 0) {
    const V = this._pv || (this._pv = { W: new THREE.Vector3(), w: new THREE.Vector3(), p: new THREE.Vector3(), E: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), e: new THREE.Euler() });
    const py = T.y - g.hipY, pz = T.z - g.rootZ;
    const cl = Math.cos(-g.lean), sl = Math.sin(-g.lean);
    const y1 = py * cl - pz * sl, z1 = py * sl + pz * cl, x1 = T.x;
    const ct = Math.cos(-g.twist), st = Math.sin(-g.twist);
    V.W.set(x1 * ct + z1 * st - side * this.shoulderX, y1 - this.shoulderY, -x1 * st + z1 * ct);
    const L1 = DIM.upperArm, L2 = DIM.foreArm + ext;
    const D = clamp(V.W.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);
    V.W.setLength(D);
    V.w.copy(V.W).normalize();
    // the elbow: on the circle the two bones allow, at the point nearest the pole
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D), r = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
    V.p.copy(pole).addScaledVector(V.w, -pole.dot(V.w));
    if (V.p.lengthSq() < 1e-8) V.p.set(0, 0, 1).addScaledVector(V.w, -V.w.z);
    V.p.normalize();
    V.E.copy(V.w).multiplyScalar(a).addScaledVector(V.p, r);
    // the upper arm's frame: +y back up the bone, +z the way the forearm bends, +x completing them
    V.y.copy(V.E).multiplyScalar(-1 / L1);
    V.z.copy(V.W).sub(V.E).normalize();
    V.z.addScaledVector(V.y, -V.z.dot(V.y));
    if (V.z.lengthSq() < 1e-8) V.z.copy(V.p).addScaledVector(V.y, -V.p.dot(V.y));
    V.z.normalize();
    V.x.crossVectors(V.y, V.z);
    V.e.setFromRotationMatrix(V.m.makeBasis(V.x, V.y, V.z), 'XYZ');
    const e = -Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
    return { sx: V.e.x, sy: V.e.y, sz: V.e.z, el: e };
  }

  /** Two-bone leg IK in the hips frame: thigh and knee angles that put the ankle at (y, z). */
  solveLeg(y, z, g) {
    const dy = y - g.hipY, dz = z - g.rootZ;
    const T = DIM.thigh, S = DIM.shin;
    const D = clamp(Math.hypot(dy, dz), 0.2, T + S - 0.002);
    const kappa = Math.acos(clamp((D * D - T * T - S * S) / (2 * T * S), -1, 1));
    const psi = Math.atan2(dz, -dy);
    const beta = Math.acos(clamp((T * T + D * D - S * S) / (2 * T * D), -1, 1));
    return { hip: -(psi + beta), knee: kappa };
  }

  /* ----- typing: the keyboard, the text, each finger's travel ----- */

  /** A point in the root's parent frame (the desk slot: keys, trackpad) → the root frame. */
  _toRoot(p, out) {
    const r = this.root, y = r.rotation.y, c = Math.cos(y), s = Math.sin(y);
    const dx = p.x - r.position.x, dy = p.y - r.position.y, dz = p.z - r.position.z;
    return out.set(dx * c - dz * s, dy, dx * s + dz * c);
  }

  _typist() {
    const D = this.desk;
    if (!D || !D.kb) return null;
    // the keys: fig.desk.keyboard (in the desk's frame), else its own station's keyboard while it sits there, else a grid round kb
    const own = this.station && this.root.parent === this.station.figureSlot;
    const kbd = D.keyboard || (own && this.station.keyboard) || null;
    const src = kbd && kbd.keys && kbd.keys.length ? kbd : null;
    let T = this.typ;
    if (!T) {
      const V = () => new THREE.Vector3();
      T = this.typ = {
        time: 0, next: 0.35, word: '', wi: 0, burst: 3, prevHand: null, prevKey: null, ready: false,
        fing: { L: [null, null, null, null], R: [null, null, null, null] }, thumbS: { L: null, R: null }, thumb: { L: 0, R: 0 },
        goal: { L: [V(), V(), V(), V()], R: [V(), V(), V(), V()] }, fw: { L: [1, 1, 1, 1], R: [1, 1, 1, 1] },
        drift: { L: V(), R: V() }, driftV: { L: V(), R: V() }, driftT: { L: V(), R: V() }, homeC: { L: V(), R: V() }, pad: null, padK: 0, padNext: rand(10, 24), dt: 1 / 30,
        tip: { L: [0, 1, 2, 3].map(() => ({ p: V(), v: V(), has: false })), R: [0, 1, 2, 3].map(() => ({ p: V(), v: V(), has: false })) },
      };
    }
    const key = src || D.kb;
    if (T.src !== key || (!src && (T.kx !== D.kb.x || T.kz !== D.kb.z || T.ky !== D.kb.y))) {
      const board = src || synthKeyboard(D.kb);
      T.keys = board.keys;
      T.press = src && typeof src.press === 'function' ? i => src.press(i) : null;
      T.map = mapKeys(T.keys);
      T.home = { L: HOME_KEYS.L.map(c => T.map[c]), R: HOME_KEYS.R.map(c => T.map[c]) };
      T.space = T.map[' '];
      T.ready = T.space != null && T.home.L.every(i => i != null) && T.home.R.every(i => i != null);
      if (T.ready)
        for (const H of ['L', 'R']) {
          T.homeC[H].set(0, 0, 0);
          for (const i of T.home[H]) T.homeC[H].add(this._t1.set(T.keys[i].x, T.keys[i].y, T.keys[i].z));
          T.homeC[H].multiplyScalar(0.25);
        }
      T.src = key;
      T.kx = D.kb.x; T.ky = D.kb.y; T.kz = D.kb.z;
    }
    return T.ready ? T : null;
  }

  /** The text: words in bursts, a space after each (the thumb), pauses, a correction now and then, trips to the trackpad. */
  _schedule(T, browse) {
    let guard = 0;
    while (T.time >= T.next && guard++ < 4) {
      if (T.pad && T.time < T.pad.until) {
        T.next = T.pad.until + rand(0.12, 0.3);
        continue;
      }
      if (!T.word) {
        T.word = pick(TYPE_WORDS);
        T.wi = 0;
      }
      if (T.wi < T.word.length) {
        const ch = T.word[T.wi].toUpperCase();
        const fin = FINGER_OF[ch] || ['R', 0];
        // a finger still on its way back from the last key finishes first (9.2: the new stroke used to restart it from
        // its home key mid-move, a visible snap on every double letter and same-finger pair)
        const busy = T.fing[fin[0]][fin[1]];
        if (busy) {
          const left = busy.dur * 0.72 - (T.time - busy.t0);
          if (left > 0) { T.next = T.time + left; continue; }
        }
        T.wi++;
        this._stroke(T, ch, fin);
        let gap = 0.115 + Math.random() * 0.085;
        if (T.prevHand === fin[0]) gap += 0.035;
        if (T.prevKey === ch) gap += 0.05;
        T.prevHand = fin[0];
        T.prevKey = ch;
        T.next = T.time + gap * (browse ? 1.3 : 1);
        if (ch !== '\b' && Math.random() < 0.028 && T.wi < T.word.length) T.word = T.word.slice(0, T.wi) + '\b' + T.word.slice(T.wi - 1); // a slip, put right
      } else {
        const hand = T.prevHand === 'L' ? 'R' : Math.random() < 0.82 ? 'R' : 'L';
        this._stroke(T, ' ', [hand, 4]);
        T.word = '';
        T.prevHand = null;
        if (--T.burst <= 0) {
          T.burst = browse ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 5);
          T.next = T.time + (Math.random() < 0.14 ? rand(1.8, 3.4) : rand(0.35, 1.2));
          if (browse || T.time > T.padNext) {
            const len = browse ? rand(2.4, 5.5) : rand(1.1, 2.4);
            T.pad = { t0: T.next - 0.05, until: T.next + len, ph: Math.random() * 9 };
            T.padNext = T.time + rand(12, 28);
          }
        } else T.next = T.time + 0.1 + Math.random() * 0.06;
      }
    }
  }

  _stroke(T, ch, fin) {
    const [H, f] = fin;
    const idx = ch === ' ' ? T.space : T.map[ch];
    if (idx == null) return;
    if (f === 4) T.thumbS[H] = { key: idx, t0: T.time, dur: 0.2, pressed: false };
    else {
      // from wherever the fingertip is now (its home key, or still on its way back from the last one)
      const at = T.tip[H][f];
      T.fing[H][f] = { key: idx, t0: T.time, dur: 0.2 + Math.random() * 0.06, pressed: false, from: at.has ? at.p.clone() : null };
    }
  }

  /** A fingertip's target (root frame) this frame: resting on its home key, or on its way to, into and back from a key.
   *  9.2: one continuous, minimum-jerk path from where the tip actually is (never a restart from home), a lift and
   *  an arc over the caps on the way, a press that follows the cap down and a short dwell, then an easy return. */
  _tipGoal(T, H, i, drift) {
    const home = T.keys[T.home[H][i]];
    const v = this._t2.set(home.x, home.y + 0.0046, home.z - 0.0035); // resting on the cap (the tip's pad is ~3.6 mm under its point)
    const st = T.fing[H][i];
    if (st) {
      const u = (T.time - st.t0) / st.dur;
      if (u >= 1) T.fing[H][i] = null;
      else {
        const K = T.keys[st.key];
        const tx = K.x, ty = K.y, tz = K.z - 0.002;
        const f0 = st.from || v; // where the stroke began
        let x, y, z, e;
        if (u < 0.42) {
          // out and over: the tip lifts as it leaves, arcs over the caps, and arrives just above the key
          e = minJerk(u / 0.42);
          const hop = Math.min(0.009, 0.004 + Math.hypot(tx - f0.x, tz - f0.z) * 0.12);
          x = lerp(f0.x, tx, e); z = lerp(f0.z, tz, e);
          y = lerp(f0.y, ty + 0.0075, e) + Math.sin(e * Math.PI) * hop;
        } else if (u < 0.6) {
          // the press: down with the cap through its travel (never into it)
          e = minJerk((u - 0.42) / 0.18);
          x = tx; z = tz; y = ty + lerp(0.0075, 0.003, e);
        } else if (u < 0.68) {
          x = tx; z = tz; y = ty + 0.003; // a beat on the bottomed key
        } else {
          // the release and the way home, the cap pushing the tip up first
          e = minJerk((u - 0.68) / 0.32);
          x = lerp(tx, v.x, e); z = lerp(tz, v.z, e);
          y = lerp(ty + 0.003, v.y, e) + Math.sin(e * Math.PI) * 0.005;
        }
        if (!st.pressed && u >= 0.52) {
          st.pressed = true;
          if (T.press) T.press(st.key);
          this.strikeT[H] = 0.09;
        }
        const env = Math.sin(clamp(u, 0, 1) * Math.PI) ** 2;
        drift.x += (K.x - home.x) * 0.32 * env;
        drift.z += (K.z - home.z) * 0.32 * env;
        drift.y += 0.0022 * env;
        v.set(x, y, z);
      }
    }
    // the right hand visits the trackpad: the index draws on it, the other fingers rest on it beside it
    if (H === 'R' && T.padK > 0.001) {
      const pd = this.desk.pad, ph = T.pad ? T.pad.ph : 0;
      const lift = i === 0 ? 0.0058 : 0.0066;
      v.lerp(this._t1.set(pd.x + Math.sin(T.time * 1.6 + ph) * 0.013 - 0.0185 * i, pd.y + lift, pd.z - 0.006 - 0.005 * i + Math.cos(T.time * 1.15 + ph) * 0.01), T.padK);
    }
    T.fw[H][i] = 1;
    // a fast spring takes out what is left of any corner (a stroke cut short, the trackpad blend) without lag you can see
    const tp = T.tip[H][i];
    if (!tp.has) { tp.p.copy(v); tp.v.set(0, 0, 0); tp.has = true; }
    else {
      const S = this._sp, w = 55, dt = T.dt;
      for (const c of ['x', 'y', 'z']) { S.x = tp.p[c]; S.v = tp.v[c]; tp.p[c] = springStep(S, v[c], w, dt); tp.v[c] = S.v; }
    }
    this._toRoot(tp.p, T.goal[H][i]);
  }

  _thumbGoal(T, H) {
    const st = T.thumbS[H];
    let k = 0;
    if (st) {
      const u = (T.time - st.t0) / st.dur;
      if (u >= 1) T.thumbS[H] = null;
      else {
        k = Math.sin(u * Math.PI);
        if (!st.pressed && u >= 0.5) {
          st.pressed = true;
          if (T.press) T.press(st.key);
          this.strikeT[H] = 0.09;
        }
      }
    }
    T.thumb[H] = k;
  }

  /** The arms' goal while typing: each wrist over its home keys, drifting toward the keys being struck (or to the trackpad). */
  _typeGoal(g, t, dt) {
    const T = this._typist();
    if (!T) return false;
    T.time += dt;
    T.dt = dt;
    const browse = this.mode === 'browse';
    this._schedule(T, browse);
    let padK = 0;
    if (T.pad) {
      const u = (T.time - T.pad.t0) / (T.pad.until - T.pad.t0);
      if (u >= 1.2) T.pad = null;
      else padK = smooth(0, 0.14, u) * smooth(1.08, 0.94, u);
    }
    T.padK = padK;
    for (const H of ['L', 'R']) {
      const side = H === 'L' ? 1 : -1;
      const drift = T.driftT[H].set(0, 0, 0);
      for (let i = 0; i < 4; i++) this._tipGoal(T, H, i, drift);
      this._thumbGoal(T, H);
      // the hand follows its fingers on a softer spring: it leans toward the key, it does not jump to it
      for (const c of ['x', 'y', 'z']) { const S = this._sp; S.x = T.drift[H][c]; S.v = T.driftV[H][c]; T.drift[H][c] = springStep(S, drift[c], 22, dt); T.driftV[H][c] = S.v; }
      const a = this._v.copy(T.homeC[H]).add(T.drift[H]);
      a.x += side * HAND_OUT[H]; // the hand over its own four keys (9.2: it sat ~3 cm in, every finger splayed to its limit)
      a.y += TYPE_WRIST.y;
      a.z -= TYPE_WRIST.z;
      if (H === 'R' && padK > 0.001) {
        const pd = this.desk.pad, ph = T.pad ? T.pad.ph : 0;
        a.lerp(this._w.set(pd.x - 0.004 + Math.sin(T.time * 1.6 + ph) * 0.01, pd.y + 0.05, pd.z - 0.112 + Math.cos(T.time * 1.15 + ph) * 0.008), padK);
      }
      const s = this.solveArm(side, this._toRoot(a, this._w), g);
      const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'fingL', 'prL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'fingR', 'prR'];
      g[K[0]] = s.sx; g[K[1]] = s.sz; g[K[2]] = s.el; g[K[3]] = s.wr - 0.05;
      g[K[4]] = 0.45;
      g[K[5]] = 0.05;
    }
    return true;
  }

  /** A finger's angles (abduction phi, knuckle a, middle joint b; the end joint follows) that put its tip at a root-frame point. */
  _fingerIK(arm, F, goal) {
    const P = this._t1.copy(goal).applyMatrix4(this.root.matrixWorld).applyMatrix4(arm.inv);
    const dx = P.x - F.base.x, dy = P.y - F.base.y, dz = P.z - F.base.z;
    const phi = clamp(Math.atan2(dx, -dy), -0.42, 0.42);
    const u = dx * Math.sin(phi) - dy * Math.cos(phi), w = -dz;
    const L1 = F.L1, L2 = F.L2, L3 = F.L3, k1 = 1 + KAPPA;
    const reach = b => Math.hypot(L1 + L2 * Math.cos(b) + L3 * Math.cos(b * k1), L2 * Math.sin(b) + L3 * Math.sin(b * k1));
    const d = Math.hypot(u, w);
    let lo = 0, hi = 2.0;
    if (d >= reach(0)) hi = 0;
    else
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        if (reach(m) > d) lo = m;
        else hi = m;
      }
    const b = (lo + hi) / 2;
    const ex = L1 + L2 * Math.cos(b) + L3 * Math.cos(b * k1), ey = L2 * Math.sin(b) + L3 * Math.sin(b * k1);
    return { a: clamp(Math.atan2(w, u) - Math.atan2(ey, ex), -0.45, 1.6), b, phi };
  }

  /** The fingers: the pose's curl (and spread), or, while typing, each finger solved onto its key. */
  _hands(t) {
    const p = this.pose, T = this.typ, tk = this.typK;
    const useIK = tk > 0.01 && T && T.ready;
    if (useIK) this.root.updateMatrixWorld(true);
    for (const arm of [this.armL, this.armR]) {
      const H = arm.side > 0 ? 'L' : 'R';
      const curl = clamp(arm.side > 0 ? p.fingL : p.fingR, -0.2, 1.2), sp = this.spread[H];
      const c = curl * (1 - sp);
      if (useIK) arm.inv.copy(arm.tw.matrixWorld).invert();
      for (let i = 0; i < 4; i++) {
        const F = arm.f[i];
        let a = c * 0.85, b = c * 0.66, d = c * 0.5, phi = arm.side * (i - 1.5) * 0.13 * sp;
        const wIK = useIK ? tk * T.fw[H][i] : 0;
        if (wIK > 0.001) {
          const s = this._fingerIK(arm, F, T.goal[H][i]);
          a = lerp(a, s.a, wIK); b = lerp(b, s.b, wIK); d = lerp(d, s.b * KAPPA, wIK); phi = lerp(phi, s.phi, wIK);
        }
        if (this._deskF) {
          const k = this._tipClear(arm, F, a, b, d, phi);
          if (k !== 1) { a *= k; b *= k; d *= k; }
        }
        F.mcp.rotation.set(a, 0, phi);
        F.pip.rotation.x = b;
        F.dip.rotation.x = d;
      }
      const tp = useIK ? T.thumb[H] * tk : 0, tr = useIK ? tk : 0;
      // (typing, the thumbs swing in less and hang over the space bar, rather than reaching across to meet each other)
      const trx = lerp(0.25 + c * 0.35, 0.28, tr) + tp * 0.4, trz = -arm.side * (lerp(0.62, 0.34, tr) + 0.35 * sp - tp * 0.1), tip = lerp(c * 0.6, 0.3, tr) + tp * 0.4;
      arm.thumb.rotation.set(trx, 0, trz);
      arm.thumbIP.rotation.x = tip;
      if (this._deskF) this._thumbClear(arm, trx, trz, tip);
    }
  }

  /* ----- the desk is solid: no forearm, wrist or hand passes into its top or what stands on it ----- */

  /** A fingertip's point (the end of its last segment) in the desk's frame, for the angles given. */
  _tipAt(arm, F, a, b, d, phi, out, upto = 3) {
    // upto 1: the middle joint; 2: the end joint; 3: the tip
    const y2 = upto > 2 ? -F.L2 - F.L3 * Math.cos(d) : upto > 1 ? -F.L2 : 0, z2 = upto > 2 ? -F.L3 * Math.sin(d) : 0;
    const y1 = -F.L1 + y2 * Math.cos(b) - z2 * Math.sin(b), z1 = y2 * Math.sin(b) + z2 * Math.cos(b);
    const y0 = y1 * Math.cos(a) - z1 * Math.sin(a), z0 = y1 * Math.sin(a) + z1 * Math.cos(a);
    return out.set(F.base.x - y0 * Math.sin(phi), F.base.y + y0 * Math.cos(phi), F.base.z + z0).applyMatrix4(arm.tw.matrixWorld).applyMatrix4(this._pinv);
  }
  /** The desk (or table) in the root's parent frame: near edge, top, underside, half-width, the keyboard and the trackpad. */
  _deskFrame() {
    const D = this.desk;
    if (!D || !D.kb) return null;
    const e = D.edge || null;
    const top = e ? e.y : D.kb.y - 0.0143;
    return { z: e ? e.z : D.kb.z - 0.22, top, under: top - (e && e.thick ? e.thick : 0.034), hw: e && e.w ? e.w / 2 : 0.7, kb: D.kb, pad: D.pad };
  }
  /** What a point over the desk must clear: the key caps over the keyboard, the trackpad, the felt elsewhere. */
  _deskTopAt(F, x, z) {
    const kb = F.kb, pd = F.pad;
    if (Math.abs(x - kb.x) < 0.175 && Math.abs(z - kb.z) < 0.08) return kb.y + 0.0025;
    if (pd && Math.abs(x - pd.x) < 0.09 && Math.abs(z - pd.z) < 0.065) return pd.y + 0.0035;
    return F.top + 0.0035;
  }
  /** The clearance of a point with a pad of radius R under it: positive when clear. In front of the desk's edge, or under
   *  its slab (the knees' room), anything goes; over the desk: above the cap under it (less a pressed cap's travel), the
   *  trackpad, the felt, the oak. */
  _tipGap(F, q, R) {
    if (Math.abs(q.x) > F.hw + R || q.z < F.z - R) return 1;
    if (q.y < F.under - R) return 1;
    const kb = F.kb, pd = F.pad;
    let floor;
    if (Math.abs(q.x - kb.x) < 0.168 && Math.abs(q.z - kb.z) < 0.074) {
      const T = this.typ;
      let y = kb.y;
      if (T && T.keys) {
        let best = Infinity;
        for (const k of T.keys) {
          const dd = Math.max(Math.abs(q.x - k.x) - k.w / 2, 0) + Math.max(Math.abs(q.z - k.z) - k.d / 2, 0);
          if (dd < best) { best = dd; y = k.y; }
        }
      }
      floor = y - 0.0018;
    } else if (pd && Math.abs(q.x - pd.x) < 0.082 && Math.abs(q.z - pd.z) < 0.059) floor = pd.y + 0.003 * ((q.z - pd.z) / 0.0575);
    else floor = F.top + 0.003;
    return q.y - (floor + R);
  }
  /** The largest share of a finger's curl (0 straight … 1 as posed, up to 1.5 curled tighter) that keeps its tip clear. */
  _tipClear(arm, F, a, b, d, phi) {
    const DF = this._deskF, q = this._gq[6];
    const gap = k => Math.min(
      this._tipGap(DF, this._tipAt(arm, F, a * k, b * k, d * k, phi, q, 1), 0.0085),
      this._tipGap(DF, this._tipAt(arm, F, a * k, b * k, d * k, phi, q, 2), 0.0075),
      this._tipGap(DF, this._tipAt(arm, F, a * k, b * k, d * k, phi, q, 3), 0.0045)
    );
    const g1 = gap(1);
    if (g1 >= 0) return 1;
    const bis = (lo, hi) => {
      for (let i = 0; i < 7; i++) {
        const m = (lo + hi) / 2;
        if (gap(m) >= 0) lo = m;
        else hi = m;
      }
      return lo;
    };
    const g2 = gap(1.5);
    if (g2 >= 0) return bis(1.5, 1);
    const g0 = gap(0);
    if (g0 >= 0) return bis(0, 1);
    return g0 >= g2 ? (g0 > g1 ? 0 : 1) : g2 > g1 ? 1.5 : 1;
  }
  /** The thumb, the same way: flexion eased (or let out) until its tip clears what is under it. */
  _thumbClear(arm, rx, rz, ipx) {
    const DF = this._deskF, q = this._gq[6], th = arm.thumb, ip = arm.thumbIP;
    const gap = k => {
      th.rotation.set(rx * k, 0, rz);
      ip.rotation.x = ipx * k;
      th.updateMatrixWorld(true);
      q.set(0, -0.027, 0).applyMatrix4(ip.matrixWorld).applyMatrix4(this._pinv);
      return this._tipGap(DF, q, 0.0098);
    };
    if (gap(1) >= 0) return;
    let lo = -0.6, hi = 1;
    if (gap(lo) < 0) { gap(1); return; }
    for (let i = 0; i < 7; i++) {
      const m = (lo + hi) / 2;
      if (gap(m) >= 0) lo = m;
      else hi = m;
    }
    gap(lo);
  }
  /** After the pose is set, every frame at a desk or a table: an arm point (elbow, forearm, wrist, palm, knuckles, fingers)
   *  inside the top or what stands on it is lifted over it, drawn back in front of its edge, or (a hand low at the edge)
   *  let down under it, whichever is the least move, and the arm is solved again from where the body is. So no pose, habit,
   *  hover, push, reach or sit-down/stand-up blend passes a limb through the desk. */
  _deskGuard() {
    const parent = this.root.parent;
    this._deskF = null;
    if (!parent || !parent.userData || !parent.userData.isSlot) return;
    const F = (this._deskF = this._deskFrame());
    if (!F) return;
    this.root.updateMatrixWorld(true);
    this._pinv.copy(parent.matrixWorld).invert();
    const p = this.pose, LK = this.LK || 1, Q = this._gq, inv = this._pinv;
    const loose = (this.typK || 0) < 0.5; // fingers not on keys: they count too
    const G = this._gd || (this._gd = { 1: { R: new THREE.Vector3(), dir: null, W0: new THREE.Vector3() }, '-1': { R: new THREE.Vector3(), dir: null, W0: new THREE.Vector3() } });
    const relK = Math.exp(-12 * this._gdt);
    let moved = 0;
    for (const arm of [this.armL, this.armR]) {
      const A = G[arm.side], L = arm.side > 0;
      const keep = L ? p.shLx + p.elLx + p.wrLx : p.shRx + p.elRx + p.wrRx; // the hand keeps its pitch
      arm.wr.getWorldPosition(A.W0).applyMatrix4(inv);
      let T = null, chose = null;
      for (let iter = 0; iter < 4; iter++) {
        const E = arm.el.getWorldPosition(Q[0]).applyMatrix4(inv);
        const W = arm.wr.getWorldPosition(Q[1]).applyMatrix4(inv);
        const S = [];
        for (const t of [0, 0.3, 0.55, 0.8]) S.push([Q[2].copy(E).lerp(W, t).clone(), (0.045 - 0.009 * t) * LK * 1.05 + 0.004, Math.max(t, 0.15)]);
        S.push([W.clone(), 0.032, 1]);
        S.push([arm.palm.getWorldPosition(Q[3]).applyMatrix4(inv).clone(), 0.017, 1.15]);
        for (const i of [0, 3]) {
          S.push([arm.f[i].mcp.getWorldPosition(Q[4]).applyMatrix4(inv).clone(), 0.0105, 1.3]);
          if (loose) S.push([arm.f[i].dip.getWorldPosition(Q[5]).applyMatrix4(inv).clone(), 0.009, 1.45]);
        }
        S.push([Q[6].set(0, -0.027, 0).applyMatrix4(arm.thumbIP.matrixWorld).applyMatrix4(inv).clone(), 0.0098, 1.35]); // the thumb
        // the fingers as they stand (middle and end joints, tips): measured against the caps, trackpad and felt themselves
        const FS = [];
        // the palm's four corners (a rolled hand drops one edge well below its centre)
        for (const cx of [-0.45, 0.45]) for (const cy of [-0.022, -HAND.palmL + 0.012]) FS.push([Q[5].set(cx * HAND.palmW, cy, 0).applyMatrix4(arm.tw.matrixWorld).applyMatrix4(inv).clone(), 0.0125, 1.2]);
        // (typing, the fingers are solved onto their keys after this and each is kept clear of the caps there: checking
        // last frame's fingers against this frame's wrist lifted the hand one frame and dropped it the next)
        if (loose) for (const Fi of arm.f) {
          const a = Fi.mcp.rotation.x, b = Fi.pip.rotation.x, d = Fi.dip.rotation.x, phi = Fi.mcp.rotation.z;
          FS.push([this._tipAt(arm, Fi, a, b, d, phi, new THREE.Vector3(), 1), 0.0085, 1.35]);
          FS.push([this._tipAt(arm, Fi, a, b, d, phi, new THREE.Vector3(), 2), 0.0075, 1.45]);
          FS.push([this._tipAt(arm, Fi, a, b, d, phi, new THREE.Vector3(), 3), 0.0045, 1.55]);
        }
        let up = 0, down = 0, back = 0, any = false, downOK = true;
        for (const [q, r, lever] of S) {
          if (Math.abs(q.x) > F.hw + r || q.z < F.z - r) continue;
          const topQ = this._deskTopAt(F, q.x, q.z);
          if (q.y - r >= topQ || q.y + r <= F.under) continue; // over everything, or under the slab (the knees' room)
          any = true;
          up = Math.max(up, (topQ + r - q.y) / lever);
          back = Math.max(back, q.z - (F.z - r));
          down = Math.max(down, (q.y + r - F.under) / lever);
          if (q.y > F.under + 0.012) downOK = false;
        }
        for (const [q, r, lever] of FS) {
          const gp = this._tipGap(F, q, r);
          if (gp >= 0) continue;
          any = true;
          downOK = false;
          up = Math.max(up, -gp / lever);
          back = Math.max(back, q.z - (F.z - r));
        }
        if (!any) break;
        // the least move: over the top, back in front of the edge, or (a hand low at the edge) down under it. The way
        // chosen last frame is kept unless another is clearly shorter (9.2: the choice flipped between frames and the
        // hand jittered between two places, the right hand at the keys most of all)
        T = this._t1.copy(W);
        const cBack = back * 1.15, cDown = downOK ? down * 1.25 : Infinity;
        const cost = { back: cBack, down: cDown, up };
        let dir = iter >= 2 ? 'back' : cBack <= up && cBack <= cDown ? 'back' : cDown < up ? 'down' : 'up'; // (lifting did not reach: draw back)
        if (iter < 2 && A.dir && A.dir !== dir && cost[A.dir] < cost[dir] * 1.6 + 0.004) dir = A.dir;
        if ((A.dir === 'up' && dir === 'down') || (A.dir === 'down' && dir === 'up')) dir = 'back'; // round the edge, not through it
        chose = chose || dir;
        if (dir === 'back') T.z -= back + 0.005;
        else if (dir === 'down') T.y -= down + 0.005;
        else T.y += up + 0.005;
        this._guardSolve(arm, T, p, keep);
        moved++;
      }
      // the correction never feeds back into the pose (that loop made it oscillate); as the need for it passes, the
      // hand eases back rather than dropping in one frame. The eased remainder only ever lifts the hand or draws it
      // toward the body, so it never puts the hand into the desk.
      const full = A.R;
      if (T) full.subVectors(T, A.W0); else full.set(0, 0, 0);
      const held = A.held || (A.held = new THREE.Vector3()); // last frame's correction
      const out = this._t1.copy(full);
      // what is left of last frame's lift or draw-back eases away (only ever up, or toward the body)
      const rest = this._t2.copy(held).multiplyScalar(relK);
      if (A.dir !== 'down' && chose !== 'down' && rest.y > out.y && out.y >= 0) out.y = rest.y;
      if (rest.z < out.z && out.z <= 0) out.z = rest.z;
      // and the correction itself changes no faster than a hand moves (a big one arriving at once, or a change of
      // way round the edge, is a few frames' move instead of a jump)
      const step = this._v.subVectors(out, held), lim = (step.dot(held) >= 0 ? 3.2 : 1.6) * this._gdt; // (growing: quicker, so it never trails into the desk; turning: gentler)
      if (step.length() > lim) out.copy(held).add(step.setLength(lim));
      held.copy(out);
      if (chose) A.dir = chose; else if (held.lengthSq() < 1e-6) A.dir = null;
      if (out.distanceToSquared(full) > 1e-8) this._guardSolve(arm, this._w.copy(out).add(A.W0), p, keep);
    }
    this.guardMoves = moved;
  }
  /** The desk guard's arm: the wrist to T (desk frame), the hand keeping its pitch; written to the bones only. */
  _guardSolve(arm, T, p, keep) {
    const s = this.solveArm(arm.side, this._toRoot(T, this._t2), p);
    arm.sh.rotation.set(s.sx, 0, s.sz);
    arm.el.rotation.x = s.el;
    arm.wr.rotation.x = keep - s.sx - s.el;
    arm.sh.updateMatrixWorld(true);
  }

  /* ----- push and pull ----- */

  _yawOf(o) {
    o.getWorldQuaternion(this._q);
    this._e.setFromQuaternion(this._q, 'YXZ');
    return this._e.y;
  }

  /** The spring that carries a push or a pull: rock in the bot's own frame; at its desk, roll and swivel with the chair. */
  _pushStep(dt, slotSeated) {
    const P = this.push;
    let tx = 0, tz = 0, ty = 0, tp = 0, tr = 0;
    if (P.held) {
      const y = this._yawOf(this.root), c = Math.cos(y), s = Math.sin(y);
      const lx = P.w.x * c - P.w.z * s, lz = P.w.x * s + P.w.z * c;
      tp = clamp(lz * 1.1, -0.17, 0.17);
      tr = clamp(-lx * 1.1, -0.15, 0.15);
      if (slotSeated && this.station && this.root.parent === this.station.figureSlot) {
        const py = this._yawOf(this.root.parent), pc = Math.cos(py), ps = Math.sin(py);
        const sx = P.w.x * pc - P.w.z * ps, sz = P.w.x * ps + P.w.z * pc;
        const L = this.base === 'legs' ? PUSH_LIM.legs : PUSH_LIM.free;
        tx = clamp(sx * 0.9, -L.x, L.x);
        tz = clamp(sz * 0.9, L.z0, L.z1);
        ty = clamp(-sx * 1.5, -L.yaw, L.yaw);
        tp *= 0.4;
        tr *= 0.4;
      }
    }
    const h = Math.min(dt, 0.05), k = 70, c = 10.5;
    const step = (key, target) => {
      P.v[key] += (-k * (P[key] - target) - c * P.v[key]) * h;
      P[key] += P.v[key] * h;
    };
    step('x', tx); step('z', tz); step('yaw', ty); step('rp', tp); step('rr', tr);
    // never past the limits, even mid-spring
    const L = this.base === 'legs' ? PUSH_LIM.legs : PUSH_LIM.free;
    P.x = clamp(P.x, -L.x, L.x);
    P.z = clamp(P.z, L.z0, L.z1);
    P.yaw = clamp(P.yaw, -L.yaw, L.yaw);
    P.mag = Math.hypot(P.x, P.z) + Math.abs(P.yaw) * 0.3 + Math.abs(P.rp) + Math.abs(P.rr) + (P.held ? 0.05 : 0);
    return P;
  }

  /** How far the root has rolled forward (wheels, treads) and how fast (a ball bot's lean). */
  _sense(dt) {
    this.root.getWorldPosition(this._wp);
    if (!this._lp) {
      this._lp = this._wp.clone();
      return;
    }
    const dx = this._wp.x - this._lp.x, dz = this._wp.z - this._lp.z;
    this._lp.copy(this._wp);
    const y = this._yawOf(this.root);
    let d = dx * Math.sin(y) + dz * Math.cos(y);
    if (Math.abs(d) > 0.35) d = 0; // re-seated, not rolled
    this.dist += d;
    this.vel = damp(this.vel, dt > 1e-4 ? d / dt : 0, 5, dt);
  }

  update(dt, t) {
    this.modeT += dt;
    const mode = this.mode;
    const fn = POSES[mode] || POSES.type;
    const g = this.goal;
    fn(g, t, this.phase, this.walkPhase);
    const parent = this.root.parent;
    const atHome = !!(parent && parent.userData && parent.userData.isSlot);
    const seated = SEATED_MODES.has(mode);
    const moving = mode === 'walk' || mode === 'run' || mode === 'carry';
    const legs = this.base === 'legs';
    const H = this.hov;
    H.k = damp(H.k, H.on ? 1 : 0, H.on ? 6 : 3.5, dt);
    if (H.on) H.time += dt;
    const P = this._pushStep(dt, atHome && seated);
    const wantType = atHome && this.desk && (mode === 'type' || mode === 'browse');
    // the hands go to the keys only once the body is down in the seat and in at the desk (not while it is still sitting down)
    const settled = (!legs || this.pose.hipY < DIM.sitHipY + 0.06) && Math.abs(this.root.position.z) < 0.06;
    const typing = wantType && settled && H.k < 0.45 && P.mag < 0.04 && !this.grabS && !this.reachS[1]?.target && !this.reachS[-1]?.target;
    if (atHome && !typing && (mode === 'idle' || mode === 'paused' || mode === 'type' || mode === 'browse')) this._lapHands(g); // (typing set aside: hovered, pushed)
    if (atHome && mode === 'think') {
      // the left forearm across the lap, its hand on the far thigh and clear of the desk's edge (9.2: the posed angles
      // left that hand under the edge, so it was pushed out of the desk every time the robot sat back to think)
      const s = this.solveArm(1, this._t2.set(-0.03, g.hipY + (this.base === 'legs' ? 0.09 : 0.065), 0.12), g);
      g.shLx = s.sx; g.shLz = s.sz; g.elLx = s.el; g.wrLx = clamp(-1.1 - g.lean - s.sx - s.el, -1.3, 0.6); g.prL = 0.5; g.fingL = 0.45;
    }
    this.habits(g, dt, typing);
    // changing what it does at the desk (keys, lap, chin, behind the head), the forearms fold up and in for a moment,
    // so the hands travel above and behind the desk's edge rather than through it, the way a person draws them back
    if (atHome && seated && this.modeT < 0.8 && this._modeFrom && SEATED_MODES.has(this._modeFrom)) {
      const env = Math.sin(Math.PI * clamp(this.modeT / 0.8, 0, 1)) ** 2;
      g.elLx -= 0.6 * env; g.elRx -= 0.6 * env;
      g.shLx -= 0.12 * env; g.shRx -= 0.12 * env;
    }
    if (atHome && seated) {
      g.lean = Math.max(g.lean, legs ? -0.12 : -0.16); // the chair's back is right there
      if (legs) g.footZ = Math.min(g.footZ, 0.48);
    }
    this._sense(dt);
    for (const s of ['L', 'R']) {
      this.strikeT[s] = Math.max(0, this.strikeT[s] - dt);
      this.strike[s] = this.strikeT[s] > 0 ? 1 : 0;
    }
    const typed = typing && this._typeGoal(g, t, dt);
    this.typK = damp(this.typK, typed ? 1 : 0, typed ? 10 : 7, dt);
    if (mode === 'meet' && !atHome) {
      // hands rest on the edge of the Forum table (its top is a desk's height above the floor)
      for (const side of [1, -1]) {
        const Tg = this._v.set(side * (0.145 + Math.sin(t * 0.37 + this.phase + side) * 0.008), DESK.top + 0.05 - this.root.position.y, 0.4);
        const s = this.solveArm(side, Tg, g);
        if (side > 0) { g.shLx = s.sx; g.shLz = s.sz; g.elLx = s.el; g.wrLx = s.wr - 0.2; g.prL = 0.1; }
        else { g.shRx = s.sx; g.shRz = s.sz; g.elRx = s.el; g.wrRx = s.wr - 0.2; g.prR = 0.1; }
      }
    }
    if (mode === 'upset') this._upset(g, t);
    // the walking high five: the inner hand rises to the meeting point a beat before, palm out, fingers spread
    const H5 = this.hf;
    const fiveL = H5 && H5.k > 0.01 && H5.side === 'L' ? H5.k : 0, fiveR = H5 && H5.k > 0.01 && H5.side === 'R' ? H5.k : 0;
    if (fiveL || fiveR) {
      const side = fiveL ? 1 : -1, k = fiveL || fiveR;
      const Tg = this.root.worldToLocal(this._v.copy(H5.point));
      Tg.y -= 0.075; // the wrist sits below the palm
      const s = this.solveArm(side, Tg, g);
      const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
      g[K[0]] = lerp(g[K[0]], s.sx, k);
      g[K[1]] = lerp(g[K[1]], s.sz, k);
      g[K[2]] = lerp(g[K[2]], s.el, k);
      g[K[3]] = lerp(g[K[3]], H5.contact ? 0.22 : 0.05, k);
      g[K[4]] = lerp(g[K[4]], -1, k);
      g[K[5]] = lerp(g[K[5]], 0.05, k);
      g.headPitch += H5.contact ? 0.08 : 0;
    }
    this.spread.L = damp(this.spread.L, fiveL ? 1 : 0, 14, dt);
    this.spread.R = damp(this.spread.R, fiveR ? 1 : 0, 14, dt);
    this._attention(g, t, dt, seated, typing, atHome);
    if (atHome && seated && mode === 'done') this._handsBehindHead(g); // (after the head has turned to whatever it is watching)
    // in a seat away from the desk (sofa, armchairs, benches, the Forum table): elbows in, clear of the chair's arms and
    // wraparound backs; on a soft cushion the body rides a touch higher (it sinks in only a little)
    const away = seated && !atHome;
    const soft = away && this.root.position.y < -0.04;
    if (away) {
      g.shLz = Math.min(g.shLz, 0.01);
      g.shRz = Math.max(g.shRz, -0.01);
      if (legs && soft) g.hipY += 0.016;
    }

    // below the waist. Bots without legs keep a working height (a seated biped's), glide a touch higher, perch on seats
    if (!legs) {
      const perch = seated && !atHome;
      this.baseY = damp(this.baseY, perch ? DIM.seatTop + 0.022 + (soft ? 0.02 : 0) + (this.base === 'tracks' ? 0.006 : 0) : 0, 7, dt);
      const BH = BASE_HIPS[this.base];
      let hy = perch ? this.baseY + BH.perch : moving ? BH.move : BH.work;
      if (this.base === 'hover') hy += Math.sin(t * 1.9 + this.phase) * 0.011 + Math.sin(t * 3.3 + this.phase * 1.7) * 0.004;
      g.hipY = hy;
      g.rootZ = 0;
      if (moving) {
        // fewer strides to swing: the arms move less; a ball leans into its speed, a hover body a little
        for (const k of ['shLx', 'shRx']) g[k] *= 0.35;
        g.lean = 0.02 + clamp(this.vel * (this.base === 'ball' ? 0.05 : this.base === 'hover' ? 0.03 : 0.012), -0.1, 0.16);
        g.twist *= 0.3;
      }
    }
    this._actions(g, t, dt, legs);
    // legs: solved onto the floor while seated, and while crouching or bending (the feet stay planted)
    if (legs) {
      const plant = !seated && !moving && (this.crouchK > 0.01 || Math.abs(this.bendK) > 0.01);
      this.tuck = damp(this.tuck || 0, seated && (this.tuckUntil || 0) > performance.now() / 1000 ? 1 : 0, 5, dt);
      if (this.tuck > 0.001) g.footZ = lerp(g.footZ, Math.min(g.footZ, 0.34), this.tuck);
      if (seated || plant) {
        this.root.getWorldPosition(this._w);
        const ankleY = -this._w.y + DIM.ankle;
        const zs = seated ? [g.footZ, g.footZ - 0.02] : [0.05, -0.04];
        for (const [hipK, kneeK, z] of [['hipLx', 'kneeLx', zs[0]], ['hipRx', 'kneeRx', zs[1]]]) {
          const s = this.solveLeg(ankleY, z, g);
          g[hipK] = s.hip;
          g[kneeK] = s.knee;
        }
      }
    }

    if (typeof COORDINATION_GESTURES !== 'undefined') COORDINATION_GESTURES.pose(this,g);

    // ease toward the goal: quick for the hands on keys, the spike, a reach; calmer otherwise
    const fast = this.reachK[1] > 0.02 || this.reachK[-1] > 0.02 || Math.abs(this.bendK - this.bendT) > 0.02 || Math.abs(this.bendK) > 0.05 || this.recoilT > 0;
    const L = fast ? 26 : mode === 'run' ? 18 : fiveL || fiveR ? 20 : moving ? 14 : mode === 'slam' ? 22 : typing ? 18 : this.lambda;
    // every joint rides a critically damped spring (9.2): it gathers speed and settles like a limb, where the old
    // exponential ease started each move at full speed and stopped it dead (seen up close as a jerk at every change
    // of pose, habit or target). Rates are the old ones ×1.8, which settle in about the same time.
    // Away from walking and the quick choreography, each joint also has a top speed a person's would have, so a
    // big change of pose (hands from behind the head to the keys, from the lap up into a stretch) takes most of a
    // second instead of a tenth: the old ease covered half of it in the first frame.
    const S = this._sp, PV = this.poseV, cap = !moving && !fast && mode !== 'run' && mode !== 'slam' && dt > 0;
    for (const k of POSE_KEYS) {
      const lam = k.startsWith('head') && !fast ? 7 : fast && (k === 'lean' || k === 'hipY' || k === 'rootZ') ? 40 : L;
      const x0 = this.pose[k];
      S.x = x0; S.v = PV[k];
      let x = springStep(S, g[k], lam * 1.8, dt);
      if (cap) {
        const vm = JOINT_VMAX[k];
        if (Math.abs(S.v) > vm) S.v = Math.sign(S.v) * vm;
        if (Math.abs(x - x0) > vm * dt) x = x0 + Math.sign(x - x0) * vm * dt;
      }
      this.pose[k] = x;
      PV[k] = S.v;
    }
    const p = this.pose;
    if (REDUCED_MOTION && this._officeStaticPose) for(const key of ['headYaw','headPitch','shLx','shLy','shLz','elLx','wrLx','prL','fingL'])p[key]=g[key];
    this.hips.position.y = p.hipY;
    this.hips.position.z = p.rootZ;
    // a bot without legs tilts as a whole: into its speed, into a bend, under a push
    const tilt = legs ? 0 : clamp(this.vel * (this.base === 'ball' ? 0.06 : this.base === 'hover' ? 0.035 : 0), -0.08, 0.14) + this.bendK * (this.base === 'tracks' ? 0.06 : 0.2) + this.crouchK * 0.1;
    this.hips.rotation.set(tilt + (legs ? 0 : P.rp * 0.5), 0, legs ? 0 : P.rr * 0.5);
    this.spine.rotation.set(p.lean + P.rp * (legs ? 1 : 0.5), p.twist, P.rr * (legs ? 1 : 0.5));
    this.head.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
    for (const [arm, sx, sy, sz, el, wr, pr] of [[this.armL, p.shLx, p.shLy, p.shLz, p.elLx, p.wrLx, p.prL], [this.armR, p.shRx, p.shRy, p.shRz, p.elRx, p.wrRx, p.prR]]) {
      arm.sh.rotation.set(sx, sy, sz);
      arm.el.rotation.x = el;
      arm.wr.rotation.x = wr;
      arm.tw.rotation.y = arm.side * HALF_PI * clamp(pr, -1, 1);
    }
    if (legs) {
      this.legL.hp.rotation.set(p.hipLx, 0, p.hipLz);
      this.legL.kn.rotation.x = p.kneeLx;
      this.legR.hp.rotation.set(p.hipRx, 0, p.hipRz);
      this.legR.kn.rotation.x = p.kneeRx;
      // feet stay level with the floor (a little roll while walking)
      const roll = moving ? 0.25 : 0;
      this.legL.an.rotation.x = -(p.hipLx + p.kneeLx) + roll * Math.sin(this.walkPhase + 0.8);
      this.legR.an.rotation.x = -(p.hipRx + p.kneeRx) + roll * Math.sin(this.walkPhase + 0.8 + Math.PI);
    }
    if (this.grabS) {
      this._grabStep(dt);
      for (const k of POSE_KEYS) this.poseV[k] = 0; // a held limb goes where the hand puts it, and drops no stored speed on release
      const q = this.pose;
      this.head.rotation.set(q.headPitch, q.headYaw, q.headRoll, 'YXZ');
      for (const [arm, sx, sy, sz, el, wr] of [[this.armL, q.shLx, q.shLy, q.shLz, q.elLx, q.wrLx], [this.armR, q.shRx, q.shRy, q.shRz, q.elRx, q.wrRx]]) {
        arm.sh.rotation.set(sx, sy, sz);
        arm.el.rotation.x = el;
        arm.wr.rotation.x = wr;
      }
      if (legs) {
        this.legL.hp.rotation.set(q.hipLx, 0, q.hipLz);
        this.legL.kn.rotation.x = q.kneeLx;
        this.legR.hp.rotation.set(q.hipRx, 0, q.hipRz);
        this.legR.kn.rotation.x = q.kneeRx;
        this.legL.an.rotation.x = -(q.hipLx + q.kneeLx);
        this.legR.an.rotation.x = -(q.hipRx + q.kneeRx);
      }
    }
    this._gdt = dt;
    this._deskGuard();
    this._hands(t);
    this._baseAnim(t, dt);
    // (a robot does not breathe: the torso here is a stand-in)
    this.torso.scale.set(1, 1 + Math.sin(t * 1.6 + this.phase) * 0.004, 1 + Math.sin(t * 1.6 + this.phase) * 0.008);
    // blink
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 0.13;
      this.blinkIn = rand(2.4, 6.5);
    }
    if (this.blink > 0) this.blink -= dt;
    if (this.eyePivot) this.eyePivot.scale.y = damp(this.eyePivot.scale.y, this.blink > 0 ? 0.12 : 1, 40, dt);
    // Every light follows the eyes; the card and nameplate carry the request state.
    const gc = this.glowMat.color;
    for (const m of this.lightMats) m.color.copy(gc);
    if (this.spinner) this.spinner.rotation.z += dt * 0.7;
  }

  /** Seated at the desk with nothing to type: forearms down, hands resting in the lap (clear under the desk's edge). */
  _lapHands(g) {
    const legs = this.base === 'legs';
    for (const side of [1, -1]) {
      const T = this._t2.set(side * (this.shoulderX - 0.07), g.hipY + (legs ? 0.088 : 0.06), legs ? 0.118 : 0.1); // (9.2: 4 cm further back, so the fingertips clear the desk's edge when the hands come up)
      const s = this.solveArm(side, T, g);
      const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
      // the hand lies along the thigh (pointing forward, a little down); without thighs it hangs a little lower
      const aim = legs ? -1.3 : -0.55;
      g[K[0]] = s.sx; g[K[1]] = s.sz; g[K[2]] = s.el; g[K[3]] = clamp(aim - g.lean - s.sx - s.el, -1.3, 0.6); g[K[4]] = 0.35; g[K[5]] = 0.4;
    }
  }
  /** Leaning back, fingers laced behind the head (the head as built, headwear and all), the hands clear above the
   *  chair's back. The head turns only a little in this pose, and the hands turn with it. */
  _handsBehindHead(g) {
    g.headYaw = clamp(g.headYaw, -0.3, 0.3);
    const B = this.headBox, y = (B.min.y + B.max.y) / 2 + 0.03;
    const lift = this.hov.liftT > 0 ? Math.sin(clamp(1 - this.hov.liftT / 1.7, 0, 1) * Math.PI) : 0; // a hover's raised hand
    const Q = this._hbq || (this._hbq = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    // on the way in the hands rise past the sides of the head first, then go round behind it (never through it)
    const u = smooth(0.45, 1.25, this.modeT);
    for (const side of [1, -1]) {
      // the palms on the back of the head, the elbows out wide, a little up and back: the forearms pass behind it
      const back = this._headToRoot(g, side * 0.065, y, B.min.z - 0.045, Q[0]);
      const wide = this._headToRoot(g, side * (Math.max(side > 0 ? B.max.x : -B.min.x, 0.1) + 0.2), y, (B.min.z + B.max.z) / 2 - 0.03, Q[1]);
      const s = this.solveArmPole(side, Q[2].copy(wide).lerp(back, u), Q[3].set(side, 0.5, -0.5), g, 0.04);
      const K = side > 0 ? ['shLx', 'shLy', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRy', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
      const w = side < 0 ? 1 - lift : 1;
      g[K[0]] = lerp(g[K[0]], s.sx, w); g[K[1]] = lerp(g[K[1]], s.sy, w); g[K[2]] = lerp(g[K[2]], s.sz, w); g[K[3]] = lerp(g[K[3]], s.el, w);
      // the hands carry on across behind the head (bent toward it, the fingers would go into it)
      g[K[4]] = lerp(g[K[4]], 0.2, w); g[K[5]] = lerp(g[K[5]], 0.6, w); g[K[6]] = lerp(g[K[6]], 0.5, w);
    }
  }

  /** The frustrated beat after a smash: hands to the head with a shake, then a dismissive drop of one arm. */
  _upset(g, t) {
    const u = this.modeT, cyc = u % 3.2;
    if (cyc < 1.7) {
      const k = smooth(0, 0.3, cyc) * smooth(1.7, 1.45, cyc);
      // the bow and the shake first, then the hands to where the head is going: palms on its sides, just clear of
      // the shell and any headwear (the head shakes inside them, never into them)
      g.headYaw = Math.sin(u * 8.5) * 0.14 * k;
      g.headPitch = 0.22 * k;
      g.lean = lerp(g.lean, 0.18, k);
      const B = this.headBox, y = (B.min.y + B.max.y) / 2 - 0.035, z = (B.min.z + B.max.z) / 2 + 0.01;
      for (const side of [1, -1]) {
        const x = side > 0 ? B.max.x + 0.055 : B.min.x - 0.055;
        const s = this.solveArm(side, this._headToRoot(g, x, y, z, this._t2, 0), g);
        const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
        g[K[0]] = lerp(g[K[0]], s.sx, k); g[K[1]] = lerp(g[K[1]], s.sz, k); g[K[2]] = lerp(g[K[2]], s.el, k);
        g[K[3]] = lerp(g[K[3]], 0.2, k); g[K[4]] = lerp(g[K[4]], 1, k); g[K[5]] = lerp(g[K[5]], 0.25, k);
      }
    } else {
      const v = (cyc - 1.7) / 1.5, k = Math.sin(clamp(v, 0, 1) * Math.PI);
      g.shRx = lerp(g.shRx, -0.5, k * (1 - v)); g.shRz = lerp(g.shRz, -0.55, k); g.elRx = lerp(g.elRx, -0.2, k);
      g.prR = lerp(g.prR, -0.5, k); g.fingR = lerp(g.fingR, 0.1, k);
      g.shLx = lerp(g.shLx, 0.12, k); g.shLz = lerp(g.shLz, 0.16, k); g.elLx = lerp(g.elLx, -0.25, k);
      g.headYaw = lerp(g.headYaw, -0.45, k);
      g.headPitch = lerp(g.headPitch, 0.12, k);
      g.lean = lerp(g.lean, -0.04, k);
      g.twist -= 0.12 * k;
    }
  }

  /** The pointer's attention (lean back, follow it, a nod, a lifted hand), an explicit lookAt, a neighbour, a click. */
  _attention(g, t, dt, seated, typing, atHome) {
    const H = this.hov;
    if (H.k > 0.001) {
      const k = H.k;
      if (seated && this.mode !== 'meet') g.lean = lerp(g.lean, Math.min(g.lean, -0.12), k); // (at the Forum table the hands stay on its edge)
      if (seated && !typing && !atHome && !['sofa', 'review', 'watch', 'meet'].includes(this.mode)) {
        g.shLx = lerp(g.shLx, -0.22, k * 0.6); g.shRx = lerp(g.shRx, -0.22, k * 0.6);
        g.elLx = lerp(g.elLx, -0.95, k * 0.6); g.elRx = lerp(g.elRx, -0.95, k * 0.6);
      }
    }
    if (H.nodT > 0) {
      H.nodT -= dt;
      const u = clamp(1 - H.nodT / 0.8, 0, 1);
      g.headPitch += Math.sin(u * TAU * 2) * 0.07 * Math.sin(u * Math.PI);
    }
    const moving = this.mode === 'walk' || this.mode === 'run' || this.mode === 'carry';
    if (H.on && !H.lifted && H.time > 1.1 && H.k > 0.8 && !moving && !this.hf) {
      H.liftT = 1.7;
      H.lifted = true;
    }
    if (H.liftT > 0) {
      H.liftT -= dt;
      const u = clamp(1 - H.liftT / 1.7, 0, 1), k = Math.sin(u * Math.PI);
      g.shRx = lerp(g.shRx, -1.2, k); g.shRz = lerp(g.shRz, -0.34, k); g.elRx = lerp(g.elRx, -1.6, k);
      g.wrRx = lerp(g.wrRx, 0.15 + Math.sin(t * 8.5) * 0.18, k); g.prR = lerp(g.prR, -0.7, k); g.fingR = lerp(g.fingR, 0.04, k);
    }
    let target = null, w = 0;
    if (this.lookAtP) { target = this.lookAtP; w = 1; }
    else if (H.k > 0.01 && H.has) { target = H.look; w = H.k; }
    else if (this.attend && !typing && this.react.t <= 0) { target = this.attend; w = 0.85; }
    if (target) {
      this.head.getWorldPosition(this._w);
      const local = this.root.worldToLocal(this._v.copy(target));
      const hl = this.root.worldToLocal(this._w);
      const yaw = clamp(Math.atan2(local.x - hl.x, local.z - hl.z), -1.1, 1.1);
      const pitch = clamp(-Math.atan2(local.y - hl.y, Math.hypot(local.x - hl.x, local.z - hl.z)), -0.45, 0.5);
      g.headYaw = lerp(g.headYaw, yaw * 0.85, w);
      g.headPitch = lerp(g.headPitch, pitch, w * 0.75);
      g.twist += yaw * 0.12 * w;
    }
    if (this.react.t > 0) {
      this.react.t -= dt;
      const k = smooth(0, 0.35, this.react.t) * smooth(0, 0.3, 2.2 - this.react.t);
      const cam = camera.position;
      const local = this.root.worldToLocal(this._v.set(cam.x, cam.y, cam.z));
      const yaw = clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
      g.headYaw = lerp(g.headYaw, yaw, k);
      g.headPitch = lerp(g.headPitch, -0.1 + Math.sin(t * 9) * 0.06, k);
      g.headRoll = lerp(g.headRoll, 0.08, k);
    }
  }

  /** reach, crouch, bend and recoil (the choreography API) layered over the pose. */
  _actions(g, t, dt, legs) {
    this.crouchK = damp(this.crouchK, this.crouchT, 9, dt);
    this.bendK = damp(this.bendK, this.bendT, 32, dt);
    const c = this.crouchK, b = this.bendK, fwd = Math.max(0, b), back = Math.min(0, b);
    if (c > 0.001 || Math.abs(b) > 0.001) {
      if (legs) {
        // a deep squat at 1 (hands reach the floor in front), the feet planted by the leg IK below
        g.hipY -= c * 0.58 + fwd * 0.07 - back * 0.02;
        g.rootZ += -fwd * 0.075 - back * 0.03 - c * 0.04;
        g.lean += c * 0.72 + fwd * 0.62 + back * 0.42;
      } else {
        // a hover body sinks toward the floor (and dips hard on a spike); a ball or tracks lower the strut and fold forward
        const dip = this.base === 'hover' ? 0.28 : 0.18;
        g.hipY -= c * dip + fwd * (this.base === 'hover' ? 0.16 : 0.03);
        g.lean += c * 0.58 + fwd * 0.5 + back * 0.36;
      }
      g.headPitch += fwd * 0.22 + back * 0.18 - c * 0.1;
    }
    if (this.recoilT > 0) {
      this.recoilT = Math.max(0, this.recoilT - dt);
      const s = (this.recoilT / 0.34) ** 2;
      g.shLz += Math.sin(t * 57) * 0.08 * s;
      g.shRz -= Math.sin(t * 57 + 0.6) * 0.08 * s;
      g.lean += Math.sin(t * 43) * 0.035 * s;
      g.headRoll += Math.sin(t * 61) * 0.06 * s;
      g.hipY -= 0.012 * s;
    }
    for (const side of [1, -1]) {
      const R = this.reachS[side];
      this.reachK[side] = damp(this.reachK[side], R && R.target ? R.w : 0, 22, dt);
      const k = this.reachK[side];
      if (!R || !R.has) continue;
      if (R.target) this.root.worldToLocal(R.local.copy(R.target));
      if (k < 0.002) continue;
      const s = this.solveArm(side, R.local, g, 0.06);
      const K = side > 0 ? ['shLx', 'shLz', 'elLx', 'wrLx', 'prL', 'fingL'] : ['shRx', 'shRz', 'elRx', 'wrRx', 'prR', 'fingR'];
      g[K[0]] = lerp(g[K[0]], s.sx, k); g[K[1]] = lerp(g[K[1]], s.sz, k); g[K[2]] = lerp(g[K[2]], s.el, k);
      g[K[3]] = lerp(g[K[3]], 0, k); g[K[4]] = lerp(g[K[4]], 1, k); g[K[5]] = lerp(g[K[5]], 0.3, k);
    }
  }

  /** The base: a hover ring and its pool of light, a rolling ball, rolling treads and wheels. */
  _baseAnim(t, dt) {
    if (this.base === 'legs') return;
    this.baseG.position.y = this.baseY;
    if (this.base === 'hover') {
      const tip = this.hips.position.y - 0.248 - this.baseY;
      const gap = Math.max(0.02, tip);
      this.hoverRing.position.y = gap * 0.45;
      const pulse = 1 + Math.sin(t * 3.1 + this.phase) * 0.07;
      this.hoverRing.scale.set(pulse, pulse, 1);
      this.pool.material.opacity = clamp(0.42 - gap * 0.55, 0.1, 0.4) * (0.85 + 0.15 * Math.sin(t * 3.1 + this.phase));
      this.pool.visible = this.baseY < 0.05;
    } else if (this.base === 'ball') this.ball.rotation.x = this.dist / 0.14;
    else this._tracks(this.dist);
  }

  /** Sample points over the body (world space) with a radius each: the collision audit's view of the figure. */
  bodySamples(out = []) {
    const V = (o, x, y, z) => o.localToWorld(new THREE.Vector3(x, y, z));
    const seg = (part, a, b, r0, r1 = r0, n = 4) => {
      for (let i = 0; i <= n; i++) out.push({ part, p: a.clone().lerp(b, i / n), r: lerp(r0, r1, i / n) });
    };
    if (this.base === 'legs') {
      for (const [side, leg] of [['L', this.legL], ['R', this.legR]]) {
        const hip = V(leg.hp, 0, 0, 0), knee = V(leg.kn, 0, 0, 0), ankle = V(leg.an, 0, 0, 0);
        seg('thigh' + side, hip, knee, 0.07, 0.058);
        seg('shin' + side, knee, ankle, 0.054, 0.046);
        seg('foot' + side, V(leg.an, 0, -DIM.ankle + 0.035, -0.05), V(leg.an, 0, -DIM.ankle + 0.03, 0.18), 0.034, 0.03, 4);
        for (const z of [-0.06, 0.066, 0.19]) out.push({ part: 'sole' + side, p: V(leg.an, 0, -DIM.ankle, z), r: 0, sole: true });
      }
    } else if (this.base === 'hover') {
      for (const [y, r] of [[0.02, 0.125], [-0.06, 0.118], [-0.13, 0.095], [-0.2, 0.055]]) out.push({ part: 'skirt', p: V(this.lower, 0, y, 0), r });
    } else if (this.base === 'ball') {
      out.push({ part: 'ball', p: V(this.baseG, 0, 0.14, 0), r: 0.14 });
      out.push({ part: 'collar', p: V(this.baseG, 0, 0.225, 0), r: 0.15 });
      out.push({ part: 'cowl', p: V(this.lower, 0, 0.0, 0), r: 0.11 });
      out.push({ part: 'sole', p: V(this.baseG, 0, 0, 0), r: 0, sole: true });
    } else {
      for (const s of [-1, 1]) for (const z of [-0.12, 0, 0.12]) out.push({ part: 'track', p: V(this.baseG, s * 0.122, 0.07, z), r: 0.07 });
      for (const z of [-0.17, 0.17]) for (const s of [-1, 1]) out.push({ part: 'track', p: V(this.baseG, s * 0.122, 0.07, z), r: 0.05 });
      for (const z of [-0.09, 0.09]) for (const s of [-1, 1]) out.push({ part: 'chassis', p: V(this.baseG, s * 0.05, 0.185, z), r: 0.075 });
      out.push({ part: 'cowl', p: V(this.lower, 0, 0.0, 0), r: 0.12 });
      for (const s of [-1, 1]) for (const z of [-0.12, 0.12]) out.push({ part: 'sole', p: V(this.baseG, s * 0.122, 0, z), r: 0, sole: true });
    }
    for (const y of [0.04, 0.14, 0.24, 0.34, 0.42]) {
      const c = V(this.spine, 0, y, 0);
      out.push({ part: 'torso', p: c, r: 0.06 });
      out.push({ part: 'torso', p: V(this.spine, 0, y, 0.07), r: 0.035 });
      out.push({ part: 'torso', p: V(this.spine, 0, y, -0.065), r: 0.035 });
      out.push({ part: 'torso', p: V(this.spine, 0.1, y, 0), r: 0.04 });
      out.push({ part: 'torso', p: V(this.spine, -0.1, y, 0), r: 0.04 });
    }
    for (const [x, y, z, r] of this.headSamples) out.push({ part: 'head', p: V(this.head, x, y, z), r });
    for (const [side, arm] of [['L', this.armL], ['R', this.armR]]) {
      const sh = V(arm.sh, 0, 0, 0), el = V(arm.el, 0, 0, 0), wr = V(arm.wr, 0, 0, 0);
      seg('upperArm' + side, sh, el, 0.048, 0.043, 3);
      seg('forearm' + side, el, wr, 0.04, 0.034, 3);
      seg('hand' + side, wr, V(arm.tw, 0, -HAND.palmL - 0.05, 0), 0.022, 0.012, 3);
    }
    return out;
  }
}
