/* =============================================================================
   85 · THE VIEW — binds OFFICE_STATE to the 3D room (people, desks, screens)
   -----------------------------------------------------------------------------
   Every information screen draws two ways from one function: a glance layout
   for the room (one headline number or the top few rows, very large type) and,
   while Igor has it focused (VIEW.focusKey === key), a detail layout with the
   fuller list and the secondary fields. Screens never invent data: each shows a
   designed "awaiting" state until the Studio bridge fills it, and says so calmly
   when a feed is stale or down.
   ============================================================================= */

const WORLD = { figures: [], stations: [], byId: {} };
const FEED_LABEL = { simulated: 'Simulated feed', live: 'Live screens', offline: 'Bridge offline', standby: 'Simulation off' };
const LOGO = { letters: null, amp: null };

/** Camera presets. The default vantage is south-west: the agents' right sides, the north wall and the east glass. */
const VIEWS = {
  overview: { target: [0.3, 0.45, 0.1], r: 27.5, theta: -0.62, phi: 0.98 },
  desks: { target: [0.2, 0.8, 0.05], r: 14.2, theta: -0.5, phi: 0.98 },
  boardroom: { target: [5.7, 1.4, -4.9], r: 8.2, theta: -0.3, phi: 1.12 },
  door: { target: [-8.75, 1.1, 0.15], r: 8.6, theta: 1.2, phi: 1.12 },
  screen: { target: [0, 1.76, -6.15], r: 6.4, theta: 0.0, phi: 1.43 },
  hotsheet: { target: [-5.2, 1.65, -6.15], r: 6.0, theta: 0.0, phi: 1.45 },
  hotlist: { target: [-5.2, 1.65, -6.15], r: 6.0, theta: 0.0, phi: 1.45 },
  datawall: { target: [7.9, 1.64, 1.4], r: 9, theta: -HALF_PI, phi: 1.42 },
  lounge: { target: [-5.65,.72,4.55], r: 6.3, theta: .18, phi: 1.12 },
  reading: { target: [5.0,.72,4.5], r: 5.2, theta: .15, phi: 1.14 },
  server: { target: [ROOM.server.cx, 1.3, ROOM.server.cz], r: 3.5, theta: 1.12, phi: 1.3 }, // face-on to the corner cabinet
  sculpture: { target: [1.6, 0.8, 4.75], r: 4.6, theta: 0, phi: 1.42 }, // square on, as you look in toward the Forum screen
  // the establishing shot: the office on the Palisades, the Hudson and the bridge below, Manhattan across the river
  hudson: { target: [1, 1.2, -1], r: 60, theta: -0.66, phi: 1.45 },
};
/** Presets whose distance is fitted to the free screen area on every resize. */
const FITTED = ['overview', 'desks', 'boardroom', 'door', 'screen', 'hotsheet', 'hotlist', 'datawall', 'lounge', 'reading', 'server'];

function fitView(name, pts, availW, availH, fill = 0.96) {
  const v = VIEWS[name];
  const cam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.3, 600);
  const tgt = new THREE.Vector3(...v.target);
  const W = renderer.domElement.clientWidth || window.innerWidth;
  const H = renderer.domElement.clientHeight || window.innerHeight;
  const q = new THREE.Vector3();
  const fits = r => {
    cam.position.set(tgt.x + r * Math.sin(v.phi) * Math.sin(v.theta), tgt.y + r * Math.cos(v.phi), tgt.z + r * Math.sin(v.phi) * Math.cos(v.theta));
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      q.copy(p).project(cam);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    return ((x1 - x0) / 2) * W <= availW * fill && ((y1 - y0) / 2) * H <= availH * fill;
  };
  let lo = 2, hi = 80;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  v.r = hi;
  return hi;
}
function boxPoints(x0, x1, y0, y1, z0, z1) {
  const pts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
}
/** Overview: the whole floor plus the lift vestibule. */
function fitOverview(availW, availH) {
  const pts = boxPoints(-8.3, 8.2, -0.52, 3.3, -6.45, 5.95);
  for (const z of [-1.7, 1.95]) pts.push(new THREE.Vector3(-10.8, 3.3, z), new THREE.Vector3(-10.8, -0.5, z));
  return fitView('overview', pts, availW, availH, 0.97);
}
function fitAllViews(aw, ah) {
  fitOverview(aw, ah);
  fitDesks(aw, ah);
  fitView('lounge', boxPoints(-8.05,-3.25,0,1.7,3.05,5.8),aw,ah,.88);
  fitView('reading', boxPoints(3.65,6.35,0,1.7,3.4,5.25),aw,ah,.88);
  fitView('server', boxPoints(ROOM.server.cx-.7,ROOM.server.cx+.7,0,2.45,ROOM.server.cz-.75,ROOM.server.cz+.75),aw,ah,.90);
  fitView('boardroom', boxPoints(3.4, 8.0, 0, 3.0, -6.2, -3.6), aw, ah, 0.96);
  fitView('door', boxPoints(-10.75, -6.9, 0, 3.0, -1.7, 1.95), aw, ah, 0.94);
  const sc = ROOM.screen;
  fitView('screen', boxPoints(sc.x - sc.w / 2 - 0.15, sc.x + sc.w / 2 + 0.15, sc.y - sc.h / 2 - 0.12, sc.y + sc.h / 2 + 0.12, sc.z, sc.z + 0.1), aw, ah, 0.97);
  const hl = ROOM.hotlist, lg = ROOM.logo;
  const hotPts = boxPoints(hl.x - hl.w / 2 - 0.12, lg.x + lg.w / 2 + 0.1, hl.yLo - hl.h / 2 - 0.08, hl.yUp + hl.h / 2 + 0.08, hl.z, hl.z + 0.1);
  VIEWS.hotsheet.target = VIEWS.hotlist.target = [(hl.x - hl.w / 2 + lg.x + lg.w / 2) / 2, (hl.yLo + hl.yUp) / 2, hl.z + 0.05];
  fitView('hotsheet', hotPts, aw, ah, 0.97);
  fitView('hotlist', hotPts, aw, ah, 0.97);
  const P = (ROOM_OBJ.panels || []).find(p => p.key === 'today');
  if (P) {
    // the whole east wall: Today & leads, the constellation beside it, the ticker over both
    const parts = [[P.group.position, P.w, P.h]];
    if (ROOM_OBJ.manual) parts.push([ROOM_OBJ.manual.group.position, ROOM_OBJ.manual.w, ROOM_OBJ.manual.h]);
    if (ROOM_OBJ.ticker && ROOM.ticker.rotY) parts.push([ROOM_OBJ.ticker.group.position, ROOM_OBJ.ticker.w, ROOM_OBJ.ticker.h]);
    const zA = Math.min(...parts.map(([q, w]) => q.z - w / 2)) - 0.15, zB = Math.max(...parts.map(([q, w]) => q.z + w / 2)) + 0.15;
    const yA = Math.min(...parts.map(([q, , h]) => q.y - h / 2)) - 0.1, yB = Math.max(...parts.map(([q, , h]) => q.y + h / 2)) + 0.08;
    VIEWS.datawall.target = [ROOM.x1 - 0.07, (yA + yB) / 2, (zA + zB) / 2];
    fitView('datawall', boxPoints(ROOM.x1 - 0.1, ROOM.x1, yA, yB, zA, zB), aw, ah, 0.97);
  }
}
/** Desks: every occupied desk with its rug and the label above its agent, centred on the group. */
function fitDesks(availW, availH) {
  const slots = OFFICE_STATE.order.map(id => ROOM.slots[OFFICE_STATE.agents[id].slot]);
  if (!slots.length) return VIEWS.desks.r;
  const xs = slots.map(s => s.x), zs = slots.map(s => s.z);
  VIEWS.desks.target = [(Math.min(...xs) + Math.max(...xs)) / 2 + 0.25, 0.8, (Math.min(...zs) + Math.max(...zs)) / 2 + 0.1];
  const pts = [];
  for (const s of slots) {
    for (const dx of [-RUG_R, RUG_R]) for (const dz of [-RUG_R, RUG_R]) pts.push(new THREE.Vector3(s.x + dx, 0, s.z + dz));
    pts.push(new THREE.Vector3(s.x, 2.1, s.z));
  }
  return fitView('desks', pts, availW, availH, 0.94);
}
const viewOf = name => {
  const v = VIEWS[name] || VIEWS.overview;
  return { target: new THREE.Vector3(...v.target), r: v.r, theta: v.theta, phi: v.phi };
};

function seatAgent(a) {
  const slot = ROOM.slots[a.slot];
  const L = a.look;
  const st = new Station({ id: a.id, name: a.name, specialty: a.specialty, color: L.color, seed: 3 + a.slot * 7, screen: L.screen, prop: L.prop });
  st.group.position.set(slot.x, 0, slot.z);
  st.group.traverse(o => o.isMesh && (o.userData.agentId = a.id));
  scene.add(st.group);
  const fig = new Figure(figureSpec(a));
  st.seat(fig);
  WORLD.figures.push(fig);
  WORLD.stations.push(st);
  WORLD.byId[a.id] = { fig, st, slot: a.slot };
  return WORLD.byId[a.id];
}

