/* =============================================================================
   54 · THE STUDIOS — B&Co. Design | Build and B&Co. Surfaces (9.3)
   -----------------------------------------------------------------------------
   The north-east corner, where the Market Room stood, is two glass studios side
   by side, one per sister company, behind the same frameless glass:
     B&Co. Design | Build  a drafting table with the drawings laid out, a plan chest
                           with a white massing model, a rendering screen on the north glass
     B&Co. Surfaces        the materials library along the east glass (stone, wood and
                           tile samples on black ledges), a book-matched slab on an easel,
                           a selection counter with a scheme laid out on it
   Each glass section is one pane, with no line across it; the partition between the
   two studios meets the façade on its mullion. The names are etched on the south glass
   in the house serif, the ampersand crimson italic. Colour stays with the brand: ink,
   white, crimson #a70008 only as punctuation, the materials in their own natural tones
   (no gold, no brass). The hot sheet and the shared meetings moved to the Forum.
   ============================================================================= */

const STUDIO_SERIF = 'Didot, "Didot LP", "Bodoni 72", "Bodoni Moda", "Playfair Display", "Cormorant Garamond", "Times New Roman", serif';
const STUDIO_SANS = '"Avenir Next", "Bco Local", "Helvetica Neue", Arial, sans-serif';
/** Where an idle visitor stands in each studio, and the way in (outside the glass, then just inside the door). */
const STUDIO_SPOTS = {
  design: { stand: [4.3, -3.4], face: Math.PI, inside: [3.9, -3.3], outside: [3.95, -2.5] },
  surfaces: { stand: [7.12, -4.45], face: HALF_PI, inside: [6.15, -3.3], outside: [6.15, -2.5] },
};

function buildStudios(room) {
  const S = ROOM.studios, { x1, z0, H } = ROOM, zE = S.zEdge;
  const g = new THREE.Group();
  g.name = 'studios';
  // the façade behind both studios: the same clear glass as the rest of the north wall, its mullion where the partition meets it
  glassRun(g, 'x', ROOM.feature, x1, z0 - 0.02, 2);
  // the glass: the west side (the Forum's east wall), the partition, and the south fronts, each one pane. A pane stops short of
  // the markets band where the band passes along the wall it meets (buildTicker), so the band runs on unbroken.
  const TK = tickerLines(), yCut = ROOM.ticker.y - (ROOM.ticker.h + 0.035) / 2 - 0.006;
  const side = x => {
    const p = new THREE.Mesh(notchedPaneGeometry(zE - z0, H, TK.zN + TK.F + 0.003 - z0, yCut), MAT.glass);
    p.rotation.y = HALF_PI;
    p.position.set(x, H / 2, (z0 + zE) / 2);
    g.add(p);
    g.add(box(0.05, 0.03, zE - z0, MAT.alu, x, 0.015, (z0 + zE) / 2)); // the floor channel
    g.add(box(0.035, H, 0.035, MAT.alu, x, H / 2, zE)); // the post at its open end
  };
  side(S.x0);
  side(S.xm);
  const dbA = S.doorDB[1], dbB = S.xm;
  const dbPane = new THREE.Mesh(new THREE.PlaneGeometry(dbB - dbA, H), MAT.glass);
  dbPane.position.set((dbA + dbB) / 2, H / 2, zE);
  g.add(dbPane);
  const sfA = S.doorSF[1];
  const sfPane = new THREE.Mesh(notchedPaneGeometry(x1 - sfA, H, x1 - (TK.xE - TK.F - 0.003), yCut), MAT.glass);
  sfPane.position.set((sfA + x1) / 2, H / 2, zE);
  g.add(sfPane);
  for (const x of [dbA, sfA]) g.add(box(0.035, H, 0.035, MAT.alu, x, H / 2, zE));
  g.add(box(dbB - dbA, 0.03, 0.05, MAT.alu, (dbA + dbB) / 2, 0.015, zE));
  g.add(box(x1 - sfA, 0.03, 0.05, MAT.alu, (sfA + x1) / 2, 0.015, zE));

  // the names, etched on the south glass where the open floor reads them
  g.add(placed(studioSign('01', 'Design | Build', 1.04), (dbA + dbB) / 2, 1.58, zE + 0.004));
  g.add(placed(studioSign('02', 'Surfaces', 1.04), (sfA + x1) / 2 - 0.04, 1.58, zE + 0.004));

  buildDesignBuild(g);
  buildSurfaces(g);
  room.add(g);
}

/** An etched name for a studio's glass: a crimson section number, then "B&Co." in the house serif (its ampersand crimson
 *  italic) and the discipline. Reads from the open floor (it faces south); from inside the studio the glass is clear. */
