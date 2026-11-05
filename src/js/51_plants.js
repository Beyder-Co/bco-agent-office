/* =============================================================================
   51 · PLANTS — living things that read as real
   -----------------------------------------------------------------------------
   Every leaf is a true blade: its own outline, a folded midrib, a cup, an arch
   and a droop, painted with veins and a base-to-tip gradient. Every leaf of a
   plant is one instance of its blade, so a whole canopy costs one draw call.
     fig      fiddle-leaf fig, grown full: three stems clothed in big glossy leaves to the rim
     kentia   kentia palm: clustered canes and arching fronds of long drooping leaflets
     olive    olive tree: a twisted trunk and a cloud of narrow grey-green leaves (not placed)
     bloom    white mophead hydrangea, floret by floret, in a tall pot or a bowl
     orchid   white phalaenopsis: broad leaves, an arching spike, aerial roots
     roses    crimson roses with spiralled petals, in the twisted white-oak vase
     desk     small desk plants by seed: pothos, echeveria or a ZZ plant
   Pots keep the room plan's sizes but are open vessels with a rim, soil and a
   top dressing. Foliage gets a plain invisible footprint for steering, never a
   collider per leaf.
   ============================================================================= */

const PLANTS = (() => {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = new THREE.Vector3(0, 1, 0);
  const memo = {};
  const once = (k, make) => (k in memo ? memo[k] : (memo[k] = make()));
  const mix = (a, b, t) => a + (b - a) * t;
  const tint = (r, g, b) => new THREE.Color(r, g, b);

  /* ---------- outlines: half-width (0..1) along a blade, base (0) to tip (1) ---------- */
  function outline(pts) {
    return t => {
      if (t <= pts[0][0]) return pts[0][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const [t0, w0] = pts[i], [t1, w1] = pts[i + 1];
        if (t > t1) continue;
        const wp = i > 0 ? pts[i - 1][1] : w0, wn = i + 2 < pts.length ? pts[i + 2][1] : w1;
        const u = (t - t0) / (t1 - t0), u2 = u * u, u3 = u2 * u;
        return Math.max(0, 0.5 * (2 * w0 + (-wp + w1) * u + (2 * wp - 5 * w0 + 4 * w1 - wn) * u2 + (-wp + 3 * w0 - 3 * w1 + wn) * u3));
      }
      return pts[pts.length - 1][1];
    };
  }
  const SHAPE = {
    fiddle: outline([[0, 0.05], [0.06, 0.26], [0.18, 0.46], [0.33, 0.5], [0.45, 0.53], [0.58, 0.72], [0.72, 0.94], [0.84, 1], [0.92, 0.88], [0.97, 0.58], [1, 0]]),
    lance: outline([[0, 0.1], [0.12, 0.62], [0.3, 0.93], [0.5, 1], [0.7, 0.86], [0.88, 0.48], [1, 0]]),
    ovate: outline([[0, 0.08], [0.1, 0.58], [0.25, 0.9], [0.42, 1], [0.6, 0.9], [0.8, 0.58], [0.93, 0.24], [1, 0]]),
    broad: outline([[0, 0.5], [0.08, 0.8], [0.3, 0.97], [0.6, 1], [0.82, 0.88], [0.94, 0.56], [1, 0]]),
    heart: outline([[0, 0.62], [0.05, 0.9], [0.14, 1], [0.32, 0.93], [0.56, 0.68], [0.8, 0.36], [1, 0]]),
    spoon: outline([[0, 0.38], [0.28, 0.6], [0.56, 0.88], [0.76, 1], [0.9, 0.86], [0.97, 0.46], [1, 0]]),
    ellip: outline([[0, 0.12], [0.15, 0.62], [0.4, 0.98], [0.6, 1], [0.82, 0.72], [0.95, 0.3], [1, 0]]),
    round: outline([[0, 0.2], [0.22, 0.72], [0.5, 1], [0.76, 0.9], [0.92, 0.56], [1, 0]]),
    petal: outline([[0, 0.24], [0.15, 0.58], [0.4, 0.93], [0.62, 1], [0.8, 0.9], [0.93, 0.62], [1, 0]]),
    sepal: outline([[0, 0.26], [0.2, 0.64], [0.5, 0.9], [0.75, 0.78], [0.92, 0.44], [1, 0]]),
    lip: outline([[0, 0.3], [0.28, 0.72], [0.55, 1], [0.8, 0.84], [1, 0.32]]),
    point: outline([[0, 0.3], [0.2, 0.8], [0.45, 1], [0.7, 0.68], [0.9, 0.28], [1, 0]]),
  };

  /** A blade along +Z (base at the origin, upper face toward +Y): its outline, a midrib fold, a cup, an arch, a droop. */
  function blade(shape, len, wid, { segL = 10, segW = 4, fold = 0.1, cup = 0.1, arch = 0.05, droop = 0.1, wave = 0, waves = 5, twist = 0, recurve = 0 } = {}) {
    const prof = SHAPE[shape];
    const cols = segW + 1, pos = [], uv = [], idx = [];
    for (let i = 0; i <= segL; i++) {
      const t = i / segL, w = prof(t), hw = (w * wid) / 2;
      for (let j = 0; j <= segW; j++) {
        const s = (j / segW) * 2 - 1, as = Math.abs(s);
        let x = s * hw;
        let y = fold * Math.pow(as, 1.2) * hw + cup * s * s * hw - recurve * Math.pow(as, 4) * hw;
        y += wave * Math.sin(t * Math.PI * waves + (s > 0 ? 0.9 : 0)) * Math.pow(as, 3) * wid * 0.5;
        y += arch * Math.sin(Math.PI * t) * len - droop * t * t * len;
        if (twist) {
          const a = twist * t, c = Math.cos(a), sn = Math.sin(a), x2 = x * c - y * sn;
          y = x * sn + y * c;
          x = x2;
        }
        pos.push(x, y, t * len);
        uv.push(0.5 + s * w * 0.5, t);
      }
    }
    for (let i = 0; i < segL; i++)
      for (let j = 0; j < segW; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** Concatenates geometries (each with its own matrix and optional per-vertex colour function) into one. */
  function mergeParts(parts) {
    const P = [], N = [], U = [], C = [];
    const withColor = parts.some(p => p.color);
    for (const p of parts) {
      const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(p.m || new THREE.Matrix4());
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
      for (let i = 0; i < pa.count; i++) {
        P.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        N.push(na.getX(i), na.getY(i), na.getZ(i));
        const u = ua ? ua.getX(i) : 0, v = ua ? ua.getY(i) : 0;
        U.push(u, v);
        if (withColor) {
          const c = p.color ? p.color(u, v) : [1, 1, 1];
          C.push(c[0], c[1], c[2]);
        }
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    if (withColor) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    out.computeBoundingSphere();
    return out;
  }

  /** A tube along a curve whose radius tapers (and flares at the foot): trunks, branches, stems, roots. */
  function taperTube(pts, r0, r1, { radial = 8, seg = 16, flare = 0 } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const fr = curve.computeFrenetFrames(seg, false);
    const len = curve.getLength();
    const pos = [], nrm = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, P = curve.getPointAt(t), Nn = fr.normals[i], B = fr.binormals[i];
      const r = (r0 + (r1 - r0) * Math.pow(t, 0.85)) * (1 + flare * Math.exp(-t * 16));
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const nx = ca * Nn.x + sa * B.x, ny = ca * Nn.y + sa * B.y, nz = ca * Nn.z + sa * B.z;
        pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
        nrm.push(nx, ny, nz);
        uv.push(j / radial, (t * len) / 0.12);
      }
    }
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    // the frames decide which way round the rings run: keep the faces pointing out
    const p0 = V(pos[0], pos[1], pos[2]), pb = V(pos[(radial + 1) * 3], pos[(radial + 1) * 3 + 1], pos[(radial + 1) * 3 + 2]), p1 = V(pos[3], pos[4], pos[5]);
    const fn = new THREE.Vector3().crossVectors(pb.clone().sub(p0), p1.clone().sub(p0));
    if (fn.dot(V(nrm[0], nrm[1], nrm[2])) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /* ---------- painted surfaces ---------- */

  /** Paints a blade (leaf or petal) in its own UV space: base at the bottom of the canvas, tip at the top. */
  function paint(key, o) {
    return once('tex:' + key, () => {
      const W = o.w || 128, H = o.h || 256, c = makeCanvas(W, H), x = c.getContext('2d');
      const rnd = seeded(o.seed || 11);
      const prof = SHAPE[o.shape];
      const Y = t => (1 - t) * H;
      const half = t => (prof(t) * W) / 2;
      const gr = x.createLinearGradient(0, H, 0, 0);
      (o.stops || [[0, o.base], [0.5, o.mid], [1, o.tip]]).forEach(([k, col]) => gr.addColorStop(k, col));
      x.fillStyle = gr;
      x.fillRect(0, 0, W, H);
      if (o.across) {
        const ga = x.createLinearGradient(0, 0, W, 0);
        ga.addColorStop(0, o.across[1]);
        ga.addColorStop(0.5, o.across[0]);
        ga.addColorStop(1, o.across[1]);
        x.fillStyle = ga;
        x.fillRect(0, 0, W, H);
      }
      const nMot = (o.mottle ?? 1) * W * H * 0.004;
      for (let i = 0; i < nMot; i++) {
        const t = rnd(), u = 0.5 + (rnd() - 0.5) * prof(t);
        const r = 0.6 + rnd() * (o.blot || 4);
        x.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.035})` : `rgba(0,0,0,${0.025 + rnd() * 0.04})`;
        x.beginPath();
        x.ellipse(u * W, Y(t), r, r * (1 + rnd()), rnd() * 3, 0, TAU);
        x.fill();
      }
      x.lineCap = 'round';
      if (o.parallel) {
        x.strokeStyle = o.pvein || o.vein;
        x.lineWidth = o.pveinW || 0.8;
        for (let k = 0; k < o.parallel; k++) {
          const f = ((k + 0.5) / o.parallel) * 2 - 1;
          x.beginPath();
          for (let i = 0; i <= 24; i++) {
            const t = i / 24, px = W / 2 + f * half(t) * 0.9, py = Y(t);
            i ? x.lineTo(px, py) : x.moveTo(px, py);
          }
          x.stroke();
        }
      }
      if (o.veins) {
        for (let i = 0; i < o.veins; i++) {
          const t0 = 0.05 + ((i + 0.5) / o.veins) * (o.veinSpan || 0.86);
          const t1 = Math.min(0.99, t0 + (o.rise || 0.14));
          for (const sd of [-1, 1]) {
            const ex = W / 2 + sd * half(t1) * 0.88, ey = Y(t1);
            const cx = W / 2 + sd * half(t0) * (o.bow || 0.5), cy = Y(t0 + (t1 - t0) * 0.22);
            x.strokeStyle = o.vein;
            x.lineWidth = (o.veinW || 1.4) * (1 - t0 * 0.45);
            x.beginPath();
            x.moveTo(W / 2, Y(t0));
            x.quadraticCurveTo(cx, cy, ex, ey);
            x.stroke();
            if (o.fine) {
              // a few tertiary veins between the laterals
              x.lineWidth = 0.6;
              x.strokeStyle = o.fine;
              for (let k = 0; k < 3; k++) {
                const tt = t0 + (t1 - t0) * (0.3 + k * 0.22);
                const px = W / 2 + sd * half(tt) * (0.25 + rnd() * 0.4), py = Y(tt);
                x.beginPath();
                x.moveTo(px, py);
                x.lineTo(px + sd * (4 + rnd() * 8), py - 6 - rnd() * 8);
                x.stroke();
              }
            }
          }
        }
      }
      if (o.midrib) {
        x.fillStyle = o.midrib;
        const mw = o.midW || 3.5;
        x.beginPath();
        x.moveTo(W / 2 - mw / 2, H);
        x.lineTo(W / 2 + mw / 2, H);
        x.lineTo(W / 2 + 0.4, Y(o.midEnd || 0.95));
        x.lineTo(W / 2 - 0.4, Y(o.midEnd || 0.95));
        x.closePath();
        x.fill();
      }
      if (o.extra) o.extra(x, W, H, Y, half, rnd);
      if (o.edge) {
        x.strokeStyle = o.edge;
        x.lineWidth = o.edgeW || 3;
        x.beginPath();
        for (let i = 0; i <= 48; i++) {
          const t = i / 48, px = W / 2 - half(t), py = Y(t);
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        for (let i = 48; i >= 0; i--) x.lineTo(W / 2 + half(i / 48), Y(i / 48));
        x.stroke();
      }
      return canvasTexture(c);
    });
  }

  /** A foliage material: the painted blade as colour, a faint glow of its own colour standing in for light through the leaf. */
  function leafMat(key, tex, { rough = 0.6, coat = 0, glow = 0.1, color = '#ffffff', vc = false, env = 0.5 } = {}) {
    return once('mat:' + key, () => {
      const p = { map: tex, color: lin(color), roughness: rough, metalness: 0, side: THREE.DoubleSide, envMapIntensity: env, fog: false, vertexColors: vc, emissive: new THREE.Color(glow, glow, glow), emissiveMap: tex };
      const m = coat ? new THREE.MeshPhysicalMaterial({ ...p, clearcoat: coat, clearcoatRoughness: 0.42 }) : new THREE.MeshStandardMaterial(p);
      m.shadowSide = THREE.DoubleSide;
      return m;
    });
  }

  function surfaceTex(key, size, draw, repeat = true) {
    return once('surf:' + key, () => {
      const c = makeCanvas(size, size), x = c.getContext('2d');
      draw(x, size, seeded(size + key.length * 13));
      return canvasTexture(c, { repeat });
    });
  }

  /** Bark: fine fissures running along the stem (u around, v along). */
  function barkMat(key, base, dark, light, fissures = 40) {
    return once('bark:' + key, () => {
      const tex = surfaceTex('bark-' + key, 128, (x, S, rnd) => {
        x.fillStyle = base;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < fissures; i++) {
          x.strokeStyle = rnd() < 0.6 ? dark : light;
          x.globalAlpha = 0.25 + rnd() * 0.4;
          x.lineWidth = 0.6 + rnd() * 1.6;
          let px = rnd() * S, py = 0;
          x.beginPath();
          x.moveTo(px, py);
          while (py < S) {
            py += 6 + rnd() * 10;
            px += (rnd() - 0.5) * 5;
            x.lineTo(px, py);
          }
          x.stroke();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 260; i++) {
          x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
          x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 0.8 + rnd());
        }
      });
      tex.repeat.set(1, 1);
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0, envMapIntensity: 0.35, fog: false });
    });
  }

  const stemMat = (key, hex, rough = 0.62) => once('stem:' + key, () => new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: 0, envMapIntensity: 0.4, fog: false }));

  /* ---------- instancing ---------- */

  const _o = new THREE.Object3D(), _white = tint(1, 1, 1);
  /** One InstancedMesh for a list of {p, rx, ry, rz | q, s | sx sy sz, c}: rotations in 'YXZ' (yaw, then pitch, then roll about the blade). */
  function instanced(geo, mat, list, { shadow = true } = {}) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((L, i) => {
      _o.position.copy(L.p);
      if (L.q) _o.quaternion.copy(L.q);
      else _o.rotation.set(L.rx || 0, L.ry || 0, L.rz || 0, 'YXZ');
      const s = L.s ?? 1;
      _o.scale.set(L.sx ?? s, L.sy ?? s, L.sz ?? s);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      m.setColorAt(i, L.c || _white);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // tiny parts (florets) never cast: the room's shadowAll would switch them on again, so the flag is pinned
    if (shadow) m.castShadow = true;
    else Object.defineProperty(m, 'castShadow', { get: () => false, set: () => {} });
    m.receiveShadow = true;
    m.frustumCulled = false; // r128 culls an InstancedMesh by one instance's bounds
    m.userData.noCollide = true; // foliage: the plant's footprint stands in for it
    m.userData.keep = true; // never batched: batching would drop the instance matrices
    return m;
  }
  /** Direction (yaw about Y, elevation above the horizon) to the blade's frame: yaw, then pitch up. */
  const aim = d => ({ ry: Math.atan2(d.x, d.z), rx: -Math.asin(clamp(d.y, -1, 1)) });
  /** Short stalks (petioles, pedicels) from a to b. */
  const STALK_GEO = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  })();
  function stalks(pairs, r, mat) {
    return instanced(
      STALK_GEO,
      mat,
      pairs.map(([a, b]) => {
        const d = b.clone().sub(a), L = d.length();
        return { p: a, q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), sx: r, sy: L, sz: r };
      })
    );
  }

  /** An invisible upright cylinder: what walkers steer round instead of the leaves. */
  const PROXY_MAT = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  function footprint(g, r, y0, y1, x = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.05, y1 - y0), 14), PROXY_MAT);
    m.position.set(x, (y0 + y1) / 2, z);
    m.visible = false;
    m.userData.part = 'foliage';
    g.add(m);
  }

  /* ---------- pots: open vessels with a rim, the room plan's sizes ---------- */

  const POTS = {
    tall: { pts: [[0.0006, 0], [0.162, 0], [0.17, 0.01], [0.204, 0.496], [0.206, 0.512], [0.2, 0.52], [0.189, 0.517], [0.185, 0.505], [0.18, 0.47], [0.0006, 0.47]], soil: 0.482, soilR: 0.183, mat: 'stoneware' },
    bowl: { pts: [[0.0006, 0], [0.13, 0], [0.142, 0.008], [0.2, 0.085], [0.238, 0.19], [0.251, 0.262], [0.246, 0.27], [0.234, 0.268], [0.228, 0.255], [0.215, 0.2], [0.16, 0.13], [0.0006, 0.12]], soil: 0.215, soilR: 0.222, mat: 'stone' },
    cyl: { pts: [[0.0006, 0], [0.234, 0], [0.24, 0.01], [0.245, 0.388], [0.247, 0.4], [0.226, 0.4], [0.223, 0.39], [0.221, 0.34], [0.0006, 0.34]], soil: 0.365, soilR: 0.221, mat: 'stone' },
    small: { pts: [[0.0006, 0], [0.055, 0], [0.06, 0.006], [0.0715, 0.084], [0.0722, 0.09], [0.066, 0.09], [0.0648, 0.085], [0.062, 0.066], [0.0006, 0.066]], soil: 0.077, soilR: 0.0635, mat: 'glaze' },
    desk: { pts: [[0.0006, 0], [0.042, 0], [0.045, 0.005], [0.0495, 0.064], [0.0497, 0.07], [0.0445, 0.07], [0.0437, 0.065], [0.041, 0.05], [0.0006, 0.05]], soil: 0.06, soilR: 0.042, mat: 'matte' },
  };

  const potMat = kind =>
    once('pot:' + kind, () => {
      const speck = (base, dots, n, alpha) => (x, S, rnd) => {
        x.fillStyle = base;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < n; i++) {
          x.fillStyle = dots[(rnd() * dots.length) | 0];
          x.globalAlpha = alpha * (0.4 + rnd() * 0.6);
          const r = 0.4 + rnd() * 1.1;
          x.beginPath();
          x.arc(rnd() * S, rnd() * S, r, 0, TAU);
          x.fill();
        }
        x.globalAlpha = 1;
      };
      switch (kind) {
        case 'stoneware': {
          const t = surfaceTex('stoneware', 256, speck('#efece6', ['#7d7468', '#9a9184', '#c9c0b2'], 900, 0.55));
          t.repeat.set(6, 1);
          return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.66, clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.45, fog: false });
        }
        case 'stone': {
          const t = surfaceTex('stone', 256, (x, S, rnd) => {
            x.fillStyle = '#e4dccf';
            x.fillRect(0, 0, S, S);
            for (let i = 0; i < 26; i++) {
              x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '160,140,112'},${0.04 + rnd() * 0.06})`;
              x.fillRect(0, rnd() * S, S, 1 + rnd() * 10);
            }
            for (let i = 0; i < 700; i++) {
              x.fillStyle = `rgba(120,100,78,${0.15 + rnd() * 0.3})`;
              x.beginPath();
              x.ellipse(rnd() * S, rnd() * S, 0.5 + rnd() * 1.8, 0.4 + rnd() * 0.8, 0, 0, TAU);
              x.fill();
            }
          });
          t.repeat.set(3, 1);
          return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0, envMapIntensity: 0.4, fog: false });
        }
        case 'terracotta': {
          // an aged pot: warm clay under a soft lime bloom
          const t = surfaceTex('terracotta', 256, (x, S, rnd) => {
            x.fillStyle = '#b47456';
            x.fillRect(0, 0, S, S);
            for (let i = 0; i < 70; i++) {
              x.fillStyle = `rgba(232,222,206,${0.05 + rnd() * 0.14})`;
              x.beginPath();
              x.ellipse(rnd() * S, rnd() * S, 8 + rnd() * 40, 4 + rnd() * 18, rnd() * 3, 0, TAU);
              x.fill();
            }
            for (let i = 0; i < 1200; i++) {
              x.fillStyle = rnd() < 0.5 ? 'rgba(90,50,30,0.18)' : 'rgba(255,240,225,0.12)';
              x.fillRect(rnd() * S, rnd() * S, 1, 1);
            }
          });
          t.repeat.set(3, 1);
          return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, envMapIntensity: 0.3, fog: false });
        }
        case 'glaze':
          return new THREE.MeshPhysicalMaterial({ color: lin('#f5f4f0'), roughness: 0.22, clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 0.8, fog: false });
        case 'concrete': {
          const t = surfaceTex('concrete', 128, speck('#bdb9b2', ['#8e8a83', '#d6d2cb', '#a29e96'], 900, 0.5));
          t.repeat.set(3, 1);
          return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0, envMapIntensity: 0.3, fog: false });
        }
        default: {
          const t = surfaceTex('matte', 128, speck('#f1efeb', ['#a69e92', '#d8d2c8'], 260, 0.4));
          t.repeat.set(3, 1);
          return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0, envMapIntensity: 0.45, fog: false });
        }
      }
    });

  /** The surface in the pot: soil with a top dressing (river pebbles, moss, bark, grit). */
  function dressingTex(kind) {
    return surfaceTex('dress-' + kind, 256, (x, S, rnd) => {
      x.fillStyle = '#2f261e';
      x.fillRect(0, 0, S, S);
      for (let i = 0; i < 5000; i++) {
        x.fillStyle = ['#3c3026', '#251d17', '#46392c', '#1f1813'][(rnd() * 4) | 0];
        x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      const blob = (n, cols, rMin, rMax, shade = 0.35, sq = 0.75) => {
        for (let i = 0; i < n; i++) {
          const px = rnd() * S, py = rnd() * S, r = rMin + rnd() * (rMax - rMin), a = rnd() * 3;
          x.fillStyle = `rgba(0,0,0,${shade})`;
          x.beginPath();
          x.ellipse(px + 1.4, py + 1.6, r, r * sq, a, 0, TAU);
          x.fill();
          const g = x.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
          const c = cols[(rnd() * cols.length) | 0];
          g.addColorStop(0, c[0]);
          g.addColorStop(1, c[1]);
          x.fillStyle = g;
          x.beginPath();
          x.ellipse(px, py, r, r * sq, a, 0, TAU);
          x.fill();
        }
      };
      if (kind === 'pebble') {
        x.fillStyle = '#8f887d';
        x.fillRect(0, 0, S, S);
        blob(900, [['#ece8e1', '#c4beb3'], ['#dfd9cf', '#b3aca0'], ['#d3cdc2', '#a7a094'], ['#e7e2da', '#bdb6aa'], ['#c9c2b6', '#9d968a']], 5.5, 10.5, 0.16, 0.74);
      } else if (kind === 'moss') {
        for (let i = 0; i < 900; i++) {
          x.fillStyle = ['#4f6b34', '#5d7a3b', '#3f5a2b', '#6b8645', '#47622f'][(rnd() * 5) | 0];
          x.globalAlpha = 0.6 + rnd() * 0.4;
          x.beginPath();
          x.arc(rnd() * S, rnd() * S, 2 + rnd() * 5, 0, TAU);
          x.fill();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 1500; i++) {
          x.fillStyle = rnd() < 0.5 ? 'rgba(170,200,120,0.25)' : 'rgba(20,35,10,0.25)';
          x.fillRect(rnd() * S, rnd() * S, 1, 1);
        }
      } else if (kind === 'bark') blob(150, [['#8a5f3e', '#4e3423'], ['#7a5236', '#3f2a1c'], ['#9b6d48', '#5a3c27']], 5, 11, 0.45, 0.45);
      else if (kind === 'grit') blob(700, [['#d8d4cc', '#9d978c'], ['#c4beb3', '#857f74'], ['#ebe8e2', '#aaa499']], 1.5, 3.5, 0.3, 0.8);
      else for (let i = 0; i < 120; i++) {
        x.fillStyle = 'rgba(235,232,225,0.7)';
        x.beginPath();
        x.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.4, 0, TAU);
        x.fill();
      }
    });
  }

  function makePot(kind, s = 1, dressing = 'pebble', matKey = null) {
    const P = POTS[kind];
    const g = new THREE.Group();
    const pts = P.pts.map(([r, y]) => new THREE.Vector2(r * s, y * s));
    const segs = kind === 'desk' || kind === 'small' ? 36 : 56;
    const lathe = new THREE.LatheGeometry(pts, segs);
    const mat = potMat(matKey || P.mat);
    if (mat.map) {
      // texture by arc length up the wall, so the stone keeps its grain instead of streaking
      const cum = [0];
      for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + pts[j].distanceTo(pts[j - 1]));
      const rMax = Math.max(...pts.map(q => q.x)), tile = (TAU * rMax) / mat.map.repeat.x;
      const uvA = lathe.attributes.uv;
      for (let i = 0; i <= segs; i++) for (let j = 0; j < pts.length; j++) uvA.setY(i * pts.length + j, cum[j] / tile);
    }
    const pot = new THREE.Mesh(lathe, mat);
    pot.userData.part = 'pot';
    g.add(pot);
    const tex = dressingTex(dressing).clone();
    tex.needsUpdate = true;
    const tile = dressing === 'grit' ? 0.12 : dressing === 'bark' ? 0.2 : 0.3; // metres the texture covers
    tex.repeat.set((2 * P.soilR * s) / tile, (2 * P.soilR * s) / tile);
    const soilM = once(`soilmat:${dressing}:${kind}:${s}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, envMapIntensity: 0.2, fog: false }));
    const soil = new THREE.Mesh(new THREE.CircleGeometry(P.soilR * s, 40), soilM);
    soil.rotation.x = -HALF_PI;
    soil.position.y = P.soil * s;
    soil.userData.noCollide = true;
    g.add(soil);
    return { group: g, soilY: P.soil * s, rimY: P.pts[5][1] * s, rimR: P.soilR * s };
  }

  /* ---------- fiddle-leaf fig ---------- */

  /**
   * A full fiddle-leaf fig, grown as a bush: three stems from the pot, each clothed in big glossy violin
   * leaves from a hand above the rim to the crown, spiralling round it (no bare trunk, no gaps to see through).
   * limit {x0, x1, z0, z1}: the room's walls in the plant's own frame; leaves near one turn back from it.
   */
  function fig(seed = 21, s = 1, opts = {}) {
    const g = new THREE.Group(), rnd = seeded(seed);
    const pot = makePot('tall', s, 'pebble');
    g.add(pot.group);
    const y0 = pot.soilY;
    const lim = opts.limit || { x0: -9, x1: 9, z0: -9, z1: 9 };
    const bark = barkMat('fig', '#8a8074', '#5d544a', '#a79d90', 30);
    const stems = [
      { dx: 0.035, dz: -0.02, h: 1.24, r: 0.02, n: 34, ph: 0 },
      { dx: -0.07, dz: 0.045, h: 1.02, r: 0.017, n: 28, ph: 1.1 },
      { dx: 0.055, dz: 0.075, h: 0.84, r: 0.015, n: 24, ph: 2.3 },
    ];
    const leaves = [], pets = [];
    for (const S of stems) {
      const top = V(S.dx * 2.2 * s, y0 + S.h * s, S.dz * 2.2 * s);
      const pts = [V(S.dx * 0.25 * s, y0 - 0.03 * s, S.dz * 0.25 * s), V(S.dx * 0.9 * s, y0 + S.h * 0.35 * s, S.dz * 0.9 * s), V(S.dx * 1.7 * s, y0 + S.h * 0.7 * s, S.dz * 1.7 * s), top];
      g.add(new THREE.Mesh(taperTube(pts, S.r * s, S.r * 0.5 * s, { flare: 0.35, seg: 16, radial: 8 }), bark));
      const cv = new THREE.CatmullRomCurve3(pts);
      for (let i = 0; i < S.n; i++) {
        const k = 0.14 + (i / (S.n - 1)) * 0.86;
        const p = cv.getPointAt(k);
        let yaw = S.ph + i * 2.39996 + (rnd() - 0.5) * 0.35;
        const young = k > 0.92;
        // low leaves reach out level and droop a little; higher ones rise; the crown points up
        const elev = mix(-0.22, 0.95, Math.pow(k, 1.45)) + (rnd() - 0.5) * 0.28;
        let dir = V(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
        const sc = (young ? 0.62 + rnd() * 0.18 : 1.0 + Math.sin(Math.PI * k) * 0.22 + rnd() * 0.12) * s;
        // keep clear of the walls: a leaf whose blade would pass one turns along it instead
        const reach = 0.33 * sc + 0.04;
        const tip = p.clone().addScaledVector(dir, reach);
        if (tip.x < lim.x0 || tip.x > lim.x1 || tip.z < lim.z0 || tip.z > lim.z1) {
          yaw += Math.PI * 0.55;
          dir = V(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
        }
        const base = p.clone().addScaledVector(dir, (young ? 0.02 : 0.034) * s);
        pets.push([p, base]);
        const shade = 0.84 + rnd() * 0.18;
        const c = young ? tint(1.26, 1.3, 0.9) : tint(shade, shade * (0.98 + rnd() * 0.06), shade * 0.94);
        leaves.push({ p: base, ry: yaw, rx: -elev, rz: (rnd() - 0.5) * 0.7, s: sc, c });
      }
    }
    const geo = once('geo:fig', () => blade('fiddle', 0.3, 0.25, { segL: 12, segW: 6, fold: 0.09, cup: 0.2, arch: 0.05, droop: 0.11, wave: 0.024, waves: 7, recurve: 0.1 }));
    const tex = paint('fig', { shape: 'fiddle', w: 192, h: 256, base: '#2f5c25', mid: '#244d1b', tip: '#204618', across: ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)'], vein: 'rgba(176,206,124,0.34)', fine: 'rgba(176,206,124,0.12)', veins: 9, rise: 0.11, bow: 0.42, veinW: 1.6, midrib: 'rgba(196,218,146,0.72)', midW: 5, edge: 'rgba(18,34,12,0.45)', edgeW: 3, mottle: 1.2 });
    g.add(instanced(geo, leafMat('fig', tex, { rough: 0.42, coat: 0.38, glow: 0.03 }), leaves));
    g.add(stalks(pets, 0.0036 * s, stemMat('fig-pet', '#5d7a3c')));
    footprint(g, 0.42 * s, y0 + 0.2 * s, y0 + 1.3 * s);
    g.add(placed(contactShadow(0.9 * s, 0.9 * s, 0.4), 0, 0.004, 0));
    return shadowAll(g, true, true);
  }

  /* ---------- kentia palm ---------- */

  /**
   * A kentia palm, the classic of a luxury interior: clustered canes from the pot, and from them some sixteen
   * arching fronds, each a rachis with two rows of long, drooping leaflets, from upright young fronds in the
   * centre to old ones arching low over the rim. limit {x0, x1, z0, z1} keeps the fronds off the walls.
   */
  function kentia(seed = 5, s = 1.15, opts = {}) {
    const g = new THREE.Group(), rnd = seeded(seed);
    const pot = makePot('cyl', s, 'pebble');
    g.add(pot.group);
    const y0 = pot.soilY;
    const lim = opts.limit || { x0: -9, x1: 9, z0: -9, z1: 9 };
    const cane = barkMat('kentia-cane', '#6c6a46', '#4a4930', '#8c8a63', 18);
    const canes = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + rnd() * 0.5, rr = (0.03 + rnd() * 0.03) * s;
      const h = (0.22 + rnd() * 0.22) * s;
      const foot = V(Math.cos(a) * rr * 0.5, y0 - 0.02, Math.sin(a) * rr * 0.5);
      const top = V(Math.cos(a) * rr * 1.6, y0 + h, Math.sin(a) * rr * 1.6);
      canes.push({ foot, top, a });
      g.add(new THREE.Mesh(taperTube([foot, foot.clone().lerp(top, 0.5).add(V(0, 0.01, 0)), top], 0.017 * s, 0.013 * s, { seg: 8, radial: 8, flare: 0.3 }), cane));
    }
    const rach = [], leaflets = [];
    let f = 0;
    for (const C of canes) {
      for (let j = 0; j < 5; j++, f++) {
        const low = j === 4; // the old frond of each cane: low, arching out over the rim
        const yaw = low ? C.a + Math.PI * 0.5 + (rnd() - 0.5) * 0.8 : C.a + (j - 1.5) * 1.15 + (rnd() - 0.5) * 0.5;
        const young = j === 1 && rnd() < 0.7;
        const el0 = young ? 1.32 + rnd() * 0.15 : low ? 0.42 + rnd() * 0.2 : 0.75 + rnd() * 0.45;
        const sag = young ? 0.05 + rnd() * 0.1 : low ? 0.6 + rnd() * 0.3 : 0.25 + rnd() * 0.45;
        const L = (young ? 0.95 : low ? 0.82 + rnd() * 0.18 : 1.05 + rnd() * 0.3) * s;
        const n = 10, pts = [C.top.clone()];
        let p = C.top.clone();
        for (let i = 1; i <= n; i++) {
          const t = i / n, el = el0 - (el0 + sag) * Math.pow(t, 1.5);
          p = p.clone().add(V(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(L / n));
          pts.push(p);
        }
        // the room's walls: a frond that would reach one is drawn in (horizontally, about its base)
        let k = 1;
        for (const q of pts) {
          const dx = q.x - C.top.x, dz = q.z - C.top.z;
          if (q.x > lim.x1) k = Math.min(k, (lim.x1 - C.top.x) / dx);
          if (q.x < lim.x0) k = Math.min(k, (lim.x0 - C.top.x) / dx);
          if (q.z > lim.z1) k = Math.min(k, (lim.z1 - C.top.z) / dz);
          if (q.z < lim.z0) k = Math.min(k, (lim.z0 - C.top.z) / dz);
        }
        if (k < 1) for (const q of pts) q.set(C.top.x + (q.x - C.top.x) * k, q.y, C.top.z + (q.z - C.top.z) * k);
        rach.push(pts);
        const cv = new THREE.CatmullRomCurve3(pts);
        const pairs = 26;
        const shade = young ? 1.06 + rnd() * 0.08 : 0.84 + rnd() * 0.16;
        for (let i = 0; i < pairs; i++) {
          const u = i / (pairs - 1), t = 0.24 + u * 0.74;
          const q = cv.getPointAt(t), T = cv.getTangentAt(t);
          let side = V().crossVectors(T, UP);
          if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
          side.normalize();
          const len = (0.42 + 0.58 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.06)), 0.65)) * Math.min(1, 0.6 + k * 0.4);
          for (const sd of [-1, 1]) {
            const d = T.clone().multiplyScalar(0.62 + u * 0.3).addScaledVector(side, sd * (0.8 - u * 0.25)).add(V(0, -0.12 - u * 0.1 + (young ? 0.18 : 0), 0)).normalize();
            const b = shade * (0.94 + rnd() * 0.1);
            leaflets.push({ p: q.clone(), ...aim(d), rz: sd * (0.3 + rnd() * 0.2), sx: (0.85 + 0.15 * len) * s, sy: s, sz: len * s, c: tint(b * 0.98, b, b * 0.92) });
          }
        }
      }
    }
    // the rachises (stalk and midrib of every frond) as one mesh
    const parts = rach.map(pts => ({ geo: taperTube(pts, 0.0062 * s, 0.0016 * s, { seg: 14, radial: 5 }) }));
    const rm = new THREE.Mesh(mergeParts(parts), stemMat('kentia-rachis', '#56693a', 0.55));
    rm.userData.noCollide = true; // inside the footprint
    g.add(rm);
    const geo = once('geo:kentia', () => blade('lance', 0.3, 0.03, { segL: 7, segW: 2, fold: 0.38, cup: 0, arch: 0.02, droop: 0.26 }));
    const tex = paint('kentia', { shape: 'lance', w: 48, h: 256, base: '#264d1d', mid: '#2e5a23', tip: '#2a541f', vein: 'rgba(160,200,120,0.2)', veins: 0, parallel: 4, pvein: 'rgba(176,210,136,0.16)', pveinW: 0.8, midrib: 'rgba(196,222,150,0.6)', midW: 2.2, edge: 'rgba(20,40,14,0.32)', edgeW: 1.4, mottle: 0.6, blot: 2 });
    g.add(instanced(geo, leafMat('kentia', tex, { rough: 0.5, coat: 0.22, glow: 0.03 }), leaflets));
    footprint(g, 0.5 * s, y0 + 0.2 * s, y0 + 1.4 * s);
    g.add(placed(contactShadow(1.05 * s, 1.05 * s, 0.38), 0, 0.004, 0));
    return shadowAll(g, true, true);
  }

  /* ---------- olive ---------- */

  function olive(seed = 5, s = 1.15) {
    const g = new THREE.Group(), rnd = seeded(seed);
    const pot = makePot('cyl', s, 'pebble');
    g.add(pot.group);
    const y0 = pot.soilY;
    const bark = barkMat('olive', '#7a7369', '#4d473f', '#a39b8f', 55);
    // two stems twisting round each other, up to where the crown opens
    const top = V(0.03 * s, y0 + 0.66 * s, 0.01 * s);
    for (const ph of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6, a = ph + k * 3.4, rr = 0.016 * s * Math.sin(Math.PI * Math.min(1, k * 1.15));
        pts.push(V(mix(0, top.x, k) + Math.cos(a) * rr, mix(y0 - 0.03 * s, top.y, k), mix(0, top.z, k) + Math.sin(a) * rr));
      }
      g.add(new THREE.Mesh(taperTube(pts, 0.024 * s, 0.017 * s, { flare: 0.45, seg: 20, radial: 9 }), bark));
    }
    // the crown: limbs, branches and twigs, kept within the old canopy's reach
    const sticks = [], twigs = [];
    function grow(p, dir, len, r, depth) {
      const pts = [p.clone()];
      let c = p.clone();
      const d = dir.clone();
      for (let i = 0; i < 3; i++) {
        d.add(V((rnd() - 0.5) * 0.45, (rnd() - 0.35) * 0.25 + 0.08, (rnd() - 0.5) * 0.45)).normalize();
        c = c.clone().addScaledVector(d, len / 3);
        pts.push(c);
      }
      sticks.push({ pts, r0: r, r1: r * 0.66 });
      if (depth === 0) {
        twigs.push(pts);
        return;
      }
      const kids = 3;
      for (let k = 0; k < kids; k++) {
        const yaw = Math.atan2(d.x, d.z) + (k - 1) * 0.85 + (rnd() - 0.5) * 0.4;
        const el = clamp(Math.asin(clamp(d.y, -1, 1)) * 0.55 + 0.2 + rnd() * 0.35, -0.2, 1.2);
        grow(c, V(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)), len * (0.6 + rnd() * 0.12), r * 0.6, depth - 1);
      }
      // short side twigs along the branch carry leaves too
      if (depth === 1)
        for (let k = 0; k < 2; k++) {
          const q = new THREE.CatmullRomCurve3(pts).getPointAt(0.35 + k * 0.3);
          const yaw = Math.atan2(d.x, d.z) + (k ? 1.4 : -1.4) + (rnd() - 0.5) * 0.5;
          const el = 0.25 + rnd() * 0.4;
          const tp = [q, q.clone().add(V(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(len * 0.38))];
          tp.splice(1, 0, tp[0].clone().lerp(tp[1], 0.5).add(V(0, 0.01 * s, 0)));
          sticks.push({ pts: tp, r0: r * 0.45, r1: r * 0.3 });
          twigs.push(tp);
        }
    }
    for (let b = 0; b < 4; b++) {
      const yaw = b * 1.62 + rnd() * 0.5, el = 0.6 + rnd() * 0.3;
      grow(top, V(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)), 0.3 * s, 0.014 * s, 2);
    }
    // keep the crown inside the old canopy's radius
    let far = 0;
    for (const t of twigs) for (const p of t) far = Math.max(far, Math.hypot(p.x - top.x, p.z - top.z));
    const reach = 0.42 * s, kk = far > reach ? reach / far : 1;
    const squeeze = p => p.set(top.x + (p.x - top.x) * kk, p.y, top.z + (p.z - top.z) * kk);
    for (const st of sticks) st.pts.forEach(squeeze);
    for (const st of sticks) {
      const m = new THREE.Mesh(taperTube(st.pts, st.r0, st.r1, { seg: 6, radial: 6 }), bark);
      m.userData.noCollide = true; // inside the footprint
      g.add(m);
    }
    // leaves in opposite pairs along every twig, and a tuft at each tip
    const leaves = [];
    const addLeaf = (p, d, sc) => {
      const silver = rnd() < 0.42;
      const b = 0.9 + rnd() * 0.16;
      leaves.push({ p, ...aim(d), rz: (rnd() - 0.5) * 1.2, s: sc, c: silver ? tint(1.22 * b, 1.25 * b, 1.18 * b) : tint(0.74 * b, 0.8 * b, 0.7 * b) });
    };
    for (const t of twigs) {
      const cv = new THREE.CatmullRomCurve3(t);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const k = 0.18 + (i / (n - 1)) * 0.78;
        const p = cv.getPointAt(k), tan = cv.getTangentAt(k);
        let side = new THREE.Vector3().crossVectors(tan, UP);
        if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
        side.normalize();
        for (const sd of [-1, 1]) {
          const d = tan.clone().multiplyScalar(0.55).addScaledVector(side, sd * 0.8).add(V((rnd() - 0.5) * 0.3, 0.25 + rnd() * 0.25, (rnd() - 0.5) * 0.3)).normalize();
          addLeaf(p.clone(), d, (0.85 + rnd() * 0.3) * s);
        }
      }
      const tip = cv.getPointAt(1), tan = cv.getTangentAt(1);
      for (let k = 0; k < 3; k++) addLeaf(tip.clone(), tan.clone().add(V((rnd() - 0.5) * 0.7, 0.2 + rnd() * 0.3, (rnd() - 0.5) * 0.7)).normalize(), (0.7 + rnd() * 0.25) * s);
    }
    const geo = once('geo:olive', () => blade('lance', 0.062, 0.012, { segL: 6, segW: 2, fold: 0.25, cup: 0.1, arch: 0.05, droop: 0.06 }));
    const tex = paint('olive', { shape: 'lance', w: 48, h: 192, base: '#8a977a', mid: '#7f8d6f', tip: '#77856a', vein: 'rgba(225,232,210,0.2)', veins: 0, midrib: 'rgba(214,222,198,0.55)', midW: 2, edge: 'rgba(255,255,255,0.12)', edgeW: 2, mottle: 0.6, blot: 2 });
    g.add(instanced(geo, leafMat('olive', tex, { rough: 0.72, glow: 0.05, env: 0.4 }), leaves));
    footprint(g, 0.45 * s, y0 + 0.5 * s, y0 + 1.3 * s, top.x, top.z);
    g.add(placed(contactShadow(1.0 * s, 1.0 * s, 0.38), 0, 0.004, 0));
    return shadowAll(g, true, true);
  }

  /* ---------- mophead hydrangea ---------- */

  const FLORET = () =>
    once('geo:floret', () => {
      const petal = blade('round', 0.0132, 0.0124, { segL: 2, segW: 2, fold: 0.05, cup: 0.32, arch: 0.08, droop: 0.04 });
      const parts = [];
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Matrix4().makeRotationY(k * HALF_PI + 0.2).multiply(new THREE.Matrix4().makeRotationX(-0.32)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0012));
        parts.push({ geo: petal, m, color: (u, v) => [mix(0.9, 1, Math.min(1, v * 2.2)), mix(0.95, 1, Math.min(1, v * 2.2)), mix(0.86, 1, Math.min(1, v * 2.2))] });
      }
      const eye = new THREE.OctahedronGeometry(0.0017, 0);
      parts.push({ geo: eye, m: new THREE.Matrix4().makeTranslation(0, 0.0012, 0), color: () => [0.78, 0.86, 0.7] });
      return mergeParts(parts);
    });

  function hydrangeaHead(center, axis, R, rnd, florets, cores) {
    const q0 = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().normalize());
    const N = Math.round(66 * (R / 0.085) * (R / 0.085)) + 22;
    const maxPolar = 1.95;
    for (let i = 0; i < N; i++) {
      const cosT = 1 - ((i + 0.5) / N) * (1 - Math.cos(maxPolar));
      const sinT = Math.sqrt(1 - cosT * cosT), ph = i * 2.39996;
      const n = V(sinT * Math.cos(ph), cosT, sinT * Math.sin(ph)).applyQuaternion(q0);
      const p = center.clone().addScaledVector(n, R * (0.97 + rnd() * 0.07));
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * TAU));
      const low = cosT < -0.1;
      const b = 0.9 + rnd() * 0.1, r = rnd();
      const c = low ? tint(0.82 * b, 0.88 * b, 0.78 * b) : r < 0.16 ? tint(0.92 * b, 0.97 * b, 0.84 * b) : r < 0.26 ? tint(0.9 * b, 0.94 * b, 1.0 * b) : tint(b, b, b * 0.98);
      florets.push({ p, q, s: (0.95 + rnd() * 0.3) * (R / 0.082), c });
    }
    cores.push({ p: center.clone(), q: q0, s: R * 0.88 });
  }

  function bloom(seed = 3, s = 1.05, potKind = 'tall') {
    const g = new THREE.Group(), rnd = seeded(seed);
    const pot = makePot(potKind, s, 'moss');
    g.add(pot.group);
    const y0 = pot.soilY;
    const florets = [], cores = [], leaves = [], stems = [];
    const addLeaf = (p, d, sc, k = 0) => {
      const b = 0.9 + rnd() * 0.14;
      leaves.push({ p, ...aim(d), rz: (rnd() - 0.5) * 0.5, s: sc, c: tint(b * (0.96 + k * 0.08), b, b * 0.94) });
    };
    /** A stem from the soil, arching out to a head, with leaves in opposite pairs along it. */
    const stemTo = (b0, c, axis, R, k, pairs) => {
      const end = c.clone().addScaledVector(axis, -R * 0.85);
      const mid = b0.clone().lerp(end, 0.45).add(V(0, 0.05 * k, 0));
      stems.push([b0, mid, end]);
      const cv = new THREE.CatmullRomCurve3([b0, mid, end]);
      for (const kk of pairs) {
        const p = cv.getPointAt(kk), tan = cv.getTangentAt(kk);
        let side = new THREE.Vector3().crossVectors(tan, UP);
        if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
        side.normalize().applyAxisAngle(tan, rnd() * 0.8);
        for (const sd of [-1, 1]) addLeaf(p.clone(), side.clone().multiplyScalar(sd).add(V(0, 0.1 + rnd() * 0.25, 0)).normalize(), (0.85 + rnd() * 0.25) * k, kk);
      }
    };
    if (potKind === 'bowl' && s < 0.6) {
      // a coffee-table bowl: three cut heads sitting low, leaves tucked round the rim
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + rnd() * 0.4;
        const c = V(Math.cos(a) * 0.05, y0 + 0.035 + rnd() * 0.012, Math.sin(a) * 0.05);
        hydrangeaHead(c, V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 0.06 * (0.9 + rnd() * 0.15), rnd, florets, cores);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + (rnd() - 0.5) * 0.6;
        addLeaf(V(Math.cos(a) * 0.055, y0 + 0.01 + rnd() * 0.012, Math.sin(a) * 0.055), V(Math.cos(a + (rnd() - 0.5) * 0.5), -0.35 + rnd() * 0.35, Math.sin(a + (rnd() - 0.5) * 0.5)).normalize(), 0.62 * (0.75 + rnd() * 0.4));
      }
    } else if (potKind === 'bowl') {
      // a low mound in a floor bowl: a crown of heads over a skirt of leaves
      const k = s / 0.8;
      const heads = [{ a: 0, rr: 0.01, h: 0.29 }];
      for (let i = 0; i < 5; i++) heads.push({ a: (i / 5) * TAU + rnd() * 0.4, rr: 0.115, h: 0.18 + rnd() * 0.05 });
      for (const hd of heads) {
        const R = 0.08 * k * (0.9 + rnd() * 0.15);
        const c = V(Math.cos(hd.a) * hd.rr * k, y0 + hd.h * k, Math.sin(hd.a) * hd.rr * k);
        const b0 = V(Math.cos(hd.a) * 0.025 * k, y0 - 0.01, Math.sin(hd.a) * 0.025 * k);
        const axis = c.clone().sub(b0).normalize().lerp(UP, 0.5).normalize();
        hydrangeaHead(c, axis, R, rnd, florets, cores);
        stemTo(b0, c, axis, R, k, [0.5, 0.8]);
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + (rnd() - 0.5) * 0.5, rr = 0.07 + rnd() * 0.05;
        addLeaf(V(Math.cos(a) * rr * k, y0 + (0.03 + rnd() * 0.06) * k, Math.sin(a) * rr * k), V(Math.cos(a + (rnd() - 0.5) * 0.6), -0.3 + rnd() * 0.5, Math.sin(a + (rnd() - 0.5) * 0.6)).normalize(), (0.7 + rnd() * 0.45) * k);
      }
      footprint(g, 0.26 * k, y0, y0 + 0.38 * k);
    } else {
      // a bush: stems rise from the soil and arch out to the heads; leaves in opposite pairs along them
      const k = s / 1.05;
      const heads = [{ a: 0, rr: 0.02, h: 0.41 }];
      for (let i = 0; i < 5; i++) heads.push({ a: (i / 5) * TAU + rnd() * 0.5, rr: 0.15 + rnd() * 0.04, h: 0.3 + rnd() * 0.06 });
      for (let i = 0; i < 2; i++) heads.push({ a: i * Math.PI + 1.0 + rnd() * 0.6, rr: 0.21, h: 0.19 + rnd() * 0.04 });
      for (const hd of heads) {
        const R = (0.078 + rnd() * 0.016) * k;
        const c = V(Math.cos(hd.a) * hd.rr * k, y0 + hd.h * k, Math.sin(hd.a) * hd.rr * k);
        const b0 = V(Math.cos(hd.a) * 0.03 * k, y0 - 0.01, Math.sin(hd.a) * 0.03 * k);
        const axis = c.clone().sub(b0).normalize().lerp(UP, 0.45).normalize();
        hydrangeaHead(c, axis, R, rnd, florets, cores);
        stemTo(b0, c, axis, R, k, [0.32, 0.52, 0.7, 0.86]);
      }
      // low leaves spilling over the rim hide the stems' feet
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + rnd() * 0.4;
        addLeaf(V(Math.cos(a) * 0.07 * k, y0 + 0.03 * k, Math.sin(a) * 0.07 * k), V(Math.cos(a), 0.1 + rnd() * 0.2, Math.sin(a)).normalize(), (0.95 + rnd() * 0.2) * k);
      }
      footprint(g, 0.32 * k, y0 + 0.02, y0 + 0.5 * k);
    }
    const sm = stemMat('hydrangea', '#56703f');
    for (const st of stems) {
      const m = new THREE.Mesh(taperTube(st, 0.0055, 0.0038, { seg: 8, radial: 6 }), sm);
      m.userData.noCollide = true; // inside the footprint
      g.add(m);
    }
    const ptex = paint('hydrangea-petal', { shape: 'round', w: 64, h: 64, stops: [[0, '#e8ecdd'], [0.35, '#f6f5f0'], [1, '#fcfbf8']], parallel: 5, pvein: 'rgba(160,170,150,0.12)', pveinW: 0.7, mottle: 0.3, blot: 1.5 });
    g.add(instanced(FLORET(), leafMat('floret', ptex, { rough: 0.8, glow: 0.08, vc: true, env: 0.4 }), florets, { shadow: false }));
    const coreM = once('mat:hcore', () => new THREE.MeshStandardMaterial({ color: lin('#e4e6dc'), roughness: 0.92, metalness: 0, envMapIntensity: 0.3, fog: false }));
    const coreGeo = once('geo:hcore', () => new THREE.SphereGeometry(1, 14, 10));
    g.add(instanced(coreGeo, coreM, cores));
    const lgeo = once('geo:hleaf', () => blade('ovate', 0.13, 0.078, { segL: 8, segW: 4, fold: 0.14, cup: 0.08, arch: 0.04, droop: 0.24, wave: 0.008, waves: 9 }));
    const ltex = paint('hydrangea-leaf', { shape: 'ovate', w: 128, h: 192, base: '#4f7d3b', mid: '#3e6a2f', tip: '#38622b', vein: 'rgba(170,205,130,0.4)', fine: 'rgba(170,205,130,0.14)', veins: 8, rise: 0.17, bow: 0.4, veinW: 1.3, midrib: 'rgba(206,228,170,0.75)', midW: 3.5, edge: 'rgba(30,52,22,0.45)', edgeW: 2.5, mottle: 1, extra: serrate(18) });
    g.add(instanced(lgeo, leafMat('hydrangea-leaf', ltex, { rough: 0.66, glow: 0.04 }), leaves));
    if (!(potKind === 'bowl' && s < 0.6)) g.add(placed(contactShadow(0.85 * s, 0.85 * s, 0.38), 0, 0.004, 0));
    return shadowAll(g, true, true);
  }

  /** Painted teeth along a leaf's margin (hydrangea, rose). */
  function serrate(n) {
    return (x, W, H, Y, half) => {
      x.fillStyle = 'rgba(28,48,20,0.55)';
      for (const sd of [-1, 1])
        for (let i = 1; i < n; i++) {
          const t = i / n, px = W / 2 + sd * half(t), py = Y(t);
          x.beginPath();
          x.moveTo(px, py);
          x.lineTo(px - sd * 3.5, py + 4);
          x.lineTo(px - sd * 1.2, py - 3.5);
          x.closePath();
          x.fill();
        }
    };
  }

  /* ---------- phalaenopsis orchid ---------- */

  const ORCHID_FLOWER = () =>
    once('geo:orchid-flower', () => {
      const D = 0.058;
      const petal = blade('round', 0.5 * D, 0.5 * D, { segL: 6, segW: 4, fold: 0.04, cup: 0.22, arch: 0.02, droop: -0.03 });
      const sepal = blade('sepal', 0.5 * D, 0.27 * D, { segL: 6, segW: 2, fold: 0.12, cup: 0.25, arch: 0.02, droop: 0.02 });
      const lip = blade('lip', 0.3 * D, 0.22 * D, { segL: 5, segW: 2, fold: 0.25, cup: 0.7, arch: 0.04, droop: -0.06 });
      // a part lies along +Z face up; turn it to stand in the flower's plane (face +Z), pointing `ang` clockwise from up
      const part = (geo, ang, tilt, z, color) => ({
        geo,
        m: new THREE.Matrix4()
          .makeTranslation(0, 0, z)
          .multiply(new THREE.Matrix4().makeRotationZ(-ang))
          .multiply(new THREE.Matrix4().makeRotationX(tilt))
          .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
          .multiply(new THREE.Matrix4().makeRotationX(-HALF_PI)),
        color,
      });
      const white = (u, v) => {
        const k = Math.max(0, 1 - v * 3.2);
        return [1 - 0.04 * k, 1 - 0.17 * k, 1 - 0.1 * k];
      };
      const pink = (u, v) => [0.93 + 0.07 * v, 0.66 + 0.26 * v, 0.76 + 0.18 * v];
      const parts = [
        part(sepal, 0, 0.12, 0, white),
        part(sepal, 2.55, 0.12, 0, white),
        part(sepal, -2.55, 0.12, 0, white),
        part(petal, 1.32, 0.16, 0.0015, white),
        part(petal, -1.32, 0.16, 0.0015, white),
        part(lip, Math.PI, 0.75, 0.004, pink),
      ];
      const col = new THREE.CylinderGeometry(0.0022, 0.0028, 0.009, 8);
      parts.push({ geo: col, m: new THREE.Matrix4().makeTranslation(0, 0.003, 0.004).multiply(new THREE.Matrix4().makeRotationX(0.5)), color: () => [0.97, 0.94, 0.95] });
      return mergeParts(parts);
    });

  function orchid(s = 1.4) {
    const g = new THREE.Group(), rnd = seeded(77);
    const pot = makePot('small', s, 'bark');
    g.add(pot.group);
    const y0 = pot.soilY;
    const k = s / 1.4;
    // broad leaves from the crown, arching over the rim
    const leaves = [];
    [[0.15, 0.45, 1], [Math.PI + 0.05, 0.4, 0.96], [1.05, 0.34, 0.88], [Math.PI + 1.15, 0.3, 0.82], [2.1, 0.5, 0.62]].forEach(([yaw, el, sc], i) => {
      leaves.push({ p: V(0, y0 + 0.004 * i * k, 0), ry: yaw, rx: -el, rz: (rnd() - 0.5) * 0.3, s: sc * k, c: tint(0.95 + rnd() * 0.1, 1, 0.95) });
    });
    const lgeo = once('geo:orchid-leaf', () => blade('broad', 0.17, 0.062, { segL: 10, segW: 4, fold: 0.22, cup: 0.12, arch: 0.07, droop: 0.34 }));
    const ltex = paint('orchid-leaf', { shape: 'broad', w: 96, h: 256, base: '#4a7a3c', mid: '#33602b', tip: '#2f5a28', parallel: 7, pvein: 'rgba(170,205,140,0.16)', pveinW: 0.9, midrib: 'rgba(20,45,18,0.3)', midW: 4, edge: 'rgba(20,40,16,0.4)', edgeW: 2, mottle: 0.8 });
    g.add(instanced(lgeo, leafMat('orchid-leaf', ltex, { rough: 0.36, coat: 0.55, glow: 0.04 }), leaves));
    // the stake and the spike, arching forward at the top
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.0016 * k, 0.0016 * k, 0.24 * k, 6), stemMat('stake', '#8d8a78', 0.7));
    stake.position.set(-0.008 * k, y0 + 0.12 * k, -0.006 * k);
    g.add(stake);
    const sp = [V(0.002 * k, y0, 0), V(-0.005 * k, y0 + 0.11 * k, -0.003 * k), V(-0.005 * k, y0 + 0.22 * k, -0.003 * k), V(0.016 * k, y0 + 0.285 * k, 0.006 * k), V(0.056 * k, y0 + 0.307 * k, 0.014 * k), V(0.097 * k, y0 + 0.29 * k, 0.02 * k), V(0.128 * k, y0 + 0.252 * k, 0.022 * k)];
    g.add(new THREE.Mesh(taperTube(sp, 0.0032 * k, 0.0019 * k, { seg: 28, radial: 6 }), stemMat('spike', '#5d6a43')));
    const cv = new THREE.CatmullRomCurve3(sp);
    const flowers = [], buds = [];
    const front = V(0.1, -0.08, 1).normalize();
    [0.46, 0.56, 0.66, 0.76, 0.85].forEach((t, i) => {
      const p = cv.getPointAt(t), tan = cv.getTangentAt(t);
      const yaw = (i % 2 ? 0.28 : -0.22) + (rnd() - 0.5) * 0.12;
      const n = front.clone().applyAxisAngle(UP, yaw).normalize();
      const pos = p.clone().addScaledVector(n, 0.01 * k).add(V(0, -0.02 * k, 0));
      // face +Z → n; the flower's up leans with the spike
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), n.clone().negate(), V(0, 1, 0).addScaledVector(tan, 0.25).normalize());
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      flowers.push({ p: pos, q, s: (1.08 - i * 0.05) * k * (0.97 + rnd() * 0.06) });
    });
    [0.93, 0.985].forEach((t, i) => {
      const p = cv.getPointAt(t);
      buds.push({ p: p.clone().add(V(0, -0.008 * k, 0)), q: new THREE.Quaternion().setFromUnitVectors(UP, cv.getTangentAt(t)), sx: 0.008 * k * (1 - i * 0.3), sy: 0.012 * k * (1 - i * 0.3), sz: 0.008 * k * (1 - i * 0.3) });
    });
    const ftex = paint('orchid-petal', { shape: 'round', w: 64, h: 64, stops: [[0, '#f3eef0'], [0.4, '#fbfafa'], [1, '#ffffff']], parallel: 9, pvein: 'rgba(205,170,190,0.16)', pveinW: 0.6, mottle: 0.2, blot: 1 });
    g.add(instanced(ORCHID_FLOWER(), leafMat('orchid-flower', ftex, { rough: 0.55, glow: 0.12, vc: true, env: 0.45 }), flowers));
    g.add(instanced(once('geo:bud', () => new THREE.SphereGeometry(1, 10, 8)), stemMat('bud', '#e9eadc', 0.6), buds));
    // a few silvery aerial roots over the rim
    const rootM = stemMat('root', '#aebaa6', 0.75);
    for (let i = 0; i < 2; i++) {
      const a = 2.4 + i * 2.3 + rnd() * 0.4, R = pot.rimR;
      const pts = [V(Math.cos(a) * R * 0.35, y0 + 0.004, Math.sin(a) * R * 0.35), V(Math.cos(a) * R * 0.9, y0 + 0.02 * k, Math.sin(a) * R * 0.9), V(Math.cos(a + 0.1) * (R + 0.012 * k), y0 + 0.012 * k, Math.sin(a + 0.1) * (R + 0.012 * k)), V(Math.cos(a + 0.25) * (R + 0.02 * k), y0 - 0.012 * k, Math.sin(a + 0.25) * (R + 0.02 * k)), V(Math.cos(a + 0.42) * (R + 0.016 * k), y0 - 0.028 * k - rnd() * 0.01 * k, Math.sin(a + 0.42) * (R + 0.016 * k))];
      g.add(new THREE.Mesh(taperTube(pts, 0.0032 * k, 0.0025 * k, { seg: 10, radial: 6 }), rootM));
    }
    return shadowAll(g, true, true);
  }

  /* ---------- roses in the white-oak vase ---------- */

  const ROSE_HEAD = () =>
    once('geo:rose', () => {
      const S = 0.74, N = 17, segU = 6, segV = 6;
      const pos = [], col = [], uv = [], idx = [];
      let base = 0;
      for (let k = 0; k < N; k++) {
        const f = k / (N - 1);
        const phi0 = k * 2.39996;
        const halfW = mix(1.8, 0.95, f);
        const h = mix(0.017, 0.022, f) * S;
        const open = mix(0.06, 1.1, Math.pow(f, 1.3));
        const r0 = mix(0.0012, 0.006, f) * S;
        const reflex = mix(0, 0.008, f * f) * S;
        const lift = mix(0.0045, 0, f) * S;
        for (let j = 0; j <= segV; j++) {
          const v = j / segV;
          for (let i = 0; i <= segU; i++) {
            const u = (i / segU) * 2 - 1;
            const vv = v * (1 - 0.14 * u * u);
            const w = halfW * (0.42 + 0.58 * Math.sin(Math.min(1, vv * 1.2) * HALF_PI));
            const a = phi0 + u * w;
            const rr = r0 + Math.sin(open) * h * vv + reflex * vv * vv * vv + 0.0012 * S * (1 - u * u) * vv;
            const y = lift + Math.cos(open) * h * vv - reflex * 0.5 * vv * vv * vv;
            pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
            const shade = mix(0.38, 1, Math.pow(vv, 0.7)) * mix(0.72, 1, f);
            col.push(shade, shade, shade);
            uv.push((u + 1) / 2, vv);
          }
        }
        for (let j = 0; j < segV; j++)
          for (let i = 0; i < segU; i++) {
            const a = base + j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
            idx.push(a, b, c, b, d, c);
          }
        base += (segU + 1) * (segV + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    });

  function roses() {
    const g = new THREE.Group();
    // the vase: white oak, lobed and twisting as it rises
    const prof = [[0.0006, 0], [0.034, 0.0], [0.05, 0.03], [0.054, 0.065], [0.04, 0.11], [0.028, 0.14], [0.036, 0.165], [0.0006, 0.166]];
    const geo = latheFromProfile(prof, 40, 48);
    const pa = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      const r = Math.hypot(v.x, v.z), a = Math.atan2(v.z, v.x), k = v.y / 0.166;
      const lobe = 1 + 0.16 * Math.sin(3 * a + k * 5.5) * Math.sin(k * Math.PI);
      const tw = a + k * 1.9;
      pa.setXYZ(i, Math.cos(tw) * r * lobe, v.y, Math.sin(tw) * r * lobe);
    }
    geo.computeVertexNormals();
    const oakV = MAT.oak.clone();
    oakV.map = OAK_TEX.clone();
    oakV.map.needsUpdate = true;
    oakV.map.center.set(0.5, 0.5);
    oakV.map.rotation = HALF_PI * 0.8;
    oakV.map.repeat.set(0.6, 0.6);
    oakV.side = THREE.DoubleSide;
    g.add(new THREE.Mesh(geo, oakV));
    // seven stems, each a rose, two leaf sprays per stem
    const rnd = seeded(5);
    const heads = [], sepals = [], leaflets = [], rachis = [];
    const stemM = stemMat('rose-stem', '#3e5a2c', 0.55);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rnd() * 0.45;
      const out = i === 0 ? 0.004 : 0.03 + rnd() * 0.03;
      const base = V(Math.cos(a) * 0.008, 0.15, Math.sin(a) * 0.008);
      const tip = V(Math.cos(a) * out, (i === 0 ? 0.33 : 0.27 + rnd() * 0.05), Math.sin(a) * out);
      const mid = base.clone().lerp(tip, 0.5).add(V(Math.cos(a) * 0.006, 0, Math.sin(a) * 0.006));
      g.add(new THREE.Mesh(taperTube([base, mid, tip], 0.0026, 0.0021, { seg: 8, radial: 5 }), stemM));
      const axis = tip.clone().sub(base).normalize().lerp(UP, 0.5).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, axis).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * TAU));
      heads.push({ p: tip.clone().addScaledVector(axis, 0.002), q, s: 0.92 + rnd() * 0.16 });
      for (let k = 0; k < 5; k++) {
        const sa = (k / 5) * TAU + rnd() * 0.3;
        const d = V(Math.cos(sa), -0.55, Math.sin(sa)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, axis)).normalize();
        sepals.push({ p: tip.clone(), ...aim(d), s: 0.85 + rnd() * 0.3 });
      }
      // leaf sprays partway up the stem: a terminal leaflet and two pairs
      for (const kk of [0.3, 0.52, 0.74]) {
        if (rnd() < 0.2) continue;
        const p = new THREE.CatmullRomCurve3([base, mid, tip]).getPointAt(kk);
        const side = rnd() * TAU;
        const d = V(Math.cos(side), 0.15 + rnd() * 0.2, Math.sin(side)).normalize();
        const rach = p.clone().addScaledVector(d, 0.016);
        rachis.push([p.clone(), rach.clone()]);
        leaflets.push({ p: rach.clone(), ...aim(d.clone().add(V(0, -0.15, 0)).normalize()), rz: (rnd() - 0.5) * 0.4, s: 1.05 * (0.9 + rnd() * 0.2) });
        for (const [off, sc] of [[0.35, 0.85], [0.7, 0.75]]) {
          const q = p.clone().addScaledVector(d, 0.016 * (1 - off));
          for (const sd of [-1, 1]) {
            const dd = d.clone().applyAxisAngle(UP, sd * 1.05).add(V(0, -0.12, 0)).normalize();
            leaflets.push({ p: q.clone(), ...aim(dd), rz: (rnd() - 0.5) * 0.4, s: sc * (0.9 + rnd() * 0.2) });
          }
        }
      }
    }
    const ptex = paint('rose-petal', { shape: 'round', w: 64, h: 64, stops: [[0, '#cfcfcf'], [0.5, '#f0f0f0'], [1, '#ffffff']], parallel: 9, pvein: 'rgba(0,0,0,0.07)', pveinW: 0.6, mottle: 1.4, blot: 1.2 });
    const roseM = once('mat:rose', () => new THREE.MeshStandardMaterial({ map: ptex, color: lin('#a70008').multiplyScalar(0.62), roughness: 0.56, metalness: 0, vertexColors: true, side: THREE.DoubleSide, envMapIntensity: 0.32, fog: false, emissive: lin('#a70008').multiplyScalar(0.05) }));
    g.add(instanced(ROSE_HEAD(), roseM, heads));
    const sgeo = once('geo:sepal', () => blade('point', 0.014, 0.005, { segL: 4, segW: 2, fold: 0.2, cup: 0.1, arch: 0.02, droop: 0.25 }));
    const leafTexR = paint('rose-leaf', { shape: 'ovate', w: 64, h: 96, base: '#3f6533', mid: '#33592c', tip: '#2f5329', vein: 'rgba(170,200,140,0.4)', veins: 6, rise: 0.15, veinW: 1, midrib: 'rgba(180,210,150,0.6)', midW: 2, edge: 'rgba(20,36,16,0.5)', edgeW: 2, mottle: 0.8, extra: serrate(12) });
    const rlm = leafMat('rose-leaf', leafTexR, { rough: 0.45, coat: 0.3, glow: 0.06 });
    g.add(instanced(sgeo, rlm, sepals));
    g.add(stalks(rachis, 0.0011, stemM));
    g.add(instanced(once('geo:rose-leaflet', () => blade('ovate', 0.03, 0.018, { segL: 6, segW: 2, fold: 0.18, cup: 0.06, arch: 0.04, droop: 0.12 })), rlm, leaflets));
    return shadowAll(g, true, true);
  }

  /* ---------- desk plants ---------- */

  function desk(seed = 1) {
    const kind = ['echeveria', 'pothos', 'zz'][seed % 3];
    const g = new THREE.Group(), rnd = seeded(seed * 17 + 3);
    const pot = makePot('desk', 1, kind === 'echeveria' ? 'grit' : 'soil', seed % 2 ? 'matte' : 'concrete');
    g.add(pot.group);
    const y0 = pot.soilY;
    if (kind === 'echeveria') {
      // a rosette of fleshy, blue-green spoons in a spiral
      const leaves = [];
      const rings = [[13, 1, 0.2, 0.012], [10, 0.86, 0.55, 0.008], [7, 0.68, 0.9, 0.005], [5, 0.48, 1.2, 0.002]];
      let ph = 0;
      rings.forEach(([n, sc, el, r]) => {
        for (let i = 0; i < n; i++) {
          const a = ph + (i / n) * TAU + (rnd() - 0.5) * 0.15;
          leaves.push({ p: V(Math.cos(a) * r, y0 + 0.003 + (1 - sc) * 0.012, Math.sin(a) * r), ry: Math.atan2(Math.cos(a), Math.sin(a)), rx: -el, rz: (rnd() - 0.5) * 0.15, s: sc * (0.95 + rnd() * 0.1) });
        }
        ph += 0.4;
      });
      const geo = once('geo:echeveria', () => blade('spoon', 0.034, 0.016, { segL: 7, segW: 4, fold: 0.42, cup: 0.38, arch: 0.06, droop: -0.04 }));
      const tex = paint('echeveria', { shape: 'spoon', w: 48, h: 96, base: '#a9c3b2', mid: '#a2bcac', tip: '#97b3a3', edge: 'rgba(132,104,130,0.45)', edgeW: 2, mottle: 0.4, blot: 2 });
      g.add(instanced(geo, leafMat('echeveria', tex, { rough: 0.62, glow: 0.12 }), leaves));
    } else if (kind === 'pothos') {
      // heart-shaped leaves round the crown, two vines trailing over the rim
      const leaves = [], pets = [];
      for (let i = 0; i < 12; i++) {
        const a = i * 2.39996 + rnd() * 0.3, el = 0.2 + rnd() * 0.5;
        const p = V(Math.cos(a) * 0.012, y0 + 0.01 + rnd() * 0.03, Math.sin(a) * 0.012);
        const d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
        const b = p.clone().addScaledVector(d, 0.018);
        pets.push([p, b]);
        leaves.push({ p: b, ...aim(d.clone().add(V(0, -0.35, 0)).normalize()), rz: (rnd() - 0.5) * 0.4, s: 0.85 + rnd() * 0.3 });
      }
      for (const a of [0.9 + rnd() * 0.3, 3.6 + rnd() * 0.3]) {
        const R = pot.rimR;
        const vine = [V(Math.cos(a) * 0.02, y0 + 0.006, Math.sin(a) * 0.02), V(Math.cos(a) * (R + 0.004), y0 + 0.014, Math.sin(a) * (R + 0.004)), V(Math.cos(a) * (R + 0.011), y0 - 0.022, Math.sin(a) * (R + 0.011)), V(Math.cos(a + 0.08) * (R + 0.02), 0.006, Math.sin(a + 0.08) * (R + 0.02)), V(Math.cos(a + 0.2) * (R + 0.042), 0.004, Math.sin(a + 0.2) * (R + 0.042))];
        g.add(new THREE.Mesh(taperTube(vine, 0.0018, 0.0014, { seg: 10, radial: 5 }), stemMat('pothos-vine', '#5b7a3a')));
        const cv = new THREE.CatmullRomCurve3(vine);
        for (const t of [0.28, 0.5, 0.74, 0.97]) {
          const p = cv.getPointAt(t);
          const outw = V(Math.cos(a + 0.3 * t), 0, Math.sin(a + 0.3 * t));
          // down the pot's side, then lying along the desk
          const d = outw.clone().add(V(0, p.y > 0.02 ? -0.6 : 0.08, 0)).normalize();
          leaves.push({ p: p.clone().add(V(0, 0.004, 0)), ...aim(d), rz: (rnd() - 0.5) * 0.4, s: 0.6 + rnd() * 0.25 });
        }
      }
      const geo = once('geo:pothos', () => blade('heart', 0.042, 0.032, { segL: 8, segW: 4, fold: 0.16, cup: 0.08, arch: 0.05, droop: 0.12 }));
      const tex = paint('pothos', { shape: 'heart', w: 96, h: 128, base: '#3f7832', mid: '#326a2b', tip: '#2e6328', vein: 'rgba(180,215,140,0.35)', veins: 5, rise: 0.24, bow: 0.3, veinW: 1.2, midrib: 'rgba(196,226,160,0.6)', midW: 3, edge: 'rgba(22,44,18,0.35)', edgeW: 2, mottle: 1,
        extra: (x, W, H, Y, half, r) => { for (let i = 0; i < 9; i++) { x.strokeStyle = 'rgba(214,232,196,0.22)'; x.lineWidth = 2 + r() * 3; const t = 0.1 + r() * 0.8; x.beginPath(); x.moveTo(W / 2 + (r() - 0.5) * half(t), Y(t)); x.lineTo(W / 2 + (r() - 0.5) * half(t) * 1.6, Y(t + 0.08 + r() * 0.1)); x.stroke(); } } });
      g.add(instanced(geo, leafMat('pothos', tex, { rough: 0.42, coat: 0.4, glow: 0.04 }), leaves));
      g.add(stalks(pets, 0.0013, stemMat('pothos-vine', '#5b7a3a')));
    } else {
      // ZZ: upright stems of glossy leaflets in pairs
      const leaflets = [];
      const sm = stemMat('zz', '#3d5a2a', 0.5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rnd() * 0.5, lean = 0.15 + rnd() * 0.3, L = 0.15 + rnd() * 0.06;
        const b = V(Math.cos(a) * 0.008, y0 - 0.002, Math.sin(a) * 0.008);
        const dir = V(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
        const tip = b.clone().addScaledVector(dir, L).add(V(Math.cos(a) * 0.012, -0.008, Math.sin(a) * 0.012));
        const mid = b.clone().lerp(tip, 0.5).addScaledVector(dir, 0.004);
        g.add(new THREE.Mesh(taperTube([b, mid, tip], 0.0034, 0.0016, { seg: 8, radial: 6 }), sm));
        const cv = new THREE.CatmullRomCurve3([b, mid, tip]);
        for (let k = 0; k < 7; k++) {
          const t = 0.32 + (k / 6) * 0.66;
          const p = cv.getPointAt(t), tan = cv.getTangentAt(t);
          let side = new THREE.Vector3().crossVectors(tan, UP);
          if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
          side.normalize().applyAxisAngle(tan, (rnd() - 0.5) * 0.4);
          for (const sd of k === 6 ? [0] : [-1, 1]) {
            const d = sd ? side.clone().multiplyScalar(sd).addScaledVector(tan, 0.9).normalize() : tan.clone();
            leaflets.push({ p: p.clone(), ...aim(d), rz: (rnd() - 0.5) * 0.3, s: (0.75 + t * 0.35) * (0.92 + rnd() * 0.15) });
          }
        }
      }
      const geo = once('geo:zz', () => blade('ellip', 0.032, 0.016, { segL: 6, segW: 2, fold: 0.16, cup: 0.14, arch: 0.05, droop: 0.06 }));
      const tex = paint('zz', { shape: 'ellip', w: 48, h: 96, base: '#356329', mid: '#2c5825', tip: '#2b5524', midrib: 'rgba(140,180,110,0.35)', midW: 1.5, edge: 'rgba(15,32,12,0.45)', edgeW: 1.5, mottle: 0.5 });
      g.add(instanced(geo, leafMat('zz', tex, { rough: 0.32, coat: 0.7, glow: 0.05 }), leaflets));
    }
    return shadowAll(g, true, true);
  }

  return { fig, kentia, olive, bloom, orchid, roses, desk };
})();