const VIEW = {
  tweens: [],
  screens: {},
  focusKey: null, // set by the UI while a screen is focused (detail layout)
  rackDirty: true,
  lastRack: 0,

  init() {
    for (const id of OFFICE_STATE.order) {
      seatAgent(OFFICE_STATE.agents[id]);
      this.sync(id);
    }
    this.initScreens();
    BUS.on('agent', a => {
      this.sync(a.id);
      this.dirty('main');
      this.rackDirty = true;
    });
    BUS.on('approval', ev => {
      this.dirty('main');
      if (ev && ev.type === 'request') {
        LIFE.gateFlash = performance.now(); // a gate arriving lights the "Needs you" block
        lifePing('main');
        lifeAnimate('main', performance.now() + 2700);
      }
    });
    BUS.on('task', () => this.dirty('main'));
    BUS.on('meta', () => this.dirty('main', 'hotnew', 'hotdone', 'today', 'pipeline', 'ticker'));
    BUS.on('hotsheet', ev => {
      this.dirty('hotnew', 'hotdone');
      lifePing('hotnew');
      lifePing('hotdone');
      (ev.rows || []).forEach(r => flareTown(r.town));
    });
    BUS.on('panel', key => {
      // the feed and the highlights share the Forum screen; "needs you" is the east wall's screen (key 'today')
      const sk = key === 'feed' || key === 'highlights' ? 'main' : key === 'needs' || key === 'buyers' ? 'today' : key;
      this.dirty(sk);
      lifePing(sk);
    });
    BUS.on('fleet', () => this.dirty('main'));
    BUS.on('ticker', () => {
      TICKER.rebuild = true;
      this.dirty('ticker');
      lifePing('ticker');
    });
    BUS.on('add', a => {
      this.arrive(a);
      this.rackDirty = true;
    });
  },

  /** Maps an agent's state to posture and its desk. */
  sync(id) {
    const a = OFFICE_STATE.agents[id];
    const w = WORLD.byId[id];
    if (!a || !w) return;
    const { fig, st } = w;
    const home = a.location === 'desk' && fig.root.parent === st.figureSlot;
    st.setActivity(a.paused ? 'paused' : !home ? 'away' : a.status === 'WORKING' ? (a.activity === 'browsing' ? 'browse' : 'work') : a.status === 'THINKING' ? 'think' : a.status === 'WAITING' ? 'wait' : 'idle');
    if (fig.glowMat && fig.robot) fig.glowMat.color.copy(lin(a.status === 'WAITING' ? BRAND.crimson : a.paused ? '#8c8c8e' : fig.colors.light));
    if (fig.ledGlow) fig.ledGlow.color.copy(lin(a.status === 'WAITING' ? BRAND.crimson : a.paused ? '#8c8c8e' : '#9fe3a8')); // the headset LED agrees with the eyes
    if (MOVE.walkers[id]) return; // the walker owns the stride
    if (a.status === 'WAITING') {
      fig.setMode('wave'); // stands and raises a hand wherever it is
    } else if (home) {
      const mode = a.paused ? 'paused'
        : a.status === 'WORKING' ? (a.activity === 'browsing' ? 'browse' : 'type')
        : a.status === 'THINKING' ? 'think'
        : a.status === 'DONE' ? 'done' : 'idle';
      fig.setMode(mode);
    } else if (DESTINATIONS[a.location] && fig._seated !== false) {
      fig.setMode(DESTINATIONS[a.location].pose); // (not while still standing in front of the seat, about to sit)
    }
  },

  /** A new agent: the desk materialises, the figure waits in the lift. */
  arrive(a) {
    const w = seatAgent(a);
    w.st.group.scale.setScalar(0.001);
    this.tweens.push({ t: 0, dur: 1.4, fn: k => w.st.group.scale.setScalar(Math.max(0.001, easeOut(k))) });
    this.sync(a.id);
    choreographArrival(a);
  },

  update(dt, t) {
    for (const tw of this.tweens) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(tw.t);
    }
    this.tweens = this.tweens.filter(tw => tw.t < 1);
    // waiting agents turn toward the owner's camera
    const th = controls.sph.theta;
    for (const id of OFFICE_STATE.order) {
      const w = WORLD.byId[id];
      if (!w) continue;
      w.st.lookYaw = OFFICE_STATE.agents[id].status === 'WAITING' ? clamp(wrapAngle(th - STATION_YAW), -1.15, 1.15) : 0;
    }
    // screens redraw on change, when focus changes, and at least every 20 s for their clocks
    const now = performance.now();
    if (this._focusSeen !== this.focusKey) {
      if (this._focusSeen) this.dirty(this._focusSeen);
      if (this.focusKey) this.dirty(this.focusKey);
      this._focusSeen = this.focusKey;
    }
    lifeUpdate(now);
    if (typeof MOTION !== 'undefined') MOTION.update(now); // the quiet motion layer (86b)
    clockUpdate();
    for (const [key, sc] of Object.entries(this.screens)) {
      if (sc.live) continue;
      const L = LIFE.by[key];
      const moving = L && L.animUntil > now;
      const focused = this.focusKey === key;
      if (moving && (focused || L.visible) && now - sc.last > (focused ? 0 : 1000 / LIFE_FPS)) sc.dirty = true, sc.last = 0;
      else if (moving && !(focused || L.visible)) L.animUntil = 0, sc.dirty = true; // off camera: land on the end state
      else if (L && L.animUntil && !moving && sc.last < L.animUntil) L.animUntil = 0, sc.dirty = true, sc.last = 0; // it ended between two frames: draw the end state once
      if ((sc.dirty && now - sc.last > 400) || now - sc.last > 20000) {
        sc.draw(sc.ctx);
        sc.tex.needsUpdate = true;
        sc.last = now;
        sc.dirty = false;
        if (typeof UI !== 'undefined' && UI.mirrorKey === key && UI.renderScreenMirror) UI.renderScreenMirror();
      }
    }
    tickerUpdate(dt, now);
    if (hlAdvance(now)) this.dirty('main'); // the highlights turn to their next tab
    manualUpdate(this.screens.manual, now, this.focusKey);
    if (this.rackDirty && now - this.lastRack > 600) {
      drawRackFace();
      this.rackDirty = false;
      this.lastRack = now;
    }
  },

  dirty(...keys) {
    for (const k of keys) if (this.screens[k]) this.screens[k].dirty = true;
  },

  initScreens() {
    const mk = (key, obj, W, H, draw) => {
      if (!obj) return;
      const c = makeCanvas(W, H);
      const tex = canvasTexture(c);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      obj.face.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const ctx = c.getContext('2d');
      this.screens[key] = {
        key, canvas: c, ctx, tex, W, H, face: obj.face, last: 0, dirty: true,
        draw: g => {
          const room = g === ctx;
          if (room) lifeBegin(key);
          try { draw(g, W, H, this.focusKey === key); } finally { if (room) lifeEnd(key); }
        },
      };
    };
    const MAIN_H = ROOM_OBJ.screen ? Math.round((2048 * ROOM_OBJ.screen.h) / ROOM_OBJ.screen.w) : 1152;
    mk('main', ROOM_OBJ.screen, 2048, MAIN_H, drawMainScreen);
    if (ROOM_OBJ.hotlist) {
      const hotWidth = Math.round(936 * ROOM.hotlist.w / ROOM.hotlist.h);
      mk('hotnew', ROOM_OBJ.hotlist.hotnew, hotWidth, 936, (g, W, H, d) => drawHotList('new', g, W, H, d));
      mk('hotdone', ROOM_OBJ.hotlist.hotdone, hotWidth, 936, (g, W, H, d) => drawHotList('done', g, W, H, d));
    }
    for (const p of ROOM_OBJ.panels || []) mk(p.key, p, 2048, 1152, p.key === 'pipeline' ? drawPipeline : p.key === 'today' ? drawNeeds : drawTodayLeads);
    // the strip's own aspect; a long strip gets a wider canvas so its words stay sharp (a full-wall strip: 8192 wide)
    const tkAsp = ROOM_OBJ.ticker ? ROOM_OBJ.ticker.w / ROOM_OBJ.ticker.h : 7;
    const TKW = Math.min(tkAsp > 12 ? 8192 : tkAsp > 8 ? 4096 : 2048, renderer.capabilities.maxTextureSize || 4096);
    const TKH = ROOM_OBJ.ticker ? Math.round(TKW / tkAsp) : 286;
    if (ROOM_OBJ.ticker) {
      mk('ticker', ROOM_OBJ.ticker, TKW, TKH, drawTickerDetail);
      // the west and east walls show the same lit strip as the north (which also carries the focus view): one
      // emissive material of their own, never the shared dark screen glass, whose colour would black the words out
      const strip = new THREE.MeshBasicMaterial({ color: lin('#060607'), toneMapped: false, fog: false });
      for (const sg of ROOM_OBJ.ticker.segs || []) {
        if (sg.face !== ROOM_OBJ.ticker.face) sg.face.material = strip;
        if (sg.outer) sg.outer.material = strip;
      }
    }
    // the Field: drawn by the manual's own module; any canvas other than the room's (a mirror) gets the detailed layer
    if (ROOM_OBJ.manual && typeof FIELD !== 'undefined') {
      mk('manual', ROOM_OBJ.manual, MANUAL_TEX.W, MANUAL_TEX.H, g => FIELD.draw(g, MANUAL_TEX.W, MANUAL_TEX.H, performance.now() / 1000, { detail: !this.screens.manual || g !== this.screens.manual.ctx }));
      const sc = this.screens.manual;
      sc.live = true; // redrawn every frame it can be seen, not on change
      sc.tex.generateMipmaps = true;
    }
    // the living layer: ambient overlays on every information screen (the Field animates on its own)
    if (ROOM_OBJ.screen) lifeFor('main', ROOM_OBJ.screen, 2048, MAIN_H, { period: 60000 });
    if (ROOM_OBJ.hotlist) {
      const hotWidth = Math.round(936 * ROOM.hotlist.w / ROOM.hotlist.h);
      lifeFor('hotnew', ROOM_OBJ.hotlist.hotnew, hotWidth, 936);
      lifeFor('hotdone', ROOM_OBJ.hotlist.hotdone, hotWidth, 936);
    }
    for (const p of ROOM_OBJ.panels || []) lifeFor(p.key, p, 2048, 1152);
    if (ROOM_OBJ.ticker) lifeFor('ticker', ROOM_OBJ.ticker, TKW, TKH, { leds: 4, bars: 0, ledY: 18, hairInset: 7, px: TKH / 271 });
    // (the Forum screen no longer carries a clock: the feed and the highlights use its full width)
    for (const sc of Object.values(this.screens)) {
      sc.draw(sc.ctx);
      sc.tex.needsUpdate = true;
      sc.last = performance.now();
      sc.dirty = false;
    }
    TICKER.rebuild = true;
    if (typeof MOTION !== 'undefined') MOTION.init(); // the quiet motion layer (86b)
  },
};

/* ---------- the Field screen: a 48 s loop, drawn at no more than 6 fps while it is on camera and nothing else is focused ---------- */

