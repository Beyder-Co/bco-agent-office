/* =============================================================================
   40 · THE WORKSTATION — white-oak desk, one standard display, a task chair,
   a white wool rug
   -----------------------------------------------------------------------------
   Local frame: the agent sits at the origin facing +Z. Every station is turned
   (STATION_YAW) so its right side faces the default camera (south-west) and its
   display is angled toward the room: you see the hands on the keyboard and the
   work on the screen at the same time. All stations are identical; the only
   signal in the floor is the rug's perimeter line, which pulses crimson when
   that agent needs Igor and takes the agent's colour while you hover or select it.
   ============================================================================= */

/** The clear pane of a transparent OLED monitor (shared; as the study's glass, a touch more present). */
const MONITOR_GLASS = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.09, ior: 1.3, envMapIntensity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false });

const DESK = { w: 1.4, d: 0.72, top: 0.73, thick: 0.034, nearZ: 0.31 };
DESK.cz = DESK.nearZ + DESK.d / 2;
const RUG_R = 1.3;
const RUG_Z = 0.3;
const STATION_YAW = 0.92;
const KB = { x: 0.0, z: 0.53, w: 0.317, d: 0.128 }; // a low-profile 75% keyboard, centred on the agent
const PAD = { x: -0.265, z: 0.535 }; // the trackpad, to the right hand
const MAT_PAD = { x: -0.075, z: 0.535, w: 0.6, d: 0.25, h: 0.003 }; // the wool-felt desk pad under both
const CHAIR_BACK = -0.52; // how far the chair rolls back when the agent stands (clear of the calves and heels)

const GLOW_TEX = canvasTexture(GLOW_CANVAS, { aniso: false });
let AMP_IMG = null; // the ampersand from the logo, set at boot (the logo wall uses it)

/* ---------- the rug: white wool, a thin inlaid perimeter line ---------- */

const RUG_TEX = (() => {
  const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const rnd = seeded(44);
  ctx.fillStyle = '#f1efea';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 22000; i++) {
    const x = rnd() * S, y = rnd() * S;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(120,110,95,${0.04 + rnd() * 0.05})` : `rgba(255,255,255,${0.15 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + rnd() * 1.6, 0, TAU);
    ctx.fill();
  }
  const t = canvasTexture(c, { repeat: true });
  t.repeat.set(4, 4);
  return t;
})();
const RUG_MAT = new THREE.MeshStandardMaterial({ color: lin('#ffffff'), map: RUG_TEX, bumpMap: RUG_TEX, bumpScale: 0.002, roughness: 1, metalness: 0, envMapIntensity: 0.25, fog: false });
const LINE_NEUTRAL = lin('#b9b4ab');

/* ---------- name plate: black block, white letters that glow (crimson when needed) ---------- */

function plateTexture(name, specialty, glowHex, letterHex) {
  const c = makeCanvas(1024, 240);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, 1024, 240);
  ctx.textBaseline = 'alphabetic';
  const s = fitFont(ctx, name, 600, BRAND.ui, 104, 880);
  ctx.font = `600 ${s}px ${BRAND.ui}`;
  for (const [blur, alpha] of [[26, 0.7], [10, 0.9]]) {
    ctx.shadowColor = rgba(glowHex, alpha);
    ctx.shadowBlur = blur;
    ctx.fillStyle = letterHex;
    spacedText(ctx, name, 512, 126, 14, 'center');
  }
  ctx.shadowBlur = 6;
  ctx.shadowColor = rgba(glowHex, 0.5);
  ctx.fillStyle = mixHex(letterHex, '#0b0b0c', 0.3);
  const sp = specialty.toUpperCase();
  const s2 = fitFont(ctx, sp, 500, BRAND.ui, 36, 880);
  ctx.font = `500 ${s2}px ${BRAND.ui}`;
  spacedText(ctx, sp, 512, 196, 6, 'center');
  return canvasTexture(c);
}

/* ---------- live screens: one shared, quiet palette; crimson only for alerts ---------- */

const SCR = { W: 640, H: 360 };
const NEU = {
  darkBg: '#15171b', darkBar: '#202329', lightBg: '#f7f7f6', lightBar: '#eaeae8',
  ink: '#2c2f35', dim: '#8a8f98', faint: '#c9ccd1', line: '#e2e3e5', accent: '#6f7f95', accentSoft: '#d9dee6',
  code: ['#aeb8c7', '#8fa3bd', '#c4c8cf', '#9aa4b2', '#d3d6db', '#7f8896', '#b9c2ce'],
};

