/* =============================================================================
   86b · THE QUIET MOTION LAYER — every screen breathes, nothing shouts
   -----------------------------------------------------------------------------
   One overlay quad per screen, drawn by one small shader: the motion costs no
   canvas redraws and no texture uploads, runs at the display's own frame rate,
   and is skipped for screens off camera.
     sheen   a very soft light drifting slowly across the glass (always)
     scan    a soft band easing down a list every ~11 s, the screens staggered so
             one of them is usually moving while the others rest
     sweep   on the Forum screen, a soft light gliding across the counts (~13 s)
   Desk monitors add a status dot breathing in the title bar, a progress hairline
   under it, a smooth thinking ring, an idle caret at the end of the code, and on
   the lock screen a slow drifting bloom. Crimson never appears here: crimson only
   ever means "needs you", and the screens already say that in their own words.
   Motion follows performance.now(), so a frozen clock (tests) freezes it too.
   ============================================================================= */

const MOTION = { quads: [], ready: false, cost: 0 };

const MOTION_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const MOTION_FRAG = `
varying vec2 vUv;
uniform float uAsp;
uniform vec4 uSheen; uniform vec3 uSheenCol;
uniform vec4 uScan; uniform vec4 uClip; uniform vec3 uScanCol;
uniform vec4 uDot; uniform vec3 uDotCol;
uniform vec4 uBar; uniform vec4 uBarA; uniform vec3 uBarCol; uniform vec3 uTrackCol;
uniform vec4 uRing; uniform vec3 uRingP; uniform vec3 uRingCol;
uniform vec4 uCaret; uniform float uCaretA; uniform vec3 uCaretCol;
vec4 over(vec4 acc, vec3 c, float a) { return vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a)); }
void main() {
  vec2 p = vUv;
  vec2 q = vec2(p.x * uAsp, p.y);
  vec4 acc = vec4(0.0);
  if (uSheen.w > 0.0) {
    vec2 d = q - vec2(uSheen.x * uAsp, uSheen.y);
    // a soft light: dithered by a quarter level, so a gradient this faint never shows bands
    float dz = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    acc = over(acc, uSheenCol, max(0.0, uSheen.w * exp(-dot(d, d) / (uSheen.z * uSheen.z)) + dz * 0.0035));
  }
  if (uScan.z > 0.0) {
    float c = mix(p.y, p.x, uScan.w);
    float b = 1.0 - smoothstep(0.0, uScan.y, abs(c - uScan.x));
    float e = 0.003;
    float m = smoothstep(uClip.x - e, uClip.x + e, p.x) * (1.0 - smoothstep(uClip.y - e, uClip.y + e, p.x))
            * smoothstep(uClip.z - e, uClip.z + e, p.y) * (1.0 - smoothstep(uClip.w - e, uClip.w + e, p.y));
    acc = over(acc, uScanCol, uScan.z * b * b * (3.0 - 2.0 * b) * m);
  }
  if (uBarA.x + uBarA.y > 0.0) {
    float vy = 1.0 - smoothstep(uBarA.z * 0.5, uBarA.z * 0.5 + 0.002, abs(p.y - uBar.z));
    float inX = step(uBar.x, p.x) * step(p.x, uBar.y);
    acc = over(acc, uTrackCol, uBarA.x * vy * inX);
    acc = over(acc, uBarCol, uBarA.y * vy * inX * (1.0 - smoothstep(uBar.w - 0.006, uBar.w, p.x)));
  }
  if (uDot.w > 0.0) {
    float r = length(q - vec2(uDot.x * uAsp, uDot.y));
    acc = over(acc, uDotCol, uDot.w * (1.0 - smoothstep(uDot.z - 0.003, uDot.z, r)));
  }
  if (uRing.w > 0.0) {
    vec2 d = q - vec2(uRing.x * uAsp, uRing.y);
    float band = 1.0 - smoothstep(uRingP.z * 0.5 - 0.002, uRingP.z * 0.5 + 0.002, abs(length(d) - uRing.z));
    float rel = mod(atan(d.y, d.x) - uRingP.x, 6.2831853);
    float arc = smoothstep(0.0, 0.25, rel) * (1.0 - smoothstep(uRingP.y - 0.25, uRingP.y, rel));
    acc = over(acc, uRingCol, uRing.w * band * arc);
  }
  if (uCaretA > 0.0) {
    float m = step(uCaret.x, p.x) * step(p.x, uCaret.z) * step(uCaret.y, p.y) * step(p.y, uCaret.w);
    acc = over(acc, uCaretCol, uCaretA * m);
  }
  if (acc.a < 0.002) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
}
`;

