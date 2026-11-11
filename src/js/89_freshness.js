/* Every surface shares the source times and expiry, including a silent bridge. */
function officeSourceTime(value) { if(value==null||value==='')return NaN; const n=new Date(value).getTime();return Number.isFinite(n)&&n>0?n:NaN; }
function sourceAgeText() {
  const s = OFFICE_STATE, feeds = (s.meta.bridge || {}).feeds || {};
  const time = v => Number.isFinite(officeSourceTime(v)) ? fmtTime(new Date(officeSourceTime(v))) + ' ET' : 'awaiting data';
  if (!s.meta.bridge) return resolveBridgeUrl() ? 'Awaiting the Studio · no current data' : 'TEST · sample data';
  return `${s.meta.bridge.testData ? 'TEST · ' : ''}FUB checked ${time((feeds.fub || {}).asOf)} · Jobs checked ${time(s.fleet && s.fleet.asOf)}`;
}
function sourceAgeSummary() { return sourceAgeText().replace(/ checked /g, ' '); }
function refreshFreshness(now = Date.now()) {
  const time=v=>Number.isFinite(officeSourceTime(v))?new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'2-digit',hour12:true})+' ET':'unavailable';
  const s = OFFICE_STATE, connected = s.meta.feed === 'live';
  let el = document.getElementById('freshness');
  if (!el) { el = document.createElement('div'); el.id = 'freshness'; el.setAttribute('role','button'); el.tabIndex=0; el.setAttribute('aria-haspopup','dialog'); el.onclick=()=>window.OfficeExperience?.open(); el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.OfficeExperience?.open();}}; document.body.appendChild(el); }
  if (!s.meta.bridge) { el.textContent = sourceAgeText(); return; }
  const hour = Number(new Date(now).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}));
  const limit = (hour >= 6 && hour < 23 ? 120 : 600) * 1000;
  let stale = !connected;
  if (!connected) {
    for (const [kind,data] of [['hotsheet',s.hotsheet],['ticker',s.ticker]]) if (data.status === 'live') {
      data.status='stale'; data.note='Bridge disconnected · last verified source data'; BUS.emit(kind,data);
    }
  }
  for (const [key,p] of Object.entries(s.panels)) {
    const at=officeSourceTime(p.asOf),valid=Number.isFinite(at)&&at<=now+5000;
    const expired = !connected || !valid || now-at>limit;
    if (expired && p.status === 'live') { p.status = 'stale'; p.note = 'Source check overdue · ' + (valid ? fmtTime(new Date(at)) + ' ET' : 'time invalid or unknown'); BUS.emit('panel',key); }
    stale ||= p.status !== 'live';
  }
  if (s.hotsheet.staleAfter && now > s.hotsheet.staleAfter && s.hotsheet.status === 'live') { s.hotsheet.status='stale'; s.hotsheet.note='Hot-sheet producer missed its scheduled pull'; BUS.emit('hotsheet',{}); }
  for (const i of s.ticker.items) if (i.staleAfter && now > i.staleAfter && !i.stale) { i.stale=true; i.text += ' · STALE'; s.ticker.status='stale'; BUS.emit('ticker',s.ticker); }
  const fleetAt=officeSourceTime(s.fleet?.asOf);
  const fleetStale = !connected || !Number.isFinite(fleetAt) || fleetAt>now+5000 || now-fleetAt>45000;
  if (s.fleet && s.fleet.stale !== fleetStale) {
    s.fleet.stale = fleetStale;
    for (const a of Object.values(s.agents)) BUS.emit('agent',a);
    BUS.emit('task',null);
  }
  const counts = document.getElementById('counts');
  if (counts) { counts.classList.toggle('stale-counts',fleetStale); counts.title=sourceAgeText(); }
  stale ||= fleetStale || s.hotsheet.status !== 'live' || s.ticker.status !== 'live';
  const fileAt=officeSourceTime(s.hotsheet.fileAsOf),pullAt=officeSourceTime(s.hotsheet.asOf);
  const fileAge = Number.isFinite(fileAt)&&fileAt<=now+5000 ? Math.max(0,Math.floor((now-fileAt)/60000))+' min' : 'unknown';
  const age = Number.isFinite(pullAt)&&pullAt<=now+5000 ? Math.max(0,Math.floor((now-pullAt)/60000))+' min old' : 'awaiting valid data';
  el.textContent = `${stale ? 'STALE / ATTENTION · ' : ''}${sourceAgeSummary()} · NJMLS ${age} · next ${time(s.hotsheet.nextRun)} · Rates: ${[...new Set(s.ticker.items.filter(i=>i.asOf).map(i=>(i.source||i.label||"Rate")+" "+i.asOf))].join(" / ")}`;
  el.title = `${sourceAgeText()} · NJMLS pull ${age}, file ${fileAge} · Rates individually dated · v9.3.0 · Click for sources`;
  el.className = stale ? 'stale' : '';
  document.documentElement.style.setProperty('--fresh-h', Math.ceil(el.getBoundingClientRect().height) + 'px');
}