const MANUAL_TEX = { W: 1280, H: 720, fps: 6 };
const _mf = { frustum: new THREE.Frustum(), m: new THREE.Matrix4(), c: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion() };
function manualUpdate(sc, now, focusKey) {
  if (document.hidden || !sc || typeof FIELD === 'undefined') return;
  if (focusKey && focusKey !== 'manual') return; // another screen is up close: hold the frame
  if (now - sc.last < 1000 / MANUAL_TEX.fps) return;
  const face = sc.face;
  face.updateWorldMatrix(true, false);
  _mf.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _mf.frustum.setFromProjectionMatrix(_mf.m);
  if (!face.geometry.boundingSphere) face.geometry.computeBoundingSphere();
  if (!_mf.frustum.intersectsObject(face)) return;
  // facing away (seen from behind the wall) counts as off camera too
  face.getWorldPosition(_mf.c);
  face.getWorldQuaternion(_mf.q);
  _mf.n.set(0, 0, 1).applyQuaternion(_mf.q);
  if (_mf.n.dot(_mf.c.sub(camera.position).negate()) <= 0) return;
  sc.draw(sc.ctx);
  sc.tex.needsUpdate = true;
  sc.last = now;
  if (typeof UI !== 'undefined' && UI.mirrorKey === 'manual' && UI.renderScreenMirror) UI.renderScreenMirror();
}

/* ---------- the living layer: quiet motion round steady information, and reactive moments when data changes ----------
   Ambient (always, only while the screen is on camera): a pulsing live dot, a corner strip of status LEDs blinking at
   their own rates, a few breathing bars, a hairline filling toward the next refresh, a slow light sweep along the
   header rule — all small meshes in the margins, never behind text. Reactive (when the data actually changes):
   numbers count to their new value, new rows slide in with a crimson underline that fades over ~2 s, removed rows
   fade out, the bezel glows once, and a real gate lights the main screen's "Needs you" block. The numbers, rows and
   labels themselves never move while being read: content redraws only for those moments (~15 fps, full rate when
   focused), and only for screens on camera. */

const LIFE = { by: {}, num: {}, rows: {}, gateFlash: 0, drawing: null, cap: null };
const lifeTex = (() => {
  const dot = makeCanvas(64, 64), d = dot.getContext('2d');
  const gr = d.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.62, 'rgba(255,255,255,0.25)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  d.fillStyle = gr;
  d.fillRect(0, 0, 64, 64);
  const ring = makeCanvas(64, 64), r = ring.getContext('2d');
  r.strokeStyle = 'rgba(255,255,255,0.9)';
  r.lineWidth = 4;
  r.beginPath();
  r.arc(32, 32, 26, 0, TAU);
  r.stroke();
  const sw = makeCanvas(256, 8), s = sw.getContext('2d');
  const sg = s.createLinearGradient(0, 0, 256, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.5, 'rgba(255,255,255,1)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  s.fillStyle = sg;
  s.fillRect(0, 0, 256, 8);
  return { dot: canvasTexture(dot), ring: canvasTexture(ring), sweep: canvasTexture(sw) };
})();
const lifeMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color: lin(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
const LIFE_FPS = 15;

/** Builds the ambient overlays for one screen (children of its face, so they ride with it). */
function lifeFor(key, obj, W, H, opts = {}) {
  const face = obj.face;
  const k = obj.w / W; // metres per canvas pixel
  const at = (m, cx, cy, z = 0.0016) => {
    m.position.set((cx / W - 0.5) * obj.w, (0.5 - cy / H) * obj.h, z);
    m.raycast = () => {};
    m.renderOrder = 3;
    face.add(m);
    return m;
  };
  const plane = (wPx, hPx, mat, ax = 0.5, ay = 0.5) => {
    const g = new THREE.PlaneGeometry(wPx * k, hPx * k);
    g.translate((0.5 - ax) * wPx * k, (ay - 0.5) * hPx * k, 0);
    return new THREE.Mesh(g, mat);
  };
  const s = opts.px || 1; // the marks keep their size on a canvas drawn at a finer pitch (the full-wall ticker)
  const L = { key, obj, W, H, face, px: s, leds: [], bars: [], glowT: 0, refreshT: performance.now(), period: opts.period || 20000, visible: false, last: 0 };
  // the LED strip, top right: neutral whites and a green, each at its own rate
  const ledCols = ['#ffffff', '#cfd6dd', '#45c27a', '#ffffff', '#9fb3c2', '#e8eaee'];
  const nLed = opts.leds == null ? 6 : opts.leds;
  const ledY = (opts.ledY || 26) * s;
  for (let i = 0; i < nLed; i++) {
    const m = at(plane(18 * s, 18 * s, lifeMat(lifeTex.dot, ledCols[i % ledCols.length], 0.2)), W - (30 + i * 26) * s, ledY);
    L.leds.push({ m, rate: 0.35 + ((i * 37) % 11) / 7, phase: (i * 0.37) % 1, duty: 0.25 + ((i * 13) % 7) / 14 });
  }
  // breathing bars beside the LEDs
  const nBar = opts.bars == null ? 5 : opts.bars;
  for (let j = 0; j < nBar; j++) {
    const m = at(plane(6 * s, 26 * s, lifeMat(null, '#ffffff', 0.32), 0.5, 0), W - (30 + nLed * 26 + 26 + j * 11) * s, ledY + 12 * s);
    L.bars.push({ m, w: 0.7 + j * 0.23, ph: j * 1.3 });
  }
  // the refresh hairline along the bottom edge, and its faint track
  const x0 = 24 * s, x1 = W - 24 * s, hy = H - (opts.hairInset || 9) * s;
  L.track = at(plane(x1 - x0, 3 * s, lifeMat(null, '#ffffff', 0.07), 0, 0.5), x0, hy);
  L.hair = at(plane(x1 - x0, 3 * s, lifeMat(null, '#ffffff', 0.3), 0, 0.5), x0, hy, 0.0018);
  // the sweep along the header rule (placed once the screen has drawn its rule)
  L.sweep = at(plane(260 * s, 5 * s, lifeMat(lifeTex.sweep, '#ffffff', 0)), W / 2, 200, 0.0019);
  // the live dot's pulse (placed on the status dot the screen drew)
  L.ring = at(plane(40 * s, 40 * s, lifeMat(lifeTex.ring, '#36c46b', 0)), -999, -999, 0.0019);
  // the bezel: its own material, so it can glow once on its own
  if (obj.bezel) {
    obj.bezel.material = obj.bezel.material.clone();
    obj.bezel.material.emissive = new THREE.Color(0, 0, 0);
    L.bezelMat = obj.bezel.material;
  }
  LIFE.by[key] = L;
  return L;
}

/** A screen's data changed: glow the bezel once, restart its refresh hairline. */
function lifePing(key, glow = true) {
  const L = LIFE.by[key];
  if (!L) return;
  const now = performance.now();
  if (glow) L.glowT = now;
  L.refreshT = now;
}

/** A number that counts to its new value (screen-scoped); keeps its screen redrawing until it lands. */
function liveNum(sk, id, v) {
  if (typeof v !== 'number' || !isFinite(v)) return v;
  const key = sk + ':' + id, now = performance.now();
  const room = LIFE.drawing === sk;
  let N = LIFE.num[key];
  if (!N) N = LIFE.num[key] = { from: v, to: v, t0: 0, cur: v };
  if (!room) return N.to === v ? N.cur : v; // a mirror shows the value as is
  if (N.to !== v) Object.assign(N, { from: N.cur, to: v, t0: now });
  const k = clamp((now - N.t0) / 900, 0, 1);
  N.cur = N.from + (N.to - N.from) * easeOut(k);
  if (k < 1) lifeAnimate(sk, N.t0 + 1000); // to the end of the count, however far apart frames are
  return N.cur;
}
const liveInt = (sk, id, v) => (typeof v === 'number' ? Math.round(liveNum(sk, id, v)) : v);

/** Arrival of a row (by key) on a screen: slide in (0.5 s) and a crimson underline that fades (2 s). */
function rowFx(sk, rowKey) {
  const room = LIFE.drawing === sk;
  const R = (LIFE.rows[sk] = LIFE.rows[sk] || { primed: false, born: new Map(), seen: new Set() });
  if (!room) return { dx: 0, a: 1, flash: 0 };
  R.seen.add(rowKey);
  if (!R.born.has(rowKey)) {
    // new only when data has just arrived (a row that appears because the layout grew on focus is not news)
    const L = LIFE.by[sk];
    R.born.set(rowKey, R.primed && L && performance.now() - L.refreshT < 3000 ? performance.now() : -1e9);
  }
  const age = performance.now() - R.born.get(rowKey);
  if (age > 2000) return { dx: 0, a: 1, flash: 0 };
  lifeAnimate(sk, R.born.get(rowKey) + 2100);
  const s = clamp(age / 500, 0, 1);
  return { dx: (1 - easeOut(s)) * 70, a: easeOut(s), flash: 1 - age / 2000 };
}
/** Draws a row's crimson arrival underline. */
function rowFlash(ctx, fx, x0, x1, y) {
  if (!fx.flash) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fx.flash) * 0.95;
  ctx.fillStyle = BRAND.crimson;
  ctx.fillRect(x0, y, (x1 - x0) * Math.min(1, 0.35 + fx.a), 5);
  ctx.restore();
}
function lifeAnimate(sk, until) {
  const L = LIFE.by[sk];
  if (L) L.animUntil = Math.max(L.animUntil || 0, until);
}
/** Called around each room draw: what the screen drew where (its header rule, its status dot). */
function lifeBegin(sk) {
  LIFE.drawing = sk;
  LIFE.cap = { rule: null, dot: null, list: null, body: null };
  const R = LIFE.rows[sk];
  if (R) R.seen = new Set();
}
function lifeEnd(sk) {
  const L = LIFE.by[sk], cap = LIFE.cap;
  LIFE.drawing = null;
  const R = LIFE.rows[sk];
  if (R) {
    R.primed = true;
    for (const k of [...R.born.keys()]) if (!R.seen.has(k)) R.born.delete(k); // gone: it slides in again if it returns
  }
  if (!L || !cap) return;
  if (cap.rule) L.rule = cap.rule;
  L.dot = cap.dot;
  L.list = cap.list; // where the list sits (the motion layer's scan runs down it)
  L.body = cap.body;
}

const _lf = { frustum: new THREE.Frustum(), m: new THREE.Matrix4(), c: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion() };
/** On camera: inside the frustum and seen from the front. */
function onCamera(face) {
  face.updateWorldMatrix(true, false);
  _lf.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _lf.frustum.setFromProjectionMatrix(_lf.m);
  if (!face.geometry.boundingSphere) face.geometry.computeBoundingSphere();
  if (!_lf.frustum.intersectsObject(face)) return false;
  face.getWorldPosition(_lf.c);
  face.getWorldQuaternion(_lf.q);
  _lf.n.set(0, 0, 1).applyQuaternion(_lf.q);
  return _lf.n.dot(_lf.c.sub(camera.position).negate()) > 0;
}

/** Per frame: the ambient overlays of every screen on camera. */
function lifeUpdate(now) {
  const t = now / 1000;
  for (const L of Object.values(LIFE.by)) {
    L.visible = onCamera(L.face);
    if (!L.visible) continue;
    for (const d of L.leds) {
      const on = (t * d.rate + d.phase) % 1 < d.duty;
      d.m.material.opacity += ((on ? 0.95 : 0.14) - d.m.material.opacity) * 0.35;
    }
    for (const b of L.bars) b.m.scale.y = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.w + b.ph)) * (0.75 + 0.25 * Math.sin(t * 0.31 + b.ph));
    // the hairline: the main screen's runs with the minute; the others fill toward their next refresh
    const f = L.key === 'main' ? (Date.now() % 60000) / 60000 : ((now - L.refreshT) % L.period) / L.period;
    L.hair.scale.x = Math.max(0.001, f);
    // the sweep along the header rule, every 7 s
    if (L.rule && !REDUCED_MOTION) {
      const u = ((t + (L.key.length % 5)) % 7) / 2.8;
      if (u <= 1) {
        L.sweep.position.x = ((lerp(L.rule.x0 + 130 * L.px, L.rule.x1 - 130 * L.px, u)) / L.W - 0.5) * L.obj.w;
        L.sweep.position.y = (0.5 - (L.rule.y + 1.5) / L.H) * L.obj.h;
        L.sweep.material.opacity = Math.sin(u * Math.PI) * 0.6;
      } else L.sweep.material.opacity = 0;
    }
    // the live dot breathes out a ring: brisk when live, slow and faint otherwise
    if (L.dot) {
      const per = L.dot.live ? 2.2 : 4.4, u = (t % per) / per;
      L.ring.position.set((L.dot.x / L.W - 0.5) * L.obj.w, (0.5 - L.dot.y / L.H) * L.obj.h, 0.0019);
      L.ring.scale.setScalar((L.dot.r * 2 / (40 * L.px)) * (1 + u * 1.6));
      L.ring.material.color.copy(lin(L.dot.color));
      L.ring.material.opacity = (1 - u) * (L.dot.live ? 0.7 : 0.25);
    } else L.ring.material.opacity = 0;
    // the bezel glows once when its data changes
    if (L.bezelMat) {
      const g = clamp(1 - (now - L.glowT) / 1400, 0, 1);
      L.bezelMat.emissive.setScalar(g * g * 0.55);
    }
  }
}

