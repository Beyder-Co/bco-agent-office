/* =============================================================================
   55 · THE VIEW — from the Palisades at Fort Lee, down the Hudson to Manhattan
   -----------------------------------------------------------------------------
   The office is the top floor of a tower on the cliff in Fort Lee, Bergen County,
   a few hundred metres north of the George Washington Bridge. In front: the edge
   of the Palisades under its trees, the Hudson eighty metres below, the bridge,
   Washington Heights across the water and, down the river, Midtown and the World
   Trade Center. Behind: Fort Lee and Englewood Cliffs under their canopy.

   Places come from real coordinates, laid out in river-frame metres (s runs
   downstream, c across toward Manhattan) and turned so the default view looks
   down the river (real south-south-east). Anything farther than 1.6 km is drawn
   pulled in toward the room along its own line of sight — its direction and
   angular size stay exact — so the World Trade Center, 17 km out, fits inside
   the camera's 5 km; haze, light and every pattern use the real distances.
   The sun, the sky, the haze, the lit windows and the colour of the trees follow
   the real date and time over Fort Lee (?time=21:30 previews another hour).
   ============================================================================= */

const SKY = {
  mesh: null,
  common: null,
  skyU: null,
  cityMat: null,
  groundMat: null,
  waterMat: null,
  next: 0,
  override: null,
  state: { el: 0.6, night: 0 },
  info: null,
};

const CITY = (() => {
  /* ---------- geography ---------- */
  const DEG = Math.PI / 180;
  const GEO = {
    R: 150 * DEG, // world azimuth = real azimuth − R (the default view looks down the river)
    G: -124, // the cliff top under our tower (world y)
    yW: -204, // the Hudson
    sB: 600, // the George Washington Bridge crosses here …
    t1: 230,
    t2: 1297, // … its towers (c) …
    a1: 44,
    a2: 1495, // … and its anchorages
    ref: [40.857, -73.9585],
    shift: [252, 62], // real coordinates → this frame
    C0: [0, 8, 0], // the room: far things are drawn pulled in toward it
  };
  const SD = [Math.sin(55 * DEG), -Math.cos(55 * DEG)]; // downstream (real 205°), world xz
  const CD = [Math.sin(-35 * DEG), -Math.cos(-35 * DEG)]; // across, toward Manhattan (real 115°)
  const RIVER_ROT = 35 * DEG; // a box turned this much is square to the river and Manhattan's grid
  const NJ_ROT = -30 * DEG; // Fort Lee's streets run true north–south
  const toW = (s, c) => [s * SD[0] + c * CD[0], s * SD[1] + c * CD[1]];
  const toSC = (x, z) => [x * SD[0] + z * SD[1], x * CD[0] + z * CD[1]];
  function llToSC(lat, lon) {
    const N = (lat - GEO.ref[0]) * 111200;
    const E = (lon - GEO.ref[1]) * 84220;
    return [E * -0.42262 + N * -0.90631 + GEO.shift[0], E * 0.90631 + N * -0.42262 + GEO.shift[1]];
  }

  const bump = (x, a, b, e) => smooth(a - e, a + e, x) * (1 - smooth(b - e, b + e, x));
  const drift = s => -70 * smooth(2000, 12000, s) + 980 * Math.pow(smooth(11500, 17200, s), 1.25);
  /** Manhattan's (and, upstream, the Bronx's) water's edge. Jeffrey's Hook carries the bridge's New York tower. */
  const cMan = s => 1370 + drift(s) + 26 * Math.sin(s / 700 + 1.1) + 9 * Math.sin(s / 230 + 0.3) - 150 * Math.exp(-(((s - 540) / 150) ** 2));
  /** New Jersey's water's edge. */
  const cJer = s => 176 + drift(s) - 140 * smooth(3000, 12000, s) + 12 * Math.sin(s / 260 + 0.4) + 7 * Math.sin(s / 90 + 2.0) + 18 * Math.sin(s / 1300 + 0.2);
  /** The shelf between the foot of the cliff and the water: narrow here, Edgewater's flats downstream, Hoboken's beyond. */
  const njStrip = s => 112 + 340 * bump(s, 2700, 7400, 700) + 120 * smooth(8500, 11000, s) + 1300 * smooth(11500, 13500, s);
  const cCliff = s => cJer(s) - njStrip(s);
  /** The Palisades above the river: 80 m at Fort Lee, higher toward Alpine, lower toward Jersey City. */
  const cliffH = s => 80 + 45 * smooth(-1500, -9000, s) - 25 * smooth(7000, 11000, s) - 15 * smooth(12000, 15000, s);
  const BATTERY = 17150;
  const isWater = (s, c) => (c > cJer(s) && c < cMan(s)) || (s > BATTERY && c >= cMan(s) && c < cMan(s) + 2400);

  // Manhattan behind its shore: the ridge's height, the bluff's width, where the island ends to the east
  const NY_RIDGE = [[-12000, 72], [-3150, 70], [-2900, 10], [-2620, 52], [-1500, 48], [-1260, 20], [-980, 66], [-250, 64], [600, 60], [2300, 52], [3000, 40], [3880, 30], [4120, 8], [4420, 8], [4650, 32], [5500, 30], [6200, 22], [9400, 14], [12000, 9], [26000, 5]];
  const NY_BLUFF = [[-12000, 170], [-2950, 160], [-2850, 60], [-2600, 160], [-300, 150], [2500, 130], [3900, 120], [4100, 60], [4500, 60], [4700, 130], [6000, 150], [8800, 110], [9500, 45], [26000, 35]];
  const NY_EAST = [[-12000, 2800], [-2950, 1400], [-1250, 1500], [-1000, 1880], [2650, 1880], [2900, 2400], [3950, 2400], [4200, 2950], [5650, 2950], [5900, 3350], [9800, 3350], [10000, 3050], [12700, 3050], [13000, 2900], [15700, 2900], [17150, 1000], [26000, 1000]];
  function table(T, s) {
    if (s <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) if (s <= T[i][0]) return lerp(T[i - 1][1], T[i][1], smooth(T[i - 1][0], T[i][0], s));
    return T[T.length - 1][1];
  }
  /** Where Manhattan's avenue grid starts, measured from the water's edge (Riverside Drive up on the bluff; 12th Avenue in Midtown). */
  const aveBase = s => (s < 9500 ? 42 + table(NY_BLUFF, s) + 30 : 62);

  // a little value noise on the CPU (woodlots, lots)
  const hashJS = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  function vnoiseJS(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hashJS(xi, yi), hashJS(xi + 1, yi), u), lerp(hashJS(xi, yi + 1), hashJS(xi + 1, yi + 1), u), v);
  }
  const fbmJS = (x, y) => (vnoiseJS(x, y) * 0.5 + vnoiseJS(x * 2.03 + 7.1, y * 2.03 + 3.3) * 0.25 + vnoiseJS(x * 4.1 + 1.7, y * 4.1 + 9.2) * 0.125) / 0.875;

  function njRelief(s, c) {
    const r = Math.hypot(s, c);
    const n = 4 * Math.sin(s / 410 + 1.2) * Math.sin(c / 330 + 0.4) + 2.5 * Math.sin((s + c) / 170);
    return n * smooth(150, 450, r) - 42 * smooth(-1300, -6000, c);
  }
  /** The ground's height (world y) anywhere; under the river, its bed. */
  function landY(s, c) {
    const yW = GEO.yW, cj = cJer(s);
    if (c < cj + 2) {
      const cl = cj - njStrip(s), H = cliffH(s);
      const top = yW + H + njRelief(s, c);
      if (c <= cl) return top;
      const t = c - cl, foot = Math.min(H * 0.32, 26);
      if (t < 9) return lerp(top, yW + foot, Math.pow(smooth(0, 9, t), 0.85)); // the basalt face
      if (t < 79) return lerp(yW + foot, yW + 3.5, smooth(9, 79, t)); // the talus
      return lerp(yW + 3.5, yW - 7, smooth(cj - 8, cj + 3, c)); // the shelf and the bank
    }
    const cm = cMan(s);
    if (c <= cm - 2) return yW - 10;
    const t = c - cm;
    if (s > BATTERY && t < 2400) return yW - 10; // the harbour, past the Battery
    const ridge = table(NY_RIDGE, s), bw = table(NY_BLUFF, s);
    const y = yW + lerp(-7, 3.5, smooth(-3, 6, t)) + (ridge - 3.5) * Math.pow(smooth(42, 42 + bw, t), 1.15);
    const hr = (1 - smooth(3600, 4300, s)) * bump(t, 1830, 2080, 110) * smooth(-2950, -2700, s); // the Harlem River's valley
    return lerp(y, yW + 1.5, hr);
  }
  const pip = s => cCliff(s) - 98 + 22 * Math.sin(s / 330 + 0.6); // the Palisades Interstate Parkway

  /** forest, rock, town, lawn | grid (0 NJ, 1 NY), road, avenue coordinate, forecourt */
  function landAttrs(s, c) {
    const cj = cJer(s), cm = cMan(s);
    let f = 0, r = 0, u = 0, l = 0, grid = 0, road = 0, ave = 0, plaza = 0;
    if (c < cj + 2) {
      const cl = cj - njStrip(s);
      if (c <= cl + 1) {
        const parkN = s < 380 && c > cl - 175 - 25 * Math.sin(s / 200);
        const parkFL = s > 690 && s < 1060 && c > cl - 150;
        if (parkN || parkFL) f = 1;
        else {
          f = smooth(0.56, 0.7, fbmJS(s / 240 + 3.1, c / 240 + 7.7)) * 0.85;
          u = 1 - f;
        }
        if (c < cl - 4 && Math.abs(s - GEO.sB) < 34 + 46 * smooth(-200, -420, c)) (road = 1), (f = 0), (u = 1);
        if (s < 470 && Math.abs(c - pip(s)) < 12) (road = 1), (f = 0.2), (u = 0.8);
        if (Math.hypot(s, c) < 58) (plaza = 1), (f = 0), (u = 0), (l = 1);
      } else if (c < cl + 9) r = 1;
      else if (c < cl + 79) (f = 0.85), (r = 0.15);
      else if (c < cj - 6) {
        if (njStrip(s) > 220) u = 1;
        else (l = 0.55), (r = 0.45);
      } else r = 1;
    } else if (c > cm - 2) {
      grid = 1;
      const t = c - cm, bw = table(NY_BLUFF, s);
      ave = t - aveBase(s);
      if (s > BATTERY && t < 2400) r = 1;
      else if (t < 8) r = 1;
      else if (t < 42) {
        (l = 0.65), (r = 0.35);
        if (Math.abs(t - 24) < 11 && s < 15500) road = 1;
      } else if (t < 42 + bw && s < 9450) {
        f = 1;
        if (s < -2950) (f = 0.85), (u = 0.15);
      } else {
        u = 1;
        if (s > -2560 && s < -300 && t < 660) (f = 1), (u = 0); // Inwood Hill, Fort Tryon
        if (s > 5900 && s < 10000 && t > 1400 && t < 2200) (f = 0.6), (l = 0.4), (u = 0); // Central Park
        if (s < -2950) (f = 0.55), (u = 0.45); // Riverdale's wooded hills
        if (s > -1000 && s < 2650 && t > 1720 && t < 1880) (f = 0.8), (u = 0.2); // Highbridge Park
      }
    } else r = 1;
    return [f, r, u, l, grid, road, ave, plaza];
  }

  /* ---------- shaders ---------- */
  const NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= 0.5;
  }
  return s / 0.875;
}`;

  // far things pulled in toward the room along their line of sight (and dropped by the earth's curve)
  const VERT = `
uniform vec3 uC0;
vec3 compressP(vec3 w) {
  vec2 o = w.xz - uC0.xz;
  float d = length(o);
  w.y -= d * d * 6.75e-8;
  if (d <= 1600.0) return w;
  float x = d - 1600.0;
  float f = 1600.0 + 0.1 * x + 540.0 * (1.0 - exp(-x / 600.0));
  return uC0 + (w - uC0) * (f / d);
}`;

  const FRAG = `
