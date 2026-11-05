/* =============================================================================
   88 · STUDIO BRIDGE — live screens from the Mac Studio
   -----------------------------------------------------------------------------
   On the Studio the bridge serves this page at http://127.0.0.1:4317/ and the
   page connects to ws://127.0.0.1:4317/ws by itself. Every other origin is TEST-only. Each message is one JSON event (or an array
   of them); the page answers gates back over the same socket.

     → { type: 'bridge', version, readOnly, drivesAgents, feeds: { fub, hotsheet, realscout, rates } }
           drivesAgents false → the screens are live and the crew stays simulated

     → { type: 'status',   id, status, activity?, detail?, stuck? }
     → { type: 'log',      id, text, kind? }
     → { type: 'approval', id, need, detail?, gateId? }
     → { type: 'task',     task: { id?, title, agentId } | taskId, column }
     → { type: 'agent',    agent: { name, specialty, systems?, engine?, color?, style?, instruction? } }
     → { type: 'hotsheet', rows: [{ kind, address, town, price, was?, beds?, baths?, dom?, matches?, views?, ours?, openAt?, mls?, at? }],
           asOf?, source?, replace?, status?, note? }
           kind ∈ new | price | bom | uc | sold | coming | open
     → { type: 'panel',    key: 'today' | 'pipeline' | 'buyers', data: { status?, note?, asOf?, … } }
           today:    { events: [{ time, title, where?, kind? }], followups: { due, overdue, items: [{ who, what, when }] } }
           pipeline: { stages: { listings, underContract, closing30, closedYTD, offers, offMarket, buyerContracts }, dates: [{ date, label, deal }] }
           buyers:   { newLeads: [{ name, source, at }], hot: [{ name, signal, score? }], overdue }
           status ∈ live | stale (last good data, see note) | error (see note)
     → { type: 'ticker',   items: [{ kind: 'rate', id, group, label, value, move, dir, asOf, source, text, at }], status?, note?, asOf? }
           the bond market and mortgage rates (v8: client activity has its own screen, the live feed)
     → { type: 'panel',    key: 'feed' | 'highlights' | 'needs', data }
           feed:       { items: [{ kind, who, verb, what, text, n, at, link }], day }
           highlights: { engaged | reengaged | slipping: [{ who, reason, last, scoutScore?, link }], counts }
           needs:      { items: [{ group, kind, title, who?, when, link?, draft?, agent? }], counts, total }
     → { type: 'fleet',    jobs: [{ label, name, agent, running, since, ok, summary, lastAt, schedule, next, runsToday }], doneToday }
     → { type: 'approvals', items: [{ gateId, agentId, need, title, link, draft, brief }], source: 'fub' }
           the approvals that live in Follow Up Boss, as one set: done there → gone here
     ← { type: 'hello',    office, version, agents }
     ← { type: 'decision', gateId, agentId, decision: 'approve' | 'decline' | 'changes', message?, need, at }
     ← { type: 'assign',   agentId, title, repeat: 'once' | 'daily' | 'weekdays' | 'weekly', at }
     → { type: 'ack', of, gateId?, recorded }   decisions on real gates land in the Studio's private ledger
     → { type: 'decided', gates: [{ gateId, decision }] }   the ledger's answers, replayed on connect

   Business sources stay read-only. Explicit instructions queue to Crimson,
   and bounded repair requests follow the standing repair policy. If the socket drops, the office keeps the last known state and
   retries with backoff. ?sim=0 turns the crew's simulation off.
   ============================================================================= */

const OFFICE_RUNTIME = { started: performance.now(), opens: 0, errors: 0, frames: 0 };
window.addEventListener('error',()=>OFFICE_RUNTIME.errors++);
window.addEventListener('unhandledrejection',()=>OFFICE_RUNTIME.errors++);
const FEED_NOTES = {
  simulated: "<b>TEST sample.</b> Simulated activity; no business actions execute here.",
  live: "<b>Live screens.</b> Follow Up Boss (with RealScout's client activity), the NJMLS hot sheet and market rates come from the Studio, read-only. The crew awaits a current job receipt.",
  fleet: "<b>Live.</b> The crew mirrors the Studio's jobs as they run; every screen reads Follow Up Boss, RealScout, the NJMLS hot sheet and the markets, read-only. Instructions and reviewed decisions go through Crimson; source results remain authoritative.",
  offline: '<b>Studio bridge offline.</b> Showing the last known state; reconnecting.',
  standby: '<b>Simulation off.</b> Waiting for live events from the Studio.',
};