/* ---------- the main screen's clock: seconds tick in fixed cells, so nothing shifts ---------- */
const CLOCK = { canvas: null, tex: null, mesh: null, last: '' };
function clockFor(obj, W, H, M) {
  const cw = 820, ch = 140;
  CLOCK.canvas = makeCanvas(cw, ch);
  CLOCK.tex = canvasTexture(CLOCK.canvas);
  const k = obj.w / W;
  const g = new THREE.PlaneGeometry(cw * k, ch * k);
  CLOCK.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: CLOCK.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  CLOCK.mesh.raycast = () => {};
  CLOCK.mesh.renderOrder = 3;
  // right edge at W - M, baseline at y = 150 (the header's time), the canvas baseline at 112
  CLOCK.mesh.position.set(((W - M - cw / 2) / W - 0.5) * obj.w, (0.5 - (150 - 112 + ch / 2) / H) * obj.h, 0.0015);
  obj.face.add(CLOCK.mesh);
}
function clockUpdate() {
  if (!CLOCK.canvas) return;
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).formatToParts(new Date());
  const get = t => (p.find(x => x.type === t) || {}).value || '';
  const s = `${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')}`;
  if (s === CLOCK.last) return;
  CLOCK.last = s;
  const ctx = CLOCK.canvas.getContext('2d'), cw = CLOCK.canvas.width;
  ctx.clearRect(0, 0, cw, CLOCK.canvas.height);
  ctx.textBaseline = 'alphabetic';
  // fixed cells right to left: AM/PM, seconds (dim), colon, minutes, colon, hours
  ctx.font = `600 92px ${BRAND.ui}`;
  const cell = 58, colon = 26;
  let x = cw - 4;
  const put = (ch, w, col, size = 92) => {
    ctx.font = `600 ${size}px ${BRAND.ui}`;
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.fillText(ch, x - w / 2, 112);
    x -= w;
  };
  ctx.font = `600 56px ${BRAND.ui}`;
  const ampm = get('dayPeriod');
  ctx.fillStyle = '#8d8d8d';
  ctx.textAlign = 'right';
  ctx.fillText(ampm, x, 112);
  x -= ctx.measureText(ampm).width + 22;
  const sec = get('second');
  put(sec[1], 36, '#7d8086', 60);
  put(sec[0], 36, '#7d8086', 60);
  put(':', 18, '#7d8086', 60);
  const mm = get('minute'), hh = get('hour');
  put(mm[1], cell, SC.ink);
  put(mm[0], cell, SC.ink);
  put(':', colon, SC.ink);
  for (const ch of [...hh].reverse()) put(ch, cell, SC.ink);
  ctx.textAlign = 'left';
  CLOCK.tex.needsUpdate = true;
}

/* ---------- screen kit: one drawing path for the room, the focus view and the full-screen mirror ---------- */