/** Colours here are display values: the shader writes them straight to the screen. */
const mcol = hex => new THREE.Color(hex);

function motionMaterial(asp) {
  const v4 = () => ({ value: new THREE.Vector4(0, 0, 0, 0) });
  const c3 = hex => ({ value: mcol(hex) });
  return new THREE.ShaderMaterial({
    uniforms: {
      uAsp: { value: asp },
      uSheen: v4(), uSheenCol: c3('#ffffff'),
      uScan: v4(), uClip: { value: new THREE.Vector4(0, 1, 0, 1) }, uScanCol: c3('#ffffff'),
      uDot: v4(), uDotCol: c3('#45c27a'),
      uBar: v4(), uBarA: v4(), uBarCol: c3('#8fa3bd'), uTrackCol: c3('#ffffff'),
      uRing: v4(), uRingP: { value: new THREE.Vector3(0, 4.2, 0.01) }, uRingCol: c3('#c9ced6'),
      uCaret: v4(), uCaretA: { value: 0 }, uCaretCol: c3('#e8eaee'),
    },
    vertexShader: MOTION_VERT,
    fragmentShader: MOTION_FRAG,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

/** An overlay quad riding on a screen face (in front of its picture, under the living layer's marks). */
function motionQuad(face, w, h, z = 0.0013) {
  const mat = motionMaterial(w / h);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.z = z;
  m.renderOrder = 2;
  m.raycast = () => {};
  m.userData.noShadow = true;
  m.castShadow = m.receiveShadow = false;
  face.add(m);
  return m;
}

/** A slow Lissajous path for the sheen, different on every screen. */
function sheenAt(t, seed, ax = 0.42, ay = 0.32, p1 = 47, p2 = 61) {
  return [0.5 + ax * Math.sin((t * TAU) / p1 + seed * 1.7), 0.5 + ay * Math.sin((t * TAU) / p2 + seed * 2.9)];
}

/** A periodic pass: 0 → 1 over `dur` seconds once every `period`, else -1. */
function passAt(t, period, dur, offset = 0) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < dur ? ph / dur : -1;
}

/* ---------- the wall screens ---------- */

const WALL_MOTION = {
  main: { sheen: 0.045, radius: 0.5, sweep: { period: 13, dur: 3.4, offset: 2, alpha: 0.06, half: 0.075 } },
  hotnew: { sheen: 0.042, radius: 0.48, scan: { period: 11, dur: 2.6, offset: 0, alpha: 0.065 } },
  hotdone: { sheen: 0.042, radius: 0.48, scan: { period: 11, dur: 2.6, offset: 5.5, alpha: 0.065 } },
  today: { sheen: 0.042, radius: 0.5, scan: { period: 12, dur: 2.6, offset: 3, alpha: 0.065 } },
  pipeline: { sheen: 0.042, radius: 0.5, scan: { period: 12, dur: 2.4, offset: 8, alpha: 0.065 } },
  ticker: { sheen: 0.04, radius: 0.9, ax: 0.46, ay: 0.12, p1: 43, p2: 9 },
};

function motionWall(key, spec) {
  const sc = VIEW.screens[key];
  const obj = key === 'main' ? ROOM_OBJ.screen
    : key === 'hotnew' || key === 'hotdone' ? ROOM_OBJ.hotlist && ROOM_OBJ.hotlist[key]
    : key === 'ticker' ? ROOM_OBJ.ticker
    : (ROOM_OBJ.panels || []).find(p => p.key === key);
  if (!sc || !obj || !obj.face) return;
  const mesh = motionQuad(obj.face, obj.w, obj.h, 0.0012);
  MOTION.quads.push({ kind: 'wall', key, spec, face: obj.face, mesh, u: mesh.material.uniforms, W: sc.W, H: sc.H, seed: MOTION.quads.length + 1 });
}

function updateWall(Q, t) {
  const S = Q.spec, u = Q.u;
  const [cx, cy] = sheenAt(t, Q.seed, S.ax, S.ay, S.p1, S.p2);
  u.uSheen.value.set(cx, cy, S.radius || 0.42, S.sheen);
  u.uScan.value.z = 0;
  const L = LIFE.by[Q.key];
  if (S.scan && L && L.list) {
    const a = L.list, k = passAt(t, S.scan.period, S.scan.dur, S.scan.offset);
    if (k >= 0) {
      const v0 = 1 - a.y1 / Q.H, v1 = 1 - a.y0 / Q.H, half = Math.max(0.02, (a.rh / Q.H) * 0.62);
      u.uClip.value.set(a.x0 / Q.W, a.x1 / Q.W, v0, v1);
      u.uScan.value.set(lerp(v1 + half * 0.6, v0 - half * 0.6, easeInOut(k)), half, S.scan.alpha * Math.pow(Math.sin(k * Math.PI), 0.8), 0);
    }
  }
  if (S.sweep && L && L.body) {
    const b = L.body, k = passAt(t, S.sweep.period, S.sweep.dur, S.sweep.offset);
    if (k >= 0) {
      const u0 = b.x0 / Q.W, u1 = b.x1 / Q.W, half = S.sweep.half;
      u.uClip.value.set(u0, u1, 1 - b.y1 / Q.H, 1 - b.y0 / Q.H);
      u.uScan.value.set(lerp(u0 - half * 0.5, u1 + half * 0.5, easeInOut(k)), half, S.sweep.alpha * Math.pow(Math.sin(k * Math.PI), 0.8), 1);
    }
  }
}

/* ---------- the server's face: its list of desks ---------- */

function motionRack() {
  const S = ROOM_OBJ.server;
  if (!S || !S.group || !S.faceTex) return;
  let face = null;
  S.group.traverse(o => { if (!face && o.isMesh && o.material && o.material.map === S.faceTex) face = o; });
  if (!face || !face.geometry || !face.geometry.parameters || face.geometry.parameters.width == null) return;
  const { width, height } = face.geometry.parameters;
  const mesh = motionQuad(face, width, height, 0.0008);
  MOTION.quads.push({ kind: 'rack', face, mesh, u: mesh.material.uniforms, seed: 9, S });
}

function updateRack(Q, t) {
  const u = Q.u, S = Q.S;
  const [cx, cy] = sheenAt(t, Q.seed, 0.3, 0.42, 41, 57);
  u.uSheen.value.set(cx, cy, 0.34, 0.035);
  u.uScan.value.z = 0;
  const k = passAt(t, 9, 2.4, 1);
  if (k >= 0 && S.units) {
    const half = (1 / S.units) * 0.55;
    u.uClip.value.set(0.012, 0.988, 0.004, 0.996);
    u.uScan.value.set(lerp(1 + half * 0.6, -half * 0.6, easeInOut(k)), half, 0.06 * Math.pow(Math.sin(k * Math.PI), 0.8), 0);
  }
}

/* ---------- desk monitors ---------- */

const DESK_DARK = ['code', 'build', 'terminal'];
const CODE_AREA = { code: [0, 640 - 112], terminal: [0, 640], build: [0, 320] }; // [x0, width] of the code column, as the screen draws it

function motionDesk(st) {
  const mesh0 = st.screenMesh, scr = st.screenObj;
  if (!mesh0 || !scr || !mesh0.geometry.parameters) return;
  const { width, height } = mesh0.geometry.parameters;
  const mesh = motionQuad(mesh0, width, height, 0.0006);
  const dark = DESK_DARK.includes(scr.kind);
  const u = mesh.material.uniforms;
  u.uTrackCol.value = mcol(dark ? '#ffffff' : '#c9ccd1');
  u.uBarCol.value = mcol(dark ? '#8fa3bd' : '#6f7f95');
  u.uRingCol.value = mcol(dark ? '#c9ced6' : '#5c6672');
  u.uScanCol.value = mcol('#d9dee6');
  const seed = (st.spec && st.spec.seed) || MOTION.quads.length + 3;
  st.__motion = { kind: 'desk', st, scr, face: mesh0, mesh, u, dark, seed, cycle: 11 + (seed % 5), off: (seed * 1.37) % 9,
    cWork: mcol('#45c27a'), cRest: mcol(dark ? '#9aa3ad' : '#8a8f98') };
  MOTION.quads.push(st.__motion);
}

/** Where the code screen's caret sits: after the last token shown on the current line. */
function caretAt(scr) {
  const area = CODE_AREA[scr.kind];
  if (!area) return null;
  const [x0, w] = area, lh = 18, vis = Math.floor((SCR.H - 40) / lh);
  const lines = scr.lines.slice(-vis), i = lines.indexOf(scr.cur);
  if (i < 0) return null;
  const ln = lines[i];
  let x = x0 + 32 + ln.indent * 18;
  ln.tokens.slice(0, ln.shown).forEach(tk => { if (x + tk.w <= x0 + w - 8) x += tk.w + 8; });
  return [x, 40 + i * lh];
}

function updateDesk(Q, t) {
  const u = Q.u, state = Q.st.activity, W = SCR.W, H = SCR.H;
  const lock = state === 'away' || state === 'paused';
  const working = state === 'work' || state === 'browse';
  // sheen: on dark screens a soft drifting light; on the lock screen a slow bloom, like a screensaver
  const [cx, cy] = sheenAt(t, Q.seed, lock ? 0.36 : 0.44, lock ? 0.26 : 0.34, lock ? 29 : 37, lock ? 41 : 53);
  u.uSheen.value.set(cx, cy * (lock ? 0.86 : 1), lock ? 0.52 : 0.46, lock ? 0.08 : Q.dark ? 0.065 : 0);
  // the status dot: green and brisk while working, neutral and slow otherwise; none on the lock screen or while waiting
  const dotA = lock || state === 'wait' ? 0
    : working ? 0.62 + 0.38 * Math.sin(t * 3.1 + Q.seed)
    : 0.32 + 0.22 * Math.sin(t * 1.3 + Q.seed);
  u.uDot.value.set((W - 17) / W, 1 - 13 / H, 4.2 / H, Math.max(0, dotA));
  u.uDotCol.value.copy(working ? Q.cWork : Q.cRest);
  // the progress hairline under the title bar: fills over the job's own cycle while working
  if (lock || state === 'wait') u.uBarA.value.set(0, 0, 0, 0);
  else {
    const ph = (((t + Q.off) % Q.cycle) + Q.cycle) % Q.cycle / Q.cycle;
    const fill = working ? easeInOut(Math.min(1, ph * 1.08)) : 0;
    const fade = working ? 1 - smooth(0.93, 1, ph) : 0;
    u.uBar.value.set(0, 1, 1 - 26 / H, Math.max(0.001, fill));
    u.uBarA.value.set(Q.dark ? 0.06 : 0.5, 0.85 * fade, 2.2 / H, 0);
  }
  // light screens: a pale band eases down the rows now and then, like a selection being read
  u.uScan.value.z = 0;
  if (!Q.dark && !lock) {
    const k = passAt(t, 8 + (Q.seed % 4), 2.2, Q.off);
    if (k >= 0) {
      const half = 22 / H;
      u.uClip.value.set(0, 1, 0, 1 - 30 / H);
      u.uScan.value.set(lerp(1 - 30 / H + half, -half, easeInOut(k)), half, 0.32 * Math.sin(k * Math.PI), 0);
    }
  }
  // thinking: a smooth ring in the corner (the screen's own spinner is held back, see below)
  if (state === 'think') {
    u.uRing.value.set((W - 30) / W, 30 / H, 13 / H, 0.95);
    u.uRingP.value.set(-t * 4, 4.2, 4 / H);
  } else u.uRing.value.w = 0;
  // an idle caret at the end of the code, blinking softly (while working the screen draws its own)
  u.uCaretA.value = 0;
  if (Q.dark && (state === 'idle' || state === 'think')) {
    const c = caretAt(Q.scr);
    if (c) {
      const [x, y] = c, blink = 0.5 + 0.5 * Math.cos(t * TAU * 0.9);
      u.uCaret.value.set(x / W, 1 - (y + 9) / H, (x + 7) / W, 1 - (y - 2) / H);
      u.uCaretA.value = smooth(0.25, 0.75, blink) * 0.95;
    }
  }
}

/* ---------- two touches on the desk screen's own drawing (40_station.js stays as it is):
   its stepped thinking spinner is held back (the overlay draws a smooth one), and while the agent
   waits on Igor the crimson bar says what for: the request, then the action and its first facts ---------- */
if (typeof Screen !== 'undefined' && !Screen.prototype.__motionDraw) {
  const draw0 = Screen.prototype.draw;
  Screen.prototype.draw = function (t) {
    const hold = this.state === 'think' && MOTION.ready && !REDUCED_MOTION;
    if (hold) this.state = 'idle';
    try { draw0.call(this, t); } finally { if (hold) this.state = 'think'; }
    if (this.state === 'wait') deskWaitBrief(this);
  };
  Screen.prototype.__motionDraw = true;
}
function deskWaitBrief(scr) {
  if (typeof OFFICE_STATE === 'undefined' || typeof gateText !== 'function') return;
  const st = WORLD.stations.find(s => s.screenObj === scr);
  const id = st && st.spec && st.spec.id;
  const g = id && OFFICE_STATE.approvals.find(x => x.agentId === id);
  if (!g) return;
  const gt = gateText(g), ctx = scr.ctx, W = SCR.W, H = SCR.H;
  const second = [gt.action, gt.factsText].filter(Boolean).join('  ·  ');
  const bh = second ? 66 : 40;
  ctx.fillStyle = 'rgba(167,0,8,0.94)';
  ctx.fillRect(0, H - bh, W, bh);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 18px ${BRAND.ui}`;
  ctx.fillText(scFit(ctx, `Waiting for Igor · ${gt.subject}`, W - 36), 18, H - bh + 26);
  if (second) {
    ctx.font = `500 15px ${BRAND.ui}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(scFit(ctx, second, W - 36), 18, H - 16);
  }
}

/* ---------- lifecycle ---------- */

MOTION.init = function () {
  if (this.ready) return;
  for (const [key, spec] of Object.entries(WALL_MOTION)) motionWall(key, spec);
  motionRack();
  this.ready = true;
};

MOTION.update = function (now) {
  if (!this.ready) return;
  const c0 = performance.now();
  const t = REDUCED_MOTION ? 0 : now / 1000;
  for (const st of WORLD.stations) if (!st.__motion && st.screenMesh) motionDesk(st);
  for (const Q of this.quads) {
    if (!onCamera(Q.face)) continue;
    if (Q.kind === 'wall') updateWall(Q, t);
    else if (Q.kind === 'rack') updateRack(Q, t);
    else updateDesk(Q, t);
    if (REDUCED_MOTION) Q.u.uScan.value.z = 0;
  }
  this.cost = this.cost * 0.95 + (performance.now() - c0) * 0.05;
};