uniform vec3 uC0;
uniform vec3 uTop;
uniform vec3 uHor;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uBounce;
uniform vec3 uCityGlow;
uniform vec2 uCityDir;
uniform float uDusk;
uniform float uNight;
uniform float uVis;
uniform float uTime;
uniform float uLit;
uniform vec3 uMoonDir;
uniform float uMoonLit;
uniform float uCloud;
${NOISE}
vec3 toLin(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
// the sky's colour in a direction (sRGB, as the sky dome draws it; no sun disc, no clouds)
vec3 skyCol(vec3 d) {
  float h = max(d.y, 0.0);
  vec3 col = mix(uHor, uTop, pow(h, 0.5));
  vec2 dxz = normalize(d.xz + vec2(1e-5, 0.0));
  vec2 sxz = normalize(uSunDir.xz + vec2(1e-5, 0.0));
  float side = max(dot(dxz, sxz), 0.0);
  col += uGlow * pow(side, 3.0) * pow(1.0 - h, 6.0) * uDusk * 0.6;
  float s = max(dot(d, uSunDir), 0.0);
  col += uGlow * pow(s, 40.0) * 0.18 * step(-0.05, uSunDir.y);
  col += uCityGlow * (0.35 + 0.65 * smoothstep(-0.4, 0.8, dot(dxz, uCityDir))) * pow(1.0 - h, 6.0) * uNight;
  return col;
}
// aerial perspective: how much of a surface survives the air between it and the eye (real distances)
float hazeT(vec3 wp) {
  float d = distance(wp, cameraPosition);
  float dens = mix(0.45, 1.0, exp(-max(wp.y + 204.0, 0.0) / 500.0));
  return exp(-d * dens / uVis) * (1.0 - smoothstep(15000.0, 25000.0, d));
}
// applied after tone mapping, in sRGB, so the far city melts exactly into the sky behind it
vec3 hazeOf(vec3 wp, vec3 srgb) {
  vec3 v = normalize(wp - cameraPosition);
  vec3 hz = skyCol(normalize(vec3(v.x, max(v.y, 0.0) * 0.3 + 0.01, v.z)));
  return mix(hz, srgb, hazeT(wp));
}`;

  const FOLIAGE = `
uniform float uFall;
uniform float uBare;
uniform float uSpring;
// a tree's colour for the season: oaks, maples, beeches and tulip trees; a few evergreens
vec3 foliage(float h) {
  vec3 summer = mix(vec3(0.035, 0.062, 0.02), vec3(0.065, 0.095, 0.03), fract(h * 7.31));
  float k = fract(h * 13.77);
  vec3 fall = k < 0.14 ? vec3(0.30, 0.115, 0.032) : k < 0.24 ? vec3(0.21, 0.055, 0.03) : k < 0.42 ? vec3(0.29, 0.20, 0.045) : k < 0.82 ? vec3(0.13, 0.072, 0.032) : vec3(0.075, 0.08, 0.032);
  vec3 c = mix(mix(summer, fall, uFall), vec3(0.09, 0.13, 0.04), uSpring);
  float evergreen = step(fract(h * 3.97), 0.13);
  float bare = step(fract(h * 5.13), uBare) * (1.0 - evergreen);
  c = mix(c, vec3(0.085, 0.072, 0.062), bare);
  return mix(c, vec3(0.022, 0.04, 0.028), evergreen);
}`;

  const PULSE = `
float pulseI(float x, float d) { return floor(x) * d + min(fract(x), d); }
// a box-filtered train of pulses (duty d per unit): stripes that average out, not shimmer, when they shrink below a pixel
float pulseAA(float x, float d, float w) { w = max(w, 1e-4); return (pulseI(x + 0.5 * w, d) - pulseI(x - 0.5 * w, d)) / w; }`;

  const OUT = `
  #include <tonemapping_fragment>
  #include <encodings_fragment>`;

  /* buildings: one instanced box per block of masonry or glass, landmarks merged */
  const BLD_VERT_INST = `
attribute vec4 aData;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vData;
varying vec4 vExtra;
varying float vTop;
${VERT}
void main() {
  mat4 im = instanceMatrix;
  vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
  vec4 w = modelMatrix * im * vec4(position, 1.0);
  vTop = (modelMatrix * im * vec4(0.0, 1.0, 0.0, 1.0)).y;
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * (mat3(im) * (normal / (sc * sc))));
  vData = aData;
  vExtra = vec4(0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const BLD_VERT_MERGED = `
attribute vec4 aData;
attribute vec4 aExtra;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vData;
varying vec4 vExtra;
varying float vTop;
${VERT}
void main() {
  vTop = 1e5; // (the landmarks are modelled, crowns and all)
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vData = aData;
  vExtra = aExtra;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const BLD_FRAG = `
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vData;
varying vec4 vExtra;
varying float vTop;
${FRAG}
vec3 pal(float i) {
  if (i < 0.5) return vec3(0.40, 0.355, 0.29);   // limestone
  if (i < 1.5) return vec3(0.56, 0.53, 0.48);    // white brick, pale stone
  if (i < 2.5) return vec3(0.15, 0.20, 0.25);    // blue-grey glass
  if (i < 3.5) return vec3(0.055, 0.065, 0.075); // dark glass
  if (i < 4.5) return vec3(0.25, 0.105, 0.065);  // red-brown brick
  if (i < 5.5) return vec3(0.11, 0.11, 0.11);    // graphite stone
  if (i < 6.5) return vec3(0.33, 0.32, 0.30);    // concrete
  if (i < 7.5) return vec3(0.39, 0.29, 0.19);    // buff brick
  if (i < 8.5) return vec3(0.12, 0.18, 0.17);    // green glass
  if (i < 9.5) return vec3(0.25, 0.29, 0.32);    // silver glass
  if (i < 10.5) return vec3(0.34, 0.19, 0.11);   // terracotta, bronze
  if (i < 11.5) return vec3(0.52, 0.53, 0.55);   // stainless steel
  if (i < 12.5) return vec3(0.16, 0.28, 0.22);   // copper gone green
  if (i < 13.5) return vec3(0.42, 0.06, 0.04);   // red paint
  return vec3(0.3);
}
float box2(vec2 f, vec2 e, vec4 r) {
  return smoothstep(r.x - e.x, r.x + e.x, f.x) * (1.0 - smoothstep(r.y - e.x, r.y + e.x, f.x))
       * smoothstep(r.z - e.y, r.z + e.y, f.y) * (1.0 - smoothstep(r.w - e.y, r.w + e.y, f.y));
}
void main() {
  vec3 n = normalize(vN);
  float seed = vData.x;
  float palId = mod(vData.y, 16.0);
  float fl = floor(vData.y / 16.0 + 0.01);
  float resi = mod(fl, 2.0);
  float dense = mod(floor(fl / 2.0), 2.0);
  float crown = mod(floor(fl / 4.0), 2.0);
  float dark = mod(floor(fl / 8.0), 2.0);
  float own = mod(floor(fl / 16.0), 2.0);
  float style = vData.z;
  float hg = vWorld.y - vData.w;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 base = pal(palId) * (0.85 + 0.3 * hash12(vec2(seed, 3.1)));

  // light: the sky, the sun, the street's bounce; in dense blocks the neighbours' shade climbs the walls
  float ndl = max(dot(n, uSunDir), 0.0);
  float faceK = hash12(vec2(seed, floor(n.x * 2.0 + n.z * 5.0 + 9.0)));
  float shH = dense > 0.5 ? 20.0 + 120.0 * faceK : 14.0 * faceK;
  float shadow = smoothstep(shH - 5.0, shH + 5.0, hg);
  float ao = mix(dense > 0.5 ? 0.36 : 0.6, 1.0, smoothstep(0.0, dense > 0.5 ? 120.0 : 24.0, hg));
  vec3 amb = (uSkyCol * (0.62 + 0.38 * n.y) + uBounce * (1.0 - abs(n.y)) * 0.3) * ao;
  vec3 light = amb + uSunCol * ndl * shadow;

  vec3 col;
  if (n.y > 0.6) {
    // roofs: membrane and gravel, now and then a garden; a few lamps after dark
    float r = hash12(vec2(seed, 9.1));
    vec3 roof = mix(vec3(0.27, 0.265, 0.255), vec3(0.15, 0.15, 0.15), hash12(vec2(seed, 1.7)));
    if (r > 0.88) roof = vec3(0.09, 0.13, 0.05);
    if (style > 5.5 && style < 6.5) roof = mix(roof, base, 0.6);
    col = roof * (0.86 + 0.28 * vnoise(vWorld.xz * 0.35)) * light;
    col += vec3(1.0, 0.8, 0.55) * step(0.991, hash12(floor(vWorld.xz * 0.3) + seed)) * uNight * 1.2 * (1.0 - dark);
  } else if (n.y < -0.6) {
    col = base * 0.2 * amb;
  } else {
    vec2 tng = normalize(vec2(-n.z, n.x));
    float along = dot(vWorld.xz, tng) + seed * 3.7;
    float office = 1.0 - resi;
    float fh = style < 0.5 ? 3.9 : (style > 2.5 && style < 3.5 ? 3.75 : mix(3.05, 3.6, office));
    float bay = style < 0.5 ? 1.55 : style < 1.5 ? 3.2 : style < 2.5 ? 2.3 : style < 3.5 ? 3.1 : style < 4.5 ? 3.6 : style < 5.5 ? 2.0 : style < 6.5 ? 10.0 : style < 7.5 ? 1.0 : 1.5;
    vec2 cell = vec2(along / bay, hg / fh);
    vec2 id = floor(cell);
    vec2 f = fract(cell);
    vec2 fw = fwidth(cell);
    vec2 e = max(fw * 0.7, vec2(0.002));
    float aa = clamp(1.7 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
    float win;
    float avg;
    if (style < 0.5) { win = box2(f, e, vec4(0.05, 0.95, 0.12, 0.97)); avg = 0.76; }        // curtain wall
    else if (style < 1.5) { win = box2(f, e, vec4(-0.1, 1.1, 0.40, 0.92)); avg = 0.52; }    // ribbon windows
    else if (style < 2.5) { win = box2(f, e, vec4(0.28, 0.72, 0.24, 0.80)); avg = 0.25; }   // punched, pre-war
    else if (style < 3.5) { win = box2(f, e, vec4(0.15, 0.85, 0.15, 0.85)); avg = 0.49; }   // a concrete grid
    else if (style < 4.5) { win = box2(f, e, vec4(0.06, 0.94, 0.34, 0.86)); avg = 0.46; }   // balcony bands
    else if (style < 5.5) { win = box2(f, e, vec4(0.32, 0.88, 0.12, 0.88)); avg = 0.42; }   // deco piers
    else if (style < 6.5) { win = 0.0; avg = 0.0; }                                          // plain
    else if (style < 7.5) { win = box2(f, e, vec4(0.45, 0.95, 0.05, 0.97)); avg = 0.48; }   // fine ribs
    else { win = box2(f, e, vec4(-0.1, 1.1, 0.55, 0.95)); avg = 0.40; }                     // a screen of rods
    win = mix(avg, win, aa);
    float ground = 1.0 - smoothstep(fh * 1.15, fh * 1.35, hg);
    // glass: the sky above, the city across below, a glint of sun
    vec3 R = reflect(-V, n);
    vec3 skyR = toLin(skyCol(normalize(vec3(R.x, abs(R.y) + 0.01, R.z))));
    float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
    float up = smoothstep(-0.08, 0.3, R.y) * smoothstep(0.0, 90.0, hg);
    vec3 refl = mix(vec3(0.028, 0.03, 0.033) + skyR * 0.12, skyR, mix(0.3, 1.0, up));
    float curtain = step(style, 0.5);
    float rk = mix(mix(0.1, 0.5, fres), mix(0.24, 0.9, fres), curtain);
    vec3 tint = mix(vec3(0.025, 0.03, 0.035), base, curtain);
    vec3 glass = tint * light * 0.4 + refl * rk;
    float sp = max(dot(R, uSunDir), 0.0);
    glass += uSunCol * (pow(sp, 220.0) * 3.0 + pow(sp, 14.0) * 0.08) * shadow * mix(0.35, 1.0, curtain);
    // after dark: rooms lit, warm at home, cooler in offices, fewer after midnight
    // far off, whole clusters of windows share one coin toss, so the city sparkles instead of glowing grey
    float roomW = style < 0.5 ? 3.0 : style > 6.5 && style < 7.5 ? 4.0 : 2.0;
    float camD = distance(vWorld, cameraPosition);
    vec2 lvl = (camD < 450.0 ? vec2(1.0) : exp2(ceil(log2(max(fw * 1.6, vec2(1.0)))))) * vec2(roomW, 1.0);
    vec2 lid = floor(cell / lvl);
    float r = hash12(lid + vec2(seed * 7.13, seed * 3.71));
    float lit = step(1.0 - uLit * mix(1.1, 0.5, office), r) * step(1.0, id.y) * (1.0 - dark);
    vec3 warm = mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.7, 0.42), hash12(id * 1.31 + seed));
    vec3 cool = mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.8, 0.55), hash12(id * 1.31 + seed));
    vec3 lamp = mix(warm, cool, office * 0.7);
    // a room seen from outside: brighter under the ceiling, a blind or a dark corner now and then
    float room = mix(mix(0.5, 1.0, smoothstep(0.1, 0.9, f.y)) * mix(0.55, 1.0, step(0.3, hash12(id * 3.7 + seed))), 1.0, 1.0 - aa);
    float on = mix(uLit * mix(1.0, 0.55, office) * (1.0 - dark), lit, camD < 450.0 ? aa : mix(0.45, 1.0, aa)) * smoothstep(0.3, 0.95, uNight);
    vec3 winCol = glass * mix(1.0, 0.35, uNight) + lamp * on * room * (0.45 + 0.5 * hash12(lid * 2.1 + seed)) * 0.95;
    // Façade joints, window reveals, and individual blind levels resolve only nearby.
    float brickRow=hg/.24, brickX=along/.55+mod(floor(brickRow),2.)*.5;
    float mortar=max(1.-smoothstep(.025,.025+fwidth(brickRow),abs(fract(brickRow)-.5)),1.-smoothstep(.025,.025+fwidth(brickX),abs(fract(brickX)-.5)));
    float masonry=step(1.5,style)*step(style,2.5)*aa;
    vec3 facade=base*light*(1.-mortar*masonry*.14);
    float blindLevel=.45+.42*hash12(id+seed*2.1);
    float blind=step(blindLevel,f.y)*step(.60,hash12(id+seed*3.9))*aa;
    winCol=mix(winCol,base*light*.55,blind*.55);
    float mullion=(1.-smoothstep(.008,.008+fw.x,abs(f.x-.5)))*curtain*aa;
    winCol=mix(winCol,base*light*.7,mullion*.7);
    col = mix(facade, winCol, win);
    // our own tower keeps its rooms dark after hours; its mullions and spandrels catch the office's spill and the city's
    // glow, so from the Hudson the floor sits on a building and not on a black slab
    col += own * uNight * (vec3(0.055, 0.06, 0.07) * (1.0 - win) + vec3(0.02, 0.022, 0.026) * win) * smoothstep(60.0, 8.0, vTop - vWorld.y);
    // shopfronts at street level
    vec3 shop = vec3(0.03, 0.032, 0.035) + refl * 0.15 + vec3(1.0, 0.82, 0.6) * 1.2 * uNight * (1.0 - dark);
    col = mix(col, shop, ground * 0.75 * step(style, 5.5));
    // the top, finished: masonry ends in a cornice with its shadow under it; glass in a solid parapet over a band of
    // louvres hiding the plant; anything farther than a few pixels a floor keeps its plain face
    float toTop = vTop - vWorld.y;
    float tw = max(fwidth(toTop), 0.02);
    float glassy = curtain + step(2.5, style) * step(style, 3.5) + step(6.5, style);
    float topAA = clamp(1.6 - tw * 1.1, 0.0, 1.0) * step(5.0, hg);
    float cornice = 1.0 - smoothstep(0.85 - tw, 0.85 + tw, toTop);
    float under = (1.0 - smoothstep(1.6 - tw, 1.6 + tw, toTop)) * (1.0 - cornice);
    vec3 masonTop = mix(mix(col, base * light * 0.55, under * 0.8), base * light * 1.18, cornice);
    float parapet = 1.0 - smoothstep(1.15 - tw, 1.15 + tw, toTop);
    float louvre = (1.0 - smoothstep(5.2 - tw, 5.2 + tw, toTop)) * (1.0 - parapet) * step(40.0, vTop - vData.w);
    float slats = 0.75 + 0.25 * step(0.5, fract(toTop / 0.35));
    vec3 glassTop = mix(mix(col, vec3(0.06, 0.065, 0.07) * light * mix(1.0, slats, clamp(1.4 - tw * 3.0, 0.0, 1.0)), louvre), base * light * 0.9 + refl * 0.05, parapet);
    col = mix(col, mix(masonTop, glassTop, clamp(glassy, 0.0, 1.0)), topAA * (1.0 - step(5.5, style) * step(style, 6.5)) * (1.0 - own));
  }
  // the floodlit crowns of the landmarks after dark
  if (crown > 0.5) {
    float k = vExtra.x > 0.0 ? smoothstep(vExtra.x - 6.0, vExtra.x + 20.0, hg) : 1.0;
    vec3 cc = vExtra.x > 0.0 ? vExtra.yzw : base * vec3(2.2, 2.0, 1.75);
    col += cc * k * uNight * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;

  /* the ground: cliff top, basalt, talus, the Manhattan bluff, streets and parks */
  const TER_VERT = `
attribute vec2 aSC;
attribute vec4 aLand;
attribute vec4 aMisc;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vSC;
varying vec4 vLand;
varying vec4 vMisc;
${VERT}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vSC = aSC;
  vLand = aLand;
  vMisc = aMisc;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const TER_FRAG = `
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vSC;
varying vec4 vLand;
varying vec4 vMisc;
${FRAG}
${FOLIAGE}
${PULSE}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// woods from above: round crowns on a jittered grid (each the nearest crown), lit as domes from the sun, clumped leaves,
// shadow in the gaps. Two fixed sizes — single trees (6.5 m) and, farther off, groves (21 m) — and beyond those a soft
// mottle of the same colours, so the woods read as woods at every distance and never as pixels
vec3 crownLayer(vec2 q, float S, float off) {
  vec2 g = q / S + vec2(fbm3(q * 0.012 + off), fbm3(q * 0.012 + off + 5.3)) * 0.9;
  vec2 i = floor(g), f = fract(g);
  float best = 9.0;
  vec2 bid = vec2(0.0), brel = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 rel = f - (o + 0.2 + 0.6 * hash22(i + o + off));
      float rad = 0.6 + 0.32 * hash12(i + o + off + 11.3);
      float d = length(rel) / rad;
      if (d < best) { best = d; bid = i + o; brel = rel / rad; }
    }
  }
  float h = hash12(bid + off);
  float z = sqrt(max(1.0 - best * best, 0.0));
  vec3 nn = normalize(vec3(brel.x, z * 1.3 + 0.25, brel.y));
  float lit = 0.5 + 0.62 * max(dot(nn, uSunDir), 0.0) / max(uSunDir.y + 0.3, 0.3);
  float leafy = 0.82 + 0.36 * vnoise(q * (10.4 / S) + h * 57.0);
  float inCrown = smoothstep(1.06, 0.86, best);
  return foliage(h) * mix(0.34, min(lit, 1.35) * leafy, inCrown);
}
vec3 canopy(vec2 q, float px) {
  float kMid = smoothstep(0.9, 2.4, px), kFar = smoothstep(4.5, 10.0, px);
  vec3 col = vec3(0.0);
  if (kMid < 1.0) col = crownLayer(q, 6.5, 0.0);
  if (kMid > 0.0 && kFar < 1.0) col = mix(col, crownLayer(q, 21.0, 31.7) * 0.95, kMid);
  if (kFar > 0.0) {
    float a = vnoise(q * 0.034), b = vnoise(q * 0.071 + 7.0), c = vnoise(q * 0.15 + 3.0);
    vec3 far = mix(mix(foliage(0.113), foliage(0.471), a), mix(foliage(0.652), foliage(0.836), b), c) * (0.72 + 0.3 * vnoise(q * 0.09 + 1.7));
    col = mix(col, far, kFar);
  }
  return col;
}
void main() {
  vec3 n = normalize(vN);
  vec3 P = vWorld;
  vec2 q = P.xz;
  float s = vSC.x;
  vec4 L = vLand / max(vLand.x + vLand.y + vLand.z + vLand.w, 1e-3);
  float grid = vMisc.x;
  float road = vMisc.y;
  float ave = vMisc.z;
  float plaza = vMisc.w;
  float px = max(length(fwidth(q)), 1e-3);

  // the canopy: round crowns of mixed trees, each its own colour and lit as a dome, dark gaps between them
  vec3 forest = canopy(q, px);
  // rock: columnar basalt in New Jersey, grey schist in Manhattan
  float joints = vnoise(vec2(s * 0.6, P.y * 0.04)) * 0.65 + vnoise(vec2(s * 0.11, P.y * 0.012)) * 0.35;
  vec3 rock = grid > 0.5 ? mix(vec3(0.09, 0.09, 0.085), vec3(0.19, 0.18, 0.165), joints) : mix(vec3(0.045, 0.042, 0.04), vec3(0.14, 0.115, 0.09), joints);
  // (the lawns stay green through the fall here — cool-season grass — and only dull toward winter)
  vec3 lawn = mix(vec3(0.06, 0.09, 0.025), vec3(0.085, 0.092, 0.04), clamp(uFall * 0.35 + uBare * 0.5, 0.0, 1.0)) * (0.8 + 0.4 * vnoise(q * 0.06)) * (0.9 + 0.2 * vnoise(q * 0.7));
  vec3 asphalt = vec3(0.05, 0.051, 0.054) * (0.9 + 0.2 * vnoise(q * 0.5));
  vec3 town;
  float lamp;
  if (grid > 0.5) {
    // Manhattan: streets every 80.5 m, avenues every 255 m
    float xs = (s + 2800.0) / 80.5;
    float xa = (ave + 14.0) / 255.0;
    float onGrid = step(-20.0, ave);
    float st = pulseAA(xs, 20.5 / 80.5, fwidth(xs));
    float av = pulseAA(xa, 28.0 / 255.0, fwidth(xa));
    float street = max(st, av) * onGrid;
    town = mix(vec3(0.13, 0.125, 0.12), asphalt, street);
    lamp = street * 0.55;
  } else {
    // Fort Lee: streets on a true north-south grid, yards, drives and, far off, a texture of roofs among trees
    float un = dot(q, vec2(0.8660, 0.5));
    float vn = dot(q, vec2(-0.5, 0.8660));
    float xu = (un + 5.5) / 112.0;
    float xv = (vn + 5.5) / 226.0;
    float street = max(pulseAA(xu, 11.0 / 112.0, fwidth(xu)), pulseAA(xv, 11.0 / 226.0, fwidth(xv)));
    town = mix(lawn * 0.92, vec3(0.16, 0.15, 0.14), smoothstep(0.55, 0.75, vnoise(q * 0.09)) * 0.55);
    float far = smoothstep(1800.0, 2500.0, length(q));
    vec2 lot = vec2(un / 20.0, vn / 34.0);
    float roofs = pulseAA(lot.x, 0.55, fwidth(lot.x)) * pulseAA(lot.y + 0.2, 0.45, fwidth(lot.y));
    town = mix(town, mix(town, vec3(0.055, 0.055, 0.06), roofs), far);
    town = mix(town, forest, 0.38 * smoothstep(0.42, 0.7, vnoise(q * 0.05 + 3.0)));
    town = mix(town, asphalt, street);
    float x3 = dot(q, vec2(0.7071, 0.7071)) / 33.0;
    lamp = street * pulseAA(x3, 0.1, fwidth(x3)) * 0.8;
  }
  vec3 alb = forest * L.x + rock * L.y + town * L.z + lawn * L.w;
  float steep = 1.0 - smoothstep(0.4, 0.68, n.y);
  alb = mix(alb, rock, steep * (1.0 - 0.6 * L.x));
  alb = mix(alb, asphalt, road);
  // the banks: riprap (broken stone dumped against the shore) up to a few metres above the water, its lower metre and a
  // half dark and wet — the Hudson is tidal here, about 1.3 m between low and high water — with a wrack line of
  // driftwood and weed where the tide turns
  float hW = P.y + 204.0;
  float bankK = (1.0 - smoothstep(3.0, 5.5, hW)) * step(-4.0, hW) * (1.0 - plaza);
  vec2 cellR = q * 0.9;
  float rr = vnoise(cellR) * 0.6 + vnoise(cellR * 2.7 + 5.0) * 0.4;
  float stoneEdge = smoothstep(0.38, 0.5, abs(fract(rr * 3.0) - 0.5) * 2.0);
  vec3 riprap = mix(vec3(0.16, 0.15, 0.14), vec3(0.3, 0.285, 0.26), vnoise(cellR * 1.7 + 2.0)) * mix(1.0, 0.45, stoneEdge * clamp(1.6 - px, 0.0, 1.0));
  alb = mix(alb, riprap, bankK);
  float wet = 1.0 - smoothstep(0.9, 1.5, hW);
  alb *= mix(1.0, 0.42, wet * bankK);
  float wrack = (1.0 - smoothstep(0.08, 0.35, abs(hW - 1.6))) * bankK * step(0.45, vnoise(q * 0.4));
  alb = mix(alb, vec3(0.09, 0.075, 0.05), wrack * 0.7);
  // our own forecourt: pale stone, a lawn ring, the drive
  float r0 = length(q);
  vec3 stone = vec3(0.42, 0.40, 0.37) * (0.92 + 0.12 * vnoise(q * 0.8));
  vec3 site = mix(stone, lawn * 1.1, smoothstep(26.0, 30.0, r0) * (1.0 - smoothstep(44.0, 48.0, r0)));
  alb = mix(alb, site, plaza);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 col = alb * (uSkyCol * (0.62 + 0.38 * n.y) + uSunCol * ndl);
  col += (grid > 0.5 ? vec3(1.0, 0.78, 0.5) : vec3(1.0, 0.66, 0.36)) * lamp * L.z * uNight * 0.7;
  col += vec3(1.0, 0.7, 0.42) * road * uNight * 0.12 * max(grid, 1.0 - step(110.0, abs(s - 600.0))); // the parkway through the woods is unlit
  col += vec3(1.0, 0.85, 0.65) * plaza * (1.0 - smoothstep(16.0, 34.0, r0)) * uNight * 0.012;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(P, gl_FragColor.rgb);
}`;

  /* the Hudson: wind on the water, the sky and the far shore in it, the sun's path, the lights' streaks */
  const WATER_VERT = `
attribute vec2 aBank;
varying vec3 vWorld;
varying vec2 vBank;
${VERT}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vBank = aBank;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const WATER_FRAG = `
varying vec3 vWorld;
varying vec2 vBank;
uniform sampler2D uShore;
uniform sampler2D uGlowTex;
${FRAG}
float dec16(vec2 v) { return (v.x * 65280.0 + v.y * 255.0) / 65535.0 * 26000.0; }
vec2 waveSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 k1 = vec2(0.081, 0.043);
  g += k1 * 0.55 * cos(dot(p, k1) - t * 0.9);
  vec2 k2 = vec2(-0.052, 0.118);
  g += k2 * 0.42 * cos(dot(p, k2) - t * 1.15 + 1.3);
  vec2 k3 = vec2(0.19, -0.11);
  g += k3 * 0.22 * cos(dot(p, k3) - t * 1.7 + 0.4);
  vec2 k4 = vec2(-0.27, -0.23);
  g += k4 * 0.14 * cos(dot(p, k4) - t * 2.1 + 2.2);
  vec2 q = p * 0.35 + vec2(t * 0.12, -t * 0.05);
  float n0 = vnoise(q);
  g += vec2(vnoise(q + vec2(0.21, 0.0)) - n0, vnoise(q + vec2(0.0, 0.21)) - n0) / 0.6 * 0.25;
  return g;
}
void main() {
  vec3 P = vWorld;
  vec3 toEye = cameraPosition - P;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  float px = length(fwidth(P.xz));
  float detail = 1.0 - smoothstep(0.8, 4.0, px);
  vec2 g = waveSlope(P.xz, uTime) * detail;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float nv = max(dot(n, V), 0.02);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y) + 0.002;
  R = normalize(R);
  vec3 skyR = toLin(skyCol(R));
  // the shores in the mirror: does the reflected ray meet the land, its buildings, the bridge?
  vec2 o = P.xz - uC0.xz;
  float dW = length(o);
  float az = atan(o.x, -o.y);
  float u = az / 6.2831853 + 0.5;
  vec4 ta = texture2D(uShore, vec2(u, 1.0 / 6.0));
  vec4 tb = texture2D(uShore, vec2(u, 0.5));
  vec4 tc = texture2D(uShore, vec2(u, 5.0 / 6.0));
  float tanR = R.y / max(length(R.xz), 1e-3);
  float dS = dec16(ta.xy);
  float lim = 0.0;
  if (dS > dW) lim = ta.z * 255.0 / max(dS - dW, 12.0);
  float dF = dec16(tb.xy);
  if (dF > dW) lim = max(lim, tb.z * 510.0 / max(dF - dW, 12.0));
  float hitShore = 1.0 - smoothstep(lim * 0.9, lim * 1.05 + 0.002, tanR);
  float dB = dec16(tc.xy);
  float hitBridge = 0.0;
  if (dB > dW) {
    float yAt = (dB - dW) * tanR;
    hitBridge = (1.0 - smoothstep(78.0, 82.0, yAt)) * smoothstep(64.0, 68.0, yAt);
    hitBridge = max(hitBridge, tc.z * (1.0 - smoothstep(178.0, 188.0, yAt)));
  }
  vec3 hzR = toLin(skyCol(normalize(vec3(R.x, 0.01, R.z))));
  vec3 landR = mix(hzR, vec3(0.022, 0.026, 0.025) * (uSkyCol * 1.6 + uSunCol * 0.35), exp(-max(dS, dW) / uVis));
  vec3 steelR = vec3(0.10, 0.105, 0.11) * (uSkyCol + uSunCol * 0.5);
  vec3 refl = mix(skyR, landR, hitShore);
  refl = mix(refl, steelR, hitBridge);
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  vec3 body = vec3(0.02, 0.03, 0.027) * (vec3(dot(uSkyCol, vec3(0.3, 0.5, 0.2))) * 1.25 + uSunCol * 0.18);
  // near the banks: silt in the shallows, browner and a touch brighter (the Hudson is brackish and carries mud here)
  float dShore = min(vBank.x, vBank.y);
  float shallow = 1.0 - smoothstep(1.0, 30.0, dShore);
  body = mix(body, vec3(0.05, 0.045, 0.03) * (vec3(dot(uSkyCol, vec3(0.3, 0.5, 0.2))) * 1.3 + uSunCol * 0.25), shallow * 0.55);
  vec3 col = mix(body, refl, F);
  // the sun's glitter path
  vec3 Hh = normalize(uSunDir + V);
  float nh = max(dot(n, Hh), 1e-3);
  float sig = mix(0.012, 0.035, 1.0 - detail);
  float t2 = (1.0 - nh * nh) / (nh * nh);
  float D = exp(-t2 / sig) / (3.14159 * sig * nh * nh * nh * nh);
  float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(Hh, V), 0.0), 5.0);
  float sunUp = smoothstep(-0.02, 0.04, uSunDir.y);
  float sparkle = mix(1.0, 0.4 + 1.6 * vnoise(P.xz * 1.7 + vec2(uTime * 0.9, -uTime * 0.6)), detail);
  col += uSunCol * D * Fs * 0.25 / max(nv, 0.15) * sunUp * (1.0 - max(hitShore, hitBridge)) * sparkle;
  // the moon's path on the water after dark, as broken as the sun's
  vec3 Hm = normalize(uMoonDir + V);
  float nhm = max(dot(n, Hm), 1e-3);
  float tm = (1.0 - nhm * nhm) / (nhm * nhm);
  float Dm = exp(-tm / sig) / (3.14159 * sig * nhm * nhm * nhm * nhm);
  col += vec3(0.62, 0.68, 0.8) * Dm * Fs * 0.03 / max(nv, 0.15) * uMoonLit * uNight * smoothstep(-0.01, 0.05, uMoonDir.y) * (1.0 - max(hitShore, hitBridge)) * sparkle;
  // the wash at the water's edge: a fringe of foam where it breaks on the riprap, and the wakes' swell lapping in
  float pxF = clamp(2.2 / max(px, 0.3), 0.0, 1.0);
  float lapPh = dShore * 0.8 - uTime * 1.1 + vnoise(P.xz * 0.05) * 7.0;
  float lap = smoothstep(0.7, 1.0, sin(lapPh) * 0.5 + 0.5) * (1.0 - smoothstep(0.6, 5.0, dShore));
  float fringe = 1.0 - smoothstep(0.0, 1.4, dShore);
  float foam = max(lap * 0.45, fringe * 0.7) * (0.55 + 0.45 * vnoise(P.xz * 0.7 + vec2(uTime * 0.25, 0.0))) * step(-0.5, dShore) * mix(0.35, 1.0, pxF);
  col = mix(col, vec3(0.85, 0.87, 0.86) * (uSkyCol * 1.5 + uSunCol * 0.5) + vec3(0.01), foam * (1.0 - 0.7 * uNight));
  // after dark, the lights of the shores and the bridge, broken into streaks
  vec4 Lt = texture2D(uGlowTex, vec2(u, 0.5));
  float dImg = Lt.g * 26000.0;
  float hEye = max(cameraPosition.y + 204.0, 20.0);
  float dev = (atan(hEye / max(dW, 1.0)) - atan(hEye / max(dImg, 1.0))) / 0.085;
  float along = exp(-dev * dev) * step(10.0, dImg) * (dS > dW ? 1.0 - smoothstep(dS - 40.0, dS, dW) : 1.0);
  float glint = smoothstep(0.58, 0.9, vnoise(vec2(az * 2400.0 + 7.0, dW * 0.22 - uTime * 1.4))) * 3.6;
  float diffuse = Lt.b * smoothstep(dS * 0.6, dS * 0.97, dW) * step(dW, dS);
  col += vec3(1.0, 0.68, 0.38) * (pow(Lt.r, 1.5) * along * glint + diffuse * 0.3) * uNight * (0.4 + 3.0 * F);
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(P, gl_FragColor.rgb);
}`;

  /* trees: each crown a camera-facing card shaded as a lumpy, leafy sphere; bare ones go lacy */
  const TREE_VERT = `