const SC = { bg: '#08090b', rule: '#24262a', dim: '#9a9da3', faint: '#5f6268', ink: '#ffffff', card: '#121417', amber: '#f0a05a', green: '#45c27a' };
function scEyebrow(ctx, text, x, y, size = 22, color = SC.dim, spacing = 6, align = 'left') {
  ctx.font = `600 ${size}px ${BRAND.ui}`;
  ctx.fillStyle = color;
  return spacedText(ctx, String(text).toUpperCase(), x, y, spacing, align);
}
function scFit(ctx, text, maxW) {
  text = String(text == null ? '' : text);
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function scText(ctx, text, x, y, size, color = SC.ink, weight = 500, maxW = 4000, align = 'left') {
  ctx.font = `${weight} ${size}px ${BRAND.ui}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(scFit(ctx, text, maxW), x, y);
  ctx.textAlign = 'left';
}
/** Contact names stay complete; fit their type size instead of replacing letters with an ellipsis. */
function scName(ctx, text, x, y, size, color = SC.ink, weight = 600, maxW = 4000) {
  const name = String(text == null ? '' : text);
  ctx.font = `${weight} ${size}px ${BRAND.ui}`;
  const width = ctx.measureText(name).width;
  const fittedSize = width > maxW && width > 0 ? size * maxW / width : size;
  ctx.font = `${weight} ${fittedSize}px ${BRAND.ui}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(name, x, y);
  return Math.min(width, maxW);
}
function scRule(ctx, x0, x1, y) {
  ctx.fillStyle = SC.rule;
  ctx.fillRect(x0, y, x1 - x0, 3);
  if (LIFE.cap && !LIFE.cap.rule) LIFE.cap.rule = { x0, x1, y };
}
/** A feed's status, said calmly: live, stale (with its note), down, or awaiting. */
function feedLine(F) {
  const t = F && F.asOf ? fmtTime(new Date(F.asOf)) : null;
  switch (F && F.status) {
    case 'live': return { dot: '#36c46b', text: t ? `Live · ${t}` : 'Live', quiet: false };
    case 'stale': return { dot: SC.amber, text: 'STALE · ' + (F.note || (t ? `Showing ${t} data` : 'Showing the last good data')), quiet: true };
    case 'error': return { dot: '#6f7278', text: F.note || 'Feed unavailable — reconnecting', quiet: true };
    default: return { dot: '#5a5d63', text: 'Awaiting the live feed', quiet: true };
  }
}
function scStatus(ctx, xr, y, F, size) {
  const s = feedLine(F);
  ctx.font = `500 ${size}px ${BRAND.ui}`;
  const txt = scFit(ctx, s.text, 900);
  const w = ctx.measureText(txt).width;
  ctx.fillStyle = s.dot;
  ctx.beginPath();
  ctx.arc(xr - w - size * 0.75, y - size * 0.34, size * 0.3, 0, TAU);
  ctx.fill();
  if (LIFE.cap) LIFE.cap.dot = { x: xr - w - size * 0.75, y: y - size * 0.34, r: size * 0.3, color: s.dot, live: F && F.status === 'live' };
  ctx.fillStyle = s.quiet ? SC.dim : SC.ink;
  ctx.textAlign = 'right';
  ctx.fillText(txt, xr, y);
  ctx.textAlign = 'left';
}
function scHeader(ctx, W, M, title, F, size = 78, sub = null) {
  if (LIFE.cap && !LIFE.cap.rule) LIFE.cap.rule = { x0: M, x1: W - M, y: M + size * 0.86 + (sub ? size * 0.62 + size * 0.3 : size * 0.3) };
  scText(ctx, title, M, M + size * 0.86, size, SC.ink, 600);
  if (sub) scText(ctx, sub, M, M + size * 0.86 + size * 0.62, size * 0.46, SC.dim, 500);
  if (F) scStatus(ctx, W - M, M + size * 0.6, F, Math.round(size * 0.42));
}
function scEmpty(ctx, x, y, w, title, line, size = 64) {
  scText(ctx, title, x, y, size, SC.ink, 600, w);
  if (line) scText(ctx, line, x, y + size * 0.95, Math.round(size * 0.55), SC.dim, 500, w);
}
const money = n => (n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`);
const ago = ms => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

/* ---------- the Forum screen (v8): RealScout's live feed beside the three contact highlights ---------- */

/** Where each drawn row or tab sits on its canvas, so a click on a screen up close can act on it. */
const HITS = {};
function hitReset(key) {
  if (LIFE.drawing === key) HITS[key] = []; // only the room's own canvas: a mirror draws at another size
}
function hitAdd(key, x0, y0, x1, y1, act) {
  if (LIFE.drawing === key) (HITS[key] = HITS[key] || []).push({ x0, y0, x1, y1, act });
}
/** What sits under a point of a room screen's canvas (u, v as the raycaster reports them), if anything. */
function hitAt(key, uv) {
  const sc = VIEW.screens[key];
  if (!sc || !uv) return null;
  const x = uv.x * sc.W, y = (1 - uv.y) * sc.H;
  return (HITS[key] || []).find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) || null;
}
const HL_TABS = [['engaged', 'Most engaged'], ['reengaged', 'Recently re-engaged'], ['slipping', 'Slipping away']];
const HL = { tab: 0, at: performance.now(), picked: -1e9 }; // the tab on show turns every 12 s unless Igor chose one this minute
function hlAdvance(now) {
  if (now - HL.picked < 60000 || now - HL.at < 12000) return false;
  HL.tab = (HL.tab + 1) % HL_TABS.length;
  HL.at = now;
  return true;
}
const FEED_DOT = { view: '#e8eaee', save: '#ffffff', inquiry: BRAND.crimson, signup: BRAND.crimson, lead: BRAND.crimson, text_in: BRAND.crimson,
  text_out: '#8a8e95', email: '#b9bec6', click: '#ffffff', page: '#6f737a', visit: '#ffffff', search: '#9aa0a8', unsub: '#6f737a', bounce: '#6f737a' };

function drawMainScreen(ctx, W, H, detail) {
  hitReset('main');
  const M = 72, mid = W / 2;
  const F = OFFICE_STATE.panels.feed, Hl = OFFICE_STATE.panels.highlights;
  ctx.fillStyle = '#070708';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // the divide
  ctx.fillStyle = SC.rule;
  ctx.fillRect(mid - 1, 44, 3, H - 88);
  // ---- left: the live feed ----
  const lx0 = M, lx1 = mid - 52;
  scEyebrow(ctx, 'Live feed', lx0, 92, 30, '#d9dbdf', 7);
  scText(ctx, 'RealScout + Follow Up Boss', lx0, 136, 28, SC.dim, 500, lx1 - lx0 - 360);
  scStatus(ctx, lx1, 100, F, 28);
  scRule(ctx, lx0, lx1, 166);
  if (LIFE.cap) LIFE.cap.body = { x0: lx0, x1: lx1, y0: 176, y1: H - 40 };
  const items = F.status === 'awaiting' ? [] : F.items || [];
  const rh = 112, y0 = 236;
  const rows = Math.max(1, Math.floor((H - y0 - 24) / rh) + 1);
  if (!items.length) scEmpty(ctx, lx0, y0 + 40, lx1 - lx0, F.status === 'awaiting' ? 'Waiting for the Studio' : 'Quiet for now', 'Views, saves, inquiries, email opens and texts appear here as they happen', 54);
  items.slice(0, rows).forEach((it, i) => {
    const y = y0 + i * rh;
    const fx = rowFx('main', 'f:' + it.text + '|' + it.at);
    rowFlash(ctx, fx, lx0, lx1, y + 18);
    ctx.fillStyle = FEED_DOT[it.kind] || '#9aa3ad';
    ctx.beginPath();
    ctx.arc(lx0 + 11, y - 13, 10, 0, TAU);
    ctx.fill();
    const t = it.at ? ago(new Date(it.at).getTime()) : '';
    ctx.font = `500 28px ${BRAND.ui}`;
    const tw = t ? ctx.measureText(t).width + 18 : 0;
    const room = lx1 - lx0 - 40 - tw;
    const ww = scName(ctx, it.who, lx0 + 40 + fx.dx, y, 38, SC.ink, 600, room * 0.56);
    const rest = `${it.verb || ''}${it.n > 1 ? ' · ×' + it.n : ''}`;
    scText(ctx, rest, lx0 + 40 + ww + 14, y, 33, /not delivered|unsub|bounce/i.test(rest) ? SC.amber : '#b9bdc4', 500, room - ww - 14);
    if (it.what) scText(ctx,it.what,lx0+40,y+36,27,SC.dim,500,room);
    if (t) scText(ctx, t, lx1, y, 28, SC.faint, 500, 200, 'right');
    if (it.link) hitAdd('main', lx0, y - 48, lx1, y + 45, { link: it.link, label: it.who });
  });
  // ---- right: the contact highlights, three tabs ----
  const rx0 = mid + 52, rx1 = W - M;
  scEyebrow(ctx, 'Contact highlights', rx0, 92, 30, '#d9dbdf', 7);
  scStatus(ctx, rx1, 100, Hl, 28);
  const counts = Hl.counts || {};
  let tx = rx0;
  if (Hl.historyAsOf) scText(ctx, `60-day context checked ${fmtTime(new Date(Hl.historyAsOf))} ET`, rx0, 137, 22, SC.dim, 500, rx1-rx0);
  const ty = 180;
  HL_TABS.forEach(([key, label], i) => {
    const on = i === HL.tab;
    const n = Hl.status === 'awaiting' ? '' : String((Hl[key] || []).length < (counts[key] || 0) ? counts[key] : (Hl[key] || []).length);
    const txt = label + (n ? `  ${n}` : '');
    ctx.font = `${on ? 600 : 500} 31px ${BRAND.ui}`;
    const w = ctx.measureText(txt).width;
    scText(ctx, txt, tx, ty, 31, on ? SC.ink : SC.dim, on ? 600 : 500);
    if (on) {
      ctx.fillStyle = BRAND.crimson;
      ctx.fillRect(tx, ty + 14, w, 5);
    }
    hitAdd('main', tx - 12, ty - 40, tx + w + 12, ty + 26, { tab: i });
    tx += w + 46;
  });
  scRule(ctx, rx0, rx1, 216);
  const key = HL_TABS[HL.tab][0];
  const list = Hl.status === 'awaiting' ? [] : Hl[key] || [];
  const hh = 112, hy0 = 298;
  const hrows = Math.max(1, Math.floor((H - hy0 - 10) / hh) + 1);
  if (!list.length) {
    const why = { engaged: 'Nobody with three or more actions this week yet', reengaged: 'Nobody back after a long quiet this week', slipping: 'Nobody engaged who has gone quiet' };
    scEmpty(ctx, rx0, hy0 + 30, rx1 - rx0, Hl.status === 'awaiting' ? 'Waiting for the Studio' : 'None right now', Hl.status === 'awaiting' ? 'Worked out from RealScout activity in Follow Up Boss' : why[key], 54);
  }
  list.slice(0, hrows).forEach((r, i) => {
    const y = hy0 + i * hh;
    const fx = rowFx('main', 'h:' + key + '|' + r.who);
    rowFlash(ctx, fx, rx0, rx1, y + 52);
    const when = r.last ? ago(new Date(r.last).getTime()) : '';
    let right = rx1;
    if (r.scoutScore != null) {
      const pill = String(r.scoutScore);
      ctx.font = `600 28px ${BRAND.ui}`;
      const pw = ctx.measureText(pill).width + 30;
      ctx.strokeStyle = '#3a3d42';
      ctx.lineWidth = 3;
      roundRect(ctx, rx1 - pw, y - 36, pw, 46, 23);
      ctx.stroke();
      scText(ctx, pill, rx1 - pw / 2, y - 3, 28, SC.ink, 600, pw, 'center');
      right = rx1 - pw - 18;
    }
    scName(ctx, r.who, rx0 + fx.dx, y, 42, SC.ink, 600, right - rx0);
    scText(ctx, r.reason || '', rx0, y + 46, 30, key === 'slipping' ? SC.amber : '#b9bdc4', 500, rx1 - rx0 - 130);
    if (when) scText(ctx, when, rx1, y + 46, 28, SC.faint, 500, 120, 'right');
    if (r.link) hitAdd('main', rx0, y - 46, rx1, y + 60, { link: r.link, label: r.who });
  });
}

/* ---------- the east wall (v8): everything that needs Igor, each a click away from where he handles it ---------- */

const NEED_TAG = { system: ['Fix', SC.amber], overdue: ['Overdue', SC.amber], approval: ['Approve', BRAND.crimson], today: ['Today', '#d9dbdf'],
  appointment: ['Appointment', '#d9dbdf'], lead: ['New lead', BRAND.crimson] };
function drawNeeds(ctx, W, H, detail) {
  hitReset('today');
  const M = 80;
  const N = OFFICE_STATE.panels.needs;
  ctx.fillStyle = SC.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const items = N.status === 'awaiting' ? [] : N.items || [];
  const total = N.total || items.length;
  scHeader(ctx, W, M, total ? `Needs you · ${total}` : 'Needs you', N, detail ? 66 : 74);
  const top = 236;
  scRule(ctx, M, W - M, top - 40);
  if (!items.length) {
    scEmpty(ctx, M, top + 120, W - 2 * M, N.status === 'awaiting' ? 'Waiting for the Studio' : 'Nothing needs you right now',
      'Overdue and due tasks, drafts to approve, appointments, new leads and sign-ins appear here', 66);
    return;
  }
  const rh = 128, rows = Math.floor((H - top - 40) / rh);
  const shown = items.slice(0, rows - (items.length > rows ? 1 : 0));
  if (LIFE.cap) LIFE.cap.list = { x0: M - 24, x1: W - M + 24, y0: top + 10, y1: top + shown.length * rh, rh };
  shown.forEach((it, i) => {
    const y = top + 70 + i * rh;
    const fx = rowFx('today', 'n:' + it.id);
    rowFlash(ctx, fx, M, W - M, y + 58);
    const [tag, col] = NEED_TAG[it.group] || ['', SC.dim];
    ctx.font = `600 24px ${BRAND.ui}`;
    const tagW = 230;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(M + 12, y - 14, 10, 0, TAU);
    ctx.fill();
    scEyebrow(ctx, tag, M + 34, y - 4, 24, col, 4);
    const x = M + tagW;
    const arrow = it.link ? '↗' : '';
    const when = it.when || '';
    ctx.font = `500 34px ${BRAND.ui}`;
    const ww = when ? ctx.measureText(when).width + (arrow ? 64 : 0) : arrow ? 48 : 0;
    scText(ctx, it.title || '', x + fx.dx, y, 46, SC.ink, 600, W - M - x - ww - 30);
    if (when) scText(ctx, when, W - M - (arrow ? 64 : 0), y, 34, /overdue/i.test(when) ? SC.amber : SC.dim, 500, 400, 'right');
    if (arrow) scText(ctx, arrow, W - M, y, 40, SC.ink, 600, 60, 'right');
    const sub = it.draft ? `Draft: ${it.draft.replace(/\s+/g, ' ')}` : it.detail || it.where || (it.who && !String(it.title || '').includes(it.who) ? it.who : '');
    if (sub) scText(ctx, sub, x, y + 46, 31, it.draft ? '#c9ccd2' : SC.dim, 500, W - M - x);
    hitAdd('today', M - 20, y - 56, W - M + 20, y + 64, { link: it.link || null, label: it.who || null, need: it });
  });
  if (items.length > shown.length) scText(ctx, `+ ${items.length - shown.length} more — click the screen for the full list`, M + 230, top + 70 + shown.length * rh, 34, SC.dim, 500, W - 2 * M);
}

/** What a gate asks for, in the room's words: its subject, the action itself, and up to two facts (from gateBrief when there is one). */
function gateText(g) {
  const B = typeof gateBrief === 'function' ? gateBrief(g) : null;
  const need = String((g && g.need) || '');
  const cut = need.indexOf(':');
  const subject = cut > 0 ? need.slice(0, cut).trim() : need;
  let action = B && B.action && String(B.action) !== need ? String(B.action) : cut > 0 ? need.slice(cut + 1).trim() : '';
  if (action === subject) action = '';
  if (action) action = action.charAt(0).toUpperCase() + action.slice(1);
  const facts = (B && Array.isArray(B.facts) ? B.facts : []).slice(0, 2)
    .map(f => (Array.isArray(f) ? { label: f[0] != null ? String(f[0]) : '', value: f[1] != null ? String(f[1]) : '' } : { label: '', value: String(f || '') }))
    .filter(f => f.value);
  const factsText = facts.map(f => (f.label ? `${f.label} ${f.value}` : f.value)).join('  ·  ');
  return { subject, action, facts, factsText };
}

/** NEXT: dated items still ahead (ET), plus the next half-hourly stock watch. */
function nextItems(n = 5) {
  const now = new Date();
  if (OFFICE_STATE.fleet) return OFFICE_STATE.fleet.jobs.filter(j=>j.loaded!==false&&j.next&&new Date(j.next)>now).sort((a,b)=>new Date(a.next)-new Date(b.next)).slice(0,n).map(j=>({when:whenShort(j.next),what:j.name,sort:new Date(j.next).getTime()}));
  const out = [];
  const watch = OFFICE_STATE.running.find(r => r.every);
  if (watch) {
    const next = new Date(now.getTime());
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() < 30 ? 30 : 60);
    out.push({ when: fmtTime(next), what: `${watch.name} · ${watch.cadence}`, sort: next.getTime() });
  }
  const todayET = etDay(now);
  for (const s of OFFICE_STATE.schedule) {
    if (s.date < todayET) continue;
    const d = new Date(s.date + 'T12:00:00-05:00');
    const when = s.date === todayET ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(d);
    out.push({ when, what: `${s.label} — ${s.note}`, sort: d.getTime() });
  }
  return out.sort((a, b) => a.sort - b.sort).slice(0, n);
}

/* ---------- the hot list (logo wall): new listings above; under contract and sold below ---------- */

const HOT_ORDER = { new: 0, bom: 1, uc: 2, sold: 3 };
/** Ranked as the bridge ranks them: our listings, then kind, then focus towns, then price high to low. */
function hotRows(kinds) {
  const Hs = OFFICE_STATE.hotsheet;
  const focus = new Set((Hs.watch.towns || []).map(t => t.toLowerCase()));
  return Hs.rows
    .filter(r => kinds.includes(r.kind))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.ours - a.r.ours) || (HOT_ORDER[a.r.kind] - HOT_ORDER[b.r.kind]) || (focus.has(b.r.town.toLowerCase()) - focus.has(a.r.town.toLowerCase())) || ((b.r.price || 0) - (a.r.price || 0)) || a.i - b.i)
    .map(x => x.r);
}
function drawHotList(which, ctx, W, H, detail) {
  const M = 72;
  const Hs = OFFICE_STATE.hotsheet;
  ctx.fillStyle = SC.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const kinds = which === 'new' ? ['new', 'bom'] : ['uc', 'sold'];
  const rows = hotRows(kinds);
  const day = Date.now() - 86400000;
  const recent = rows.filter(r => r.at >= day);
  const sk = which === 'new' ? 'hotnew' : 'hotdone';
  const count = which === 'new'
    ? `${liveInt(sk, 'recent', recent.length)} new · last 24h`
    : `${liveInt(sk, 'uc', recent.filter(r => r.kind === 'uc').length)} under contract · ${liveInt(sk, 'sold', recent.filter(r => r.kind === 'sold').length)} sold · last 24h`;
  const title = which === 'new' ? 'New listings' : 'Under contract · Sold';
  const showRows = Hs.status !== 'awaiting' && rows.length;
  scHeader(ctx, W, M, title, Hs, detail ? 70 : 84, showRows || Hs.status !== 'awaiting' ? count : null);
  const top = detail ? 270 : 300;
  if (!showRows) {
    if (LIFE.cap) LIFE.cap.list = { x0: M - 24, x1: W - M + 24, y0: top + 90 - 76, y1: top + 90 + 76 * 0.95 + 24, rh: 110 }; // the scan passes over the message too
    if (Hs.status === 'awaiting') scEmpty(ctx, M, top + 90, W - 2 * M, 'Waiting for the live MLS feed', which === 'new' ? 'New listings appear here as they post — NJMLS via the Studio.' : 'Contracts and sales appear here as they post — NJMLS via the Studio.', 76);
    else scEmpty(ctx, M, top + 90, W - 2 * M, which === 'new' ? 'No new listings yet today' : 'No contracts or sales yet today', 'Bergen County · $1M and up', 76);
    return;
  }
  const n = detail ? 7 : 5;
  const rh = (H - top - 30) / n;
  const shown = rows.slice(0, n);
  if (LIFE.cap) LIFE.cap.list = { x0: M - 24, x1: W - M + 24, y0: top, y1: top + shown.length * rh, rh };
  // rows that have just left fade out in the slots the list no longer fills
  const G = (LIFE.rows[sk + ':ghost'] = LIFE.rows[sk + ':ghost'] || { prev: [], ghosts: [] });
  if (LIFE.drawing === sk) {
    const ids = new Set(shown.map(r => r.id)), tnow = performance.now();
    G.prev.forEach((r, i) => { if (!ids.has(r.id) && i >= shown.length && !G.ghosts.some(gh => gh.r.id === r.id)) G.ghosts.push({ r, i, t0: tnow }); });
    G.ghosts = G.ghosts.filter(gh => tnow - gh.t0 < 700 && gh.i >= shown.length && !ids.has(gh.r.id));
    G.prev = shown.slice();
    for (const gh of G.ghosts) {
      ctx.save();
      ctx.globalAlpha = 1 - (tnow - gh.t0) / 700;
      const gy = top + gh.i * rh + rh * 0.62, gb = detail ? 58 : 76;
      scText(ctx, gh.r.address, M, gy, gb, SC.dim, 600, W - 2 * M - 520);
      scText(ctx, money(gh.r.price), W - M, gy, gb, SC.dim, 600, 460, 'right');
      ctx.restore();
      lifeAnimate(sk, gh.t0 + 800);
    }
  }
  shown.forEach((r, i) => {
    const y = top + i * rh + rh * 0.62;
    const fx = rowFx(sk, r.id);
    if (i % 2 === 0) {
      ctx.fillStyle = SC.card;
      roundRect(ctx, M - 24, top + i * rh + 6, W - 2 * M + 48, rh - 12, 16);
      ctx.fill();
    }
    rowFlash(ctx, fx, M - 24, W - M + 24, top + (i + 1) * rh - 12);
    ctx.save();
    ctx.globalAlpha = fx.a;
    ctx.translate(fx.dx, 0);
    const big = detail ? 58 : 76;
    let x = M;
    if (which === 'done') {
      scEyebrow(ctx, r.kind === 'sold' ? 'Sold' : 'Contract', x, y - big * 0.08, detail ? 26 : 32, r.kind === 'sold' ? SC.ink : SC.dim, 3);
      x += detail ? 200 : 250;
    }
    const priceW = detail ? 380 : 460;
    const addrW = W - M - priceW - x - 40;
    ctx.font = `600 ${big}px ${BRAND.ui}`;
    const addr = scFit(ctx, r.address, addrW * 0.66);
    scText(ctx, addr, x, y, big, SC.ink, 600);
    const aw = ctx.measureText(addr).width;
    ctx.font = `500 ${Math.round(big * 0.7)}px ${BRAND.ui}`;
    const town = scFit(ctx, r.town, Math.max(80, addrW - aw - 28 - (r.ours ? 260 : 0)));
    scText(ctx, town, x + aw + 28, y, Math.round(big * 0.7), SC.dim, 500);
    if (r.ours) {
      ctx.font = `500 ${Math.round(big * 0.7)}px ${BRAND.ui}`;
      scEyebrow(ctx, 'Our listing', x + aw + 28 + ctx.measureText(town).width + 30, y - big * 0.12, detail ? 24 : 30, BRAND.crimson, 3);
    }
    scText(ctx, money(r.price), W - M, y, big, SC.ink, 600, priceW, 'right');
    if (detail) {
      const sec = [r.beds != null ? `${r.beds} bd` : '', r.baths != null ? `${r.baths} ba` : '', r.dom != null ? `${r.dom} DOM` : '', r.views != null ? `${r.views} views` : '', r.matches ? `${r.matches} match` : '', ago(r.at)].filter(Boolean).join(' · ');
      scText(ctx, sec, x, y + 42, 30, SC.dim, 500, addrW);
      if (r.kind === 'sold' && r.was) scText(ctx, `list ${money(r.was)}`, W - M, y + 42, 28, SC.dim, 500, priceW, 'right');
    }
    ctx.restore();
  });
}

/* ---------- Today & leads (east glass): follow-ups, appointments, leads ---------- */

function drawTodayLeads(ctx, W, H, detail) {
  const M = 80;
  const T = OFFICE_STATE.panels.today, B = OFFICE_STATE.panels.buyers;
  const now = new Date();
  ctx.fillStyle = SC.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' }).format(now);
  const worse = [T, B].sort((a, b) => ['live', 'stale', 'error', 'awaiting'].indexOf(b.status) - ['live', 'stale', 'error', 'awaiting'].indexOf(a.status))[0];
  scHeader(ctx, W, M, `Today · ${date}`, worse, detail ? 66 : 78);
  const top = detail ? 250 : 280;
  scRule(ctx, M, W - M, top - 40);
  const colW = (W - 2 * M - 120) / 3;
  const col = i => M + i * (colW + 60);
  const live = s => s && s.status !== 'awaiting';
  // follow-ups
  const f = T.followups;
  scEyebrow(ctx, 'Follow-ups due', col(0), top + 30, detail ? 28 : 36, SC.dim, 5);
  scText(ctx, live(T) && f ? String(liveInt('today', 'due', f.due ?? 0)) : '—', col(0) - 6, top + (detail ? 190 : 250), detail ? 150 : 210, live(T) && f ? SC.ink : SC.faint, 600);
  if (live(T) && f && f.overdue) scText(ctx, `${f.overdue} overdue`, col(0) + (detail ? 190 : 260), top + (detail ? 180 : 236), detail ? 44 : 58, SC.amber, 600);
  // appointments
  const ev = live(T) ? T.events || [] : [];
  scEyebrow(ctx, 'Appointments', col(1), top + 30, detail ? 28 : 36, SC.dim, 5);
  scText(ctx, live(T) ? String(liveInt('today', 'appts', ev.length)) : '—', col(1) - 6, top + (detail ? 190 : 250), detail ? 150 : 210, live(T) ? SC.ink : SC.faint, 600);
  // leads
  const leads = live(B) ? B.newLeads || [] : [];
  scEyebrow(ctx, 'New leads · 7 days', col(2), top + 30, detail ? 28 : 36, SC.dim, 5);
  scText(ctx, live(B) ? String(liveInt('today', 'leads', leads.length)) : '—', col(2) - 6, top + (detail ? 190 : 250), detail ? 150 : 210, live(B) ? SC.ink : SC.faint, 600);
  // the top rows under each number
  const ry = top + (detail ? 270 : 360), rh = detail ? 108 : 104, big = detail ? 46 : 58;
  if (LIFE.cap) {
    const per = detail ? 5 : 3, nR = Math.max(1, Math.min(per, Math.max(live(T) && f ? (f.items || []).length : 0, live(T) ? (T.events || []).length : 0, live(B) ? (B.hot || []).length : 0)));
    LIFE.cap.list = { x0: col(0) - 24, x1: col(2) + colW + 24, y0: ry - big, y1: ry + (nR - 1) * rh + big * 0.8 + 24, rh };
  }
  if (live(T) && f && (f.items || []).length) {
    (f.items || []).slice(0, detail ? 5 : 3).forEach((it, i) => {
      const fx = rowFx('today', 'f:' + it.who + '|' + it.what);
      rowFlash(ctx, fx, col(0), col(0) + colW, ry + i * rh + big * 0.8 + 18);
      scName(ctx, it.who, col(0) + fx.dx, ry + i * rh, big, SC.ink, 600, colW);
      scText(ctx, detail ? `${it.what || ''}${it.when ? ' · ' + it.when : ''}` : it.what || '', col(0), ry + i * rh + big * 0.8, Math.round(big * 0.66), /overdue/i.test(it.when || '') ? SC.amber : SC.dim, 500, colW);
    });
  } else scText(ctx, live(T) ? 'Nothing due' : 'From Follow Up Boss', col(0), ry, big * 0.8, SC.faint, 500, colW);
  if (ev.length) {
    ev.slice(0, detail ? 5 : 3).forEach((e, i) => {
      const fx = rowFx('today', 'e:' + e.time + '|' + e.title);
      rowFlash(ctx, fx, col(1), col(1) + colW, ry + i * rh + big * 0.8 + 18);
      scText(ctx, e.time || '', col(1) + fx.dx, ry + i * rh, big, SC.ink, 600, colW);
      scText(ctx, detail ? `${e.title || ''}${e.where ? ' · ' + e.where : ''}` : e.title || '', col(1), ry + i * rh + big * 0.8, Math.round(big * 0.66), SC.dim, 500, colW);
    });
  } else scText(ctx, live(T) ? 'None today' : 'From Follow Up Boss', col(1), ry, big * 0.8, SC.faint, 500, colW);
  const hot = live(B) ? B.hot || [] : [];
  if (hot.length) {
    scEyebrow(ctx, 'Hot buyers', col(2), ry - big * 0.9, detail ? 24 : 28, SC.dim, 4);
    hot.slice(0, detail ? 5 : 3).forEach((h, i) => {
      const fx = rowFx('today', 'h:' + h.name);
      rowFlash(ctx, fx, col(2), col(2) + colW, ry + i * rh + 18);
      scName(ctx, h.name, col(2) + fx.dx, ry + i * rh, big, SC.ink, 600, colW);
      if (detail) scText(ctx, `${h.signal || ''}${h.score != null ? ' · ' + h.score : ''}`, col(2), ry + i * rh + big * 0.8, Math.round(big * 0.66), '#9bdcff', 500, colW);
    });
  } else scText(ctx, live(B) ? 'No hot buyers this week' : 'From RealScout', col(2), ry, big * 0.8, SC.faint, 500, colW);
  if (detail && live(B) && leads.length) {
    const ly = H - 110;
    scRule(ctx, M, W - M, ly - 70);
    scText(ctx, 'Latest leads  ' + leads.slice(0, 4).map(l => `${l.name}${l.source ? ' (' + l.source + ')' : ''}${l.at ? ' ' + ago(new Date(l.at).getTime()) : ''}`).join('   ·   '), M, ly, 36, SC.dim, 500, W - 2 * M);
  }
}

/* ---------- Pipeline (Market Room): stage counts, the next critical dates ---------- */

function drawPipeline(ctx, W, H, detail) {
  const M = 80;
  const P = OFFICE_STATE.panels.pipeline;
  ctx.fillStyle = SC.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  scHeader(ctx, W, M, 'Pipeline', P, detail ? 66 : 78);
  const live = P.status !== 'awaiting' && P.stages;
  const st = (live && P.stages) || {};
  const tiles = [['Listings', st.listings], ['Under contract', st.underContract], ['Offers', st.offers], ['Closing ≤ 30 days', st.closing30], ['Closed this year', st.closedYTD]];
  if (detail) tiles.push(['Off market', st.offMarket], ['Buyer contracts', st.buyerContracts]);
  const top = detail ? 250 : 290;
  scRule(ctx, M, W - M, top - 40);
  const tw = (W - 2 * M) / tiles.length;
  tiles.forEach(([l, v], i) => {
    const x = M + i * tw;
    scText(ctx, live && v != null ? String(liveInt('pipeline', l, v)) : '—', x - 6, top + (detail ? 170 : 250), detail ? 130 : 200, live && v != null ? SC.ink : SC.faint, 600);
    ctx.font = `600 ${detail ? 24 : 32}px ${BRAND.ui}`;
    wrapLines(ctx, l.toUpperCase(), tw - 20).slice(0, 2).forEach((ln, k) => scEyebrow(ctx, ln, x, top + (detail ? 220 : 310) + k * (detail ? 32 : 42), detail ? 24 : 32, SC.dim, 3));
  });
  const dy = top + (detail ? 330 : 440);
  scRule(ctx, M, W - M, dy - 50);
  if (detail && live && P.volume && P.volume.active) scText(ctx, `${money(liveNum('pipeline', 'volume', P.volume.active))} active volume`, W - M, dy - 70, 36, SC.dim, 500, 900, 'right');
  scEyebrow(ctx, 'Next critical dates', M, dy, detail ? 28 : 34, SC.dim, 5);
  const dates = live ? (P.dates || []).slice(0, detail ? 6 : 3) : [];
  if (!dates.length) {
    if (LIFE.cap) LIFE.cap.list = { x0: M - 24, x1: W - M + 24, y0: dy + 90 - 64, y1: dy + 90 + 26, rh: 90 };
    scText(ctx, live ? 'No critical dates in the next 14 days' : 'From Follow Up Boss deals', M, dy + 90, 58, SC.faint, 500, W - 2 * M);
    return;
  }
  const rh = detail ? 82 : 118, big = detail ? 50 : 66;
  if (LIFE.cap) LIFE.cap.list = { x0: M - 24, x1: W - M + 24, y0: dy + 90 - big, y1: dy + 90 + (dates.length - 1) * rh + 30, rh };
  dates.forEach((d, i) => {
    const y = dy + 90 + i * rh;
    const fx = rowFx('pipeline', d.date + '|' + d.label + '|' + d.deal);
    rowFlash(ctx, fx, M, W - M, y + 22);
    const dt = new Date(d.date + 'T12:00:00-05:00');
    const days = Math.round((dt - Date.now()) / 86400000);
    scText(ctx, new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(dt), M, y, big, days <= 2 ? SC.amber : SC.ink, 600, 300);
    scText(ctx, d.label || '', M + 300, y, big, SC.ink, 500, 640);
    scText(ctx, d.deal || '', M + 980, y, Math.round(big * 0.85), SC.dim, 500, W - 2 * M - 980);
  });
}

/* ---------- the ticker (top of the Market Room glass): live client activity and rates ---------- */

const TICKER = { rebuild: true, strip: null, tex: null, off: 0, aspect: 1, page: 0, pageT: 0, speed: 0.27, px: 320, metres: 1 }; // speed: metres a second along the walls
const TICK_TYPE = 0.62; // the ticker's type against the strip's height
const TICK_COL = { view: '#e8eaee', save: '#c9ced6', inquiry: BRAND.crimson, lead: '#ffffff', rate: '#9aa3ad' };
function tickerItems() {
  const T = OFFICE_STATE.ticker;
  return T && T.status !== 'awaiting' ? T.items || [] : [];
}
/** Builds the long strip the ring scrolls through (once per update from the bridge). A market item reads
 *  LABEL  value  ▲3 bp  Oct 30; a change of group (bonds, then mortgage rates) gets its own crimson mark. */
function buildTickerStrip() {
  const T = OFFICE_STATE.ticker || { status: 'awaiting', items: [] };
  const items = tickerItems();
  const meas = makeCanvas(8, 8).getContext('2d');
  // each part: runs of [text, font size (em), colour, weight, letter spacing]
  const parts = [];
  if (!items.length) parts.push({ runs: [[T.status === 'awaiting' ? 'Bond market and mortgage rates appear here from the Studio' : T.note || 'Market data unavailable — retrying', 0.5, '#9a9da3', 500, 0]] });
  else {
    if (T.status === 'stale' || T.status === 'error') parts.push({ runs: [[T.note || 'Showing the last market data', 0.4, SC.amber, 500, 0]] });
    let group = null;
    for (const it of items) {
      if (it.kind === 'rate' && it.label) {
        const runs = [];
        if (it.group && it.group !== group) {
          group = it.group;
          runs.push([it.group === 'Mortgage' ? 'MORTGAGE RATES' : 'BOND MARKET', 0.3, BRAND.crimson, 700, 0.12]);
        }
        runs.push([it.label.toUpperCase(), 0.34, '#a7abb2', 600, 0.1]);
        runs.push([it.value, 0.6, '#ffffff', 600, 0]);
        if (it.move) runs.push([it.move, 0.42, it.dir > 0 ? BRAND.crimson : it.dir < 0 ? '#c9ced6' : '#8d9198', 600, 0]);
        if (it.asOf) runs.push([it.asOf, 0.3, '#6c7076', 500, 0.04]);
        if (it.stale || OFFICE_STATE.ticker.status !== 'live') runs.push(['STALE',0.34,BRAND.crimson,700,0.05]);
        parts.push({ runs });
      } else parts.push({ runs: [[it.text, 0.5, '#e8eaee', 500, 0]] });
    }
  }
  const font = (em, run) => `${run[3]} ${Math.round(em * run[1])}px ${BRAND.ui}`;
  const runW = (em, run) => {
    meas.font = font(em, run);
    const w = meas.measureText(run[0]).width;
    return w + run[0].length * run[4] * em;
  };
  const measure = H => {
    const em = H * TICK_TYPE;
    let w = 0;
    for (const p of parts) {
      p.w = p.runs.reduce((s, r) => s + runW(em, r), 0) + (p.runs.length - 1) * em * 0.26;
      w += p.w + em * 1.15;
    }
    return w;
  };
  const maxW = Math.min(16384, renderer.capabilities.maxTextureSize || 8192);
  const ring = (ROOM_OBJ.ticker && ROOM_OBJ.ticker.ringLength) || 40;
  const bandH = (ROOM_OBJ.ticker && ROOM_OBJ.ticker.h) || 0.4;
  const closed = !!(ROOM_OBJ.ticker && ROOM_OBJ.ticker.closed);
  let H = 256, w = measure(H), cw, metres, spare = 0;
  if (closed) {
    // a closed loop: the strip is laid out to a whole number of repeats round the loop, its spare length shared out
    // between the items, so the words close on themselves at the last corner without a seam
    const natural = (Math.max(1024, w) / H) * bandH;
    metres = ring / Math.max(1, Math.floor(ring / natural));
    if ((metres * H) / bandH > maxW) (H = Math.max(96, Math.floor((maxW * bandH) / metres))), (w = measure(H));
    cw = Math.min(maxW, Math.round((metres * H) / bandH));
    spare = Math.max(0, cw - w) / parts.length;
  } else {
    if (w > maxW) (H = Math.max(128, Math.floor((H * maxW) / w))), (w = measure(H));
    cw = Math.min(maxW, Math.max(1024, Math.ceil(w)));
    metres = cw / (H / bandH);
  }
  const em = H * TICK_TYPE;
  const pxPerM = H / bandH;
  const c = makeCanvas(cw, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#060607';
  ctx.fillRect(0, 0, cw, H);
  ctx.textBaseline = 'alphabetic';
  const base = H / 2 + em * 0.21;
  let x = em * 0.5;
  for (const p of parts) {
    if (x > cw - em * 0.25) break;
    for (const r of p.runs) {
      ctx.font = font(em, r);
      ctx.fillStyle = r[2];
      if (r[4]) x = spacedTextAt(ctx, r[0], x, base, r[4] * em);
      else {
        ctx.fillText(r[0], x, base);
        x += ctx.measureText(r[0]).width;
      }
      x += em * 0.26;
    }
    x += em * 0.89 + spare;
    // a hairline between items, in the middle of the gap
    ctx.fillStyle = '#26282c';
    ctx.fillRect(x - em * 0.6 - spare / 2, H * 0.3, Math.max(1, em * 0.02), H * 0.4);
  }
  if (TICKER.tex) TICKER.tex.dispose();
  const tex = canvasTexture(c, { repeat: true });
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // the ring's UVs are metres: one strip spans cw / pxPerM metres, then repeats round the walls
  TICKER.metres = metres; // one repeat of the strip, in metres along the walls (a whole fraction of a closed loop)
  tex.repeat.set(1 / TICKER.metres, 1);
  TICKER.static = !items.length;
  TICKER.strip = c;
  TICKER.tex = tex;
  TICKER.width = cw;
  TICKER.px = pxPerM;
  TICKER.ring = ring;
  TICKER.off = 0;
}
/** spacedText, returning where the run ends. */
function spacedTextAt(ctx, text, x, y, spacing) {
  for (const ch of String(text)) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  return x - spacing;
}
function tickerFaces() {
  const O = ROOM_OBJ.ticker;
  return O ? (O.segs ? O.segs.flatMap(sg => (sg.outer ? [sg.face, sg.outer] : [sg.face])) : [O.face]) : [];
}
function tickerUpdate(dt, now) {
  const O = ROOM_OBJ.ticker, sc = VIEW.screens.ticker;
  if (!O || !sc) return;
  const focused = VIEW.focusKey === 'ticker';
  if (TICKER.rebuild) {
    TICKER.rebuild = false;
    buildTickerStrip();
  }
  for (const f of tickerFaces()) {
    const want = focused && f === O.face ? sc.tex : TICKER.tex;
    if (f.material.map !== want) {
      f.material.map = want;
      if (want) f.material.color.setRGB(1, 1, 1); // dark until the strip is drawn, then the strip's own colours
      f.material.needsUpdate = true;
    }
  }
  if (focused) {
    // the full list on the north run, a page at a time
    if (O.face.material.map === sc.tex && sc.tex.repeat.x !== 1) sc.tex.repeat.set(1, 1);
    TICKER.pageT += dt;
    if (TICKER.pageT > 6) {
      TICKER.pageT = 0;
      TICKER.page++;
      VIEW.dirty('ticker');
    }
    return;
  }
  TICKER.page = 0;
  if (!TICKER.static && !REDUCED_MOTION) {
    TICKER.off = (TICKER.off + (TICKER.speed * dt) / TICKER.metres) % 1; // a steady crawl round the walls
  }
  TICKER.tex.offset.x = TICKER.off;
}
function drawTickerDetail(ctx, W, H) {
  ctx.fillStyle = '#060607';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const T = OFFICE_STATE.ticker || { status: 'awaiting', items: [] };
  const items = tickerItems();
  const wide = W / H > 8, u = wide ? (H / 271) * TICK_TYPE : 1; // a long strip scales its type with its height (271 px: the 4096-wide canvas it was drawn for), at the ticker's type size
  const M = 40 * u;
  if (!items.length) {
    scText(ctx, T.status === 'awaiting' ? 'Live client activity and rates appear here from the Studio' : T.note || 'No activity yet', M, H / 2 + 22 * u, 60 * u, SC.dim, 500, W - 2 * M);
    return;
  }
  if (wide) {
    // a long strip: as many whole items as fit side by side, each at its own length, a page at a time
    const fs = Math.round(92 * u), ts = Math.round(56 * u), dotW = 54 * u, gap = 130 * u, room = W - 2 * M;
    const wOf = (txt, size) => ((ctx.font = `500 ${size}px ${BRAND.ui}`), ctx.measureText(txt).width);
    const pages = [];
    let cur = [], used = 0;
    for (const it of items) {
      const tw = wOf(it.text, fs), aw = it.at ? 30 * u + wOf(ago(it.at), ts) : 0;
      const w = Math.min(room, dotW + tw + aw);
      if (cur.length && used + gap + w > room) (pages.push(cur), (cur = []), (used = 0));
      used += (cur.length ? gap : 0) + w;
      cur.push({ it, w, tw: Math.min(tw, w - dotW - aw) });
    }
    if (cur.length) pages.push(cur);
    const p = TICKER.page % pages.length;
    let x = M;
    const y = H / 2 + 34 * u;
    for (const { it, w, tw } of pages[p]) {
      rowFlash(ctx, rowFx('ticker', it.kind + '|' + it.text), x, x + w, y + 26 * u);
      ctx.fillStyle = TICK_COL[it.kind] || '#9aa3ad';
      ctx.beginPath();
      ctx.arc(x + 18 * u, H / 2, 16 * u, 0, TAU);
      ctx.fill();
      scText(ctx, it.text, x + dotW, y, fs, SC.ink, 500, tw);
      if (it.at) scText(ctx, ago(it.at), x + dotW + tw + 30 * u, y, ts, SC.dim, 500, 400 * u);
      x += w + gap;
    }
    if (pages.length > 1) scText(ctx, `${p + 1} / ${pages.length}`, W - M, H - 14 * u, Math.round(30 * u), SC.faint, 500, 200 * u, 'right');
    return;
  }
  const per = Math.max(1, Math.floor((H - 44) / 84)); // as many rows as the strip holds
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = TICKER.page % pages;
  items.slice(p * per, p * per + per).forEach((it, i) => {
    const y = 74 + i * 84;
    rowFlash(ctx, rowFx('ticker', it.kind + '|' + it.text), M, W - M, y + 16);
    ctx.fillStyle = TICK_COL[it.kind] || '#9aa3ad';
    ctx.beginPath();
    ctx.arc(M + 14, y - 18, 12, 0, TAU);
    ctx.fill();
    scText(ctx, it.text, M + 48, y, 58, SC.ink, 500, W - 2 * M - 260);
    if (it.at) scText(ctx, ago(it.at), W - M, y, 44, SC.dim, 500, 220, 'right');
  });
  if (pages > 1) scText(ctx, `${p + 1} / ${pages}`, W - M, H - 14, 26, SC.faint, 500, 200, 'right');
}
