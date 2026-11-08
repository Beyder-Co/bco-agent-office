/* =============================================================================
   50 · THE ROOM — a penthouse floor in cutaway, in the language of a flagship store
   -----------------------------------------------------------------------------
   Plan (+X east, +Z toward the owner's view):
     north wall  continuous glass: corner server + HOT LIST | Forum + MAIN SCREEN | Market Room + HOT SHEET
     west wall   white-oak built-in (library, Surfaces samples) | glass | door | glass
     NE          the Market Room behind frameless glass: table, holographic Bergen County, the hot sheet
     centre      two rows of white-oak workstations (ten slots, eight seated)
     SW          lounge round a turning holographic house · SE the study, behind glass (Igor's two personal assistants) · a tree bench up front
   Glass on all four sides (the south is the camera's side: four wide panes); the slab edge reads as a section.
   ============================================================================= */

const ROOM = {
  W: 16, D: 12, H: 3.1,
  x0: -8, x1: 8, z0: -6.2, z1: 5.8, cz: -0.2,
  door: { z0: -0.77, z1: 1.03, zc: 0.13, x: -8 },
  vestibule: { x0: -10.7, x1: -8, z0: -1.65, z1: 1.9 },
  feature: 3.2,
  screen: { x: 0, y: 1.55, z: -6.2 + 0.03, w: 4.4, h: 2.06 }, // the Forum screen: wide, the live feed beside the highlights
  hot: { x: 5.68, y: 1.55, z: -6.2 + 0.03, w: 3.66, h: 2.06 }, // the pipeline, in the Market Room
  logo: { x: -3.93, y: 1.74, w: 1.12 },
  /** The hot list: two large screens stacked on the glass façade (new listings above; under contract and sold below). */
  hotlist: { x: -5.6575, z: -6.2 + 0.03, w: 2.985, h: 1.09, yUp: 2.035, yLo: 0.845 }, // same 94 cm reveal to the Forum jamb as the center display; left edge stays clear of the server
  builtin: { z0: -6.06, z1: -2.3, d: 0.44, h: 2.3, bays: [-4.98, -3.38] },
  /** The server: tucked into the back-left corner, left of the hot list, with its rack face toward the room.
   *  (x, z) is where an agent stands to read it; (cx, cz) is the cabinet. */
  server: { x: -6.59, z: -5.56, cx: -7.60, cz: -5.56, ry: 0 },
  ticker: { y: 2.86, h: 0.4, ring: true }, // the markets band: a closed loop round the top of all four walls
  board: { x0: 3.4, zEdge: -2.85, tx: 5.85, tz: -4.55 },
  forum: { z: -4.35, xs: [-0.95, 0.95] },
  lounge: { x: -5.6, z: 4.55 },
  /** The study: two standard workstations facing the room, on a dark stone inlay in the front-right corner, with a console against
   *  the east glass. seats[] are slots 10 and 11, reserved for Igor's personal assistants; business agents never take them. */
  study: { x: 5.2, z: 4.95, yaw: Math.PI, inlay: { x0: 3.0, x1: 7.75, z0: 3.55, z1: 5.72 }, console: { x: 7.5, z: 4.7, w: 0.4, d: 1.5 },
    /** The glass: a 2.25 m screen along the aisle side between x0 and x1, open at both ends (the two ways in), and a return down the west side. */
    glass: { h: 2.25, run: { x0: 4.05, x1: 6.35 }, exit: 1.05 },
    seats: [{ x: 4.45, z: 4.95 }, { x: 5.95, z: 4.95 }] },
  tree: { x: 1.6, z: 4.75 }, // the sculpture of the mark, front middle
  /** Ten desk slots; the last two are reserved for agents who join later. */
  slots: [
    { x: -4.2, z: -1.6 }, { x: -1.5, z: -1.6 }, { x: 1.2, z: -1.6 }, { x: 3.9, z: -1.6 },
    { x: -2.85, z: 1.7 }, { x: -0.15, z: 1.7 }, { x: 2.55, z: 1.7 }, { x: 5.25, z: 1.7 },
    { x: -5.55, z: 1.7 }, { x: 6.6, z: -1.6 },
  ],
};

const ROOM_OBJ = {}; // handles to live parts (screens, door leaves, lift, logo, server lights, holograms)

/* ---------- small builders ------------------------------------------------- */

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

const RM = {
  rack: std('#17191c', 0.5, 0.35),
  rackSlot: std('#24272c', 0.45, 0.45),
  tint: new THREE.MeshPhysicalMaterial({ color: lin('#20252c'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.3, depthWrite: false, fog: false }),
  slabEdge: std('#a9a8a4', 0.85),
  stonePot: std('#cdc6ba', 0.9),
  bloomA: std('#f3f1f6', 0.8),
  bloomB: std('#c8d5ef', 0.8),
  bloomC: std('#dcd0ee', 0.8),
  trunk: std('#7b6a58', 0.9),
  boardRug: new THREE.MeshStandardMaterial({ map: RUG_TEX, color: lin('#e3ddd2'), bumpMap: RUG_TEX, bumpScale: 0.002, roughness: 1, metalness: 0, envMapIntensity: 0.25, fog: false }),
  rugLine: std('#3a3b3e', 0.95),
  gap: std('#1b1c1e', 0.9),
  benchFelt: new THREE.MeshStandardMaterial({ map: FELT_TEX, color: lin('#b7b8ba'), roughness: 1, metalness: 0, envMapIntensity: 0.25, fog: false }),
  marble: null, // set below, once the stone is drawn
  leather: new THREE.MeshPhysicalMaterial({ color: lin('#efebe4'), roughness: 0.46, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.4, envMapIntensity: 0.5, fog: false }),
  // low-iron glass for the south side, the one every view looks in through: the same glass, barely tinted
  frontGlass: Object.assign(MAT.glass.clone(), { opacity: 0.05, envMapIntensity: 0.55 }),
};
/** Nero Marquina: near-black stone, a few fine white veins and their soft shadows. */
RM.marble = (() => {
  const W = 2048, H = 768, c = makeCanvas(W, H), ctx = c.getContext('2d'), rnd = seeded(902);
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    const g = ctx.createRadialGradient(rnd() * W, rnd() * H, 0, rnd() * W, rnd() * H, 120 + rnd() * 260);
    g.addColorStop(0, `rgba(${rnd() < 0.5 ? '40,40,44' : '8,8,10'},0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const vein = (x, y, ang, len, width, alpha) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < len; s += 8) {
      ang += (rnd() - 0.5) * 0.35;
      x += Math.cos(ang) * 8;
      y += Math.sin(ang) * 8;
      ctx.lineTo(x, y);
      if (rnd() < 0.012 && width > 0.6) vein(x, y, ang + (rnd() - 0.5) * 1.6, len * 0.35, width * 0.55, alpha * 0.8);
    }
    ctx.strokeStyle = `rgba(232,232,236,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  // wide, soft veins first (blurred), then the same paths again, fine and bright
  const seeds = Array.from({ length: 6 }, () => [rnd() * W * 0.3 - 100, rnd() * H, (rnd() - 0.5) * 0.6, 900 + rnd() * 1300, 0.8 + rnd() * 1.4, 0.3 + rnd() * 0.35, Math.floor(rnd() * 1e6)]);
  for (const [x, y, a, len, w, al, sd] of seeds) {
    const r2 = seeded(sd);
    let rr = r2;
    const vein2 = (x, y, ang, len, width, alpha) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < len; s += 8) {
        ang += (rr() - 0.5) * 0.3;
        x += Math.cos(ang) * 8;
        y += Math.sin(ang) * 8;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(226,226,230,${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // a soft halo built from wide, faint passes of the same path, then the vein itself, fine and bright
    for (const [k, f] of [[9, 0.05], [6, 0.07], [3.5, 0.1]]) {
      rr = seeded(sd);
      vein2(x, y, a, len, w * k, al * f);
    }
    rr = seeded(sd);
    vein2(x, y, a, len, w, al);
  }
  ctx.shadowBlur = 0;
  for (let i = 0; i < 8; i++) vein(rnd() * W, rnd() * H, (rnd() - 0.5) * 0.9, 160 + rnd() * 300, 0.5, 0.08 + rnd() * 0.08);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 3.0, 1 / 1.05);
  t.offset.set(0.5, 0.5);
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.12, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.06, envMapIntensity: 0.75, fog: false });
})();

/** A run of floor-to-ceiling glass with slim aluminium mullions and sill. */
function glassRun(group, axis, a0, a1, fixed, panes, mat = MAT.glass) {
  const H = ROOM.H;
  const len = a1 - a0, mid = (a0 + a1) / 2;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.06), mat);
  pane.userData.noShadow = true;
  pane.userData.collide = true;
  if (axis === 'x') pane.position.set(mid, H / 2, fixed);
  else {
    pane.rotation.y = HALF_PI;
    pane.position.set(fixed, H / 2, mid);
  }
  group.add(pane);
  for (let i = 0; i <= panes; i++) {
    const a = a0 + (i / panes) * len;
    group.add(axis === 'x' ? box(0.035, H, 0.05, MAT.alu, a, H / 2, fixed) : box(0.05, H, 0.035, MAT.alu, fixed, H / 2, a));
  }
  group.add(axis === 'x' ? box(len, 0.035, 0.07, MAT.alu, mid, 0.0175, fixed) : box(0.07, 0.035, len, MAT.alu, fixed, 0.0175, mid));
}

/** A glass panel (len × h, centred on its origin, facing +z) whose top corner at the +x end is cut back by `cut`
 *  from height `yCut` (measured from the panel's foot) up, so a band running across that end passes it. */
function notchedPaneGeometry(len, h, cut, yCut) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -h / 2);
  s.lineTo(len / 2, -h / 2);
  s.lineTo(len / 2, -h / 2 + yCut);
  s.lineTo(len / 2 - cut, -h / 2 + yCut);
  s.lineTo(len / 2 - cut, h / 2);
  s.lineTo(-len / 2, h / 2);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** Floor plane whose UVs keep the stone tiles the same size everywhere. */
function floorPlane(w, d, mat = MAT.floor) {
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / ROOM.W), uv.getY(i) * (d / ROOM.D));
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -HALF_PI;
  m.receiveShadow = true;
  return m;
}

const BENCH_H = 0.45; // Forum benches

/* ---------- the room --------------------------------------------------------- */

function buildRoom(imgs = {}) {
  const room = new THREE.Group();
  room.name = 'room';
  const { W, D, H, x0, x1, z0, z1 } = ROOM;
  const cz = ROOM.cz;

  STONE_TEX.repeat.set(W / 4, D / 4);
  // slab: a warm stone section, the floor on top
  room.add(box(W, 0.5, D, RM.slabEdge, 0, -0.275, cz));
  const floor = floorPlane(W, D);
  floor.position.set(0, 0.001, cz);
  room.add(floor);
  room.add(box(W, 0.012, 0.012, MAT.white, 0, -0.012, z1 + 0.006));
  room.add(box(0.012, 0.012, D, MAT.white, x1 + 0.006, -0.012, cz));

  ROOM_OBJ.panels = [];
  ROOM_OBJ.pickables = [];
  buildLogoWall(room);
  buildForum(room);
  buildMarketRoom(room);
  buildServer(room);
  buildTicker(room);

  // west wall: glass, with the entrance portal
  const dz0 = ROOM.door.z0, dz1 = ROOM.door.z1;
  glassRun(room, 'z', z0, dz0 - 0.08, x0 - 0.02, 4);
  glassRun(room, 'z', dz1 + 0.08, z1, x0 - 0.02, 4);
  buildDoor(room);

  // east side: glass like the west, carrying the data wall
  glassRun(room, 'z', z0, z1, x1 + 0.02, 6);
  // south side: glass too, so the floor is closed on all four sides. Every view of the room looks in through it, so it
  // is the clearest glass in the building, under a slim head rail rather than a beam (the ticker's bar is the top
  // edge); four wide panes keep a mullion off the sculpture's axis (x 1.6), which its own view looks along
  glassRun(room, 'x', x0 - 0.02, x1 + 0.02, z1 + 0.02, 4, RM.frontGlass);
  const southHead = box(W + 0.04, 0.05, 0.07, MAT.alu, 0, H - 0.025, z1 + 0.02);
  southHead.userData.noShadow = true;
  room.add(southHead);
  // slim aluminium corner columns, and a brushed-metal frame along the top of every wall
  room.add(box(0.22, H, 0.22, MAT.alu, x0 - 0.05, H / 2, z0 - 0.05));
  room.add(box(0.2, H, 0.2, MAT.alu, x1 + 0.03, H / 2, z0 - 0.05));
  room.add(box(0.18, H, 0.18, MAT.alu, x0 - 0.06, H / 2, z1 - 0.09));
  room.add(box(0.18, H, 0.18, MAT.alu, x1 + 0.02, H / 2, z1 - 0.09));
  room.add(box(W + 0.5, 0.2, 0.36, MAT.aluDark, 0, H + 0.1, z0 - 0.08));
  room.add(box(0.36, 0.2, D + 0.1, MAT.aluDark, x0 - 0.08, H + 0.1, cz + 0.05));
  room.add(box(0.36, 0.2, D + 0.1, MAT.aluDark, x1 + 0.1, H + 0.1, cz + 0.05));
  buildDataWall(room);

  buildLounge(room);
  buildStudy(room);
  buildVestibule(room);

  // living things: flowers either side of the Forum screen, a kentia palm in the corner, the tree bench
  const f1 = PLANTS.bloom(3, 1.05, 'tall');
  f1.position.set(-2.78, 0, z0 + 0.42);
  room.add(f1);
  const f2 = PLANTS.bloom(8, 1.05, 'tall');
  f2.position.set(2.78, 0, z0 + 0.42);
  room.add(f2);
  // (the corner kentia that stood here went with the reading corner: the study's console carries its own bowl)
  buildSculpture(room);

  shadowAll(room, true, true);
  room.traverse(o => {
    if (o.isMesh && o.material && o.material.transparent) o.castShadow = false;
  });
  const _bb = new THREE.Box3();
  registerColliders(room, 'room', { skip: o => _bb.setFromObject(o).max.y < 0.035 });
  mergeByMaterial(room);
  scene.add(room);
  if (typeof buildCity === 'function') scene.add(buildCity());
  return room;
}

/* ---------- north wall: the logo, the Forum, the Market Room ---------------------- */

function buildLogoWall(room) {
  const { z0, H } = ROOM;
  const xa = ROOM.x0, xb = -ROOM.feature;
  glassRun(room, 'x', xa, xb, z0 - 0.02, 2);
  // no mark on this wall: the Forum screen beside it carries the logo, and the server stands at the corner (ROOM.logo is retained for callers)
  ROOM_OBJ.logo = null;
  buildHotList(room);
}