attribute vec4 aData;
varying vec3 vWorld;
varying vec2 vQ;
varying vec4 vData;
${VERT}
void main() {
  mat4 im = instanceMatrix;
  vec3 c = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float w = length(im[0].xyz);
  float h = length(im[1].xyz);
  vec3 cc = compressP(c);
  float k = length(cc.xz - uC0.xz) / max(length(c.xz - uC0.xz), 1.0);
  vec4 mv = viewMatrix * vec4(cc, 1.0);
  mv.xy += vec2(position.x * w, position.y * h) * k;
  mv.z += 0.45 * w * k;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0;
  vWorld = c;
  vData = aData;
}`;
  const TREE_FRAG = `
varying vec3 vWorld;
varying vec2 vQ;
varying vec4 vData;
${FRAG}
${FOLIAGE}
void main() {
  float seed = vData.x;
  vec2 q = vQ;
  float ang = atan(q.y, q.x);
  float edge = 0.74 + 0.17 * vnoise(vec2(ang * 1.9 + seed * 40.0, seed * 7.0)) + 0.09 * vnoise(vec2(ang * 5.5 + 2.0, seed * 13.0));
  float r = length(q);
  float fw = max(fwidth(r), 1e-3);
  float a = 1.0 - smoothstep(edge - fw, edge + fw, r);
  float evergreen = step(fract(seed * 3.97), 0.13);
  float bare = step(fract(seed * 5.13), uBare) * (1.0 - evergreen);
  float cl = vnoise(q * 4.2 + seed * 31.0) * 0.5 + vnoise(q * 9.5 + seed * 17.0) * 0.3 + vnoise(q * 21.0 + seed * 5.0) * 0.2;
  a *= mix(1.0, smoothstep(0.38, 0.52, cl) * 0.85, bare);
  if (a < 0.02) discard;
  vec2 p = q / edge;
  float z = sqrt(max(1.0 - dot(p, p), 0.0));
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  float cl2 = vnoise(q * 4.2 + vec2(3.1, 7.7) + seed * 31.0);
  vec3 n = normalize(right * (p.x + (cl - 0.5) * 0.9) + up * (p.y + (cl2 - 0.5) * 0.9) + back * (z + 0.15));
  vec3 leaf = foliage(seed);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float ao = mix(0.45, 1.0, smoothstep(-0.95, 0.55, p.y)) * mix(0.5, 1.0, smoothstep(0.2, 0.75, cl));
  vec3 col = leaf * (uSkyCol * (0.55 + 0.45 * n.y) * ao + uSunCol * (ndl * 0.75 + wrap * 0.2) * mix(0.35, 1.0, cl));
  gl_FragColor = vec4(col, a);
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;

  /* houses (and the wooden water tanks on Manhattan's roofs) */
  const HOUSE_VERT = `
attribute vec4 aData;
attribute float aPart;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vData;
varying float vPart;
varying vec3 vLoc;
${VERT}
void main() {
  mat4 im = instanceMatrix;
  vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
  vec4 w = modelMatrix * im * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * (mat3(im) * (normal / (sc * sc))));
  vData = aData;
  vPart = aPart;
  vLoc = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const HOUSE_FRAG = `
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vData;
varying float vPart;
varying vec3 vLoc;
${FRAG}
vec3 wallCol(float i) {
  if (i < 0.5) return vec3(0.55, 0.55, 0.52);
  if (i < 1.5) return vec3(0.50, 0.45, 0.35);
  if (i < 2.5) return vec3(0.30, 0.31, 0.32);
  if (i < 3.5) return vec3(0.38, 0.30, 0.22);
  if (i < 4.5) return vec3(0.32, 0.36, 0.40);
  if (i < 5.5) return vec3(0.24, 0.10, 0.07);
  if (i < 6.5) return vec3(0.28, 0.31, 0.26);
  return vec3(0.12, 0.09, 0.07);
}
vec3 roofCol(float i) {
  if (i < 0.5) return vec3(0.05, 0.05, 0.055);
  if (i < 1.5) return vec3(0.12, 0.12, 0.12);
  if (i < 2.5) return vec3(0.10, 0.07, 0.05);
  if (i < 3.5) return vec3(0.07, 0.08, 0.09);
  if (i < 4.5) return vec3(0.14, 0.06, 0.04);
  return vec3(0.07, 0.09, 0.07);
}
void main() {
  vec3 n = normalize(vN);
  float seed = vData.x;
  float hg = vWorld.y - vData.w;
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 light = uSkyCol * (0.62 + 0.38 * n.y) + uSunCol * ndl;
  vec3 col;
  if (vData.z > 19.5) {
    // a water tank: cedar staves, a dark cone, steel legs
    float plank = 0.82 + 0.18 * step(0.5, fract(atan(vLoc.z, vLoc.x) * 2.0));
    vec3 wood = vec3(0.17, 0.12, 0.085) * plank;
    col = (vPart > 1.5 ? vec3(0.035) : vPart > 0.5 ? vec3(0.06, 0.055, 0.05) : wood) * light;
  } else if (vPart > 4.5) {
    col = vec3(0.035, 0.04, 0.045) * light;
  } else if (vPart > 3.5) {
    float mortar = 1.0 - smoothstep(0.03, 0.03 + fwidth(hg * 6.0), abs(fract(hg * 6.0) - 0.5));
    col = mix(vec3(0.24,0.105,0.07),vec3(0.38,0.30,0.24),mortar*.3) * light;
  } else if (vPart > 2.5) {
    // Recessed front doors, a glazed upper panel and a small metallic handle.
    vec2 q=vec2(vLoc.x/.11+.5,vLoc.y/.28);
    float panel=step(.18,q.x)*step(q.x,.82)*step(.52,q.y)*step(q.y,.9);
    col=mix(wallCol(vData.y)*.24,vec3(.04,.065,.07),panel)*light;
  } else if (vPart > 1.5) {
    col=mix(vec3(.65,.64,.59),wallCol(vData.y),.22)*light;
  } else if (vPart > 0.5) {
    vec3 r = roofCol(vData.z) * (0.82 + 0.3 * vnoise(vec2(dot(vWorld.xz, vec2(0.7, 0.7)) * 2.0, vWorld.y * 4.0)));
    vec2 shingle=vec2(dot(vWorld.xz,vec2(.7,.7))*2.4,vWorld.y*3.4);
    shingle.x+=mod(floor(shingle.y),2.0)*.5;
    vec2 edge=abs(fract(shingle)-.5),width=max(fwidth(shingle),vec2(.008));
    float joints=max(smoothstep(.46-width.x,.49+width.x,edge.x),smoothstep(.43-width.y,.49+width.y,edge.y));
    float detail=clamp(1.5-max(width.x,width.y)*2.,0.,1.);
    col = r * (1.-joints*detail*.22) * light;
  } else {
    vec2 tng = normalize(vec2(-n.z, n.x));
    vec2 cell = vec2(dot(vWorld.xz, tng) / 3.2 + seed, (hg - 0.9) / 2.9);
    vec2 f = fract(cell);
    vec2 fw = fwidth(cell);
    float aa = clamp(1.6 - max(fw.x, fw.y) * 2.0, 0.0, 1.0);
    float rows = step(0.0, cell.y) * step(cell.y, 2.0);
    float win = step(0.3, f.x) * step(f.x, 0.7) * step(0.25, f.y) * step(f.y, 0.75) * rows;
    win = mix(0.12 * rows, win, aa);
    float lit = step(0.7, hash12(floor(cell) + seed)) * uNight;
    vec3 glass = vec3(0.02, 0.025, 0.03) + vec3(1.0, 0.6, 0.28) * mix(0.3 * uNight, lit, aa) * 1.5;
    float trim=step(.255,f.x)*step(f.x,.745)*step(.205,f.y)*step(f.y,.795)*rows;
    float shutter=step(.25,hash12(vec2(seed,2.7)))*rows*step(.23,f.y)*step(f.y,.77)*(step(.17,f.x)*step(f.x,.265)+step(.735,f.x)*step(f.x,.83));
    float clap=1.-smoothstep(.035,.035+fwidth(hg*5.),abs(fract(hg*5.)-.5));
    vec3 siding=wallCol(vData.y)*(.97-.08*clap*aa);
    vec3 framed=mix(siding,vec3(.65,.64,.60),trim*aa*.72);
    framed=mix(framed,siding*.28,shutter*aa);
    float mullion=max(1.-smoothstep(.012,.012+fw.x,abs(f.x-.5)),1.-smoothstep(.015,.015+fw.y,abs(f.y-.51)));
    glass=mix(glass,vec3(.42,.41,.36)*light,mullion*aa*.65);
    col = mix(framed * light, glass, win);
  }
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;

  /* the George Washington Bridge: open steel towers, the deck's trusses, concrete, cables */
  const STEEL_VERT = `
attribute float aKind;
attribute vec2 aUV;
varying vec3 vWorld;
varying vec3 vN;
varying float vKind;
varying vec2 vUV;
${VERT}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vKind = aKind;
  vUV = aUV;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const STEEL_FRAG = `
varying vec3 vWorld;
varying vec3 vN;
varying float vKind;
varying vec2 vUV;
${FRAG}
${PULSE}
void main() {
  vec3 n = normalize(vN);
  vec3 steel = vec3(0.46, 0.47, 0.475);
  vec3 alb = steel;
  float k = vKind;
  if (k > 0.5 && k < 1.5) {
    // the towers' latticework: members over the shadowed inside of the legs
    vec2 g = vUV / 4.2;
    vec2 fw = fwidth(g);
    float fs = fw.x + fw.y;
    float frame = max(pulseAA(g.x + 0.07, 0.14, fw.x), pulseAA(g.y + 0.07, 0.14, fw.y));
    float d1 = abs(fract(g.x - g.y + 0.5) - 0.5);
    float d2 = abs(fract(g.x + g.y + 0.5) - 0.5);
    float dia = 1.0 - smoothstep(0.05, 0.05 + fs, min(d1, d2));
    float aa = clamp(1.5 - fs * 1.5, 0.0, 1.0);
    float m = mix(0.55, clamp(frame + dia, 0.0, 1.0), aa);
    alb = mix(steel * 0.42, steel, m);
  } else if (k > 1.5 && k < 2.5) {
    // the deck's stiffening truss: chords, posts and a Warren zigzag, the lower roadway behind
    vec2 g = vUV / vec2(9.2, 8.8);
    vec2 fw = fwidth(g);
    float fs = fw.x + fw.y;
    float chord = max(pulseAA(g.y + 0.06, 0.12, fw.y), pulseAA(g.x + 0.04, 0.08, fw.x));
    float tri = abs(fract(g.x * 0.5) * 2.0 - 1.0);
    float dia = 1.0 - smoothstep(0.06, 0.06 + fs, abs(fract(g.y) - tri));
    float aa = clamp(1.5 - fs * 1.5, 0.0, 1.0);
    alb = mix(vec3(0.06), steel * 0.95, mix(0.48, clamp(chord + dia, 0.0, 1.0), aa));
  } else if (k > 2.5 && k < 3.5) {
    alb = vec3(0.30, 0.29, 0.27) * (0.88 + 0.24 * vnoise(vUV * 0.25));
  } else if (k > 3.5 && k < 4.5) {
    float lane = pulseAA(vUV.y / 3.6 + 0.02, 0.04, fwidth(vUV.y / 3.6));
    alb = n.y > 0.5 ? vec3(0.055, 0.056, 0.06) + vec3(0.12) * lane : steel * 0.6;
  } else if (k > 5.5) {
    // car paint: silver, black, red, navy, white
    alb = k < 6.5 ? vec3(0.62, 0.63, 0.64) : k < 7.5 ? vec3(0.06, 0.065, 0.07) : k < 8.5 ? vec3(0.46, 0.07, 0.06) : k < 9.5 ? vec3(0.08, 0.13, 0.25) : vec3(0.78, 0.77, 0.74);
  } else if (k > 4.5) {
    alb = steel * 1.12;
  }
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col = alb * (uSkyCol * (0.62 + 0.38 * n.y) + uSunCol * ndl);
  col += uSunCol * pow(max(dot(reflect(-V, n), uSunDir), 0.0), 30.0) * 0.06 * (1.0 - step(2.5, k));
  col += alb * vec3(1.0, 0.94, 0.82) * uNight * 0.55 * step(0.5, k) * (1.0 - step(1.5, k)); // the towers are floodlit
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;

  /* the suspender ropes: a veil of fine verticals between the cables and the deck */
  const ROPE_VERT = `
attribute vec2 aUV;
varying vec3 vWorld;
varying vec2 vUV;
${VERT}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vUV = aUV;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const ROPE_FRAG = `
varying vec3 vWorld;
varying vec2 vUV;
${FRAG}
${PULSE}
void main() {
  float x = vUV.x / 18.3;
  float cover = pulseAA(x + 0.025, 0.05, fwidth(x));
  vec3 col = vec3(0.3, 0.31, 0.32) * (uSkyCol + uSunCol * 0.6);
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
  gl_FragColor.a = cover * 0.9;
}`;

  /* points of light: the bridge's necklace, lamps, traffic, the red lights on the tall towers */
  const LIGHT_VERT = `
attribute vec3 aColor;
attribute vec4 aInfo;
attribute vec3 aMove;
uniform float uPx;
uniform float uNight;
uniform float uTime;
uniform float uVis;
varying vec3 vCol;
varying float vA;
${VERT}
void main() {
  vec3 p = position;
  float kind = aInfo.y;
  float vis = uNight;
  if (kind < 0.5) {
    vis = 1.0;
  } else if (kind < 1.5) {
    float ph = fract(uTime * 0.55 + aInfo.z);
    vis = mix(0.3, 1.0, uNight) * (0.1 + 0.9 * smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.4, 0.55, ph)));
  } else if (kind < 2.5) {
    float t = fract(aInfo.z + uTime * aInfo.w);
    p += aMove * t;
    vis = mix(0.12, 1.0, uNight) * smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.96, 1.0, t));
  }
  vec4 mv = viewMatrix * vec4(compressP(p), 1.0);
  gl_Position = projectionMatrix * mv;
  float dR = distance(p, cameraPosition);
  float px = aInfo.x * uPx / max(dR, 1.0);
  gl_PointSize = clamp(px, 2.0, 12.0);
  vA = vis * clamp(px / 2.0, 0.2, 1.0) * exp(-dR / (uVis * 1.4));
  vCol = aColor;
}`;
  const LIGHT_FRAG = `
varying vec3 vCol;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.55 + (1.0 - smoothstep(0.0, 0.4, r)) * 0.7;
  if (vA * a < 0.003) discard;
  gl_FragColor = vec4(vCol * vA * a, 1.0);
}`;

  /* the sky: gradient, the dusk band, the sun, a broken deck of cloud, a few stars over the city's glow */
  const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
  const SKY_FRAG = `