function studioSign(num, name, w) {
  const W = 2048, Hc = 400, c = makeCanvas(W, Hc), ctx = c.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, W, Hc);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = BRAND.crimson;
    ctx.font = `600 54px ${STUDIO_SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '14px';
    ctx.fillText(num, 8, 92);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    let size = 170;
    const parts = [['B', false, BRAND.ink], ['&', true, BRAND.crimson], ['Co. ' + name, false, BRAND.ink]];
    const fontOf = it => `${it ? 'italic ' : ''}400 ${size}px ${STUDIO_SERIF}`;
    const width = () => parts.reduce((s, [t, it]) => ((ctx.font = fontOf(it)), s + ctx.measureText(t).width), 0);
    size *= Math.min(1, (W - 20) / width());
    let x = 6;
    for (const [t, it, col] of parts) {
      ctx.font = fontOf(it);
      ctx.fillStyle = col;
      ctx.fillText(t, x, 300);
      x += ctx.measureText(t).width;
    }
  };
  draw();
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(() => { draw(); tex.needsUpdate = true; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * Hc) / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  m.userData.noShadow = true;
  m.userData.noCollide = true;
  m.raycast = () => {};
  return m;
}

/* ---------- B&Co. Design | Build ------------------------------------------------------- */

const STUDIO_MAT = {
  paper: new THREE.MeshStandardMaterial({ color: lin('#fbfbf8'), roughness: 0.92, metalness: 0, envMapIntensity: 0.3, fog: false }),
  model: std('#f7f6f3', 0.75),
  ledge: std('#141416', 0.42, 0.4, { envMapIntensity: 0.7 }),
  board: std('#111113', 0.6, 0.1),
  sampleEdge: std('#d9d6d0', 0.7),
};

function buildDesignBuild(g) {
  const S = ROOM.studios, z0 = ROOM.z0;
  // the rendering screen: translucent LED glass on the north glass, like every screen in the office
  const RS = { x: (S.x0 + S.xm) / 2, y: 1.6, z: z0 + 0.03, w: 1.8, h: 1.0125 };
  const rg = new THREE.Group();
  const bezel = ledFrame(RS.w, RS.h);
  rg.add(bezel);
  const rc = makeCanvas(1920, 1080), rtex = canvasTexture(rc);
  rtex.generateMipmaps = true;
  rtex.minFilter = THREE.LinearMipmapLinearFilter;
  const rface = new THREE.Mesh(new THREE.PlaneGeometry(RS.w, RS.h), new THREE.MeshBasicMaterial({ map: rtex, toneMapped: false, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }));
  rface.position.z = 0.006;
  rg.add(rface);
  for (const x of [-RS.w * 0.36, RS.w * 0.36]) for (const y of [-RS.h * 0.3, RS.h * 0.3]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.045, 12), MAT.alu);
    m.rotation.x = HALF_PI;
    m.position.set(x, y, -0.043);
    rg.add(m);
  }
  rg.position.set(RS.x, RS.y, RS.z);
  rg.userData.keep = true;
  g.add(rg);
  ROOM_OBJ.rendering = { canvas: rc, tex: rtex, face: rface, view: -1, t: 0 };
  drawRendering(0);

  // the drafting table: a white-oak top on two ink-black steel trestles, at standing height
  const T = { x: 4.3, z: -4.2, w: 1.3, d: 0.85, h: 0.92 };
  const tg = new THREE.Group();
  const top = new THREE.Mesh(roundedBoxGeometry(T.w, 0.035, T.d, 0.006, 2), MAT.oak);
  top.position.y = T.h - 0.0175;
  tg.add(top);
  for (const sx of [-1, 1]) {
    const x = sx * (T.w / 2 - 0.16);
    tg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, T.d - 0.08), STUDIO_MAT.ledge), x, T.h - 0.05, 0));
    for (const sz of [-1, 1]) tg.add(rodBetween(new THREE.Vector3(x, 0, sz * (T.d / 2 - 0.08)), new THREE.Vector3(x, T.h - 0.06, sz * 0.06), 0.014, STUDIO_MAT.ledge, false));
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, T.w - 0.32, 12), STUDIO_MAT.ledge);
  bar.rotation.z = HALF_PI;
  bar.position.set(0, 0.32, 0);
  tg.add(bar);
  // the drawings: the floor plan on top, the elevation under it, two rolled sheets and a scale rule
  const sheet = (tex, w, x, z, ry, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / Math.SQRT2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, envMapIntensity: 0.3, fog: false }));
    m.rotation.set(-HALF_PI, 0, ry);
    m.position.set(x, T.h + y, z);
    m.userData.noCollide = true;
    return m;
  };
  tg.add(sheet(drawingTexture('elevation'), 0.84, 0.14, 0.04, -0.06, 0.0012));
  tg.add(sheet(drawingTexture('plan'), 0.84, -0.13, -0.02, 0.035, 0.0024));
  for (const [x, z, ry, L] of [[0.47, -0.27, 0.08, 0.62], [0.5, -0.18, -0.05, 0.6]]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, L, 20), STUDIO_MAT.paper);
    roll.rotation.set(HALF_PI, 0, 0);
    roll.rotation.y = ry + HALF_PI;
    roll.position.set(x, T.h + 0.026, z);
    tg.add(roll);
  }
  const rule = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 3), MAT.white);
  rule.rotation.set(0, 0, HALF_PI);
  rule.rotation.y = 0.5;
  rule.position.set(0.38, T.h + 0.008, 0.26);
  tg.add(rule);
  tg.add(placed(contactShadow(T.w + 0.4, T.d + 0.4, 0.28), 0, 0.003, 0));
  tg.position.set(T.x, 0, T.z);
  g.add(tg);
  g.add(placed(linearPendant(1.1), T.x, 0, T.z));

  // the plan chest: wide, shallow drawers in ink-black lacquer against the partition glass, a massing model on top
  const C = { x: S.xm - 0.26, z: -5.3, w: 0.43, d: 1.2, h: 0.78 };
  const cg = new THREE.Group();
  cg.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w, C.h - 0.05, C.d, 0.008, 2), FMAT.satinBlack), 0, 0.05 + (C.h - 0.05) / 2, 0));
  cg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(C.w - 0.06, 0.05, C.d - 0.06), STUDIO_MAT.ledge), 0, 0.025, 0));
  for (let i = 0; i < 5; i++) {
    const y = 0.12 + i * 0.13;
    cg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, C.d - 0.04), MAT.aluDark), -C.w / 2 - 0.001, y + 0.06, 0)); // the drawer joint
    cg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), MAT.alu), -C.w / 2 - 0.006, y, 0)); // the pull
  }
  // the massing model: a white house in three volumes on a white base, the firm's way of showing a scheme
  const mg = new THREE.Group();
  mg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.46), STUDIO_MAT.model), 0, 0.006, 0));
  mg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.26), STUDIO_MAT.model), -0.03, 0.037, 0.04));
  mg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.3), STUDIO_MAT.model), 0.06, 0.087, -0.03));
  mg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.1), STUDIO_MAT.model), -0.09, 0.03, -0.14));
  mg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.08, 0.004), MAT.alu), -0.12, 0.052, 0.12)); // a pin for scale
  mg.position.set(0, C.h, 0.18);
  mg.rotation.y = 0.25;
  cg.add(mg);
  // a few rolls standing in a black bin at the near end
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 24, 1, true), STUDIO_MAT.ledgeTwo || (STUDIO_MAT.ledgeTwo = Object.assign(STUDIO_MAT.ledge.clone(), { side: THREE.DoubleSide })));
  bin.position.set(-0.02, 0.25, C.d / 2 + 0.17);
  cg.add(bin);
  for (const [x, z, h] of [[-0.05, 0.02, 0.78], [0.03, -0.03, 0.7], [0.0, 0.05, 0.84], [0.05, 0.04, 0.66]]) {
    cg.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, h, 14), STUDIO_MAT.paper), -0.02 + x, h / 2 + 0.01, C.d / 2 + 0.17 + z));
  }
  cg.add(placed(contactShadow(C.w + 0.3, C.d + 0.5, 0.3), 0, 0.003, 0.1));
  cg.position.set(C.x, 0, C.z);
  g.add(cg);
}

/** The rendering screen's slides: three concept renderings, changed every 14 s. */
const RENDER_SLIDES = 3, RENDER_HOLD = 14;
function updateStudios(dt) {
  const R = ROOM_OBJ.rendering;
  if (!R) return;
  R.t += dt;
  if (R.t > RENDER_HOLD && !REDUCED_MOTION) {
    R.t = 0;
    drawRendering((R.view + 1) % RENDER_SLIDES);
  }
}

/** A concept rendering on the dark LED glass: a modern two-volume residence drawn by a tiny projector (painter's order, flat
 *  shaded), lit from inside, then the caption band. Monochrome, with crimson only for the index and the ampersand. */
function drawRendering(view) {
  const R = ROOM_OBJ.rendering;
  if (!R) return;
  R.view = view;
  const c = R.canvas, ctx = c.getContext('2d'), W = c.width, H = c.height;
  const day = view === 1;
  // the sky and the ground
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  if (day) {
    sky.addColorStop(0, '#d9dadc');
    sky.addColorStop(1, '#f4f4f2');
  } else {
    sky.addColorStop(0, '#050506');
    sky.addColorStop(1, '#1d1f23');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (view !== 2) { // (the aerial looks down: no horizon)
    ctx.fillStyle = day ? '#e6e5e1' : '#0d0e10';
    ctx.fillRect(0, H * 0.68, W, H * 0.32);
  }
  // the model: [x0, x1, y0, y1, z0, z1, kind] in metres; kinds: s solid, g glass, r roof slab, p pool, d deck
  const M = [
    [-9, 9, 0, 0.45, -6, 5, 'd'],
    [-7.5, 3.5, 0.45, 3.6, -3.5, 2.5, 'g'], // the glass living wing
    [-8.6, 9.2, 3.6, 3.95, -4.2, 3.4, 'r'], // its roof plate, overhanging
    [-1, 8.5, 3.95, 7.0, -3.2, 3.0, 's'], // the bedroom wing, cantilevered east
    [-1.2, 8.7, 7.0, 7.3, -3.4, 3.2, 'r'],
    [3.5, 8.5, 0.45, 3.6, -3.5, 0.5, 's'], // the garage and stair block
    [-6.2, -4.6, 0.45, 8.1, -0.6, 0.9, 's'], // the chimney mass
    [-8, 2, 0.4, 0.47, 3.6, 6.6, 'p'], // the pool, set into the deck
  ];
  const cam = [[-14, 4.6, 22, 1.5, 3.4, 0], [16, 3.0, 19, 0.5, 3.0, 0], [-15, 22, 18, 0.5, 2.0, 0]][view];
  const [ex, ey, ez, tx, ty, tz] = cam;
  // camera basis
  let fx = tx - ex, fy = ty - ey, fz = tz - ez;
  const fl = Math.hypot(fx, fy, fz);
  fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; // right = forward × up
  const rl = Math.hypot(rx, rz);
  rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const foc = W * (view === 2 ? 0.9 : 1.05);
  const P = (x, y, z) => {
    const dx = x - ex, dy = y - ey, dz = z - ez;
    const d = dx * fx + dy * fy + dz * fz;
    return [W / 2 + ((dx * rx + dz * rz) / d) * foc, H * 0.46 - ((dx * ux + dy * uy + dz * uz) / d) * foc, d];
  };
  // two trees behind the house, drawn first as soft discs (monochrome)
  for (const [x, z, r] of view === 2 ? [] : [[-12, -7, 3.2], [12.5, -8, 2.6]]) {
    const [px, py, d] = P(x, r * 1.6, z);
    const rr = (r / d) * foc;
    ctx.fillStyle = day ? 'rgba(150,154,156,0.6)' : 'rgba(46,48,52,0.85)';
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, TAU);
    ctx.fill();
  }
  // painter's order by volume (the deck and the pool always first, then far to near), each volume's own faces far to near
  const order = M.map((v, i) => ({ v, i, d: v[6] === 'd' || v[6] === 'p' ? 1e9 - i : Math.hypot((v[0] + v[1]) / 2 - ex, (v[2] + v[3]) / 2 - ey, (v[4] + v[5]) / 2 - ez) })).sort((a, b) => b.d - a.d);
  const faces = [];
  for (const { v: [x0, x1, y0, y1, z0, z1, k], d: vd } of order) {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const quads = [[[0, 1, 2, 3], [0, 0, -1]], [[5, 4, 7, 6], [0, 0, 1]], [[4, 0, 3, 7], [-1, 0, 0]], [[1, 5, 6, 2], [1, 0, 0]], [[3, 2, 6, 7], [0, 1, 0]], [[4, 5, 1, 0], [0, -1, 0]]];
    for (const [q, n] of quads) {
      const c3 = q.map(i => v[i]);
      const cx = c3.reduce((s, p) => s + p[0], 0) / 4, cy = c3.reduce((s, p) => s + p[1], 0) / 4, cz = c3.reduce((s, p) => s + p[2], 0) / 4;
      if ((ex - cx) * n[0] + (ey - cy) * n[1] + (ez - cz) * n[2] <= 0) continue; // back face
      const pts = c3.map(p => P(...p));
      faces.push({ pts, vd, d: Math.hypot(cx - ex, cy - ey, cz - ez), k, n, c3 });
    }
  }
  faces.sort((a, b) => b.vd - a.vd || b.d - a.d);
  const lightDir = [0.45, 0.8, 0.4];
  for (const f of faces) {
    const lit = Math.max(0, f.n[0] * lightDir[0] + f.n[1] * lightDir[1] + f.n[2] * lightDir[2]);
    let fill;
    if (f.k === 'g') fill = day ? `rgb(${178 + lit * 30 | 0},${188 + lit * 30 | 0},${196 + lit * 30 | 0})` : `rgb(${200 + lit * 40 | 0},${196 + lit * 40 | 0},${188 + lit * 40 | 0})`; // glass: sky by day, lit rooms at dusk
    else if (f.k === 'p') fill = day ? '#b9c3c9' : '#2a3036';
    else if (f.k === 'd') fill = day ? `rgb(${200 + lit * 30 | 0},${198 + lit * 30 | 0},${194 + lit * 30 | 0})` : `rgb(${28 + lit * 18 | 0},${28 + lit * 18 | 0},${30 + lit * 18 | 0})`;
    else if (f.k === 'r') fill = day ? '#2b2c2f' : '#0b0b0c';
    else fill = day ? `rgb(${210 + lit * 40 | 0},${209 + lit * 40 | 0},${206 + lit * 40 | 0})` : `rgb(${40 + lit * 40 | 0},${40 + lit * 40 | 0},${43 + lit * 40 | 0})`;
    ctx.beginPath();
    f.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = day ? 'rgba(10,10,10,0.75)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // the glass wing's mullions
    if (f.k === 'g' && f.n[1] === 0) {
      const [a, b2, c2, d2] = f.c3;
      const n = 9;
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const p0 = P(a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t);
        const p1 = P(d2[0] + (c2[0] - d2[0]) * t, d2[1] + (c2[1] - d2[1]) * t, d2[2] + (c2[2] - d2[2]) * t);
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
      ctx.strokeStyle = day ? 'rgba(10,10,10,0.55)' : 'rgba(20,20,22,0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  // the caption band
  ctx.fillStyle = day ? 'rgba(255,255,255,0.9)' : 'rgba(5,5,6,0.82)';
  ctx.fillRect(0, H - 120, W, 120);
  const ink = day ? BRAND.ink : '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let x = 72;
  const seg = (t, font, col) => {
    ctx.font = font;
    ctx.fillStyle = col;
    ctx.fillText(t, x, H - 60);
    x += ctx.measureText(t).width;
  };
  seg('B', `400 50px ${STUDIO_SERIF}`, ink);
  seg('&', `italic 400 52px ${STUDIO_SERIF}`, BRAND.crimson);
  seg('Co. Design | Build', `400 50px ${STUDIO_SERIF}`, ink);
  ctx.font = `500 30px ${STUDIO_SANS}`;
  ctx.fillStyle = day ? '#5b5d61' : '#9a9da3';
  ctx.fillText(['Concept rendering · dusk', 'Concept rendering · morning', 'Concept massing · aerial'][view], x + 44, H - 58);
  ctx.textAlign = 'right';
  ctx.font = `600 34px ${STUDIO_SANS}`;
  const total = ' / 0' + RENDER_SLIDES;
  ctx.fillStyle = day ? '#5b5d61' : '#9a9da3';
  ctx.fillText(total, W - 72, H - 60);
  ctx.fillStyle = BRAND.crimson;
  ctx.fillText('0' + (view + 1), W - 72 - ctx.measureText(total).width, H - 60);
  R.tex.needsUpdate = true;
}

/** A drawing sheet (A-series, landscape): the plan or the elevation in ink on white, with a title block. */
function drawingTexture(kind) {
  const W = 1680, H = Math.round(W / Math.SQRT2), c = makeCanvas(W, H), ctx = c.getContext('2d');
  const draw = () => {
    ctx.fillStyle = '#fbfbf8';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = BRAND.ink;
    ctx.fillStyle = BRAND.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    // the title block down the right edge
    const tb = W - 330;
    ctx.beginPath();
    ctx.moveTo(tb, 36);
    ctx.lineTo(tb, H - 36);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (const y of [H - 300, H - 200, H - 120]) {
      ctx.beginPath();
      ctx.moveTo(tb, y);
      ctx.lineTo(W - 36, y);
      ctx.stroke();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    let x = tb + 26;
    const put = (t, f, col) => {
      ctx.font = f;
      ctx.fillStyle = col;
      ctx.fillText(t, x, H - 240);
      x += ctx.measureText(t).width;
    };
    put('B', `400 40px ${STUDIO_SERIF}`, BRAND.ink);
    put('&', `italic 400 42px ${STUDIO_SERIF}`, BRAND.crimson);
    put('Co.', `400 40px ${STUDIO_SERIF}`, BRAND.ink);
    ctx.font = `600 22px ${STUDIO_SANS}`;
    ctx.fillStyle = BRAND.ink;
    ctx.fillText('DESIGN | BUILD', tb + 26, H - 214);
    ctx.font = `600 52px ${STUDIO_SANS}`;
    ctx.fillText(kind === 'plan' ? 'A-101' : 'A-201', tb + 26, H - 140);
    ctx.font = `500 24px ${STUDIO_SANS}`;
    ctx.fillText(kind === 'plan' ? 'Ground floor plan' : 'South elevation', tb + 26, H - 72);
    ctx.fillStyle = '#6b6d70';
    ctx.fillText('Scale 1:50 · Concept', tb + 26, H - 46);
    // the drawing field
    const fx0 = 90, fx1 = tb - 60, fy0 = 90, fy1 = H - 90;
    if (kind === 'plan') drawPlan(ctx, fx0, fx1, fy0, fy1);
    else drawElevation(ctx, fx0, fx1, fy0, fy1);
  };
  draw();
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(() => { draw(); tex.needsUpdate = true; });
  return tex;
}

function drawPlan(ctx, x0, x1, y0, y1) {
  const u = (x1 - x0) / 22; // 22 m across the field
  const X = m => x0 + 60 + m * u, Y = m => y0 + 70 + m * u;
  // grid lines and bubbles
  ctx.save();
  ctx.setLineDash([14, 8]);
  ctx.strokeStyle = 'rgba(10,10,10,0.35)';
  ctx.lineWidth = 1.2;
  const gx = [0, 6, 12, 18], gy = [0, 5, 10];
  for (const m of gx) { ctx.beginPath(); ctx.moveTo(X(m), y0 + 20); ctx.lineTo(X(m), Y(10) + 30); ctx.stroke(); }
  for (const m of gy) { ctx.beginPath(); ctx.moveTo(x0 + 10, Y(m)); ctx.lineTo(X(18) + 30, Y(m)); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.font = `600 18px ${STUDIO_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  gx.forEach((m, i) => { ctx.beginPath(); ctx.arc(X(m), y0 + 4, 16, 0, TAU); ctx.stroke(); ctx.fillText(String(i + 1), X(m), y0 + 5); });
  gy.forEach((m, i) => { ctx.beginPath(); ctx.arc(x0 - 6, Y(m), 16, 0, TAU); ctx.stroke(); ctx.fillText('ABC'[i], x0 - 6, Y(m) + 1); });
  // walls: outer shell and partitions, poché in ink
  const wall = (ax, ay, bx, by, t = 0.3) => {
    const w = t * u;
    if (ay === by) ctx.fillRect(Math.min(X(ax), X(bx)), Y(ay) - w / 2, Math.abs(X(bx) - X(ax)), w);
    else ctx.fillRect(X(ax) - w / 2, Math.min(Y(ay), Y(by)), w, Math.abs(Y(by) - Y(ay)));
  };
  ctx.fillStyle = BRAND.ink;
  wall(0, 0, 4.2, 0); wall(6.2, 0, 18, 0);
  wall(0, 10, 2.5, 10); wall(11.5, 10, 18, 10);
  wall(0, 0, 0, 10); wall(18, 0, 18, 10);
  wall(12, 0, 12, 4); wall(12, 5.2, 12, 10, 0.15);
  wall(12, 5, 18, 5, 0.15); wall(6, 0, 6, 3.2, 0.15);
  // glazing along the south (two fine lines)
  ctx.lineWidth = 1.5;
  for (const off of [-0.06, 0.06]) { ctx.beginPath(); ctx.moveTo(X(2.5), Y(10 + off)); ctx.lineTo(X(11.5), Y(10 + off)); ctx.stroke(); }
  for (let m = 2.5; m <= 11.5; m += 1.5) ctx.fillRect(X(m) - 3, Y(10) - 6, 6, 12);
  // doors: leaf and swing
  const door = (hx, hy, r, a0, a1) => {
    ctx.beginPath(); ctx.moveTo(X(hx), Y(hy)); ctx.lineTo(X(hx) + Math.cos(a1) * r * u, Y(hy) + Math.sin(a1) * r * u); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(hx), Y(hy), r * u, a0, a1); ctx.stroke();
  };
  ctx.lineWidth = 1.4;
  door(4.2, 0, 2.0, 0, HALF_PI);
  door(12, 4, 1.0, HALF_PI, Math.PI);
  // the stair: treads between two strings
  ctx.lineWidth = 1.2;
  ctx.strokeRect(X(13), Y(1), 1.2 * u, 3.4 * u);
  for (let k = 1; k < 12; k++) { ctx.beginPath(); ctx.moveTo(X(13), Y(1 + k * 0.28)); ctx.lineTo(X(14.2), Y(1 + k * 0.28)); ctx.stroke(); }
  // the kitchen island and the hearth
  ctx.strokeRect(X(7.2), Y(5.5), 3.2 * u, 1.0 * u);
  ctx.fillRect(X(0.3), Y(4), 0.6 * u, 2.2 * u);
  // room names
  ctx.font = `500 20px ${STUDIO_SANS}`;
  ctx.fillStyle = BRAND.ink;
  for (const [t, x, y] of [['LIVING', 4, 6.6], ['KITCHEN', 8.8, 4.6], ['DINING', 8.8, 8.4], ['ENTRY', 5.2, 1.6], ['STUDY', 15, 2.6], ['GARAGE', 15, 7.6], ['TERRACE', 7, 11.4]]) ctx.fillText(t, X(x), Y(y));
  // a dimension string along the north
  ctx.lineWidth = 1;
  const dy = Y(-1.4);
  ctx.beginPath(); ctx.moveTo(X(0), dy); ctx.lineTo(X(18), dy); ctx.stroke();
  for (const m of [0, 6, 12, 18]) { ctx.beginPath(); ctx.moveTo(X(m) - 7, dy + 7); ctx.lineTo(X(m) + 7, dy - 7); ctx.stroke(); }
  ctx.font = `500 16px ${STUDIO_SANS}`;
  for (const m of [3, 9, 15]) ctx.fillText('6000', X(m), dy - 14);
  // the north arrow: the only colour on the sheet
  const nx = x1 - 40, ny = y1 - 60;
  ctx.strokeStyle = BRAND.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(nx, ny, 34, 0, TAU); ctx.stroke();
  ctx.fillStyle = BRAND.crimson;
  ctx.beginPath(); ctx.moveTo(nx, ny - 44); ctx.lineTo(nx + 12, ny + 10); ctx.lineTo(nx, ny + 2); ctx.lineTo(nx - 12, ny + 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = BRAND.ink;
  ctx.font = `600 18px ${STUDIO_SANS}`;
  ctx.fillText('N', nx, ny + 54);
}

