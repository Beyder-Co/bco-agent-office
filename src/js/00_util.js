'use strict';
/* =============================================================================
   00 · UTILITIES — math, easing, brand tokens, colour, canvas textures, geometry
   ============================================================================= */

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing toward a target. */
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
/**
 * A critically damped spring, solved exactly for any dt (so a slow frame never overshoots or blows up): the value
 * eases out of rest and into its target with no jump in speed, the way a limb moves. S = { x, v }; w is its rate
 * (about twice an exponential smoothing rate gives the same settling time). Returns S.x.
 */
function springStep(S, goal, w, dt) {
  const d = S.x - goal, e = Math.exp(-w * dt), j = S.v + w * d;
  S.x = goal + (d + j * dt) * e;
  S.v = (S.v - w * j * dt) * e;
  return S.x;
}
/** Minimum-jerk ease (quintic): zero speed and zero acceleration at both ends. */
const minJerk = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (10 + t * (6 * t - 15)));
const easeInOut = t =>(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Deterministic PRNG so procedural textures look identical on every load. */
function seeded(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let REDUCED_MOTION = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Brand tokens. Type is Avenir Next throughout; crimson marks what needs the owner (and the ampersand). */
const BRAND = {
  white: '#ffffff',
  ink: '#0a0a0a',
  charcoal: '#2a2a2b',
  mist: '#8c8c8e',
  crimson: '#a70008',
  display: '"Avenir Next", -apple-system, "Helvetica Neue", sans-serif',
  ui: '"Avenir Next", -apple-system, "Helvetica Neue", sans-serif',
  code: 'Menlo, "SF Mono", Monaco, monospace',
};

/** Hex (sRGB, as designed) → linear colour for lit/unlit materials. */
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
/** Mix two hex colours in sRGB space. */
const mixHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
/** Relative luminance of an sRGB hex. */
function relLum(hex) {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
/** The text colour (ink or white) with the higher contrast on a background. */
const inkOn = hex => {
  const L = relLum(hex);
  return (L + 0.05) / 0.0533 > 1.05 / (L + 0.05) ? '#0a0a0a' : '#ffffff';
};
const rgba = (hex, a) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};

/* ---------- canvas textures ------------------------------------------------ */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Wraps a canvas in a texture with sRGB decoding and max anisotropy. */
function canvasTexture(canvas, { repeat = false, aniso = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  if (aniso && typeof renderer !== 'undefined') tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Loads a data-URI image into a texture (resolves when decoded). */
function imageTexture(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Letter-spaced text for canvas (Safari lacks ctx.letterSpacing). */
function spacedText(ctx, text, x, y, spacing, align = 'left') {
  const chars = [...text];
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

/** Fits text into maxWidth by shrinking the font size; returns the size used. */
function fitFont(ctx, text, weight, family, size, maxWidth, minSize = 10) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 1;
  } while (s > minSize);
  return s;
}

/** Wraps text into lines that fit maxWidth. */
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** White oak: pale warm base, straight grain, the light ray flecks white oak is known for. */
function oakCanvas(w = 1024, h = 256, seed = 3, { base = '#dcc8a8', dark = [140, 106, 70], light = [250, 240, 222] } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const y = rnd() * h, bh = 4 + rnd() * 28;
    ctx.fillStyle = `rgba(${dark.join()},${0.02 + rnd() * 0.05})`;
    ctx.fillRect(0, y, w, bh);
  }
  for (let i = 0; i < 150; i++) {
    const y = rnd() * h, al = 0.035 + rnd() * 0.11, lw = 0.5 + rnd() * 1.3, amp = rnd() * 2.6, fq = 0.002 + rnd() * 0.009, ph = rnd() * 10;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x * fq + ph) * amp;
      x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    }
    ctx.strokeStyle = `rgba(${dark.join()},${al})`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  for (let i = 0; i < 170; i++) {
    ctx.fillStyle = `rgba(${light.join()},${0.12 + rnd() * 0.22})`;
    ctx.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 14, 1 + rnd());
  }
  return c;
}

/** Warm limestone floor in large-format tiles. */
function stoneCanvas(size = 1024, seed = 9, { base = '#e4ded4', joints = 4, joint = 'rgba(128,116,102,0.32)' } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const step = size / joints;
  for (let i = 0; i < joints; i++)
    for (let j = 0; j < joints; j++) {
      const v = (rnd() - 0.5) * 0.07;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(96,84,70,${-v})`;
      ctx.fillRect(i * step, j * step, step, step);
    }
  for (let i = 0; i < 36; i++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.03 + rnd() * 0.1), al = 0.02 + rnd() * 0.03;
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, `rgba(120,106,90,${al})`);
        gr.addColorStop(1, 'rgba(120,106,90,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
  }
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? `rgba(98,86,72,${0.04 + rnd() * 0.09})` : `rgba(255,255,255,${0.07 + rnd() * 0.12})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.3, 1 + rnd() * 1.3);
  }
  ctx.fillStyle = joint;
  for (let i = 0; i < joints; i++) {
    ctx.fillRect(i * step, 0, 2, size);
    ctx.fillRect(0, i * step, size, 2);
  }
  return c;
}