/** Only the exact installed origin may connect. Query strings never grant access. */
function resolveBridgeUrl() {
  if (window.BCO_ARTIFACT || window.BCO_PUBLIC_DEMO || location.origin !== 'http://127.0.0.1:4317') return null;
  return 'ws://127.0.0.1:4317/ws';
}

/** The bridge's own report: which feeds are healthy, and whether it drives the crew. */
function applyBridgeMeta(m) {
  if ((m.buildId && window.BCO_BUILD && m.buildId !== window.BCO_BUILD) || (m.pageVersion && m.pageVersion !== '8.8.1')) { location.reload(); return; }
  const was = OFFICE_STATE.meta.bridge && OFFICE_STATE.meta.bridge.drivesAgents;
  OFFICE_STATE.meta.bridge = { version: m.version, readOnly: m.readOnly !== false, drivesAgents: !!m.drivesAgents, feeds: m.feeds || {}, testData: !!m.testData, commands: m.commands || null };
  for (const [id,role] of Object.entries(m.commands?.roles || {})) if (OFFICE_STATE.agents[id]) Object.assign(OFFICE_STATE.agents[id],role);
  if (m.drivesAgents && !was && typeof goLive === 'function') goLive(); // the Studio's jobs drive the crew from now on
  if (m.drivesAgents && typeof SIM !== 'undefined') SIM.enabled = false;
  BUS.emit('meta', OFFICE_STATE.meta);
}

function setFeed(mode) {
  OFFICE_STATE.meta.feed = mode;
  BUS.emit('meta', OFFICE_STATE.meta);
}

/** Applies one bridge event through the public API. */
function applyBridgeEvent(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.type) {
    case 'heartbeat':
      if ((m.buildId && window.BCO_BUILD && m.buildId !== window.BCO_BUILD) || (m.pageVersion && m.pageVersion !== '8.8.1')) location.reload();
      return;
    case 'status': {
      const ag = OFFICE_STATE.agents[m.id];
      if (!ag) return null;
      ag.bridgeStatus = { status: m.status, activity: m.activity, detail: m.detail, stuck: !!m.stuck };
      // an agent with approvals open in Follow Up Boss keeps waiting on Igor unless a job of theirs is running
      const open = OFFICE_STATE.approvals.filter(g => g.agentId === m.id).length;
      if (open && m.status === 'IDLE') return setAgentStatus(m.id, 'WAITING', { detail: `${open} waiting for you · ${m.detail || ''}`.replace(/ · $/, '') });
      return setAgentStatus(m.id, m.status, { activity: m.activity, detail: m.detail, stuck: m.stuck });
    }
    case 'log':
      return pushLog(m.id, String(m.text || ''), m.kind || 'step');
    case 'approval':
      return requestApproval(m.id, String(m.need || ''), { detail: m.detail, simulated: false, id: m.gateId, brief: m.brief || (m.action || m.facts ? { action: m.action, facts: m.facts, why: m.why, ifDecline: m.ifDecline, source: m.source } : null) });
    case 'task':
      return moveTask(m.task || m.taskId, m.column);
    case 'agent':
      return addAgent(m.agent || {});
    case 'hotsheet':
      return setHotSheet({ rows: Array.isArray(m.rows) ? m.rows : [], asOf: m.asOf, source: m.source, replace: m.replace !== false, status: m.status, note: m.note, staleAfter: m.staleAfter, fileAgeSeconds: m.fileAgeSeconds, fileAsOf: m.fileAsOf, nextRun:m.nextRun });
    case 'panel':
      return setPanel(m.key, m.data || {});
    case 'ticker':
      return setTicker({ items: m.items, status: m.status, note: m.note, asOf: m.asOf });
    case 'bridge':
      return applyBridgeMeta(m);
    case 'fleet':
      return setFleet({ jobs: m.jobs, doneToday: m.doneToday, asOf: m.asOf });
    case 'approvals':
      OFFICE_STATE.meta.approvalsAsOf = m.asOf;
      return syncApprovals(m.items, m.source || 'fub');
    case 'assignments':
      for (const r of m.items || []) {
        if (!OFFICE_STATE.agents[r.agentId] || OFFICE_STATE.tasks.some(t=>t.id===r.assignmentId)) continue;
        const task=moveTask({id:r.assignmentId,title:String(r.title || ''),agentId:r.agentId,note:'Local reminder · saved on the Studio'},'queued');
        task.assigned=true;task.repeat=r.repeat;task.at=new Date(r.received_at || r.at).getTime();
      }
      BUS.emit('task',null);
      return;
    case 'decided':
      return typeof applyDecided === 'function' ? applyDecided(m.gates) : null;
    case 'commands':
    case 'command_review':
    case 'command_ack':
    case 'command_error':
      BUS.emit('command-message',m); return;
    case 'ack':
      if (m.of === 'assign' && m.recorded === true && typeof UI !== 'undefined') UI.toast('Reminder saved on the Studio');
      if (m.of === 'assign' && m.recorded === false && typeof UI !== 'undefined') UI.toast('The Studio could not save that reminder');
      if (m.of === 'decision' && m.recorded === false && typeof UI !== 'undefined') UI.toast('The Studio could not record that decision');
      return null;
    default:
      return null;
  }
}

