/* Workspace: source-backed brief, review queues, discovery and aggregate export. */
(() => {
  'use strict';
  const ET = 'America/New_York';
  const GROUPS = {system:'System attention',overdue:'Overdue follow-up',approval:'Prepared for review',today:'Due today',appointment:'Appointments',lead:'New leads'};
  const KIND = {view:'Property views',save:'Saved properties',inquiry:'Inquiries',page:'Website visits',email:'Email opens',click:'Email clicks',text_in:'Inbound texts',text_out:'Outbound texts',lead:'New leads'};
  const SCREEN = {main:'Activity and highlights',today:'Follow-ups and leads',pipeline:'Pipeline and dates',hotnew:'NJMLS new and open',hotdone:'NJMLS price and sold',ticker:'Market rates',manual:'Operating manual'};
  const CAMERAS = {overview:'Office overview',hudson:'Hudson view',desks:'Agent desks',boardroom:'Market room',datawall:'Data wall',hotlist:'Hot list',screen:'Forum screen',server:'Server cabinet',door:'Office entrance',lounge:'Left lounge',reading:'Right lounge'};
  const W = {tab:'brief',query:'',group:'all',kind:'all',hours:'all',commandIndex:0,returnFocus:null};
  const html = value => String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const numeric = v => finite(v) && v >= 0 ? v : null;
  const stamp = value => {
    if (value == null || value === '') return null;
    const n = new Date(value).getTime(); return Number.isFinite(n) && n > 0 ? n : null;
  };
  const iso = value => { const n=stamp(value); return n ? new Date(n).toISOString() : null; };
  const time = value => {const n=stamp(value);return n ? new Date(n).toLocaleString('en-US',{timeZone:ET,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true})+' ET' : 'Awaiting source time';};
  const test = () => !!window.BCO_ARTIFACT || OFFICE_STATE.meta.feed==='simulated' || !!OFFICE_STATE.meta.bridge?.testData;
  const badge = () => test() ? 'TEST · sample workspace' : 'Beyder&Co. Realty · read-only workspace';
  const state = p => {
    if (!p || !stamp(p.asOf) || p.status==='awaiting') return 'AWAITING';
    if (test()) return 'TEST';
    const hour=Number(new Date().toLocaleTimeString('en-US',{timeZone:ET,hour:'2-digit',hour12:false}));
    const limit=(hour>=6&&hour<23?120:600)*1000;
    return OFFICE_STATE.meta.feed!=='live'||p.status!=='live'||stamp(p.asOf)>Date.now()+60000||Date.now()-stamp(p.asOf)>limit ? 'STALE' : 'LIVE';
  };
  const ready = p => !!p && p.status !== 'awaiting' && !!stamp(p.asOf);
  const sourceLine = p => `<p class="ws-source"><b class="${state(p)==='STALE'?'ws-attention':''}">${state(p)}</b> · ${html(time(p?.asOf))}${p?.note ? ' · '+html(p.note) : ''}</p>`;
  const sourceLink = value => {
    try {const u=new URL(value);return u.protocol==='https:' && /(^|\.)followupboss\.com$/i.test(u.hostname) && !u.username && !u.password ? u.href : null;} catch (_) {return null;}
  };
  const folded = value => String(value||'').normalize('NFKD').toLowerCase();
  const includes = (parts,q) => !q || folded(parts.join(' ')).includes(folded(q));
  const setHTML = (el,value) => {if(el.innerHTML!==value)el.innerHTML=value;};
  let dialog, body, controls, content, timer, dirty=true;

  function commands() {
    const entries=[['brief','Daily brief','Workspace'],['needs','Review needs','Workspace'],['activity','Explore activity','Workspace']].map(([id,label,group])=>({id:'tab:'+id,label,group,run:()=>open(id)}));
    Object.entries(SCREEN).forEach(([key,label])=>{if(typeof VIEW!=='undefined'&&VIEW.screens[key])entries.push({id:'screen:'+key,label,group:'Screens',run:()=>{close();UI.openScreen(key);}});});
    Object.entries(CAMERAS).forEach(([key,label])=>entries.push({id:'camera:'+key,label,group:'Room views',run:()=>{close();UI.view(key);}}));
    OFFICE_STATE.order.forEach(id=>{const a=OFFICE_STATE.agents[id];if(a)entries.push({id:'agent:'+id,label:a.name,detail:a.specialty,group:'Agents',run:()=>{close();UI.select(id);}});});
    if(window.OfficeExperience)entries.push({id:'experience',label:'Controls and source health',group:'Office',run:()=>{close();window.OfficeExperience.open();}});
    entries.push({id:'board',label:'Task board',group:'Office',run:()=>{close();UI.toggleBoard(true);}});
    return entries.filter(c=>includes([c.label,c.detail,c.group],W.query));
  }

  function exportSnapshot() {
    // Explicit allowlist: no source text, names, draft bodies, contact IDs or links.
    const s=OFFICE_STATE, br=s.meta.bridge||{}, f=s.fleet, p=s.panels;
    const feedNames=['fub','realscout','hotsheet','rates','fleet'];
    const statusValue=v=>['ok','quiet','starting','missing','stale','error','auth','rate','attention','live','awaiting','partial'].includes(v)?v:'unknown';
    const counts = obj => Object.fromEntries(Object.entries(obj||{}).filter(([k,v])=>['listings','underContract','closing30','closedYTD','offers','offMarket','buyerContracts','system','overdue','approval','today','appointment','lead','engaged','reengaged','slipping'].includes(k)&&numeric(v)!==null));
    return {schema:'bco.agent-office.operational-snapshot/v1',generatedAt:new Date().toISOString(),timeZone:ET,testData:test(),
      version:{page:'8.8.0',bridge:/^\d+\.\d+\.\d+$/.test(br.version||'')?br.version:null,build:/^[a-f0-9]{20}$/.test(window.BCO_BUILD||'')?window.BCO_BUILD:null},
      connection:['live','offline','simulated','standby'].includes(s.meta.feed)?s.meta.feed:'unknown',
      sources:Object.fromEntries(feedNames.map(k=>[k,{state:statusValue(br.feeds?.[k]?.state),asOf:iso(br.feeds?.[k]?.asOf)}])),
      panels:Object.fromEntries(Object.entries(p).filter(([k])=>['today','pipeline','buyers','feed','highlights','needs'].includes(k)).map(([k,v])=>[k,{state:state(v),asOf:iso(v.asOf)}])),
      counts:{followupsDue:ready(p.today)?numeric(p.today.followups?.due):null,followupsOverdue:ready(p.today)?numeric(p.today.followups?.overdue):null,nativeAppointmentsToday:Array.isArray(p.today.events)&&ready(p.today)?p.today.events.length:null,
        pipeline:ready(p.pipeline)?counts(p.pipeline.stages):{},needs:ready(p.needs)?counts(p.needs.counts):{},needsTotal:ready(p.needs)?numeric(p.needs.total):null,
        sourceActivityDay:ready(p.feed)?numeric(p.feed.day):null,loadedActivityRows:ready(p.feed)?(p.feed.items||[]).length:null,
        successfulJobRunsToday:f?numeric(f.doneToday):null,loadedJobs:f?(f.jobs||[]).filter(j=>j.loaded!==false).length:null,
        runningJobs:f?(f.jobs||[]).filter(j=>j.running&&j.loaded!==false).length:null,attentionJobs:f?(f.jobs||[]).filter(j=>j.ok===false).length:null},
      schedule:{asOf:iso(f?.asOf),upcoming:(f?.jobs||[]).filter(j=>stamp(j.next)&&stamp(j.next)>=Date.now()).sort((a,b)=>stamp(a.next)-stamp(b.next)).map(j=>({next:iso(j.next),running:!!j.running}))},
      marketObservations:(s.ticker.items||[]).filter(i=>/^(DGS10|DGS2|DGS5|DGS30|T10Y2Y|DFF|SOFR|T10YIE|MORTGAGE30US|MORTGAGE15US|SPREAD|DPRIME)$/.test(i.id||'')).map(i=>({series:i.id,observationDate:iso(i.at),stale:!!i.stale,deadline:iso(i.staleAfter)})),
      hotSheet:{asOf:iso(s.hotsheet.asOf),fileAsOf:iso(s.hotsheet.fileAsOf),state:statusValue(s.hotsheet.status),rows:stamp(s.hotsheet.asOf)?(s.hotsheet.rows||[]).length:null},
      coverage:['FUB API-visible records only; calendar-synced appointments and some text/event records are unavailable.','RealScout activity is visible after it reaches FUB.','Successful job runs are not proof of client delivery.','Snapshot contains aggregate counts and schedule times only; client details are excluded.']};
  }

  function brief() {
    const s=OFFICE_STATE,p=s.panels,f=s.fleet;
    const known=(panel,v)=>ready(panel)&&numeric(v)!==null?String(v):'—';
    const tiles=[['Due today',known(p.today,p.today.followups?.due)],['Overdue',known(p.today,p.today.followups?.overdue)],['Needs review',known(p.needs,p.needs.total)],['Under contract',known(p.pipeline,p.pipeline.stages?.underContract)],['Jobs running',f?String((f.jobs||[]).filter(j=>j.running&&j.loaded!==false).length):'—'],['Successful job runs',f&&numeric(f.doneToday)!==null?String(f.doneToday):'—']];
    const next=(f?.jobs||[]).filter(j=>stamp(j.next)&&stamp(j.next)>=Date.now()).sort((a,b)=>stamp(a.next)-stamp(b.next)).slice(0,5);
    const issues=(f?.jobs||[]).filter(j=>j.ok===false);
    const fleetTime=stamp(f?.asOf),fleetState=!f||!fleetTime?'AWAITING':test()?'TEST':s.meta.feed!=='live'||fleetTime>Date.now()+60000||Date.now()-fleetTime>45000?'STALE':issues.length?'ATTENTION':'CURRENT';
    return `${sourceLine(p.today)}<div class="ws-metrics">${tiles.map(([label,value])=>`<div><strong>${html(value)}</strong><span>${html(label)}</span></div>`).join('')}</div>
      <p class="ws-note">Needs ${state(p.needs)} · ${html(time(p.needs.asOf))} · Pipeline ${state(p.pipeline)} · ${html(time(p.pipeline.asOf))}</p>
      <div class="ws-columns"><section><h3>Next scheduled jobs</h3><p class="ws-source">${fleetState} · ${html(time(f?.asOf))}</p><ol class="ws-list">${next.map(j=>`<li><strong>${html(j.name)}</strong><span>${html(time(j.next))}</span></li>`).join('')||'<li>No future scheduled job is available in this snapshot.</li>'}</ol></section>
      <section><h3>Job attention</h3><ol class="ws-list">${issues.map(j=>`<li><strong>${html(j.name)}</strong><p>${html(j.summary||'The latest source receipt needs review.')}</p><span>${html(time(j.lastAt))}</span> <button class="btn" data-office-command="repair" data-source="${html(j.label)}" data-agent="${html(j.agent)}">Ask Crimson to repair</button></li>`).join('')||`<li>${f?'No job failure is reported in this snapshot.':'Awaiting fleet evidence.'}</li>`}</ol></section></div>
      <p class="ws-note">Appointments cover FUB-native records only. Job success is not client delivery. Source times above apply to their respective counts.</p>
      <button type="button" class="ws-button" data-ws-action="export">Export operational snapshot</button><p class="ws-note">Downloads an aggregate JSON report with source states, counts and schedule times. Client names, messages and drafts are excluded.</p>`;
  }

  function needs() {
    const p=OFFICE_STATE.panels.needs,items=Array.isArray(p.items)?p.items:[];
    const order=Object.keys(GROUPS),rank=g=>{const i=order.indexOf(g);return i<0?99:i;};
    const filtered=items.filter(i=>(W.group==='all'||i.group===W.group)&&includes([i.title,i.who,i.when,i.draft,i.detail],W.query)).map((i,n)=>({i,n})).sort((a,b)=>rank(a.i.group)-rank(b.i.group)||a.n-b.n);
    return `${sourceLine(p)}<p class="ws-summary" role="status">${filtered.length} of ${items.length} loaded needs · source total ${ready(p)&&numeric(p.total)!==null?p.total:'unavailable'}</p>
      <ol class="ws-list ws-needs">${filtered.map(({i,n})=>{const link=sourceLink(i.link);return `<li><span class="ws-pill">${html(GROUPS[i.group]||'Review')}</span><h3>${html(i.title||'Source item')}</h3>${i.who?`<p>${html(i.who)}</p>`:''}<p class="ws-note">${html(i.when||'No due label supplied')}</p>${i.detail?`<p>${html(i.detail)}</p>`:''}${i.draft?`<details data-detail="${html(i.id||i.taskId||n)}"><summary>Read complete prepared draft</summary><pre>${html(i.draft)}</pre></details>`:''}${i.kind==='approval' && i.id ? `<button class="btn" data-office-command="gate" data-source="${html(i.id)}">Review with Crimson</button>` : ''}${link?`<a href="${html(link)}" target="_blank" rel="noopener noreferrer">Review in Follow Up Boss ↗</a>`:''}</li>`;}).join('')||'<li>No loaded needs match these filters.</li>'}</ol>
      <p class="ws-note">Ordered by system attention, overdue follow-up, prepared review, due today, appointments and leads. Review takes place in the source; this workspace does not send or complete CRM tasks.</p>`;
  }

  function activity() {
    const p=OFFICE_STATE.panels.feed,items=Array.isArray(p.items)?p.items:[],cutoff=W.hours==='all'?null:Date.now()-Number(W.hours)*3600000;
    const filtered=items.filter(i=>(W.kind==='all'||i.kind===W.kind)&&(!cutoff||(stamp(i.at)&&stamp(i.at)>=cutoff&&stamp(i.at)<=Date.now()+60000))&&includes([i.who,i.what,i.verb,i.text],W.query)).sort((a,b)=>(stamp(b.at)||0)-(stamp(a.at)||0));
    return `${sourceLine(p)}<p class="ws-summary" role="status">${filtered.length} of ${items.length} loaded grouped rows · source day count ${ready(p)&&numeric(p.day)!==null?p.day:'unavailable'}</p><p class="ws-note">${html(p.windowLabel||'Recent grouped activity supplied by the bridge')} · Filters apply to loaded rows; they do not search the full CRM.</p>
      <ol class="ws-list ws-activity">${filtered.map(i=>{const link=sourceLink(i.link);return `<li><span class="ws-pill">${html(KIND[i.kind]||i.kind||'Activity')}</span><h3>${html(i.text||[i.who,i.verb,i.what].filter(Boolean).join(' '))}</h3><p class="ws-note">${html(time(i.at))}${numeric(i.n)!==null?' · '+i.n+' grouped events':''}</p>${link?`<a href="${html(link)}" target="_blank" rel="noopener noreferrer">Open source contact ↗</a>`:''}</li>`;}).join('')||'<li>No loaded activity matches these filters.</li>'}</ol>`;
  }

  function render() {
    if (!dialog?.open) return;
    document.getElementById('wsBadge').textContent=badge();
    if (W.tab==='go') {
      const list=commands();W.commandIndex=Math.max(0,Math.min(W.commandIndex,list.length-1));
      setHTML(content,`<p class="ws-summary" role="status">${list.length} available destinations</p><div class="ws-command-list" id="wsDestinations" role="listbox" aria-label="Destinations">${list.map((c,i)=>`<button type="button" role="option" id="ws-cmd-${i}" aria-selected="${i===W.commandIndex}" data-command="${html(c.id)}"><span>${html(c.label)}</span><small>${html(c.group)}${c.detail?' · '+html(c.detail):''}</small></button>`).join('')||'<p>No destination matches your search.</p>'}</div><p class="ws-note">↑ ↓ to choose · Enter to open · Escape to close</p>`);
    } else {
      const openDetails=new Set([...content.querySelectorAll('details[open]')].map(d=>d.dataset.detail));
      setHTML(content,W.tab==='brief'?brief():W.tab==='needs'?needs():activity());
      content.querySelectorAll('details').forEach(d=>{if(openDetails.has(d.dataset.detail))d.open=true;});
    }
    const search=document.getElementById('wsSearch');if(search&&W.tab==='go'){search.setAttribute('role','combobox');search.setAttribute('aria-controls','wsDestinations');search.setAttribute('aria-expanded','true');if(commands().length)search.setAttribute('aria-activedescendant','ws-cmd-'+W.commandIndex);else search.removeAttribute('aria-activedescendant');}
    dirty=false;
  }

  function filters() {
    controls.innerHTML=W.tab==='brief'?'':`<label class="ws-search-label"><span>${W.tab==='go'?'Find a screen, view or agent':'Search loaded '+(W.tab==='needs'?'needs':'activity')}</span><input id="wsSearch" type="search" autocomplete="off" placeholder="${W.tab==='go'?'Search destinations…':'Type to filter…'}" value="${html(W.query)}"></label>`+
      (W.tab==='needs'?`<label>Category<select id="wsGroup"><option value="all">All categories</option>${Object.entries(GROUPS).map(([k,v])=>`<option value="${k}" ${W.group===k?'selected':''}>${v}</option>`).join('')}</select></label>`:'')+
      (W.tab==='activity'?`<label>Activity type<select id="wsKind"><option value="all">All types</option>${Object.entries(KIND).map(([k,v])=>`<option value="${k}" ${W.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Window<select id="wsHours">${[['all','All loaded'],['1','Last hour'],['24','Last 24 hours'],['168','Last 7 days']].map(([k,v])=>`<option value="${k}" ${W.hours===k?'selected':''}>${v}</option>`).join('')}</select></label>`:'');
    controls.hidden=W.tab==='brief';
  }

  function open(tab='brief') {
    if(!dialog)init();
    if(!dialog.open){window.OfficeExperience?.close();W.returnFocus=document.activeElement;UI.closeMirror();UI.unfocusScreen(false);UI.deselect();UI.toggleBoard(false);dialog.showModal();}
    const previous=W.tab;W.tab=['brief','needs','activity','go'].includes(tab)?tab:'brief';if(previous!==W.tab)W.query='';
    dialog.querySelectorAll('[data-ws-tab]').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.wsTab===W.tab));});
    filters();render();body.scrollTop=0;(document.getElementById('wsSearch')||dialog.querySelector('[data-ws-tab="'+W.tab+'"]')).focus();
  }
  function close() {if(!dialog?.open)return;dialog.close();if(W.returnFocus?.isConnected)W.returnFocus.focus();}
  function download() {
    const data=JSON.stringify(exportSnapshot(),null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='bco-office-operations-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    const status=document.getElementById('wsDownloadStatus');status.textContent='Aggregate snapshot downloaded. Client details excluded.';
  }

  function init() {
    if(dialog)return;
    const css=document.createElement('style');css.textContent=`
      #workspaceDialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(960px,calc(100vw - 28px));max-width:100%;height:min(780px,calc(100dvh - 32px));max-height:calc(100vh - 32px);padding:0;border:1px solid #d8d5d0;border-radius:18px;background:#faf9f6;color:#20201f;font:14px/1.5 var(--ui, sans-serif);box-shadow:0 24px 80px #0005;overflow:hidden}
      #workspaceDialog::backdrop{background:#1119;backdrop-filter:blur(5px)}
      #workspaceDialog[open]{display:flex;flex-direction:column}#workspaceDialog *{box-sizing:border-box}
      #workspaceDialog button,#workspaceDialog input,#workspaceDialog select{font:inherit}#workspaceDialog button{cursor:pointer}
      #workspaceDialog :focus-visible{outline:2px solid #a70008;outline-offset:3px}
      .ws-head{padding:20px 24px 0;background:#fff;flex:none}.ws-head-top{display:flex;align-items:start;justify-content:space-between;gap:16px}
      #wsBadge{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#655f5b}.ws-head h2{font:500 30px/1.2 var(--serif,Georgia,serif);margin:5px 0 16px}
      .ws-close,.ws-button{border:1px solid #d3cfca;border-radius:8px;padding:9px 13px;background:#fff;color:#20201f}.ws-close{min-width:44px;min-height:44px}
      .ws-tabs{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:12px}.ws-tabs button{border:0;background:transparent;color:#655f5b;padding:8px 12px;border-radius:7px;min-height:40px}.ws-tabs button[aria-current=true]{background:#a70008;color:#fff}
      .ws-body{overflow:auto;overscroll-behavior:contain;padding:20px 24px 28px;flex:1;min-height:0}.ws-filters{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px;align-items:end}.ws-filters[hidden]{display:none}
      .ws-filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#655f5b;min-width:0}.ws-search-label{flex:1 1 230px}.ws-filters input,.ws-filters select{border:1px solid #ccc7c0;border-radius:8px;background:#fff;color:#20201f;padding:11px;width:100%;min-height:44px}
      .ws-source,.ws-note{color:#68635e;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.ws-source{margin:0 0 16px}.ws-attention{color:#a70008}.ws-summary{font-size:13px;color:#68635e;margin:0 0 12px}
      .ws-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ws-metrics>div{padding:16px;background:#fff;border:1px solid #e3dfd8;border-radius:10px;display:flex;flex-direction:column;gap:5px}.ws-metrics strong{font-size:30px;line-height:1.1;font-weight:550;font-variant-numeric:tabular-nums}.ws-metrics span{font-size:12px;color:#68635e}
      .ws-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:22px}.ws-columns h3{font-size:15px}.ws-list{list-style:none;margin:0;padding:0}.ws-list>li{border-top:1px solid #ddd8d1;padding:16px 0;overflow-wrap:anywhere}.ws-list>li:first-child{border-top:0}.ws-list h3{font-size:16px;margin:8px 0}.ws-list p{margin:5px 0}.ws-list strong,.ws-list span{display:block}.ws-list span{font-size:12px;color:#68635e}.ws-list .ws-pill{display:inline-block;border-radius:20px;background:#eeeae4;padding:3px 9px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.ws-list a{color:#a70008;display:inline-block;margin-top:8px}.ws-list details{margin:12px 0}.ws-list summary{cursor:pointer;font-weight:550;min-height:36px}.ws-list pre{font:inherit;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0;background:#fff;border:1px solid #e3dfd8;border-left:3px solid #a70008;border-radius:8px;padding:14px}
      .ws-command-list{display:grid;gap:6px}.ws-command-list button{display:flex;flex-direction:column;text-align:left;border:1px solid transparent;background:#fff;border-radius:9px;padding:12px 14px;color:#20201f}.ws-command-list button[aria-selected=true]{border-color:#a70008;background:#f5f0ec}.ws-command-list small{color:#68635e;font-size:11px;margin-top:3px}
      #wsDownloadStatus{font-size:12px;color:#68635e;min-height:1.5em}
      @media(max-width:600px){#workspaceDialog{width:calc(100vw - 16px);height:calc(100dvh - 16px);max-height:calc(100vh - 16px);border-radius:12px}.ws-head{padding:16px 16px 0}.ws-body{padding:16px}.ws-head h2{font-size:26px}.ws-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ws-columns{grid-template-columns:1fr;gap:10px}.ws-tabs{gap:2px}.ws-tabs button{padding:8px 10px}.ws-filters{gap:8px}.ws-filters label{flex:1 1 130px}.ws-search-label{flex-basis:100%!important}}
      @media(prefers-reduced-motion:reduce){#workspaceDialog::backdrop{backdrop-filter:none}}
    `;document.head.appendChild(css);
    dialog=document.createElement('dialog');dialog.id='workspaceDialog';dialog.dataset.officeDialog='workspace';dialog.setAttribute('aria-labelledby','wsTitle');
    dialog.innerHTML=`<header class="ws-head"><div class="ws-head-top"><div><div id="wsBadge"></div><h2 id="wsTitle">Your workspace</h2></div><button type="button" class="ws-close" aria-label="Close workspace">Close</button></div><nav class="ws-tabs" aria-label="Workspace sections">${[['brief','Daily brief'],['needs','Needs'],['activity','Activity'],['go','Go to…']].map(([id,label])=>`<button type="button" data-ws-tab="${id}">${label}</button>`).join('')}</nav></header><div class="ws-body"><div class="ws-filters"></div><div id="wsContent"></div><p id="wsDownloadStatus" role="status" aria-live="polite"></p></div>`;
    document.body.appendChild(dialog);body=dialog.querySelector('.ws-body');controls=dialog.querySelector('.ws-filters');content=dialog.querySelector('#wsContent');
    const button=document.createElement('button');button.id='btnWorkspace';button.type='button';button.className='btn';button.textContent='Workspace';button.title='Daily brief, needs and activity · ⌘K / Ctrl+K';button.setAttribute('aria-haspopup','dialog');
    const more=document.getElementById('officeMore');more.parentNode.insertBefore(button,more);button.onclick=()=>open('brief');
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.querySelector('.ws-close').onclick=close;
    dialog.addEventListener('click',e=>{const tab=e.target.closest('[data-ws-tab]'),cmd=e.target.closest('[data-command]');if(tab)open(tab.dataset.wsTab);else if(cmd)commands().find(c=>c.id===cmd.dataset.command)?.run();else if(e.target.closest('[data-ws-action=export]'))download();});
    dialog.addEventListener('input',e=>{if(e.target.id==='wsSearch'){W.query=e.target.value;W.commandIndex=0;render();}});
    dialog.addEventListener('change',e=>{if(e.target.id==='wsGroup')W.group=e.target.value;if(e.target.id==='wsKind')W.kind=e.target.value;if(e.target.id==='wsHours')W.hours=e.target.value;render();});
    document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();if(dialog.open&&W.tab==='go')close();else open('go');return;}
      if(!dialog.open)return;
      e.stopImmediatePropagation();
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(W.tab==='go'&&['ArrowDown','ArrowUp','Enter'].includes(e.key)&&e.target.id==='wsSearch'){
        const list=commands();e.preventDefault();if(e.key==='Enter'){list[W.commandIndex]?.run();return;}
        W.commandIndex=list.length?(W.commandIndex+(e.key==='ArrowDown'?1:-1)+list.length)%list.length:0;render();content.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});
      }
    },true);
    ['panel','fleet','meta','ticker','hotsheet','add'].forEach(ev=>BUS.on(ev,()=>{dirty=true;}));
    timer=setInterval(()=>{if(dialog.open&&(dirty||W.tab==='brief'||W.tab==='needs'||W.tab==='activity'))render();},1500);
    requestAnimationFrame(()=>UI.updateInsets());
  }
  window.OfficeWorkspace={open,close,exportSnapshot,commands:()=>commands().map(({id,label,group})=>({id,label,group}))};
  window.Workspace=window.OfficeWorkspace;
  init();
})();