function drawElevation(ctx, x0, x1, y0, y1) {
  const u = (x1 - x0) / 22, gy = y1 - 80;
  const X = m => x0 + 40 + m * u, Y = m => gy - m * u;
  ctx.strokeStyle = BRAND.ink;
  ctx.fillStyle = BRAND.ink;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
  ctx.lineWidth = 2;
  const rect = (a, b, c2, d) => ctx.strokeRect(X(a), Y(d), (b - a) * u, (d - c2) * u);
  rect(0, 11, 0.45, 3.6); // glass wing
  ctx.fillRect(X(-1.1), Y(3.95), 21.5 * u * 0.62, 0.35 * u); // roof plate
  rect(7.5, 17, 3.95, 7.0); // upper wing
  ctx.fillRect(X(7.3), Y(7.3), 9.9 * u, 0.3 * u);
  rect(11, 17, 0.45, 3.6);
  rect(1.3, 2.9, 0.45, 8.1); // chimney
  ctx.lineWidth = 1;
  for (let m = 0; m <= 11; m += 1.1) { ctx.beginPath(); ctx.moveTo(X(m), Y(0.45)); ctx.lineTo(X(m), Y(3.6)); ctx.stroke(); }
  for (let m = 7.5; m <= 17; m += 1.9) { ctx.beginPath(); ctx.moveTo(X(m), Y(3.95)); ctx.lineTo(X(m), Y(7.0)); ctx.stroke(); }
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(X(11.3), Y(0.6 + k * 0.33)); ctx.lineTo(X(16.7), Y(0.6 + k * 0.33)); ctx.stroke(); } // the garage's slatted door
  // level markers
  ctx.font = `500 16px ${STUDIO_SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const [m, t] of [[0, '+0.00'], [3.95, '+3.95'], [7.3, '+7.30']]) {
    ctx.beginPath(); ctx.moveTo(X(18), Y(m)); ctx.lineTo(X(19.2), Y(m)); ctx.stroke();
    ctx.fillText(t, X(19.4), Y(m));
  }
}

/* ---------- B&Co. Surfaces --------------------------------------------------------------- */

/** Every sample in the library: [kind, family]. Stone, wood and tile, in their own colours; no gold, no brass. */
const SURFACE_KINDS = [
  ['calacatta', 'stone'], ['nero', 'stone'], ['carrara', 'stone'], ['limestone', 'stone'], ['soapstone', 'stone'], ['travertine', 'stone'], ['pietra', 'stone'], ['statuario', 'stone'],
  ['oak', 'wood'], ['smokedOak', 'wood'], ['walnut', 'wood'], ['ash', 'wood'],
  ['zellige', 'tile'], ['hexBlack', 'tile'], ['terrazzo', 'tile'], ['herringbone', 'tile'], ['matteBlack', 'tile'], ['subway', 'tile'],
];

/** One sample, drawn into a cell of the atlas. */
function drawSample(ctx, kind, x, y, s, rnd) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  const fill = col => { ctx.fillStyle = col; ctx.fillRect(x, y, s, s); };
  const veins = (col, n, w, a) => {
    for (let i = 0; i < n; i++) {
      let vx = x + rnd() * s, vy = y - 10, ang = HALF_PI + (rnd() - 0.5) * 1.2;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      for (let k = 0; k < 60; k++) { ang += (rnd() - 0.5) * 0.4; vx += Math.cos(ang) * s * 0.03; vy += Math.sin(ang) * s * 0.03; ctx.lineTo(vx, vy); }
      ctx.strokeStyle = col.replace('A', String(a * (0.5 + rnd() * 0.5)));
      ctx.lineWidth = w * (0.5 + rnd());
      ctx.stroke();
    }
  };
  const speck = (cols, n, r) => { for (let i = 0; i < n; i++) { ctx.fillStyle = cols[(rnd() * cols.length) | 0]; ctx.beginPath(); ctx.arc(x + rnd() * s, y + rnd() * s, r * (0.4 + rnd()), 0, TAU); ctx.fill(); } };
  const grain = (base, line, n) => {
    fill(base);
    for (let i = 0; i < n; i++) {
      const yy = y + rnd() * s, a = 0.05 + rnd() * 0.12;
      ctx.strokeStyle = line.replace('A', a.toFixed(3));
      ctx.lineWidth = 0.8 + rnd() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + s * 0.3, yy + (rnd() - 0.5) * 14, x + s * 0.7, yy + (rnd() - 0.5) * 14, x + s, yy + (rnd() - 0.5) * 10);
      ctx.stroke();
    }
  };
  const grout = (col, step, offsetRows) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    for (let r = 0, yy = y; yy < y + s; r++, yy += step / 2) {
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + s, yy); ctx.stroke();
      for (let xx = x + (offsetRows && r % 2 ? step / 2 : 0); xx < x + s; xx += step) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + step / 2); ctx.stroke(); }
    }
  };
  switch (kind) {
    case 'calacatta': fill('#f3f1ec'); veins('rgba(96,94,90,A)', 4, s * 0.016, 0.85); veins('rgba(130,130,128,A)', 7, s * 0.005, 0.7); break;
    case 'statuario': fill('#f6f6f4'); veins('rgba(90,92,96,A)', 3, s * 0.008, 0.6); veins('rgba(170,172,176,A)', 8, s * 0.003, 0.5); break;
    case 'carrara': fill('#e3e3e2'); veins('rgba(120,122,126,A)', 10, s * 0.006, 0.6); break;
    case 'nero': fill('#141416'); veins('rgba(232,232,236,A)', 3, s * 0.005, 0.8); break;
    case 'pietra': fill('#3c3d40'); veins('rgba(220,220,222,A)', 5, s * 0.003, 0.6); break;
    case 'soapstone': fill('#2d302f'); veins('rgba(150,156,154,A)', 4, s * 0.006, 0.35); break;
    case 'limestone': fill('#e2ddd3'); speck(['rgba(160,150,138,0.25)', 'rgba(255,255,255,0.4)'], 260, s * 0.006); break;
    case 'travertine': fill('#dcd5c8');
      for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(${150 + rnd() * 40 | 0},${140 + rnd() * 35 | 0},${125 + rnd() * 30 | 0},0.25)`; ctx.fillRect(x, y + rnd() * s, s, 2 + rnd() * 6); }
      speck(['rgba(120,110,95,0.35)'], 40, s * 0.008); break;
    case 'oak': grain('#cfb48e', 'rgba(110,80,46,A)', 40); break;
    case 'smokedOak': grain('#6b5644', 'rgba(30,20,12,A)', 40); break;
    case 'walnut': grain('#5a4232', 'rgba(25,15,8,A)', 44); break;
    case 'ash': grain('#e2d6c2', 'rgba(140,120,90,A)', 32); break;
    case 'zellige':
      for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const v = 236 + rnd() * 16 | 0; ctx.fillStyle = `rgb(${v},${v},${v - 3})`; ctx.fillRect(x + q * s / 4, y + r * s / 4, s / 4, s / 4); }
      grout('#cfccc6', s / 2, false); break;
    case 'subway': fill('#f2f1ed'); grout('#d6d4cf', s / 2.5, true); break;
    case 'herringbone': fill('#f4f3ef');
      ctx.strokeStyle = '#cfcdc8'; ctx.lineWidth = 3;
      for (let k = -8; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x + k * s / 8, y); ctx.lineTo(x + k * s / 8 + s, y + s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + k * s / 4, y + s); ctx.lineTo(x + k * s / 4 + s * 0.5, y + s * 0.5); ctx.stroke(); }
      break;
    case 'hexBlack': fill('#d8d6d2');
      for (let r = -1; r < 6; r++) for (let q = -1; q < 6; q++) {
        const hx = x + q * s * 0.26 + (r % 2 ? s * 0.13 : 0), hy = y + r * s * 0.225, R = s * 0.14;
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; ctx.lineTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); } ctx.closePath();
        ctx.fillStyle = '#1a1a1c'; ctx.fill();
      }
      break;
    case 'matteBlack': fill('#1c1c1e'); grout('#3a3a3d', s / 1.0, false); break;
    case 'terrazzo': fill('#e9e7e2'); speck(['#9a9a9c', '#2b2b2d', '#c9c6c0', '#6e6e72'], 220, s * 0.012); break;
  }
  ctx.restore();
}