function connectBridge(url) {
  if (!resolveBridgeUrl() || url !== resolveBridgeUrl() || OFFICE_RUNTIME.transportStarted) return;
  OFFICE_RUNTIME.transportStarted=true;
  let ws = null;
  let retry = 1000, retryTimer = null, lastMessage = performance.now();
  const schedule = () => { if (retryTimer !== null) return; retryTimer = setTimeout(() => { retryTimer = null; open(); }, retry); retry = Math.min(retry * 2, 15000); };
  const recover = () => { if (retryTimer !== null) return; if (ws) { const old=ws; ws=null; old.onclose=null; old.close(); } setFeed('offline'); schedule(); };
  const wake = () => { if (ws && ws.readyState === 1 && performance.now()-lastMessage < 45000) return; recover(); };
  setInterval(() => { refreshFreshness(); if (performance.now() - lastMessage > 45000) recover(); }, 5000);
  let sampleAt = performance.now(), sampleFrames = 0;
  setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    const now=Date.now(), mono=performance.now(), r=window.__office?.renderer, info=r?.info.memory;
    ws.send(JSON.stringify({type:'runtime',buildId:window.BCO_BUILD,uptimeSeconds:(mono-OFFICE_RUNTIME.started)/1000,visible:!document.hidden,opens:OFFICE_RUNTIME.opens,errors:OFFICE_RUNTIME.errors,renderFps:(OFFICE_RUNTIME.frames-sampleFrames)/Math.max(1,(mono-sampleAt)/1000),geometries:info?.geometries || 0,textures:info?.textures || 0,heapBytes:performance.memory?.usedJSHeapSize || 0,panels:Object.fromEntries(Object.entries(OFFICE_STATE.panels).map(([k,v])=>[k,{status:v.status,ageSeconds:v.asOf ? Math.max(0,(now-v.asOf)/1000) : 0}]))}));
    sampleAt=mono;sampleFrames=OFFICE_RUNTIME.frames;
  },30000);
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  const open = () => {
    try {
      clearTimeout(retryTimer); retryTimer=null;
      ws = new WebSocket(url);
      lastMessage = performance.now();
    } catch (e) {
      setFeed('offline');
      schedule();
      return;
    }
    const socket = ws;
    ws.onopen = () => {
      if (ws !== socket) return;
      retry = 1000;
      OFFICE_RUNTIME.opens++;
      setFeed('live');
      ws.send(JSON.stringify({ type: 'hello', office: 'bco-agent-office', version: 1, agents: OFFICE_STATE.order }));
      if (typeof UI !== 'undefined') UI.toast('Connected to the Studio bridge');
    };
    ws.onmessage = ev => {
      if (ws !== socket) return;
      lastMessage = performance.now();
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      (Array.isArray(msg) ? msg : [msg]).forEach(applyBridgeEvent);
    };
    ws.onclose = () => {
      if (ws !== socket) return;
      setFeed('offline');
      schedule();
    };
    ws.onerror = () => {};
  };
  BUS.on('command-send', msg => {
    if (!ws || ws.readyState !== 1) return BUS.emit('command-message',{type:'command_error',note:'Reconnect to the Studio before sending. No automatic retry.'});
    ws.send(JSON.stringify(msg));
  });
  BUS.on('approval', ev => {
    // only Igor's answers to real gates go to the ledger; simulated asks and replays stay in the room
    if (ev.type !== 'resolve' || ev.remote || ev.gate.simulated !== false || ['fub','crimson'].includes(ev.gate.source) || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'decision', gateId: ev.gate.id, agentId: ev.gate.agentId, decision: ev.decision, message: ev.message || null, need: ev.gate.need, at: new Date().toISOString() }));
  });
  BUS.on('assign', ev => {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'assign', assignmentId: ev.task.id, agentId: ev.agentId, title: ev.task.title, repeat: ev.repeat, at: new Date().toISOString() }));
  });
  open();
}


