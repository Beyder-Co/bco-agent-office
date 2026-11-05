/* Local presentation preferences and source inspector. No business data is stored. */
window.OfficeExperience = (() => {
  const KEY='bco.office.preferences.v1', defaults={performance:'balanced',motion:'system',density:'comfortable',homeView:'desks',rememberView:true};
  const views=['overview','hudson','desks','boardroom','datawall','door','hotlist','screen','server','lounge','reading'];
  let saved={}, durable=true, dialog, trigger, returnFocus, timer=null, loading=false;
  try { saved=JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(_){durable=false;}
  const preferences={...defaults};
  function validate(v){
    for(const [k,values] of Object.entries({performance:['balanced','quiet','sharp'],motion:['system','reduce','full'],density:['comfortable','compact'],homeView:views})) if(values.includes(v?.[k]))preferences[k]=v[k];
    if(typeof v?.rememberView==='boolean')preferences.rememberView=v.rememberView;
  }
  validate(saved);
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  function apply(){REDUCED_MOTION=preferences.motion==='reduce'||preferences.motion==='system'&&media.matches;document.body.classList.toggle('office-compact',preferences.density==='compact');document.body.classList.toggle('office-reduced',REDUCED_MOTION);document.body.classList.toggle('office-full-motion',preferences.motion==='full');}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(preferences));durable=true;}catch(_){durable=false;}apply();}
  media.addEventListener?.('change',apply);
  const time=v=>v?new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true})+' ET':'Awaiting data';
  function options(values,current){return values.map(([v,t])=>`<option value="${v}" ${v===current?'selected':''}>${t}</option>`).join('');}
  function renderSettings(){
    dialog.querySelector('#experience-settings').innerHTML=`<h3>Make the office yours</h3><div class="experience-grid">
    <label>Rendering<select data-pref="performance">${options([['balanced','Balanced · adaptive, 30 fps'],['quiet','Quiet · sharp, 15 fps'],['sharp','Sharp · full resolution, 30 fps']],preferences.performance)}</select></label>
    <label>Motion<select data-pref="motion">${options([['system','Follow system setting'],['reduce','Reduce motion'],['full','Full motion']],preferences.motion)}</select></label>
    <label>Reading density<select data-pref="density">${options([['comfortable','Comfortable'],['compact','Compact']],preferences.density)}</select></label>
    <label>Opening view<select data-pref="homeView">${options(views.map(v=>[v,v==='hudson'?'The Hudson':v==='boardroom'?'Market Room':v]),preferences.homeView)}</select></label></div>
    <label class="experience-check"><input type="checkbox" data-pref="rememberView" ${preferences.rememberView?'checked':''}> Remember the last camera view</label>
    <p class="experience-muted" id="preferences-state">${durable?'Saved on this browser. Only display choices are stored.':'Browser storage is unavailable. Choices last for this session.'}</p><button type="button" id="experience-reset" class="btn">Reset display choices</button>`;
    dialog.querySelectorAll('[data-pref]').forEach(el=>el.onchange=()=>{preferences[el.dataset.pref]=el.type==='checkbox'?el.checked:el.value;save();dialog.querySelector('#preferences-state').textContent=durable?'Saved on this browser. Only display choices are stored.':'Browser storage is unavailable. Choices last for this session.';UI.updateInsets();});
    dialog.querySelector('#experience-reset').onclick=()=>{Object.assign(preferences,defaults);save();renderSettings();UI.updateInsets();dialog.querySelector('#experience-reset').focus();};
  }
  function healthHTML(d){
    const feeds=Object.entries(d.feeds||{}),ready=d.readiness||{};
    const usage=d.fubUsage||{},endpoint=usage.endpoints||{};
    const readiness=ready.ready?'Sources current':ready.dataAvailable?'Sources available · attention needed':'Some sources are unavailable or stale';
    return `<p><strong>${esc(readiness)}</strong> · checked ${esc(time(d.serverTime))}</p>
    <p class="experience-muted">${esc((d.testData||OFFICE_STATE.meta.bridge?.testData||window.BCO_ARTIFACT)?'TEST sources. ':'')}Source checks establish availability, not delivery to a client. FUB excludes some synced calendars, texts and events.</p>
    <div class="experience-grid">${feeds.map(([name,f])=>`<article class="experience-source"><h3>${esc(name==='hotsheet'?'NJMLS':name==='fub'?'Follow Up Boss':name==='realscout'?'RealScout via FUB':name)}</h3><b>${esc(f.state||'unknown')}</b><p>${esc(f.reason||'')}</p><small>${esc(time(f.asOf))}</small>${Number.isFinite(f.ageSeconds)?`<p>Source age ${Math.round(f.ageSeconds)} seconds</p>`:''}</article>`).join('')}</div>
    <h3>Recent source transitions</h3><ol class="experience-history">${(d.transitions||[]).slice(-20).reverse().map(t=>`<li><time>${esc(time(t.at))}</time> · ${esc(t.feed)}: ${esc(t.from||'starting')} → <b>${esc(t.to)}</b>${t.reason?' · '+esc(t.reason):''}</li>`).join('')||'<li>No source state changes recorded since this bridge started.</li>'}</ol>
    <h3>API usage since bridge start</h3><p class="experience-muted">${Number(usage.callsLastHour)||0} requests in the last hour · ${Number(usage.callsTotal)||0} since start · ${Number(usage.reservePauses)||0} shared-quota holds · ${Number(usage.rateLimitedResponses)||0} HTTP 429 responses${usage.cooldown?.remainingSeconds>0?' · Cooling down for '+Math.ceil(usage.cooldown.remainingSeconds)+' seconds ('+esc(usage.cooldown.reason)+')':''}</p><div class="experience-table"><table><thead><tr><th>Resource</th><th>Requests</th><th>Mean latency</th><th>Quota holds</th><th>HTTP 429</th></tr></thead><tbody>${Object.entries(endpoint).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${Number(v.requests)||0}</td><td>${Math.round(Number(v.meanLatencyMs)||0)} ms</td><td>${Number(v.reservePauses)||0}</td><td>${Number(v.http429)||0}</td></tr>`).join('')||'<tr><td colspan="5">Awaiting request observations</td></tr>'}</tbody></table></div>
    <p class="experience-muted">Bridge ${esc(d.version)} · page ${esc(d.pageVersion)} · ${esc(d.buildId)} · read only</p>`;
  }
  async function refresh(){
    if(!dialog?.open||loading)return;
    const target=dialog.querySelector('#experience-health');
    if(window.BCO_ARTIFACT||!resolveBridgeUrl()){target.innerHTML='<p>TEST · source diagnostics are available in the Studio office.</p>';return;}
    loading=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
    try{const u=new URL(resolveBridgeUrl());u.protocol='http:';u.pathname='/diagnostics';u.search='';const response=await fetch(u.href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const d=await response.json();target.innerHTML=healthHTML(d);}
    catch(_){target.innerHTML='<p role="status">Source diagnostics are unavailable. Existing screen data keeps its own stale label. Retrying while this panel is open.</p>';}
    finally{clearTimeout(timeout);loading=false;}
  }
  function close(){if(dialog?.open)dialog.close();clearInterval(timer);timer=null;}
  function open(){returnFocus=document.activeElement;document.getElementById('officeMore').open=false;window.OfficeWorkspace?.close();UI.closeMirror();UI.toggleBoard(false);renderSettings();dialog.showModal();refresh();clearInterval(timer);timer=setInterval(refresh,15000);}
  function init(){
    if(dialog)return;apply();
    const style=document.createElement('style');style.textContent=`
    #experience-dialog{box-sizing:border-box;width:min(850px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:0;border:1px solid #d8d6d3;border-radius:18px;background:#fff;color:#171717;box-shadow:0 24px 90px #0003;font:14px var(--ui);overflow:auto}
    #experience-dialog::backdrop{background:#17202b80;backdrop-filter:blur(8px)}
    .experience-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:18px 24px;background:#fff;border-bottom:1px solid #ddd}.experience-head h2{margin:0;font:500 27px var(--serif)}
    .experience-body{padding:0 24px 24px}.experience-body h3{font-size:16px;margin:24px 0 12px}.experience-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.experience-grid label{display:grid;gap:7px}.experience-grid select{width:100%;min-width:0;padding:10px;font:inherit;background:#fff;border:1px solid #bbb;border-radius:8px}.experience-check{display:flex;gap:8px;margin-top:16px;align-items:center}.experience-muted{color:#555;font-size:12px;line-height:1.6}.experience-source{border:1px solid #ddd;border-radius:12px;padding:14px;overflow-wrap:anywhere}.experience-source h3{margin:0 0 10px}.experience-source b{color:#a70008}.experience-history{padding-left:20px;line-height:1.8}.experience-table{overflow:auto}.experience-table table{border-collapse:collapse;width:100%}.experience-table th,.experience-table td{text-align:left;padding:10px;border-bottom:1px solid #ddd;white-space:nowrap}
    .office-compact #rosterList .row{padding-top:5px;padding-bottom:5px}.office-compact .cards{gap:7px}.office-compact .cards .card{padding:10px}.office-reduced *{scroll-behavior:auto!important}.office-reduced *,.office-reduced *::before,.office-reduced *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
    #experience-dialog :focus-visible{outline:2px solid #a70008;outline-offset:3px}@media(max-width:600px){.experience-grid{grid-template-columns:1fr}.experience-head,.experience-body{padding:16px}.experience-head h2{font-size:22px}}`;
    document.head.append(style);dialog=document.createElement('dialog');dialog.id='experience-dialog';dialog.dataset.officeDialog='experience';dialog.setAttribute('aria-labelledby','experience-title');dialog.innerHTML='<header class="experience-head"><h2 id="experience-title">Office controls & sources</h2><button type="button" id="experience-close" class="btn" aria-label="Close office controls">Close</button></header><div class="experience-body"><section id="experience-settings"></section><hr><h3>Source health</h3><section id="experience-health" aria-live="polite">Checking the Studio…</section></div>';document.body.append(dialog);
    trigger=document.createElement('button');trigger.id='btnExperience';trigger.type='button';trigger.className='btn';trigger.textContent='Controls';trigger.setAttribute('aria-label','Office controls and sources');trigger.onclick=open;document.querySelector('#topbar .actions').insertBefore(trigger,document.querySelector('#officeMore'));
    dialog.querySelector('#experience-close').onclick=close;dialog.addEventListener('close',()=>{clearInterval(timer);timer=null;(returnFocus?.isConnected?returnFocus:trigger).focus();});
    document.addEventListener('keydown',e=>{if(!dialog.open)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}},true);
    UI.updateInsets();
  }
  return {preferences,init,open,close,refresh,healthHTML, fps:()=>preferences.performance==='quiet'?15:30,rememberView:name=>{if(preferences.rememberView&&views.includes(name)){preferences.homeView=name;save();}}};
})();