const SURFACE_ATLAS = { N: 8, S: 256 };
/** All the library's samples in one texture (8 × 8 cells), so the whole wall is one draw. */
function surfaceAtlas() {
  if (SURFACE_ATLAS.tex) return SURFACE_ATLAS.tex;
  const { N, S } = SURFACE_ATLAS, c = makeCanvas(N * S, N * S), ctx = c.getContext('2d'), rnd = seeded(5309);
  for (let i = 0; i < N * N; i++) drawSample(ctx, SURFACE_KINDS[i % SURFACE_KINDS.length][0], (i % N) * S, Math.floor(i / N) * S, S, rnd);
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  SURFACE_ATLAS.tex = tex;
  SURFACE_ATLAS.mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 0.5, fog: false });
  return tex;
}
/** A plane w × h (facing +z) showing atlas cell i, inset a little so the cell's edge never bleeds. */
function samplePlane(i, w, h) {
  surfaceAtlas();
  const { N } = SURFACE_ATLAS, geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
  const cx = i % N, cy = Math.floor(i / N), inset = 0.06, ar = h / w;
  for (let k = 0; k < uv.count; k++) {
    const u = uv.getX(k), v = uv.getY(k);
    const uu = (cx + inset + u * (1 - 2 * inset)) / N;
    const vv = 1 - (cy + inset + (1 - v) * (1 - 2 * inset) * Math.min(1, ar)) / N;
    uv.setXY(k, uu, vv);
  }
  return new THREE.Mesh(geo, SURFACE_ATLAS.mat);
}

