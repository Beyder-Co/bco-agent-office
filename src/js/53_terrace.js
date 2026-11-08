/* =============================================================================
   53 · THE TERRACE — the tower's crown, finished as a planted roof terrace
   -----------------------------------------------------------------------------
   The penthouse floor sits on the tower's roof. Until 9.0 the roof round it was
   bare membrane: a grey margin by day and a black void after dark. Now the crown
   is a terrace in the room's own language: pale limestone pavers on pedestals a
   step below the floor (the slab still reads as a section), a stone coping and a
   frameless glass balustrade with a slim stainless cap, and low planting that
   follows the real season — fountain grass and clipped box in charcoal planters.
   The wider east side carries two teak lounge chairs facing the river; the camera
   side (south) stays low and open so every view still looks straight in.
   After dark the planters wash the pavers in a low warm line; nothing glows above
   knee height, so the night view is the room, not the terrace.

   One group, outside the room: not walkable, never a collider, never a pick.
   Static parts are merged by material (as the room is); the grass is one instanced
   draw for every tuft.
   ============================================================================= */

const TERRACE = {
  // the crown (world metres): the tower is drawn to this footprint by the city
  x0: -11.1, x1: 10.6, z0: -6.8, z1: 8.0,
  top: -0.3, // paver level: one step (27 cm) below the office floor
  coping: { w: 0.3, h: 0.14 },
  rail: 1.0, // glass height above the coping
  group: null,
  glow: null, // the planters' wash (its colour follows the night)
  grass: null,
  u: { uTNight: { value: 0 } }, // shared by every terrace material: how far into the night the outdoors has gone
};

function terraceSeason(d = new Date()) {
  // fountain grass: green through summer, straw from October, cut back to a low tuft in March, new growth by May
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const straw = smooth(265, 300, doy) + (1 - smooth(70, 120, doy)); // autumn into winter
  const cut = smooth(65, 75, doy) * (1 - smooth(105, 150, doy)); // cut back in March, regrowing through spring
  return { straw: clamp(straw, 0, 1), height: 1 - 0.7 * cut };
}

/**
 * Outdoors after dark: the terrace is lit by what spills through the room's glass and by the planters' low warm
 * line, not by the room's key light (which keeps the interior bright, as a lit office is). Each terrace material is
 * patched once: its lit colour is scaled toward night by distance from the glass, and low surfaces near the outer
 * planters gain the warm wash.
 */
function terraceNightPatch(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTNight = TERRACE.u.uTNight;
    sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 tw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tw = instanceMatrix * tw;
      #endif
      vTW = (modelMatrix * tw).xyz;`);
    sh.fragmentShader = 'uniform float uTNight;\nvarying vec3 vTW;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      vec2 rq = abs(vTW.xz - vec2(0.0, -0.2)) - vec2(8.1, 6.05);
      float dRoom = length(max(rq, 0.0));
      float spill = 0.62 * exp(-dRoom * 0.75);
      float edge = min(min(vTW.x - (${TERRACE.x0.toFixed(2)}), ${TERRACE.x1.toFixed(2)} - vTW.x), min(vTW.z - (${TERRACE.z0.toFixed(2)}), ${TERRACE.z1.toFixed(2)} - vTW.z));
      float wash = 0.42 * exp(-max(vTW.y - (${TERRACE.top.toFixed(2)}), 0.0) * 4.5) * (1.0 - smoothstep(0.7, 1.7, edge));
      vec3 night = vec3(0.05, 0.055, 0.07) + vec3(1.0, 0.88, 0.74) * spill + vec3(1.0, 0.7, 0.42) * wash;
      gl_FragColor.rgb *= mix(vec3(1.0), night, uTNight);`);
  };
  mat.customProgramCacheKey = () => 'terrace-night';
  return mat;
}