/** The hot list: two large screens stacked on the glass façade — new listings above, under contract and sold below. */
function buildHotList(room) {
  const S = ROOM.hotlist;
  ROOM_OBJ.hotlist = {};
  for (const [key, y] of [['hotnew', S.yUp], ['hotdone', S.yLo]]) {
    const g = new THREE.Group();
    const bezel = new THREE.Mesh(roundedBoxGeometry(S.w + 0.05, S.h + 0.05, 0.05, 0.016, 2), MAT.aluDark);
    g.add(bezel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.h), MAT.screenOff);
    face.position.z = 0.0262;
    face.userData.pick = bezel.userData.pick = 'screen:' + key;
    g.add(face);
    // Small metal standoffs hold each display off the glass.
    for(const x of [-S.w*.36,S.w*.36]) for(const yy of [-S.h*.32,S.h*.32]) {
      const mount=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.045,12),MAT.alu);mount.rotation.x=HALF_PI;mount.position.set(x,yy,-.043);g.add(mount);
    }
    g.position.set(S.x, y, S.z);
    g.userData.keep = true;
    room.add(g);
    ROOM_OBJ.hotlist[key] = { group: g, face, bezel, w: S.w, h: S.h };
    ROOM_OBJ.pickables.push(g);
  }
  // kept for older callers: the hot list as a whole
  ROOM_OBJ.hot = { group: ROOM_OBJ.hotlist.hotnew.group, face: ROOM_OBJ.hotlist.hotnew.face, bezel: ROOM_OBJ.hotlist.hotnew.bezel };
}

/** Where the ticker runs: the centre lines of its bar on the four walls — far enough in to pass the corner columns, so
 *  it turns all four corners unbroken — its depth, and how far its face stands proud of the bar. */
function tickerLines() {
  const { x0, x1, z0, z1 } = ROOM;
  return { xW: x0 + 0.095, zN: z0 + 0.085, xE: x1 - 0.095, zS: z1 - 0.095, D: 0.035, F: 0.0185 };
}

/** The ticker: one closed loop round the top of all four walls — up the west wall, across the north, down the east,
 *  back along the south — so it reads from anywhere in the room. One texture runs through every wall: each face's UVs
 *  are its place along the loop in metres, the faces meet exactly at the four inside corners, and the strip is laid
 *  out to a whole number of repeats of the loop (buildTickerStrip), so the words turn every corner, the closing one
 *  too, without a break. The bars overlap at each corner, closing the outside of the turn; the Market Room's glass
 *  stops short of the band (buildMarketRoom). The south bar also faces out, so the loop reads from outside the glass.
 *  Screens stop 8 cm below it. */
function buildTicker(room) {
  const T = ROOM.ticker;
  const { xW, zN, xE, zS, D, F } = tickerLines();
  const BH = T.h + 0.035; // the bar's height
  // each wall in reading order: the face from a to b as the viewer facing that wall reads left → right; the bar from p to q
  const runs = [
    { name: 'west', a: [xW + F, zS - F], b: [xW + F, zN + F], p: [xW, zS + D / 2], q: [xW, zN - D / 2], rotY: HALF_PI },
    { name: 'north', a: [xW + F, zN + F], b: [xE - F, zN + F], p: [xW - D / 2, zN], q: [xE + D / 2, zN], rotY: 0 },
    { name: 'east', a: [xE - F, zN + F], b: [xE - F, zS - F], p: [xE, zN - D / 2], q: [xE, zS + D / 2], rotY: -HALF_PI },
    { name: 'south', a: [xE - F, zS - F], b: [xW + F, zS - F], p: [xE + D / 2, zS], q: [xW - D / 2, zS], rotY: Math.PI, outward: true },
  ];
  const segs = [];
  let r = 0;
  for (const run of runs) {
    const len = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]);
    const ax = [Math.cos(run.rotY), -Math.sin(run.rotY)], az = [Math.sin(run.rotY), Math.cos(run.rotY)]; // the run's local x and z, in plan
    // the group sits on the bar's centre line, square behind the middle of its face
    const gx = (run.a[0] + run.b[0]) / 2 - az[0] * F, gz = (run.a[1] + run.b[1]) / 2 - az[1] * F;
    const g = new THREE.Group();
    const bl = Math.hypot(run.q[0] - run.p[0], run.q[1] - run.p[1]);
    const bx = (run.p[0] + run.q[0]) / 2 - gx, bz = (run.p[1] + run.q[1]) / 2 - gz;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(bl, BH, D), MAT.aluDark);
    bezel.position.set(bx * ax[0] + bz * ax[1], 0, bx * az[0] + bz * az[1]);
    g.add(bezel);
    const geo = new THREE.PlaneGeometry(len, T.h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, r + uv.getX(i) * len); // metres along the band
    uv.needsUpdate = true;
    const face = new THREE.Mesh(geo, MAT.screenOff);
    face.position.z = F;
    face.userData.pick = bezel.userData.pick = 'screen:ticker';
    g.add(face);
    let outer = null;
    if (run.outward) {
      // the same strip on the bar's outer side, reading west → east for anyone outside the glass
      const og = new THREE.PlaneGeometry(len, T.h);
      const ou = og.attributes.uv;
      for (let i = 0; i < ou.count; i++) ou.setX(i, ou.getX(i) * len); // metres, like the loop
      outer = new THREE.Mesh(og, MAT.screenOff);
      outer.rotation.y = Math.PI;
      outer.position.z = -F;
      outer.userData.pick = 'screen:ticker';
      g.add(outer);
      // the bar over the open front casts no shadow across the room
      g.traverse(o => o.isMesh && (o.userData.noShadow = true));
    }
    g.position.set(gx, T.y, gz);
    g.rotation.y = run.rotY;
    g.userData.keep = true;
    room.add(g);
    ROOM_OBJ.pickables.push(g);
    segs.push({ name: run.name, group: g, face, outer, bezel, w: len, h: T.h, r0: r });
    r += len; // the next face starts where this one ends: no gap to count
  }
  const north = segs.find(sg => sg.name === 'north');
  // the north run stands for the band where one screen is needed (the focus view, the living layer)
  ROOM_OBJ.ticker = { group: north.group, face: north.face, bezel: north.bezel, w: north.w, h: T.h, segs, ringLength: r, closed: true };
}

/** The Forum wall: floor-to-ceiling glass like the rest of the building, the main screen set into it as an infill
 *  panel — a mullion either side of it, a transom under and over it — so the view runs all the way round the screen. */