/* Away from the Studio (this page as an artifact), the screens that only the Studio can fill show what they will
   look like, with sample data marked TEST throughout: no real client, no real number. */
function seedDemoScreens() {
  const now = Date.now(), iso = m => new Date(now - m * 60000).toISOString();
  const note = 'Sample data (TEST) · live on the Studio';
  const fub = () => null; // TEST clients never link to real contact records
  setPanel('feed', { status: 'stale', note, items: [
    { kind: 'view', who: 'Test Client A.', verb: 'viewed', what: '12 Sample Ln, Alpine · $4.2M', n: 3, at: iso(4), link: fub(1) },
    { kind: 'email', who: 'Test Client B.', verb: 'opened your email', what: '“Fall market (TEST)”', n: 1, at: iso(11), link: fub(2) },
    { kind: 'save', who: 'Test Client C.', verb: 'saved', what: '8 Example Ct, Demarest · $2.85M', n: 1, at: iso(19), link: fub(3) },
    { kind: 'text_in', who: 'Test Client D.', verb: 'texted you', what: '', n: 1, at: iso(26), link: fub(4) },
    { kind: 'inquiry', who: 'Test Client E.', verb: 'asked about', what: '3 Demo Rd, Closter · $3.1M', n: 1, at: iso(41), link: fub(5) },
    { kind: 'page', who: 'Test Client A.', verb: 'browsed', what: 'Homes for sale in Alpine (TEST)', n: 2, at: iso(55), link: fub(1) },
    { kind: 'click', who: 'Test Client F.', verb: 'clicked your email', what: '', n: 1, at: iso(70), link: fub(6) },
    { kind: 'text_out', who: 'Test Client G.', verb: 'was sent a text', what: '', n: 1, at: iso(96), link: fub(7) },
    { kind: 'lead', who: 'Test Client H.', verb: 'is a new lead', what: 'from beyderco.com', n: 1, at: iso(130), link: fub(8) },
    { kind: 'view', who: 'Test Client C.', verb: 'viewed', what: '40 Sample Ave, Haworth · $1.9M', n: 1, at: iso(170), link: fub(3) },
    { kind: 'email', who: 'Test Client I.', verb: 'opened your email', what: '', n: 2, at: iso(210), link: fub(9) },
  ].map(i => Object.assign(i, { text: `${i.who} ${i.verb}${i.what ? ' ' + i.what : ''}` })) });
  setPanel('highlights', { status: 'stale', note, engaged: [
    { who: 'Test Client A.', reason: '1 inquiry · 2 saves · 9 views', last: iso(4), scoutScore: 91, link: fub(1) },
    { who: 'Test Client C.', reason: '3 saves · 6 views', last: iso(19), scoutScore: 84, link: fub(3) },
    { who: 'Test Client E.', reason: '1 inquiry · 4 views · 2 email opens', last: iso(41), scoutScore: 77, link: fub(5) },
    { who: 'Test Client B.', reason: '5 email opens · 3 views', last: iso(11), link: fub(2) },
    { who: 'Test Client F.', reason: '2 email clicks · 2 views', last: iso(70), link: fub(6) },
  ], reengaged: [
    { who: 'Test Client J.', reason: 'back after 64 days · 4 views', last: iso(300), scoutScore: 62, link: fub(10) },
    { who: 'Test Client K.', reason: 'back after 38 days · 1 save · 2 email opens', last: iso(1500), link: fub(11) },
  ], slipping: [
    { who: 'Test Client L.', reason: 'quiet 19 days · was 1 save · 11 views', last: iso(19 * 1440), scoutScore: 58, link: fub(12) },
    { who: 'Test Client M.', reason: 'quiet 23 days · was 6 email opens · 4 views', last: iso(23 * 1440), link: fub(13) },
    { who: 'Test Client N.', reason: 'quiet 16 days · was 2 saves · 3 views', last: iso(16 * 1440), link: fub(14) },
  ], counts: { engaged: 5, reengaged: 2, slipping: 3 } });
  setPanel('needs', { status: 'stale', note, total: 7, items: [
    { group: 'system', id: 't1', title: 'Sign in to NJMLS · double-click “NJMLS LOGIN” on the Studio desktop (TEST)', when: 'Hot sheet paused', detail: 'Sample: shown when the NJMLS session needs a sign-in' },
    { group: 'overdue', id: 't2', title: 'Call Test Client P.', when: 'Overdue · 1d', who: 'Test Client P.', link: fub(15) },
    { group: 'approval', id: 't3', title: 'Send a text to Test Client D. · Message Prep', when: 'Today', draft: 'Hi (TEST) — thanks for your note. Happy to walk you through 12 Sample Ln this week. Does Thursday at 4 work?', link: fub(4) },
    { group: 'approval', id: 't4', title: 'Reply to Test Client E. · drafted by the reply concierge', when: 'Today', draft: 'Thanks for asking about 3 Demo Rd (TEST). I can share the disclosures and set a private showing.', link: fub(5) },
    { group: 'today', id: 't5', title: 'Call Test Client A. about Alpine', when: '2:30 PM', link: fub(1) },
    { group: 'appointment', id: 't6', title: 'Showing · 8 Example Ct (TEST)', when: '4:00 PM', where: 'Demarest', link: fub(3) },
    { group: 'lead', id: 't7', title: 'New lead · Test Client H. · beyderco.com', when: '9:12 AM', link: fub(8) },
  ] });
  // no invented numbers: the labels and the layout, the values left blank until the Studio fills them
  const rate = (id, group, label) => ({ kind: 'rate', id, group, label, value: '—', move: '', dir: 0, asOf: 'TEST', text: `${label} —` });
  setTicker({ status: 'stale', note: 'Bond market and mortgage rates (TEST layout) · live on the Studio', items: [
    rate('DGS10', 'Bonds', '10-yr Treasury'), rate('DGS2', 'Bonds', '2-yr Treasury'), rate('DGS5', 'Bonds', '5-yr Treasury'),
    rate('DGS30', 'Bonds', '30-yr Treasury'), rate('T10Y2Y', 'Bonds', '2s10s curve'), rate('DFF', 'Bonds', 'Fed funds'),
    rate('SOFR', 'Bonds', 'SOFR'), rate('MORTGAGE30US', 'Mortgage', '30-yr fixed'), rate('MORTGAGE15US', 'Mortgage', '15-yr fixed'),
    rate('T10YIE', 'Bonds', '10-yr breakeven'), rate('SPREAD', 'Mortgage', 'Mortgage spread'), rate('DPRIME', 'Mortgage', 'Prime rate'),
  ] });
}
