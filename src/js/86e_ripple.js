/* =============================================================================
   86e · RIPPLES — a change of state, seen from across the room
   -----------------------------------------------------------------------------
   When an agent starts waiting on Igor, one crimson ring runs out across the
   floor from its chair; when it finishes a task, one ink ring. Once per change,
   never looping, never for a change the office did not record. Eight pooled
   rings, one draw call each while running, nothing at all at rest.
   ============================================================================= */

const RIPPLE = {
  pool: [],
  last: {},
  init() {
    const geo = new THREE.RingGeometry(0.94, 1, 72, 1);
    geo.rotateX(-HALF_PI);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      m.visible = false;
      m.renderOrder = 2;
      m.raycast = () => {};
      m.userData.noXray = true;
      scene.add(m);
      this.pool.push({ m, t: 1, dur: 1.6 });
    }
    for (const id of OFFICE_STATE.order) this.last[id] = this.key(OFFICE_STATE.agents[id]);
    BUS.on('agent', a => {
      const k = this.key(a), was = this.last[a.id];
      this.last[a.id] = k;
      if (was == null || was === k || !UI._booted) return;
      if (k === 'WAITING') this.spawn(a.id, BRAND.crimson, 2.6);
      else if (k === 'DONE') this.spawn(a.id, '#0a0a0a', 2.0);
    });
  },
  key: a => (a ? a.status : null),
  spawn(id, color, reach) {
    if (REDUCED_MOTION) return;
    const wb = WORLD.byId[id];
    if (!wb) return;
    const r = this.pool.find(p => p.t >= 1) || this.pool.reduce((a, b) => (a.t > b.t ? a : b));
    wb.fig.root.getWorldPosition(r.m.position);
    r.m.position.y = 0.012;
    r.m.material.color.set(color);
    r.reach = reach;
    r.t = 0;
    r.m.visible = true;
  },
  update(dt) {
    for (const r of this.pool) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / r.dur);
      const k = easeOut(r.t);
      const s = 0.55 + k * r.reach;
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = (1 - r.t) * (1 - r.t) * 0.85;
      if (r.t >= 1) r.m.visible = false;
    }
  },
};
