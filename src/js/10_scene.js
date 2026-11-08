/* =============================================================================
   10 · SCENE — renderer, bright store light, soft reflections, calm camera
   ============================================================================= */

const stageEl = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stageEl.clientWidth || window.innerWidth, stageEl.clientHeight || window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6e4ef);
// The haze only reaches the city (the room's materials opt out); the sky module sets its colour.
scene.fog = new THREE.Fog(0xd6e4ef, 90, 1400);

/**
 * Bright, even "store" environment for reflections: a light shell with large
 * ceiling light boxes, pre-filtered once. Gives oak, stone, glass and ceramic
 * soft, believable highlights.
 */
function buildEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.62, 0.6), side: THREE.BackSide }));
  shell.scale.set(16, 8, 16);
  shell.position.y = 3.5;
  env.add(shell);
  const panel = (w, h, k, x, y, z, rx, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.97), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  for (const x of [-4.5, 0, 4.5]) for (const z of [-4, 0, 4]) panel(3.2, 2.6, 3.0, x, 7.4, z, HALF_PI, 0); // ceiling light boxes
  panel(9, 3.4, 2.2, -7.9, 3.6, -1, 0, HALF_PI); // window wall
  panel(10, 3.0, 1.6, 0, 3.6, -7.9, 0, 0);
  panel(4, 2.4, 1.3, 7.9, 2.5, 2.5, 0, -HALF_PI);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.72, 0.68, 0.62) }));
  floor.rotation.x = -HALF_PI;
  floor.position.y = -0.45;
  env.add(floor);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  return rt.texture;
}
scene.environment = buildEnvironment();

/* Store light: a bright sky fill, a warm high key with soft shadows, a cool rim. */
const hemi = new THREE.HemisphereLight(0xfffdf8, 0xe6dccd, 0.62);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff3e4, 1.05);
key.position.set(-10, 18, 12);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -18, right: 18, top: 15, bottom: -15, near: 2, far: 60 });
key.shadow.bias = -0.00035;
key.shadow.normalBias = 0.018;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xf2f6ff, 0.34);
fill.position.set(14, 9, 8);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.32);
rim.position.set(6, 7, -14);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(26, 1, 0.6, 5000);

/* ---------- calm camera ------------------------------------------------------
   Orbit (drag), pan (right-drag / shift-drag / two fingers), zoom (wheel / pinch).
   Every move is eased; glideTo() runs a cubic in-out tween between views.     */