/** Polished grey concrete in large squares: cloudy, faintly speckled, hairline joints. */
function concreteCanvas(size = 1024, seed = 21, { base = '#b8b7b3', joints = 2, joint = 'rgba(70,70,68,0.34)', jointW = 2.5, chamfer = 0 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const step = size / joints;
  for (let i = 0; i < joints; i++)
    for (let j = 0; j < joints; j++) {
      const v = (rnd() - 0.5) * 0.06;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(60,60,58,${-v})`;
      ctx.fillRect(i * step, j * step, step, step);
    }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.04 + rnd() * 0.16), dark = rnd() < 0.55, al = 0.025 + rnd() * 0.045;
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, dark ? `rgba(70,70,68,${al})` : `rgba(255,255,255,${al})`);
        gr.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
  }
  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle = rnd() < 0.55 ? `rgba(55,55,53,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.06 + rnd() * 0.1})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.2, 1 + rnd() * 1.2);
  }
  ctx.fillStyle = joint;
  for (let i = 0; i < joints; i++) {
    ctx.fillRect(i * step, 0, jointW, size);
    ctx.fillRect(0, i * step, size, jointW);
  }
  // a hairline of light along one edge of each joint: the arris of the slab catching the light
  if (chamfer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${chamfer})`;
    for (let i = 0; i < joints; i++) {
      ctx.fillRect(i * step + jointW, 0, 1.25, size);
      ctx.fillRect(0, i * step + jointW, size, 1.25);
    }
  }
  return c;
}


/** Soft radial blob used as a contact / ambient-occlusion shadow decal. */
const BLOB_CANVAS = (() => {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.6)');
  gr.addColorStop(0.35, 'rgba(0,0,0,0.32)');
  gr.addColorStop(0.7, 'rgba(0,0,0,0.08)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  return c;
})();

/** Soft round glow (white; tinted by the material colour). */
const GLOW_CANVAS = (() => {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  return c;
})();

/** State ring: a crisp line with a soft glow either side (white; tinted per agent). */
function ringCanvas(size = 512, ringFrac = 0.885, width = 6) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const cx = size / 2, r = (size / 2) * ringFrac;
  const gr = ctx.createRadialGradient(cx, cx, r - 26, cx, cx, r + 26);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, TAU);
  ctx.stroke();
  return c;
}
/** A comet arc for "thinking": a bright head with a fading tail. */
function arcCanvas(size = 512, ringFrac = 0.885, width = 9) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const cx = size / 2, r = (size / 2) * ringFrac, N = 90, span = Math.PI * 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * span, a1 = ((i + 1) / N) * span;
    ctx.strokeStyle = `rgba(255,255,255,${Math.pow((i + 1) / N, 2.2)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cx, r, a0, a1 + 0.01);
    ctx.stroke();
  }
  return c;
}

