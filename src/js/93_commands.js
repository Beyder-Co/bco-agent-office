/* Crimson is the existing coordinator chat. These controls never execute business jobs. */
const OFFICE_COMMAND_UI = {
  rows: [], token: null, request: null, dialog: null, previous: new Map(),
  setup() {
    if (this.dialog) return;
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'crimsonDialog';
    this.dialog.setAttribute('aria-labelledby','crimsonTitle');
    this.dialog.innerHTML = '<form method="dialog" class="cc-close"><button aria-label="Close Crimson">×</button></form><div id="crimsonContent"></div>';
    document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{this.token=null;this.request=null;});
    document.addEventListener('click', e => {
      const button=e.target.closest('[data-office-command]'); if(!button)return;
      e.preventDefault();
      this.open({mode:button.dataset.officeCommand,agentId:button.dataset.agent || 'crimson',sourceId:button.dataset.source});
    });
  },
  history() {
    const states={submitting:'Confirming handoff',queued:'Queued for Crimson',received:'Received by Crimson',working:'Crimson is following up',blocked:'Crimson is investigating',waiting_source:'Waiting for an ordinary result',attempt_failed:'Crimson is trying another approach',needs_igor:'Needs Igor’s decision',uncertain:'Handoff unconfirmed',answered:'Crimson answered',assigned:'Assigned to its owner',reported_complete:'Completion reported',resolved_by_source:'Source now reports success'};
    const ordered=this.rows.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const history=ordered.filter(r=>r.state==='needs_igor').concat(ordered.filter(r=>r.state!=='needs_igor').slice(0,12));
    return `      <details class="cc-history" ${history.length ? 'open' : ''}><summary>Requests & responses · ${history.length}</summary>
        ${history.length ? history.map(r=>`<article><b>${esc(states[r.state] || r.state)}${r.automatic ? ' · automatic repair' : ''}</b><p>${esc(r.title)}</p><p>${esc(r.note || '')}</p>${r.routing ? `<p>Model selected: ${esc(r.routing.selected)} · ${esc(r.routing.reason)}. ${r.routing.observed ? 'Observed: '+esc(r.routing.observed) : 'Execution model not yet verified.'}</p>` : ''}${r.attemptCount ? `<p>${esc(String(r.attemptCount))} repair attempts recorded${r.recheckedAt ? ' · checked again ' + esc(whenShort(r.recheckedAt)) : ''}</p>` : ''}${r.state==='needs_igor' ? `<p><b>${esc(r.dependency)}</b></p><button class="btn" data-office-command="respond" data-agent="${esc(r.agentId)}" data-source="${esc(r.id)}">Answer Crimson</button>` : ''}${r.evidence?.length ? `<p class="g-meta">Evidence recorded · ${r.evidence.length} source${r.evidence.length===1 ? '' : 's'}</p>` : ''}<small>${esc(whenShort(r.updatedAt || r.at))}</small></article>`).join('') : '<p>No command receipts yet.</p>'}
      </details>`;
  },
  open(request={mode:'instruction',agentId:'crimson'}) {
    this.setup(); this.token=null; this.request=request;
    const gate=OFFICE_STATE.approvals.find(g=>g.id===request.sourceId);
    const job=OFFICE_STATE.fleet?.jobs.find(j=>j.label===request.sourceId);
    const name=OFFICE_STATE.agents[request.agentId]?.name || 'CRIMSON';
    const available=OFFICE_STATE.meta.feed==='live' && OFFICE_STATE.meta.bridge?.commands?.available;
    const prior=this.rows.find(r=>r.id===request.sourceId);
    const sourceTitle=prior?.dependency || gate?.need || job?.name || (request.agentId==='crimson' ? 'Give Crimson an instruction' : 'Ask Crimson about '+name);
    $('#crimsonContent').innerHTML=`<h2 id="crimsonTitle">Crimson</h2><p>${esc(sourceTitle)}</p>
      ${gate?.draft ? `<div class="cc-source">${esc(gate.draft)}</div>` : ''}
      ${job?.summary ? `<div class="cc-source">${esc(job.summary)}</div>` : ''}
      <p class="g-meta">Crimson coordinates with the existing owner. Schedules continue. A queued instruction is not a completed job.</p>
      ${request.mode==='gate' ? `<label for="ccDecision">Your decision</label><select id="ccDecision"><option value="request">Give instructions</option>${gate?.draft ? '<option value="approve">Approve this exact draft</option>' : ''}<option value="changes">Request changes</option><option value="hold">Keep on hold</option></select>` : ''}
      ${request.mode==='instruction' && OFFICE_STATE.meta.bridge?.commands?.owners?.length ? `<label for="ccOwner">Workflow</label><select id="ccOwner"><option value="">Let Crimson identify the owner</option>${OFFICE_STATE.meta.bridge.commands.owners.filter(r=>r.verified).map(r=>`<option value="${esc(r.workflow)}" ${r.workflow===request.ownerWorkflow?'selected':''}>${esc(r.name)} · ${esc(r.status.toLowerCase())}</option>`).join('')}</select>` : ''}
      <label for="ccMessage">${request.mode==='repair' ? 'Repair instructions (optional)' : 'What should Crimson do?'}</label>
      <textarea id="ccMessage" rows="3" maxlength="4000" placeholder="Describe the outcome you want. Crimson will coordinate the next step.">${esc(request.message || '')}</textarea>
      <div id="ccNotice" role="status">${available ? '' : 'Commands are available when connected to the installed Studio Office.'}</div>
      <button class="btn ink" id="ccReview" ${available ? '' : 'disabled'}>Review instruction</button>
      <div id="ccHistory">${this.history()}</div>`;
    $('#ccReview').onclick=()=>{
      this.request={...request,ownerWorkflow:$('#ccOwner')?.value || '',message:$('#ccMessage').value.trim(),decision:$('#ccDecision')?.value || (request.mode==='repair' ? 'repair' : 'request')};
      if(request.mode==='instruction' && !this.request.message) {$('#ccNotice').textContent='Enter the instruction first.';return;}
      $('#ccReview').disabled=true; $('#ccNotice').textContent='Checking the current source and owner…';
      BUS.emit('command-send',{type:'command_prepare',...this.request});
    };
    if(!this.dialog.open)this.dialog.showModal();
    $('#ccMessage').focus();
  },
  message(m) {
    if(m.type==='commands') {
      const next=new Map((m.items || []).map(r=>[r.id,r]));
      for(const r of next.values()) {
        const before=this.previous.get(r.id);
        if(before && before.state!==r.state && ['answered','assigned','reported_complete'].includes(r.state)) COORDINATION_GESTURES.ack(r.agentId);
      }
      this.previous=next; this.rows=m.items || []; COORDINATION_GESTURES.sync();
      INCIDENT.escalations=this.rows.filter(r=>r.state==='needs_igor' && r.attemptCount>=2 && r.recheckedAt && r.dependency);
      const sig=INCIDENT.escalations.map(r=>r.id+':'+r.updatedAt).join('|');
      if(this.escalationSig!==sig){
        this.escalationSig=sig;
        syncApprovals(INCIDENT.escalations.map(r=>({gateId:'office-escalation-'+r.id,agentId:'crimson',requestedBy:r.agentId,commandId:r.id,need:r.dependency,title:r.title,brief:{action:'Give Crimson the specific decision he needs to continue.',facts:[['Attempts',String(r.attemptCount)],['Checked again',whenShort(r.recheckedAt)]],why:r.note,source:'Crimson repair receipt'}})),'crimson');
        if(typeof UI!=='undefined' && UI.selected==='crimson')UI.renderPanel();
      }
      const historySig=this.rows.map(r=>r.id+':'+r.updatedAt+':'+r.state).join('|');
      if(this.historySig!==historySig && $('#ccHistory')) $('#ccHistory').innerHTML=this.history(); this.historySig=historySig;
      return;
    }
    if(m.type==='command_review') {
      if(!this.dialog?.open || !this.request) return;
      this.token=m.token;
      const c=m.context, owner=c.owner;
      $('#crimsonContent').innerHTML=`<h2 id="crimsonTitle">Review with Crimson</h2>
        <p><b>${esc(c.source?.need || c.source?.name || 'Your instruction')}</b></p>
        <p>Decision: ${esc({approve:'Approve the exact draft',changes:'Request changes',hold:'Keep on hold',repair:'Request repair',request:'Send instructions'}[c.decision])}</p>
        ${c.source?.draft ? `<div class="cc-source">${esc(c.source.draft)}</div>` : ''}
        ${c.message ? `<div class="cc-source">${esc(c.message)}</div>` : ''}
        <p>Destination: <b>Crimson</b>${owner ? ` → ${esc(owner.name)} owner (${esc(owner.status.toLowerCase())})` : ' → appropriate existing owner'}.</p>
        <p>You authorize Crimson to relay this specific instruction to that owner and follow the result. Source holds and current operating rules still apply.</p>
        <p class="g-meta">${esc(m.scope)}</p><div id="ccNotice" role="status"></div>
        <div class="btns"><button class="btn" id="ccBack">Edit</button><button class="btn ink" id="ccConfirm">Send to Crimson</button></div>`;
      $('#ccBack').onclick=()=>this.open(this.request);
      $('#ccConfirm').onclick=()=>{if(!this.token)return;$('#ccConfirm').disabled=true;$('#ccBack').disabled=true;$('#ccNotice').textContent='Confirming handoff…';BUS.emit('command-send',{type:'command_confirm',token:this.token});this.token=null;};
    } else if(m.type==='command_ack') {
      if(!this.dialog?.open)return;
      $('#crimsonContent').innerHTML=`<h2 id="crimsonTitle">${m.state==='queued' ? 'Queued for Crimson' : 'Request recorded'}</h2><p role="status">${esc(m.note)}</p><p>The source task stays open until its owner reports a result. View responses from any robot’s Ask Crimson button.</p><button class="btn" id="ccDone">Done</button>`;
      $('#ccDone').onclick=()=>this.dialog.close();
    } else if(m.type==='command_error') {
      const el=$('#ccNotice');if(el)el.textContent=m.note;
      if($('#ccReview'))$('#ccReview').disabled=false;
      if($('#ccBack'))$('#ccBack').disabled=false;
      // An uncertain confirmation is never retried by a timer or a double click.
    }
  }
};
BUS.on('command-message',m=>OFFICE_COMMAND_UI.message(m));

