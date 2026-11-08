/* =============================================================================
   99 · BOOT & LOOP
   ============================================================================= */

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const faces = [`400 32px ${BRAND.ui}`, `500 32px ${BRAND.ui}`, `600 32px ${BRAND.ui}`, `700 32px ${BRAND.ui}`, `italic 500 32px ${BRAND.ui}`];
  await Promise.race([Promise.all(faces.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 2500))]);
}

const loadImage = src => new Promise(res => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = src;
});

async function boot() {
  await loadFonts();
  const bootHash = location.hash; // read before the boot views rewrite the address bar
  // the client's own mark: the pin on every chest, the logo wall (the rugs are plain white wool)
  const [letters, amp, tile] = await Promise.all([loadImage(ASSETS.logoLetters), loadImage(ASSETS.logoAmp), loadImage(ASSETS.logoTile)]);
  LOGO.letters = letters;
  LOGO.amp = amp;
  if (tile) makePinTexture(tile);
  AMP_IMG = amp;
  buildRoom({ logoLetters: letters, logoAmp: amp });
  scene.add(buildTerrace());
  buildNav();
  seedOffice();
  VIEW.init();
  UI.init();
  UI.updateInsets();
  controls.set(viewOf('desks')); // the crew, large enough to read; Overview is one click away
  UI.markView('desks');
  UI._booted = true;
  OfficeExperience.init();
  XRAY.patchTree(scene.getObjectByName('room'));
  if (TERRACE.group) XRAY.patchTree(TERRACE.group);
  for (const s of WORLD.stations) XRAY.patchTree(s.group);
  const preferred=OfficeExperience.preferences.homeView;
  if(VIEWS[preferred]) { controls.set(viewOf(preferred)); UI.markView(preferred); }
  refreshFreshness();

  // optional URL hooks (handy on the Studio): ?view=desks  ?board=1  ?sim=0
  // served by the Studio bridge itself, the page connects on its own
  const params = new URLSearchParams(location.search);
  const bridgeUrl = resolveBridgeUrl(params);
  if (bridgeUrl) connectBridge(bridgeUrl);
  else seedDemoScreens(); // away from the Studio: the new screens with TEST data
  if (params.get('view') && VIEWS[params.get('view')]) controls.set(viewOf(params.get('view'))), UI.markView(params.get('view'));
  if (params.get('board') === '1') UI.toggleBoard(true);
  // bookmarkable views by hash (the only part of a link an artifact carries): #desks #boardroom #door #board
  const fromHash = initial => {
    const h = (initial ? bootHash : location.hash).slice(1);
    if (['overview', 'hudson', 'desks', 'boardroom', 'door', 'datawall', 'hotsheet', 'hotlist', 'server', 'sculpture', 'lounge', 'study', 'saved'].includes(h) && VIEWS[h]) {
      if (initial) controls.set(viewOf(h)), UI.markView(h);
      else UI.view(h);
    } else if (h === 'board') UI.toggleBoard(true);
    else if (h.startsWith('agent/') && OFFICE_STATE.agents[h.slice(6)]) { if (UI.selected !== h.slice(6)) UI.select(h.slice(6)); }
    else if (h.startsWith('screen/')) UI.openScreen(h.slice(7));
  };
  fromHash(true);
  window.addEventListener('hashchange', () => fromHash(false));

  // motion is capped per frame so a sleeping tab never lurches; ?maxdt= lifts it for slow test renders
  const MAX_DT = clamp(Number(params.get('maxdt')) || 0.1, 0.02, 1.5);
  let last = performance.now();
  let frames = 0;
  // adaptive resolution: hold ~30+ fps on any machine and climb back when there is headroom — but never below 1.5 on
  // a Retina screen (Igor, Nov 2: at 1× the city across the river went soft and pixelated; an ambient wall display
  // is better sharp at 30 fps than smooth and blurred)
  const DPR_MAX = Math.min(window.devicePixelRatio || 1, 2);
  const DPR_MIN = Math.min(DPR_MAX, 1.5);
  let dpr = DPR_MAX, acc = 0, n = 0, motionTime = 0;
  function frame(now) {
    const budget=1000/OfficeExperience.fps();
    if (document.hidden || now - (window.__lastOfficeFrame || 0) < budget) { requestAnimationFrame(frame); return; }
    window.__lastOfficeFrame = now - ((now-(window.__lastOfficeFrame || now)) % budget);
    const costStart=performance.now();
    const raw = (now - last) / 1000;
    const dt = Math.min(MAX_DT, raw);
    last = now;
    const profile=OfficeExperience.preferences.performance;
    const ceiling=profile==='quiet' ? DPR_MIN : DPR_MAX;
    if(dpr>ceiling || profile==='sharp' && dpr!==DPR_MAX) { dpr=ceiling; renderer.setPixelRatio(dpr); resize(); }
    const motionDt=REDUCED_MOTION ? 0 : dt * OfficeExperience.motionScale();
    motionTime += motionDt;
    const t = REDUCED_MOTION ? 0 : motionTime;
    if(!REDUCED_MOTION) { simTick(); ambTick(); }
    MOVE.update(motionDt);
    updateIncidents(motionDt);
    heldEarly(motionDt); // carried things: the hands' targets from where the bodies are now
    controls.update(dt);
    for (const f of WORLD.figures) f.update(motionDt, t);
    for (const s of WORLD.stations) s.update(motionDt, t);
    updateRoom(motionDt, t);
    updateSky(motionDt);
    updateTerrace();
    VIEW.update(dt, t);
    XRAY.update(dt);
    heldLate(motionDt); // anything a robot holds goes where its palms are now (after the IK and the tweens)
    renderer.render(scene, camera);
    OFFICE_RUNTIME.frames++;
    if(profile==='balanced') {
      acc+=performance.now()-costStart;
      if(++n===90) { const avg=acc/n; const next=avg>budget*.7?Math.max(DPR_MIN,dpr-.25):avg<budget*.35?Math.min(DPR_MAX,dpr+.25):dpr;
        if(next!==dpr){dpr=next;renderer.setPixelRatio(dpr);resize();} acc=0;n=0; }
    } else { acc=0;n=0; }
    UI.updateBubbles();
    if (++frames === 6) window.__ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__office = { WORLD, controls, camera, THREE, ROOM, ROOM_OBJ, UI, VIEW, SIM, MOVE, AMB, OFFICE_STATE, SKY, NAV, DESTINATIONS, COLLIDERS, scene, renderer, Figure, figureSpec, DESK, HIGH5, blockedAt, INCIDENT, SEATED_MODES, FIELD: typeof FIELD !== "undefined" ? FIELD : null };
}
boot().catch(err => {
  OFFICE_RUNTIME.errors++;
  const failedBridge=resolveBridgeUrl();
  if(failedBridge) connectBridge(failedBridge);
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;left:16px;bottom:16px;font:500 13px var(--ui);color:#0a0a0a">The office could not start: ${String(err && err.message ? err.message : err).replace(/</g, '&lt;')}</p>`);
});
