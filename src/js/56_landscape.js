/* =============================================================================
   56 · THE LANDSCAPE BEYOND — far ridges, birds, the streets of Fort Lee, the moon
   -----------------------------------------------------------------------------
   55_city.js draws everything within 9 km inland and 26 km down the river. Past
   that the ground used to stop at a hard edge under an empty band of sky. This
   module finishes the world out to the real horizon, from real places:

   · The horizon ring. A camera-centred band at the far plane, with the land's
     skyline sampled by real azimuth and distance from Fort Lee: the rolling tree
     line of Bergen and Passaic, the Watchung ridges to the west, the Ramapos to
     the north-west, Hook Mountain and High Tor, the Hudson Highlands at Bear
     Mountain and Storm King up the river, Westchester's hills, Staten Island's
     Todt Hill, Long Island's moraine, and the Verrazzano-Narrows Bridge's towers
     in the gap of the Narrows. Heights are real; the earth's curve (with normal
     refraction) and the haze of 20–60 km of air do the rest, so the ridges sit a
     fraction of a degree above the horizon, faint by day, black against the dusk,
     and pricked with the lights of their towns at night. One draw call.
   · Birds, by day: herring gulls working the river and riding the cliff's updraft,
     and in October to December, skeins of Canada geese heading down the Hudson
     flyway. Wings flap in the vertex shader; one draw call; still under reduced motion.
   · Traffic on a handful of Fort Lee's through streets, as moving headlights and
     tail-lights in the city's existing light points (no extra draw call).
   · The moon at its real position and phase for the hour (55's sky shader draws it;
     this module computes where it is).
   ============================================================================= */