/** Small glyph sprites that drift up from a working desk. */
const GLYPH_TEX = {};
function glyphTexture(text) {
  if (GLYPH_TEX[text]) return GLYPH_TEX[text];
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${text.length > 2 ? 46 : 64}px ${BRAND.code}`;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 64, 68);
  return (GLYPH_TEX[text] = canvasTexture(c, { aniso: false }));
}

/* ---------- geometry helpers ------------------------------------------------ */

/** Smooth rounded box (port of three's RoundedBoxGeometry, r128 examples). */
function roundedBoxGeometry(width, height, depth, radius, segments = 3) {
  segments = segments * 2 + 1;
  radius = Math.min(width / 2, height / 2, depth / 2, radius);
  const geo = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments).toNonIndexed();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const half = 0.5 / segments;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.copy(p);
    n.x -= Math.sign(n.x) * half;
    n.y -= Math.sign(n.y) * half;
    n.z -= Math.sign(n.z) * half;
    n.normalize();
    pos.setXYZ(i, box.x * Math.sign(p.x) + n.x * radius, box.y * Math.sign(p.y) + n.y * radius, box.z * Math.sign(p.z) + n.z * radius);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/** Capsule along Y, centred at origin (r128 has no CapsuleGeometry). */
function capsuleGeometry(r, len, capSeg = 10, radial = 28) {
  const pts = [];
  for (let i = 0; i <= capSeg; i++) {
    const a = -HALF_PI + (i / capSeg) * HALF_PI;
    pts.push(new THREE.Vector2(Math.max(0.0006, Math.cos(a) * r), Math.sin(a) * r - len / 2));
  }
  for (let i = 0; i <= capSeg; i++) {
    const a = (i / capSeg) * HALF_PI;
    pts.push(new THREE.Vector2(Math.max(0.0006, Math.cos(a) * r), Math.sin(a) * r + len / 2));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Tapered limb (rounded ends, different radii) along -Y from the origin. */
function limbGeometry(r0, r1, len, radial = 26) {
  const pts = [];
  const cap = 8;
  for (let i = 0; i <= cap; i++) {
    const a = -HALF_PI + (i / cap) * HALF_PI;
    pts.push(new THREE.Vector2(Math.max(0.0006, Math.cos(a) * r1), Math.sin(a) * r1 - len));
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * HALF_PI;
    pts.push(new THREE.Vector2(Math.max(0.0006, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Lathe through a Catmull-Rom spline of [radius, height] control points. */
function latheFromProfile(ctrl, samples = 56, radial = 44) {
  const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getPoints(samples).map(v => new THREE.Vector2(Math.max(0.0006, v.x), v.y));
  return new THREE.LatheGeometry(pts, radial);
}

/** Capsule (or rod) spanning two points; returns a mesh oriented along a→b. */
function rodBetween(a, b, r, material, cap = true) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = cap ? capsuleGeometry(r, len, 6, 14) : new THREE.CylinderGeometry(r, r, len, 14);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** Point on a sphere using three's SphereGeometry angle convention (phi=π/2 → +Z). */
function spherePoint(r, phi, theta) {
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

/** Positions an object and returns it (Object3D.position is read-only to assign). */
function placed(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

function shadowAll(obj, cast = true, receive = true) {
  obj.traverse(o => {
    if (o.isMesh) {
      const skip = !!o.userData.noShadow;
      o.castShadow = cast && !skip;
      o.receiveShadow = receive && !skip;
    }
  });
  return obj;
}

/* ---------- colliders: oriented boxes recorded before batching ----------------
   Every furniture group records one box per mesh (in the group's frame) before
   its meshes are merged, so walking, seating and the collision audit can test
   bodies against the real pieces — a desk leg, a cushion, a pane of glass.     */
const COLLIDERS = { list: [] };
/** The collision shape of a mesh in its own frame: box, sphere, cylinder, arc (a curved band) or torus. */
function colliderShape(o) {
  if (o.userData.collider) return o.userData.collider;
  const g = o.geometry, P = g.parameters || {};
  switch (g.type) {
    case 'SphereGeometry':
      return P.thetaLength >= Math.PI - 1e-3 && P.phiLength >= TAU - 1e-3 ? { kind: 'sphere', r: P.radius } : null;
    case 'IcosahedronGeometry':
      return { kind: 'sphere', r: P.radius };
    case 'CylinderGeometry': {
      const r = Math.max(P.radiusTop, P.radiusBottom);
      if (P.thetaLength >= TAU - 1e-3) return { kind: 'cyl', r };
      return { kind: 'arc', r0: P.openEnded ? r - 0.025 : 0, r1: r + (P.openEnded ? 0.025 : 0), a0: P.thetaStart, a1: P.thetaStart + P.thetaLength, conv: 'cyl' };
    }
    case 'LatheGeometry': {
      const bb = g.boundingBox;
      return { kind: 'cyl', r: Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z) };
    }
    case 'TorusGeometry':
      return { kind: 'torus', R: P.radius, tube: P.tube, arc: P.arc };
    default:
      return null;
  }
}
/** The bounds of everything under `root`, in root's own frame (`skip(mesh)` leaves a mesh out). */
function localBox(root, skip = null) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4(), b = new THREE.Box3(), out = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || (skip && skip(o))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    out.union(b.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
  });
  return out;
}
function registerColliders(group, tag, { skip = null } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  group.traverse(o => {
    if (!o.isMesh || !o.geometry || o.userData.noCollide) return;
    if (skip && skip(o)) return;
    if (o.userData.noShadow && o.material && o.material.transparent && !o.userData.collide) return; // contact shadows, labels
    if (o.material && o.material.isMeshBasicMaterial && o.material.transparent && !o.material.depthWrite && !o.userData.collide) return; // light: holograms, beams, glows
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb || bb.isEmpty()) return;
    COLLIDERS.list.push({ tag, group, rel: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), box: bb.clone(), shape: colliderShape(o), part: o.userData.part || o.name || o.geometry.type });
  });
}

/* ---------- static batching: one draw call per material ----------------------
   Merges leaf meshes under `root` that share a material (and shadow flags) into
   a single mesh. Skips transparent and multi-material meshes, anything flagged
   userData.keep (or under a kept ancestor), and meshes with children.          */
function mergeByMaterial(root, { shallow = false } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh || o === root || o.children.length || !o.visible) return;
    if (shallow && o.parent !== root) return;
    if (Array.isArray(o.material) || o.material.transparent) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.userData.agentId || ''}|${o.userData.pick || ''}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  const m = new THREE.Matrix4();
  for (const items of buckets.values()) {
    if (items.length < 2) continue;
    const geos = items.map(o => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    let count = 0;
    for (const g of geos) count += g.attributes.position.count;
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
      const arr = new Float32Array(count * size);
      let off = 0;
      for (const g of geos) {
        const at = g.attributes[name];
        if (at) arr.set(at.array.length === at.count * size ? at.array : at.array.subarray(0, at.count * size), off);
        off += g.attributes.position.count * size;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    out.computeBoundingBox();
    const first = items[0];
    const mesh = new THREE.Mesh(out, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    if (first.userData.agentId) mesh.userData.agentId = first.userData.agentId;
    if (first.userData.pick) mesh.userData.pick = first.userData.pick;
    root.add(mesh);
    for (const o of items) o.parent.remove(o);
    geos.forEach(g => g.dispose());
  }
  return root;
}

/* ---------- time (America/New_York, 12-hour) -------------------------------- */

const ET_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const ET_TIME_S = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const ET_DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
const ET_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric' });
const formatKnownDate = (formatter, value, unavailable) => {
  const at = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : NaN;
  return Number.isFinite(at) && Math.abs(at) <= 8640000000000000 ? formatter.format(at) : unavailable;
};
const fmtTime = d => formatKnownDate(ET_TIME, d, 'time unavailable');
const fmtTimeS = d => formatKnownDate(ET_TIME_S, d, 'time unavailable');
const fmtDate = d => formatKnownDate(ET_DATE, d, 'date unavailable');
/** Hours since midnight in New York (decimal), and the day of the year. */
function etClock(d = new Date()) {
  const p = Object.fromEntries(ET_PARTS.formatToParts(d).map(x => [x.type, x.value]));
  const hour = Number(p.hour) + Number(p.minute) / 60;
  const start = Date.UTC(Number(p.year), 0, 0);
  const doy = Math.floor((Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - start) / 86400000);
  return { hour, doy };
}