class CalmControls {
  constructor(cam, dom) {
    this.cam = cam;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 0.8, 0);
    this.goalTarget = this.target.clone();
    this.sph = { r: 30, theta: 0.68, phi: 0.98 };
    this.goal = { ...this.sph };
    this.limits = { rMin: 2.6, rMax: 64, phiMin: 0.22, phiMax: 1.47 }; // (1.47: level enough for the Hudson view)
    this.bounds = { x: 16, z: 13 };
    this.glide = null;
    this.onTap = null;
    this.onUserMove = null;
    this.viewOffsetX = 0; // px shift so floating panels never cover the subject
    this.viewOffsetY = 0;
    this._viewOffsetCur = 0;
    this._viewOffsetCurY = 0;
    this.pointers = new Map();
    this._bind();
  }
  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      this.mode = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey ? 'pan' : 'rotate';
      this._pinch = null;
    });
    el.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 4) p.moved = true;
      if (this.pointers.size === 2) return this._touchPinch();
      if (!p.moved) return;
      this._userMoved();
      if (this.mode === 'pan') this._pan(dx, dy);
      else {
        this.goal.theta -= dx * 0.0052;
        this.goal.phi = clamp(this.goal.phi - dy * 0.0042, this.limits.phiMin, this.limits.phiMax);
      }
    });
    const end = e => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      this._pinch = null;
      if (p && !p.moved && performance.now() - p.t < 600 && this.onTap) this.onTap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', e => this.pointers.delete(e.pointerId));
    // the keyboard: arrows orbit, shift+arrows pan, plus and minus zoom (only while the scene itself has focus)
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', 'The office. Arrow keys orbit the camera, shift with arrows pans, plus and minus zoom. Tab moves on to the controls.');
    el.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        this._userMoved();
        const sx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, sy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
        if (e.shiftKey) this._pan(sx * 48, sy * 48);
        else {
          this.goal.theta -= sx * 0.09;
          this.goal.phi = clamp(this.goal.phi + sy * 0.06, this.limits.phiMin, this.limits.phiMax);
        }
      } else if (k === '+' || k === '=' || k === '-' || k === '_') {
        e.preventDefault();
        this._userMoved();
        this.goal.r = clamp(this.goal.r * (k === '-' || k === '_' ? 1.12 : 0.89), this.limits.rMin, this.limits.rMax);
      }
    });
    el.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        this._userMoved();
        if (e.ctrlKey) this.goal.r = clamp(this.goal.r * (1 + e.deltaY * 0.01), this.limits.rMin, this.limits.rMax);
        else this.goal.r = clamp(this.goal.r * (1 + clamp(e.deltaY, -120, 120) * 0.0012), this.limits.rMin, this.limits.rMax);
      },
      { passive: false }
    );
  }
  _touchPinch() {
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (this._pinch) {
      this._userMoved();
      this.goal.r = clamp(this.goal.r * (this._pinch.d / d), this.limits.rMin, this.limits.rMax);
      this._pan(mx - this._pinch.mx, my - this._pinch.my);
    }
    this._pinch = { d, mx, my };
    a.moved = b.moved = true;
  }
  _pan(dx, dy) {
    const s = this.goal.r * 0.0016;
    const th = this.goal.theta;
    const right = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
    const fwd = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
    this.goalTarget.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s * 1.25);
    this.goalTarget.x = clamp(this.goalTarget.x, -this.bounds.x, this.bounds.x);
    this.goalTarget.z = clamp(this.goalTarget.z, -this.bounds.z, this.bounds.z);
  }
  _userMoved() {
    this.glide = null;
    if (this.onUserMove) this.onUserMove();
  }
  /** Instantly place the camera. */
  set(view) {
    if (view.target) this.goalTarget.copy(view.target), this.target.copy(view.target);
    for (const k of ['r', 'theta', 'phi']) if (view[k] != null) this.goal[k] = this.sph[k] = view[k];
  }
  /** Eased glide to a view {target, r, theta, phi}. */
  glideTo(view, dur = 1.7) {
    if (REDUCED_MOTION) return this.set(view);
    const from = { target: this.target.clone(), r: this.sph.r, theta: this.sph.theta, phi: this.sph.phi };
    const to = {
      target: view.target ? view.target.clone() : from.target.clone(),
      r: view.r ?? from.r,
      phi: view.phi ?? from.phi,
      theta: view.theta != null ? from.theta + wrapAngle(view.theta - from.theta) : from.theta,
    };
    this.glide = { from, to, t: 0, dur };
  }
  update(dt) {
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(1, g.t + dt / g.dur);
      const k = easeInOut(g.t);
      this.goalTarget.lerpVectors(g.from.target, g.to.target, k);
      this.goal.r = lerp(g.from.r, g.to.r, k);
      this.goal.theta = lerp(g.from.theta, g.to.theta, k);
      this.goal.phi = lerp(g.from.phi, g.to.phi, k);
      this.target.copy(this.goalTarget);
      Object.assign(this.sph, this.goal);
      if (g.t >= 1) this.glide = null;
    } else {
      const L = 10;
      this.target.x = damp(this.target.x, this.goalTarget.x, L, dt);
      this.target.y = damp(this.target.y, this.goalTarget.y, L, dt);
      this.target.z = damp(this.target.z, this.goalTarget.z, L, dt);
      this.sph.r = damp(this.sph.r, this.goal.r, L, dt);
      this.sph.theta = damp(this.sph.theta, this.goal.theta, L, dt);
      this.sph.phi = damp(this.sph.phi, this.goal.phi, L, dt);
    }
    const { r, theta, phi } = this.sph;
    this.cam.position.set(
      this.target.x + r * Math.sin(phi) * Math.sin(theta),
      this.target.y + r * Math.cos(phi),
      this.target.z + r * Math.sin(phi) * Math.cos(theta)
    );
    this.cam.lookAt(this.target);
    // ease the framing offset so panels slide the room aside, never cover it
    this._viewOffsetCur = damp(this._viewOffsetCur, this.viewOffsetX, 7, dt);
    this._viewOffsetCurY = damp(this._viewOffsetCurY, this.viewOffsetY, 7, dt);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (Math.abs(this._viewOffsetCur) > 0.5 || Math.abs(this._viewOffsetCurY) > 0.5) this.cam.setViewOffset(w, h, this._viewOffsetCur, this._viewOffsetCurY, w, h);
    else if (this.cam.view && this.cam.view.enabled) this.cam.clearViewOffset();
  }
  get view() {
    return { target: this.goalTarget.clone(), r: this.goal.r, theta: this.goal.theta, phi: this.goal.phi };
  }
}

const controls = new CalmControls(camera, renderer.domElement);

function resize() {
  const w = stageEl.clientWidth || window.innerWidth;
  const h = stageEl.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  // keep the room framed on tall/narrow windows by widening the lens a touch
  camera.fov = w / h < 1 ? 34 : 26;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* Contact shadows: soft blobs that seat objects on the floor. */
const BLOB_TEX = canvasTexture(BLOB_CANVAS, { aniso: false });
function contactShadow(w, d, opacity = 0.5) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, opacity, depthWrite: false, toneMapped: false, color: 0x000000 })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  m.userData.noShadow = true;
  return m;
}