// Install one delegated listener before any robot card is opened.
OFFICE_COMMAND_UI.setup();

// Persistent question pose: eight existing rigs, no particles, new geometry or timers.
const COORDINATION_GESTURES = {
  waiting:new Set(), acknowledgments:new Map(), target:new THREE.Vector3(), local:new THREE.Vector3(),
  sync() {
    const old=this.waiting;
    const rows=OFFICE_COMMAND_UI.rows;
    const answered=new Set(rows.filter(r=>['answered','assigned','reported_complete','resolved_by_source'].includes(r.state)).filter(r=>r.sourceId).map(r=>r.sourceId+':'+(r.sourceVersion || '')));
    this.waiting=new Set(rows.filter(r=>(r.needsAnswer || r.state==='blocked') && !['answered','assigned','reported_complete','resolved_by_source'].includes(r.state)).map(r=>r.agentId).filter(id=>id!=='crimson'));
    for(const g of OFFICE_STATE.approvals) if(g.source==='fub' && !answered.has(g.id+':'+(g.sourceVersion || ''))) this.waiting.add(g.requestedBy || 'automations');
    if(typeof UI!=='undefined' && UI.selected && old.has(UI.selected)!==this.waiting.has(UI.selected))UI.renderPanel();
  },
  ack(id) { if(id && id!=='crimson')this.acknowledgments.set(id,performance.now()+1800); },
  pose(fig,g) {
    const id=fig.id || fig.spec?.id;
    const crimson=WORLD.byId.crimson?.fig;
    if(!crimson || !id || INCIDENT.owns(id) || fig.grabS)return;
    const raised=this.waiting.has(id);
    let target=raised ? crimson : null, nod=0;
    if(id==='crimson') {
      for(const [other,until] of this.acknowledgments) {
        if(until<performance.now()){this.acknowledgments.delete(other);continue;}
        target=WORLD.byId[other]?.fig;
        if(!REDUCED_MOTION)nod=0.14*Math.sin((until-performance.now())/1800*Math.PI*2);
        break;
      }
    }
    if(target) {
      target.root.getWorldPosition(this.target);fig.root.worldToLocal(this.local.copy(this.target));
      g.headYaw=clamp(Math.atan2(this.local.x,this.local.z),-1.1,1.1);g.headPitch=nod;
    }
    fig._officeStaticPose=!!(target || fig._officeWasRaised);fig._officeWasRaised=raised;
    if(raised){g.shLx=-0.15;g.shLy=0;g.shLz=2.5;g.elLx=-0.65;g.wrLx=0.12;g.prL=-0.8;g.fingL=0.08;}
  }
};
BUS.on('approval',()=>COORDINATION_GESTURES.sync());