function buildForumGlass(room) {
  const { z0, H } = ROOM;
  const fw = ROOM.feature, s = ROOM.screen;
  const zG = z0 - 0.02; // the glass line, as on the west and east sides
  const bw = s.w + 0.05, bh = s.h + 0.05; // the screen in its bezel
  const xm = bw / 2 + 0.027, gap = 0.002; // the screen's mullions, a 2 mm reveal off the bezel
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(fw * 2, H - 0.06), MAT.glass);
  pane.position.set(0, H / 2, zG);
  pane.userData.noShadow = true;
  pane.userData.collide = true;
  room.add(pane);
  // the jambs where the Forum glass meets the neighbouring glass bays, and the pair that carries the screen
  for (const sx of [-1, 1]) room.add(box(0.035, H, 0.05, MAT.alu, sx * (fw - 0.0175), H / 2, zG));
  for (const sx of [-1, 1]) room.add(box(0.05, H, 0.06, MAT.alu, sx * xm, H / 2, zG));
  // transoms under and over the screen, between its mullions
  room.add(box(xm * 2 - 0.05, 0.05, 0.06, MAT.alu, 0, s.y - bh / 2 - 0.025 - gap, zG));
  room.add(box(xm * 2 - 0.05, 0.05, 0.06, MAT.alu, 0, s.y + bh / 2 + 0.025 + gap, zG));
  room.add(box(fw * 2, 0.035, 0.07, MAT.alu, 0, 0.0175, zG)); // the sill
  // daylight through the north glass: a soft wash across the floor in front of it, fading into the room (and away
  // at night: updateRoom)
  const c = makeCanvas(64, 256), ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 0, 0, 256);
  for (let i = 0; i <= 12; i++) gr.addColorStop(i / 12, `rgba(255,255,255,${Math.pow(1 - i / 12, 2.2).toFixed(3)})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0); // the ends soften where the glass meets the walls
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.12, 'rgba(0,0,0,0)');
  side.addColorStop(0.88, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  const washMat = new THREE.MeshBasicMaterial({ map: tex, color: lin('#fff4e6'), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const depth = 3.0;
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(fw * 2 + 0.6, depth), washMat);
  wash.rotation.x = -HALF_PI;
  wash.position.set(0, 0.0025, z0 + depth / 2);
  wash.renderOrder = -1; // under the benches' contact shadows
  wash.userData.noShadow = true;
  wash.raycast = () => {};
  room.add(wash);
  ROOM_OBJ.northWash = { mat: washMat, base: washMat.opacity };
}

function buildForum(room) {
  buildForumGlass(room);
  // the main screen: a thin aluminium frame, set into the glass between its mullions
  const s = ROOM.screen;
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(roundedBoxGeometry(s.w + 0.05, s.h + 0.05, 0.05, 0.016, 2), MAT.aluDark);
  g.add(bezel);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), MAT.screenOff);
  face.position.z = 0.0262;
  face.userData.pick = bezel.userData.pick = 'screen:main';
  g.add(face);
  g.position.set(s.x, s.y, s.z);
  g.userData.keep = true;
  room.add(g);
  ROOM_OBJ.screen = { group: g, face, bezel, w: s.w, h: s.h };
  ROOM_OBJ.pickables.push(g);

  // the Forum: two white-oak benches facing the screen, a grey felt pad, splayed legs on a steel stretcher
  ROOM_OBJ.forumSeats = [];
  for (const x of ROOM.forum.xs) {
    const b = new THREE.Group();
    b.add(placed(new THREE.Mesh(roundedBoxGeometry(1.5, 0.032, 0.42, 0.01, 2), MAT.oak), 0, BENCH_H - 0.03 - 0.016, 0));
    b.add(placed(new THREE.Mesh(softBlock(1.42, 0.03, 0.36, { r: 0.012, n: 5, segs: 40, crown: 0.004, edge: 3, rings: 3 }), RM.benchFelt), 0, BENCH_H - 0.03, 0));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const top = new THREE.Vector3(sx * 0.6, BENCH_H - 0.062, sz * 0.12), foot = new THREE.Vector3(sx * 0.66, 0.0, sz * 0.16);
        b.add(rodBetween(foot, top, 0.016, MAT.oakB, false));
      }
    for (const sx of [-1, 1]) b.add(placed(new THREE.Mesh(roundedBoxGeometry(0.03, 0.024, 0.26, 0.006, 2), MAT.oakB), sx * 0.61, BENCH_H - 0.07, 0));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.22, 14), FMAT.satinBlack);
    bar.rotation.z = HALF_PI;
    bar.position.set(0, 0.16, 0);
    b.add(bar);
    b.add(placed(contactShadow(1.9, 0.85, 0.3), 0, 0.004, 0));
    b.position.set(x, 0, ROOM.forum.z - 0.08);
    room.add(b);
    for (const dx of [-0.36, 0.36]) ROOM_OBJ.forumSeats.push({ x: x + dx, z: ROOM.forum.z - 0.04, face: Math.PI, lift: BENCH_H - DIM.seatTop, taken: false, area: 'screen' });
  }
}

function buildMarketRoom(room) {
  const b = ROOM.board;
  const { x1, z0, H } = ROOM;
  const g = new THREE.Group();
  // Continue the same clear façade behind the pipeline; every display remains in place.
  glassRun(g, 'x', ROOM.feature, x1, z0 - 0.02, 2);
  // frameless glass: a west side and a south side, open at the south-west corner. Each pane stops short of the ticker
  // where the band passes along the wall it meets, so the band runs on unbroken (buildTicker).
  const zE = b.zEdge;
  const TK = tickerLines(), yCut = ROOM.ticker.y - (ROOM.ticker.h + 0.035) / 2 - 0.006;
  const west = new THREE.Mesh(notchedPaneGeometry(zE - z0, H, TK.zN + TK.F + 0.003 - z0, yCut), MAT.glass);
  west.rotation.y = HALF_PI;
  west.position.set(b.x0, H / 2, (z0 + zE) / 2);
  g.add(west);
  const openX1 = b.x0 + 1.1;
  const south = new THREE.Mesh(notchedPaneGeometry(x1 - openX1, H, x1 - (TK.xE - TK.F - 0.003), yCut), MAT.glass);
  south.position.set((openX1 + x1) / 2, H / 2, zE);
  g.add(south);
  g.add(box(0.035, H, 0.035, MAT.alu, b.x0, H / 2, zE));
  g.add(box(0.035, H, 0.035, MAT.alu, openX1, H / 2, zE));
  g.add(box(0.05, 0.03, zE - z0, MAT.alu, b.x0, 0.015, (z0 + zE) / 2));
  g.add(box(x1 - openX1, 0.03, 0.05, MAT.alu, (openX1 + x1) / 2, 0.015, zE));

  // the pipeline screen
  const s = ROOM.hot;
  const sg = new THREE.Group();
  const bezel = new THREE.Mesh(roundedBoxGeometry(s.w + 0.05, s.h + 0.05, 0.05, 0.016, 2), MAT.aluDark);
  sg.add(bezel);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), MAT.screenOff);
  face.position.z = 0.0262;
  face.userData.pick = bezel.userData.pick = 'screen:pipeline';
  sg.add(face);
  sg.position.set(s.x, s.y, s.z);
  sg.userData.keep = true;
  room.add(sg);
  ROOM_OBJ.panels.push({ key: 'pipeline', title: 'Pipeline', group: sg, face, bezel, w: s.w, h: s.h });
  ROOM_OBJ.pickables.push(sg);

  // the rug: undyed wool, a charcoal border inlaid a hand's width in
  const rug = new THREE.Mesh(roundedBoxGeometry(3.9, 0.012, 2.3, 0.006, 2), RM.boardRug);
  rug.position.set(b.tx, 0.006, b.tz);
  g.add(rug);
  for (const [w, d, x, z] of [[3.6, 0.02, 0, -1.0], [3.6, 0.02, 0, 1.0], [0.02, 2.02, -1.8, 0], [0.02, 2.02, 1.8, 0]]) g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(w, 0.0125, d), RM.rugLine), b.tx + x, 0.0063, b.tz + z));
  // the table: a racetrack of polished black marble on a brushed-aluminium blade
  const TL = 3.0, TD = 1.05, TR = TD / 2;
  const track = (inset = 0) => {
    const s = new THREE.Shape(), l = TL / 2 - TR, r = TR - inset;
    s.moveTo(-l, -r);
    s.lineTo(l, -r);
    s.absarc(l, 0, r, -HALF_PI, HALF_PI, false);
    s.lineTo(-l, r);
    s.absarc(-l, 0, r, HALF_PI, HALF_PI * 3, false);
    return s;
  };
  const slab = (shape, depth, bevel, curve = 48) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: curve });
    geo.rotateX(-HALF_PI);
    return geo;
  };
  const topGeo = slab(track(), 0.016, 0.005);
  topGeo.translate(0, DESK.top - 0.021, 0);
  const tableTop = new THREE.Mesh(topGeo, RM.marble);
  tableTop.position.set(b.tx, 0, b.tz);
  tableTop.userData.collider = { kind: 'box' };
  g.add(tableTop);
  // The recessed core meets the stone underside while retaining the inset shadow line.
  const coreGeo = slab(track(0.1), 0.042, 0.004, 32);
  coreGeo.translate(0, DESK.top - 0.026 - 0.044, 0);
  g.add(placed(new THREE.Mesh(coreGeo, FMAT.satinBlack), b.tx, 0, b.tz));
  const bladeH = DESK.top - 0.07 - 0.03;
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(2.0, bladeH, 0.11, 0.05, 5), MAT.alu), b.tx, 0.03 + bladeH / 2, b.tz));
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(2.08, 0.03, 0.16, 0.012, 2), FMAT.satinBlack), b.tx, 0.015, b.tz));
  // flush power and data at every place
  const lidMat = std('#b9bdc3', 0.3, 0.85);
  const placeMods = [[-1.0, 0.24, 0], [0, 0.24, 0], [1.0, 0.24, 0], [-1.18, 0, HALF_PI], [1.18, 0, HALF_PI]];
  for (const [x, z, ry] of placeMods) {
    const lid = new THREE.Mesh(roundedBoxGeometry(0.13, 0.002, 0.045, 0.0009, 1), lidMat);
    lid.position.set(b.tx + x, DESK.top + 0.0006, b.tz + z);
    lid.rotation.y = ry;
    lid.userData.noCollide = true;
    g.add(lid);
  }
  g.add(placed(contactShadow(3.6, 1.7, 0.3), b.tx, 0.014, b.tz));
  // a linear pendant: an ink-black blade with a soft diffuser, hung on two fine cables from slim canopies
  const pend = new THREE.Group();
  const PL = 2.3, PY = 2.32;
  pend.add(placed(new THREE.Mesh(roundedBoxGeometry(PL, 0.042, 0.05, 0.008, 2), FMAT.satinBlack), 0, PY, 0));
  const diff = new THREE.Mesh(roundedBoxGeometry(PL - 0.04, 0.004, 0.032, 0.0015, 1), new THREE.MeshBasicMaterial({ color: lin('#fff6ea'), toneMapped: false }));
  diff.position.y = PY - 0.0215;
  pend.add(diff);
  for (const sx of [-1, 1]) {
    pend.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, ROOM.H - PY - 0.02, 6), FMAT.satinBlack), sx * (PL / 2 - 0.25), (PY + ROOM.H) / 2, 0));
    pend.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 24), FMAT.satinBlack), sx * (PL / 2 - 0.25), ROOM.H - 0.006, 0));
  }
  pend.traverse(o => o.isMesh && (o.userData.noCollide = true));
  pend.position.set(b.tx, 0, b.tz);
  g.add(pend);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: lin('#fff3e0'), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -HALF_PI;
  glow.position.set(b.tx, DESK.top + 0.002, b.tz);
  glow.userData.noShadow = true;
  g.add(glow);
  ROOM_OBJ.boardSeats = [];
  const seats = [
    [b.tx - 1.0, b.tz + 0.84, Math.PI], [b.tx, b.tz + 0.84, Math.PI], [b.tx + 1.0, b.tz + 0.84, Math.PI],
    [b.tx - 1.88, b.tz, HALF_PI], [b.tx + 1.88, b.tz, -HALF_PI],
  ];
  const kinds = ['sheet', 'strategy', 'map', 'media', 'build'];
  const seatM = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  seats.forEach(([x, z, face], i) => {
    const ch = boardChair();
    ch.position.set(x, 0.012, z);
    ch.rotation.y = face;
    g.add(ch);
    // a laptop at each place, closed until someone sits down to it
    const lzz = i < 3 ? 0.495 : 0.6; // the ends sit farther from the stone's curve
    const lt = buildLaptop(17 + i * 5, kinds[i % kinds.length]);
    seatM.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, face), new THREE.Vector3(1, 1, 1));
    lt.group.position.set(0, DESK.top, lzz).applyMatrix4(seatM);
    lt.group.rotation.y = face;
    lt.group.updateMatrixWorld(true);
    g.add(lt.group);
    const local = {
      kb: new THREE.Vector3(lt.kbLocal.x, DESK.top + lt.kbLocal.y, lzz + lt.kbLocal.z),
      pad: new THREE.Vector3(lt.padLocal.x, DESK.top + lt.padLocal.y, lzz + lt.padLocal.z),
    };
    const kbWorld = lt.keyboard.group.matrixWorld;
    const laptop = {
      group: lt.group,
      local, // in the seat frame: origin on the floor under the seat, +Z toward the table (the frame of figure.desk)
      kb: local.kb.clone().applyMatrix4(seatM), // world space
      pad: local.pad.clone().applyMatrix4(seatM), // world space
      setOpen: on => lt.setOpen(on),
      get isOpen() {
        return lt.isOpen;
      },
      screenMaterial: lt.screenMat,
      screen: lt.screen,
      // WORLD-SPACE keys of this laptop (x, y = key top, z); press(i) sinks key i and lets it spring back
      keyboard: {
        keys: lt.keyboard.keys.map(k => {
          const v = new THREE.Vector3(k.x, k.y, k.z).applyMatrix4(kbWorld);
          return { x: v.x, y: v.y, z: v.z, w: k.w, d: k.d, row: k.row, label: k.label };
        }),
        press: (k, auto) => lt.keyboard.press(k, auto),
        get lastPress() {
          return lt.keyboard.lastPress;
        },
      },
      update: (dt, t) => lt.update(dt, t),
    };
    ROOM_OBJ.boardSeats.push({ x, z, face, lift: SHELL_SEAT + 0.012 - DIM.seatTop, taken: false, side: i < 3, area: 'board', chair: ch, laptop });
  });
  room.add(g);
  buildHoloMap(room);
}

/** The boardroom chair (seat 46 cm): one continuous upholstered shell in white leather, a polished four-star base on glides. */
const SHELL_SEAT = 0.46;
function boardChair() {
  const c = new THREE.Group();
  const S = SHELL_SEAT, B = 0.034;
  // the shell: seat and back in one sweep, the front edge rolled, the back gently raked
  const path = [[S - 0.026, 0.205], [S - B + 0.003, 0.175], [S - B + 0.006, 0.08], [S - B + 0.004, -0.06], [S - B + 0.018, -0.15], [S - B + 0.07, -0.215], [S + 0.15, -0.252], [S + 0.29, -0.272], [S + 0.38, -0.286]];
  const curve = new THREE.CatmullRomCurve3(path.map(([y, z]) => new THREE.Vector3(0, y, z)));
  const pts = curve.getPoints(26);
  const rows = pts.map((p, i) => {
    const t = i / (pts.length - 1);
    return { p: [0, p.y, p.z], a: lerp(0.238, 0.226, t), b: B };
  });
  // round both ends: a short dome past the first and last sections
  const head = pts[0], tail = pts[pts.length - 1];
  const dirA = new THREE.Vector3().subVectors(pts[0], pts[1]).normalize(), dirB = new THREE.Vector3().subVectors(tail, pts[pts.length - 2]).normalize();
  for (const k of [0.4, 0.75, 0.95]) rows.unshift({ p: [0, head.y + dirA.y * B * k, head.z + dirA.z * B * k], a: 0.238 * Math.sqrt(1 - k * k * 0.5), b: B * Math.sqrt(1 - k * k) });
  for (const k of [0.4, 0.75, 0.95]) rows.push({ p: [0, tail.y + dirB.y * B * k, tail.z + dirB.z * B * k], a: 0.226 * Math.sqrt(1 - k * k * 0.5), b: B * Math.sqrt(1 - k * k) });
  const shell = new THREE.Mesh(superLoft(rows, { segs: 28, n: 3.2, U: [1, 0, 0], uvScale: 2 }), RM.leather);
  shell.userData.noCollide = true; // one swept piece: its bounding box would swallow the sitter
  c.add(shell);
  addProxy(c, 0.476, 0.06, 0.4, 0, S - 0.033, -0.005);
  addProxy(c, 0.466, 0.32, 0.068, 0, S + 0.24, -0.266, -0.147);
  // a fine welt where the shell meets its edge
  // the column, the seat plate and a polished four-star base on glides
  c.add(placed(new THREE.Mesh(roundedBoxGeometry(0.2, 0.02, 0.22, 0.008, 2), FMAT.satinBlack), 0, S - 0.072, 0.0));
  c.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, S - 0.16, 22), FMAT.satinBlack), 0, 0.08 + (S - 0.16) / 2, 0));
  const base = new THREE.Group();
  base.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 28), FMAT.polished), 0, 0.068, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4, dir = [Math.sin(a), Math.cos(a)];
    base.add(
      new THREE.Mesh(
        superLoft(
          [
            { p: [dir[0] * 0.02, 0.07, dir[1] * 0.02], a: 0.024, b: 0.018 },
            { p: [dir[0] * 0.15, 0.058, dir[1] * 0.15], a: 0.019, b: 0.012 },
            { p: [dir[0] * 0.29, 0.03, dir[1] * 0.29], a: 0.015, b: 0.009 },
            { p: [dir[0] * 0.315, 0.022, dir[1] * 0.315], a: 0.014, b: 0.009 },
          ],
          { segs: 16, n: 3, U: [dir[1], 0, -dir[0]] }
        ),
        FMAT.polished
      )
    );
    base.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.012, 14), FMAT.satinBlack), dir[0] * 0.31, 0.006, dir[1] * 0.31));
  }
  c.add(base);
  c.add(placed(contactShadow(0.75, 0.75, 0.26), 0, 0.003, 0));
  shadowAll(c);
  mergeByMaterial(c);
  c.userData.keep = true; // one chair, one handle: it can swivel or be pulled out
  return c;
}

/* ---------- the data wall: three screens on the east glass ------------------------ */

const PANEL_DEFS = [{ key: 'today', title: 'Today & leads', z: -0.65 }];
const PANEL = { w: 3.6, h: 2.025, y: 1.42 };
/** The manual's constellation: the east wall's second screen, beside Today & leads. */
const MANUAL = { w: 3.6, h: 2.025, y: 1.42, z: 3.3 };
function buildDataWall(room) {
  const x = ROOM.x1 - 0.07, w = PANEL.w, h = PANEL.h, y = PANEL.y;
  for (const def of PANEL_DEFS) {
    const g = new THREE.Group();
    const bezel = new THREE.Mesh(roundedBoxGeometry(w + 0.05, h + 0.05, 0.05, 0.016, 2), MAT.aluDark);
    g.add(bezel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.screenOff);
    face.position.z = 0.0262;
    g.add(face);
    // standoffs to the glass
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 10), MAT.alu);
        st.rotation.x = HALF_PI;
        st.position.set(sx * w * 0.38, sy * h * 0.32, -0.05);
        g.add(st);
      }
    face.userData.pick = bezel.userData.pick = 'screen:' + def.key;
    g.position.set(x, y, def.z);
    g.rotation.y = -HALF_PI;
    g.userData.keep = true;
    room.add(g);
    ROOM_OBJ.panels.push({ key: def.key, title: def.title, group: g, face, bezel, w, h });
    ROOM_OBJ.pickables.push(g);
  // the manual's constellation (the Field), the same make as its neighbour
  const M = MANUAL;
  const mg = new THREE.Group();
  const mBezel = new THREE.Mesh(roundedBoxGeometry(M.w + 0.05, M.h + 0.05, 0.05, 0.016, 2), MAT.aluDark);
  mg.add(mBezel);
  const mFace = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.h), MAT.screenOff);
  mFace.position.z = 0.0262;
  mFace.userData.pick = mBezel.userData.pick = 'screen:manual';
  mg.add(mFace);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 10), MAT.alu);
      st.rotation.x = HALF_PI;
      st.position.set(sx * M.w * 0.38, sy * M.h * 0.32, -0.05);
      mg.add(st);
    }
  mg.position.set(x, M.y, M.z);
  mg.rotation.y = -HALF_PI;
  mg.userData.keep = true;
  room.add(mg);
  ROOM_OBJ.manual = { group: mg, face: mFace, bezel: mBezel, w: M.w, h: M.h };
  ROOM_OBJ.pickables.push(mg);
}
}

/* ---------- holograms: Bergen County over the market table, a house over the lounge ---------- */

const HOLO_HEX = '#1f9ad8';
const holoLine = (opacity = 0.55) => new THREE.LineBasicMaterial({ color: lin('#7fb6d6'), transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false });
const holoFill = (opacity = 0.04) => new THREE.MeshBasicMaterial({ color: lin('#9cc8e0'), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });

/** A soft cone of projected light (vertical gradient). */
const CONE_TEX = (() => {
  const c = makeCanvas(8, 128);
  const ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0.6)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 8, 128);
  return canvasTexture(c, { aniso: false });
})();
function holoProjector(r, h) {
  const g = new THREE.Group();
  g.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.34, 0.016, 32), MAT.aluDark), 0, 0.008, 0));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 32), new THREE.MeshBasicMaterial({ color: lin('#9fb3c2'), toneMapped: false }));
  lens.rotation.x = -HALF_PI;
  lens.position.y = 0.0165;
  g.add(lens);
  const coneMat = new THREE.MeshBasicMaterial({ map: CONE_TEX, color: lin('#a9c9dc'), transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.2, h, 40, 1, true), coneMat);
  cone.position.y = 0.016 + h / 2;
  g.add(cone);
  g.userData.coneMat = coneMat;
  return g;
}

/** Stylised Bergen County: outline, the Hudson, the focus towns. (lon, lat) pairs. */
const BERGEN = {
  outline: [[-73.906, 40.996], [-74.211, 41.133], [-74.27, 41.06], [-74.25, 41.0], [-74.17, 40.98], [-74.15, 40.92], [-74.12, 40.88], [-74.11, 40.83], [-74.09, 40.8], [-74.07, 40.765], [-74.03, 40.76], [-74.0, 40.795], [-73.968, 40.835], [-73.948, 40.875], [-73.93, 40.93], [-73.906, 40.996]],
  hudson: [[-73.9, 41.06], [-73.906, 40.996], [-73.93, 40.93], [-73.948, 40.875], [-73.968, 40.835], [-74.0, 40.795], [-74.02, 40.75]],
  towns: [
    { name: 'Alpine', lon: -73.931, lat: 40.956, focus: true, dx: 1, dy: -1 },
    { name: 'Closter', lon: -73.962, lat: 40.973, focus: true, dx: -1, dy: -1.3, hq: true },
    { name: 'Demarest', lon: -73.963, lat: 40.957, focus: true, dx: -1, dy: 0.2 },
    { name: 'Haworth', lon: -73.99, lat: 40.961, focus: true, dx: -1, dy: 1.2 },
    { name: 'Fort Lee', lon: -73.97, lat: 40.851, focus: true, dx: 1, dy: 0 },
    { name: 'Englewood', lon: -73.973, lat: 40.893 },
    { name: 'Hackensack', lon: -74.044, lat: 40.886 },
    { name: 'Paramus', lon: -74.071, lat: 40.945 },
    { name: 'Ridgewood', lon: -74.117, lat: 40.979 },
    { name: 'Mahwah', lon: -74.144, lat: 41.089 },
  ],
};
function bergenXY(lon, lat, S) {
  // equirectangular at 41°N, fitted into an S×S canvas
  const x = (lon + 74.3) * Math.cos((41 * Math.PI) / 180), y = 41.15 - lat;
  const k = (S * 0.86) / 0.42;
  return [S * 0.07 + x * k, S * 0.05 + y * k];
}
function holoMapTexture() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const P = ([lon, lat]) => bergenXY(lon, lat, S);
  // grid
  ctx.strokeStyle = 'rgba(160,220,255,0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 16) * S, 0);
    ctx.lineTo((i / 16) * S, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i / 16) * S);
    ctx.lineTo(S, (i / 16) * S);
    ctx.stroke();
  }
  // county fill + outline
  ctx.beginPath();
  BERGEN.outline.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,200,255,0.12)';
  ctx.fill();
  ctx.shadowColor = 'rgba(160,225,255,0.9)';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(190,235,255,0.95)';
  ctx.lineWidth = 5;
  ctx.stroke();
  // the Hudson
  ctx.beginPath();
  BERGEN.hudson.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
  ctx.strokeStyle = 'rgba(110,190,255,0.75)';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // towns
  for (const t of BERGEN.towns) {
    const [x, y] = P([t.lon, t.lat]);
    ctx.fillStyle = t.focus ? 'rgba(235,250,255,1)' : 'rgba(170,220,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, t.focus ? 8 : 5, 0, TAU);
    ctx.fill();
    ctx.font = `${t.focus ? 700 : 500} ${t.focus ? 30 : 22}px ${BRAND.ui}`;
    const lx = x + (t.dx || 1) * 22, ly = y + (t.dy || 0) * 22 + 9;
    ctx.textAlign = (t.dx || 1) < 0 ? 'right' : 'left';
    ctx.fillStyle = t.focus ? 'rgba(235,250,255,0.98)' : 'rgba(170,220,255,0.7)';
    ctx.fillText(t.hq ? `${t.name} · B&Co.` : t.name, lx, ly);
    if (t.focus) {
      ctx.strokeStyle = 'rgba(235,250,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(lx - (t.dx || 1) * 6, ly - 9);
      ctx.stroke();
    }
  }
  ctx.textAlign = 'left';
  ctx.font = `600 26px ${BRAND.ui}`;
  ctx.fillStyle = 'rgba(190,235,255,0.85)';
  spacedText(ctx, 'BERGEN COUNTY', S * 0.07, S * 0.95, 8);
  return canvasTexture(c);
}

function buildHoloMap(room) {
  const b = ROOM.board;
  const g = new THREE.Group();
  g.position.set(b.tx, DESK.top, b.tz);
  g.userData.keep = true;
  const proj = holoProjector(0.5, 0.42);
  g.add(proj);
  const mapMat = new THREE.MeshBasicMaterial({ map: holoMapTexture(), color: lin('#c9dbe6'), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), mapMat);
  plane.rotation.x = -HALF_PI + 0.42;
  plane.position.y = 0.5;
  g.add(plane);
  // town pins rising from the map (focus towns)
  const pins = {};
  const S = 1024;
  for (const t of BERGEN.towns.filter(t => t.focus)) {
    const [px, py] = bergenXY(t.lon, t.lat, S);
    const u = px / S - 0.5, v = py / S - 0.5;
    const local = new THREE.Vector3(u * 1.15, -v * 1.15, 0);
    const pin = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: lin('#e8f2f8'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 6), mat);
    beam.position.y = 0.035;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), mat);
    head.position.y = 0.07;
    pin.add(beam, head);
    pin.position.copy(local);
    pin.rotation.x = HALF_PI; // stand up out of the (tilted) map plane
    plane.add(pin);
    pins[t.name] = { pin, mat, flare: 0 };
  }
  g.traverse(o => o.isMesh && (o.userData.noShadow = true));
  room.add(g);
  ROOM_OBJ.holoMap = { group: g, plane, mapMat, pins, coneMat: proj.userData.coneMat };
}

/** A modern two-volume house, drawn in light. */
/**
 * The lounge hologram: a modern residence in the language of the firm's own work, drawn in light.
 * Glass living wing with a floor-to-ceiling mullion rhythm, a bedroom wing cantilevered over the
 * terrace on two slim columns, flat roofs with thin fascias, a stone fireplace mass, a garage wing,
 * a lap pool on a deck, an exterior stair, trees, hedges, the drive and the site's contours.
 * All lines in two merged weights (key edges brighter), all fills in one, so it costs three draws.
 */
function holoHouse() {
  const g = new THREE.Group();
  // a deeper blue than the county map: the house sits against white walls and must read from across the room
  const line = holoLine(0.95), minor = holoLine(0.6), fill = holoFill(0.09);
  line.color.copy(lin('#2f78ad'));
  minor.color.copy(lin('#4b8fc0'));
  fill.color.copy(lin('#6aa6d0'));
  const water = new THREE.MeshBasicMaterial({ color: lin('#3fa6dc'), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const keyPts = [], minorPts = [], fills = [], pools = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const seg = (arr, a, b) => arr.push(a, b);
  const poly = (arr, pts, closed = false) => {
    for (let i = 1; i < pts.length; i++) seg(arr, pts[i - 1], pts[i]);
    if (closed) seg(arr, pts[pts.length - 1], pts[0]);
  };
  /** A volume: its twelve edges in the key weight and its faces in the fill. */
  const vol = (w, h, d, x, y, z, { edges = keyPts, solid = fills } = {}) => {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
    const c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => seg(edges, c[i], c[j]));
    if (solid) {
      const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      geo.translate(x, y, z);
      solid.push(geo);
    }
  };
  /** Mullions down a vertical face: along x at depth z (or along z at x), from y0 to y1, every `step`. */
  const mullionsX = (xa, xb, z, y0, y1, step, arr = minorPts) => {
    for (let x = xa + step; x < xb - step * 0.4; x += step) seg(arr, V(x, y0, z), V(x, y1, z));
  };
  const mullionsZ = (za, zb, x, y0, y1, step, arr = minorPts) => {
    for (let z = za + step; z < zb - step * 0.4; z += step) seg(arr, V(x, y0, z), V(x, y1, z));
  };

  // the living wing: one storey of glass under a thin roof plate
  const L = { w: 0.4, h: 0.074, d: 0.17, x: -0.02, z: 0 };
  vol(L.w, L.h, L.d, L.x, L.h / 2, L.z);
  mullionsX(L.x - L.w / 2, L.x + L.w / 2, L.z + L.d / 2 + 0.0005, 0, L.h, 0.033);
  mullionsX(L.x - L.w / 2, L.x + L.w / 2, L.z - L.d / 2 - 0.0005, 0, L.h, 0.05);
  seg(minorPts, V(L.x - L.w / 2, L.h * 0.86, L.z + L.d / 2 + 0.0006), V(L.x + L.w / 2, L.h * 0.86, L.z + L.d / 2 + 0.0006)); // transom
  vol(L.w * 0.56 + 0.024, 0.006, L.d + 0.024, L.x - L.w * 0.22, L.h + 0.003, L.z); // roof plate over the open west half (a terrace above)
  // the roof terrace: a glass rail round the open half
  const rx0 = L.x - L.w / 2 - 0.006, rx1 = L.x + 0.02, rz0 = L.z - L.d / 2 - 0.006, rz1 = L.z + L.d / 2 + 0.006, ry = L.h + 0.006, rh = 0.022;
  poly(minorPts, [V(rx0, ry + rh, rz0), V(rx0, ry + rh, rz1), V(rx1, ry + rh, rz1)]);
  for (const zz of [rz0, (rz0 + rz1) / 2, rz1]) seg(minorPts, V(rx0, ry, zz), V(rx0, ry + rh, zz));
  // the bedroom wing: cantilevered east past the living wing, on two slim columns
  const U = { w: 0.3, h: 0.068, d: 0.15, x: 0.075, z: -0.022 };
  const uy = L.h + 0.008 + U.h / 2;
  vol(U.w, U.h, U.d, U.x, uy, U.z);
  vol(U.w + 0.022, 0.006, U.d + 0.022, U.x, uy + U.h / 2 + 0.003, U.z); // its roof, a thin overhang all round
  for (const yy of [uy - U.h * 0.18, uy + U.h * 0.22]) seg(minorPts, V(U.x - U.w / 2, yy, U.z + U.d / 2 + 0.0006), V(U.x + U.w / 2, yy, U.z + U.d / 2 + 0.0006)); // ribbon window
  mullionsX(U.x - U.w / 2, U.x + U.w / 2, U.z + U.d / 2 + 0.0007, uy - U.h * 0.18, uy + U.h * 0.22, 0.05);
  mullionsZ(U.z - U.d / 2, U.z + U.d / 2, U.x + U.w / 2 + 0.0006, uy - U.h / 2, uy + U.h / 2, 0.03); // the glass end of the cantilever
  const cx = U.x + U.w / 2 - 0.012;
  for (const zz of [U.z - U.d / 2 + 0.012, U.z + U.d / 2 - 0.012]) seg(keyPts, V(cx, 0, zz), V(cx, L.h + 0.008, zz)); // the two columns
  // the fireplace mass: stone, rising through both roofs
  vol(0.024, 0.19, 0.05, L.x - 0.05, 0.095, L.z - 0.055);
  for (let y = 0.02; y < 0.19; y += 0.022) seg(minorPts, V(L.x - 0.062, y, L.z - 0.0295), V(L.x - 0.038, y, L.z - 0.0295)); // coursing
  // the garage wing, set back, its door panels
  const G = { w: 0.12, h: 0.058, d: 0.12, x: -0.29, z: -0.035 };
  vol(G.w, G.h, G.d, G.x, G.h / 2, G.z);
  vol(G.w + 0.014, 0.005, G.d + 0.014, G.x, G.h + 0.0025, G.z);
  for (const dx of [-0.03, 0.03]) {
    poly(minorPts, [V(G.x + dx - 0.024, 0, G.z + G.d / 2 + 0.0006), V(G.x + dx - 0.024, 0.042, G.z + G.d / 2 + 0.0006), V(G.x + dx + 0.024, 0.042, G.z + G.d / 2 + 0.0006), V(G.x + dx + 0.024, 0, G.z + G.d / 2 + 0.0006)]);
    for (let y = 0.0105; y < 0.042; y += 0.0105) seg(minorPts, V(G.x + dx - 0.024, y, G.z + G.d / 2 + 0.0007), V(G.x + dx + 0.024, y, G.z + G.d / 2 + 0.0007));
  }
  // inside, seen through the glass: the stair and a partition
  for (let i = 0; i < 7; i++) {
    const t = i / 7, x = L.x + 0.06 + t * 0.07;
    seg(minorPts, V(x, t * (L.h + 0.008), L.z - 0.03), V(x, t * (L.h + 0.008), L.z + 0.01));
  }
  seg(minorPts, V(L.x + 0.06, 0, L.z - 0.03), V(L.x + 0.13, L.h + 0.008, L.z - 0.03));
  seg(minorPts, V(L.x - 0.1, 0, L.z - 0.085), V(L.x - 0.1, L.h, L.z - 0.085));
  // the terrace deck, the lap pool in it, and the exterior stair to the roof terrace
  const D = { w: 0.3, d: 0.1, x: 0.02, z: L.z + L.d / 2 + 0.05 };
  vol(D.w, 0.004, D.d, D.x, 0.002, D.z, { edges: keyPts });
  for (let x = D.x - D.w / 2 + 0.012; x < D.x + D.w / 2; x += 0.012) seg(minorPts, V(x, 0.0042, D.z - D.d / 2), V(x, 0.0042, D.z + D.d / 2)); // deck boards
  const P = { w: 0.2, d: 0.042, x: D.x + 0.03, z: D.z + 0.022 };
  poly(keyPts, [V(P.x - P.w / 2, 0.0046, P.z - P.d / 2), V(P.x + P.w / 2, 0.0046, P.z - P.d / 2), V(P.x + P.w / 2, 0.0046, P.z + P.d / 2), V(P.x - P.w / 2, 0.0046, P.z + P.d / 2)], true);
  const pw = new THREE.PlaneGeometry(P.w - 0.004, P.d - 0.004).toNonIndexed();
  pw.rotateX(-HALF_PI);
  pw.translate(P.x, 0.0044, P.z);
  pools.push(pw);
  for (let i = 0; i < 6; i++) {
    const t = i / 6, x = L.x - L.w / 2 - 0.012 - 0.0, z = L.z + L.d / 2 - 0.01 - t * 0.12;
    seg(minorPts, V(x - 0.022, t * (L.h + 0.006), z), V(x, t * (L.h + 0.006), z));
  }
  // the garden: trees (crowns as light lattices on trunks), hedges along the boundary, the drive
  const tree = (x, z, r, h) => {
    const ico = new THREE.IcosahedronGeometry(r, 0);
    const e = new THREE.EdgesGeometry(ico).attributes.position;
    for (let i = 0; i < e.count; i += 2) seg(minorPts, V(e.getX(i) + x, e.getY(i) + h, e.getZ(i) + z), V(e.getX(i + 1) + x, e.getY(i + 1) + h, e.getZ(i + 1) + z));
    seg(keyPts, V(x, 0, z), V(x, h - r * 0.7, z));
  };
  tree(0.2, -0.13, 0.034, 0.1);
  tree(0.25, 0.1, 0.028, 0.08);
  tree(-0.18, -0.16, 0.04, 0.115);
  tree(-0.36, 0.1, 0.026, 0.075);
  tree(0.06, -0.17, 0.024, 0.07);
  vol(0.26, 0.016, 0.012, -0.03, 0.008, -0.2, { edges: minorPts });
  vol(0.012, 0.016, 0.16, 0.29, 0.008, -0.05, { edges: minorPts });
  const drive = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    drive.push([G.x + 0.0 + Math.sin(t * 1.4) * 0.06, G.z + G.d / 2 + t * 0.2]);
  }
  for (const off of [-0.03, 0.03]) poly(minorPts, drive.map(([x, z]) => V(x + off, 0.001, z)));
  // the site: a boundary and two contour rings, so the house sits on its land
  const site = (rx, rz, y, n = 72) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a);
      const k = 1 / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25); // a squircle
      pts.push(V(rx * c * k, y, rz * s * k));
    }
    return pts;
  };
  poly(keyPts, site(0.4, 0.29, 0.0005), true);
  poly(minorPts, site(0.43, 0.32, -0.006, 64), true);
  poly(minorPts, site(0.47, 0.355, -0.014, 56), true);

  const lines = (pts, mat) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
  const merged = list => {
    const n = list.reduce((m, q) => m + q.attributes.position.count, 0);
    const arr = new Float32Array(n * 3);
    let o = 0;
    for (const q of list) {
      arr.set(q.attributes.position.array, o);
      o += q.attributes.position.array.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(merged(fills), fill), new THREE.Mesh(merged(pools), water), lines(minorPts, minor), lines(keyPts, line));
  inner.position.set(0.02, 0, -0.01); // turn about the middle of the plan
  inner.scale.setScalar(0.82); // the outer contour stays inside the projector's cone
  g.add(inner);
  g.userData.line = line;
  g.userData.minor = minor;
  g.userData.fill = fill;
  g.userData.water = water;
  return g;
}

/* ---------- the server: a black monolith in the back-left corner, alive with lights ---------------- */

const SERVER = { w: 0.86, d: 0.72, h: 2.36, units: 10 };
/* Hardware colours only (green link, amber disk, blue and cyan fabric, white status); crimson is kept for "needs you". */
const SRV_COLS = [['#3ddc84', 5], ['#ffb547', 3], ['#4aa3ff', 2], ['#53e3e6', 1.5], ['#e8f0ff', 2]];
/**
 * One status row per desk (named on the rack face), and some five hundred lights in one instanced field:
 * drive banks above and below the rack, four storage blades down the side that faces the room, and two
 * light strips down the front edges where data runs. Every light keeps its own rhythm.
 */
function buildServer(room) {
  const S = ROOM.server;
  const g = new THREE.Group();
  const body = std('#0e0f11', 0.82, 0.25, { envMapIntensity: 0.45 });
  const inset = std('#151619', 0.6, 0.35, { envMapIntensity: 0.5 });
  const groove = std('#050506', 0.9);
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(SERVER.d, SERVER.h, SERVER.w, 0.012, 2), body), 0, 0.05 + SERVER.h / 2, 0));
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(SERVER.d - 0.06, 0.05, SERVER.w - 0.06, 0.006, 2), std('#060607', 0.7)), 0, 0.025, 0));
  const fx = SERVER.d / 2, sz = SERVER.w / 2;
  // the front: a recessed panel with the rack face
  g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.01, SERVER.h - 0.16, SERVER.w - 0.1), inset), fx - 0.004, 0.05 + SERVER.h / 2, 0));
  // both sides: four blades between dark grooves (in the niche each side shows to the room at an angle)
  for (const sd of [1, -1]) {
    g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(SERVER.d - 0.08, SERVER.h - 0.2, 0.01), inset), 0, 0.05 + SERVER.h / 2, sd * (sz - 0.004)));
    for (let k = 0; k <= 4; k++) g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.008, SERVER.h - 0.22, 0.004), groove), -0.3 + k * 0.15, 0.05 + SERVER.h / 2, sd * (sz + 0.002)));
  }
  const live = new THREE.Group();
  live.userData.keep = true;
  const face = makeCanvas(512, 1024);
  const faceTex = canvasTexture(face);
  const units = SERVER.units, y0 = 0.62, pitch = 0.118, faceH = units * pitch + 0.04;
  const rackFace = new THREE.Mesh(new THREE.PlaneGeometry(SERVER.w - 0.22, faceH), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
  rackFace.rotation.y = HALF_PI;
  rackFace.position.set(fx + 0.002, y0 + ((units - 1) * pitch) / 2, -0.04);
  live.add(rackFace);

  // the field: every light is one instance of a small lens
  const specs = [];
  const rnd = seeded(73);
  const pickCol = () => {
    let r = rnd() * SRV_COLS.reduce((n, c) => n + c[1], 0);
    for (const [c, wgt] of SRV_COLS) if ((r -= wgt) <= 0) return c;
    return SRV_COLS[0][0];
  };
  const KINDS = [['disk', 5], ['link', 2.5], ['pulse', 1.5], ['beat', 1]];
  const pickKind = () => {
    let r = rnd() * 10;
    for (const [k, wgt] of KINDS) if ((r -= wgt) <= 0) return k;
    return 'disk';
  };
  const add = (face, a, y, w, h, o = {}) => specs.push({ face, a, y, w, h, col: lin(o.col || pickCol()), kind: o.kind || pickKind(), rate: o.rate || 0.6 + rnd() * 11, ph: rnd() * 50, duty: 0.25 + rnd() * 0.55, ...o.extra });
  // front: drive banks above and below the rack face
  for (const [yA, rows] of [[y0 + units * pitch + 0.05, 7], [0.13, 7]])
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < 15; c++) add('front', -sz + 0.085 + c * 0.0495, yA + r * 0.052, 0.03, 0.013);
  // front: per desk, a status lamp and four activity lights
  const unitIdx = [];
  for (let i = 0; i < units; i++) {
    const y = y0 + (units - 1 - i) * pitch;
    const st = specs.length;
    add('front', -sz + 0.07, y, 0.026, 0.026, { kind: 'unit', col: '#000000' });
    for (let j = 0; j < 4; j++) add('front', sz - 0.135 + j * 0.03, y, 0.016, 0.016, { kind: 'act', col: j === 0 ? '#3ddc84' : '#ffb547', extra: { j } });
    unitIdx.push(st);
  }
  // front: two light strips down the edges, where the data runs
  for (const zz of [-sz + 0.022, sz - 0.022])
    for (let j = 0; j < 30; j++) add('front', zz, 0.18 + j * 0.073, 0.008, 0.05, { kind: 'flow', col: '#bfe3ff', extra: { j, lane: zz > 0 ? 1 : 0 } });
  // both sides: four blades, each a status bar over two columns of drive lights
  for (const face of ['side', 'side2'])
    for (let bl = 0; bl < 4; bl++) {
      const bx = -0.225 + bl * 0.15;
      add(face, bx, 2.24, 0.1, 0.014, { kind: 'pulse', col: bl === 2 ? '#4aa3ff' : '#e8f0ff', rate: 0.7 + rnd() * 0.6 });
      for (let r = 0; r < 34; r++)
        for (const dx of [-0.032, 0.032]) add(face, bx + dx, 0.2 + r * 0.059, 0.03, 0.012);
    }
  const lens = new THREE.PlaneGeometry(1, 1);
  const inst = new THREE.InstancedMesh(lens, new THREE.MeshBasicMaterial({ toneMapped: false }), specs.length);
  const dummy = new THREE.Object3D(), black = new THREE.Color(0, 0, 0);
  specs.forEach((L, i) => {
    if (L.face === 'front') dummy.position.set(fx + 0.005, L.y, L.a), dummy.rotation.set(0, HALF_PI, 0);
    else if (L.face === 'side') dummy.position.set(L.a, L.y, sz + 0.005), dummy.rotation.set(0, 0, 0);
    else dummy.position.set(-L.a, L.y, -sz - 0.005), dummy.rotation.set(0, Math.PI, 0);
    dummy.scale.set(L.w, L.h, 1);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, black);
    L.i = i;
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.instanceColor.needsUpdate = true;
  inst.frustumCulled = false; // the instances sit far from the lens geometry's own bounds
  inst.userData.noCollide = true;
  inst.userData.noShadow = true;
  live.add(inst);
  g.add(live);
  g.add(placed(contactShadow(1.3, 1.4, 0.4), 0, 0.004, 0));
  // Narrow ventilation slots and a service cable at the rear of the rack.
  for(let i=0;i<9;i++) g.add(box(.012,.004,SERVER.w-.12,groove,-.25+i*.06,SERVER.h+.052,0));
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(-.30,.10,-.28),new THREE.Vector3(-.36,.035,-.38),new THREE.Vector3(-.36,.025,-.58)]);
  const conduit=new THREE.Mesh(new THREE.TubeGeometry(cable,18,.009,6),RM.rack);conduit.userData.noCollide=true;g.add(conduit);
  g.position.set(S.cx, 0, S.cz);
  g.rotation.y = S.ry;
  g.traverse(o => o.isMesh && (o.userData.pick = 'server'));
  room.add(g);
  ROOM_OBJ.server = { group: g, live, inst, specs, unitIdx, face, faceTex, units, col: new THREE.Color() };
  ROOM_OBJ.pickables.push(g);
  drawRackFace();
}

/** Labels each rack unit with the agent at that desk. */
function drawRackFace() {
  const S = ROOM_OBJ.server;
  if (!S) return;
  const c = S.face, ctx = c.getContext('2d');
  const W = c.width, Hh = c.height;
  ctx.fillStyle = '#101113';
  ctx.fillRect(0, 0, W, Hh);
  const n = S.units, ph = Hh / n;
  for (let i = 0; i < n; i++) {
    const y = i * ph;
    ctx.fillStyle = '#1b1c1f';
    roundRect(ctx, 6, y + 5, W - 12, ph - 10, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let k = 0; k < 16; k++) ctx.fillRect(W * 0.6 + k * 10, y + 16, 4, ph - 32);
    const id = typeof OFFICE_STATE !== 'undefined' ? OFFICE_STATE.order.find(a => OFFICE_STATE.agents[a].slot === i) : null;
    const a = id ? OFFICE_STATE.agents[id] : null;
    ctx.font = `600 30px ${BRAND.ui}`;
    ctx.fillStyle = a ? '#e9ebef' : '#4d5158';
    ctx.fillText(a ? a.name : `DESK ${i + 1} · OPEN`, 26, y + ph / 2 + 2);
    if (a) {
      const word = a.status === 'WAITING' ? 'NEEDS YOU' : a.paused ? 'PAUSED' : a.location !== 'desk' ? 'AWAY' : a.status;
      ctx.font = `600 20px ${BRAND.ui}`;
      ctx.fillStyle = a.status === 'WAITING' ? BRAND.crimson : a.paused ? '#8c8c8e' : '#9aa3ad';
      spacedText(ctx, word, 26, y + ph / 2 + 32, 3);
    }
  }
  S.faceTex.needsUpdate = true;
}

/* ---------- the mark, freestanding: a crimson ampersand on a black stone base ---------------------------- */

/* The sculpture: the mark's ampersand on its own, cast as a piece of art (Igor, Nov 2: the B&Co letters in steel
   with a glass ampersand read as a muddle, and the breath was invisible). The form is the mark's: a Didone '&' with
   a loop, a heavy diagonal, a bowl, a serifed arm and an upturned tail. The outline is Old Standard TT Bold's
   (SIL Open Font License 1.1), the closest clean drawing of that form: the mark itself exists only as a glossy
   render, too soft to trace. Font units, y up; one outline, two counters, nothing overlapping. */
const AMP_GLYPH = {"src":"Old Standard TT Bold U+0026 (SIL OFL 1.1)","box":[44.0,-18.0,742.0,731.0],"shapes":[{"o":"M 44 141 Q 44 65 101 23.5 Q 158 -18 248 -18 Q 310 -18 375 6.5 Q 440 31 477 61 Q 501 25 535.5 3.5 Q 570 -18 603 -18 Q 654 -18 690 18.5 Q 726 55 740 95 L 720 105 Q 706 76 690.5 59 Q 675 42 655 42 Q 631 42 609.5 67 Q 588 92 558 142 Q 601 192 646 286 Q 680 358 734 358 L 742 358 L 742 390 L 531 390 L 531 358 L 569 358 Q 585 358 596 347.5 Q 607 337 607 318 Q 607 290 588 247.5 Q 569 205 539 169 L 363 433 Q 421 476 450.5 515 Q 480 554 480 607 Q 480 636 468 664 Q 456 692 429.5 711.5 Q 403 731 361 731 Q 316 731 277.5 711.5 Q 239 692 215.5 654.5 Q 192 617 192 566 Q 192 519 203.5 488 Q 215 457 242 415 L 253 398 L 230 382 Q 138 318 91 261.5 Q 44 205 44 141","h":["M 459 88 Q 435 67 404.5 54.5 Q 374 42 340 42 Q 304 42 267.5 60 Q 231 78 207.5 112.5 Q 184 147 184 193 Q 184 234 193 263 Q 202 292 220.5 315 Q 239 338 273 369","M 436 615 Q 436 564 412.5 530.5 Q 389 497 344 463 Q 306 525 295 552.5 Q 284 580 284 622 Q 284 657 307.5 678 Q 331 699 362 699 Q 395 699 415.5 675 Q 436 651 436 615"]}]};
/** The glyph as THREE shapes `h` metres tall, centred on x, its lowest points at y = 0; `sx` narrows it. */
function glyphShapes(G, h, sx = 1) {
  const [x0, y0, x1, y1] = G.box, s = h / (y1 - y0), cx = (x0 + x1) / 2;
  const draw = (str, P) => {
    const t = str.split(' ');
    let i = 0;
    const X = () => (+t[i++] - cx) * s * sx, Y = () => (+t[i++] - y0) * s;
    while (i < t.length) {
      const c = t[i++];
      if (c === 'M') P.moveTo(X(), Y());
      else if (c === 'L') P.lineTo(X(), Y());
      else if (c === 'Q') P.quadraticCurveTo(X(), Y(), X(), Y());
    }
    P.closePath();
    return P;
  };
  return G.shapes.map(sh => {
    const shape = draw(sh.o, new THREE.Shape());
    for (const hole of sh.h) shape.holes.push(draw(hole, new THREE.Path()));
    return shape;
  });
}
/** A soft halo of the glyph (white, alpha only): its outline blurred, for the light it gives off. */
function glyphHalo(G, sx, px, margin) {
  const c = makeCanvas(px, px), ctx = c.getContext('2d');
  const [x0, y0, x1, y1] = G.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const span = Math.max((x1 - x0) * sx, y1 - y0) * (1 + 2 * margin), k = px / span;
  // drawn far off to the left with its shadow thrown back onto the canvas: only the blur lands (every browser)
  ctx.setTransform(1, 0, 0, 1, -3 * px, 0);
  ctx.beginPath();
  for (const sh of G.shapes) {
    for (const str of [sh.o, ...sh.h]) {
      const t = str.split(' ');
      let i = 0;
      const X = () => px / 2 + (+t[i++] - cx) * sx * k, Y = () => px / 2 - (+t[i++] - cy) * k;
      while (i < t.length) {
        const op = t[i++];
        if (op === 'M') ctx.moveTo(X(), Y());
        else if (op === 'L') ctx.lineTo(X(), Y());
        else if (op === 'Q') ctx.quadraticCurveTo(X(), Y(), X(), Y());
      }
      ctx.closePath();
    }
  }
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowOffsetX = 3 * px;
  for (const [blur, n] of [[px * 0.11, 2], [px * 0.045, 2], [px * 0.016, 1]]) { // a wide soft glow, a nearer one, an edge
    ctx.shadowBlur = blur;
    for (let j = 0; j < n; j++) ctx.fill('evenodd');
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return { tex, span }; // span: the canvas's width in font units
}
/** A round pool of light for the floor: white, alpha falling off softly to nothing at the rim. */
function lightPoolTexture(px = 256) {
  const c = makeCanvas(px, px), ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  for (let i = 0; i <= 10; i++) {
    const r = i / 10;
    gr.addColorStop(r, `rgba(255,255,255,${(Math.pow(1 - r, 1.8) * (1 - 0.15 * r)).toFixed(3)})`);
  }
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, px, px);
  return new THREE.CanvasTexture(c);
}
const PLINTH = { w: 1.4, d: 0.6, h: 0.14, gap: 0.035 };
const AMP = { h: 1.28, sx: 0.95, depth: 0.15, bevel: 0.009 }; // the mark's ampersand is a touch narrower than the font's
function buildSculpture(room) {
  const T = ROOM.tree;
  const g = new THREE.Group();
  const crimson = lin(BRAND.crimson);
  // the base: a low monolith of honed black stone floating on a shadow gap, a line of crimson light in the gap
  const stone = new THREE.MeshStandardMaterial({ color: lin('#141416'), roughness: 0.36, metalness: 0, envMapIntensity: 0.6, fog: false });
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(PLINTH.w, PLINTH.h - PLINTH.gap, PLINTH.d, 0.012, 3), stone), 0, PLINTH.gap + (PLINTH.h - PLINTH.gap) / 2, 0));
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(PLINTH.w - 0.12, PLINTH.gap, PLINTH.d - 0.12, 0.004, 1), std('#070708', 0.9)), 0, PLINTH.gap / 2, 0));
  const revealMat = new THREE.MeshBasicMaterial({ color: crimson.clone(), toneMapped: false, fog: false });
  const reveal = new THREE.Mesh(roundedBoxGeometry(PLINTH.w - 0.1, 0.006, PLINTH.d - 0.1, 0.003, 1), revealMat);
  reveal.position.y = PLINTH.gap - 0.004; // tucked under the slab: only its edge shows, as a line of light
  reveal.userData.noShadow = true;
  g.add(reveal);
  // the ampersand: 1.28 m of crimson lacquer, 15 cm thick, eased edges; it stands on its bowl and its tail
  const shapes = glyphShapes(AMP_GLYPH, AMP.h, AMP.sx);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: AMP.depth - 2 * AMP.bevel, bevelEnabled: true, bevelThickness: AMP.bevel, bevelSize: AMP.bevel * 0.75, bevelSegments: 3, curveSegments: 10 });
  // (lit surfaces brighten the albedo, so it is set darker to read as #a70008; the breath adds light from within)
  const lacquer = new THREE.MeshPhysicalMaterial({ color: crimson.clone().multiplyScalar(0.55), roughness: 0.36, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.16, reflectivity: 0.3, envMapIntensity: 0.35, emissive: crimson.clone(), emissiveIntensity: 0.05, fog: false });
  const amp = new THREE.Mesh(geo, lacquer);
  const foot = PLINTH.h + AMP.bevel * 0.75 - 0.005; // sunk a few millimetres into the stone
  amp.position.set(0, foot, -(AMP.depth - 2 * AMP.bevel) / 2);
  g.add(amp);
  // its glow: a soft halo just behind it (seen round its edges and through its counters) …
  const H = glyphHalo(AMP_GLYPH, AMP.sx, 512, 0.3);
  const [, gy0, , gy1] = AMP_GLYPH.box, gs = AMP.h / (gy1 - gy0);
  const haloSize = H.span * gs;
  const haloMat = new THREE.MeshBasicMaterial({ color: crimson.clone(), map: H.tex, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false, fog: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(haloSize, haloSize), haloMat);
  halo.position.set(0, foot + ((gy0 + gy1) / 2 - gy0) * gs, -AMP.depth / 2 - 0.004);
  halo.renderOrder = 3;
  // … its light on the black stone it stands on, and a pool of it on the floor round the base (painted light: a real
  // lamp this close put a hot white point in the lacquer)
  const poolTex = lightPoolTexture();
  const topMat = new THREE.MeshBasicMaterial({ color: crimson.clone(), map: poolTex, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false, fog: false });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(PLINTH.w - 0.05, PLINTH.d - 0.05), topMat);
  top.rotation.x = -HALF_PI;
  top.position.y = PLINTH.h + 0.0015;
  top.renderOrder = 2;
  const poolMat = new THREE.MeshBasicMaterial({ color: crimson.clone(), map: poolTex, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false, fog: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), poolMat);
  pool.rotation.x = -HALF_PI;
  pool.position.y = 0.0035;
  pool.renderOrder = 2;
  for (const o of [halo, top, pool]) {
    o.userData.noShadow = true;
    o.raycast = () => {}; // light, not a thing: clicks pass through to the floor and the room
    g.add(o);
  }
  const shadow = contactShadow(1.75, 0.95, 0.4);
  shadow.position.y = 0.0045;
  shadow.renderOrder = 2;
  g.add(shadow);
  g.traverse(o => {
    if (o.isMesh && o !== halo && o !== top && o !== pool) o.userData.pick = 'sculpture';
  });
  g.position.set(T.x, 0, T.z);
  g.rotation.y = 0; // square to the room: it reads true as you look in toward the Forum screen
  g.userData.keep = true;
  room.add(g);
  ROOM_OBJ.sculpture = { group: g, lacquer, haloMat, topMat, poolMat, revealMat, base: crimson.clone(), k: 0, fast: false, checkT: 0, phase: 0 };
  ROOM_OBJ.pickables.push(g);
}

/* ---------- the lounge: bouclé, glass, flowers, and a turning holographic house ------------------- */

const BOUCLE_TEX = (() => {
  // the reference upholstery: warm ivory loops with fine, softly shaded yarn
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rnd = seeded(83);
  ctx.fillStyle = '#c9c3b7';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 1.2 + rnd() * 2.2;
    ctx.fillStyle = `rgba(150,140,124,${0.06 + rnd() * 0.07})`;
    ctx.beginPath();
    ctx.arc(x + 0.8, y + 0.9, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(240,235,224,${0.32 + rnd() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, 0, TAU);
    ctx.fill();
  }
  const t = canvasTexture(c, { repeat: true });
  t.repeat.set(3, 3);
  return t;
})();
const BOUCLE = new THREE.MeshStandardMaterial({ map: BOUCLE_TEX, bumpMap: BOUCLE_TEX, bumpScale: 0.0025, roughness: 1, metalness: 0, envMapIntensity: 0.3, fog: false });
const BOUCLE_WELT = std('#5f5e5b', 0.95); // the piping along the edges, a shade darker
const CUSHION_FELT = std('#3d3e41', 0.97);
const GLASS_TOP = new THREE.MeshPhysicalMaterial({ color: lin('#d4e3df'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.5, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false, fog: false });
const GLASS_LEG = new THREE.MeshPhysicalMaterial({ color: lin('#e8d9bd'), roughness: 0.08, metalness: 0, transparent: true, opacity: 0.5, envMapIntensity: 1.2, depthWrite: false, fog: false });

/** An original low bouclé armchair (seat 40 cm): a deep round seat inside one continuous rounded back-and-arms. */
const ARMCHAIR_SEAT = 0.4;
function boucleArmchair() { return referenceBoucleChair(); }

/** Reference-shaped white-oak coffee table (36 cm) on two cylindrical bases. */
function oakCoffeeTable() { return referenceOakTable(); }

/** A curved bouclé sofa (seat 42 cm): the seat follows an arc, the back rolls round it and rises into an arm. */
const SOFA_SEAT = 0.42;
function curvedSofa(C, seatsOut) { return referenceCurvedSofa(C, seatsOut); }

function buildLounge(room) {
  const L = ROOM.lounge;
  const g = new THREE.Group();
  const rug = new THREE.Mesh(roundedBoxGeometry(4.5, 0.012, 2.8, 0.006, 2), MAT.oatmeal);
  rug.position.set(L.x, 0.006, L.z);
  g.add(rug);
  const inner = new THREE.Mesh(roundedBoxGeometry(4.2, 0.0135, 2.5, 0.006, 2), std('#e6dfd2', 1));
  inner.position.set(L.x, 0.0072, L.z);
  g.add(inner);
  ROOM_OBJ.loungeSeats = [];
  ROOM_OBJ.loungeChairs = [];
  ROOM_OBJ.loungeSofa = curvedSofa({ x: L.x - 0.35, z: L.z }, ROOM_OBJ.loungeSeats);
  g.add(ROOM_OBJ.loungeSofa);
  // two bouclé armchairs facing the sofa across the oak table
  for (const dz of [-0.62, 0.62]) {
    const ch = boucleArmchair();
    ROOM_OBJ.loungeChairs.push(ch);
    ch.position.set(L.x + 1.6, 0, L.z + dz);
    ch.rotation.y = -HALF_PI + (dz < 0 ? 0.2 : -0.2);
    g.add(ch);
    const f = -HALF_PI + (dz < 0 ? 0.2 : -0.2);
    ROOM_OBJ.loungeSeats.push({ x: L.x + 1.6 + Math.sin(f) * 0.03, z: L.z + dz + Math.cos(f) * 0.03, face: f, lift: ARMCHAIR_SEAT - DIM.seatTop - 0.02, taken: false, area: 'lounge' });
  }
  const tb = oakCoffeeTable();
  ROOM_OBJ.coffeeTable = tb;
  tb.position.set(L.x - 0.12, 0, L.z);
  tb.rotation.y = 0.15;
  g.add(tb);
  const pot = PLANTS.bloom(31, 0.42, 'bowl');
  pot.position.set(L.x - 0.42, tb.userData.top, L.z - 0.05);
  g.add(pot);
  // the house, turning above the oak table
  const holo = new THREE.Group();
  holo.position.set(L.x + 0.18, tb.userData.top, L.z + 0.02);
  holo.userData.keep = true;
  const proj = holoProjector(0.36, 0.32);
  holo.add(proj);
  const house = holoHouse();
  house.position.y = 0.36;
  holo.add(house);
  g.add(holo);
  ROOM_OBJ.holoHouse = { group: holo, house, coneMat: proj.userData.coneMat, glow: 0 };
  // arc floor lamp, and a fig by the glass
  const lamp = new THREE.Group();
  lamp.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 32), MAT.aluDark), 0, 0.02, 0));
  const arcPts = [new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, 0.26, 0)];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 0.62;
    arcPts.push(new THREE.Vector3(Math.sin(a) * 0.95, 0.04 + Math.sin(a + 0.25) * 1.75 + i * 0.012, 0));
  }
  const arcTube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 56, 0.013, 8), MAT.alu);
  arcTube.userData.noCollide = true; // overhead; the base and the shade are what a body can meet
  lamp.add(arcTube);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16, 0, TAU, 0, HALF_PI), MAT.white);
  const end = arcPts[arcPts.length - 1];
  shade.position.set(end.x, end.y - 0.05, 0);
  lamp.add(shade);
  lamp.position.set(L.x - 2.0, 0, L.z - 1.5);
  lamp.rotation.y = -0.92; // the shade hangs over the sofa's north seat, clear of the way in
  g.add(lamp);
  const fig = PLANTS.fig(21, 1.0, { limit: { x0: -0.5, x1: 9, z0: -9, z1: 9 } }); // (clear of the west wall)
  fig.position.set(-7.45, 0, 2.55);
  g.add(fig);
  room.add(g);
}

/* ---------- the study: Igor's two personal assistants, front-right, on their own stone floor ---------- */

/** Honed dark limestone for the study's floor inlay: the one place the floor changes, so the personal zone reads from across the room. */
const STUDY_STONE_TEX = (() => {
  const c = makeCanvas(1024, 1024);
  const ctx = c.getContext('2d');
  const rnd = seeded(91);
  ctx.fillStyle = '#56565a';
  ctx.fillRect(0, 0, 1024, 1024);
  // soft clouding and a few pale fossil flecks, as in a honed Belgian blue
  for (let i = 0; i < 90; i++) {
    const g = ctx.createRadialGradient(rnd() * 1024, rnd() * 1024, 0, 0, 0, 0);
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '70,71,74' : '58,58,60'},${0.08 + rnd() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * 1024, rnd() * 1024, 60 + rnd() * 260, 30 + rnd() * 140, rnd() * Math.PI, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(190,188,182,${0.06 + rnd() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * 1024, rnd() * 1024, 0.6 + rnd() * 2.2, 0.4 + rnd() * 1.1, rnd() * Math.PI, 0, TAU);
    ctx.fill();
  }
  return canvasTexture(c, { repeat: true });
})();
const STUDY_STONE = new THREE.MeshStandardMaterial({ map: STUDY_STONE_TEX, roughness: 0.42, metalness: 0, envMapIntensity: 0.6, fog: false });

/** The mail tray on the console: an aluminium tray whose stack of paper is only ever as tall as the personal queue it mirrors. */
function mailTray() {
  const g = new THREE.Group();
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.34, 0.008, 0.25, 0.003, 2), MAT.aluDark), 0, 0.004, 0));
  for (const sx of [-1, 1]) g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.008, 0.055, 0.25, 0.002, 1), MAT.aluDark), sx * 0.166, 0.0315, 0));
  g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.34, 0.055, 0.008, 0.002, 1), MAT.aluDark), 0, 0.0315, -0.121));
  // the stack: scaled in y by the queue, nothing shown when there is nothing
  const stack = new THREE.Mesh(roundedBoxGeometry(0.297, 1, 0.21, 0.001, 1), PAPER);
  stack.position.set(0, 0.008, 0.005);
  stack.scale.y = 0.0001;
  stack.visible = false;
  stack.geometry.translate(0, 0.5, 0);
  g.add(stack);
  g.userData.stack = stack;
  g.traverse(o => o.isMesh && (o.userData.noCollide = true));
  return shadowAll(g, true, false);
}

/** Front-right: the study. Two standard workstations side by side facing the room, on a dark stone inlay, with a slim oak console
 *  against the east glass. Business robots never sit here; it belongs to Igor's two personal assistants. */
function buildStudy(room) {
  const S = ROOM.study, I = S.inlay;
  const g = new THREE.Group();
  g.name = 'study';
  // the inlay: honed dark stone set flush into the tile, an aluminium hairline round it
  STUDY_STONE_TEX.repeat.set((I.x1 - I.x0) / 2.2, (I.z1 - I.z0) / 2.2);
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(I.x1 - I.x0, I.z1 - I.z0), STUDY_STONE);
  slab.rotation.x = -HALF_PI;
  slab.position.set((I.x0 + I.x1) / 2, 0.0035, (I.z0 + I.z1) / 2);
  slab.receiveShadow = true;
  slab.userData.noCollide = true;
  g.add(slab);
  const hair = 0.012;
  for (const [x, z, w, d] of [[(I.x0 + I.x1) / 2, I.z0, I.x1 - I.x0 + hair, hair], [(I.x0 + I.x1) / 2, I.z1, I.x1 - I.x0 + hair, hair], [I.x0, (I.z0 + I.z1) / 2, hair, I.z1 - I.z0], [I.x1, (I.z0 + I.z1) / 2, hair, I.z1 - I.z0]]) {
    const h = box(w, 0.004, d, MAT.alu, x, 0.004, z);
    h.userData.noCollide = true;
    h.userData.noShadow = true;
    g.add(h);
  }
  // the console against the east glass: white oak, a single long drawer, on a recessed graphite plinth
  const C = S.console;
  const con = new THREE.Group();
  con.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w, 0.55, C.d, 0.008, 3), MAT.oak), 0, 0.09 + 0.275, 0));
  con.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w - 0.14, 0.07, C.d - 0.1, 0.004, 2), MAT.graphite), 0, 0.045, 0));
  con.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w - 0.06, 0.012, C.d - 0.06, 0.002, 1), MAT.oakB), 0, 0.09 + 0.55 + 0.006, 0)); // the top, a shade darker: a second board
  const groove = box(0.004, 0.16, C.d - 0.08, RM.gap, -C.w / 2 + 0.005, 0.49, 0); // the drawer's finger pull, a dark slot down the room-facing face
  con.add(groove);
  con.position.set(C.x, 0, C.z);
  addProxy(con, C.w, 0.65, C.d, 0, 0.33, 0);
  con.add(placed(contactShadow(C.w + 0.3, C.d + 0.3, 0.3), 0, 0.004, 0));
  g.add(shadowAll(con));
  const tray = mailTray();
  tray.rotation.y = -HALF_PI; // open side toward the desks
  tray.position.set(C.x - 0.04, 0.09 + 0.55 + 0.012, C.z + 0.34);
  g.add(tray);
  ROOM_OBJ.mailTray = tray;
  const pot = PLANTS.bloom(27, 0.62, 'bowl');
  pot.position.set(C.x, 0.09 + 0.55 + 0.012, C.z - 0.42);
  g.add(pot);
  buildStudyGlass(g);
  room.add(g);
}

/** The study's glass: a screen, not a room. Clear panes in slim aluminium, a floor channel, posts at the pane joints; stopping
 *  short of the ceiling so the light and the view stay shared. The aisle-side run leaves a way in at each end, and the west
 *  return closes the side toward the sculpture. Panes collide (walkers steer round them); they cast no shadow. */
const STUDY_GLASS = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.07, ior: 1.25, envMapIntensity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false }); // low-iron glass: seen edge-on from the desks it must not read as a white wall
function buildStudyGlass(g) {
  const S = ROOM.study, I = S.inlay, G = S.glass, H = G.h;
  const pane = (len, x, z, alongX) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.05), STUDY_GLASS);
    m.userData.noShadow = true;
    m.userData.collide = true;
    if (!alongX) m.rotation.y = HALF_PI;
    m.position.set(x, 0.03 + (H - 0.05) / 2, z);
    g.add(m);
  };
  const post = (x, z) => g.add(box(0.035, H, 0.035, MAT.alu, x, H / 2, z));
  const channel = (len, x, z, alongX) => { const c = box(alongX ? len : 0.06, 0.03, alongX ? 0.06 : len, MAT.alu, x, 0.015, z); c.userData.noShadow = true; g.add(c); };
  const cap = (len, x, z, alongX) => g.add(box(alongX ? len : 0.05, 0.035, alongX ? 0.05 : len, MAT.alu, x, H - 0.0175, z));
  // the aisle side: two panes between the two ways in
  const z0 = I.z0 + 0.03, run = G.run.x1 - G.run.x0;
  pane(run, (G.run.x0 + G.run.x1) / 2, z0, true);
  channel(run, (G.run.x0 + G.run.x1) / 2, z0, true);
  cap(run, (G.run.x0 + G.run.x1) / 2, z0, true);
  for (let i = 0; i <= 2; i++) post(G.run.x0 + (i / 2) * run, z0); // two panes: the middle post lands in the gap between the two desks, never across a monitor
  // the west return, from the aisle side to the south glass
  const xw = I.x0 + 0.03, zs = ROOM.D / 2 - 0.12, retLen = zs - z0;
  pane(retLen, xw, (z0 + zs) / 2, false);
  channel(retLen, xw, (z0 + zs) / 2, false);
  cap(retLen, xw, (z0 + zs) / 2, false);
  for (let i = 0; i <= 2; i++) post(xw, z0 + (i / 2) * retLen);
}

/* ---------- the entrance: aluminium and glass, the wordmark etched ----------------- */

/**
 * The etched wordmark, split at the seam of the double door: "BEYDER" ends on the
 * left leaf and "&CO." begins on the right, set so the gap across the meeting
 * stiles equals the tracking between every other letter. Closed, it reads as one
 * unbroken BEYDER&CO.; it parts as the doors slide open.
 */
const DOOR_ETCH = { W: 1024, H: 256, font: 112, track: 34, stile: 0.012 };
function etchedHalf(which, leafW) {
  const E = DOOR_ETCH;
  const c = makeCanvas(E.W, E.H);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, E.W, E.H);
  ctx.textBaseline = 'alphabetic';
  const base = E.H * 0.68;
  const stilePx = (E.stile / leafW) * E.W;
  const parts = which === 'left'
    ? [['BEYDER', `500 ${E.font}px ${BRAND.ui}`, 'rgba(10,10,10,0.9)']]
    : [['&', `italic 500 ${E.font}px ${BRAND.ui}`, BRAND.crimson], ['CO.', `500 ${E.font}px ${BRAND.ui}`, 'rgba(10,10,10,0.9)']]; // ink: the glass stands in front of white plaster and aluminium
  // lay out glyph by glyph with even tracking, measuring ink so the seam gap is exact
  const glyphs = [];
  for (const [text, font, col] of parts) {
    ctx.font = font;
    for (const ch of text) {
      const m = ctx.measureText(ch);
      const left = m.actualBoundingBoxLeft != null ? m.actualBoundingBoxLeft : 0;
      const right = m.actualBoundingBoxRight != null ? m.actualBoundingBoxRight : m.width;
      glyphs.push({ ch, font, col, left, right, adv: m.width });
    }
  }
  let x = 0;
  const placed = glyphs.map((g, k) => {
    const gx = k === 0 ? g.left : x + g.left;
    x = gx + g.right + E.track;
    return { ...g, x: gx };
  });
  const inkL = placed[0].x - placed[0].left;
  const inkR = placed[placed.length - 1].x + placed[placed.length - 1].right;
  // half the tracking each side of the seam: the slim stiles sit inside the gap, never on a letter
  const half = Math.max(E.track / 2, stilePx + 3);
  const shift = which === 'left' ? E.W - half - inkR : half - inkL;
  ctx.shadowColor = 'rgba(255,255,255,0.35)';
  ctx.shadowBlur = 3;
  for (const g of placed) {
    ctx.font = g.font;
    ctx.fillStyle = g.col;
    ctx.fillText(g.ch, g.x + shift, base);
  }
  return canvasTexture(c);
}

function buildDoor(room) {
  const { z0, z1 } = ROOM.door;
  const x = ROOM.x0 - 0.02;
  const H = 2.45;
  const g = new THREE.Group();
  g.add(box(0.12, H + 0.1, 0.07, MAT.alu, x, (H + 0.1) / 2, z0 - 0.035));
  g.add(box(0.12, H + 0.1, 0.07, MAT.alu, x, (H + 0.1) / 2, z1 + 0.035));
  g.add(box(0.12, 0.1, z1 - z0 + 0.14, MAT.alu, x, H + 0.05, (z0 + z1) / 2));
  const tr = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0 + 0.14, ROOM.H - H - 0.1), MAT.glass);
  tr.rotation.y = HALF_PI;
  tr.position.set(x, H + 0.1 + (ROOM.H - H - 0.1) / 2, (z0 + z1) / 2);
  g.add(tr);
  // a sensor light that wakes as someone approaches
  const sensorMat = new THREE.MeshBasicMaterial({ color: lin('#ffffff'), transparent: true, opacity: 0.25, toneMapped: false });
  const sensor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.012), sensorMat);
  sensor.rotation.y = HALF_PI;
  sensor.position.set(x + 0.061, H + 0.05, (z0 + z1) / 2);
  g.add(sensor);
  // two leaves in one track, meeting on a pair of slim stiles
  const leafW = (z1 - z0) / 2;
  const leaves = [];
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.01, H - 0.04), MAT.glassDoor);
    glass.rotation.y = HALF_PI;
    glass.userData.noShadow = true;
    leaf.add(glass);
    const St = DOOR_ETCH.stile;
    leaf.add(box(0.03, H - 0.02, St, MAT.alu, 0, 0, -s * (leafW / 2 - St / 2)));
    leaf.add(box(0.03, H - 0.02, 0.025, MAT.alu, 0, 0, s * (leafW / 2 - 0.0125)));
    leaf.add(box(0.03, 0.025, leafW, MAT.alu, 0, H / 2 - 0.0125, 0));
    leaf.add(box(0.03, 0.025, leafW, MAT.alu, 0, -H / 2 + 0.0125, 0));
    for (const fx of [-1, 1]) {
      const pz = -s * (leafW / 2 - 0.09);
      leaf.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.7, 20), FMAT.polished), fx * 0.055, -0.18, pz));
      for (const dy of [-0.27, 0.27]) {
        const so = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 12), FMAT.polished);
        so.rotation.z = HALF_PI;
        so.position.set(fx * 0.03, -0.18 + dy, pz);
        leaf.add(so);
      }
    }
    // the room side reads left to right from south to north: the south leaf carries BEYDER
    const tex = etchedHalf(s > 0 ? 'left' : 'right', leafW);
    const etch = new THREE.Mesh(new THREE.PlaneGeometry(leafW, leafW / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    etch.rotation.y = HALF_PI;
    etch.position.set(0.004, 0.32, 0);
    etch.userData.noShadow = true;
    leaf.add(etch);
    const restZ = (z0 + z1) / 2 + s * (leafW / 2);
    leaf.position.set(x + 0.03, H / 2, restZ);
    leaf.userData = { restZ, openZ: restZ + s * (leafW - 0.06), s, keep: true };
    leaf.traverse(o => (o.userData.noCollide = true));
    g.add(leaf);
    leaves.push(leaf);
  }
  room.add(g);
  ROOM_OBJ.door = { leaves, open: 0, target: 0, sensorMat };
}

function buildVestibule(room) {
  const v = ROOM.vestibule;
  const g = new THREE.Group();
  const w = v.x1 - v.x0, d = v.z1 - v.z0;
  const cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
  g.add(box(w, 0.5, d, RM.slabEdge, cx, -0.275, cz));
  const fl = floorPlane(w, d);
  fl.position.set(cx, 0.002, cz);
  g.add(fl);
  g.add(box(w, ROOM.H, 0.12, MAT.plaster, cx, ROOM.H / 2, v.z0 - 0.06));
  // the lift wall: plaster with an opening the doors close over, and the shaft beyond it
  const liftZc = ROOM.door.zc, OW = 1.12, OH = 2.3;
  const zs = v.z0, zn = v.z1, oz0 = liftZc - OW / 2, oz1 = liftZc + OW / 2;
  g.add(box(0.14, ROOM.H, oz0 - zs, MAT.plaster, v.x0 - 0.07, ROOM.H / 2, (zs + oz0) / 2));
  g.add(box(0.14, ROOM.H, zn - oz1, MAT.plaster, v.x0 - 0.07, ROOM.H / 2, (oz1 + zn) / 2));
  g.add(box(0.14, ROOM.H - OH, OW, MAT.plaster, v.x0 - 0.07, OH + (ROOM.H - OH) / 2, liftZc));
  const cab = new THREE.Group();
  const CD = 1.25, cx0 = v.x0 - 0.14, CW = 1.5;
  cab.add(box(CD, 0.02, CW, RM.cabFloor, cx0 - CD / 2, 0.01, liftZc));
  cab.add(box(0.02, OH + 0.02, CW, RM.cabMirror, cx0 - CD - 0.01, OH / 2, liftZc));
  for (const sz of [-1, 1]) cab.add(box(CD, OH, 0.02, MAT.alu, cx0 - CD / 2, OH / 2, liftZc + sz * (CW / 2 + 0.01)));
  cab.add(box(CD, 0.02, CW, MAT.alu, cx0 - CD / 2, OH + 0.01, liftZc));
  cab.add(box(CD - 0.2, 0.004, CW - 0.24, new THREE.MeshBasicMaterial({ color: lin('#fbf7f0'), toneMapped: false }), cx0 - CD / 2, OH - 0.002, liftZc));
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, CW - 0.2, 18), FMAT.polished);
  rail.rotation.x = HALF_PI;
  rail.position.set(cx0 - CD + 0.06, 0.92, liftZc);
  cab.add(rail);
  for (const dz of [-1, 1]) cab.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), FMAT.polished), cx0 - CD + 0.035, 0.92, liftZc + dz * (CW / 2 - 0.22)));
  cab.children[cab.children.length - 1].rotation.z = HALF_PI;
  cab.children[cab.children.length - 2].rotation.z = HALF_PI;
  const panel = new THREE.Group();
  panel.add(box(0.012, 0.42, 0.12, FMAT.glassBlack, 0, 0, 0));
  for (let i = 0; i < 6; i++) panel.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 16), FMAT.polished), 0.008, 0.13 - i * 0.05, 0));
  panel.children.slice(1).forEach(o => (o.rotation.z = HALF_PI));
  panel.position.set(cx0 - 0.28, 1.15, liftZc + CW / 2 - 0.008);
  panel.rotation.y = HALF_PI; // on the cab's side wall, facing in
  cab.add(panel);
  // the shaft's outside: the core, clad in graphite panels with open joints every 600 mm, a brushed cap. From the Door view
  // this block is the first thing seen; plaster read as an unfinished white box.
  cab.add(box(CD + 0.04, ROOM.H - OH - 0.02, CW + 0.08, MAT.graphite, cx0 - CD / 2, OH + 0.02 + (ROOM.H - OH - 0.02) / 2, liftZc));
  for (const sz of [-1, 1]) cab.add(box(CD + 0.04, OH + 0.02, 0.04, MAT.graphite, cx0 - CD / 2, (OH + 0.02) / 2, liftZc + sz * (CW / 2 + 0.04)));
  cab.add(box(0.04, OH + 0.02, CW + 0.08, MAT.graphite, cx0 - CD - 0.04, (OH + 0.02) / 2, liftZc));
  for (let y = 0.6; y < ROOM.H - 0.1; y += 0.6) {
    cab.add(box(0.006, 0.012, CW + 0.1, RM.gap, cx0 - CD - 0.063, y, liftZc)); // west face
    for (const sz of [-1, 1]) cab.add(box(CD + 0.06, 0.012, 0.006, RM.gap, cx0 - CD / 2, y, liftZc + sz * (CW / 2 + 0.063))); // the sides
  }
  cab.add(box(CD + 0.08, 0.12, CW + 0.12, FMAT.satinBlack, cx0 - CD / 2, 0.06, liftZc)); // a dark base, as the plinths downstairs
  cab.add(box(CD + 0.08, 0.05, CW + 0.12, MAT.aluDark, cx0 - CD / 2, ROOM.H + 0.025, liftZc));
  cab.traverse(o => o.isMesh && (o.userData.noCollide = true));
  g.add(cab);
  // shadow gaps at the foot of the plaster
  g.add(box(w, 0.014, 0.006, RM.gap, cx, 0.007, v.z0 + 0.003));
  g.add(box(0.006, 0.014, oz0 - zs, RM.gap, v.x0 + 0.003, 0.007, (zs + oz0) / 2));
  g.add(box(0.006, 0.014, zn - oz1, RM.gap, v.x0 + 0.003, 0.007, (oz1 + zn) / 2));
  // the artwork over the bench (Igor's pick): the shuttle above the clouds, square, in the same satin-black frame and liner
  const art = new THREE.Group();
  const AW = 1.1, AH = 1.1;
  art.add(placed(new THREE.Mesh(roundedBoxGeometry(AW + 0.05, AH + 0.05, 0.045, 0.004, 1), FMAT.satinBlack), 0, 0, 0));
  const artMat = new THREE.MeshStandardMaterial({ map: ART_TEX(), roughness: 0.62, metalness: 0, envMapIntensity: 0.2, fog: false });
  if (typeof ASSETS !== 'undefined' && ASSETS.lobbyArt) {
    new THREE.TextureLoader().load(ASSETS.lobbyArt, tex => {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      artMat.map = tex;
      artMat.needsUpdate = true;
    });
  }
  const canvasArt = new THREE.Mesh(new THREE.PlaneGeometry(AW, AH), artMat);
  canvasArt.position.z = 0.0236;
  art.add(canvasArt);
  art.add(placed(new THREE.Mesh(roundedBoxGeometry(AW + 0.004, AH + 0.004, 0.04, 0.002, 1), std('#f2efe8', 0.9)), 0, 0, 0.002));
  art.children[art.children.length - 1].scale.set(1, 1, 0.5);
  art.position.set(cx + 0.15, 1.55, v.z0 + 0.03);
  art.traverse(o => o.isMesh && (o.userData.noCollide = true));
  g.add(art);
  // open to the sky like the room (a section, not a lid): a brushed cap on the two walls
  g.add(box(w + 0.14, 0.05, 0.16, MAT.aluDark, cx - 0.07, ROOM.H + 0.025, v.z0 - 0.06));
  g.add(box(0.18, 0.05, d + 0.12, MAT.aluDark, v.x0 - 0.07, ROOM.H + 0.025, cz - 0.06));
  // the lift: brushed aluminium doors, a slim portal, a small PH indicator
  const liftZ = ROOM.door.zc;
  const doors = [];
  for (const s of [-1, 1]) {
    const leaf = box(0.04, 2.2, 0.56, MAT.alu, v.x0 + 0.02, 1.1, liftZ + s * 0.29);
    leaf.userData = { restZ: liftZ + s * 0.29, openZ: liftZ + s * 0.86, keep: true };
    leaf.userData.noCollide = true;
    g.add(leaf);
    doors.push(leaf);
  }
  g.add(box(0.06, 2.34, 0.07, MAT.aluDark, v.x0 + 0.04, 1.17, liftZ - 0.62));
  g.add(box(0.06, 2.34, 0.07, MAT.aluDark, v.x0 + 0.04, 1.17, liftZ + 0.62));
  g.add(box(0.06, 0.07, 1.31, MAT.aluDark, v.x0 + 0.04, 2.34, liftZ));
  const ind = makeCanvas(256, 96);
  const ictx = ind.getContext('2d');
  ictx.fillStyle = '#0a0a0a';
  ictx.fillRect(0, 0, 256, 96);
  ictx.fillStyle = '#ffffff';
  ictx.font = `500 46px ${BRAND.ui}`;
  ictx.textBaseline = 'middle';
  spacedText(ictx, 'PH', 128, 50, 10, 'center');
  const indicator = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: canvasTexture(ind), toneMapped: false }));
  indicator.rotation.y = HALF_PI;
  indicator.position.set(v.x0 + 0.075, 2.55, liftZ);
  g.add(box(0.012, 0.15, 0.34, MAT.aluDark, v.x0 + 0.068, 2.55, liftZ)); // a slim bezel, so the plate belongs to the door assembly
  g.add(indicator);
  g.add(box(0.02, 0.025, d - 0.1, new THREE.MeshBasicMaterial({ color: lin('#ffffff'), toneMapped: false }), v.x0 + 0.01, ROOM.H - 0.06, cz));
  // oak bench with an oatmeal cushion
  const bench = new THREE.Group();
  bench.add(placed(new THREE.Mesh(roundedBoxGeometry(1.1, 0.05, 0.38, 0.02, 3), MAT.oak), 0, 0.385, 0));
  bench.add(placed(new THREE.Mesh(roundedBoxGeometry(1.04, 0.05, 0.34, 0.025, 3), MAT.oatmeal), 0, 0.435, 0));
  for (const sx of [-1, 1]) bench.add(box(0.04, 0.36, 0.32, MAT.oakB, sx * 0.48, 0.18, 0));
  bench.add(placed(contactShadow(1.5, 0.7, 0.35), 0, 0.004, 0));
  bench.position.set(cx + 0.15, 0, v.z0 + 0.26);
  g.add(shadowAll(bench));
  const pl = PLANTS.bloom(14, 0.8, 'bowl');
  pl.position.set(v.x1 - 0.42, 0, v.z1 - 0.38);
  g.add(pl);
  room.add(g);
  ROOM_OBJ.lift = { doors, open: 0, target: 0 };
}

/* ---------- per-frame life in the architecture ---------------------------------- */

function updateRoom(dt, t) {
  if (ROOM_OBJ.boardSeats) for (const s of ROOM_OBJ.boardSeats) if (s.laptop) s.laptop.update(dt, t);
  for (const key of ['door', 'lift']) {
    const o = ROOM_OBJ[key];
    if (!o) continue;
    o.open = damp(o.open, o.target, 3.4, dt);
    const k = easeInOut(clamp(o.open, 0, 1));
    (o.leaves || o.doors).forEach(l => (l.position.z = lerp(l.userData.restZ, l.userData.openZ, k)));
  }
  if (ROOM_OBJ.door) ROOM_OBJ.door.sensorMat.opacity = 0.2 + 0.8 * clamp(ROOM_OBJ.door.open * 1.6, 0, 1);
  // daylight through the north glass follows the real sky over Fort Lee
  const NW = ROOM_OBJ.northWash;
  if (NW) NW.mat.opacity = NW.base * (1 - clamp(typeof SKY !== 'undefined' && SKY.state ? SKY.state.night : 0, 0, 1));

  // the ampersand breathes; it quickens while something waits on the owner
  const L = ROOM_OBJ.logo;
  if (L) {
    const waiting = typeof OFFICE_STATE !== 'undefined' && OFFICE_STATE.approvals.length > 0;
    L.pulse += dt * (waiting ? 2.4 : 0.9);
    const k = REDUCED_MOTION ? 0.6 : 0.5 + 0.5 * Math.sin(L.pulse);
    L.glowMat.opacity = (waiting ? 0.38 : 0.26) + k * (waiting ? 0.5 : 0.3);
    if (L.ampMat) L.ampMat.color.setScalar(0.78 + k * (waiting ? 0.75 : 0.5));
  }

  // the server: one status lamp per desk (steady idle, quick when working, crimson when waiting); every other light keeps its rhythm
  const S = ROOM_OBJ.server;
  if (S && S.inst) {
    const hash = x => { const v = Math.sin(x * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const bySlot = {};
    if (typeof OFFICE_STATE !== 'undefined') for (const id of OFFICE_STATE.order) bySlot[OFFICE_STATE.agents[id].slot] = OFFICE_STATE.agents[id];
    const unitOf = {};
    S.unitIdx.forEach((st, u) => { unitOf[st] = u; for (let j = 1; j <= 4; j++) unitOf[st + j] = u; });
    const c = S.col;
    for (const L of S.specs) {
      let k;
      if (REDUCED_MOTION) k = 0.6;
      else if (L.kind === 'disk') k = hash(Math.floor(t * L.rate + L.ph) + L.i * 0.37) < L.duty ? 1 : 0.06;
      else if (L.kind === 'link') k = (t * L.rate * 0.4 + L.ph) % 1 < 0.9 ? 1 : 0.08;
      else if (L.kind === 'pulse') k = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * L.rate + L.ph));
      else if (L.kind === 'beat') { const f = (t * 0.9 + L.ph) % 1; k = f < 0.07 || (f > 0.14 && f < 0.2) ? 1 : 0.1; }
      else if (L.kind === 'flow') { const head = (t * 9 + L.lane * 13) % 42; k = Math.max(0.08, 1 - Math.abs(L.j - (30 - head)) / 2.6); }
      else if (L.kind === 'unit' || L.kind === 'act') {
        const a = bySlot[unitOf[L.i]];
        if (!a) k = 0;
        else if (L.kind === 'unit') {
          const col = a.status === 'WAITING' ? BRAND.crimson : a.paused ? '#8c8c8e' : '#dfe6ee';
          k = a.status === 'WAITING' ? 0.55 + 0.45 * Math.sin(t * 5) : a.paused ? 0.35 : a.status === 'WORKING' ? 1 : a.status === 'THINKING' ? 0.55 + 0.45 * Math.sin(t * 1.6 + L.i) : 0.4;
          c.copy(lin(col)).multiplyScalar(0.2 + 1.6 * k);
          S.inst.setColorAt(L.i, c);
          continue;
        } else {
          const act = a.status === 'WORKING' ? 1 : a.status === 'THINKING' ? 0.4 : a.status === 'WAITING' ? 0.2 : a.paused ? 0 : 0.1;
          k = act > 0 && hash(Math.floor(t * (7 + L.j * 3)) + L.i) < act * 0.7 ? 1 : 0.05;
        }
      }
      c.copy(L.col).multiplyScalar(0.05 + 1.55 * k);
      S.inst.setColorAt(L.i, c);
    }
    S.inst.instanceColor.needsUpdate = true;
  }

  // the ampersand breathes: a slow, deep breath when all is well — light swelling through the lacquer, its halo,
  // the line under the stone and the pool on the floor together — and a quick bright pulse while something real needs you
  const SC = ROOM_OBJ.sculpture;
  if (SC) {
    SC.checkT -= dt;
    if (SC.checkT <= 0) {
      SC.checkT = 0.5;
      const issues = typeof realIssues === 'function' ? realIssues() : OFFICE_STATE.approvals.filter(g => g.simulated === false);
      SC.fast = issues.length > 0;
    }
    SC.phase += dt * TAU * (SC.fast ? 1 / 0.9 : 1 / 4.8);
    const w = REDUCED_MOTION ? 0.5 : 0.5 - 0.5 * Math.cos(SC.phase);
    const k = SC.fast ? 0.55 + 0.85 * w : 0.1 + 0.9 * w;
    SC.k = damp(SC.k, k, SC.fast ? 30 : 10, dt);
    const kk = clamp(SC.k, 0, 1.4);
    SC.lacquer.emissiveIntensity = 0.02 + 0.3 * kk;
    SC.haloMat.opacity = Math.min(0.85, 0.04 + 0.48 * kk);
    SC.topMat.opacity = 0.04 + 0.42 * kk;
    SC.poolMat.opacity = 0.02 + 0.3 * kk;
    SC.revealMat.color.copy(SC.base).multiplyScalar(0.35 + 1.9 * kk);
  }

  // the study's mail tray: one sheet per queued personal task, nothing when the queue is empty (never a prop stack)
  const tray = ROOM_OBJ.mailTray;
  if (tray && typeof OFFICE_STATE !== 'undefined') {
    let n = 0;
    for (const tk of OFFICE_STATE.tasks) { const ag = OFFICE_STATE.agents[tk.agentId]; if (tk.column === 'queued' && ag && ag.zone === 'personal') n++; }
    const st = tray.userData.stack, h = Math.min(n, 14) * 0.0045;
    st.visible = h > 0;
    st.scale.y = Math.max(h, 0.0001);
  }

  // the lounge model turns, and brightens when someone is reviewing it
  const Hh = ROOM_OBJ.holoHouse;
  if (Hh) {
    const watched = typeof OFFICE_STATE !== 'undefined' && OFFICE_STATE.order.some(id => OFFICE_STATE.agents[id].location === 'lounge');
    Hh.glow = damp(Hh.glow, watched ? 1 : 0, 2, dt);
    Hh.house.rotation.y += dt * (REDUCED_MOTION ? 0 : 0.11 + Hh.glow * 0.05); // slowly: a full turn in about a minute
    Hh.house.position.y = 0.36 + Math.sin(t * 0.6) * 0.008;
    const U = Hh.house.userData, fl = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.1); // a faint projector flicker
    U.line.opacity = (0.86 + Hh.glow * 0.14) * fl;
    if (U.minor) U.minor.opacity = (0.5 + Hh.glow * 0.16) * fl;
    if (U.water) U.water.opacity = 0.24 + Hh.glow * 0.08 + 0.04 * Math.sin(t * 1.7);
    U.fill.opacity = 0.075 + Hh.glow * 0.04;
    Hh.coneMat.opacity = 0.03 + Hh.glow * 0.03;
  }

  // Bergen County hovers; a town's pin flares when the hot sheet reports there
  const M = ROOM_OBJ.holoMap;
  if (M) {
    M.plane.position.y = 0.5 + Math.sin(t * 0.7) * 0.01;
    M.mapMat.opacity = 0.5 + Math.sin(t * 0.9) * 0.03;
    for (const [name, p] of Object.entries(M.pins)) {
      p.flare = Math.max(0, p.flare - dt * 0.25);
      const k = 0.45 + 0.1 * Math.sin(t * 1.2 + name.length) + p.flare * 0.5;
      p.mat.opacity = clamp(k, 0, 1);
      p.pin.scale.setScalar(1 + p.flare * 0.8);
    }
  }
}

/** Light a town's pin on the market table (called when a hot-sheet row arrives). */
function flareTown(town) {
  const M = ROOM_OBJ.holoMap;
  if (!M || !town) return;
  const key = Object.keys(M.pins).find(k => k.toLowerCase() === String(town).toLowerCase());
  if (key) M.pins[key].flare = 1;
}

/* ---------- materials and art for the details above ---------------------------------- */

RM.cabFloor = std('#2b2b2d', 0.42, 0.1);
RM.cabMirror = new THREE.MeshPhysicalMaterial({ color: lin('#8d9296'), roughness: 0.05, metalness: 1, envMapIntensity: 1.1, fog: false });
/** An original abstract for the vestibule: raw linen, two sweeping charcoal gestures, a small crimson mark. */
function ART_TEX() {
  const W = 1024, H = 720, c = makeCanvas(W, H), ctx = c.getContext('2d'), rnd = seeded(1207);
  ctx.fillStyle = '#ece6da';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,108,90,0.05)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1);
  }
  const stroke = (pts, width, alpha) => {
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      const j = (rnd() - 0.5) * width * 0.6;
      ctx.moveTo(pts[0][0], pts[0][1] + j);
      ctx.bezierCurveTo(pts[1][0], pts[1][1] + j, pts[2][0], pts[2][1] + j, pts[3][0], pts[3][1] + j);
      ctx.strokeStyle = `rgba(28,28,30,${alpha * (0.4 + rnd() * 0.6)})`;
      ctx.lineWidth = width * (0.15 + rnd() * 0.25);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  };
  stroke([[90, 520], [300, 160], [560, 120], [880, 300]], 70, 0.55);
  stroke([[160, 610], [420, 470], [640, 560], [940, 470]], 34, 0.4);
  ctx.fillStyle = '#a70008';
  ctx.beginPath();
  ctx.arc(742, 238, 15, 0, TAU);
  ctx.fill();
  return canvasTexture(c);
}