function buildSurfaces(g) {
  const S = ROOM.studios, { x1, z0 } = ROOM;
  // the materials library: a black plinth of drawers, a white back panel, five ledges of samples standing on black rails
  const L = { x: x1 - 0.2, z0: -5.95, z1: -3.15, d: 0.33 };
  const lg = new THREE.Group();
  const len = L.z1 - L.z0;
  lg.add(placed(new THREE.Mesh(roundedBoxGeometry(L.d, 0.46, len, 0.006, 2), FMAT.satinBlack), 0, 0.05 + 0.23, 0));
  lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(L.d - 0.06, 0.05, len - 0.06), STUDIO_MAT.ledge), 0, 0.025, 0));
  for (let k = 1; k < 4; k++) lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.4, 0.004), MAT.aluDark), -L.d / 2 - 0.001, 0.29, -len / 2 + (k * len) / 4)); // drawer joints
  lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.0, len), STUDIO_MAT.board), L.d / 2 - 0.03, 0.51 + 1.0, 0)); // back panel
  for (const sz of [-1, 1]) lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(L.d - 0.02, 2.0, 0.02), STUDIO_MAT.ledge), 0.01, 0.51 + 1.0, sz * (len / 2 - 0.01))); // end fins
  const rows = 5, perRow = 9, sw = 0.26, sh = 0.3, pitch = len / perRow;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const yb = 0.62 + r * 0.38;
    lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, len - 0.04), STUDIO_MAT.ledge), L.d / 2 - 0.075, yb - 0.007, 0));
    lg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, len - 0.04), STUDIO_MAT.ledge), L.d / 2 - 0.107, yb + 0.008, 0)); // the lip
    for (let k = 0; k < perRow; k++, n++) {
      const z = -len / 2 + pitch * (k + 0.5);
      const tile = new THREE.Group();
      tile.add(placed(new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.014), STUDIO_MAT.sampleEdge), 0, 0, -0.008));
      const face = samplePlane((n * 7 + r * 3) % (SURFACE_ATLAS.N * SURFACE_ATLAS.N), sw, sh);
      face.position.z = 0.0005;
      tile.add(face);
      // stood on the ledge, leaning back against the panel, turned to face the room (-x)
      tile.rotation.order = 'YXZ';
      tile.rotation.y = -HALF_PI;
      tile.rotation.x = -0.09;
      tile.position.set(L.d / 2 - 0.085, yb + sh / 2, z);
      lg.add(tile);
    }
  }
  lg.add(placed(contactShadow(L.d + 0.35, len + 0.3, 0.3), 0, 0.003, 0));
  lg.position.set(L.x, 0, (L.z0 + L.z1) / 2);
  g.add(lg);

  // the slab: a book-matched Calacatta on a black steel A-frame, facing the door
  const sl = new THREE.Group();
  const slabTex = (() => {
    const c = makeCanvas(1024, 1536), ctx = c.getContext('2d'), rnd = seeded(77);
    drawSample(ctx, 'calacatta', 0, 0, 1024, rnd);
    drawSample(ctx, 'calacatta', 0, 512, 1024, seeded(78));
    // book-match: the right half mirrors the left
    ctx.save(); ctx.translate(1024, 0); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, 512, 1536, 0, 0, 512, 1536); ctx.restore();
    const t = canvasTexture(c);
    t.generateMipmaps = true;
    return t;
  })();
  const slabMat = new THREE.MeshPhysicalMaterial({ map: slabTex, roughness: 0.14, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.6, fog: false });
  const SW = 1.15, SH = 1.85;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, 0.025), [STUDIO_MAT.sampleEdge, STUDIO_MAT.sampleEdge, STUDIO_MAT.sampleEdge, STUDIO_MAT.sampleEdge, slabMat, STUDIO_MAT.sampleEdge]);
  slab.position.set(0, 0.14 + SH / 2, 0);
  slab.rotation.x = -0.08;
  slab.userData.keep = true;
  sl.add(slab);
  // the frame stands behind the stone: two raked legs to the floor, a brace across, the foot rail in front
  for (const sx of [-1, 1]) sl.add(rodBetween(new THREE.Vector3(sx * 0.42, 0, -0.5), new THREE.Vector3(sx * 0.4, 1.78, -0.15), 0.012, STUDIO_MAT.ledge, false));
  const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 10), STUDIO_MAT.ledge);
  brace.rotation.z = HALF_PI;
  brace.position.set(0, 1.1, -0.32);
  sl.add(brace);
  sl.add(placed(new THREE.Mesh(new THREE.BoxGeometry(SW - 0.05, 0.04, 0.08), STUDIO_MAT.ledge), 0, 0.12, 0.04)); // the foot rail the slab stands in
  sl.add(placed(contactShadow(1.5, 1.1, 0.3), 0, 0.003, 0));
  sl.position.set(6.75, 0, z0 + 0.62);
  g.add(sl);

  // the selection counter along the partition: a white stone top on black, a scheme laid out on it
  const C = { x: S.xm + 0.27, z: -4.45, w: 0.45, d: 1.25, h: 0.9 };
  const cg = new THREE.Group();
  cg.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w - 0.04, C.h - 0.08, C.d - 0.04, 0.006, 2), FMAT.satinBlack), 0, (C.h - 0.08) / 2 + 0.04, 0));
  const topM = samplePlane(0, C.w, C.d); // calacatta for the top's face
  cg.add(placed(new THREE.Mesh(roundedBoxGeometry(C.w, 0.03, C.d, 0.004, 2), STUDIO_MAT.sampleEdge), 0, C.h - 0.015, 0));
  topM.rotation.x = -HALF_PI;
  topM.position.y = C.h + 0.0008;
  cg.add(topM);
  // the scheme: a stone, a wood, a tile and a dark accent, side by side, as a client would see them together
  [[0, -0.36, 0.2, 0.2], [8, -0.12, 0.16, 0.24], [12, 0.12, 0.18, 0.18], [1, 0.34, 0.14, 0.14]].forEach(([cell, z, w, h], k) => {
    const s = samplePlane(cell, w, h);
    s.rotation.set(-HALF_PI, 0, (k - 1.5) * 0.06);
    s.position.set(-0.02, C.h + 0.012 + k * 0.0004, z);
    cg.add(s);
    cg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, h), STUDIO_MAT.sampleEdge), -0.02, C.h + 0.006, z));
  });
  cg.add(placed(contactShadow(C.w + 0.3, C.d + 0.3, 0.28), 0, 0.003, 0));
  cg.position.set(C.x, 0, C.z);
  g.add(cg);

  const pend = linearPendant(1.6);
  pend.rotation.y = HALF_PI;
  pend.position.set(6.95, 0, -4.5);
  g.add(pend);
}