varying vec3 vDir;
${FRAG}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyCol(d);
  float s = max(dot(d, uSunDir), 0.0);
  float sunUp = step(-0.05, uSunDir.y);
  float cl = 0.0;
  if (d.y > 0.0) {
    // fair-weather cumulus on a deck about 1.5 km up, seen in perspective all the way down to the horizon (the camera
    // rarely looks more than 13 degrees up, so the clouds have to live low in the frame); how much of the sky they cover
    // changes from day to day (uCloud: scenery keyed to the date, not a forecast). Far off, where a cloud is smaller than
    // a pixel, the deck averages to its cover instead of shimmering.
    vec2 p = d.xz / (d.y + 0.035) * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012);
    float w = length(fwidth(p));
    float nA = fbm3(p);
    float nB = fbm3(p * 2.3 + vec2(3.1, 1.7));
    float dens = nA * 0.72 + nB * 0.28;
    float th = mix(0.66, 0.46, uCloud);
    float far = smoothstep(0.35, 1.6, w);
    float cov = smoothstep(th - w * 0.25, th + 0.12 + w * 0.25, dens);
    cov = mix(cov, smoothstep(th + 0.12, th - 0.2, 0.5) * 0.5, far);
    cl = cov * smoothstep(0.0, 0.025, d.y) * 0.9;
    // lit tops toward the sun, grey flat bases away from it
    float nS = fbm3(p + normalize(uSunDir.xz + vec2(1e-4, 0.0)) * 0.09);
    float lit = clamp(0.55 + (dens - nS) * 3.0, 0.0, 1.0);
    lit = mix(lit, 0.6, far);
    vec3 cLit = mix(vec3(1.0, 0.99, 0.97), uGlow * 1.1 + uHor * 0.2, (1.0 - smoothstep(0.02, 0.35, uSunDir.y)) * 0.85);
    vec3 cShade = mix(uHor * 0.72 + uTop * 0.1, uHor * 0.5 + uGlow * 0.22, uDusk);
    vec3 cNight = vec3(0.03, 0.032, 0.04) + uCityGlow * 0.75;
    vec3 cloud = mix(mix(cShade, cLit, lit), cNight, uNight);
    cloud += uGlow * pow(s, 8.0) * 0.35 * sunUp * (1.0 - uNight);
    // high cirrus, combed out along the wind: thin, bright at sunset
    vec2 pc = d.xz / (d.y + 0.06) * 0.22 + vec2(uTime * 0.006, 0.0);
    float ci = vnoise(vec2(pc.x * 0.7 + pc.y * 0.3, pc.y * 6.0 - pc.x * 1.5)) * vnoise(pc * 1.3 + 4.0);
    float cirrus = smoothstep(0.32, 0.6, ci) * smoothstep(0.01, 0.08, d.y) * (1.0 - far * 0.7) * (0.35 + 0.4 * uCloud) * (1.0 - cl);
    vec3 cirCol = mix(mix(vec3(1.0), uGlow * 1.25, uDusk * 0.9), cNight, uNight);
    col = mix(col, cirCol, cirrus * 0.55);
    col = mix(col, cloud, cl);
  }
  col += uGlow * pow(s, 900.0) * 3.0 * sunUp * (1.0 - cl);
  // the moon at its real place and phase: a sphere lit from the sun's direction, so the terminator falls where it does
  // in the real sky; earthshine on the dark side; a halo after dark; hidden by cloud
  vec3 m = normalize(uMoonDir);
  float cm = dot(d, m);
  if (m.y > -0.03 && cm > 0.99) {
    float mr = 0.0052;
    vec3 off = d - m * cm;
    float r = length(off) / mr;
    vec3 e1 = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
    vec3 e2 = cross(e1, m);
    vec2 uv = vec2(dot(off, e1), dot(off, e2)) / mr;
    float disc = 1.0 - smoothstep(1.0 - fwidth(r) * 1.5, 1.0, r);
    vec3 nm = normalize(off / mr - m * sqrt(max(1.0 - r * r, 0.0)));
    float lit = smoothstep(-0.06, 0.12, dot(nm, uSunDir));
    float maria = 0.72 + 0.28 * smoothstep(0.35, 0.65, vnoise(uv * 2.6 + 7.0)) + 0.06 * vnoise(uv * 9.0);
    vec3 face = vec3(1.0, 0.97, 0.9) * maria * lit;
    vec3 shine = vec3(0.025, 0.028, 0.035) * uNight;
    vec3 moon = mix(col + face * 0.55, face * 1.25 + shine, uNight);
    col = mix(col, moon, disc * (1.0 - cl * 0.9) * step(0.001, max(lit, uNight)));
    col += vec3(0.55, 0.6, 0.72) * uMoonLit * uNight * exp(-max(r - 1.0, 0.0) * 0.35) * 0.07 * (1.0 - disc) * (1.0 - cl);
  }
  if (uNight > 0.01) {
    vec2 g = floor(d.xz / (d.y + 0.35) * 260.0);
    float st = step(0.9968, hash12(g)) * smoothstep(0.08, 0.3, d.y) * (1.0 - cl);
    col += vec3(0.9, 0.92, 1.0) * st * uNight * (0.25 + 0.45 * hash12(g + 7.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  /* ---------- mesh helpers ---------- */
  const UP = new THREE.Vector3(0, 1, 0);
  const pickR = (rnd, a) => a[Math.floor(rnd() * a.length)];
  const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  const setTRS = (arr, o, x, y, z, rot, sx, sy, sz) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    arr[o] = sx * c; arr[o + 1] = 0; arr[o + 2] = -sx * s; arr[o + 3] = 0;
    arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = sz * s; arr[o + 9] = 0; arr[o + 10] = sz * c; arr[o + 11] = 0;
    arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
  };
  function instanced(geo, mat, rows, fill) {
    const mesh = new THREE.InstancedMesh(geo, mat, rows.length);
    const arr = mesh.instanceMatrix.array;
    const data = new Float32Array(rows.length * 4);
    rows.forEach((r, k) => fill(r, arr, k * 16, data, k * 4));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
  /** Triangles with face normals, winding fixed against an outward direction. */
  class Mesher {
    constructor(attrs) {
      this.P = [];
      this.N = [];
      this.A = attrs.map(([name, size]) => ({ name, size, data: [] }));
    }
    tri(a, b, c, vals, out) {
      const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
      const n = new THREE.Vector3().crossVectors(ab, ac);
      if (n.lengthSq() < 1e-10) return;
      if (out && n.dot(out) < 0) {
        const t = b;
        b = c;
        c = t;
        n.negate();
      }
      n.normalize();
      for (const p of [a, b, c]) {
        this.P.push(p.x, p.y, p.z);
        this.N.push(n.x, n.y, n.z);
        this.A.forEach((at, i) => {
          const v = typeof vals[i] === 'function' ? vals[i](p) : vals[i];
          if (at.size === 1) at.data.push(v);
          else at.data.push(...v);
        });
      }
    }
    quad(a, b, c, d, vals, out) {
      this.tri(a, b, c, vals, out);
      this.tri(a, c, d, vals, out);
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
      for (const at of this.A) g.setAttribute(at.name, new THREE.Float32BufferAttribute(at.data, at.size));
      return g;
    }
  }
  const rect = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  const ngon = (r, n, rot = 0, rz = r) => Array.from({ length: n }, (_, i) => [Math.cos(rot + (i / n) * TAU) * r, Math.sin(rot + (i / n) * TAU) * rz]);

  /* ---------- buildings ---------- */
  const FL = { RES: 1, DENSE: 2, CROWN: 4, DARK: 8 };
  let BL = []; // x, z, w, d, h, y0, rot, style, pal + 16·flags, seed, groundY
  let TANKS = []; // s, c, roof y, seed
  let AIR = []; // s, c, y (red aircraft lights on the tall ones)
  let TREES = []; // x, z, crown centre y, width, height, seed, groundY

  function groundMin(s, c, w, d) {
    const a = w / 2, b = d / 2;
    return Math.min(landY(s - a, c - b), landY(s + a, c - b), landY(s - a, c + b), landY(s + a, c + b), landY(s, c)) - 0.6;
  }
  /** A box on the river's grid (w along s, d along c), standing on the ground or on what is under it. */
  function bSC(s, c, w, d, h, style, pal, flags, seed, o = {}) {
    const [x, z] = toW(s, c);
    const gy = o.gy != null ? o.gy : groundMin(s, c, w, d);
    const y0 = o.y0 != null ? o.y0 : gy;
    BL.push([x, z, w, d, h, y0, o.rot != null ? o.rot : RIVER_ROT, style, pal + 16 * flags, seed, gy]);
    return y0 + h;
  }
  const spec = (floors, style, pal, flags, wt = 0, setback = 0) => ({ floors, style, pal, flags, wt, setback });
  const prewar = (rnd, fl, res = true) => spec(fl, 2, pickR(rnd, [4, 4, 4, 7, 7, 0, 1, 10]), res ? FL.RES : 0, fl >= 6 ? 0.45 : 0.05);
  const postwar = (rnd, fl) => spec(fl, 1, pickR(rnd, [1, 1, 6, 4, 7]), FL.RES, 0);
  const glassT = (rnd, fl, res) => spec(fl, 0, pickR(rnd, [2, 3, 8, 9, 9]), res ? FL.RES : 0, 0);
  const officeM = (rnd, fl) => spec(fl, rnd() < 0.6 ? 5 : 3, pickR(rnd, [0, 0, 7, 5, 1, 6]), 0, 0, fl > 18 ? 1 : 0);

  function place(sp, s, c, w, d, rnd, near, dense, rot) {
    const res = sp.flags & FL.RES;
    const h = sp.floors * (res ? 3.05 : 3.75) + 2.2;
    const flags = sp.flags | (dense ? FL.DENSE : 0);
    const seed = rnd() * 100;
    const gy = groundMin(s, c, w, d);
    let top;
    if (sp.setback && h > 75) {
      // a setback tower: base, shaft, crown
      const h1 = Math.max(15, Math.round((h * (0.18 + rnd() * 0.17)) / 3.75) * 3.75);
      top = bSC(s, c, w, d, h1, sp.style, sp.pal, flags, seed, { gy, rot });
      const k = 0.7 + rnd() * 0.14, h2 = (h - h1) * (0.68 + rnd() * 0.17);
      top = bSC(s, c, w * k, d * k, h2, sp.style, sp.pal, flags, seed, { gy, y0: top, rot });
      const k2 = k * (0.62 + rnd() * 0.16);
      top = bSC(s, c, w * k2, d * k2, h - h1 - h2, sp.style, sp.pal, flags, seed, { gy, y0: top, rot });
    } else top = bSC(s, c, w, d, h, sp.style, sp.pal, flags, seed, { gy, rot });
    // a glass tower's top steps in once — the skyline reads as crowns, not cut-off boxes (drawn from the building's own
    // seed, so the rest of the city keeps its layout)
    const tr = (seed * 7.919) % 1;
    if (!sp.setback && sp.style === 0 && h > 90 && tr < 0.55) {
      const k = 0.8 + tr * 0.15;
      top = bSC(s, c, w * k, d * k, 6 + tr * 14, sp.style, sp.pal, flags, seed + 0.5, { gy, y0: top, rot });
    }
    if (near && h > 14 && rnd() < 0.4) {
      bSC(s + (rnd() - 0.5) * w * 0.4, c + (rnd() - 0.5) * d * 0.4, 3.5 + rnd() * 5, 3.5 + rnd() * 6, 2.6 + rnd() * 2.6, 6, pickR(rnd, [6, 4, 1]), FL.DARK, seed + 5, { gy, y0: top, rot });
    }
    if (near && sp.wt && rnd() < sp.wt * 0.7 && Math.hypot(s, c) < 3600) TANKS.push([s + (rnd() - 0.5) * w * 0.5, c + (rnd() - 0.5) * d * 0.5, top, rnd()]);
    // Small roof details reuse the existing building instance batch and seed.
    // No extra random draws: street layout, landmarks and tree positions stay stable.
    if (near && h>24 && tr<.48) {
      bSC(s+w*.16,c-d*.14,Math.min(4,w*.18),Math.min(3,d*.17),1.3,6,6,FL.DARK,seed+8,{gy,y0:top,rot});
      const roofTurn=(rot!=null?rot:RIVER_ROT)-RIVER_ROT;
      for(const side of [-1,1]) bSC(s+Math.cos(roofTurn)*side*w*.45,c+Math.sin(roofTurn)*side*w*.45,Math.min(.28,w*.025),d*.90,.65,6,sp.pal,FL.DARK,seed+9,{gy,y0:top,rot});
      if(h>55 && tr<.16) bSC(s-w*.12,c+d*.12,.18,.18,3.5,6,6,FL.DARK,seed+10,{gy,y0:top,rot});
    }
    // Cornices, shopfront bands and stepped parapets near the room, chosen from the building's own seed: no extra random draws.
    const ar = (seed * 3.137) % 1;
    if (!sp.setback && sp.style !== 0 && h > 18 && ar < 0.3 && Math.hypot(s, c) < 4200) {
      bSC(s, c, w * 1.06, d * 1.06, 1.1, 6, sp.pal, FL.DARK, seed + 11, { gy, y0: top - 1.1, rot });
      if (ar < 0.1) bSC(s, c, w * 1.04, d * 1.04, landY(s, c) - gy + 4.5, 6, sp.pal, FL.DARK, seed + 12, { gy, y0: gy, rot });
      if (h > 45 && ar < 0.12) bSC(s, c, w * 0.55, d * 0.55, 3.2, 6, sp.pal, FL.DARK, seed + 13, { gy, y0: top, rot });
    }
    if (top - gy > 150) AIR.push([s, c, top + 1]);
    return top;
  }

  function nyKind(s, t) {
    if (s < -1250) return 'inwood';
    if (s < 2650) return 'heights';
    if (s < 3950) return 'harlem';
    if (s < 4400) return 'valley';
    if (s < 5650) return t < 1300 ? 'morningside' : 'harlem';
    if (s < 9800) return t < 1420 ? 'uws' : 'ues';
    if (s < 10250) return t < 1300 ? 'lincoln' : 'cps';
    if (s < 12700) return t < 1080 ? 'hk' : t < 2350 ? 'midtown' : 'mideast';
    if (s < 15700) return 'chelsea';
    return 'lm';
  }
  const DENSE_KINDS = { midtown: 1, mideast: 1, lm: 1, cps: 1, lincoln: 1, hk: 1 };
  function pickNY(kind, s, t, front, rnd) {
    const r = rnd();
    switch (kind) {
      case 'inwood':
        return r < 0.82 ? prewar(rnd, 5 + (rnd() < 0.6 ? 1 : 0)) : prewar(rnd, ri(rnd, 7, 14));
      case 'heights': {
        if (t < aveBase(s) + 380) return r < 0.5 ? prewar(rnd, ri(rnd, 9, 16)) : r < 0.85 ? prewar(rnd, 6) : r < 0.95 ? postwar(rnd, ri(rnd, 14, 22)) : prewar(rnd, ri(rnd, 18, 22));
        return r < 0.62 ? prewar(rnd, ri(rnd, 5, 6)) : r < 0.9 ? prewar(rnd, ri(rnd, 7, 14)) : postwar(rnd, ri(rnd, 12, 21));
      }
      case 'harlem':
        return r < 0.55 ? prewar(rnd, ri(rnd, 4, 6)) : r < 0.75 ? prewar(rnd, ri(rnd, 6, 12)) : r < 0.88 ? postwar(rnd, ri(rnd, 14, 21)) : r < 0.95 ? glassT(rnd, ri(rnd, 8, 16), true) : null;
      case 'valley':
        return r < 0.45 ? glassT(rnd, ri(rnd, 8, 16), false) : r < 0.8 ? prewar(rnd, ri(rnd, 4, 8), false) : null;
      case 'morningside':
        return r < 0.6 ? prewar(rnd, ri(rnd, 8, 15)) : r < 0.9 ? prewar(rnd, ri(rnd, 5, 6)) : postwar(rnd, ri(rnd, 15, 21));
      case 'uws': {
        if (t < aveBase(s) + 300) return r < 0.66 ? prewar(rnd, ri(rnd, 12, 18)) : r < 0.88 ? prewar(rnd, ri(rnd, 6, 10)) : postwar(rnd, ri(rnd, 18, 28));
        if (t > 1250) return r < 0.7 ? prewar(rnd, ri(rnd, 15, 27)) : prewar(rnd, ri(rnd, 8, 14));
        if (front) return r < 0.6 ? prewar(rnd, ri(rnd, 12, 21)) : r < 0.85 ? glassT(rnd, ri(rnd, 20, 42), true) : postwar(rnd, ri(rnd, 16, 30));
        return r < 0.75 ? prewar(rnd, ri(rnd, 4, 6)) : prewar(rnd, ri(rnd, 8, 16));
      }
      case 'ues':
        if (front) return r < 0.45 ? prewar(rnd, ri(rnd, 12, 20)) : r < 0.8 ? postwar(rnd, ri(rnd, 20, 38)) : glassT(rnd, ri(rnd, 30, 60), true);
        return r < 0.6 ? prewar(rnd, 5) : postwar(rnd, ri(rnd, 14, 30));
      case 'lincoln':
        return r < 0.5 ? glassT(rnd, ri(rnd, 30, 55), true) : r < 0.8 ? postwar(rnd, ri(rnd, 20, 35)) : prewar(rnd, ri(rnd, 10, 18));
      case 'cps':
        return r < 0.45 ? officeM(rnd, ri(rnd, 25, 50)) : r < 0.8 ? glassT(rnd, ri(rnd, 30, 60), r < 0.6) : prewar(rnd, ri(rnd, 14, 30), true);
      case 'hk':
        return r < 0.5 ? prewar(rnd, ri(rnd, 4, 6)) : r < 0.75 ? prewar(rnd, ri(rnd, 7, 19)) : r < 0.92 ? glassT(rnd, ri(rnd, 25, 60), true) : null;
      case 'midtown':
        return r < 0.42 ? glassT(rnd, ri(rnd, 28, 58), false) : r < 0.75 ? officeM(rnd, ri(rnd, 20, 50)) : r < 0.9 ? officeM(rnd, ri(rnd, 10, 20)) : glassT(rnd, ri(rnd, 50, 75), false);
      case 'mideast':
        return r < 0.35 ? glassT(rnd, ri(rnd, 20, 45), r < 0.2) : r < 0.7 ? officeM(rnd, ri(rnd, 15, 40)) : postwar(rnd, ri(rnd, 15, 35));
      case 'chelsea':
        return r < 0.5 ? prewar(rnd, ri(rnd, 5, 13), false) : r < 0.7 ? officeM(rnd, ri(rnd, 12, 22)) : r < 0.82 ? glassT(rnd, ri(rnd, 15, 40), true) : null;
      default:
        return r < 0.35 ? officeM(rnd, ri(rnd, 15, 45)) : r < 0.65 ? glassT(rnd, ri(rnd, 20, 60), r < 0.45) : r < 0.85 ? prewar(rnd, ri(rnd, 8, 18), false) : null;
    }
  }
  function fillBlock(s0, cA, cB, kind, rnd, near, far, dense, cm) {
    const minLot = far ? 30 : near ? 14 : 20, maxLot = far ? 66 : near ? 40 : 52;
    let c = cA;
    while (c < cB - 8) {
      const lw = Math.min(cB - c, minLot + rnd() * (maxLot - minLot));
      const front = c - cA < 45 || cB - (c + lw) < 45;
      const t = c + lw / 2 - cm;
      const sp = pickNY(kind, s0 + 30, t, front, rnd);
      if (sp) {
        if (far || sp.floors > 16 || rnd() < 0.3) place(sp, s0 + 30, c + lw / 2, 52 + rnd() * 6, lw - 1.6, rnd, near, dense);
        else {
          place(sp, s0 + 14, c + lw / 2, 26, lw - 1.6, rnd, near, dense);
          const sp2 = pickNY(kind, s0 + 30, t, front, rnd);
          if (sp2) place(sp2, s0 + 46, c + lw / 2, 26, lw - 1.6, rnd, near, dense);
        }
      }
      c += lw;
    }
  }
  /** Manhattan, block by block: streets every 80.5 m, avenues every 255 m from Riverside Drive (12th Avenue in Midtown). */
  function genManhattan(rnd) {
    for (let s0 = -2860; s0 < BATTERY - 20; s0 += 80.5) {
      const sm = s0 + 30;
      const cm = cMan(sm), base = aveBase(sm), east = table(NY_EAST, sm);
      const dist = Math.hypot(sm, cm + 600);
      const near = dist < 5200, far = dist > 7500;
      const tStart = sm > -2560 && sm < -300 ? Math.max(base, 680) : base;
      for (let k = 0; k < 20; k++) {
        const a0 = base + k * 255 + 14, a1 = base + (k + 1) * 255 - 14;
        if (a0 > east) break;
        const t0 = Math.max(a0, tStart), t1 = Math.min(a1, east);
        if (t1 - t0 < 14) continue;
        const tm = (t0 + t1) / 2;
        if (sm > 5900 && sm < 10000 && tm > 1390 && tm < 2210) continue; // Central Park
        if (sm > -1000 && sm < 2650 && tm > 1720) continue; // Highbridge Park
        if (sm > 11880 && sm < 12450 && tm > 180 && tm < 1000) continue; // Hudson Yards, built apart
        if (sm > 8900 && sm < 9750 && tm < 470) continue; // Riverside South, built apart
        if (sm > 12700 && sm < 15700 && rnd() < 0.5) continue; // Chelsea and the Village: low, and hidden behind Midtown
        const kind = nyKind(sm, tm);
        fillBlock(s0, cm + t0, cm + t1, kind, rnd, near, far, !!DENSE_KINDS[kind], cm);
      }
    }
    // Riverside South: towers on the old rail yards by the river
    for (let s = 8960; s < 9720; s += 95) for (const t of [150, 340]) place(rnd() < 0.5 ? glassT(rnd, ri(rnd, 38, 50), true) : spec(ri(rnd, 36, 48), 2, 7, FL.RES), s, cMan(s) + t, 32 + rnd() * 12, 34 + rnd() * 14, rnd, false, true);
  }
  /** The Bronx beyond the Harlem River, and Riverdale's co-ops on the ridge upstream. */
  function genBronx(rnd) {
    for (let s = -2700; s < 3800; s += 140) {
      const cm = cMan(s);
      for (let t = 2160; t < 4800; t += 120 + rnd() * 60) {
        if (rnd() < 0.35) continue;
        const fl = rnd() < 0.7 ? ri(rnd, 5, 7) : rnd() < 0.7 ? ri(rnd, 10, 16) : ri(rnd, 18, 30);
        place(fl > 16 ? postwar(rnd, fl) : prewar(rnd, fl), s + (rnd() - 0.5) * 30, cm + t, 40 + rnd() * 40, 30 + rnd() * 50, rnd, false, false);
      }
    }
    for (let i = 0; i < 18; i++) {
      const s = -3200 - rnd() * 4800, cm = cMan(s);
      place(postwar(rnd, ri(rnd, 14, 32)), s, cm + 250 + rnd() * 900, 20 + rnd() * 14, 40 + rnd() * 30, rnd, false, false);
    }
    for (let s = -3100; s > -8000; s -= 160) {
      const cm = cMan(s);
      for (let t = 300; t < 2600; t += 150 + rnd() * 120) if (rnd() < 0.45) place(rnd() < 0.7 ? prewar(rnd, ri(rnd, 3, 6)) : postwar(rnd, ri(rnd, 8, 18)), s, cm + t, 30 + rnd() * 30, 30 + rnd() * 30, rnd, false, false);
    }
  }
  /** Is this a place for a house: on the cliff top, out of the parks, off the highways, clear of our forecourt? */
  function njLot(s, c, margin) {
    const cl = cCliff(s);
    if (c > cl - margin) return false;
    if (s < 380 && c > cl - 190) return false;
    if (s > 680 && s < 1070 && c > cl - 165) return false;
    if (Math.abs(s - GEO.sB) < 70 + 50 * smooth(-200, -420, c)) return false;
    if (s < 480 && Math.abs(c - pip(s)) < 22) return false;
    return Math.hypot(s, c) > 95;
  }
  /** New Jersey: Fort Lee's towers on the cliff, Edgewater on the shelf, Guttenberg, Hoboken, Jersey City. */
  function genNJ(rnd) {
    const cliffTowers = [[820, 60, 30], [1000, 120, 26], [1180, 70, 34], [1360, 150, 22], [1540, 60, 31], [1730, 110, 28], [1930, 70, 33], [2150, 140, 24], [2380, 60, 30], [2620, 120, 26], [3150, 70, 32], [3500, 60, 36], [3900, 90, 30], [4300, 60, 33], [4420, 160, 33], [4700, 70, 30], [5100, 80, 38], [5500, 60, 28], [6200, 70, 26], [6800, 90, 30], [8900, 80, 24], [9600, 120, 28]];
    for (const [s, back, fl] of cliffTowers) place(spec(fl, 4, pickR(rnd, [1, 1, 6, 7, 0]), FL.RES), s, cCliff(s) - back, 22 + rnd() * 16, 46 + rnd() * 20, rnd, false, false, NJ_ROT + (rnd() - 0.5) * 0.3);
    // mid-rise Fort Lee, Cliffside Park, West New York beyond the houses
    for (let s = 2300; s < 11500; s += 130) {
      const cl = cCliff(s);
      for (let c = cl - 1600; c < cl - 60; c += 120 + rnd() * 80) {
        if (rnd() < 0.45) continue;
        const fl = rnd() < 0.75 ? ri(rnd, 3, 6) : ri(rnd, 8, 16);
        place(fl > 7 ? postwar(rnd, fl) : prewar(rnd, fl), s + (rnd() - 0.5) * 50, c, 25 + rnd() * 30, 30 + rnd() * 35, rnd, false, false, NJ_ROT);
      }
    }
    // Edgewater and Port Imperial on the shelf below the cliff
    for (let s = 2800; s < 11800; s += 90 + rnd() * 60) {
      const cl = cCliff(s), cj = cJer(s);
      if (cj - cl < 200) continue;
      for (let c = cl + 95; c < cj - 40; c += 70 + rnd() * 60) if (rnd() < 0.6) place(rnd() < 0.85 ? spec(ri(rnd, 5, 12), rnd() < 0.5 ? 4 : 1, pickR(rnd, [1, 6, 7, 0]), FL.RES) : glassT(rnd, ri(rnd, 15, 24), true), s, c, 30 + rnd() * 40, 25 + rnd() * 30, rnd, false, false);
    }
    // Hoboken: row after row of brownstones on the flat
    for (let s = 12100; s < 14700; s += 80) {
      const cj = cJer(s);
      for (let c = cj - 1300; c < cj - 60; c += 90) if (rnd() < 0.8) place(prewar(rnd, ri(rnd, 4, 6)), s, c, 60, 70, rnd, false, false, NJ_ROT);
    }
    // Jersey City's waterfront towers
    for (let s = 14700; s < 18800; s += 70 + rnd() * 90) {
      const cj = cJer(s);
      const c = cj - 60 - rnd() * 700;
      const fl = rnd() < 0.55 ? ri(rnd, 30, 60) : ri(rnd, 6, 14);
      place(fl > 20 ? glassT(rnd, fl, rnd() < 0.6) : postwar(rnd, fl), s, c, 30 + rnd() * 20, 30 + rnd() * 25, rnd, false, true);
    }
  }
  /** Fort Lee and Englewood Cliffs house by house on their grid; a few blocks of flats; trees in the yards. */
  function genHouses(rnd) {
    const H = [];
    const ux = [0.866, 0.5], vx = [-0.5, 0.866];
    const Rr = 2300;
    for (let bu = -22; bu <= 22; bu++) {
      for (let bv = -11; bv <= 11; bv++) {
        const uc = bu * 112 + 56, vc = bv * 226 + 113;
        const x = uc * ux[0] + vc * vx[0], z = uc * ux[1] + vc * vx[1];
        if (Math.hypot(x, z) > Rr) continue;
        const [s, c] = toSC(x, z);
        if (!njLot(s, c, 60)) continue;
        if (rnd() < (s > 500 ? 0.16 : 0.07)) {
          // a block of flats
          const n = ri(rnd, 1, 3);
          for (let i = 0; i < n; i++) {
            const lv = vc + (i - (n - 1) / 2) * 62;
            const px = uc * ux[0] + lv * vx[0], pz = uc * ux[1] + lv * vx[1];
            const [ps, pc] = toSC(px, pz);
            if (njLot(ps, pc, 30)) place(rnd() < 0.6 ? prewar(rnd, ri(rnd, 3, 6)) : postwar(rnd, ri(rnd, 5, 9)), ps, pc, 40 + rnd() * 20, 22 + rnd() * 14, rnd, false, false, NJ_ROT);
          }
          continue;
        }
        for (const side of [-1, 1]) {
          for (let lv = bv * 226 + 16; lv < (bv + 1) * 226 - 16; lv += 17 + rnd() * 6) {
            if (rnd() < 0.08) continue;
            const L = 10 + rnd() * 6, Wd = 8 + rnd() * 4, Hh = 7.5 + rnd() * 3;
            const lu = uc + side * (56 - 5.5 - 9 - Wd / 2 - rnd() * 4);
            const hx = lu * ux[0] + lv * vx[0], hz = lu * ux[1] + lv * vx[1];
            const [hs, hc] = toSC(hx, hz);
            if (!njLot(hs, hc, 12)) continue;
            const gy = landY(hs, hc);
            const turn = rnd() < 0.5;
            H.push([hx, hz, NJ_ROT + (turn ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.05, turn ? L : Wd, Hh, turn ? Wd : L, gy, ri(rnd, 0, 7), ri(rnd, 0, 5), rnd()]);
            if (rnd() < 0.75) {
              const tu = lu - side * (14 + rnd() * 12), tv = lv + (rnd() - 0.5) * 10;
              const tx = tu * ux[0] + tv * vx[0], tz = tu * ux[1] + tv * vx[1];
              const [ts, tc] = toSC(tx, tz);
              if (njLot(ts, tc, 8)) addTree(tx, tz, landY(ts, tc), rnd, 1);
            }
          }
        }
      }
    }
    return H;
  }
  function addTree(x, z, gy, rnd, k = 1) {
    const w = (7 + rnd() * 7) * k, h = (7 + rnd() * 6) * k, trunk = 2.5 + rnd() * 4;
    TREES.push([x, z, gy + trunk + h * 0.5, w, h, rnd(), gy]);
  }
  /** Woods: the park along the cliff, the talus, Fort Lee Historic Park, the bluff across the river, Fort Tryon and Inwood Hill. */
  function genWoods(rnd) {
    const spacing = d => (d < 900 ? 10 : d < 2600 ? 14 : 19);
    const area = (s0, s1, cFrom, cTo, ok = () => true, k = 1) => {
      for (let s = s0; s < s1; ) {
        const c0 = cFrom(s), c1 = cTo(s);
        const sp = spacing(Math.hypot(s, (c0 + c1) / 2));
        for (let c = c0 + rnd() * sp; c < c1; c += sp * (0.8 + rnd() * 0.4)) {
          const ss = s + (rnd() - 0.5) * sp * 0.8;
          if (!ok(ss, c)) continue;
          const [x, z] = toW(ss, c);
          addTree(x, z, landY(ss, c), rnd, k * (0.85 + rnd() * 0.4));
        }
        s += sp * (0.8 + rnd() * 0.4);
      }
    };
    const clear = (s, c) => Math.hypot(s, c) > 70 && !(s < 470 && Math.abs(c - pip(s)) < 13);
    area(-2600, 380, s => cCliff(s) - 185, s => cCliff(s) - 1.5, clear, 1.15); // the Palisades park
    area(690, 1060, s => cCliff(s) - 160, s => cCliff(s) - 1.5, clear, 1.1); // Fort Lee Historic Park
    area(-2600, 2600, s => cCliff(s) + 12, s => cCliff(s) + 76, () => true, 1.05); // the talus under the cliff
    area(-2700, 2700, s => cMan(s) + 44, s => cMan(s) + 36 + table(NY_BLUFF, s), (s, c) => !isWater(s, c), 1.2); // Fort Washington Park
    area(-2560, -300, s => cMan(s) + 36 + table(NY_BLUFF, s), () => cMan(-1300) + 650, () => true, 1.2); // Fort Tryon, Inwood Hill
    // woodlots among the houses
    for (let i = 0; i < 2600; i++) {
      const s = -2400 + rnd() * 4400, c = -2200 + rnd() * 2200;
      if (!njLot(s, c, 15)) continue;
      if (fbmJS(s / 240 + 3.1, c / 240 + 7.7) < 0.6) continue;
      const [x, z] = toW(s, c);
      addTree(x, z, landY(s, c), rnd, 1.1);
    }
  }

  /* ---------- landmarks ---------- */
  function genLandmarks(M, rnd) {
    const site = (s, c, gy) => {
      gy = gy != null ? gy : landY(s, c);
      return { s, c, gy, P: (ds, dc, y) => { const [x, z] = toW(s + ds, c + dc); return new THREE.Vector3(x, gy + y, z); } };
    };
    const NOX = [0, 0, 0, 0];
    const dat = (st, style, pal, flags, seed) => [seed, pal + 16 * flags, style, st.gy];
    /** A shaft between two rings of the same count; heights may be per vertex (a slanted top). */
    const shaft = (st, rB, yB, rT, yT, data, extra, cap = true) => {
      const n = rB.length;
      const yb = i => (Array.isArray(yB) ? yB[i] : yB), yt = i => (Array.isArray(yT) ? yT[i] : yT);
      const cx = rB.reduce((a, p) => a + p[0] / n, 0), cz = rB.reduce((a, p) => a + p[1] / n, 0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [ox, oz] = toW((rB[i][0] + rB[j][0]) / 2 - cx, (rB[i][1] + rB[j][1]) / 2 - cz);
        M.quad(st.P(rB[i][0], rB[i][1], yb(i)), st.P(rB[j][0], rB[j][1], yb(j)), st.P(rT[j][0], rT[j][1], yt(j)), st.P(rT[i][0], rT[i][1], yt(i)), [data, extra], new THREE.Vector3(ox, 0, oz));
      }
      if (cap) {
        const tx = rT.reduce((a, p) => a + p[0] / n, 0), tz = rT.reduce((a, p) => a + p[1] / n, 0);
        const ty = Array.isArray(yT) ? yT.reduce((a, v) => a + v / n, 0) : yT;
        const top = st.P(tx, tz, ty);
        for (let i = 0; i < n; i++) M.tri(st.P(rT[i][0], rT[i][1], yt(i)), st.P(rT[(i + 1) % n][0], rT[(i + 1) % n][1], yt((i + 1) % n)), top, [data, extra], UP);
      }
    };
    const air = (st, y) => AIR.push([st.s, st.c, st.gy + y]);
    const L = llToSC;
    const D = FL.DENSE;

    // the Empire State Building: setbacks in limestone, the mast, the antenna; the crown floodlit
    {
      const [s, c] = L(40.7484, -73.9857), st = site(s, c);
      const B = (w, d, y0, h, f = 0) => bSC(s, c, w, d, h, 5, 0, D | f, 61.3, { gy: st.gy, y0: st.gy + y0 });
      B(56, 128, 0, 25); B(48, 96, 25, 60); B(44, 72, 85, 30); B(42, 58, 115, 147); B(34, 44, 262, 26, FL.CROWN); B(26, 32, 288, 22, FL.CROWN); B(20, 24, 310, 10, FL.CROWN);
      shaft(st, ngon(9, 8, Math.PI / 8), 320, ngon(6.5, 8, Math.PI / 8), 373, dat(st, 6, 11, FL.CROWN, 61.3), [320, 1.25, 1.22, 1.4]);
      shaft(st, ngon(4, 8), 373, ngon(3, 8), 381, dat(st, 6, 11, 0, 61.3), NOX);
      shaft(st, ngon(1.6, 6), 381, ngon(0.5, 6), 443, dat(st, 6, 11, 0, 61.3), NOX);
      air(st, 444);
    }
    // the Chrysler Building: a slim shaft, the terraced steel crown, the needle
    {
      const [s, c] = L(40.7516, -73.9755), st = site(s, c);
      const B = (w, d, y0, h) => bSC(s, c, w, d, h, 5, 7, D, 33.7, { gy: st.gy, y0: st.gy + y0 });
      B(62, 60, 0, 58); B(50, 50, 58, 30); B(40, 40, 88, 150);
      const dc = dat(st, 6, 11, FL.CROWN, 33.7), ex = [240, 1.35, 1.3, 1.2];
      [17, 15, 13, 11, 9, 7].forEach((r, i) => shaft(st, ngon(r, 8, Math.PI / 8), 238 + i * 7, ngon(r - 1.4, 8, Math.PI / 8), 245 + i * 7, dc, ex));
      shaft(st, ngon(4, 8, Math.PI / 8), 280, ngon(0.25, 8), 319, dc, ex);
      air(st, 319);
    }
    // One Vanderbilt: terracotta base, a tapering glass shaft, the canted crown, the spire
    {
      const [s, c] = L(40.753, -73.9787), st = site(s, c);
      bSC(s, c, 66, 88, 30, 7, 10, D, 17.2, { gy: st.gy });
      const dg = dat(st, 0, 9, D | FL.CROWN, 17.2);
      shaft(st, rect(62, 70), 30, rect(40, 34), 380, dg, [380, 1.0, 1.1, 1.25], false);
      shaft(st, rect(40, 34), 380, rect(40, 34), [380, 410, 395, 380], dg, [380, 1.0, 1.1, 1.25]);
      shaft(st, ngon(0.8, 6), 400, ngon(0.3, 6), 427, dat(st, 6, 11, 0, 17.2), NOX);
      air(st, 427);
    }
    // the supertalls of 57th Street: 432 Park, Central Park Tower, 111 West 57th, One57, 220 Central Park South, 53W53
    {
      let [s, c] = L(40.7616, -73.9719);
      bSC(s, c, 28.5, 28.5, 426, 3, 1, D | FL.RES, 43.2);
      AIR.push([s, c, landY(s, c) + 427]);
      [s, c] = L(40.7663, -73.981);
      let gy = landY(s, c);
      bSC(s, c, 58, 52, 88, 0, 9, D, 7.7, { gy });
      bSC(s, c - 4, 36, 46, 352, 0, 9, D | FL.RES, 7.7, { gy, y0: gy + 88 });
      bSC(s, c - 4, 28, 38, 32, 0, 9, D | FL.RES | FL.CROWN, 7.7, { gy, y0: gy + 440 });
      AIR.push([s, c, gy + 473]);
      [s, c] = L(40.765, -73.9776);
      gy = landY(s, c);
      // 111 West 57th: the needle, its south face stepping back like feathers
      [[0, 300, 43], [300, 30, 37], [330, 25, 31], [355, 23, 25], [378, 20, 19], [398, 18, 13], [416, 19, 7]].forEach(([y0, h, w], i) => bSC(s - 21.5 + w / 2, c, w, 18, h, 7, 10, D | FL.RES | (i > 2 ? FL.CROWN : 0), 11.1, { gy, y0: gy + y0 }));
      AIR.push([s - 18, c, gy + 436]);
      [s, c] = L(40.7653, -73.9792);
      gy = landY(s, c);
      [[0, 250, 46], [250, 26, 38], [276, 20, 28], [296, 10, 18]].forEach(([y0, h, d]) => bSC(s, c + (46 - d) / 2, 30, d, h, 0, 2, D | FL.RES, 57.1, { gy, y0: gy + y0 }));
      [s, c] = L(40.7672, -73.98);
      gy = landY(s, c);
      [[0, 240, 26, 36], [240, 22, 22, 30], [262, 18, 17, 22], [280, 10, 12, 14]].forEach(([y0, h, w, d], i) => bSC(s, c, w, d, h, 5, 0, D | FL.RES | (i > 1 ? FL.CROWN : 0), 22.0, { gy, y0: gy + y0 }));
      [s, c] = L(40.7615, -73.9776);
      const st = site(s, c), d53 = dat(st, 0, 3, D, 53.5);
      shaft(st, rect(28, 38), 0, rect(16, 22), 250, d53, NOX, false);
      shaft(st, rect(16, 22), 250, rect(1.2, 1.6), 320, d53, NOX);
      air(st, 320);
    }
    // Bank of America Tower, the New York Times Building, 270 Park Avenue
    {
      let [s, c] = L(40.7557, -73.9844);
      let st = site(s, c);
      bSC(s, c, 56, 44, 30, 0, 9, D, 36.6, { gy: st.gy });
      const db = dat(st, 0, 9, D | FL.CROWN, 36.6);
      shaft(st, rect(52, 40), 30, rect(40, 30), 290, db, [290, 1.1, 1.2, 1.3], false);
      shaft(st, rect(40, 30), 290, rect(12, 9), 322, db, [290, 1.1, 1.2, 1.3]);
      shaft(st, ngon(1.2, 6), 318, ngon(0.4, 6), 366, dat(st, 6, 11, 0, 36.6), NOX);
      air(st, 366);
      [s, c] = L(40.7562, -73.9897);
      st = site(s, c);
      bSC(s, c, 46, 54, 228, 8, 1, D, 41.0, { gy: st.gy });
      shaft(st, ngon(1.3, 6), 228, ngon(0.4, 6), 319, dat(st, 6, 11, 0, 41.0), NOX);
      air(st, 319);
      [s, c] = L(40.7559, -73.9755);
      const gy = landY(s, c);
      [[0, 70, 62], [70, 160, 54], [230, 100, 46], [330, 65, 38], [395, 28, 30]].forEach(([y0, h, w], i) => bSC(s, c, w, w, h, 0, 9, D | (i === 4 ? FL.CROWN : 0), 27.0, { gy, y0: gy + y0 }));
      AIR.push([s, c, gy + 424]);
    }
    // Hudson Yards and Manhattan West
    {
      let [s, c] = L(40.7537, -74.001);
      let st = site(s, c);
      const d30 = dat(st, 0, 2, D | FL.CROWN, 30.3);
      shaft(st, rect(62, 54), 0, rect(52, 44), 345, d30, [345, 0.9, 1.0, 1.2], false);
      shaft(st, rect(52, 44), 345, rect(52, 44), [345, 387, 387, 345], d30, [345, 0.9, 1.0, 1.2]);
      bSC(s + 30, c + 6, 14, 16, 2.5, 6, 6, D | FL.DARK, 30.4, { gy: st.gy, y0: st.gy + 335 }); // the Edge, out over the street
      air(st, 388);
      [s, c] = L(40.7543, -74.0027);
      let gy = landY(s, c);
      [[0, 200, 44, 40], [200, 60, 38, 34], [260, 30, 32, 28], [290, 18, 25, 22]].forEach(([y0, h, w, d]) => bSC(s, c, w, d, h, 7, 0, D | FL.RES, 35.3, { gy, y0: gy + y0 }));
      [s, c] = L(40.7524, -74.0009);
      st = site(s, c);
      shaft(st, rect(46, 60), 0, rect(46, 60), [270, 270, 245, 245], dat(st, 0, 8, D, 10.1), NOX);
      [s, c] = L(40.7537, -74.0026);
      gy = landY(s, c);
      bSC(s, c, 34, 44, 230, 0, 9, D | FL.RES, 15.2, { gy });
      bSC(s, c, 26, 34, 55, 0, 9, D | FL.RES, 15.2, { gy, y0: gy + 230 });
      [s, c] = L(40.7539, -73.9992);
      bSC(s, c, 60, 56, 300, 0, 3, D, 50.4);
      [s, c] = L(40.7549, -73.9995);
      gy = landY(s, c);
      [[0, 150, 52, 50], [150, 60, 48, 46], [210, 40, 44, 42], [250, 35, 40, 38], [285, 29, 34, 32]].forEach(([y0, h, w, d], i) => bSC(s + i * 1.5, c - i * 1.5, w, d, h, 0, 9, D, 66.1, { gy, y0: gy + y0 }));
      [s, c] = L(40.7525, -73.9983);
      gy = landY(s, c);
      bSC(s, c, 54, 50, 280, 0, 2, D, 1.1, { gy });
      bSC(s, c, 44, 42, 23, 0, 2, D, 1.1, { gy, y0: gy + 280 });
      AIR.push([s, c, gy + 304]);
    }
    // the World Trade Center: One WTC's chamfered shaft and spire, 3, 4 and 7 WTC
    {
      const [s, c] = L(40.7127, -74.0134), st = site(s, c);
      const d1 = dat(st, 0, 9, D | FL.CROWN, 1.776);
      bSC(s, c, 61, 61, 57, 0, 9, D, 1.776, { gy: st.gy });
      const Bc = [[30.5, 30.5], [-30.5, 30.5], [-30.5, -30.5], [30.5, -30.5]];
      const Tc = [[0, 31.8], [-31.8, 0], [0, -31.8], [31.8, 0]];
      const ex = [404, 1.15, 1.2, 1.35];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const b0 = st.P(Bc[i][0], Bc[i][1], 57), b1 = st.P(Bc[j][0], Bc[j][1], 57), t0 = st.P(Tc[i][0], Tc[i][1], 417), t1 = st.P(Tc[j][0], Tc[j][1], 417);
        const o1 = toW(Bc[i][0] + Bc[j][0], Bc[i][1] + Bc[j][1]), o2 = toW(Tc[i][0] + Tc[j][0], Tc[i][1] + Tc[j][1]);
        M.tri(b0, b1, t0, [d1, ex], new THREE.Vector3(o1[0], 0, o1[1]));
        M.tri(t0, t1, b1, [d1, ex], new THREE.Vector3(o2[0], 0, o2[1]));
      }
      const top = st.P(0, 0, 417);
      for (let i = 0; i < 4; i++) M.tri(st.P(Tc[i][0], Tc[i][1], 417), st.P(Tc[(i + 1) % 4][0], Tc[(i + 1) % 4][1], 417), top, [d1, ex], UP);
      const ds = dat(st, 6, 11, FL.CROWN, 1.776);
      shaft(st, ngon(9, 8), 417, ngon(8, 8), 427, ds, [417, 1.3, 1.3, 1.45]);
      shaft(st, ngon(1.8, 8), 427, ngon(0.45, 8), 541, ds, [427, 1.3, 1.3, 1.45]);
      air(st, 541);
      let [s3, c3] = L(40.7112, -74.0118);
      bSC(s3, c3, 44, 44, 329, 0, 9, D, 3.3);
      AIR.push([s3, c3, landY(s3, c3) + 330]);
      [s3, c3] = L(40.7098, -74.0114);
      let gy = landY(s3, c3);
      bSC(s3, c3, 48, 38, 220, 0, 9, D, 4.4, { gy });
      bSC(s3, c3 + 5, 40, 28, 78, 0, 9, D, 4.4, { gy, y0: gy + 220 });
      [s3, c3] = L(40.7133, -74.012);
      bSC(s3, c3, 42, 38, 228, 0, 9, D, 7.7);
      // 30 Park Place, 56 Leonard's stacked glass, 8 Spruce's rippled steel, the Woolworth Building, 40 Wall, 70 Pine, 125 Greenwich
      [s3, c3] = L(40.7134, -74.0083);
      gy = landY(s3, c3);
      bSC(s3, c3, 32, 30, 250, 5, 0, D | FL.RES, 30.1, { gy });
      bSC(s3, c3, 24, 22, 35, 5, 0, D | FL.RES | FL.CROWN, 30.1, { gy, y0: gy + 250 });
      [s3, c3] = L(40.718, -74.0056);
      gy = landY(s3, c3);
      for (let i = 0; i < 16; i++) bSC(s3 + (rnd() - 0.5) * 6, c3 + (rnd() - 0.5) * 6, 26 + rnd() * 5, 26 + rnd() * 5, 15.6, 0, 9, D | FL.RES, 56.1, { gy, y0: gy + i * 15.6 });
      [s3, c3] = L(40.711, -74.0055);
      gy = landY(s3, c3);
      [[0, 200, 30, 42], [200, 40, 28, 36], [240, 25, 24, 30]].forEach(([y0, h, w, d]) => bSC(s3, c3, w, d, h, 7, 11, D | FL.RES, 8.8, { gy, y0: gy + y0 }));
      [s3, c3] = L(40.7124, -74.0081);
      let sw = site(s3, c3);
      bSC(s3, c3, 60, 52, 85, 5, 1, D, 23.3, { gy: sw.gy });
      bSC(s3, c3, 26, 26, 115, 5, 1, D | FL.CROWN, 23.3, { gy: sw.gy, y0: sw.gy + 85 });
      shaft(sw, rect(24, 24), 200, rect(2, 2), 241, dat(sw, 6, 12, FL.CROWN, 23.3), [200, 0.9, 1.0, 0.8]);
      [s3, c3] = L(40.7069, -74.0094);
      sw = site(s3, c3);
      bSC(s3, c3, 40, 40, 215, 5, 0, D, 40.4, { gy: sw.gy });
      bSC(s3, c3, 30, 30, 25, 5, 0, D | FL.CROWN, 40.4, { gy: sw.gy, y0: sw.gy + 215 });
      shaft(sw, rect(28, 28), 240, rect(3, 3), 268, dat(sw, 6, 12, FL.CROWN, 40.4), [240, 0.8, 1.0, 0.75]);
      shaft(sw, ngon(1, 6), 266, ngon(0.3, 6), 283, dat(sw, 6, 11, 0, 40.4), NOX);
      [s3, c3] = L(40.7063, -74.0077);
      sw = site(s3, c3);
      [[0, 210, 36, 30], [210, 35, 26, 22], [245, 17, 16, 14]].forEach(([y0, h, w, d]) => bSC(s3, c3, w, d, h, 5, 0, D, 70.7, { gy: sw.gy, y0: sw.gy + y0 }));
      shaft(sw, ngon(4, 8), 262, ngon(0.4, 8), 290, dat(sw, 6, 0, FL.CROWN, 70.7), [262, 1.0, 1.0, 0.9]);
      [s3, c3] = L(40.7092, -74.0124);
      bSC(s3, c3, 24, 24, 272, 0, 9, D | FL.RES, 12.5);
    }
    // up the Manhattan shore: Riverside Church's tower and Grant's Tomb, the hospital on the heights, the Bridge Apartments,
    // Castle Village, the Cloisters on Fort Tryon's hill, Riverbank State Park on its pier, the Little Red Lighthouse
    {
      let [s, c] = L(40.8121, -73.9631);
      c = Math.max(c, cMan(s) + aveBase(s) + 20);
      let st = site(s, c);
      bSC(s, c, 30, 30, 100, 2, 0, FL.CROWN, 77.1, { gy: st.gy });
      bSC(s, c, 26, 26, 20, 2, 0, FL.CROWN, 77.1, { gy: st.gy, y0: st.gy + 100 });
      bSC(s - 8, c + 62, 30, 95, 32, 2, 0, 0, 77.2, { gy: st.gy });
      const off = (r, a, b) => r.map(([x, z]) => [x + a, z + b]);
      for (const [a, b] of [[-11, -11], [11, -11], [11, 11], [-11, 11]]) shaft(st, off(ngon(1.6, 4), a, b), 120, off(ngon(0.2, 4), a, b), 133, dat(st, 2, 0, FL.CROWN, 77.1), NOX);
      [s, c] = L(40.8134, -73.9631);
      c = Math.max(c, cMan(s) + aveBase(s) - 30);
      st = site(s, c);
      bSC(s, c, 46, 46, 27, 6, 1, 0, 88.1, { gy: st.gy });
      shaft(st, ngon(15, 16), 27, ngon(15, 16), 40, dat(st, 6, 1, 0, 88.1), NOX, false);
      shaft(st, ngon(15, 16), 40, ngon(3, 16), 47, dat(st, 6, 1, 0, 88.1), NOX);
      // NewYork-Presbyterian on the heights at 168th Street
      [s, c] = L(40.8406, -73.9435);
      const base = cMan(s) + aveBase(s) + 30;
      bSC(s, base + 10, 80, 50, 45, 1, 6, FL.RES, 16.8);
      bSC(s + 40, base + 230, 60, 70, 88, 5, 7, 0, 16.9);
      bSC(s - 60, base + 190, 28, 28, 100, 5, 7, 0, 17.0);
      bSC(s + 120, base + 120, 50, 60, 62, 2, 1, 0, 17.1);
      bSC(s - 130, base + 70, 60, 40, 55, 1, 1, 0, 17.2);
      // the Bridge Apartments, astride the approach to the bridge
      [s, c] = L(40.8478, -73.9375);
      for (let i = 0; i < 4; i++) bSC(GEO.sB, c + i * 75, 60, 15, 100, 1, 6, FL.RES, 32.1 + i);
      // Castle Village's five cross-shaped towers on the cliff
      [s, c] = L(40.8536, -73.9402);
      for (let i = 0; i < 5; i++) {
        const ss = s - 160 + i * 75, cc = cMan(ss) + aveBase(ss) + 10 + (i % 2) * 40;
        const gy = groundMin(ss, cc, 46, 46);
        bSC(ss, cc, 46, 14, 41.6, 2, 4, FL.RES, 13.1 + i, { gy });
        bSC(ss, cc, 14, 46, 41.6, 2, 4, FL.RES, 13.1 + i, { gy });
      }
      // the Cloisters on Fort Tryon's hill
      [s, c] = L(40.8649, -73.9318);
      c = Math.max(c, cMan(s) + 260);
      st = site(s, c);
      bSC(s, c, 70, 50, 14, 6, 0, 0, 12.1, { gy: st.gy });
      bSC(s + 10, c - 8, 15, 15, 33, 2, 0, FL.CROWN, 12.2, { gy: st.gy });
      // Riverbank State Park, a park on the roof of the treatment plant, out on the river
      [s, c] = L(40.827, -73.953);
      const cm = cMan(s);
      bSC(s, cm - 105, 640, 190, 20, 6, 6, FL.DARK, 4.4, { gy: GEO.yW, y0: GEO.yW - 1 });
      bSC(s, cm - 105, 620, 175, 1.2, 6, 12, FL.DARK, 4.5, { gy: GEO.yW, y0: GEO.yW + 19 });
      // the Little Red Lighthouse under the bridge
      [s, c] = L(40.8505, -73.9469);
      st = site(s, cMan(s) + 7);
      shaft(st, ngon(2.6, 10), 0, ngon(2.0, 10), 12, dat(st, 6, 13, 0, 1.0), NOX, false);
      shaft(st, ngon(2.3, 10), 12, ngon(0.3, 10), 15.5, dat(st, 6, 5, 0, 1.0), NOX);
      LAMPS.push([st.P(0, 0, 13.5), [1.0, 0.85, 0.6], 3, 3]);
    }
    // New Jersey: the Modern's two towers in Fort Lee, the Galaxy Towers at Guttenberg, the Statue in the harbour
    {
      for (const [la, lo, sd] of [[40.8521, -73.9704, 1], [40.8512, -73.9692, 2]]) {
        const [s, c] = L(la, lo), st = site(s, c);
        shaft(st, ngon(24, 16, 0.3, 13), 0, ngon(24, 16, 0.3, 13), 153, dat(st, 0, 2, FL.RES, 47 + sd), NOX);
        air(st, 154);
      }
      const [s, c] = L(40.794, -74.0005);
      for (let i = 0; i < 3; i++) {
        const st = site(s - 70 + i * 70, c - 30 * (i % 2));
        shaft(st, ngon(22, 8, Math.PI / 8), 0, ngon(22, 8, Math.PI / 8), 125, dat(st, 4, 1, FL.RES, 19 + i), NOX);
      }
      const [sl, cl] = L(40.6892, -74.0445), st = site(sl, cl, GEO.yW);
      bSC(sl, cl, 140, 140, 3, 6, 6, FL.DARK, 3.3, { gy: GEO.yW, y0: GEO.yW - 1 });
      bSC(sl, cl, 28, 28, 47, 6, 1, FL.DARK, 3.3, { gy: GEO.yW, y0: GEO.yW + 2 });
      shaft(st, ngon(4.5, 6), 49, ngon(2.2, 6), 93, dat(st, 6, 12, FL.CROWN, 3.3), [70, 1.0, 1.0, 0.85]);
    }
  }

  /* ---------- the George Washington Bridge ---------- */
  let LAMPS = []; // position, colour, size (m), kind; or traffic: start, colour, size, kind 2, phase, speed, run
  function genBridge(steel, ropes) {
    const sB = GEO.sB, yW = GEO.yW;
    const W = (u, v, y) => {
      const [x, z] = toW(sB + v, u);
      return new THREE.Vector3(x, y, z);
    };
    const uA = cCliff(sB) - 2, uZ = cMan(sB) + 260;
    const mid = (GEO.t1 + GEO.t2) / 2, half = (GEO.t2 - GEO.t1) / 2;
    const deckY = u => {
      if (u <= GEO.t1) return lerp(yW + 80, yW + 74.5, smooth(uA, GEO.t1, u));
      if (u >= GEO.t2) return lerp(yW + 74.5, yW + 62, smooth(GEO.t2, uZ, u));
      const k = (u - mid) / half;
      return yW + 78 - 3.5 * k * k;
    };
    const yS = yW + 181, yM = yW + 82;
    const cableY = u => {
      if (u <= GEO.t1) {
        const k = (u - GEO.a1) / (GEO.t1 - GEO.a1);
        return lerp(yW + 80, yS, k) - 20 * k * (1 - k);
      }
      if (u >= GEO.t2) {
        const k = (u - GEO.t2) / (GEO.a2 - GEO.t2);
        return lerp(yS, yW + 55, k) - 20 * k * (1 - k);
      }
      const k = (u - mid) / half;
      return yM + (yS - yM) * k * k;
    };
    // a quad's UVs in metres in its own plane
    const uvOf = (a, b, d) => {
      const e1 = new THREE.Vector3().subVectors(b, a);
      if (e1.lengthSq() < 1e-6) e1.subVectors(d, a);
      e1.normalize();
      const e2 = new THREE.Vector3().subVectors(d, a);
      e2.addScaledVector(e1, -e2.dot(e1));
      if (e2.lengthSq() < 1e-6) e2.set(0, 1, 0);
      e2.normalize();
      return p => {
        const r = new THREE.Vector3().subVectors(p, a);
        return [r.dot(e1), r.dot(e2) + (e2.y > 0.5 ? a.y : 0)];
      };
    };
    const hexa = (C, kind) => {
      // C: 8 corners [u, v, y] (bottom four, then the top four in the same order)
      const p = C.map(([u, v, y]) => W(u, v, y));
      const ctr = p.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / 8);
      for (const [a, b, c, d] of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]]) {
        const fc = new THREE.Vector3().add(p[a]).add(p[b]).add(p[c]).add(p[d]).multiplyScalar(0.25);
        steel.quad(p[a], p[b], p[c], p[d], [kind, uvOf(p[a], p[b], p[d])], fc.sub(ctr));
      }
    };
    const box = (u0, u1, v0, v1, y0, y1, kind) => hexa([[u0, v0, y0], [u1, v0, y0], [u1, v1, y0], [u0, v1, y0], [u0, v0, y1], [u1, v0, y1], [u1, v1, y1], [u0, v1, y1]], kind);
    // a strut between two points in a tower's plane (v, y), with depth along u
    const strut = (uT, v0, y0, v1, y1, t, dep, kind) => {
      const len = Math.hypot(v1 - v0, y1 - y0), nv = (-(y1 - y0) / len) * t, ny = ((v1 - v0) / len) * t;
      hexa([[uT - dep, v0 - nv, y0 - ny], [uT + dep, v0 - nv, y0 - ny], [uT + dep, v0 + nv, y0 + ny], [uT - dep, v0 + nv, y0 + ny], [uT - dep, v1 - nv, y1 - ny], [uT + dep, v1 - nv, y1 - ny], [uT + dep, v1 + nv, y1 + ny], [uT - dep, v1 + nv, y1 + ny]], kind);
    };

    for (const uT of [GEO.t1, GEO.t2]) {
      // the piers
      box(uT - 15, uT + 15, -32, 32, yW - 3, yW + 8, 3);
      // two legs of open steelwork, battered toward the top
      for (const vL of [-21, 21]) {
        const b = [9, 5.5], t = [5.5, 3.75], y0 = yW + 8, y1 = yW + 184;
        hexa([[uT - b[0], vL - b[1], y0], [uT + b[0], vL - b[1], y0], [uT + b[0], vL + b[1], y0], [uT - b[0], vL + b[1], y0], [uT - t[0], vL - t[1], y1], [uT + t[0], vL - t[1], y1], [uT + t[0], vL + t[1], y1], [uT - t[0], vL + t[1], y1]], 1);
        box(uT - 5, uT + 5, vL - 3.5, vL + 3.5, y1, y1 + 4.5, 0); // the cable saddles
        LAMPS.push([W(uT, vL, y1 + 6), [1.0, 0.1, 0.04], 3.2, 1, rnd01() * 0.3]);
      }
      // struts, the deep portal at the top, and X-bracing in the panels between
      box(uT - 4, uT + 4, -21, 21, yW + 58, yW + 64, 1);
      box(uT - 4, uT + 4, -21, 21, yW + 92, yW + 97, 1);
      box(uT - 4, uT + 4, -21, 21, yW + 124, yW + 129, 1);
      box(uT - 5, uT + 5, -24, 24, yW + 166, yW + 184, 1);
      for (const [ya, yb] of [[yW + 12, yW + 58], [yW + 97, yW + 124], [yW + 129, yW + 166]]) {
        strut(uT, -18, ya, 18, yb, 1.2, 2.2, 1);
        strut(uT, 18, ya, -18, yb, 1.2, 2.2, 1);
      }
      strut(uT, -18, yW + 80, -6, yW + 92, 1.1, 2.2, 1);
      strut(uT, 18, yW + 80, 6, yW + 92, 1.1, 2.2, 1);
    }
    // the deck: roadway, the stiffening trusses (the lower deck inside them), the underside
    const step = 15;
    for (let u = uA; u < uZ; u += step) {
      const u1 = Math.min(u + step, uZ), y0 = deckY(u), y1 = deckY(u1);
      hexa([[u, -19, y0 - 1.2], [u1, -19, y1 - 1.2], [u1, 19, y1 - 1.2], [u, 19, y0 - 1.2], [u, -19, y0], [u1, -19, y1], [u1, 19, y1], [u, 19, y0]], 4);
      for (const v of [-17, 17]) hexa([[u, v - 0.4, y0 - 10], [u1, v - 0.4, y1 - 10], [u1, v + 0.4, y1 - 10], [u, v + 0.4, y0 - 10], [u, v - 0.4, y0 - 1.2], [u1, v - 0.4, y1 - 1.2], [u1, v + 0.4, y1 - 1.2], [u, v + 0.4, y0 - 1.2]], 2);
      hexa([[u, -17.4, y0 - 10.6], [u1, -17.4, y1 - 10.6], [u1, 17.4, y1 - 10.6], [u, 17.4, y0 - 10.6], [u, -17.4, y0 - 9.8], [u1, -17.4, y1 - 9.8], [u1, 17.4, y1 - 9.8], [u, 17.4, y0 - 9.8]], 0);
    }
    // the anchorages: in the Palisades, and a great block of masonry on the Manhattan bluff
    box(GEO.a1 - 24, GEO.a1 + 24, -30, 30, yW + 70, yW + 84, 3);
    box(GEO.a2 - 35, GEO.a2 + 35, -42, 42, yW + 12, yW + 62, 3);
    // four main cables
    for (const v of [-21.7, -20.3, 20.3, 21.7]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = lerp(GEO.a1, GEO.t1, i / 24);
        pts.push(W(u, v, cableY(u)));
      }
      for (let i = 1; i <= 140; i++) {
        const u = lerp(GEO.t1, GEO.t2, i / 140);
        pts.push(W(u, v, cableY(u)));
      }
      for (let i = 1; i <= 24; i++) {
        const u = lerp(GEO.t2, GEO.a2, i / 24);
        pts.push(W(u, v, cableY(u)));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 380, 0.5, 6, false).toNonIndexed();
      const P = tube.attributes.position.array, N = tube.attributes.normal.array;
      for (let i = 0; i < P.length; i += 9) {
        const a = new THREE.Vector3(P[i], P[i + 1], P[i + 2]), b = new THREE.Vector3(P[i + 3], P[i + 4], P[i + 5]), c = new THREE.Vector3(P[i + 6], P[i + 7], P[i + 8]);
        steel.tri(a, b, c, [5, [0, 0]], new THREE.Vector3(N[i], N[i + 1], N[i + 2]));
      }
      tube.dispose();
    }
    // the suspender ropes: a veil from each pair of cables down to the deck
    for (const sg of [-1, 1]) {
      let prev = null;
      for (let u = GEO.a1 + 26; u <= GEO.a2 - 18; u += 6) {
        const top = W(u, sg * 21, cableY(u) - 0.3), bot = W(u, sg * 18.6, deckY(u) + 1.5);
        if (cableY(u) - deckY(u) < 2.5) {
          prev = null;
          continue;
        }
        if (prev) {
          ropes.quad(prev[1], bot, top, prev[0], [q => [toSC(q.x, q.z)[1], q.y]]);
        }
        prev = [top, bot];
      }
    }
    // lights: the necklace along the cables, the roadway lamps, traffic both ways
    for (const v of [-21.7, 21.7]) for (let u = GEO.a1 + 12; u < GEO.a2 - 6; u += 24) LAMPS.push([W(u, v, cableY(u) + 0.9), [0.92, 0.97, 1.0], 3.4, 3]);
    for (const v of [-19.2, 19.2]) for (let u = uA + 10; u < uZ; u += 30) LAMPS.push([W(u, v, deckY(u) + 7), [1.0, 0.78, 0.5], 1.8, 3]);
    const span = uZ - uA;
    for (const [v, dir] of [[-3, -1], [-6.5, -1], [-10, -1], [-9.4, -1], [3, 1], [6.5, 1], [10, 1], [9.4, 1]]) { // the outer lanes are queued: their lights share the next lane in
      for (let i = 0; i < 9; i++) {
        const a = dir > 0 ? W(uA, v, deckY(uA) + 1.2) : W(uZ, v, deckY(uZ) + 1.2), b = dir > 0 ? W(uZ, v, deckY(uZ) + 1.2) : W(uA, v, deckY(uA) + 1.2);
        LAMPS.push([a, dir > 0 ? [1.0, 0.18, 0.1] : [1.0, 0.95, 0.85], 1.6, 2, rnd01(), (11 + rnd01() * 6) / span, b.sub(a)]);
      }
    }
    // static deck detail on its own seed, following the roadway's grade: rnd01's stream is untouched
    const q = seeded(7319);
    const onDeck = (u0, u1, v0, v1, y0, y1, kind) => {
      const a = deckY(u0), b = deckY(u1);
      hexa([[u0, v0, a + y0], [u1, v0, b + y0], [u1, v1, b + y0], [u0, v1, a + y0], [u0, v0, a + y1], [u1, v0, b + y1], [u1, v1, b + y1], [u0, v1, a + y1]], kind);
    };
    for (let u = uA + 6; u < uZ - 6; u += 24) {
      const u1 = Math.min(u + 24, uZ - 6);
      onDeck(u, u1, -0.35, 0.35, 0, 1.1, 3); // the median
      for (const [v0, v1] of [[-15.9, -15.4], [15.4, 15.9]]) onDeck(u, u1, v0, v1, 0, 1.0, 3);
      if (Math.abs(u + 12 - GEO.t1) < 24 || Math.abs(u + 12 - GEO.t2) < 24) continue; // the walks stop short of the tower legs
      for (const [v0, v1] of [[-18.5, -16], [16, 18.5]]) onDeck(u, u1, v0, v1, -0.2, 0.3, 3);
      for (const [v0, v1] of [[-18.7, -18.4], [18.4, 18.7]]) onDeck(u, u1, v0, v1, 0.3, 1.5, 5);
    }
    for (const [v, dir] of [[-13.5, -1], [13.5, 1]]) { // a standing queue in the outermost lane each way
      for (let u = uA + 20 + q() * 40; u < uZ - 30;) {
        if (q() < 0.12) {
          const ut = dir > 0 ? u : u + 3.4;
          onDeck(ut, ut + 13, v - 1.25, v + 1.25, 0, 3.8, 5); // a truck's box and its cab, on the leading end
          const uc = dir > 0 ? ut + 13.4 : ut - 3;
          onDeck(uc, uc + 2.6, v - 1.2, v + 1.2, 0, 2.9, 0);
          u += 18 + q() * 4;
        } else {
          onDeck(u, u + 5, v - 1.1, v + 1.1, 0, 1.1, 6 + Math.floor(q() * 5));
          onDeck(u + 1.2, u + 3.8, v - 0.95, v + 0.95, 1.1, 1.7, 4);
          u += 7 + q() * 4.5;
        }
      }
    }
    return { deckY, cableY };
  }
  /** Static street detail on both shores, in the building batch and on its own seed: parked vehicles, approach gantries, the parkway's river wall. */
  /** Our own forecourt on the cliff top, 124 m under the office: a ring of honey locusts between the stone and the
   *  lawn, lamp posts round the stone, cars at the kerb of the drive on the landward side, and the lit footpath
   *  along the cliff edge (the Palisades walk) running north and south of us. */
  function genForecourt(rnd) {
    const gy = landY(0, 0);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + 0.09, r = 29 + (i % 2) * 1.2;
      const [x, z] = toW(Math.cos(a) * r, Math.sin(a) * r);
      const k = 0.55 + rnd() * 0.12; // street trees: smaller than the woods' crowns
      TREES.push([x, z, gy + 3.2 + 4.6 * k, 7.5 * k, 8 * k, rnd(), gy]);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, [x, z] = toW(Math.cos(a) * 23, Math.sin(a) * 23);
      LAMPS.push([new THREE.Vector3(x, gy + 4.2, z), [1.0, 0.8, 0.55], 1.1, 3]);
    }
    for (let s = -420; s <= 520; s += 22) {
      const c = cCliff(s) - 7;
      if (Math.hypot(s, c) < 60) continue;
      LAMPS.push([new THREE.Vector3(...((p) => [p[0], landY(s, c) + 3.2, p[1]])(toW(s, c))), [1.0, 0.78, 0.5], 0.9, 3]);
    }
  }

  function genStreetDetail() {
    const q = seeded(9127), yW = GEO.yW, sB = GEO.sB;
    const vehicle = (s, c, y, van, alongS) => {
      if (isWater(s, c)) return;
      const len = van ? 6.2 : 4.8;
      const body = van ? 1.8 : 0.95, glass = len * 0.55, yb = y - 0.25; // sunk slightly, so a slope leaves no gap beneath
      bSC(s, c, alongS ? len : 2.2, alongS ? 2.2 : len, body + 0.25, 6, pickR(q, [4, 1, 7, 0]), FL.DARK, q() * 100, { gy: yb, y0: yb });
      bSC(s, c, alongS ? glass : 1.9, alongS ? 1.9 : glass, van ? 0.7 : 0.55, 6, 6, FL.DARK, 34, { gy: y, y0: y + body });
    };
    // our forecourt's drive: cars along the landward kerb (the drive curves round the stone at about 40 m)
    for (let i = 0; i < 9; i++) {
      if (q() < 0.25) continue;
      const a = Math.PI * (0.62 + i * 0.075), s = Math.cos(a) * 40, c = Math.sin(a) * 40 - 8;
      vehicle(s, c, landY(s, c) + 0.05, q() < 0.15, Math.abs(Math.cos(a)) < 0.7);
    }
    // the bridge approach: kerbside rows outside the lamp lines, sign gantries over the lanes
    for (const sg of [-1, 1]) {
      for (let u = -2150; u < -70; u += 13 + q() * 22) {
        if (q() < 0.35) continue;
        const s = sB + sg * 25;
        vehicle(s, u, landY(s, u) + 0.05, q() < 0.22, false);
      }
    }
    for (const u of [-1780, -1040, -360]) {
      const y = landY(sB, u);
      for (const dv of [-21, 21]) bSC(sB + dv, u, 0.7, 0.7, 7.6, 6, 6, FL.DARK, 31, { gy: y, y0: y });
      bSC(sB, u, 43, 1, 1.2, 6, 6, FL.DARK, 32, { gy: y, y0: y + 7 });
    }
    // the Henry Hudson Parkway: stopped vehicles on the shoulder, a low wall on the river side
    for (let s = -1800; s < 6000; s += 260 + q() * 420) {
      if (s > 350 && s < 760) continue;
      const c = cMan(s) + 31;
      vehicle(s, c, Math.max(landY(s, c), yW + 3.6) + 0.05, q() < 0.2, true);
    }
    for (let s = 0; s < 4200; s += 30) {
      if (s > 350 && s < 760) continue;
      const c = cMan(s) + 13.5, y = Math.max(landY(s, c), yW + 3.6);
      bSC(s, c, 30.5, 0.8, 2.7, 6, 4, FL.DARK, 33, { gy: y - 1.5, y0: y - 1.5 });
    }
    // Riverside Drive: both kerb lanes of the 28 m pavement centered on ave 0
    for (let s = 760; s < 4200; s += 16 + q() * 22) {
      if (q() < 0.4) continue;
      const c = cMan(s) + aveBase(s) + (q() < 0.5 ? -10.5 : 10.5);
      vehicle(s, c, landY(s, c) + 0.05, q() < 0.15, true);
    }
  }
  let _r01 = seeded(4242);
  const rnd01 = () => _r01();
  /** More traffic and lamps: the Henry Hudson Parkway on the far shore, Riverside Drive, the bridge's approach, the parkway behind us. */
  function genRoadLights(rnd) {
    const yW = GEO.yW;
    const P = (s, c, y) => {
      const [x, z] = toW(s, c);
      return new THREE.Vector3(x, y, z);
    };
    for (let s0 = -2700; s0 < 9300; s0 += 420) {
      const s1 = s0 + 420;
      const a = P(s0, cMan(s0) + 24, yW + 5), b = P(s1, cMan(s1) + 24, yW + 5);
      for (const [dc, dir] of [[-3, 1], [3, -1]]) {
        for (let i = 0; i < 5; i++) {
          const from = dir > 0 ? a.clone() : b.clone(), to = dir > 0 ? b.clone() : a.clone();
          from.x += dc * CD[0];
          from.z += dc * CD[1];
          to.x += dc * CD[0];
          to.z += dc * CD[1];
          LAMPS.push([from, dir > 0 ? [1.0, 0.95, 0.85] : [1.0, 0.18, 0.1], 1.5, 2, rnd(), (13 + rnd() * 5) / 420, to.sub(from)]);
        }
      }
    }
    for (let s = -2600; s < 9300; s += 45) LAMPS.push([P(s, cMan(s) + 16, yW + 10), [1.0, 0.72, 0.42], 1.7, 3]);
    for (let s = 2700; s < 9400; s += 40) {
      const c = cMan(s) + aveBase(s) - 22;
      LAMPS.push([P(s, c, landY(s, c) + 6), [1.0, 0.82, 0.58], 1.6, 3]);
    }
    // the approach to the bridge: twelve lanes through Fort Lee
    const ua = -2400, ub = cCliff(GEO.sB) - 4;
    for (const [dv, dir] of [[-14, -1], [-9, -1], [-4, -1], [4, 1], [9, 1], [14, 1]]) {
      for (let i = 0; i < 10; i++) {
        const u0 = dir > 0 ? ua : ub, u1 = dir > 0 ? ub : ua;
        const A = P(GEO.sB + dv, u0, landY(GEO.sB + dv, u0) + 1.4), B = P(GEO.sB + dv, u1, landY(GEO.sB + dv, u1) + 1.4);
        LAMPS.push([A, dir > 0 ? [1.0, 0.95, 0.85] : [1.0, 0.18, 0.1], 1.5, 2, rnd(), (14 + rnd() * 6) / (ub - ua), B.sub(A)]);
      }
    }
    for (let u = -2300; u < cCliff(GEO.sB); u += 40) for (const dv of [-20, 20]) LAMPS.push([P(GEO.sB + dv, u, landY(GEO.sB + dv, u) + 9), [1.0, 0.74, 0.44], 1.7, 3]);
    // the Palisades Interstate Parkway, north through the woods
    for (let s0 = -3000; s0 < 450; s0 += 350) {
      const s1 = Math.min(s0 + 350, 470);
      const a = P(s0, pip(s0), landY(s0, pip(s0)) + 1.4), b = P(s1, pip(s1), landY(s1, pip(s1)) + 1.4);
      for (let i = 0; i < 3; i++) {
        LAMPS.push([a.clone(), [1.0, 0.95, 0.85], 1.4, 2, rnd(), 20 / 350, b.clone().sub(a)]);
        LAMPS.push([b.clone(), [1.0, 0.18, 0.1], 1.4, 2, rnd(), 20 / 350, a.clone().sub(b)]);
      }
    }
  }

  /* ---------- the water's mirror: the shores' skyline and lights by azimuth ---------- */
  function shoreTextures() {
    const N = 2048, yW = GEO.yW, hc = 212;
    const dS = new Float32Array(N), Hn = new Float32Array(N), dF = new Float32Array(N), HF = new Float32Array(N), aF = new Float32Array(N);
    const dB = new Float32Array(N), tw = new Float32Array(N), Lt = new Float32Array(N), Ld = new Float32Array(N), Lb = new Float32Array(N);
    const binOf = az => Math.floor(((az + Math.PI) / TAU) * N);
    for (let i = 0; i < N; i++) {
      const az = ((i + 0.5) / N) * TAU - Math.PI;
      const dx = Math.sin(az), dz = -Math.cos(az);
      let wet = false;
      for (let d = 30; d < 26000; d += d < 2500 ? 15 : 70) {
        const [s, c] = toSC(dx * d, dz * d);
        if (isWater(s, c)) wet = true;
        else if (wet) {
          dS[i] = d;
          break;
        }
      }
      if (dS[i]) {
        let h = 0;
        for (let e = 0; e <= 600; e += 25) {
          const [s, c] = toSC(dx * (dS[i] + e), dz * (dS[i] + e));
          h = Math.max(h, landY(s, c) - yW);
        }
        Hn[i] = h;
        const [s, c] = toSC(dx * dS[i], dz * dS[i]);
        if (c > cMan(s) - 5 && s < 15500) Lb[i] += 0.12; // the far shore's own lamps and traffic
      }
      const rs = dx * SD[0] + dz * SD[1], rc = dx * CD[0] + dz * CD[1];
      if (rs > 1e-3) {
        const d = GEO.sB / rs, u = d * rc;
        if (u > cCliff(GEO.sB) && u < cMan(GEO.sB) + 250) {
          dB[i] = d;
          tw[i] = Math.abs(u - GEO.t1) < 11 || Math.abs(u - GEO.t2) < 11 ? 1 : 0;
        }
      }
    }
    for (const b of BL) {
      const [x, z, w, d, h, y0] = b;
      const dist = Math.hypot(x, z);
      if (dist < 300) continue;
      const az = Math.atan2(x, -z), half = (Math.max(w, d) * 0.5) / dist;
      const i0 = binOf(az - half), i1 = binOf(az + half), nb = i1 - i0 + 1;
      const top = y0 + h - yW;
      for (let ii = i0; ii <= i1; ii++) {
        const i = (ii + N) % N;
        if (!dS[i] || dist < dS[i] - 20) continue;
        if (dist < dS[i] + 700) Hn[i] = Math.max(Hn[i], Math.min(top, 254));
        else if (top / dist > aF[i]) {
          aF[i] = top / dist;
          HF[i] = Math.min(top, 508);
          dF[i] = dist;
        }
        if (dist < dS[i] + 2500 && !((b[8] >> 4) & FL.DARK)) Lb[i] += (h * 2.2) / dist / nb;
      }
    }
    for (const L of LAMPS) {
      if (L[3] !== 3) continue;
      const p = L[0], dist = Math.hypot(p.x, p.z);
      const i = binOf(Math.atan2(p.x, -p.z));
      if (i < 0 || i >= N) continue;
      const k = clamp((L[2] * 40) / dist, 0.03, 0.3);
      Lt[i] += k;
      Ld[i] += k * ((dist * hc) / (hc + Math.max(p.y - yW, 1)));
    }
    const shore = new Uint8Array(N * 3 * 4), glow = new Uint8Array(N * 4);
    const enc = (row, i, d, v) => {
      const q = Math.round(clamp(d / 26000, 0, 1) * 65535), o = (row * N + i) * 4;
      shore[o] = q >> 8;
      shore[o + 1] = q & 255;
      shore[o + 2] = Math.round(clamp(v, 0, 255));
      shore[o + 3] = 255;
    };
    for (let i = 0; i < N; i++) {
      enc(0, i, dS[i], Hn[i]);
      enc(1, i, dF[i], HF[i] / 2);
      enc(2, i, dB[i], tw[i] * 255);
      const l = Lt[i];
      glow[i * 4] = Math.round(clamp(l, 0, 1) * 255);
      glow[i * 4 + 1] = Math.round(clamp(l > 0 ? Ld[i] / l / 26000 : 0, 0, 1) * 255);
      glow[i * 4 + 2] = Math.round(clamp(Lb[i], 0, 0.7) * 255);
      glow[i * 4 + 3] = 255;
    }
    const t1 = new THREE.DataTexture(shore, N, 3, THREE.RGBAFormat);
    t1.magFilter = t1.minFilter = THREE.NearestFilter;
    t1.needsUpdate = true;
    const t2 = new THREE.DataTexture(glow, N, 1, THREE.RGBAFormat);
    t2.magFilter = t2.minFilter = THREE.LinearFilter;
    t2.needsUpdate = true;
    return [t1, t2];
  }

  /* ---------- the ground and the river ---------- */
  function sKnots() {
    const k = [];
    const run = (a, b, st) => {
      for (let s = a; s < b - 1e-6; s += st) k.push(s);
    };
    run(-12000, -4000, 400);
    run(-4000, -1600, 100);
    run(-1600, 2600, 20);
    run(2600, 6000, 60);
    run(6000, 26000, 200);
    k.push(26000);
    return k;
  }
  const C_WEST = [-9000, -7000, -5500, -4300, -3400, -2700, -2150, -1700, -1350, -1070];
  const C_CLIFF = [-850, -680, -540, -430, -340, -270, -215, -170, -135, -105, -80, -60, -44, -32, -22, -14, -8, -3, 0, 2, 5, 9, 14, 21, 30, 41, 54, 68, 80];
  const C_JER = [-40, -22, -10, -3, 0, 5, 14, 40];
  const C_MAN = [-40, -14, -5, 0, 4, 10, 18, 28, 40, 52, 66, 82, 100, 122, 148, 178, 214, 256, 305, 365, 440, 530, 640, 770, 920, 1100, 1300, 1550, 1850, 2200, 2600, 3100, 3700, 4400, 5200, 6200, 7400, 9000];
  function cKnots(s) {
    const cj = cJer(s), cm = cMan(s), cl = cj - njStrip(s);
    const out = C_WEST.slice();
    for (const v of C_CLIFF) out.push(cl + v);
    for (const v of C_JER) out.push(cj + v);
    out.push((cj + cm) / 2);
    for (const v of C_MAN) out.push(cm + v);
    for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1] + 0.5) out[i] = out[i - 1] + 0.5;
    return out;
  }
  function gridIndex(rows, cols, keep) {
    const idx = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        if (keep && !keep(a, b, c, d)) continue;
        idx.push(a, c, b, b, c, d);
      }
    }
    return idx;
  }
  function buildTerrain(mat) {
    const S = sKnots(), cols = cKnots(0).length, n = S.length * cols;
    const pos = new Float32Array(n * 3), sc = new Float32Array(n * 2), land = new Float32Array(n * 4), misc = new Float32Array(n * 4);
    let k = 0;
    for (const s of S) {
      for (const c of cKnots(s)) {
        const y = landY(s, c), [x, z] = toW(s, c), A = landAttrs(s, c);
        pos[k * 3] = x;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = z;
        sc[k * 2] = s;
        sc[k * 2 + 1] = c;
        land.set(A.slice(0, 4), k * 4);
        misc.set(A.slice(4, 8), k * 4);
        k++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSC', new THREE.BufferAttribute(sc, 2));
    g.setAttribute('aLand', new THREE.BufferAttribute(land, 4));
    g.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4));
    const lim = GEO.yW - 2.5;
    g.setIndex(gridIndex(S.length, cols, (a, b, c, d) => Math.max(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1], pos[d * 3 + 1]) > lim));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
  function buildWater(mat) {
    const S = sKnots(), cols = 26;
    const pos = new Float32Array(S.length * cols * 3), bank = new Float32Array(S.length * cols * 2);
    S.forEach((s, i) => {
      const c0 = cJer(s) - 30, c1 = cMan(s) + 30 + 2400 * smooth(16300, BATTERY, s);
      const open = smooth(15800, 16600, s); // past the Battery the Manhattan bank turns away: no edge foam in the harbour
      for (let j = 0; j < cols; j++) {
        const c = lerp(c0, c1, j / (cols - 1));
        const [x, z] = toW(s, c);
        pos.set([x, GEO.yW, z], (i * cols + j) * 3);
        bank.set([c - cJer(s), lerp(cMan(s) - c, 999, open)], (i * cols + j) * 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aBank', new THREE.BufferAttribute(bank, 2));
    g.setIndex(gridIndex(S.length, cols));
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }

  /* ---------- geometry for houses, tanks and crowns ---------- */
  function houseGeometry() {
    const M = new Mesher([['aPart', 1]]);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const e = 0.62, r = 1.0, o = 0.56;
    const C = [v(-0.5, 0, -0.5), v(0.5, 0, -0.5), v(0.5, 0, 0.5), v(-0.5, 0, 0.5)];
    const T = C.map(p => v(p.x, e, p.z));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      M.quad(C[i], C[j], T[j], T[i], [0], v((C[i].x + C[j].x) / 2, 0, (C[i].z + C[j].z) / 2));
    }
    // a gable roof, ridge along x, eaves overhanging
    const rA = v(-0.53, r, 0), rB = v(0.53, r, 0);
    M.quad(v(-0.53, e - 0.03, -o), v(0.53, e - 0.03, -o), rB, rA, [1], v(0, 0.5, -1));
    M.quad(v(0.53, e - 0.03, o), v(-0.53, e - 0.03, o), rA, rB, [1], v(0, 0.5, 1));
    M.tri(v(-0.5, e, -0.5), v(-0.5, e, 0.5), v(-0.5, r - 0.02, 0), [0], v(-1, 0, 0));
    M.tri(v(0.5, e, 0.5), v(0.5, e, -0.5), v(0.5, r - 0.02, 0), [0], v(1, 0, 0));
    // Shared shallow trim, entry steps and a small chimney: still one house draw call.
    const detailBox=(x,y,z,w,h,d,part)=>{
      const q=[v(x-w/2,y-h/2,z-d/2),v(x+w/2,y-h/2,z-d/2),v(x+w/2,y-h/2,z+d/2),v(x-w/2,y-h/2,z+d/2)];
      const t=q.map(p=>v(p.x,y+h/2,p.z));
      for(let i=0;i<4;i++){const j=(i+1)%4;M.quad(q[i],q[j],t[j],t[i],[part],v((q[i].x+q[j].x)/2-x,0,(q[i].z+q[j].z)/2-z));}
      M.quad(t[0],t[1],t[2],t[3],[part],v(0,1,0));
    };
    detailBox(0,.14,.507,.11,.28,.014,3);
    detailBox(0,.015,.55,.21,.03,.14,2);
    detailBox(0,.585,-.555,1.10,.023,.025,2);
    detailBox(0,.585,.555,1.10,.023,.025,2);
    detailBox(-.29,.97,.08,.085,.23,.10,4);
    detailBox(-.29,1.09,.08,.10,.017,.115,5);
    return M.geometry();
  }
  function tankGeometry() {
    const M = new Mesher([['aPart', 1]]);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      const p = (a, rr, y) => v(Math.cos(a) * rr, y, Math.sin(a) * rr);
      M.quad(p(a0, 0.5, 0.3), p(a1, 0.5, 0.3), p(a1, 0.5, 0.86), p(a0, 0.5, 0.86), [0], p((a0 + a1) / 2, 1, 0));
      M.tri(p(a0, 0.54, 0.86), p(a1, 0.54, 0.86), v(0, 1.05, 0), [1], p((a0 + a1) / 2, 1, 0.5));
    }
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) {
      const b = [v(x - 0.04, 0, z - 0.04), v(x + 0.04, 0, z - 0.04), v(x + 0.04, 0, z + 0.04), v(x - 0.04, 0, z + 0.04)];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        M.quad(b[i], b[j], v(b[j].x, 0.31, b[j].z), v(b[i].x, 0.31, b[i].z), [2], v((b[i].x + b[j].x) / 2 - x, 0, (b[i].z + b[j].z) / 2 - z));
      }
    }
    return M.geometry();
  }
  /* ---------- the season and the hour ---------- */
  function season(d) {
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const fall = smooth(265, 295, doy) * (1 - smooth(318, 340, doy));
    const bare = clamp(smooth(290, 330, doy) * 0.97 + (1 - smooth(95, 125, doy)) * 0.97, 0, 0.97);
    const spring = smooth(95, 115, doy) * (1 - smooth(125, 150, doy));
    return { fall, bare, spring };
  }
  const LIT = [[0, 0.22], [1, 0.16], [3, 0.1], [5, 0.09], [6.5, 0.16], [8, 0.2], [12, 0.2], [16, 0.27], [18, 0.36], [20, 0.38], [22, 0.32], [24, 0.22]];
  const litAt = h => table(LIT, ((h % 24) + 24) % 24);

  /* ---------- build ---------- */
  /* ---------- the river's traffic ----------
     What actually moves on this reach of the Hudson in November: tugs pushing barges (gravel, fuel), the year-round
     excursion boats that round Manhattan and pass under the bridge, and the odd motor yacht heading south for the
     winter (daylight only). No sailboats: the season is over. Each vessel runs a straight lane in the river frame;
     its hull is boxes in the city's own material (so light and haze match), a wake is drawn on the water behind it,
     and after dark its navigation lights are points in the city's light material. Positions are a pure function of
     the sky's clock, so a reduced-motion office simply holds them still. */
  const WAKE_VERT = `
varying vec3 vWorld;
varying vec2 vUv;
${VERT}
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(w.xyz), 1.0);
}`;
  const WAKE_FRAG = `
varying vec3 vWorld;
varying vec2 vUv;
uniform float uWake;
${FRAG}
void main() {
  float along = vUv.x;               // 0 at the stern, 1 at the wake's end
  float across = abs(vUv.y * 2.0 - 1.0);
  float arms = smoothstep(0.07, 0.0, abs(across - min(along * 1.25, 1.0) * 0.92)) * (1.0 - along); // the Kelvin arms
  float trail = smoothstep(0.28, 0.0, across - along * 0.12) * pow(1.0 - along, 1.6);            // the churned centre
  float n = vnoise(vWorld.xz * 0.35 + vec2(uTime * 0.6, 0.0));
  float a = max(arms * 0.55, trail * 0.85) * (0.55 + 0.45 * n) * smoothstep(0.0, 0.02, along) * uWake;
  vec3 foam = vec3(0.92, 0.94, 0.95) * (uSkyCol * 1.6 + uSunCol * 0.55) + vec3(0.02);
  gl_FragColor = vec4(foam, a * (1.0 - 0.75 * uNight));
  ${OUT}
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;
  const BOATS = { list: [], parts: 0, mesh: null, wakes: [], lights: null, lightPos: null };
  // a pointed bow: a square box turned 45° on the hull's front end (the diamond's front half is the stem)
  const bow = (x, beam, y0, h, pal) => [x, 0, y0, beam * 0.7071, beam * 0.7071, h, pal, Math.PI / 4];
  function genBoats() {
    // lane: s from → to (the direction of travel), c across, speed m/s, phase; parts: [dx(along), dz(across), y0, len, beam, h, pal]
    const tug = (barge) => [
      [0, 0, -1.2, 30, 9, 3.4, 3], [2, 0, 2.2, 12, 7, 3.2, 1], [3, 0, 5.4, 6, 6, 2.6, 1], [3, 0, 8.0, 2.4, 3.6, 0.3, 3], // hull, house, wheelhouse, its roof
      [-4, 0, 2.2, 1.2, 1.2, 6.5, 13], // the stack
      bow(-15, 9, -1.2, 3.4, 3), // tugs are round at both ends; a chamfered stern reads close enough
      ...(barge ? [[47, 0, -1.4, 62, 17, 3.6, 10], [47, 0, 2.2, 46, 12, 2.2, 6]] : []), // the barge ahead of her, and its load
    ];
    const excursion = [[0, 0, -1.0, 50, 10, 3.6, 1], bow(25, 10, -1.0, 3.6, 1), [-2, 0, 2.6, 38, 9, 2.6, 1], [-2, 0, 2.9, 37.6, 9.1, 1.4, 3], [-4, 0, 5.2, 28, 8.4, 2.2, 1], [-4, 0, 5.5, 27.6, 8.5, 1.1, 3], [6, 0, 7.4, 6, 5, 2.0, 1]];
    const yacht = [[0, 0, -0.8, 19, 5.4, 2.6, 1], bow(9.5, 5.4, -0.8, 2.6, 1), [-1.5, 0, 1.8, 9, 4.2, 1.8, 1], [-1.5, 0, 2.2, 8.8, 4.3, 0.8, 3], [-2.5, 0, 3.6, 4.5, 3.6, 0.15, 1]];
    BOATS.list = [
      { lane: [-5200, 6200, 610], v: 3.6, ph: 0.18, parts: tug(true), wake: [70, 26], day: false, lights: 'tug' }, // downstream, pushing south
      { lane: [6200, -5200, 520], v: 3.2, ph: 0.71, parts: tug(true), wake: [70, 26], day: false, lights: 'tug' }, // back up the river
      { lane: [-4800, 7000, 930], v: 5.8, ph: 0.42, parts: excursion, wake: [120, 34], day: false, lights: 'ship' },
      { lane: [-5000, 7500, 1010], v: 7.5, ph: 0.05, parts: yacht, wake: [90, 22], day: true, lights: 'small' },
    ];
    BOATS.parts = BOATS.list.reduce((n, b) => n + b.parts.length, 0);
  }
  /** Each vessel's pose now: world x, z, heading, and whether it is shown. */
  function boatPose(b, time) {
    const [s0, s1, c] = b.lane, L = Math.abs(s1 - s0);
    const t = ((b.ph + time * b.v / L) % 1 + 1) % 1;
    const s = s0 + (s1 - s0) * t;
    const [x, z] = toW(s, c);
    const dir = Math.sign(s1 - s0);
    return { x, z, yaw: Math.atan2(-SD[1] * dir, SD[0] * dir), dir, t };
  }
  function buildBoats(g, cityMat, mat) {
    genBoats();
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    geo.deleteAttribute('uv');
    const mesh = new THREE.InstancedMesh(geo, cityMat, BOATS.parts);
    const data = new Float32Array(BOATS.parts * 4);
    let k = 0;
    for (const b of BOATS.list) for (const p of b.parts) { data.set([17 + k * 3.7, p[6] + 16 * FL.DARK, 6, GEO.yW], k * 4); k++; }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(mesh);
    BOATS.mesh = mesh;
    const wakeMat = mat(WAKE_VERT, WAKE_FRAG, { uWake: { value: 1 } }, { transparent: true, depthWrite: false });
    for (const b of BOATS.list) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-HALF_PI).translate(0.5, 0, 0), wakeMat);
      w.frustumCulled = false;
      w.renderOrder = 1;
      g.add(w);
      BOATS.wakes.push(w);
    }
    // navigation lights: masthead (white), sidelights (red to port, green to starboard), a cabin glow on the excursion boat
    const L = [];
    for (const [i, b] of BOATS.list.entries()) {
      const top = b.lights === 'small' ? 5 : 11;
      L.push([i, b.lights === 'tug' ? 3 : 8, 0, top, [1, 0.97, 0.9], 2.2]);
      L.push([i, 6, -1, 4.5, [1, 0.12, 0.08], 1.8], [i, 6, 1, 4.5, [0.25, 1, 0.45], 1.8]);
      if (b.lights === 'tug') L.push([i, 3, 0, top - 2.4, [1, 0.97, 0.9], 2.2], [i, 72, 0, 3, [1, 0.75, 0.3], 1.6]); // towing pair, the barge's bow light
      if (b.lights === 'ship') for (let j = -3; j <= 3; j++) L.push([i, j * 5, 0, 4, [1, 0.82, 0.58], 2.6]);
    }
    const n = L.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), info = new Float32Array(n * 4);
    L.forEach((l, j) => { col.set(l[4], j * 3); info.set([l[5], 3, 0, 0], j * 4); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    lg.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    lg.setAttribute('aMove', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(lg, mat(LIGHT_VERT, LIGHT_FRAG, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false;
    g.add(pts);
    BOATS.lights = { pts, L };
    updateBoats(0, 0);
  }
  const _bm = new Float32Array(16);
  function updateBoats(time, night) {
    updateHeli(time);
    if (!BOATS.mesh) return;
    const arr = BOATS.mesh.instanceMatrix.array;
    let k = 0;
    const poses = BOATS.list.map((b, i) => {
      const P = boatPose(b, time), show = !(b.day && night > 0.5);
      const c = Math.cos(P.yaw), sn = Math.sin(P.yaw);
      for (const p of b.parts) {
        const lx = p[0], lz = p[1];
        const x = P.x + lx * c + lz * sn, z = P.z - lx * sn + lz * c;
        setTRS(arr, k * 16, x, GEO.yW + p[2], z, P.yaw + (p[7] || 0), show ? p[3] : 0, show ? p[5] : 0, show ? p[4] : 0);
        k++;
      }
      const w = BOATS.wakes[i], tail = b.parts[0][3] / 2 - 2; // the wake starts at the stern
      w.visible = show;
      w.position.set(P.x - tail * c, GEO.yW + 0.08, P.z + tail * sn);
      w.rotation.y = P.yaw + Math.PI;
      w.scale.set(b.wake[0], 1, b.wake[1]);
      return { P, show, c, sn };
    });
    BOATS.mesh.instanceMatrix.needsUpdate = true;
    const { pts, L } = BOATS.lights, pos = pts.geometry.attributes.position.array;
    L.forEach((l, j) => {
      const q = poses[l[0]];
      const x = q.P.x + l[1] * q.c + l[2] * q.sn * 3, z = q.P.z - l[1] * q.sn + l[2] * q.c * 3;
      pos[j * 3] = x; pos[j * 3 + 1] = q.show ? GEO.yW + l[3] : -1e4; pos[j * 3 + 2] = z;
    });
    pts.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- the air over the river (9.0): a tour helicopter working the Hudson corridor, and jets in the distance
     The corridor below 1,300 ft is flown by sightseeing helicopters all day; jets for Teterboro and LaGuardia cross
     the sky higher up. Both are lights first: by day a dark speck and a faint beacon, by night beacon, strobe and
     navigation lights. The helicopter loops within a kilometre and a half (inside the uncompressed range); the jets
     are shader-driven traffic points, no CPU work at all. */
  function genAir(rnd) {
    const jet = (s0, c0, y0, s1, c1, y1, speed) => {
      const [x0, z0] = toW(s0, c0), [x1, z1] = toW(s1, c1);
      const a = new THREE.Vector3(x0, GEO.yW + y0, z0), run = new THREE.Vector3(x1, GEO.yW + y1, z1).sub(a);
      const ph = rnd(), rate = speed / run.length();
      LAMPS.push([a, [1.0, 0.97, 0.9], 5.5, 2, ph, rate, run]); // the landing light
      LAMPS.push([a.clone().add(new THREE.Vector3(0, 3, 0)), [1.0, 0.16, 0.1], 2.2, 2, ph - 0.0012, rate, run]); // the beacon, just behind
    };
    jet(-9000, 4200, 1500, 9000, -2500, 650, 78); // descending north-west across the river towards Teterboro
    jet(8000, 6500, 2100, -9000, 5200, 1700, 92);
    jet(-7000, -6000, 3200, 9000, 7000, 3200, 120); // high and level
  }
  const HELI = { mesh: null, lights: null, rotor: 0 };
  function buildHeli(g, cityMat, mat) {
    // body parts: [dx (forward), dy, dz, len, h, width, pal]
    const parts = [[0, 0, 0, 7.5, 2.6, 2.4, 13], [4.2, 0.5, 0, 2.2, 1.6, 2.0, 13], [-7.2, 1.0, 0, 7.5, 0.55, 0.55, 13], [-10.6, 1.0, 0, 1.0, 2.2, 0.25, 13],
      [0.2, -0.9, -1.1, 5.5, 0.12, 0.12, 13], [0.2, -0.9, 1.1, 5.5, 0.12, 0.12, 13], [0, 1.75, 0, 1.2, 0.8, 1.0, 13], [0, 2.3, 0, 11.5, 0.08, 0.35, 13], [0, 2.3, 0, 11.5, 0.08, 0.35, 13]];
    HELI.parts = parts;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // as the city's boxes: the base at 0
    geo.deleteAttribute('uv');
    const mesh = new THREE.InstancedMesh(geo, cityMat, parts.length);
    const data = new Float32Array(parts.length * 4);
    parts.forEach((p, k) => data.set([91 + k * 2.3, p[6] + 16 * FL.DARK, 6, GEO.yW + 190], k * 4));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(mesh);
    HELI.mesh = mesh;
    // beacon (red, flashing), tail strobe (white, flashing), port red, starboard green, the nose's landing light at night
    const L = [[0, 2.2, 0, [1, 0.12, 0.08], 2.4, 1, 0.0], [-10.8, 2.2, 0, [1, 1, 1], 2.2, 1, 0.5], [0.5, 0, -1.4, [1, 0.12, 0.08], 1.4, 3], [0.5, 0, 1.4, [0.25, 1, 0.45], 1.4, 3], [5.2, -0.6, 0, [1, 0.95, 0.85], 3.2, 3]];
    const n = L.length, lg = new THREE.BufferGeometry();
    const col = new Float32Array(n * 3), info = new Float32Array(n * 4);
    L.forEach((l, j) => { col.set(l[3], j * 3); info.set([l[4], l[5], l[6] || 0, 0], j * 4); });
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    lg.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    lg.setAttribute('aMove', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(lg, mat(LIGHT_VERT, LIGHT_FRAG, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false;
    g.add(pts);
    HELI.lights = { pts, L };
  }
  /** One loop of the corridor every four minutes: north along the Manhattan side, south along the New Jersey side. */
  function heliPose(time) {
    const th = (time / 240) * Math.PI * 2;
    const S = 1250, C = 190, c0 = 700;
    const s = -S * Math.cos(th), c = c0 + C * Math.sin(th);
    const ds = S * Math.sin(th), dc = C * Math.cos(th);
    const [x, z] = toW(s, c), [dx, dz] = toW(ds, dc);
    return { x, y: GEO.yW + 205 + 12 * Math.sin(th * 2), z, yaw: Math.atan2(-dz, dx) };
  }
  function updateHeli(time) {
    if (!HELI.mesh) return;
    const P = heliPose(time), arr = HELI.mesh.instanceMatrix.array;
    const c = Math.cos(P.yaw), sn = Math.sin(P.yaw);
    HELI.parts.forEach((p, k) => {
      const x = P.x + p[0] * c + p[2] * sn, z = P.z - p[0] * sn + p[2] * c;
      const spin = k >= 7 ? time * 31 + (k - 7) * HALF_PI : 0; // the two blades turn (a blur at this distance)
      setTRS(arr, k * 16, x, P.y + p[1] - p[4] / 2, z, P.yaw + spin, p[3], p[4], p[5]);
    });
    HELI.mesh.instanceMatrix.needsUpdate = true;
    const { pts, L } = HELI.lights, pos = pts.geometry.attributes.position.array;
    L.forEach((l, j) => { pos[j * 3] = P.x + l[0] * c + l[2] * sn; pos[j * 3 + 1] = P.y + l[1]; pos[j * 3 + 2] = P.z - l[0] * sn + l[2] * c; });
    pts.geometry.attributes.position.needsUpdate = true;
  }

  function build() {
    const t0 = performance.now();
    BL = [];
    TANKS = [];
    AIR = [];
    TREES = [];
    LAMPS = [];
    _r01 = seeded(4242);
    const g = new THREE.Group();
    g.name = 'city';
    const U = {
      uC0: { value: new THREE.Vector3(...GEO.C0) },
      uTop: { value: new THREE.Color('#4b88cc') },
      uHor: { value: new THREE.Color('#d6e4ef') },
      uGlow: { value: new THREE.Color('#fff1dc') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, -0.4).normalize() },
      uSunCol: { value: new THREE.Color(1, 0.95, 0.88) },
      uSkyCol: { value: new THREE.Color(0.3, 0.4, 0.55) },
      uBounce: { value: new THREE.Color(0.2, 0.2, 0.18) },
      uCityGlow: { value: new THREE.Color(0.1, 0.072, 0.052) },
      uCityDir: { value: new THREE.Vector2(Math.sin(20 * DEG), -Math.cos(20 * DEG)) },
      uDusk: { value: 0 },
      uNight: { value: 0 },
      uVis: { value: 15500 },
      uTime: { value: 0 },
      uLit: { value: 0.45 },
      uFall: { value: 0 },
      uBare: { value: 0 },
      uSpring: { value: 0 },
      uPx: { value: 1000 },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, // (56_landscape.js: the moon's real place for the hour)
      uMoonLit: { value: 0 },
      uCloud: { value: 0.45 },
    };
    const mat = (vs, fs, extra = {}, opts = {}) => new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, U, extra), vertexShader: vs, fragmentShader: fs, extensions: { derivatives: true } }, opts));

    // the sky dome follows the camera
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4300, 48, 24), mat(SKY_VERT, SKY_FRAG, {}, { side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    g.add(sky);
    SKY.mesh = sky;
    SKY.common = U;
    SKY.skyU = U;

    const rnd = seeded(1958);
    // our own tower under the floor, and its lobby on the cliff
    // (flag DARK: seen from a few metres its lit rooms read as flat white panels, so after dark only the office glows)
    // (flag 16 marks it as ours: its glass runs right up to the office, with no parapet or plant screen at the top)
    // (9.0: the crown widened to the terrace's footprint, TERRACE in 53_terrace.js: a planted roof round the floor)
    BL.push([(TERRACE.x0 + TERRACE.x1) / 2, (TERRACE.z0 + TERRACE.z1) / 2, TERRACE.x1 - TERRACE.x0, TERRACE.z1 - TERRACE.z0, -0.56 - GEO.G, GEO.G, 0, 0, 3 + 16 * (8 | 16), 42.4, GEO.G]);
    const counts = {};
    const tally = (k, f) => {
      const n0 = BL.length;
      const r = f();
      counts[k] = BL.length - n0;
      return r;
    };
    tally('manhattan', () => genManhattan(rnd));
    tally('bronx', () => genBronx(rnd));
    tally('nj', () => genNJ(rnd));
    const houses = tally('njFlats', () => genHouses(rnd));
    genWoods(rnd);
    genForecourt(rnd);
    genAir(rnd);
    const M = new Mesher([['aData', 4], ['aExtra', 4]]);
    genLandmarks(M, rnd);
    const steel = new Mesher([['aKind', 1], ['aUV', 2]]);
    const ropes = new Mesher([['aUV', 2]]);
    genBridge(steel, ropes);
    genRoadLights(rnd);
    genStreetDetail();
    const LX = { mat, U, LAMPS, VERT, FRAG, NOISE, GEO, SD, CD, toW, toSC, landY, landAttrs, cJer, cMan, cCliff, isWater, rnd: seeded(5611) };
    const extra = LANDSCAPE.gen(LX);
    for (const [s, c, y] of AIR) {
      const [x, z] = toW(s, c);
      LAMPS.push([new THREE.Vector3(x, y + 1.5, z), [1.0, 0.08, 0.03], 3.0, 1, rnd()]);
    }

    // the ground and the river
    const ground = buildTerrain(mat(TER_VERT, TER_FRAG));
    g.add(ground);
    const [shoreTex, glowTex] = shoreTextures();
    const waterMat = mat(WATER_VERT, WATER_FRAG, { uShore: { value: shoreTex }, uGlowTex: { value: glowTex } });
    g.add(buildWater(waterMat));

    // buildings
    const cityMat = mat(BLD_VERT_INST, BLD_FRAG);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    boxGeo.deleteAttribute('uv');
    g.add(instanced(boxGeo, cityMat, BL, (b, arr, o, data, k) => {
      setTRS(arr, o, b[0], b[5], b[1], b[6], b[2], b[4], b[3]);
      data[k] = b[9];
      data[k + 1] = b[8];
      data[k + 2] = b[7];
      data[k + 3] = b[10];
    }));
    const lmMesh = new THREE.Mesh(M.geometry(), mat(BLD_VERT_MERGED, BLD_FRAG));
    lmMesh.frustumCulled = false;
    g.add(lmMesh);

    // houses and Manhattan's water tanks share a material
    const houseMat = mat(HOUSE_VERT, HOUSE_FRAG);
    g.add(instanced(houseGeometry(), houseMat, houses, (h, arr, o, data, k) => {
      setTRS(arr, o, h[0], h[6], h[1], h[2], h[3], h[4], h[5]);
      data[k] = h[9];
      data[k + 1] = h[7];
      data[k + 2] = h[8];
      data[k + 3] = h[6];
    }));
    g.add(instanced(tankGeometry(), houseMat, TANKS, (t, arr, o, data, k) => {
      const [x, z] = toW(t[0], t[1]);
      const sz = 4 + t[3] * 1.5;
      setTRS(arr, o, x, t[2], z, 0, sz, 7 + t[3] * 2, sz);
      data[k] = t[3];
      data[k + 1] = 0;
      data[k + 2] = 20;
      data[k + 3] = t[2];
    }));
    // trees
    const card = new THREE.PlaneGeometry(1, 1);
    card.deleteAttribute('uv');
    g.add(instanced(card, mat(TREE_VERT, TREE_FRAG, {}, { alphaToCoverage: true }), TREES, (t, arr, o, data, k) => {
      setTRS(arr, o, t[0], t[2], t[1], 0, t[3], t[4], t[3]);
      data[k] = t[5];
      data[k + 1] = 0;
      data[k + 2] = 0;
      data[k + 3] = t[6];
    }));

    // the bridge, its ropes
    const steelMesh = new THREE.Mesh(steel.geometry(), mat(STEEL_VERT, STEEL_FRAG));
    steelMesh.frustumCulled = false;
    g.add(steelMesh);
    const ropeMesh = new THREE.Mesh(ropes.geometry(), mat(ROPE_VERT, ROPE_FRAG, {}, { transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ropeMesh.frustumCulled = false;
    g.add(ropeMesh);

    // points of light
    const nL = LAMPS.length;
    const lp = new Float32Array(nL * 3), lc = new Float32Array(nL * 3), li = new Float32Array(nL * 4), lm = new Float32Array(nL * 3);
    LAMPS.forEach((L, i) => {
      lp.set([L[0].x, L[0].y, L[0].z], i * 3);
      lc.set(L[1], i * 3);
      li.set([L[2], L[3], L[4] || 0, L[5] || 0], i * 4);
      if (L[6]) lm.set([L[6].x, L[6].y, L[6].z], i * 3);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
    lg.setAttribute('aInfo', new THREE.BufferAttribute(li, 4));
    lg.setAttribute('aMove', new THREE.BufferAttribute(lm, 3));
    const lights = new THREE.Points(lg, mat(LIGHT_VERT, LIGHT_FRAG, {}, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    lights.frustumCulled = false;
    g.add(lights);
    buildBoats(g, cityMat, mat);
    buildHeli(g, cityMat, mat);
    Object.assign(extra, LANDSCAPE.build(g, LX));

    SKY.cityMat = cityMat;
    SKY.groundMat = ground.material;
    SKY.waterMat = waterMat;
    SKY.info = { counts, buildings: BL.length, landmarkTris: M.P.length / 9, houses: houses.length, tanks: TANKS.length, trees: TREES.length, lights: nL, bridgeTris: steel.P.length / 9, landscape: extra, ms: Math.round(performance.now() - t0) };
    return g;
  }

  return { GEO, toW, toSC, llToSC, landY, cMan, cJer, cCliff, isWater, season, litAt, build, updateBoats, BOATS, HELI, heliPose };
})();

/* ---------- build ---------- */

function buildCity() {
  const g = CITY.build();
  const t = new URLSearchParams(location.search).get('time');
  if (t && /^\d{1,2}(:\d{2})?$/.test(t)) {
    const [hh, mm] = t.split(':').map(Number);
    SKY.override = clamp(hh + (mm || 0) / 60, 0, 23.99);
  }
  updateSky(0, true);
  return g;
}

/* ---------- the sun over Fort Lee ---------- */

function etOffsetHours(d) {
  const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((et - utc) / 3600000);
}
function sunPosition(d = new Date()) {
  const lat = (40.857 * Math.PI) / 180, lon = -73.958;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = Math.floor((d.getTime() - start) / 86400000);
  let utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  if (SKY.override != null) utcH = SKY.override - etOffsetHours(d);
  const decl = ((-23.44 * Math.PI) / 180) * Math.cos((TAU / 365) * (doy + 10));
  const ha = ((utcH + lon / 15 - 12) * 15 * Math.PI) / 180;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  return { el, az };
}
const etHourNow = d => (SKY.override != null ? SKY.override : (d.getUTCHours() + d.getUTCMinutes() / 60 + etOffsetHours(d) + 24) % 24);

const SKY_KEYS = [
  { el: -18, top: '#04070f', hor: '#0d1322', glow: '#000000', sun: 0, night: 1 },
  { el: -9, top: '#0b1430', hor: '#252b4c', glow: '#3a2238', sun: 0, night: 1 },
  { el: -4, top: '#203566', hor: '#9f6f73', glow: '#ff9264', sun: 0.05, night: 0.85 },
  { el: 1, top: '#36609e', hor: '#e9ad8a', glow: '#ffb27a', sun: 0.35, night: 0.45 },
  { el: 7, top: '#4a80c0', hor: '#e2d9cf', glow: '#ffd6a6', sun: 0.75, night: 0.08 },
  { el: 18, top: '#4b88cc', hor: '#d6e4ef', glow: '#fff1dc', sun: 1, night: 0 },
  { el: 90, top: '#3f7fc8', hor: '#d3e3f0', glow: '#fff6e8', sun: 1.05, night: 0 },
];
function skyAt(elDeg) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 1; i < SKY_KEYS.length; i++) {
    if (elDeg <= SKY_KEYS[i].el) {
      a = SKY_KEYS[i - 1];
      b = SKY_KEYS[i];
      break;
    }
  }
  const k = clamp((elDeg - a.el) / (b.el - a.el || 1), 0, 1);
  const mix = (p, q) => new THREE.Color(p).lerp(new THREE.Color(q), k);
  return { top: mix(a.top, b.top), hor: mix(a.hor, b.hor), glow: mix(a.glow, b.glow), sun: lerp(a.sun, b.sun, k), night: lerp(a.night, b.night, k) };
}

/** Moves the sky with the camera every frame; recomputes sun, sky, haze, lights and season every 20 s (or at once with force). */
function updateSky(dt, force = false) {
  if (!SKY.mesh) return;
  const U = SKY.common;
  U.uTime.value += dt;
  SKY.mesh.position.copy(camera.position);
  LANDSCAPE.update(U);
  CITY.updateBoats(U.uTime.value, U.uNight.value);
  U.uPx.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  const now = performance.now();
  if (!force && now < SKY.next) return;
  SKY.next = now + 20000;
  const d = new Date();
  const { el, az } = sunPosition(d);
  const elDeg = (el * 180) / Math.PI;
  const s = skyAt(elDeg);
  const wa = az - CITY.GEO.R;
  U.uSunDir.value.set(Math.sin(wa) * Math.cos(el), Math.sin(el), -Math.cos(wa) * Math.cos(el));
  U.uTop.value.copy(s.top);
  U.uHor.value.copy(s.hor);
  U.uGlow.value.copy(s.glow);
  U.uDusk.value = clamp(1 - Math.abs(elDeg - 1) / 9, 0, 1);
  U.uNight.value = s.night;
  U.uSunCol.value.copy(s.glow.clone().convertSRGBToLinear().multiplyScalar(s.sun * 1.9));
  U.uSkyCol.value.copy(s.top.clone().convertSRGBToLinear().lerp(s.hor.clone().convertSRGBToLinear(), 0.55).multiplyScalar(0.4 + 0.45 * (1 - s.night)).addScalar(0.01));
  U.uBounce.value.copy(s.hor.clone().convertSRGBToLinear().multiplyScalar(0.3 * (1 - s.night * 0.8)));
  U.uVis.value = lerp(15500, 11000, s.night);
  U.uLit.value = CITY.litAt(etHourNow(d));
  const se = CITY.season(d);
  U.uFall.value = se.fall;
  U.uBare.value = se.bare;
  U.uSpring.value = se.spring;
  // the moon, at the same hour as the sun (a ?time= preview moves both)
  const md = SKY.override != null ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + (SKY.override - etOffsetHours(d)) * 3600000) : d;
  const mp = LANDSCAPE.moonPosition(md, 40.857, -73.958);
  const mw = mp.az - CITY.GEO.R;
  U.uMoonDir.value.set(Math.sin(mw) * Math.cos(mp.el), Math.sin(mp.el), -Math.cos(mw) * Math.cos(mp.el));
  U.uMoonLit.value = clamp((1 - U.uMoonDir.value.dot(U.uSunDir.value)) / 2, 0, 1);
  // how cloudy the sky is: scenery that changes from day to day with the date, not a weather report
  const day = Math.floor(md.getTime() / 86400000);
  const hc = Math.sin(day * 12.9898) * 43758.5453;
  U.uCloud.value = 0.2 + 0.6 * (hc - Math.floor(hc));
  SKY.moon = { el: (mp.el * 180) / Math.PI, az: (mp.az * 180) / Math.PI, lit: U.uMoonLit.value, cloud: U.uCloud.value };
  scene.fog.color.copy(s.hor);
  scene.background = s.hor.clone();
  SKY.state = { el: elDeg, night: s.night };
  // the interior answers the hour a little: warmer and softer after dark
  hemi.color.set(0xfffdf8).lerp(new THREE.Color(0xffe9d2), s.night * 0.6);
  key.intensity = 1.05 - s.night * 0.2;
}