function grassTuftGeometry(seed = 7, blades = 34) {
  // one tuft: arching blades, base dark, tip light (vertex colour carries the gradient; the material tints it)
  const rnd = seeded(seed), pos = [], col = [], idx = [];
  for (let b = 0; b < blades; b++) {
    // fountain grass: an upright core and an outer ring that arches over (the outer blades are the long ones)
    const outer = rnd(), a = rnd() * TAU, lean = 0.15 + outer * 0.85, len = 0.38 + outer * 0.34 + rnd() * 0.12, w = 0.009 + rnd() * 0.006;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx; // the blade's sideways direction
    const base = pos.length / 3, seg = 4;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, r = lean * len * (0.15 * t + 0.85 * t * t), y = len * (t - 0.42 * lean * t * t);
      const half = w * (1 - t * 0.92);
      const cx = dx * r + dx * 0.02 * rnd(), cz = dz * r;
      pos.push(cx - px * half, y, cz - pz * half, cx + px * half, y, cz + pz * half);
      const k = 0.3 + 0.7 * Math.pow(t, 0.8);
      col.push(k, k, k, k, k, k);
    }
    for (let i = 0; i < seg; i++) {
      const q = base + i * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function boxwoodGeometry(seed = 3, detail = 3) {
  // clipped box: a sphere with a shorn, leafy irregularity (no per-leaf geometry)
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3(), rnd = seeded(seed);
  const o = [rnd() * 9, rnd() * 9, rnd() * 9];
  const col = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 7 + o[0]) * Math.sin(v.y * 6 + o[1]) * Math.sin(v.z * 7 + o[2]);
    const k = 1 + 0.045 * n + 0.03 * (rnd() - 0.5);
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.82 : v.y; // a flatter underside, where the shears meet the pot
    p.setXYZ(i, v.x, v.y, v.z);
    const s = 0.55 + 0.45 * clamp((v.y + 1) / 2, 0, 1) + 0.12 * (rnd() - 0.5);
    col.push(s, s, s);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function teakLoungeChair(mats) {
  // a low teak club chair: slatted frame, a deep white cushion, the back raked 12°
  const c = new THREE.Group();
  const W = 0.78, D = 0.82, seatY = 0.36;
  for (const sx of [-1, 1]) {
    c.add(box(0.07, 0.56, D, mats.teak, sx * (W / 2 - 0.035), 0.28, 0)); // the arms run to the floor as solid sides
    c.add(box(0.075, 0.03, D + 0.02, mats.teak, sx * (W / 2 - 0.035), 0.575, 0));
  }
  for (let i = 0; i < 6; i++) c.add(box(W - 0.14, 0.022, 0.1, mats.teak, 0, seatY - 0.09, -D / 2 + 0.09 + i * 0.13)); // seat slats
  const back = new THREE.Group();
  for (let i = 0; i < 5; i++) back.add(box(W - 0.14, 0.1, 0.022, mats.teak, 0, 0.1 + i * 0.12, 0));
  back.position.set(0, seatY - 0.05, D / 2 - 0.06);
  back.rotation.x = -0.21;
  c.add(back);
  const seat = new THREE.Mesh(roundedBoxGeometry(W - 0.16, 0.14, D - 0.14, 0.05), mats.cushion);
  seat.position.set(0, seatY + 0.02, -0.03);
  c.add(seat);
  const bc = new THREE.Mesh(roundedBoxGeometry(W - 0.18, 0.5, 0.13, 0.05), mats.cushion);
  bc.position.set(0, seatY + 0.3, D / 2 - 0.15);
  bc.rotation.x = -0.21;
  c.add(bc);
  return c;
}

/** A rounded box (for cushions): a box whose corners are pulled onto spheres of radius r. */
function roundedBoxGeometry(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(c);
    if (v.lengthSq() > 1e-9) v.setLength(r);
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.computeVertexNormals();
  return g;
}

function buildTerrace() {
  const T = TERRACE, g = new THREE.Group();
  g.name = 'terrace';
  const W = T.x1 - T.x0, D = T.z1 - T.z0, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  const pavTex = canvasTexture(stoneCanvas(1024, 47, { base: '#ddd7cc', joints: 4, joint: 'rgba(92,84,74,0.55)' }), { repeat: true });
  pavTex.repeat.set(W / 2.4, D / 2.4); // 60 cm pavers
  const mats = {
    paver: new THREE.MeshStandardMaterial({ map: pavTex, roughness: 0.82, metalness: 0, envMapIntensity: 0.25, fog: false }),
    coping: std('#d4cec3', 0.78),
    deckEdge: std('#b9b3a9', 0.85),
    planter: std('#2c2d30', 0.62, 0.25),
    lip: std('#1d1e20', 0.5, 0.35),
    soil: std('#3b3129', 1),
    teak: new THREE.MeshStandardMaterial({ map: OAK_TEX, color: lin('#a8957c'), roughness: 0.82, metalness: 0, envMapIntensity: 0.3, fog: false }), // weathered teak: silvered, the grain still there
    cushion: std('#efece6', 0.96),
    box: new THREE.MeshStandardMaterial({ color: lin('#3f5a34'), vertexColors: true, roughness: 0.9, fog: false }),
    grass: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, fog: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, fog: false }),
  };
  mats.alu = MAT.alu.clone();
  mats.aluDark = MAT.aluDark.clone();
  // the deck: pavers on pedestals over the roof; the top face carries the stone, the sides a darker edge
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.26, D), [mats.deckEdge, mats.deckEdge, mats.paver, mats.deckEdge, mats.deckEdge, mats.deckEdge]);
  deck.position.set(cx, T.top - 0.13, cz);
  deck.receiveShadow = true;
  deck.userData.keep = true;
  g.add(deck);
  // the coping round the edge, the glass on it, and a slim stainless cap
  const cw = T.coping.w, ch = T.coping.h, y0 = T.top + ch, inset = cw / 2;
  const edges = [
    ['x', T.z0 + inset, T.x0, T.x1], ['x', T.z1 - inset, T.x0, T.x1],
    ['z', T.x0 + inset, T.z0 + cw, T.z1 - cw], ['z', T.x1 - inset, T.z0 + cw, T.z1 - cw],
  ];
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1.1, side: THREE.DoubleSide, depthWrite: false, fog: false });
  for (const [axis, at, a, b] of edges) {
    const len = b - a, mid = (a + b) / 2;
    const sx = axis === 'x' ? len : cw, sz = axis === 'x' ? cw : len;
    const px = axis === 'x' ? mid : at, pz = axis === 'x' ? at : mid;
    g.add(box(sx, ch, sz, mats.coping, px, T.top + ch / 2, pz));
    const gl = box(axis === 'x' ? len - 0.02 : 0.016, T.rail, axis === 'x' ? 0.016 : len - 0.02, glass, px, y0 + T.rail / 2 + 0.01, pz);
    gl.userData.noShadow = true;
    gl.castShadow = false;
    g.add(gl);
    g.add(box(axis === 'x' ? len : 0.05, 0.035, axis === 'x' ? 0.05 : len, mats.alu, px, y0 + T.rail + 0.03, pz));
    // the glass's shoe: a low stainless channel on the coping
    g.add(box(axis === 'x' ? len : 0.07, 0.04, axis === 'x' ? 0.07 : len, mats.aluDark, px, y0 + 0.02, pz));
  }

  // planters: long charcoal troughs along the south and east edges, square ones by the vestibule
  const troughs = [];
  const run = (axis, at, a, b, seg = 2.4, gap = 0.5) => {
    for (let s = a; s + seg <= b + 1e-6; s += seg + gap) troughs.push(axis === 'x' ? { x: s + seg / 2, z: at, w: seg, d: 0.5 } : { x: at, z: s + seg / 2, w: 0.5, d: seg });
  };
  const inner = cw + 0.29; // the trough sits just inside the coping
  run('x', T.z1 - inner, T.x0 + 0.9, T.x1 - 1.0, 2.6, 0.55); // south: low, along the glass
  // east: the planting breaks where the two chairs sit, so they look over the glass at the river, not into grass
  run('z', T.x1 - inner, T.z0 + 0.9, -4.3, 2.0, 0.5);
  run('z', T.x1 - inner, -1.2, T.z1 - 1.4, 2.4, 0.6);
  const squares = [{ x: -9.55, z: -2.45 }, { x: -9.55, z: 2.7 }, { x: -9.55, z: -5.5 }, { x: -9.55, z: 6.6 }, { x: 9.5, z: 6.95 }];
  const PH = 0.5;
  for (const t of troughs) {
    g.add(box(t.w, PH, t.d, mats.planter, t.x, T.top + PH / 2, t.z));
    g.add(box(t.w - 0.06, 0.01, t.d - 0.06, mats.soil, t.x, T.top + PH - 0.04, t.z));
    g.add(box(t.w + 0.03, 0.025, t.d + 0.03, mats.lip, t.x, T.top + PH + 0.0125, t.z)); // a folded lip, a shade darker
    g.add(box(t.w - 0.04, 0.03, t.d - 0.04, mats.deckEdge, t.x, T.top + 0.015, t.z)); // a recessed plinth: the trough floats
  }
  for (const s of squares) {
    g.add(box(0.62, 0.62, 0.62, mats.planter, s.x, T.top + 0.31, s.z));
    g.add(box(0.56, 0.01, 0.56, mats.soil, s.x, T.top + 0.58, s.z));
  }
  // the evening wash: a thin warm line under the lip of each trough, facing the pavers (dark by day)
  const glowRows = [];
  for (const t of troughs) {
    const along = t.w > t.d, off = 0.012;
    const side = along ? -1 : -1; // the room side of each trough
    glowRows.push(along ? box(t.w - 0.1, 0.014, 0.012, mats.glow, t.x, T.top + 0.04, t.z + side * (t.d / 2 + off)) : box(0.012, 0.014, t.d - 0.1, mats.glow, t.x + side * (t.w / 2 + off), T.top + 0.04, t.z));
  }
  glowRows.forEach(m => { m.castShadow = false; m.receiveShadow = false; g.add(m); });
  T.glow = mats.glow;

  // planting: fountain grass in the troughs (one instanced draw), clipped box in the squares
  const tuft = grassTuftGeometry(11, 18);
  const spots = [], rnd = seeded(902);
  for (const t of troughs) {
    const n = Math.round((Math.max(t.w, t.d) / 0.2));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5;
      const along = t.w > t.d, row = (i % 2 ? 0.09 : -0.09);
      const jx = (along ? 0 : row) + (rnd() - 0.5) * 0.06, jz = (along ? row : 0) + (rnd() - 0.5) * 0.06;
      spots.push([t.x + (along ? u * (t.w - 0.2) : jx), T.top + PH - 0.04, t.z + (along ? jz : u * (t.d - 0.2)), rnd() * TAU, 0.8 + rnd() * 0.45, rnd()]);
    }
  }
  const grass = new THREE.InstancedMesh(tuft, mats.grass, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  const tint = new THREE.Color();
  spots.forEach((s, i) => {
    q.setFromEuler(e.set(0, s[3], 0));
    m4.compose(p3.set(s[0], s[1], s[2]), q, sc.set(s[4], s[4], s[4]));
    grass.setMatrixAt(i, m4);
    grass.setColorAt(i, tint.setScalar(0.85 + 0.3 * s[5]));
  });
  grass.castShadow = true;
  grass.receiveShadow = true;
  grass.userData.keep = true;
  grass.userData.spots = spots;
  g.add(grass);
  T.grass = grass;
  const boxGeo = boxwoodGeometry(5, 3);
  squares.forEach((s, i) => {
    const r = 0.3 + (i % 2) * 0.04;
    const b = new THREE.Mesh(boxGeo, mats.box);
    b.scale.set(r, r * 0.92, r);
    b.position.set(s.x, T.top + 0.6 + r * 0.82, s.z);
    b.castShadow = true;
    b.userData.keep = true;
    g.add(b);
  });

  // the east terrace: two teak chairs and a low stone table, facing the river
  const chairs = [[9.3, -3.6, -HALF_PI + 0.25], [9.3, -1.9, -HALF_PI - 0.25]];
  for (const [x, z, ry] of chairs) {
    const c = teakLoungeChair(mats);
    c.position.set(x, T.top, z);
    c.rotation.y = ry;
    g.add(c);
  }
  const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 40), mats.coping);
  tbl.position.set(9.45, T.top + 0.18, -2.75);
  g.add(tbl);

  for (const [k, m] of Object.entries(mats)) if (k !== 'glow') terraceNightPatch(m);
  terraceNightPatch(glass);
  applyTerraceSeason();
  shadowAll(g, true, true);
  g.traverse(o => { if (o.isMesh && o.material && (o.material.transparent || o.material === mats.glow)) o.castShadow = false; });
  mergeByMaterial(g);
  T.group = g;
  return g;
}

