/* =============================================================================
   86d · LINE OF SIGHT — nothing stands between Igor and the agent he opened
   -----------------------------------------------------------------------------
   Every view looks into the room through its south side, and the markets band
   runs round the top of all four walls. Opening an agent near the front glided
   the camera to just outside the glass, where the band (and, for agents in the
   back row, other desks and chairs) filled the frame and hid the very robot
   that had been opened (observed in the 9.0 audit: Crimson behind BOND MARKET).

   While an agent is selected, room architecture, furniture and the terrace are
   dissolved — screen-door, no transparency sorting — inside a slim tunnel from
   the camera to that agent, and only there. The robots themselves are never
   patched, so a figure never vanishes; the selected agent's own desk sits in
   the tunnel's last stretch, which is always kept. The tunnel opens and closes
   over a third of a second, and its radius is zero the rest of the time, so the
   office looks exactly as before whenever nothing is selected.
   ============================================================================= */

const XRAY = {
  u: { uCutA: { value: new THREE.Vector3() }, uCutB: { value: new THREE.Vector3() }, uCutR: { value: 0 } },
  patched: new WeakSet(),
  radius: 0,
  _v: new THREE.Vector3(),
  /** Patch every eligible material under obj (idempotent; chains any patch the material already has). */
  patchTree(obj) {
    const figures = new Set(WORLD.figures.map(f => f.root));
    const walk = o => {
      if (figures.has(o) || o.userData.noXray) return; // the robots (and anything they carry) are never dissolved
      if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.patch(m);
      for (const c of o.children) walk(c);
    };
    walk(obj);
  },
  patch(m) {
    if (!m || this.patched.has(m) || m.isShaderMaterial || m.isRawShaderMaterial) return;
    this.patched.add(m);
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    const U = this.u;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      if (!sh.vertexShader.includes('#include <begin_vertex>') || !sh.fragmentShader.includes('#include <clipping_planes_fragment>')) return;
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vXW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 xw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          xw = instanceMatrix * xw;
        #endif
        vXW = (modelMatrix * xw).xyz;`);
      sh.fragmentShader = 'uniform vec3 uCutA;\nuniform vec3 uCutB;\nuniform float uCutR;\nvarying vec3 vXW;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uCutR > 0.001) {
          vec3 ab = uCutB - uCutA;
          float t = clamp(dot(vXW - uCutA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          float d = distance(vXW, uCutA + ab * t);
          float R = uCutR * mix(2.4, 0.85, clamp(t / 0.8, 0.0, 1.0)); // a cone: wide where it leaves the camera, slim at the agent
          float keep = max(smoothstep(R * 0.86, R, d), smoothstep(0.76, 0.84, t));
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (keep < 0.999 && ign > keep) discard;
        }`);
    };
    m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|xray';
    m.needsUpdate = true;
  },
  /** Called every frame: aim the tunnel from the camera at the selected agent's chest, easing its radius. */
  update(dt) {
    const id = typeof UI !== 'undefined' && UI.selected;
    const wb = id && WORLD.byId[id];
    const want = wb ? 1.05 : 0;
    const k = REDUCED_MOTION ? 1 : 1 - Math.exp(-dt * 10);
    this.radius += (want - this.radius) * k;
    if (this.radius < 0.002 && !want) this.radius = 0;
    this.u.uCutR.value = this.radius;
    if (!this.radius) return;
    this.u.uCutA.value.copy(camera.position);
    if (wb) {
      wb.fig.root.getWorldPosition(this._v);
      this._v.y += 0.95;
      this.u.uCutB.value.copy(this._v);
    }
  },
};