const LANDSCAPE = (() => {
  const DEG = Math.PI / 180;
  const REF = [40.857, -73.9585]; // the office, as in CITY.GEO.ref
  const EYE = 205; // the office floor above mean water, m
  const K = 6.75e-8; // the scene's drop with distance (the earth's curve with refraction), m per m²

  /** Real compass azimuth (radians, from north, clockwise) and distance (m) from the office. */
  const azd = (lat, lon) => {
    const N = (lat - REF[0]) * 111200, E = (lon - REF[1]) * 84220;
    return [Math.atan2(E, N), Math.hypot(N, E)];
  };
  /** The elevation angle (radians) of a point h metres above the water at distance D, from the office. */
  const elev = (h, D) => Math.atan((h - EYE - D * D * K) / D);

  // the land beyond the scene's own ground: ridges as polylines of [lat, lon, height above the water (m)]
  const RIDGES = [
    // the First Watchung Mountain, from Paterson's Garret Mountain south-west past Eagle Rock to Plainfield
    [[40.97, -74.16, 110], [40.925, -74.17, 150], [40.88, -74.2, 160], [40.83, -74.23, 185], [40.795, -74.245, 200], [40.75, -74.27, 190], [40.71, -74.33, 165], [40.66, -74.39, 150], [40.62, -74.46, 140]],
    // the Second Watchung, three kilometres behind
    [[40.95, -74.22, 170], [40.9, -74.24, 190], [40.84, -74.27, 200], [40.79, -74.29, 205], [40.73, -74.35, 180], [40.67, -74.42, 165]],
    // the Preakness range (High Mountain)
    [[40.99, -74.2, 200], [40.955, -74.215, 270], [40.93, -74.24, 230]],
    // the Ramapo Mountains, north-west
    [[41.13, -74.15, 330], [41.1, -74.17, 360], [41.06, -74.21, 340], [41.02, -74.27, 320], [40.99, -74.32, 300], [40.96, -74.37, 280]],
    // the Palisades' northern end: Hook Mountain and High Tor
    [[41.11, -73.91, 160], [41.13, -73.92, 220], [41.16, -73.95, 190], [41.19, -73.99, 250], [41.205, -74.03, 210], [41.22, -74.07, 180]],
    // the Hudson Highlands: Harriman's hills, Bear Mountain, Dunderberg, Storm King, Breakneck, Mount Beacon
    [[41.22, -74.13, 360], [41.26, -74.08, 380], [41.3, -74.03, 350], [41.312, -74.007, 390], [41.29, -73.99, 330], [41.32, -73.965, 270], [41.36, -73.99, 340], [41.43, -74.0, 410], [41.45, -73.97, 380], [41.488, -73.95, 490], [41.5, -73.9, 400]],
    // Westchester's hills along the river's east bank
    [[40.94, -73.87, 70], [40.99, -73.865, 95], [41.04, -73.86, 120], [41.09, -73.845, 140], [41.15, -73.85, 170], [41.2, -73.86, 160]],
    // Staten Island's spine: St. George, Grymes Hill, Todt Hill, Lighthouse Hill
    [[40.64, -74.08, 60], [40.62, -74.1, 105], [40.597, -74.108, 125], [40.58, -74.14, 95], [40.56, -74.17, 60]],
    // Long Island's Harbor Hill moraine
    [[40.79, -73.75, 50], [40.8, -73.68, 90], [40.8, -73.6, 100], [40.79, -73.5, 90], [40.78, -73.42, 80]],
  ];
  // the Verrazzano-Narrows Bridge: towers (Staten Island, Brooklyn), tower height, deck height, anchorages
  const VZ = { towers: [[40.6037, -74.0513], [40.6085, -74.0368]], anchors: [[40.6019, -74.0573], [40.6103, -74.0306]], top: 211, deck: 69, sag: 74 };
  // the Narrows: the one gap in the land's skyline, where the horizon is the sea's
  const NARROWS = [193.3 * DEG, 195.0 * DEG];

  const RING_VERT = `
attribute vec4 aRing;
varying vec3 vDir;
varying vec4 vRing;
void main() {
  vDir = position;
  vRing = aRing;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
  const ringFrag = FRAG => `
varying vec3 vDir;
varying vec4 vRing;
${FRAG}
void main() {
  // vRing: x distance (m), y kind (0 land, 1 ridge, 2 bridge steel, 3 bridge cable), z along (azimuth or span), w height below the skyline (deg)
  vec3 d = normalize(vDir);
  float D = vRing.x;
  float kind = vRing.y;
  float below = vRing.w;
  vec3 V = -d;
  vec3 n = normalize(vec3(V.x, 0.15, V.z));
  float wood = 0.75 + 0.5 * vnoise(vec2(vRing.z * 900.0, below * 40.0));
  vec3 alb = kind > 1.5 ? vec3(0.42, 0.44, 0.46) : vec3(0.035, 0.045, 0.034) * wood;
  vec3 col = alb * (uSkyCol * 0.9 + uSunCol * max(dot(n, uSunDir), 0.0) * 0.6);
  // after dark: the towns on the far hills and plains, and the bridge's necklace
  float lights = 0.0;
  if (uNight > 0.02) {
    if (kind < 1.5) {
      vec2 g = vec2(vRing.z * 2400.0, below * 55.0);
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float on = step(kind > 0.5 ? 0.86 : 0.8, hash12(id + kind * 17.0)) * step(0.04, below);
      lights = on * (1.0 - smoothstep(0.05, 0.32, length(f))) * (0.5 + 0.5 * hash12(id + 3.3));
    } else if (kind > 2.5) {
      float x = vRing.z * 48.0;
      lights = 1.0 - smoothstep(0.08, 0.3, abs(fract(x) - 0.5) * 2.0);
      lights *= 0.9;
    }
  }
  col += vec3(1.0, 0.78, 0.5) * lights * uNight * 2.2;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  // the air between: real distances, the same haze as the rest of the view (no 25 km cut-off: these are the far hills)
  vec3 hz = skyCol(normalize(vec3(d.x, max(d.y, 0.0) * 0.3 + 0.01, d.z)));
  float T = exp(-D * 0.55 / uVis);
  float lightT = exp(-D * 0.3 / uVis); // points of light carry farther than surfaces
  gl_FragColor.rgb = mix(hz, gl_FragColor.rgb, T) + vec3(1.0, 0.78, 0.5) * lights * uNight * lightT * 0.6;
}`;

  /** The horizon ring: land, ridges and the Verrazzano, as quads in (azimuth, elevation) at a fixed radius. */
  function buildRing(ctx) {
    const { mat, GEO, FRAG } = ctx;
    const P = [], A = [], I = [];
    const vert = (az, el, R, a) => {
      const wa = az - GEO.R, ce = Math.cos(el);
      P.push(Math.sin(wa) * ce * R, Math.sin(el) * R, -Math.cos(wa) * ce * R);
      A.push(...a);
      return P.length / 3 - 1;
    };
    const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
    const BOT = -3.0 * DEG;
    const N = 1440;
    const noise = (x, s) => {
      let v = 0, a = 0.5, f = 1;
      for (let o = 0; o < 4; o++) {
        v += a * (Math.sin(x * f * 1.7 + s + o * 1.3) * Math.sin(x * f * 0.73 + s * 2.1 + o)) ;
        a *= 0.5;
        f *= 2.3;
      }
      return v;
    };
    // the land's own skyline: woods and towns on rolling ground at about 40 km, the sea's horizon in the Narrows
    {
      const R = 4975;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const az = (i / N) * 2 * Math.PI;
        const sea = az > NARROWS[0] && az < NARROWS[1];
        const D = sea ? 55000 : 38000 + 6000 * noise(az * 9, 1.1);
        const h = sea ? 0 : 55 + 18 * noise(az * 40, 4.2) + 9 * noise(az * 400, 2.7);
        const top = elev(h, D);
        const a = vert(az, top, R, [D, 0, az, 0]), b = vert(az, BOT, R, [D, 0, az, (top - BOT) / DEG]);
        if (prev) quad(prev[1], b, a, prev[0]);
        prev = [a, b];
      }
    }
    // the ridges, each a strip along its own azimuths
    {
      const R = 4950;
      for (const ridge of RIDGES) {
        const pts = ridge.map(([la, lo, h]) => { const [az, D] = azd(la, lo); return { az: (az + 2 * Math.PI) % (2 * Math.PI), D, h }; });
        pts.sort((p, q) => p.az - q.az);
        const a0 = pts[0].az - 0.6 * DEG, a1 = pts[pts.length - 1].az + 0.6 * DEG;
        const steps = Math.max(8, Math.ceil((a1 - a0) / (0.08 * DEG)));
        let prev = null;
        for (let i = 0; i <= steps; i++) {
          const az = a0 + ((a1 - a0) * i) / steps;
          // interpolate distance and height along the polyline; the ends fall away to the plain
          let j = 0;
          while (j < pts.length - 2 && az > pts[j + 1].az) j++;
          const p = pts[j], q = pts[j + 1];
          const t = clamp((az - p.az) / (q.az - p.az || 1), 0, 1);
          const D = lerp(p.D, q.D, t);
          const ends = smooth(a0, pts[0].az, az) * (1 - smooth(pts[pts.length - 1].az, a1, az));
          const h = (lerp(p.h, q.h, t) * (0.9 + 0.12 * noise(az * 300, D * 1e-3)) + 6 * noise(az * 3000, 2.2)) * ends + 40 * (1 - ends);
          const top = elev(h, D);
          const a = vert(az, top, R, [D, 1, az, 0]), b = vert(az, BOT, R, [D, 1, az, (top - BOT) / DEG]);
          if (prev) quad(prev[1], b, a, prev[0]);
          prev = [a, b];
        }
      }
    }
    // the Verrazzano-Narrows Bridge: two towers, the deck, and its cables (thin, but a pixel or more wide)
    {
      const R = 4925;
      const [tA, dA] = azd(...VZ.towers[0]), [tB, dB] = azd(...VZ.towers[1]);
      const [aA, adA] = azd(...VZ.anchors[0]), [aB, adB] = azd(...VZ.anchors[1]);
      const W = 0.045 * DEG; // a tower's width on screen (a pixel or two)
      const rect = (az0, az1, e0, e1, D, kind) => quad(vert(az0, e0, R, [D, kind, az0, 0]), vert(az1, e0, R, [D, kind, az1, 0]), vert(az1, e1, R, [D, kind, az1, 0]), vert(az0, e1, R, [D, kind, az0, 0]));
      for (const [az, D] of [[tA, dA], [tB, dB]]) {
        for (const off of [-0.6, 0.6]) rect(az + off * W - W / 2, az + off * W + W / 2, elev(VZ.deck - 60, D), elev(VZ.top, D), D, 2);
        rect(az - W * 1.2, az + W * 1.2, elev(VZ.top - 12, D), elev(VZ.top - 8, D), D, 2);
      }
      rect(aA, aB, elev(VZ.deck - 6, (adA + adB) / 2), elev(VZ.deck, (adA + adB) / 2), (adA + adB) / 2, 2);
      // the main cable's catenary between the towers, and the side spans down to the anchorages
      const cable = (az0, D0, h0, az1, D1, h1, sag) => {
        const n = 40, T = 0.025 * DEG;
        for (let i = 0; i < n; i++) {
          const u0 = i / n, u1 = (i + 1) / n;
          const h = u => lerp(h0, h1, u) - sag * 4 * u * (1 - u);
          const za = lerp(az0, az1, u0), zb = lerp(az0, az1, u1), Da = lerp(D0, D1, u0), Db = lerp(D0, D1, u1);
          quad(vert(za, elev(h(u0), Da) - T, R, [Da, 3, u0 * Math.abs(az1 - az0) / DEG, 0]), vert(zb, elev(h(u1), Db) - T, R, [Db, 3, u1 * Math.abs(az1 - az0) / DEG, 0]),
            vert(zb, elev(h(u1), Db) + T, R, [Db, 3, u1 * Math.abs(az1 - az0) / DEG, 0]), vert(za, elev(h(u0), Da) + T, R, [Da, 3, u0 * Math.abs(az1 - az0) / DEG, 0]));
        }
      };
      cable(tA, dA, VZ.top, tB, dB, VZ.top, VZ.top - VZ.sag);
      cable(aA, adA, VZ.deck, tA, dA, VZ.top, 25);
      cable(tB, dB, VZ.top, aB, adB, VZ.deck, 25);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aRing', new THREE.Float32BufferAttribute(A, 4));
    g.setIndex(I);
    const m = new THREE.Mesh(g, mat(RING_VERT, ringFrag(FRAG), {}, { side: THREE.DoubleSide, toneMapped: false }));
    m.frustumCulled = false;
    m.renderOrder = -9; // just after the sky, before everything nearer
    m.name = 'horizon';
    return m;
  }

  /* ---------- birds ---------- */
  const BIRD_VERT = (VERT) => `
attribute vec2 aWing;  // x: across the span (-1 … 1), y: 0 at the leading edge, 1 at the trailing
attribute vec4 aBird;  // kind (0 goose, 1 gull), slot in the skein, phase, flock
attribute vec4 aPath;  // gulls: centre s, c, y, radius · geese: lane c, height, start s, speed
uniform float uDay;
uniform float uTime;
uniform vec2 uSD;
uniform vec2 uCD;
varying vec3 vWorld;
varying float vKind;
varying float vShade;
${VERT}
void main() {
  float kind = aBird.x;
  float t = uTime + aBird.z * 97.0;
  vec3 pos;
  vec2 fwd;
  float span, flap, glide;
  if (kind < 0.5) {
    // a skein of geese down the river: a V, the leader at slot 0, the arms trailing; slots shuffle a little
    float slot = aBird.y;
    float side = mod(slot, 2.0) * 2.0 - 1.0;
    float rank = ceil(slot / 2.0);
    float len = 17000.0;
    float s = aPath.z + mod(uTime * aPath.w + aBird.w * 6100.0, len);
    float c = aPath.x;
    vec2 head = uSD;
    vec2 lat = uCD;
    vec2 o = -head * rank * 2.7 + lat * side * rank * 2.3 + vec2(sin(t * 0.31), cos(t * 0.27)) * 0.5;
    pos = vec3(uSD.x * s + uCD.x * c + o.x, aPath.y + sin(t * 0.2) * 3.0, uSD.y * s + uCD.y * c + o.y);
    fwd = head;
    span = 0.85;
    flap = sin(t * 5.2 + slot * 0.7);
    glide = 0.0;
  } else {
    // a gull circling: a slow loop with a bob, wings mostly held, a few beats now and then
    float r = aPath.w;
    float dir = aBird.y > 0.5 ? 1.0 : -1.0;
    float a = t * 9.0 / r * dir + aBird.z * 6.283;
    float s = aPath.x + cos(a) * r;
    float c = aPath.y + sin(a) * r * 0.7;
    float y = aPath.z + sin(t * 0.37) * 6.0;
    pos = vec3(uSD.x * s + uCD.x * c, y, uSD.y * s + uCD.y * c);
    vec2 ds = vec2(-sin(a), cos(a) * 0.7) * dir;
    fwd = normalize(uSD * ds.x + uCD * ds.y);
    span = 0.72;
    glide = smoothstep(0.2, 0.6, sin(t * 0.21 + aBird.z * 5.0));
    flap = mix(sin(t * 6.5), 0.12, glide);
  }
  vec3 F = normalize(vec3(fwd.x, 0.0, fwd.y));
  vec3 Rt = vec3(-F.z, 0.0, F.x);
  float u = abs(aWing.x);
  // the wing: rises from the body, an elbow, the hand; a gull's crook when it glides
  float lift = flap * 0.55 * u + (kind > 0.5 ? 0.18 * smoothstep(0.0, 0.5, u) - 0.22 * smoothstep(0.5, 1.0, u) * glide : 0.0);
  vec3 p = pos + Rt * aWing.x * span + vec3(0.0, lift * span, 0.0) - F * (aWing.y * mix(0.32, 0.16, u) + u * u * 0.18) * span * 1.6;
  // daylight only: after dusk the birds are gone (collapsed onto one point, nothing drawn)
  p = mix(pos, p, uDay);
  vWorld = p;
  vKind = kind;
  vShade = aWing.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(compressP(p), 1.0);
}`;
  const BIRD_FRAG = FRAG => `
varying vec3 vWorld;
varying float vKind;
varying float vShade;
${FRAG}
void main() {
  // geese: brown-grey with a dark head; gulls: white, a grey back, black wingtips (seen from below, mostly pale)
  vec3 alb = vKind < 0.5 ? vec3(0.09, 0.08, 0.07) : mix(vec3(0.55, 0.56, 0.57), vec3(0.3, 0.31, 0.33), vShade);
  vec3 col = alb * (uSkyCol * 1.1 + uSunCol * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  gl_FragColor.rgb = hazeOf(vWorld, gl_FragColor.rgb);
}`;
  const BIRDS = { mesh: null, n: 0 };
  function buildBirds(ctx) {
    const { mat, GEO, cCliff, VERT, FRAG, SD, CD } = ctx;
    const yW = GEO.yW;
    // one bird: a wing of three spans each side, leading and trailing edges
    const xs = [-1, -0.5, -0.12, 0.12, 0.5, 1];
    const idx = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.InstancedBufferGeometry();
    const ww = [];
    xs.forEach(x => ww.push(x, 0, x, 1));
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(xs.length * 2 * 3), 3));
    geo.setAttribute('aWing', new THREE.Float32BufferAttribute(ww, 2));
    geo.setIndex(idx);
    const birds = [];
    // geese (October–December, the Hudson is a flyway): two skeins of 11 and 9, high over the river, heading south
    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    if (doy > 275 && doy < 350) {
      [[11, 640, yW + 330, 0.0], [9, 980, yW + 410, 0.47]].forEach(([n, c, y, ph], f) => {
        for (let k = 0; k < n; k++) birds.push([0, k, ph + k * 0.013, f, c, y, -8000, 16 + f * 2]);
      });
    }
    // gulls: over the water below us, along the far shore, and riding the cliff's updraft
    const gull = (s, c, y, r, dir, ph) => birds.push([1, dir, ph, 0, s, c, y, r]);
    gull(320, 420, yW + 45, 70, 1, 0.1);
    gull(380, 470, yW + 70, 55, 0, 0.6);
    gull(150, 560, yW + 30, 90, 1, 0.33);
    gull(820, 520, yW + 55, 60, 0, 0.8);
    gull(-260, cCliff(-260) + 60, yW + 110, 45, 1, 0.2);
    gull(-180, cCliff(-180) + 80, yW + 128, 38, 0, 0.71);
    gull(240, cCliff(240) + 70, yW + 96, 52, 0, 0.45);
    gull(980, 1160, yW + 40, 80, 1, 0.9);
    gull(1300, 1240, yW + 30, 65, 0, 0.15);
    gull(-700, 700, yW + 60, 90, 0, 0.55);
    gull(-500, 820, yW + 35, 60, 1, 0.05);
    gull(560, 300, yW + 22, 40, 1, 0.38);
    const n = birds.length;
    const aBird = new Float32Array(n * 4), aPath = new Float32Array(n * 4);
    birds.forEach((b, i) => { aBird.set(b.slice(0, 4), i * 4); aPath.set(b.slice(4, 8), i * 4); });
    geo.setAttribute('aBird', new THREE.InstancedBufferAttribute(aBird, 4));
    geo.setAttribute('aPath', new THREE.InstancedBufferAttribute(aPath, 4));
    geo.instanceCount = n;
    const m = new THREE.Mesh(geo, mat(BIRD_VERT(VERT), BIRD_FRAG(FRAG), { uDay: { value: 1 }, uSD: { value: new THREE.Vector2(...SD) }, uCD: { value: new THREE.Vector2(...CD) } }, { side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.name = 'birds';
    BIRDS.mesh = m;
    BIRDS.n = n;
    return m;
  }

  /* ---------- Fort Lee's through streets: traffic as moving points ---------- */
  function genStreetTraffic(ctx) {
    const { LAMPS, toSC, landY, landAttrs, cCliff, rnd } = ctx;
    // the town's grid (as the ground shader draws it): streets every 112 m one way, 226 m the other
    const E1 = [0.866, 0.5], E2 = [-0.5, 0.866];
    const lines = [[1, -3], [1, -7], [1, -12], [1, -18], [2, -2], [2, 3], [2, -6]]; // (axis, index)
    let added = 0;
    for (const [axis, k] of lines) {
      const off = axis === 1 ? k * 112 : k * 226;
      const N = axis === 1 ? E1 : E2, T = axis === 1 ? E2 : E1;
      const pt = v => [N[0] * off + T[0] * v, N[1] * off + T[1] * v];
      // walk the line and keep the runs that are in town (not woods, not the parkway, not the cliff, not our forecourt)
      let run = null;
      const runs = [];
      for (let v = -3200; v <= 3200; v += 12) {
        const [x, z] = pt(v);
        const [s, c] = toSC(x, z);
        const A = landAttrs(s, c);
        const ok = c < cCliff(s) - 40 && c > -8600 && A[2] > 0.5 && A[7] < 0.5 && Math.hypot(s, c) > 90;
        if (ok) { if (!run) run = [v, v]; else run[1] = v; }
        else if (run) { if (run[1] - run[0] > 260) runs.push(run); run = null; }
      }
      if (run && run[1] - run[0] > 260) runs.push(run);
      for (const [v0, v1] of runs) {
        const L = v1 - v0;
        for (const [lane, dir] of [[-2.2, 1], [2.2, -1]]) {
          const n = Math.max(1, Math.round(L / 160));
          const p0 = pt(dir > 0 ? v0 : v1), p1 = pt(dir > 0 ? v1 : v0);
          const lx = N[0] * lane, lz = N[1] * lane;
          const from = new THREE.Vector3(p0[0] + lx, 0, p0[1] + lz), to = new THREE.Vector3(p1[0] + lx, 0, p1[1] + lz);
          const sa = toSC(from.x, from.z), sb = toSC(to.x, to.z);
          from.y = landY(sa[0], sa[1]) + 1.1;
          to.y = landY(sb[0], sb[1]) + 1.1;
          for (let i = 0; i < n; i++) {
            LAMPS.push([from.clone(), dir > 0 ? [1.0, 0.94, 0.82] : [1.0, 0.16, 0.08], 1.3, 2, rnd(), (10 + rnd() * 4) / L, to.clone().sub(from)]);
            added++;
          }
        }
      }
    }
    return added;
  }

  /* ---------- the moon (after SunCalc's low-precision ephemeris; good to a fraction of a degree) ---------- */
  function moonPosition(date, lat, lon) {
    const rad = DEG, e = rad * 23.4397;
    const d = date / 86400000 - 0.5 + 2440588 - 2451545;
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    const lw = rad * -lon, phi = rad * lat;
    const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
    const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
    return { el, az };
  }

  /** Before the city's light points are built: more of them. */
  function gen(ctx) {
    return { traffic: genStreetTraffic(ctx) };
  }
  /** After: the meshes. */
  function build(g, ctx) {
    const ring = buildRing(ctx);
    g.add(ring);
    g.add(buildBirds(ctx));
    LANDSCAPE.ring = ring;
    return { ringTris: ring.geometry.index.count / 3, birds: BIRDS.n };
  }
  /** Every frame: the ring follows the camera like the sky; birds only by day. */
  function update(U) {
    if (LANDSCAPE.ring) LANDSCAPE.ring.position.copy(camera.position);
    if (BIRDS.mesh) BIRDS.mesh.material.uniforms.uDay.value = clamp(1 - U.uNight.value * 1.6, 0, 1);
  }
  return { gen, build, update, moonPosition, ring: null, BIRDS, RIDGES };
})();