class Screen {
  constructor(kind, seed) {
    this.kind = kind;
    this.rnd = seeded(seed);
    this.canvas = makeCanvas(SCR.W, SCR.H);
    this.ctx = this.canvas.getContext('2d');
    this.tex = canvasTexture(this.canvas);
    this.lines = [];
    this.cur = null;
    this.scroll = 0;
    this.tick = 0;
    this.state = 'work';
    for (let i = 0; i < 12; i++) this.newLine(true);
    this.draw(0);
  }
  newLine(full = false) {
    const r = this.rnd;
    const prev = this.lines[this.lines.length - 1];
    const indent = clamp((prev ? prev.indent : 0) + (r() < 0.3 ? 1 : r() < 0.35 ? -1 : 0), 0, 4);
    const n = 1 + Math.floor(r() * 4);
    const tokens = Array.from({ length: n }, () => ({ w: 16 + r() * 80, c: NEU.code[Math.floor(r() * NEU.code.length)] }));
    const line = { indent, tokens, shown: full ? n : 0 };
    this.lines.push(line);
    if (this.lines.length > 40) this.lines.shift();
    this.cur = line;
  }
  step() {
    this.tick++;
    if (['code', 'build', 'terminal'].includes(this.kind)) {
      if (this.cur.shown < this.cur.tokens.length) this.cur.shown++;
      else this.newLine();
    } else this.scroll += 3;
  }
  draw(t) {
    const ctx = this.ctx;
    const W = SCR.W, H = SCR.H;
    const k = this.kind;
    const dark = ['code', 'build', 'terminal'].includes(k);
    ctx.fillStyle = dark ? NEU.darkBg : NEU.lightBg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = dark ? NEU.darkBar : NEU.lightBar;
    ctx.fillRect(0, 0, W, 26);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dark ? '#3a3e45' : '#c8cacd';
      ctx.beginPath();
      ctx.arc(14 + i * 15, 13, 4.5, 0, TAU);
      ctx.fill();
    }
    if (this.state === 'away' || this.state === 'paused') return this.drawLock(t);
    const codeArea = (x0, w) => {
      const lh = 18;
      const vis = Math.floor((H - 40) / lh);
      const lines = this.lines.slice(-vis);
      lines.forEach((ln, i) => {
        const y = 40 + i * lh;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x0 + 8, y, 12, 5);
        let x = x0 + 32 + ln.indent * 18;
        ln.tokens.slice(0, ln.shown).forEach(tk => {
          if (x + tk.w > x0 + w - 8) return;
          ctx.fillStyle = tk.c;
          ctx.fillRect(x, y, tk.w, 6);
          x += tk.w + 8;
        });
        if (ln === this.cur && this.state === 'work' && Math.floor(t * 2.4) % 2 === 0) {
          ctx.fillStyle = '#e8eaee';
          ctx.fillRect(x, y - 2, 7, 11);
        }
      });
    };
    const hdr = title => {
      ctx.fillStyle = dark ? '#8b919b' : '#8a8a8a';
      ctx.font = `500 13px ${BRAND.ui}`;
      const caption = k === 'ops' ? (OFFICE_STATE.fleet ? (OFFICE_STATE.meta.feed === 'live' ? (Number.isFinite(officeSourceTime(OFFICE_STATE.fleet.asOf)) ? ' · checked ' + fmtTime(new Date(OFFICE_STATE.fleet.asOf)) : ' · time unavailable') : ' · STALE') : ' · awaiting data') : ' · TEST illustration';
      ctx.fillText(title + caption, 74, 18);
    };
    if (k === 'code') {
      hdr('repository · main');
      ctx.fillStyle = '#1b1e23';
      ctx.fillRect(W - 112, 26, 112, H - 26);
      for (let i = 0; i < 10; i++) {
        const y = 48 + i * 30;
        ctx.strokeStyle = '#4a505a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W - 86, y - 15);
        ctx.lineTo(W - 86, y + 15);
        ctx.stroke();
        ctx.fillStyle = i % 3 === 0 ? '#c9ced6' : '#5c6370';
        ctx.beginPath();
        ctx.arc(W - 86, y, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#5c6370';
        ctx.fillRect(W - 72, y - 2, 48, 4);
      }
      codeArea(0, W - 112);
    } else if (k === 'terminal') {
      hdr('studio · scheduled jobs');
      codeArea(0, W);
    } else if (k === 'build') {
      hdr('site build · preview');
      codeArea(0, W * 0.5);
      const x0 = W * 0.52;
      ctx.fillStyle = '#fbfbfa';
      ctx.fillRect(x0, 26, W - x0, H - 26);
      ctx.fillStyle = '#1d1e21';
      ctx.fillRect(x0 + 12, 40, W - x0 - 24, 92);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0 + 28, 70, 120, 10);
      ctx.fillRect(x0 + 28, 88, 80, 7);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#ecebe8';
        ctx.fillRect(x0 + 12 + i * 98, 146, 88, 70);
        ctx.fillStyle = '#d8d6d1';
        ctx.fillRect(x0 + 12 + i * 98, 146, 88, 40);
      }
      const yy = 230 + ((this.tick * 2) % 70);
      ctx.strokeStyle = NEU.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 10, yy, W - x0 - 20, 26);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#d4d4d2';
        ctx.fillRect(x0 + 14, 236 + i * 22, 150 + ((i * 37) % 90), 7);
      }
    } else if (k === 'sheet') {
      hdr('Finance Tracker');
      const cols = 6, rows = 15, cw = (W - 180) / cols, rh = 21;
      ctx.fillStyle = NEU.accentSoft;
      ctx.fillRect(0, 26, W - 180, rh);
      for (let r = 0; r < rows; r++)
        for (let q = 0; q < cols; q++) {
          ctx.strokeStyle = NEU.line;
          ctx.strokeRect(q * cw, 26 + r * rh, cw, rh);
          if (r > 0) {
            ctx.fillStyle = q === 0 ? '#a0a3a8' : '#5a5d63';
            ctx.fillRect(q * cw + 7, 26 + r * rh + 8, cw * (0.3 + ((r * q) % 5) * 0.1), 5);
          }
        }
      const ar = 1 + (Math.floor(this.tick / 3) % (rows - 1)), ac = 1 + (Math.floor(this.tick / 2) % (cols - 1));
      ctx.strokeStyle = NEU.accent;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ac * cw, 26 + ar * rh, cw, rh);
      const x0 = W - 168;
      ctx.fillStyle = '#efefed';
      ctx.fillRect(x0, 36, 160, 130);
      ctx.strokeStyle = NEU.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const v = 0.5 + 0.35 * Math.sin(i * 0.8 + this.tick * 0.05) * (i / 10);
        const x = x0 + 10 + i * 14, y = 156 - v * 104;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      [0.6, 0.85, 0.45, 0.7].forEach((v, i) => {
        ctx.fillStyle = i === 1 ? '#5c6672' : '#b4bbc5';
        ctx.fillRect(x0 + 14 + i * 36, 330 - v * 130, 24, v * 130);
      });
    } else if (k === 'map') {
      hdr('Visibility · Bergen County');
      ctx.fillStyle = '#eef0ed';
      ctx.fillRect(0, 26, W * 0.62, H - 26);
      ctx.strokeStyle = '#d9ddd6';
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 36 + i * 34 + Math.sin(i) * 10);
        ctx.bezierCurveTo(130, 26 + i * 32, 260, 70 + i * 30, W * 0.62, 46 + i * 32);
        ctx.stroke();
      }
      ctx.fillStyle = '#d5dde6';
      ctx.fillRect(W * 0.5, 26, 40, H - 26);
      [[100, 110], [190, 190], [290, 130], [150, 290], [330, 270]].forEach(([x, y], i) => {
        ctx.fillStyle = i === Math.floor(this.tick / 8) % 5 ? '#2c2f35' : '#7d8794';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, TAU);
        ctx.fill();
      });
      const x0 = W * 0.64;
      for (let i = 0; i < 10; i++) {
        const y = 40 + i * 32 - (this.scroll % 32);
        ctx.fillStyle = i % 4 === 0 ? NEU.accentSoft : '#ffffff';
        ctx.fillRect(x0, y, W - x0 - 10, 28);
        ctx.fillStyle = '#7a7a7a';
        ctx.fillRect(x0 + 10, y + 11, 70 + ((i * 29) % 70), 6);
        ctx.fillStyle = i < 3 ? '#5c6672' : '#b0b4ba';
        ctx.fillRect(W - 46, y + 10, 26, 8);
      }
    } else if (k === 'media') {
      hdr('Publishing · episode & archive');
      ctx.fillStyle = '#1b1c20';
      ctx.fillRect(12, 36, W - 24, 180);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(W / 2 - 18, 104); ctx.lineTo(W / 2 + 22, 126); ctx.lineTo(W / 2 - 18, 148); ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i === Math.floor(this.tick / 5) % 7 ? '#9aa3af' : '#d2d2d2';
        ctx.fillRect(12 + i * 88, 228, 78, 44);
      }
      ctx.strokeStyle = '#6f7f95';
      ctx.lineWidth = 2;
      for (let x = 12; x < W - 12; x += 5) {
        const h = 6 + Math.abs(Math.sin(x * 0.07 + this.tick * 0.4)) * 26 * (0.5 + 0.5 * Math.sin(x * 0.013));
        ctx.beginPath();
        ctx.moveTo(x, 318 - h / 2);
        ctx.lineTo(x, 318 + h / 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#2c2f35';
      ctx.fillRect(12 + ((this.tick * 4) % (W - 24)), 288, 2, 60);
    } else if (k === 'strategy') {
      hdr('Positioning · priorities');
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 44, 280, 280);
      ctx.beginPath();
      ctx.moveTo(164, 44); ctx.lineTo(164, 324); ctx.moveTo(24, 184); ctx.lineTo(304, 184);
      ctx.stroke();
      [[84, 100, 1], [230, 90, 0], [110, 260, 0], [250, 240, 0], [196, 136, 1]].forEach(([x, y, hi], i) => {
        ctx.fillStyle = hi ? '#2c2f35' : '#b9b9b9';
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 0.6 + i) * 2, y, hi ? 14 : 10, 0, TAU);
        ctx.fill();
      });
      for (let i = 0; i < 8; i++) {
        const y = 54 + i * 38;
        ctx.fillStyle = i === Math.floor(this.tick / 6) % 8 ? NEU.accentSoft : '#ffffff';
        ctx.fillRect(328, y - 12, W - 344, 32);
        ctx.fillStyle = '#5c6672';
        ctx.fillRect(340, y, 9, 9);
        ctx.fillStyle = '#7c7c7c';
        ctx.fillRect(360, y + 1, 110 + ((i * 41) % 110), 7);
      }
    } else if (k === 'ops') {
      hdr('Fleet · today');
      OFFICE_STATE.order.slice(0, 10).forEach((id, i) => {
        const a = OFFICE_STATE.agents[id];
        const y = 42 + i * 30;
        ctx.fillStyle = '#7c7c7c';
        ctx.font = `500 12px ${BRAND.ui}`;
        ctx.fillText(a.name.slice(0, 11), 12, y + 13);
        const st = a.status;
        ctx.fillStyle = st === 'WAITING' ? BRAND.crimson : '#4a4f57';
        const w = st === 'WORKING' ? 280 + Math.sin(t + i) * 30 : st === 'THINKING' ? 170 : 80;
        ctx.globalAlpha = st === 'IDLE' || a.paused ? 0.3 : 1;
        ctx.fillRect(112, y + 3, w, 13);
        ctx.globalAlpha = 1;
      });
    }
    if (this.state === 'think') {
      const a = t * 4;
      ctx.strokeStyle = dark ? '#c9ced6' : '#5c6672';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W - 30, H - 30, 13, a, a + 4.2);
      ctx.stroke();
    }
    if (this.state === 'wait') {
      ctx.fillStyle = 'rgba(167,0,8,0.92)';
      ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 18px ${BRAND.ui}`;
      ctx.fillText('Waiting for Igor', 18, H - 14);
    }
  }
  drawLock(t = 0) {
    const ctx = this.ctx, W = SCR.W, H = SCR.H;
    const motion = !REDUCED_MOTION && this.state === 'away';
    const phase = motion ? t : 0;
    ctx.save();
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#101820');bg.addColorStop(1, '#080d13');
    ctx.fillStyle = bg;ctx.fillRect(0, 0, W, H);
    // A deterministic constellation; decorative standby signals, never a claim of job activity.
    const nodes = Array.from({length:24}, (_,i) => {
      const ring = i < 8 ? 0 : i < 16 ? 1 : 2, a = (i % 8) / 8 * TAU + ring * .24;
      const r = 42 + ring * 47, drift = Math.sin(phase * .18 + i) * 2.5;
      return {x:W*.50 + Math.cos(a) * (r + drift) * 1.42, y:H*.48 + Math.sin(a) * (r + drift)*.78};
    });
    const links=[];
    for(let i=0;i<nodes.length;i++) {
      links.push([i,Math.floor(i/8)*8+(i+1)%8]);
      if(i>=8){links.push([i,i-8]);if(i%2===0)links.push([i,(i-8+1)%8+Math.floor((i-8)/8)*8]);}
    }
    ctx.lineWidth=.8;
    links.forEach(([a,b],i)=>{
      const p=nodes[a],q=nodes[b];
      ctx.strokeStyle='rgba(120,176,191,.20)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
      if(i%3===0){
        const u=(phase*.105+i*.173)%1,x=lerp(p.x,q.x,u),y=lerp(p.y,q.y,u);
        ctx.strokeStyle='rgba(177,226,235,.60)';ctx.beginPath();ctx.moveTo(lerp(p.x,q.x,Math.max(0,u-.12)),lerp(p.y,q.y,Math.max(0,u-.12)));ctx.lineTo(x,y);ctx.stroke();
        ctx.fillStyle='#cee9ee';ctx.beginPath();ctx.arc(x,y,1.65,0,TAU);ctx.fill();
      }
    });
    nodes.forEach((p,i)=>{
      const glow=.45+.25*Math.sin(phase*.6+i*.7);
      ctx.fillStyle=`rgba(162,215,224,${glow})`;ctx.beginPath();ctx.arc(p.x,p.y,2.1,0,TAU);ctx.fill();
    });
    ctx.textAlign='left';ctx.fillStyle='#e2e9ed';ctx.font=`500 16px ${BRAND.ui}`;
    ctx.fillText('B&Co. / AGENT OFFICE',24,30);
    ctx.fillStyle='#82959f';ctx.font=`500 12px ${BRAND.ui}`;
    ctx.fillText(this.state === 'paused' ? 'PAUSED BY DESIGN' : 'AWAY · STANDBY',24,H-24);
    ctx.textAlign='right';ctx.fillStyle='#dbe5e9';ctx.font=`500 19px ${BRAND.ui}`;
    ctx.fillText(fmtTime(new Date())+' ET',W-24,H-24);
    ctx.restore();
  }
}

/* ---------- desk objects: one real thing per role ---------- */

const CARD_WHITE = std('#f1f0ec', 0.95);
const BASSWOOD = std('#dcc9a6', 0.72);
const ACRYLIC = new THREE.MeshPhysicalMaterial({ color: lin('#dfe8ec'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.38, envMapIntensity: 1.3, depthWrite: false, fog: false });
const SPACE_GREY = std('#6e7176', 0.32, 0.75, { envMapIntensity: 0.9 });
const PAPER = std('#f8f7f3', 0.92);

function deskProp(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'tablet': {
      // a tablet in a dark case, its screen on, beside a leather notebook
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.18, 0.008, 0.25, 0.01, 2), SPACE_GREY), 0, 0.004, 0));
      const c = makeCanvas(180, 250);
      const x = c.getContext('2d');
      x.fillStyle = '#f8f8f7';
      x.fillRect(0, 0, 180, 250);
      x.fillStyle = '#2c2f35';
      x.fillRect(14, 16, 90, 9);
      for (let i = 0; i < 6; i++) {
        x.fillStyle = i === 0 ? BRAND.crimson : '#9ba1a9';
        x.fillRect(14, 44 + i * 32, 12, 12);
        x.fillStyle = '#c8c8c8';
        x.fillRect(34, 47 + i * 32, 90 + ((i * 23) % 40), 6);
      }
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.166, 0.232), new THREE.MeshBasicMaterial({ map: canvasTexture(c), toneMapped: false }));
      scr.rotation.x = -HALF_PI;
      scr.position.y = 0.0085;
      g.add(scr);
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.15, 0.016, 0.21, 0.006, 2), leather('#2f2723', 0.55)), 0.18, 0.008, 0.02));
      g.rotation.y = 0.25;
      break;
    }
    case 'house': {
      // an architect's model at 1:100: white card volumes, acrylic glazing, basswood base, white trees
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.014, 0.24), BASSWOOD), 0, 0.007, 0));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.002, 0.22), CARD_WHITE), 0, 0.015, 0));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.034, 0.09), CARD_WHITE), -0.02, 0.033, -0.035));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.028, 0.002), ACRYLIC), -0.02, 0.031, 0.0105));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.105), CARD_WHITE), 0.03, 0.065, -0.02));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.024, 0.002), ACRYLIC), 0.03, 0.065, 0.0335));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.024, 0.095), ACRYLIC), 0.0955, 0.065, -0.02));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.004, 0.118), CARD_WHITE), 0.03, 0.082, -0.02));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.003), BASSWOOD), -0.075, 0.033, 0.011));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.003, 0.042), ACRYLIC), -0.045, 0.0175, 0.068));
      for (const [x, z, r] of [[0.105, 0.07, 0.016], [0.118, 0.032, 0.012], [-0.115, -0.075, 0.014], [-0.12, 0.085, 0.011]]) {
        g.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.022, 5), SILVER_MAT), x, 0.027, z));
        g.add(placed(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), CARD_WHITE), x, 0.037 + r * 0.7, z));
      }
      g.rotation.y = 0.3;
      break;
    }
    case 'laptop': {
      // a closed laptop and a small external drive
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.31, 0.016, 0.22, 0.008, 3), SPACE_GREY), 0, 0.008, 0));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.001, 0.004), INK_MAT), 0, 0.0165, -0.105));
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.07, 0.012, 0.1, 0.006, 2), INK_MAT), 0.2, 0.006, 0.05));
      g.rotation.y = -0.18;
      break;
    }
    case 'chess': {
      // a walnut-and-maple board, a few turned pieces mid-game
      const c = makeCanvas(256, 256);
      const x = c.getContext('2d');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        x.fillStyle = (i + j) % 2 ? '#5b3f2c' : '#e2cfaa';
        x.fillRect(i * 32, j * 32, 32, 32);
      }
      const walnut = std('#4a3426', 0.6);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 0.24), [walnut, walnut, new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.45, fog: false }), walnut, walnut, walnut]);
      board.position.y = 0.008;
      g.add(board);
      const ivory = std('#efe8da', 0.35), ebony = std('#1d1a18', 0.35);
      const piece = (h, m, px, pz) => {
        const p = new THREE.Mesh(latheFromProfile([[0.0006, 0], [0.012, 0], [0.012, 0.005], [0.006, 0.014], [0.0045, h * 0.78], [0.0085, h * 0.84], [0.0006, h]], 18, 16), m);
        p.position.set(px, 0.016, pz);
        g.add(p);
      };
      piece(0.055, ivory, -0.045, 0.03);
      piece(0.045, ebony, 0.04, -0.03);
      piece(0.04, ebony, 0.07, 0.07);
      piece(0.035, ivory, -0.07, -0.06);
      g.rotation.y = 0.2;
      break;
    }
    case 'studio': {
      // a compact aluminium desktop computer, one status light
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.197, 0.095, 0.197, 0.022, 4), MAT.alu), 0, 0.0475, 0));
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), new THREE.MeshBasicMaterial({ color: lin('#f4f6f8'), toneMapped: false }));
      led.position.set(0.075, 0.016, 0.0986);
      g.add(led);
      g.userData.led = led;
      for (let i = 0; i < 2; i++) g.add(placed(new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.004), MAT.black), -0.06 + i * 0.022, 0.02, 0.0987));
      break;
    }
    case 'ledger': {
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.17, 0.024, 0.235, 0.004, 2), leather('#2b3a30', 0.6)), -0.04, 0.012, 0));
      g.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.225), PAPER), -0.036, 0.012, 0));
      const calc = new THREE.Mesh(roundedBoxGeometry(0.085, 0.014, 0.15, 0.006, 2), std('#3a3c40', 0.5));
      calc.position.set(0.09, 0.007, 0.03);
      calc.rotation.y = -0.15;
      g.add(calc);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.024), new THREE.MeshBasicMaterial({ color: lin('#b9c1ae'), toneMapped: false }));
      disp.rotation.set(-HALF_PI, 0, -0.15);
      disp.position.set(0.084, 0.0145, -0.015);
      g.add(disp);
      break;
    }
    case 'camera': {
      // a mirrorless camera with a short lens, resting on its base
      const body = new THREE.Mesh(roundedBoxGeometry(0.13, 0.08, 0.05, 0.01, 3), INK_MAT);
      body.position.set(0, 0.04, 0);
      g.add(body);
      g.add(placed(new THREE.Mesh(roundedBoxGeometry(0.035, 0.07, 0.03, 0.01, 2), INK_MAT), 0.05, 0.035, 0.03));
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.07, 32), INK_MAT);
      lens.rotation.x = HALF_PI;
      lens.position.set(-0.012, 0.04, 0.058);
      g.add(lens);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.025, 28), new THREE.MeshPhysicalMaterial({ color: lin('#1a2230'), roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5, fog: false }));
      glass.position.set(-0.012, 0.04, 0.0935);
      g.add(glass);
      g.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 16), SILVER_MAT), 0.035, 0.084, 0.0));
      g.rotation.y = -0.5;
      break;
    }
    case 'mic': {
      // a broadcast microphone on a short desk stand, the script beside it
      g.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.012, 32), INK_MAT), 0, 0.006, 0));
      g.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 10), SILVER_MAT), 0, 0.11, 0));
      const mic = new THREE.Mesh(capsuleGeometry(0.026, 0.09, 8, 20), INK_MAT);
      mic.position.set(0, 0.235, 0.02);
      mic.rotation.x = 0.5;
      g.add(mic);
      const grille = new THREE.Mesh(capsuleGeometry(0.0265, 0.035, 8, 20), std('#55585e', 0.6, 0.6));
      grille.position.set(0, 0.262, 0.036);
      grille.rotation.x = 0.5;
      g.add(grille);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.004, 0.297), PAPER);
      paper.position.set(0.17, 0.002, 0.06);
      paper.rotation.y = 0.2;
      g.add(paper);
      break;
    }
    default:
      break;
  }
  return shadowAll(g, true, true);
}

/** Does this agent need Igor? 2 = now (waiting, a gate, stalled), 1 = something held, 0 = no. */
function needsOwner(id) {
  const a = OFFICE_STATE.agents[id];
  if (!a) return 0;
  if (a.status === 'WAITING' || a.stuck || OFFICE_STATE.approvals.some(g => g.agentId === id)) return 2;
  if (OFFICE_STATE.held.some(h => h.agentId === id)) return 1;
  return 0;
}

/* ---------- shaped solids: superellipse lofts for soft and sculpted parts ---------- */

/**
 * A closed loft through superellipse sections. rows: [{ p: [x, y, z] centre, a, b, n? }]: a and b are the
 * half-sizes along U (a fixed lateral axis, default +X) and V = axis × U. The axis follows the row centres
 * unless `axis` fixes it (needed when sections share a centre). Both ends are capped with a fan.
 */
function superLoft(rows, { segs = 32, n = 3, U = [1, 0, 0], axis = null, uvScale = 1, uvPlane = 'xz', capStartAt = null, capEndAt = null } = {}) {
  const pos = [], idx = [];
  const u0 = new THREE.Vector3(...U).normalize();
  const ax = new THREE.Vector3(), v = new THREE.Vector3(), uu = new THREE.Vector3();
  const R = rows.length;
  for (let i = 0; i < R; i++) {
    const r = rows[i];
    if (axis) ax.set(axis[0], axis[1], axis[2]);
    else {
      const p0 = rows[Math.max(0, i - 1)].p, p1 = rows[Math.min(R - 1, i + 1)].p;
      ax.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    }
    ax.normalize();
    v.crossVectors(ax, u0).normalize();
    uu.crossVectors(v, ax).normalize();
    const ne = r.n || n;
    for (let k = 0; k < segs; k++) {
      const t = (k / segs) * TAU, ct = Math.cos(t), st = Math.sin(t);
      const x = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / ne) * r.a;
      const y = Math.sign(st) * Math.pow(Math.abs(st), 2 / ne) * r.b;
      pos.push(r.p[0] + uu.x * x + v.x * y, r.p[1] + uu.y * x + v.y * y, r.p[2] + uu.z * x + v.z * y);
    }
  }
  for (let i = 0; i < R - 1; i++)
    for (let k = 0; k < segs; k++) {
      const a = i * segs + k, b = i * segs + ((k + 1) % segs), c = (i + 1) * segs + k, d = (i + 1) * segs + ((k + 1) % segs);
      idx.push(a, c, b, b, c, d);
    }
  const c0 = capStartAt || rows[0].p, c1 = capEndAt || rows[R - 1].p;
  let ci = pos.length / 3;
  pos.push(c0[0], c0[1], c0[2]);
  for (let k = 0; k < segs; k++) idx.push(ci, k, (k + 1) % segs);
  ci = pos.length / 3;
  pos.push(c1[0], c1[1], c1[2]);
  const o = (R - 1) * segs;
  for (let k = 0; k < segs; k++) idx.push(ci, o + ((k + 1) % segs), o + k);
  // outward faces: flip the winding if the signed volume came out negative
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const A = idx[i] * 3, B = idx[i + 1] * 3, C = idx[i + 2] * 3;
    vol += pos[A] * (pos[B + 1] * pos[C + 2] - pos[B + 2] * pos[C + 1]) + pos[A + 1] * (pos[B + 2] * pos[C] - pos[B] * pos[C + 2]) + pos[A + 2] * (pos[B] * pos[C + 1] - pos[B + 1] * pos[C]);
  }
  if (vol < 0)
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const [ia, ib] = uvPlane === 'xy' ? [0, 1] : uvPlane === 'zy' ? [2, 1] : [0, 2];
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i + ia] * uvScale, pos[i + ib] * uvScale);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * A soft block (cushion, pad, upholstered panel) standing on y = 0: a superellipse plan, rounded edges,
 * an optional dished or crowned top, a waterfall front (+Z), sides bent forward (bend > 0, in Z) or up (bendY).
 */
function softBlock(w, h, d, { r = 0.02, n = 4, segs = 40, dish = 0, crown = 0, waterfall = 0, bend = 0, bendY = 0, edge = 4, rings = 4, uvScale = 1 } = {}) {
  const hw = w / 2, hd = d / 2;
  r = Math.max(0.0005, Math.min(r, h / 2 - 1e-4, hw - 1e-3, hd - 1e-3));
  const rows = [];
  for (let i = 0; i <= edge; i++) {
    const f = (i / edge) * HALF_PI, ins = r - r * Math.sin(f);
    rows.push({ p: [0, r - r * Math.cos(f), 0], a: hw - ins, b: hd - ins });
  }
  for (let i = 0; i <= edge; i++) {
    const f = (i / edge) * HALF_PI, ins = r - r * Math.cos(f);
    rows.push({ p: [0, h - r + r * Math.sin(f), 0], a: hw - ins, b: hd - ins });
  }
  for (let i = 1; i < rings; i++) {
    const f = 1 - i / rings;
    rows.push({ p: [0, h, 0], a: (hw - r) * f, b: (hd - r) * f });
  }
  const geo = superLoft(rows, { segs, n, axis: [0, 1, 0], uvScale, capStartAt: [0, 0, 0], capEndAt: [0, h, 0] });
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    let y = P.getY(i), zz = z;
    const top = clamp((y - (h - r)) / r, 0, 1);
    if (dish || crown) y += (crown - dish) * Math.max(0, 1 - (x / hw) ** 2 - (z / hd) ** 2) * top;
    if (waterfall && z > hd * 0.35) {
      const k = (z - hd * 0.35) / (hd * 0.65);
      y -= waterfall * k * k * clamp(y / h, 0, 1);
    }
    if (bend) zz += bend * (x / hw) ** 2;
    if (bendY) y += bendY * (x / hw) ** 2;
    P.setXYZ(i, x, y, zz);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Invisible boxes that stand in for curved parts in the collision record: a bent or swept mesh's own bounding
 * box is far looser than the part. Mark the real mesh noCollide, add proxies, register, then drop them.
 */
const PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });
function addProxy(parent, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), PROXY_MAT);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.visible = false;
  m.userData.proxy = true;
  m.raycast = () => {};
  parent.add(m);
  return m;
}
function dropProxies(root) {
  const out = [];
  root.traverse(o => o.userData.proxy && out.push(o));
  out.forEach(o => o.parent.remove(o));
}

/** A flat bar or tube of superellipse section following a smooth path (points in the parent frame). */
function barAlong(points, a, b, { n = 6, segs = 16, samples = 24, U = [1, 0, 0] } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const rows = curve.getPoints(samples).map(p => ({ p: [p.x, p.y, p.z], a, b }));
  return superLoft(rows, { segs, n, U });
}

/** Woven textures: a fine knit for task chairs, wool felt for desk pads, a leather grain. */
function weaveCanvas(seed, base, light, dark, { size = 256, cell = 4, noise = 2400 } = {}) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d'), rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += cell)
    for (let x = 0; x < size; x += cell) {
      const odd = ((x + y) / cell) % 2;
      ctx.fillStyle = odd ? light : dark;
      ctx.globalAlpha = 0.14 + rnd() * 0.08;
      ctx.fillRect(x, y + (odd ? 0 : cell * 0.25), cell - 1, cell * 0.75);
    }
  ctx.globalAlpha = 1;
  for (let i = 0; i < noise; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1);
  }
  return c;
}
const KNIT_TEX = canvasTexture(weaveCanvas(61, '#3b3d41', '#55585e', '#24262a', { cell: 4 }), { repeat: true });
KNIT_TEX.repeat.set(2.6, 2.6);
const FELT_TEX = canvasTexture(weaveCanvas(7, '#4a4c50', '#5c5f64', '#3c3e42', { cell: 2, noise: 5200 }), { repeat: true });
FELT_TEX.repeat.set(3, 3);
const FMAT = {
  knit: new THREE.MeshStandardMaterial({ map: KNIT_TEX, bumpMap: KNIT_TEX, bumpScale: 0.0008, roughness: 0.92, metalness: 0, envMapIntensity: 0.35, fog: false }),
  knitPad: new THREE.MeshStandardMaterial({ map: KNIT_TEX, color: lin('#c8cacd'), bumpMap: KNIT_TEX, bumpScale: 0.0006, roughness: 0.9, metalness: 0, envMapIntensity: 0.35, fog: false }),
  felt: new THREE.MeshStandardMaterial({ map: FELT_TEX, bumpMap: FELT_TEX, bumpScale: 0.0006, roughness: 1, metalness: 0, envMapIntensity: 0.2, fog: false }),
  polished: std('#dfe2e6', 0.16, 1, { envMapIntensity: 1.25 }),
  satinBlack: std('#17181b', 0.38, 0.35, { envMapIntensity: 0.8 }),
  nylon: std('#1d1e21', 0.55, 0.05),
  rubber: std('#121314', 0.85, 0),
  glassBlack: new THREE.MeshPhysicalMaterial({ color: lin('#08090b'), roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9, fog: false }),
  port: std('#0b0b0c', 0.6, 0.2),
  trackpad: std('#e6e7ea', 0.2, 0.15, { envMapIntensity: 0.9 }),
  notebook: leather('#232427', 0.55),
  cork: std('#b89470', 0.95),
  coffee: std('#2a1a12', 0.25),
};

/* ---------- the keyboard: a low-profile 75% in aluminium, every key a sculpted cap ---------- */

const KEY_U = 0.01905; // one key unit: 19.05 mm pitch
/** ANSI 75%: [legend, width in units] per row, function row first (farthest from the hands). */
const KEY_LAYOUT = [
  [['esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['prt', 1], ['del', 1], ['home', 1]],
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['delete', 2], ['pg up', 1]],
  [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5], ['pg dn', 1]],
  [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['return', 2.25], ['end', 1]],
  [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 1.75], ['▲', 1], ['fn', 1]],
  [['control', 1.25], ['option', 1.25], ['command', 1.25], ['', 6.25], ['command', 1], ['option', 1], ['control', 1], ['◀', 1], ['▼', 1], ['▶', 1]],
];
const KEY_WORDS = new Set(['esc', 'tab', 'caps', 'shift', 'control', 'option', 'command', 'fn', 'delete', 'return', 'prt', 'del', 'home', 'end', 'pg up', 'pg dn']);
const keyTone = label => (label === 'esc' || label === 'return' ? 'accent' : KEY_WORDS.has(label) || /^F\d/.test(label) || '▲▼◀▶'.includes(label) && label !== '' ? 'mod' : 'alpha');
const KEY_TONES = { alpha: lin('#f5f5f3'), mod: lin('#dfe1e4'), accent: lin('#ccd0d5') };

/** One atlas of legends for every keyboard: cells as wide as their keys, subtle grey ink on white. */
let KEY_ATLAS = null;
function keyAtlas() {
  if (KEY_ATLAS) return KEY_ATLAS;
  const W = 1024, H = 512, CH = 48;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const cells = [];
  let x = 0, y = 0;
  for (const row of KEY_LAYOUT)
    for (const [label, wu] of row) {
      const cw = Math.round(wu * CH);
      if (x + cw > W) (x = 0), (y += CH);
      ctx.fillStyle = '#5b5e64';
      ctx.textBaseline = 'middle';
      if (KEY_WORDS.has(label)) {
        ctx.font = `500 10px ${BRAND.ui}`;
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 7, y + CH - 12);
      } else if (/^F\d/.test(label)) {
        ctx.font = `500 11px ${BRAND.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x + cw / 2, y + CH / 2 + 1);
      } else if (label) {
        ctx.font = `${'▲▼◀▶'.includes(label) ? 400 : 500} ${'▲▼◀▶'.includes(label) ? 11 : /[A-Z0-9]/.test(label) ? 19 : 18}px ${BRAND.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x + cw / 2, y + CH / 2 + 1);
      }
      // [u offset, v offset, u scale, v scale] for the cap's top
      cells.push([x / W, 1 - (y + CH) / H, cw / W, CH / H]);
      x += cw;
    }
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  KEY_ATLAS = { tex, cells };
  return KEY_ATLAS;
}

/** Caps share one material: the legend comes from the atlas through a per-key cell (instanced). */
let KEYCAP_MAT = null;
function keycapMaterial() {
  if (KEYCAP_MAT) return KEYCAP_MAT;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: keyAtlas().tex, roughness: 0.48, metalness: 0, envMapIntensity: 0.5, fog: false });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 legend;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvUv = legend.xy + vUv * legend.zw;');
  };
  m.customProgramCacheKey = () => 'bco-keycap-legend';
  KEYCAP_MAT = m;
  return m;
}

/**
 * One sculpted cap, standing on y = 0: a slightly tapered skirt, softened corners and a shallow cylindrical
 * dish. UVs put the legend cell on the top face (u runs right to left as the typist sees it: +X is their left).
 */
function keycapGeometry(widthU, pitch, { height = 0.0042, gap = 0.0016, taper = 0.0016, dish = 0.0005, chiclet = false } = {}) {
  const a0 = (widthU * pitch - gap) / 2, b0 = (pitch - gap) / 2;
  const at = a0 - taper, bt = b0 - taper * 1.15;
  const rows = chiclet
    ? [{ p: [0, 0, 0], a: a0, b: b0, n: 6 }, { p: [0, height, 0], a: a0 - 0.0003, b: b0 - 0.0003, n: 6 }]
    : [
        { p: [0, 0, 0], a: a0, b: b0, n: 6 },
        { p: [0, height * 0.82, 0], a: at + 0.0005, b: bt + 0.0005, n: 5 },
        { p: [0, height, 0], a: at, b: bt, n: 4.5 },
      ];
  const ta = rows[rows.length - 1].a, tb = rows[rows.length - 1].b;
  const geo = superLoft(rows, { segs: chiclet ? 8 : 10, n: 5, axis: [0, 1, 0], capStartAt: [0, 0, 0], capEndAt: [0, height, 0] });
  const P = geo.attributes.position, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (!chiclet && y > height * 0.99) P.setY(i, y - dish * Math.max(0, 1 - (x / ta) ** 2));
    UV.setXY(i, 0.5 - 0.46 * clamp(x / ta, -1, 1), 0.5 + 0.44 * clamp(z / tb, -1, 1));
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

const _km = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _ke = new THREE.Euler(), _kp = new THREE.Vector3(), _ks = new THREE.Vector3();
/**
 * A keyboard of individual caps on a plate that rises by `rise` (m per m) away from the typist.
 * Returns { group, keys, press, update, topY(z) } with keys in the group's frame:
 * [{ x, y (cap top), z, w, d, row, label }]. press(i) sinks cap i by `travel` and lets it spring back (~90 ms).
 */
function buildKeyboard({ pitch = KEY_U, capH = 0.0042, travel = 0.0018, rise = 0, plateY = 0, chiclet = false } = {}) {
  const group = new THREE.Group();
  group.userData.keep = true; // instanced caps: never batched
  const tilt = Math.atan(rise);
  const atlas = keyAtlas();
  const specs = [];
  let li = 0;
  KEY_LAYOUT.forEach((row, r) => {
    let acc = 0;
    const z = (2.5 - r) * pitch;
    for (const [label, wu] of row) {
      const x = (8 - acc - wu / 2) * pitch; // the typist's left is +X
      specs.push({ label, wu, r, x, z, cell: atlas.cells[li++] });
      acc += wu;
    }
  });
  const wide = specs.filter(s => s.wu > 3), std1 = specs.filter(s => s.wu <= 3);
  const mat = keycapMaterial();
  const meshes = [];
  const make = (list, geo, scaleX) => {
    const legend = new Float32Array(list.length * 4);
    list.forEach((s, i) => legend.set(s.cell, i * 4));
    geo.setAttribute('legend', new THREE.InstancedBufferAttribute(legend, 4));
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    list.forEach((s, i) => {
      s.mesh = m;
      s.idx = i;
      s.sx = scaleX ? s.wu : 1;
      m.setColorAt(i, KEY_TONES[keyTone(s.label)]);
    });
    m.userData.noCollide = true;
    m.castShadow = false; // the case casts for them
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    meshes.push(m);
    return m;
  };
  make(std1, keycapGeometry(1, pitch, { height: capH, chiclet }), true);
  if (wide.length) make(wide, keycapGeometry(wide[0].wu, pitch, { height: capH, chiclet }), false);
  const keys = [];
  const place = (s, sink) => {
    _ke.set(-tilt, 0, 0);
    _kq.setFromEuler(_ke);
    _kp.set(s.x, plateY + s.z * rise - sink * Math.cos(tilt), s.z + sink * Math.sin(tilt));
    _ks.set(s.sx, 1, 1);
    s.mesh.setMatrixAt(s.idx, _km.compose(_kp, _kq, _ks));
  };
  for (const s of specs) {
    place(s, 0);
    s.t = 1;
    keys.push({ x: s.x, y: plateY + s.z * rise + capH * Math.cos(tilt), z: s.z - capH * Math.sin(tilt), w: s.wu * pitch - 0.0016, d: pitch - 0.0016, row: s.r, label: s.label });
  }
  meshes.forEach(m => {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const active = new Set();
  const dim = new THREE.Color();
  return {
    group,
    keys,
    specs,
    lastPress: -1e9,
    /** Sink cap i (the typist's finger) — it springs back by itself. */
    press(i, auto = false) {
      const s = specs[i];
      if (!s) return;
      s.t = 0;
      active.add(s);
      if (!auto) this.lastPress = performance.now();
    },
    update(dt) {
      if (!active.size) return;
      const dirty = new Set();
      for (const s of active) {
        s.t += dt;
        // down in 25 ms, held 20 ms, back up in 45 ms
        const k = s.t < 0.025 ? s.t / 0.025 : s.t < 0.045 ? 1 : Math.max(0, 1 - (s.t - 0.045) / 0.045);
        place(s, travel * k);
        dim.copy(KEY_TONES[keyTone(s.label)]).multiplyScalar(1 - 0.1 * k);
        s.mesh.setColorAt(s.idx, dim);
        dirty.add(s.mesh);
        if (s.t >= 0.09) active.delete(s);
      }
      for (const m of dirty) {
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
      }
    },
  };
}
/** Key indices for the two hands on the letter rows (for typing when nobody drives the fingers). */
const KEY_HANDS = (() => {
  const L = [], R = [];
  let i = 0;
  KEY_LAYOUT.forEach((row, r) =>
    row.forEach(([label]) => {
      if (r >= 1 && r <= 4 && /^[A-Z0-9,.;'/[\]-]$/.test(label)) ('QWERTASDFGZXCVB12345'.includes(label) ? L : R).push(i);
      i++;
    })
  );
  return { L, R, space: KEY_LAYOUT.flat().findIndex(([l]) => l === '') };
})();

/* ---------- the laptop: closed until someone sits down to it (the Forum table) ---------- */

const LAPTOP = { w: 0.3126, d: 0.2212, base: 0.0095, lid: 0.006, open: 1.86, pitch: 0.0178 };
/**
 * A slim aluminium laptop in its own frame: origin on the table under the centre of its base, the typist
 * at -Z, the hinge at +Z. Keys and trackpad in the base frame. setOpen(bool) swings the lid; update(dt, t)
 * animates it and runs the screen.
 */
function buildLaptop(seed = 1, kind = 'sheet') {
  const L = LAPTOP;
  const g = new THREE.Group();
  g.userData.keep = true;
  const bp = new THREE.Group(); // the static base, batched by material
  const shell = new THREE.Mesh(roundedBoxGeometry(L.w, L.base, L.d, 0.004, 3), MAT.alu);
  shell.position.y = L.base / 2;
  bp.add(shell);
  // the keyboard well and its caps, the glass trackpad, a speaker grille either side
  const kbZ = 0.035;
  bp.add(placed(new THREE.Mesh(roundedBoxGeometry(16 * L.pitch + 0.006, 0.0006, 6 * L.pitch + 0.006, 0.0003, 1), FMAT.port), 0, L.base - 0.0002, kbZ));
  const kb = buildKeyboard({ pitch: L.pitch, capH: 0.0011, travel: 0.0009, plateY: L.base - 0.0002, chiclet: true });
  kb.group.position.set(0, 0, kbZ);
  g.add(kb.group);
  const pad = new THREE.Mesh(roundedBoxGeometry(0.149, 0.0006, 0.085, 0.0003, 1), MAT.alu);
  pad.position.set(0, L.base + 0.0001, -0.0605);
  bp.add(pad);
  for (const sx of [-1, 1]) bp.add(placed(new THREE.Mesh(roundedBoxGeometry(0.008, 0.0004, 6 * L.pitch, 0.0002, 1), FMAT.port), sx * (8 * L.pitch + 0.012), L.base, kbZ));
  shadowAll(bp, true, true);
  mergeByMaterial(bp);
  g.add(bp);
  // the lid on its hinge: aluminium outside, black glass and the picture inside
  const hinge = new THREE.Group();
  hinge.position.set(0, L.base, L.d / 2 - 0.004);
  g.add(hinge);
  const lid = new THREE.Mesh(roundedBoxGeometry(L.w, L.lid, L.d - 0.004, 0.003, 3), MAT.alu);
  lid.position.set(0, L.lid / 2, -(L.d - 0.004) / 2);
  hinge.add(lid);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(L.w - 0.006, L.d - 0.01), FMAT.glassBlack);
  bezel.rotation.x = HALF_PI;
  bezel.position.set(0, -0.0001, -(L.d - 0.004) / 2);
  hinge.add(bezel);
  const scr = new Screen(kind, seed);
  const screenMat = new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false, color: lin('#000000') });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(L.w - 0.022, (L.w - 0.022) * (SCR.H / SCR.W)), screenMat);
  picture.rotation.set(HALF_PI, 0, Math.PI);
  picture.position.set(0, -0.0003, -(L.d - 0.004) / 2 - 0.004);
  hinge.add(picture);
  lid.castShadow = lid.receiveShadow = true;
  bezel.receiveShadow = true;
  picture.userData.noShadow = bezel.userData.noShadow = true;
  const state = { k: 0, want: 0, screenT: 0 };
  const api = {
    group: g,
    keyboard: kb,
    screen: scr,
    screenMat,
    kbLocal: new THREE.Vector3(0, L.base - 0.0002 + 0.0011, kbZ),
    padLocal: new THREE.Vector3(-0.03, L.base + 0.0004, -0.0605),
    get isOpen() {
      return state.want === 1;
    },
    setOpen(on) {
      state.want = on ? 1 : 0;
    },
    update(dt, t) {
      const was = state.k;
      state.k = damp(state.k, state.want, 5.5, dt);
      if (Math.abs(state.k - state.want) < 0.002) state.k = state.want;
      if (state.k !== was) hinge.rotation.x = state.k * L.open;
      const lit = clamp((state.k - 0.55) / 0.35, 0, 1);
      screenMat.color.setScalar(lit);
      picture.visible = lit > 0;
      kb.update(dt);
      if (lit > 0) {
        state.screenT -= dt;
        if (state.screenT <= 0) {
          state.screenT = 0.18;
          scr.step();
          scr.draw(t);
          scr.tex.needsUpdate = true;
        }
      }
    },
  };
  return api;
}

/* ---------- the station ---------- */

class Station {
  constructor(spec) {
    this.spec = spec;
    const C = (this.C = colorsOf(spec.color));
    this.idHex = spec.color === 'crimson' ? '#2b2b30' : C.main;
    const g = (this.group = new THREE.Group());
    g.name = 'station:' + spec.id;
    g.rotation.y = spec.yaw != null ? spec.yaw : STATION_YAW;

    // an inlay, not a lit surface: drawn at its exact colour, so the crimson pulse is the brand crimson and never brighter
    this.lineMat = new THREE.MeshBasicMaterial({ color: LINE_NEUTRAL.clone(), toneMapped: false, fog: false });
    this.line = { col: LINE_NEUTRAL.clone() };
    if (spec.rug !== false) {
      // the rug: white wool, a thin inlaid line round its edge
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(RUG_R, RUG_R, 0.012, 128), RUG_MAT);
      rug.position.set(0, 0.006, RUG_Z);
      rug.receiveShadow = true;
      g.add(rug);
      const line = new THREE.Mesh(new THREE.RingGeometry(RUG_R - 0.095, RUG_R - 0.066, 160), this.lineMat); // ~3 cm: reads as a line, not a hairline
      line.rotation.x = -HALF_PI;
      line.position.set(0, 0.0125, RUG_Z);
      line.receiveShadow = true;
      g.add(line);
    } else {
      // the study: no rug, so the same signal runs as a line along the front edge of the desk (the room-facing side)
      const line = new THREE.Mesh(new THREE.BoxGeometry(DESK.w + 0.2, 0.004, 0.028), this.lineMat); // a touch wider than the desk: an inlaid line, not a stray mark
      line.position.set(0, 0.0125, DESK.nearZ + DESK.d + 0.10);
      line.receiveShadow = true;
      g.add(line);
    }

    this._buildDesk(spec);
    this._buildChair();

    this.figure = null;
    this.figureSlot = new THREE.Group();
    this.figureSlot.userData.isSlot = true;
    g.add(this.figureSlot);
    this.chairBack = 0;
    this.activity = 'work';
    this._screenT = 0;
    this.lookYaw = 0;
  }

  _buildDesk(spec) {
    const d = (this.desk = new THREE.Group());
    const T = DESK.top, th = DESK.thick;
    // the top: a white-oak slab, eased top and bottom edges, grain along the length
    const sh = new THREE.Shape();
    const hw = DESK.w / 2, hd = DESK.d / 2, cr = 0.022;
    sh.moveTo(-hw + cr, -hd);
    sh.lineTo(hw - cr, -hd);
    sh.quadraticCurveTo(hw, -hd, hw, -hd + cr);
    sh.lineTo(hw, hd - cr);
    sh.quadraticCurveTo(hw, hd, hw - cr, hd);
    sh.lineTo(-hw + cr, hd);
    sh.quadraticCurveTo(-hw, hd, -hw, hd - cr);
    sh.lineTo(-hw, -hd + cr);
    sh.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
    const bev = 0.0045;
    const topGeo = new THREE.ExtrudeGeometry(sh, { depth: th - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.004, bevelSegments: 3, curveSegments: 6 });
    topGeo.rotateX(-HALF_PI);
    topGeo.translate(0, bev, 0);
    const top = new THREE.Mesh(topGeo, MAT.oak);
    top.position.set(0, T - th, DESK.cz);
    top.userData.collider = null;
    d.add(top);
    // a brushed-aluminium frame set in from the edges, so the top floats on a shadow line
    const FR = { x: hw - 0.07, z0: DESK.nearZ + 0.065, z1: DESK.nearZ + DESK.d - 0.065 };
    const under = T - th;
    for (const sx of [-1, 1]) {
      const x = sx * FR.x;
      // a slim tapered leg front and back, a rail under the top, a sled on the floor
      for (const z of [FR.z0, FR.z1]) {
        const leg = new THREE.Mesh(
          superLoft(
            [
              { p: [x, 0.014, z], a: 0.013, b: 0.019 },
              { p: [x, under * 0.5, z], a: 0.0145, b: 0.022 },
              { p: [x, under - 0.022, z], a: 0.016, b: 0.025 },
            ],
            { segs: 20, n: 4, axis: [0, 1, 0] }
          ),
          MAT.alu
        );
        d.add(leg);
      }
      d.add(placed(new THREE.Mesh(roundedBoxGeometry(0.034, 0.016, FR.z1 - FR.z0 + 0.07, 0.006, 2), MAT.alu), x, 0.008, (FR.z0 + FR.z1) / 2));
      d.add(placed(new THREE.Mesh(roundedBoxGeometry(0.034, 0.03, FR.z1 - FR.z0 + 0.05, 0.005, 2), MAT.alu), x, under - 0.015, (FR.z0 + FR.z1) / 2));
      // levelling glides
      for (const z of [FR.z0 - 0.02, FR.z1 + 0.02]) d.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.004, 14), MAT.alu), x, 0.002, z));
    }
    // a rear stretcher and a cable tray under the back of the top, clear of the knees
    d.add(placed(new THREE.Mesh(roundedBoxGeometry(FR.x * 2, 0.045, 0.02, 0.005, 2), MAT.alu), 0, under - 0.0225, FR.z1 + 0.012));
    const tray = new THREE.Group();
    const tw = 1.0, tz = FR.z1 - 0.06;
    tray.add(placed(new THREE.Mesh(roundedBoxGeometry(tw, 0.003, 0.11, 0.001, 1), FMAT.satinBlack), 0, under - 0.105, tz));
    tray.add(placed(new THREE.Mesh(roundedBoxGeometry(tw, 0.05, 0.003, 0.001, 1), FMAT.satinBlack), 0, under - 0.08, tz - 0.055));
    for (const sx of [-1, 1]) tray.add(placed(new THREE.Mesh(roundedBoxGeometry(0.003, 0.08, 0.11, 0.001, 1), FMAT.satinBlack), sx * (tw / 2), under - 0.065, tz));
    // the bundle of cables lying in it
    tray.add(placed(new THREE.Mesh(capsuleGeometry(0.009, tw - 0.12, 3, 8), FMAT.satinBlack), 0, under - 0.094, tz + 0.01));
    tray.children[tray.children.length - 1].rotation.z = HALF_PI;
    d.add(tray);
    // a cable grommet behind the display
    const grom = new THREE.Vector3(0.24, T, DESK.nearZ + DESK.d - 0.06);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0035, 8, 28), MAT.alu);
    ring.rotation.x = HALF_PI;
    ring.position.set(grom.x, T + 0.0006, grom.z);
    ring.userData.noCollide = true;
    d.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0165, 24), FMAT.port);
    hole.rotation.x = -HALF_PI;
    hole.position.set(grom.x, T + 0.0004, grom.z);
    hole.userData.noCollide = true;
    d.add(hole);
    d.add(placed(contactShadow(DESK.w * 1.2, DESK.d * 1.5, 0.2), 0, 0.016, DESK.cz));

    // the display: one standard model on every desk, angled toward the agent and the room
    const mon = new THREE.Group();
    const MW = 0.62, MH = 0.36, base = 0.13, PD = 0.014;
    const PY = base + MH / 2;
    // [0] the panel: a transparent OLED — a clear pane in a slim aluminium frame, the picture floating in the glass
    // (as the study's board and the wall screens; Igor, Nov 8: every screen is glass)
    const panel = ledFrame(MW, MH, 0.012, PD, MAT.alu);
    panel.position.y = PY;
    mon.add(panel);
    const glass = new THREE.Mesh(roundedBoxGeometry(MW - 0.002, MH - 0.002, 0.0016, 0.0008, 1), MONITOR_GLASS);
    glass.position.z = -PD / 2 - 0.0002;
    panel.add(glass);
    this.screenObj = new Screen(spec.screen || 'code', (spec.seed || 3) * 7);
    const SW = MW - 0.024, SH = SW * (SCR.H / SCR.W);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: this.screenObj.tex, toneMapped: false, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }));
    screen.position.set(0, 0.002, -PD / 2 - 0.0012);
    screen.rotation.y = Math.PI;
    screen.userData.noShadow = true;
    panel.add(screen);
    this.screenMesh = screen;
    const camLed = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 10), new THREE.MeshBasicMaterial({ color: lin('#4cd06e'), toneMapped: false }));
    camLed.position.set(0, MH / 2 - 0.0062, -PD / 2 - 0.0013);
    camLed.rotation.y = Math.PI;
    panel.add(camLed);
    this.camLed = camLed;
    // the electronics live in a chin bar along the bottom of the glass: the input, the power button, a vent line
    const deco = new THREE.Group();
    deco.add(placed(new THREE.Mesh(roundedBoxGeometry(MW, 0.042, PD + 0.006, 0.004, 2), MAT.alu), 0, -MH / 2 + 0.021, 0));
    for (let i = 0; i < 14; i++) deco.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0026, 0.0014), FMAT.port), -0.14 + i * 0.02, -MH / 2 + 0.034, PD / 2 + 0.0034));
    deco.add(placed(new THREE.Mesh(roundedBoxGeometry(0.028, 0.012, 0.004, 0.0015, 1), FMAT.port), 0.06, -MH / 2 + 0.018, PD / 2 + 0.0042));
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.0022, 18), FMAT.port);
    btn.rotation.x = HALF_PI;
    btn.position.set(-MW / 2 + 0.035, -MH / 2 + 0.018, PD / 2 + 0.0041);
    deco.add(btn);
    mergeByMaterial(deco);
    panel.add(deco);
    const cablePort = new THREE.Group();
    cablePort.position.set(0.06, -MH / 2 + 0.018, PD / 2 + 0.006);
    panel.add(cablePort);
    const powerButton = new THREE.Group(); // an anchor on the button (drawn with the chin's details)
    powerButton.position.set(-MW / 2 + 0.035, -MH / 2 + 0.018, PD / 2 + 0.0052);
    panel.add(powerButton);
    // the stand: one bent aluminium blade from the foot to a hinge behind the panel
    const stand = new THREE.Group();
    const hingeY = PY - 0.04, hingeZ = PD / 2 + 0.014;
    stand.add(
      new THREE.Mesh(
        barAlong([[0, 0.006, 0.112], [0, 0.03, 0.128], [0, 0.085, 0.124], [0, 0.16, 0.094], [0, 0.225, 0.058], [0, hingeY - 0.012, hingeZ + 0.006]], 0.062, 0.0042, { n: 8, segs: 16, samples: 28 }),
        MAT.alu
      )
    );
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.128, 24), MAT.alu);
    barrel.rotation.z = HALF_PI;
    barrel.position.set(0, hingeY, hingeZ);
    stand.add(barrel);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.003, 24), MAT.alu);
      cap.rotation.z = HALF_PI;
      cap.position.set(sx * 0.0655, hingeY, hingeZ);
      stand.add(cap);
    }
    mergeByMaterial(stand);
    mon.add(stand);
    const foot = new THREE.Mesh(softBlock(0.18, 0.0065, 0.2, { r: 0.0025, n: 5, segs: 32, edge: 2, rings: 2 }), MAT.alu);
    foot.position.set(0, 0, 0.045);
    mon.add(foot);
    mon.add(placed(contactShadow(0.24, 0.26, 0.3), 0, 0.0008, 0.045));
    mon.position.set(0.07, T, 0.84);
    mon.rotation.y = 0.45;
    // the cable: from the input, down behind the blade, along the desk into the grommet
    mon.updateMatrix();
    const inv = new THREE.Matrix4().copy(mon.matrix).invert();
    const g0 = grom.clone().applyMatrix4(inv);
    const pIn = new THREE.Vector3(0.06, PY - MH / 2 + 0.018, PD / 2 + 0.006);
    const cablePts = [pIn, new THREE.Vector3(0.062, PY - 0.14, 0.04), new THREE.Vector3(0.07, 0.1, 0.14), new THREE.Vector3(0.075, 0.012, 0.16), new THREE.Vector3((0.075 + g0.x) / 2, 0.005, (0.16 + g0.z) / 2), new THREE.Vector3(g0.x, 0.004, g0.z), new THREE.Vector3(g0.x, -0.05, g0.z)];
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 36, 0.0028, 6, false), FMAT.nylon);
    cable.userData.noCollide = true;
    mon.add(cable);
    // only the big pieces cast shadows; the small ones would cost more than they show
    for (const o of [glass, camLed, deco, cable]) o.traverse(m => m.isMesh && (m.userData.noShadow = true));
    mon.userData.keep = true; // stays one piece: it can be lifted, thrown and replaced
    d.add(mon);
    this.monitor = mon;
    this.monitorHome = { pos: mon.position.clone(), rot: mon.rotation.clone() };
    this.monitorParts = { panel, stand, base: foot, cablePort, powerButton, cable, glass, screen };

    // the desk pad: charcoal wool felt under the keyboard and trackpad
    const pad = new THREE.Mesh(softBlock(MAT_PAD.w, MAT_PAD.h, MAT_PAD.d, { r: 0.0014, n: 7, segs: 40, edge: 2, rings: 2, uvScale: 1 }), FMAT.felt);
    pad.position.set(MAT_PAD.x, T, MAT_PAD.z);
    d.add(pad);
    const deskY = T + MAT_PAD.h;
    // the keyboard: a brushed-aluminium wedge, low at the hands, every key its own cap
    const KD = 6 * KEY_U + 0.016, KW = 16 * KEY_U + 0.012, hf = 0.0052, hb = 0.0098;
    const caseGeo = roundedBoxGeometry(KW, hb, KD, 0.0024, 2);
    const cp = caseGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i) + hb / 2, z = cp.getZ(i);
      const h = hf + (hb - hf) * clamp((z + KD / 2) / KD, 0, 1);
      cp.setY(i, y > 0.003 ? y - hb + h : y);
    }
    caseGeo.computeVertexNormals();
    const kcase = new THREE.Mesh(caseGeo, MAT.alu);
    kcase.position.set(KB.x, deskY, KB.z);
    d.add(kcase);
    const rise = (hb - hf) / KD, plateMid = (hf + hb) / 2;
    const kb = buildKeyboard({ pitch: KEY_U, capH: 0.0042, travel: 0.0018, rise, plateY: plateMid - 0.0004 });
    kb.group.position.set(KB.x, deskY, KB.z);
    d.add(kb.group);
    // keys in the station frame (the frame of figure.desk.kb)
    for (const k of kb.keys) {
      k.x += KB.x;
      k.y += deskY;
      k.z += KB.z;
    }
    this.keyboard = kb;
    this.kbTop = deskY + plateMid - 0.0004 + 0.0042;
    // the trackpad: a glass-white wedge
    const tpGeo = roundedBoxGeometry(0.16, 0.0106, 0.115, 0.0024, 2);
    const tpp = tpGeo.attributes.position;
    for (let i = 0; i < tpp.count; i++) {
      const y = tpp.getY(i) + 0.0053, z = tpp.getZ(i);
      const h = 0.0046 + 0.006 * clamp((z + 0.0575) / 0.115, 0, 1);
      tpp.setY(i, y > 0.003 ? y - 0.0106 + h : y);
    }
    tpGeo.computeVertexNormals();
    d.add(placed(new THREE.Mesh(tpGeo, FMAT.trackpad), PAD.x, deskY, PAD.z));
    this.padTop = deskY + 0.0076;

    // name plate: a black block on the room-facing end, white letters that glow
    const np = new THREE.Group();
    const block = new THREE.Mesh(roundedBoxGeometry(0.46, 0.12, 0.055, 0.014, 3), new THREE.MeshPhysicalMaterial({ color: lin('#0b0b0c'), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0, fog: false }));
    np.add(block);
    this.plateTex = plateTexture(spec.name, spec.specialty, '#ffffff', '#ffffff');
    this.plateWaitTex = plateTexture(spec.name, spec.specialty, BRAND.crimson, '#ffffff'); // white letters in a crimson halo: the brand's only red
    this.plateMat = new THREE.MeshBasicMaterial({ map: this.plateTex, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.105), this.plateMat);
    label.position.z = 0.0281;
    label.userData.noShadow = true;
    np.add(label);
    const holder = new THREE.Group();
    holder.add(np);
    np.position.set(0, 0.06, 0);
    np.rotation.x = -0.18;
    holder.position.set(-DESK.w / 2 + 0.06, T, DESK.cz);
    holder.rotation.y = -HALF_PI;
    d.add(holder);
    this.nameplate = holder;

    // the role's object, a notebook and pen, a cup, and a plant on some desks
    if (spec.prop) {
      const pr = deskProp(spec.prop);
      pr.position.set(0.45, T, 0.6);
      d.add(pr);
      this.prop = pr;
    }
    const note = new THREE.Group();
    note.add(placed(new THREE.Mesh(roundedBoxGeometry(0.148, 0.011, 0.21, 0.0025, 2), FMAT.notebook), 0, 0.0055, 0));
    note.add(placed(new THREE.Mesh(roundedBoxGeometry(0.142, 0.009, 0.204, 0.0015, 1), PAPER), 0.002, 0.0055, 0));
    note.add(placed(new THREE.Mesh(roundedBoxGeometry(0.004, 0.0115, 0.21, 0.0015, 1), FMAT.notebook), -0.073, 0.0058, 0));
    const band = new THREE.Mesh(roundedBoxGeometry(0.152, 0.0122, 0.004, 0.0015, 1), FMAT.satinBlack);
    band.position.set(0, 0.006, 0.06);
    note.add(band);
    const pen = new THREE.Mesh(capsuleGeometry(0.0045, 0.13, 4, 10), INK_MAT);
    pen.rotation.set(HALF_PI, 0, 0.25);
    pen.position.set(0.1, 0.006, 0);
    note.add(pen);
    note.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.012, 10), SILVER_MAT), 0.1 + Math.sin(0.25) * 0.06, 0.006, Math.cos(0.25) * 0.06));
    note.children[note.children.length - 1].rotation.set(HALF_PI, 0, 0.25);
    note.position.set(-0.49, T, 0.47);
    note.rotation.y = 0.15;
    d.add(note);
    // a cup on a cork coaster, on desks without a plant
    if ((spec.seed || 0) % 2 === 1) {
      const cup = new THREE.Group();
      cup.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.004, 32), FMAT.cork), 0, 0.002, 0));
      cup.add(placed(new THREE.Mesh(latheFromProfile([[0.0006, 0.004], [0.03, 0.004], [0.036, 0.03], [0.04, 0.085], [0.0375, 0.088], [0.033, 0.03], [0.0006, 0.012]], 24, 32), MAT.ceramic), 0, 0, 0));
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), FMAT.coffee);
      coffee.rotation.x = -HALF_PI;
      coffee.position.y = 0.074;
      cup.add(coffee);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.004, 8, 20, Math.PI * 1.2), MAT.ceramic);
      handle.position.set(0.042, 0.05, 0);
      handle.rotation.z = -Math.PI * 0.6;
      cup.add(handle);
      cup.traverse(o => o.isMesh && (o.userData.noCollide = true));
      cup.position.set(0.5, T, 0.43);
      d.add(cup);
    }
    if ((spec.seed || 0) % 2 === 0) {
      const pl = PLANTS.desk(spec.seed || 1);
      pl.position.set(0.56, T, 0.92);
      d.add(pl);
    }

    shadowAll(d, true, true);
    screen.castShadow = false;
    registerColliders(d, 'desk:' + spec.id, { skip: o => o === screen || o.parent === kb.group });
    mergeByMaterial(d);
    this.group.add(d);
  }

  _buildChair() {
    const c = (this.chair = new THREE.Group());
    const ST = DIM.seatTop;
    // the seat: a contoured cushion in graphite knit with a waterfall front, on a moulded pan
    const seat = new THREE.Mesh(softBlock(0.5, 0.072, 0.48, { r: 0.026, n: 4.2, segs: 32, dish: 0.008, waterfall: 0.022, edge: 3, rings: 3, uvScale: 1 }), FMAT.knit);
    seat.position.set(0, ST - 0.07, 0.02);
    seat.userData.noCollide = true;
    c.add(seat);
    addProxy(c, 0.5, 0.062, 0.48, 0, ST - 0.034, 0.02);
    c.add(placed(new THREE.Mesh(softBlock(0.47, 0.02, 0.45, { r: 0.008, n: 4.2, segs: 28, edge: 2, rings: 2 }), FMAT.nylon), 0, ST - 0.088, 0.02));
    // the mechanism: a cast housing with a height paddle on the right
    c.add(placed(new THREE.Mesh(roundedBoxGeometry(0.2, 0.042, 0.24, 0.012, 2), FMAT.satinBlack), 0, ST - 0.112, 0.0));
    const lever = new THREE.Mesh(barAlong([[-0.1, ST - 0.112, 0.05], [-0.16, ST - 0.114, 0.07], [-0.2, ST - 0.12, 0.085]], 0.006, 0.003, { n: 4, segs: 10, samples: 8, U: [0, 1, 0] }), FMAT.satinBlack);
    lever.userData.noCollide = true;
    c.add(lever);
    // the column: a black sleeve and a polished rod, telescoping
    c.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0285, 0.15, 24), FMAT.satinBlack), 0, 0.105 + 0.075, 0.0));
    c.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, ST - 0.13 - 0.255, 20), FMAT.polished), 0, 0.255 + (ST - 0.13 - 0.255) / 2, 0.0));
    c.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 24), FMAT.satinBlack), 0, 0.258, 0.0));
    // the base: five sculpted polished arms tapering to twin-wheel casters
    c.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.05, 30), FMAT.polished), 0, 0.085, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.PI / 5;
      const dir = [Math.sin(a), Math.cos(a)];
      const at = r => [dir[0] * r, dir[1] * r];
      const arm = new THREE.Mesh(
        superLoft(
          [
            { p: [at(0.03)[0], 0.088, at(0.03)[1]], a: 0.026, b: 0.021 },
            { p: [at(0.14)[0], 0.082, at(0.14)[1]], a: 0.022, b: 0.016 },
            { p: [at(0.25)[0], 0.07, at(0.25)[1]], a: 0.017, b: 0.012 },
            { p: [at(0.3)[0], 0.064, at(0.3)[1]], a: 0.016, b: 0.012 },
          ],
          { segs: 12, n: 3.2, U: [dir[1], 0, -dir[0]] }
        ),
        FMAT.polished
      );
      c.add(arm);
      // the caster: a hooded fork and two wheels
      const cs = new THREE.Group();
      cs.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), FMAT.polished), 0, 0.054, 0));
      cs.add(placed(new THREE.Mesh(softBlock(0.034, 0.022, 0.05, { r: 0.008, n: 3, segs: 12, edge: 1, rings: 1 }), FMAT.nylon), 0, 0.03, -0.006));
      for (const sx of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.011, 14), FMAT.nylon);
        wh.rotation.z = HALF_PI;
        wh.position.set(sx * 0.0115, 0.024, 0.004);
        cs.add(wh);
      }
      cs.position.set(at(0.31)[0], 0, at(0.31)[1]);
      cs.rotation.y = a + Math.PI;
      cs.traverse(o => o.isMesh && (o.userData.noCollide = true));
      c.add(cs);
    }
    // the back: tensioned graphite knit on a slim frame, gently wrapped, with a lumbar pad
    const back = new THREE.Group();
    back.add(new THREE.Mesh(softBlock(0.46, 0.042, 0.52, { r: 0.016, n: 3.6, segs: 30, bendY: 0.035, crown: 0.006, edge: 3, rings: 3 }), FMAT.knit));
    back.children[0].rotation.x = HALF_PI;
    back.add(placed(new THREE.Mesh(softBlock(0.3, 0.014, 0.075, { r: 0.006, n: 3.5, segs: 24, bendY: 0.02, edge: 2, rings: 2 }), FMAT.nylon), 0, -0.14, 0.036));
    back.children[1].rotation.x = HALF_PI;
    back.children.forEach(o => (o.userData.noCollide = true));
    addProxy(back, 0.46, 0.52, 0.042, 0, 0, 0.021);
    addProxy(back, 0.3, 0.075, 0.016, 0, -0.14, 0.044);
    back.position.set(0, ST + 0.39, -0.245);
    back.rotation.x = -0.1;
    c.add(back);
    // A real mount bridges the spine and the rear of the raked backrest.
    const mount = new THREE.Mesh(roundedBoxGeometry(0.10, 0.12, 0.018, 0.007, 3), FMAT.polished);
    mount.position.set(0, -0.14, -0.004);back.add(mount);
    back.updateMatrix();
    const attachment = new THREE.Vector3(0, -0.15, -0.008).applyMatrix4(back.matrix);
    const spine = new THREE.Mesh(barAlong([[0, ST - 0.112, -0.08], [0, ST - 0.1, -0.2], [0, ST - 0.04, -0.285], [0, ST + 0.09, -0.3], attachment.toArray()], 0.026, 0.0075, { n: 4, segs: 12, samples: 18 }), FMAT.polished);
    spine.userData.noCollide = true;
    c.add(spine);
    addProxy(c, 0.052, 0.018, 0.2, 0, ST - 0.104, -0.17);
    addProxy(c, 0.052, 0.3, 0.07, 0, ST + 0.05, -0.27);
    // the arms: slim posts and soft pads, set wide and low, clear of a typing elbow
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(barAlong([[sx * 0.09, ST - 0.112, -0.03], [sx * 0.22, ST - 0.108, -0.04], [sx * 0.29, ST - 0.07, -0.045], [sx * 0.3, ST + 0.06, -0.04], [sx * 0.3, ST + 0.17, -0.03]], 0.014, 0.011, { n: 3, segs: 10, samples: 12, U: [0, 0, 1] }), FMAT.satinBlack);
      post.userData.noCollide = true;
      c.add(post);
      addProxy(c, 0.2, 0.026, 0.03, sx * 0.19, ST - 0.11, -0.036);
      addProxy(c, 0.03, 0.25, 0.03, sx * 0.3, ST + 0.045, -0.04);
      const armPad = new THREE.Mesh(softBlock(0.075, 0.026, 0.24, { r: 0.011, n: 3.4, segs: 20, edge: 2, rings: 2 }), FMAT.nylon);
      armPad.position.set(sx * 0.3, ST + 0.17, -0.02);
      c.add(armPad);
    }
    c.add(placed(contactShadow(0.75, 0.75, 0.28), 0, 0.016, 0.0));
    shadowAll(c, true, true);
    registerColliders(c, 'chair:' + this.spec.id);
    dropProxies(c);
    mergeByMaterial(c);
    this.group.add(c);
  }

  seat(figure) {
    this.figure = figure;
    this.figureSlot.add(figure.root);
    figure.root.position.set(0, 0, 0);
    // edge: the desk top as a solid for the arms (near edge z, top y, width, thickness), in the same frame as kb and pad
    figure.desk = { kb: new THREE.Vector3(KB.x, this.kbTop, KB.z), pad: new THREE.Vector3(PAD.x, this.padTop, PAD.z), keyboard: this.keyboard || null, edge: { z: DESK.nearZ, y: DESK.top, w: DESK.w, thick: DESK.thick } };
    figure.station = this;
    // a bot without legs (hover, ball, tracks) works at the desk without a chair: the chair goes, and so do its colliders
    if (figure.noChair && this.chair && this.chair.visible) {
      this.chair.visible = false;
      COLLIDERS.list = COLLIDERS.list.filter(c => c.tag !== 'chair:' + this.spec.id);
    }
    const blob = contactShadow(0.8, 0.8, 0.28);
    blob.position.set(0, 0.017, 0.15);
    figure.root.add(blob);
  }

  /** Kept for the status layer; the floor signal is the rug line (see update). */
  setRing() {}
  /** 'work' | 'browse' | 'think' | 'wait' | 'idle' | 'away' | 'paused' */
  setActivity(kind) {
    if (this.activity === kind) return;
    this.activity = kind;
    this.screenObj.state = kind === 'browse' ? 'work' : kind;
    this._screenT = 0;
  }

  update(dt, t) {
    // the rug line: quiet; the agent's colour while hovered or selected; a crimson pulse when Igor is needed
    const id = this.spec.id;
    const need = typeof OFFICE_STATE !== 'undefined' ? needsOwner(id) : 0;
    const focus = typeof UI !== 'undefined' && (UI.selected === id || UI.hoverId === id);
    let target = LINE_NEUTRAL;
    if (need) {
      // a slow breath between a deeper crimson and #a70008 itself (urgent: quicker and deeper)
      const beat = REDUCED_MOTION ? 0.6 : 0.5 + 0.5 * Math.sin(t * (need === 2 ? 3.4 : 1.6));
      target = this._crimsonBeat || (this._crimsonBeat = new THREE.Color());
      target.copy(lin(BRAND.crimson)).multiplyScalar(need === 2 ? 0.55 + 0.45 * beat : 0.72 + 0.28 * beat);
    } else if (focus) target = lin(this.idHex);
    this.line.col.lerp(target, 1 - Math.exp(-8 * dt));
    this.lineMat.color.copy(this.line.col);

    // the keys: the robot's fingers press them (keyboard.press); if nobody has for a moment, the hands' strikes do
    const fig = this.figure;
    const home = fig && fig.root.parent === this.figureSlot;
    const typing = home && (fig.mode === 'type' || fig.mode === 'browse');
    const kb = this.keyboard;
    if (typing && performance.now() - kb.lastPress > 600) {
      const st = fig.strike || {};
      if (st.L && !this._strL) kb.press(KEY_HANDS.L[Math.floor(Math.random() * KEY_HANDS.L.length)], true);
      if (st.R && !this._strR) kb.press(Math.random() < 0.18 ? KEY_HANDS.space : KEY_HANDS.R[Math.floor(Math.random() * KEY_HANDS.R.length)], true);
      this._strL = st.L;
      this._strR = st.R;
    }
    kb.update(dt);

    // the screen moves with the work
    this._screenT -= dt;
    if (this._screenT <= 0) {
      const live = this.activity === 'work' || this.activity === 'browse';
      this._screenT = this.activity === 'away' && !REDUCED_MOTION ? 1 / 12 : live ? 0.16 : 0.9;
      if (live) this.screenObj.step();
      this.screenObj.draw(t);
      this.screenObj.tex.needsUpdate = true;
    }
    this.camLed.visible = this.activity === 'work' || this.activity === 'browse' || this.activity === 'wait';
    this.camLed.material.color.copy(lin(this.activity === 'wait' && Math.sin(t * 7) > 0 ? BRAND.crimson : '#4cd06e'));
    // the name plate: steady white; crimson and breathing while Igor is needed
    const wantWait = need === 2;
    if ((this.plateMat.map === this.plateWaitTex) !== wantWait) {
      this.plateMat.map = wantWait ? this.plateWaitTex : this.plateTex;
      this.plateMat.needsUpdate = true;
    }
    this.plateMat.color.setScalar(wantWait ? 0.78 + 0.22 * Math.sin(t * 3.4) : this.activity === 'away' || this.activity === 'paused' ? 0.62 : 0.86);
    if (this.prop && this.prop.userData.led) this.prop.userData.led.visible = Math.sin(t * 1.2) > -0.6;

    // the chair rolls back when the agent stands or is away from the desk; pushed or pulled, it rolls and swivels with its bot
    const standing = !fig || !home || ['stand', 'wave', 'look', 'walk', 'lift', 'slam', 'upset'].includes(fig.mode);
    const push = home && !standing && fig.push ? fig.push : null;
    const px = push ? push.x : 0, pz = push ? push.z : 0, pyaw = push ? push.yaw : 0;
    this.chairBack = damp(this.chairBack, standing ? CHAIR_BACK : 0, 5, dt);
    this.chair.position.set(px, 0, this.chairBack + pz);
    this.chair.rotation.y = this.chairBack * 0.45 + pyaw;
    if (home) {
      const rr = fig.root;
      this._rootZ = damp(this._rootZ == null ? rr.position.z : this._rootZ, standing ? (fig.noChair ? -0.24 : -0.03) : 0, 5, dt); // a chairless bot backs off the desk to stand
      this._rootYaw = damp(this._rootYaw == null ? rr.rotation.y : this._rootYaw, standing ? this.lookYaw || 0 : 0, 3.5, dt); // turns to the owner only once up from the chair
      rr.position.x = px;
      rr.position.z = this._rootZ + pz;
      rr.rotation.y = this._rootYaw + pyaw;
    } else this._rootZ = this._rootYaw = null;
  }
}