/** The grass's colour and height for today: green in summer, straw now (November), cut back in March. */
function applyTerraceSeason(d = new Date()) {
  const T = TERRACE;
  if (!T.grass) return;
  const s = terraceSeason(d);
  T.grass.material.color.copy(lin('#6f8a4f')).lerp(lin('#bfa577'), s.straw);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  T.grass.userData.spots.forEach((sp, i) => {
    q.setFromEuler(e.set(0, sp[3], 0));
    m4.compose(p3.set(sp[0], sp[1], sp[2]), q, sc.set(sp[4], sp[4] * s.height, sp[4]));
    T.grass.setMatrixAt(i, m4);
  });
  T.grass.instanceMatrix.needsUpdate = true;
}

/** After dark the planters' line comes up (and never above knee height); by day it is off. */
function updateTerrace() {
  const T = TERRACE;
  if (!T.glow) return;
  const day = new Date().toDateString();
  if (T._day !== day) { T._day = day; applyTerraceSeason(); } // an office left open for days still turns with the season
  const n = (SKY.state && SKY.state.night) || 0;
  const k = smooth(0.15, 0.7, n);
  if (T._k !== undefined && Math.abs(T._k - k) < 0.002) return;
  T._k = k;
  T.u.uTNight.value = smooth(0.05, 0.85, n);
  T.glow.color.setRGB(1.0 * k, 0.74 * k, 0.46 * k);
}
