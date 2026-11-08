/* =============================================================================
   70 · OFFICE_STATE — the single source of truth, and the event API
   -----------------------------------------------------------------------------
   Everything you see — figures, rings, head bubbles, roster, top-bar counts,
   the main screen, the task board, the approval card — is drawn from this one
   object. The simulation below drives it ONLY through the five public calls:

     setAgentStatus(id, status, { activity, detail, stuck })
         status ∈ 'WORKING' | 'THINKING' | 'WAITING' | 'IDLE' | 'DONE'
         activity (WORKING only) ∈ 'coding' | 'browsing'
     pushLog(id, text, kind = 'step')          → timestamped line, capped at 200
     requestApproval(id, need, { detail, simulated }) → queues a human gate
     moveTask(taskOrId, column)                → 'queued' | 'progress' | 'done'
     addAgent({ name, specialty, systems, engine, color, style, instruction })

   plus resolveApproval(gateId, 'approve' | 'decline') for the owner's answer.

   Phase 2: replace the simulation with real Claude / Codex session hooks on the
   Studio that call the same functions (window.AgentOffice.*). No visual change.
   ============================================================================= */

const STATUS = ['WORKING', 'THINKING', 'WAITING', 'IDLE', 'DONE'];
const LOG_CAP = 200;
const CAST_CAP = 10;

const OFFICE_STATE = {
  meta: {
    office: 'Beyder&Co. Agent Office',
    timeZone: 'America/New_York',
    feed: 'simulated', // 'simulated' | 'live' (screens fed by the Studio bridge) | 'offline' | 'standby'
    bridge: null, // the bridge's own report: { version, readOnly, drivesAgents, feeds: { fub, hotsheet } }
    loadedAt: Date.now(),
  },
  /** id → agent record. */
  agents: {},
  /** roster order (ids) */
  order: [],
  /** pending human gates; [0] is the card in front */
  approvals: [],
  /** declined items, newest first: { id, agentId, need, at } */
  held: [],
  /** task board: { id, title, agentId, column, at, record } — finished work is pruned to the latest 80 */
  tasks: [],
  /** running totals that survive pruning; finishedByDay is keyed by ET date */
  stats: { finished: 0, finishedByDay: {} },
  /** systems and cadences shown under RUNNING on the main screen */
  running: [],  /** open issues (seeded from the operating record) */
  issues: [],  /** the MLS hot sheet: only ever filled by the live feed (never simulated) */
  hotsheet: {
    status: 'awaiting',
    source: 'NJMLS via RealScout',
    asOf: null,
    rows: [],
    watch: { area: 'Bergen County', floor: 1000000, towns: ['Closter', 'Demarest', 'Haworth', 'Alpine', 'Fort Lee'] },
  },
  /** the ticker: the bond market and mortgage rates — only ever from the Studio bridge */
  ticker: { status: 'awaiting', note: null, asOf: null, items: [] },
  /** the fleet: the Studio's launchd jobs, each owned by an agent (null until the bridge reads them) */
  fleet: null,
  /** the data wall: live business panels (Follow Up Boss, RealScout, Calendar via the Studio bridge) */
  panels: {
    today: { status: 'awaiting', source: 'FUB-native appointments + tasks', asOf: null, events: [], followups: null },
    pipeline: { status: 'awaiting', source: 'Follow Up Boss deals', asOf: null, stages: null, dates: [] },
    buyers: { status: 'awaiting', source: 'Follow Up Boss + RealScout', asOf: null, newLeads: [], hot: [], overdue: null },
    // the main screen: the live feed beside the three contact highlights; the east wall: everything that needs Igor
    feed: { status: 'awaiting', source: 'RealScout + Follow Up Boss', asOf: null, items: [], day: 0 },
    highlights: { status: 'awaiting', source: 'RealScout + Follow Up Boss', asOf: null, engaged: [], reengaged: [], slipping: [], counts: {} },
    needs: { status: 'awaiting', source: 'Follow Up Boss + the Studio', asOf: null, items: [], counts: {}, total: 0 },
  },
  /** dated items for NEXT (ET calendar dates) */
  schedule: [],};

/* ---------- tiny event bus -------------------------------------------------- */
const BUS = (() => {
  const map = {};
  return {
    on(ev, fn) {
      (map[ev] = map[ev] || []).push(fn);
      return () => (map[ev] = map[ev].filter(f => f !== fn));
    },
    emit(ev, payload) {
      (map[ev] || []).forEach(fn => {
        try { fn(payload); } catch (e) { console.error(e); }
      });
      (map['*'] || []).forEach(fn => fn(ev, payload));
    },
  };
})();

/** Today's date in New York as YYYY-MM-DD. */
const etDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);

let _uid = 0;
const uid = p => `${p}-${Date.now().toString(36)}-${(_uid++).toString(36)}`;

/** Creates the state record for an agent (cast member or newcomer). */
function makeAgent(def) {
  return {
    id: def.id,
    name: def.name,
    monogram: def.monogram,
    specialty: def.specialty,
    engine: def.engine,
    role: def.role || '',
    systems: def.systems || [],
    delivered: def.delivered || [],
    look: def.look,
    slot: def.slot,
    zone: def.zone || null, // 'personal': the study's pair, outside the business crew and its coordinator
    paused: !!def.paused,
    status: 'IDLE',
    activity: null,
    detail: def.paused ? 'Paused by design' : 'Settling in',
    stuck: false,
    taskId: null,
    location: 'desk', // desk | walking | server | screen | lounge | board | arriving
    log: [],
    held: [],
  };
}

/* ---------- the public API ------------------------------------------------------ */

function setAgentStatus(id, status, opts = {}) {
  const a = OFFICE_STATE.agents[id];
  if (!a || !STATUS.includes(status)) return false;
  a.status = status;
  a.activity = status === 'WORKING' ? opts.activity || a.activity || 'coding' : null;
  if (opts.detail !== undefined) a.detail = opts.detail;
  a.stuck = !!opts.stuck;
  BUS.emit('agent', a);
  return true;
}

function pushLog(id, text, kind = 'step') {
  const a = OFFICE_STATE.agents[id];
  if (!a) return false;
  const line = { t: Date.now(), text, kind };
  a.log.push(line);
  if (a.log.length > LOG_CAP) a.log.splice(0, a.log.length - LOG_CAP);
  BUS.emit('log', { id, line });
  return line;
}

/** A gate's brief, cleaned: what approving does, the facts behind it, why it needs Igor, and what declining does. */
function normBrief(b) {
  if (!b || typeof b !== 'object') return null;
  const str = v => (v == null ? '' : String(v)).slice(0, 600);
  const facts = Array.isArray(b.facts) ? b.facts.filter(f => Array.isArray(f) && f.length >= 2).slice(0, 8).map(([k, v]) => [str(k).slice(0, 40), str(v).slice(0, 200)]) : [];
  return { action: str(b.action), facts, why: str(b.why), ifDecline: str(b.ifDecline), undo: str(b.undo), source: str(b.source) };
}

function requestApproval(id, need, opts = {}) {
  const a = OFFICE_STATE.agents[id];
  if (!a) return null;
  // what the agent was in the middle of, kept with the gate so the brief stays true after the status changes
  const doing = OFFICE_STATE.tasks.find(t => t.agentId === id && t.column === 'progress');
  const context = { task: doing ? doing.title : '', step: a.status === 'WAITING' ? '' : a.detail || '' };
  const gate = { id: opts.id || uid('gate'), agentId: id, need, detail: opts.detail || '', simulated: opts.simulated !== false, at: Date.now(), brief: normBrief(opts.brief), context };
  OFFICE_STATE.approvals.push(gate);
  pushLog(id, `Needs Igor — ${need}`, 'gate');
  setAgentStatus(id, 'WAITING', { detail: 'Needs you' });
  BUS.emit('approval', { type: 'request', gate });
  return gate;
}

/** Everything a person needs to decide: the action, the facts, the why, and what a decline does. Never invents facts —
 *  a gate without a brief shows who asked, what they were doing and the request itself. */
function gateBrief(g) {
  const a = OFFICE_STATE.agents[g.agentId] || { name: 'AGENT', specialty: '' };
  const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
  const b = g.brief || {};
  const plain = String(g.need || '').replace(/^Revised — /, '').replace(/\?\s*$/, '');
  const facts = (b.facts || []).slice();
  const has = k => facts.some(([x]) => x.toLowerCase() === k.toLowerCase());
  if (!has('Asked by')) facts.unshift(['Asked by', a.specialty ? `${nm} · ${a.specialty}` : nm]);
  if (g.context && g.context.task && !has('Task')) facts.push(['Task', g.context.task]);
  if (g.context && g.context.step && !has('At step')) facts.push(['At step', g.context.step]);
  if (b.source && !has('Source')) facts.push(['Source', b.source]);
  facts.push(['Kind', g.simulated ? 'Simulated request (TEST)' : 'Real item']);
  return {
    action: b.action || `${nm} goes ahead: ${plain.charAt(0).toLowerCase() + plain.slice(1)}.`,
    facts,
    why: b.why || '',
    ifDecline: b.ifDecline || `${nm} holds this step. It is kept under Held in ${nm}'s panel and the task carries on without it.`,
    undo: b.undo || '',
    note: g.detail || '',
  };
}

function resolveApproval(gateId, decision, { remote = false } = {}) {
  const i = OFFICE_STATE.approvals.findIndex(g => g.id === gateId);
  if (i < 0) return false;
  const [gate] = OFFICE_STATE.approvals.splice(i, 1);
  const a = OFFICE_STATE.agents[gate.agentId];
  if (decision === 'approve') {
    pushLog(gate.agentId, `Approved by Igor — ${gate.need}`, 'approve');
  } else {
    const item = { id: gate.id, agentId: gate.agentId, need: gate.need, at: Date.now() };
    OFFICE_STATE.held.unshift(item);
    a.held.unshift(item);
    pushLog(gate.agentId, `Declined — held: ${gate.need}`, 'decline');
  }
  BUS.emit('approval', { type: 'resolve', gate, decision, remote }); // remote: already decided (this browser or the Studio ledger)
  return true;
}

function moveTask(taskOrId, column) {
  let task = typeof taskOrId === 'string' ? OFFICE_STATE.tasks.find(t => t.id === taskOrId) : null;
  if (!task && taskOrId && typeof taskOrId === 'object') {
    task = OFFICE_STATE.tasks.find(t => t.id === taskOrId.id);
    if (!task) {
      const mates = Array.isArray(taskOrId.with) ? [...new Set(taskOrId.with)].filter(m => m !== taskOrId.agentId && OFFICE_STATE.agents[m]) : [];
      task = { id: taskOrId.id || uid('task'), title: taskOrId.title, agentId: taskOrId.agentId, with: mates, column: column, at: Date.now(), record: !!taskOrId.record, note: taskOrId.note || '' };
      OFFICE_STATE.tasks.push(task);
    }
  }
  if (!task || !['queued', 'progress', 'done'].includes(column)) return null;
  const finishing = column === 'done' && task.doneCounted !== true && !task.record;
  task.column = column;
  task.at = Date.now();
  if (finishing) {
    task.doneCounted = true;
    const day = etDay();
    OFFICE_STATE.stats.finished++;
    OFFICE_STATE.stats.finishedByDay[day] = (OFFICE_STATE.stats.finishedByDay[day] || 0) + 1;
    const done = OFFICE_STATE.tasks.filter(t => t.column === 'done' && !t.record);
    if (done.length > 80) {
      const drop = new Set(done.sort((a, b) => a.at - b.at).slice(0, done.length - 80));
      OFFICE_STATE.tasks = OFFICE_STATE.tasks.filter(t => !drop.has(t));
    }
  }
  BUS.emit('task', task);
  return task;
}

/** Bring a new agent aboard (cap ten). Returns the agent or an error string. */
/** The business crew: everyone at the ten desks (the study's personal pair are not counted against them). */
const deskAgents = () => OFFICE_STATE.order.filter(id => !OFFICE_STATE.agents[id].zone);

function addAgent(spec) {
  if (deskAgents().length >= CAST_CAP) return 'All ten desks are taken.';
  const taken = new Set(OFFICE_STATE.order.map(id => OFFICE_STATE.agents[id].slot));
  const slot = [8, 9, 0, 1, 2, 3, 4, 5, 6, 7].find(s => !taken.has(s));
  if (slot == null) return 'No free desk.';
  const name = String(spec.name || '').trim().toUpperCase().slice(0, 14);
  if (!name) return 'Give the agent a name.';
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  while (OFFICE_STATE.agents[id]) id += '-2';
  const style = STYLES[spec.style] || STYLES.headset;
  const color = AGENT_COLORS[spec.color] && spec.color !== 'crimson' ? spec.color : freeColors()[0];
  const def = {
    id, name,
    monogram: spec.monogram || name.slice(0, 1) + name.slice(1, 2).toLowerCase(),
    specialty: String(spec.specialty || 'Generalist').trim(),
    engine: spec.engine || 'Claude',
    role: '',
    systems: (spec.systems || []).filter(Boolean),
    delivered: [],
    look: { color, ...style.look },
    slot,
  };
  const a = makeAgent(def);
  a.location = 'arriving';
  a.detail = 'Arriving';
  a.instruction = spec.instruction || '';
  OFFICE_STATE.agents[id] = a;
  const firstPersonal = OFFICE_STATE.order.findIndex(i => OFFICE_STATE.agents[i].zone === 'personal'); // the crew stay before the study (roster divider, 1–0 shortcuts)
  if (firstPersonal < 0) OFFICE_STATE.order.push(id); else OFFICE_STATE.order.splice(firstPersonal, 0, id);
  pushLog(id, 'Display agent added for this browser session', 'system');
  BUS.emit('add', a);
  return a;
}


/* ---------- the owner's side: replies and new work ------------------------------------- */

/** Ask for a change instead of approving: the gate closes, the note goes to the agent. */
function replyToGate(gateId, message) {
  const text = String(message || '').trim();
  const i = OFFICE_STATE.approvals.findIndex(g => g.id === gateId);
  if (i < 0 || !text) return false;
  const [gate] = OFFICE_STATE.approvals.splice(i, 1);
  pushLog(gate.agentId, `Igor asked for a change — “${text}”`, 'reply');
  BUS.emit('approval', { type: 'resolve', gate, decision: 'changes', message: text });
  return true;
}

const REPEATS = { once: 'Once', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week' };
/** Hand an agent new work (queued) or a standing job (also listed under RUNNING). */
/** Everyone on a task: its owner first, then whoever works it with them. Two or more = they meet in the conference room. */
const taskMembers = t => (t ? [t.agentId].concat(t.with || []) : []);
/** The shared task an agent is working right now, if any. */
const sharedTaskOf = id => OFFICE_STATE.tasks.find(t => t.column === 'progress' && t.with && t.with.length && taskMembers(t).includes(id)) || null;

function assignTask(id, title, { repeat = 'once', note = '', with: mates = [] } = {}) {
  const a = OFFICE_STATE.agents[id];
  const t = String(title || '').trim().slice(0, 140);
  if (!a || !t) return null;
  const task = moveTask({ title: t, agentId: id, with: mates, note: repeat !== 'once' ? REPEATS[repeat] : note || 'From Igor' }, 'queued');
  task.assigned = true;
  task.repeat = repeat;
  const local = !!resolveBridgeUrl();
  pushLog(id, `New ${local ? 'local reminder' : repeat === 'once' ? 'task' : 'standing job'} from Igor — ${t}${repeat !== 'once' ? ` (${REPEATS[repeat].toLowerCase()})` : ''}${task.with.length ? ` · with ${task.with.map(m => OFFICE_STATE.agents[m].name).join(', ')}` : ''}`, 'assign');
  for (const m of task.with) pushLog(m, `Joining ${a.name} on a task from Igor — ${t}`, 'assign');
  if (repeat !== 'once' && !local) OFFICE_STATE.running.push({ name: t, cadence: REPEATS[repeat].toLowerCase(), owner: id, job: true });
  BUS.emit('assign', { agentId: id, task, repeat });
  BUS.emit('task', task);
  return task;
}

/* ---------- live screens: the hot sheet and the data wall ------------------------------ */

const HOT_KINDS = { new: 'New', price: 'Price', bom: 'Back on market', uc: 'Under contract', sold: 'Sold', coming: 'Coming soon', open: 'Open house' };
function normHotRow(r) {
  return {
    id: r.id || uid('mls'),
    kind: String(r.kind || '').toLowerCase(),
    address: String(r.address || '').trim(),
    town: String(r.town || '').trim(),
    price: Number(r.price) || null,
    was: Number(r.was) || null,
    beds: r.beds != null ? Number(r.beds) : null,
    baths: r.baths != null ? Number(r.baths) : null,
    dom: r.dom != null ? Number(r.dom) : null,
    matches: r.matches != null ? Number(r.matches) : null,
    views: r.views != null ? Number(r.views) : null, // distinct clients who viewed it in RealScout this week
    ours: !!r.ours,
    openAt: r.openAt ? String(r.openAt) : null,
    mls: r.mls ? String(r.mls) : null,
    at: r.at ? new Date(r.at).getTime() : Date.now(),
  };
}
/** A feed's state on a screen: 'awaiting' (never heard from), 'live', 'stale' (last good data kept) or 'error'. */
const FEED_STATES = ['awaiting', 'live', 'stale', 'error'];
const feedState = s => (FEED_STATES.includes(s) ? s : 'live');

/** Replace (or extend) the hot sheet with rows from the live MLS feed. */
function setHotSheet({ rows = [], asOf, source, replace = true, status, note, staleAfter, fileAgeSeconds, fileAsOf, nextRun } = {}) {
  const H = OFFICE_STATE.hotsheet;
  const clean = rows.map(normHotRow).filter(r => r.address && HOT_KINDS[r.kind]);
  H.rows = (replace ? clean : clean.concat(H.rows.filter(x => !clean.some(c => c.id === x.id)))).sort((a, b) => b.at - a.at);
  H.asOf = asOf ? new Date(asOf).getTime() : Date.now();
  if (source) H.source = String(source);
  H.status = feedState(status);
  H.note = note ? String(note) : null;
  H.staleAfter = staleAfter || null;
  H.nextRun = nextRun || null;
  H.fileAgeSeconds = fileAgeSeconds;
  H.fileAsOf = fileAsOf ? new Date(fileAsOf).getTime() : null;
  BUS.emit('hotsheet', { rows: clean });
  return H;
}
const pushHotSheet = row => setHotSheet({ rows: [row], replace: false });

/** Replace the ticker's items. kind ∈ view | save | inquiry | lead | rate; text is ready to show; at is ISO. */
const TICKER_KINDS = ['view', 'save', 'inquiry', 'lead', 'rate'];
function setTicker({ items = [], status, note, asOf, sample = false } = {}) {
  const T = OFFICE_STATE.ticker;
  const str = (v, n) => (v == null ? '' : String(v).slice(0, n));
  T.items = (Array.isArray(items) ? items : [])
    .filter(i => i && TICKER_KINDS.includes(i.kind) && i.text)
    .map(i => ({
      kind: i.kind, text: str(i.text, 140), at: i.at ? new Date(i.at).getTime() : null,
      id: str(i.id, 24), group: str(i.group, 16), label: str(i.label, 40), value: str(i.value, 16), move: str(i.move, 16),
      stale: !!i.stale, staleAfter: Number(i.staleAfter) || null,
      dir: Number(i.dir) || 0, asOf: str(i.asOf, 24), source: str(i.source, 40),
    }))
    .slice(0, 30);
  T.status = feedState(status);
  T.sample = sample === true; // the TEST layout: rows shown as a sample, labelled TEST, never as stale data
  T.note = note ? String(note) : null;
  T.asOf = asOf ? new Date(asOf).getTime() : Date.now();
  BUS.emit('ticker', T);
  return T;
}

/** Fill one data-wall panel ('today' | 'pipeline' | 'buyers') from a live source. */
function setPanel(key, data = {}) {
  const P = OFFICE_STATE.panels[key];
  if (!P) return null;
  Object.assign(P, data, {
    status: feedState(data.status),
    note: data.note ? String(data.note) : null,
    asOf: data.asOf ? new Date(data.asOf).getTime() : Date.now(),
  });
  BUS.emit('panel', key);
  return P;
}

/** The Studio's jobs: who runs what, what is running, what failed, what's next. The board mirrors them. */
function setFleet({ jobs = [], doneToday = 0, asOf } = {}) {
  const F = (OFFICE_STATE.fleet = { jobs: Array.isArray(jobs) ? jobs.slice(0, 60) : [], doneToday: Number(doneToday) || 0, asOf: asOf ? new Date(asOf).getTime() : Date.now() });
  // the board: running now in progress, the next runs queued, today's runs done (one card per job)
  const soon = Date.now() + 3 * 3600 * 1000;
  const tasks = [];
  for (const j of F.jobs) {
    const agentId = OFFICE_STATE.agents[j.agent] ? j.agent : null;
    if (!agentId) continue;
    if (j.running) tasks.push({ id: 'job-run-' + j.label, title: j.name, agentId, column: 'progress', at: j.since ? new Date(j.since).getTime() : Date.now(), note: 'Running now · ' + j.schedule, job: j.label });
    const nx = j.next ? new Date(j.next).getTime() : 0;
    if (nx && nx <= soon && !j.running) tasks.push({ id: 'job-next-' + j.label, title: j.name, agentId, column: 'queued', at: nx, note: 'Next run ' + fmtTime(new Date(nx)), job: j.label });
    if (j.runsToday) tasks.push({ id: 'job-done-' + j.label, title: j.name + (j.runsToday > 1 ? ` · ×${j.runsToday} today` : ''), agentId, column: 'done', at: j.lastAt ? new Date(j.lastAt).getTime() : Date.now(), note: (j.ok === false ? 'Needs attention · ' : '') + (j.summary || 'Finished') , job: j.label });
  }
  OFFICE_STATE.tasks = tasks.concat(OFFICE_STATE.tasks.filter(t => t.assigned));
  OFFICE_STATE.running = F.jobs.filter(j => j.running && j.loaded !== false && OFFICE_STATE.agents[j.agent]).map(j => ({ name: j.name, cadence: j.schedule, owner: j.agent, job: j.label }));
  OFFICE_STATE.issues = F.jobs.filter(j => j.ok === false).map(j => ({ text: `${j.name}: ${j.summary || 'reported a failure'}`, owner: j.agent }));
  BUS.emit('fleet', F);
  BUS.emit('task', null);
  return F;
}

/** Approvals that live in Follow Up Boss, replaced as one set: new ones appear, ones done in FUB clear themselves. */
function syncApprovals(items = [], source = 'fub') {
  const want = new Map((Array.isArray(items) ? items : []).filter(i => i && i.gateId && OFFICE_STATE.agents[i.agentId]).map(i => [String(i.gateId), i]));
  for (const g of OFFICE_STATE.approvals.slice()) {
    if (g.source === source && !want.has(g.id)) {
      OFFICE_STATE.approvals.splice(OFFICE_STATE.approvals.indexOf(g), 1);
      pushLog(g.agentId, `${source==='fub' ? 'No longer in the current Follow Up Boss review queue' : 'Crimson updated the escalation'} — ${g.need}`, 'approve');
      BUS.emit('approval', { type: 'resolve', gate: g, decision: 'done', remote: true });
    }
  }
  for (const [id, i] of want) {
    const have = OFFICE_STATE.approvals.find(g => g.id === id);
    if (have) {
      Object.assign(have, { need: String(i.need || ''), brief: normBrief(i.brief), agentId: i.agentId, detail: String(i.title || ''), draft: String(i.draft || ''), link: i.link || null, title: String(i.title || ''), requestedBy: i.requestedBy || 'automations', commandId:i.commandId || null, sourceVersion:i.sourceVersion || null });
      continue;
    }
    const g = requestApproval(i.agentId, String(i.need || ''), { id, simulated: false, brief: i.brief, detail: String(i.title || '') });
    if (g) Object.assign(g, { source, link: i.link || null, draft: String(i.draft || ''), title: String(i.title || ''), requestedBy: i.requestedBy || 'automations', commandId:i.commandId || null, sourceVersion:i.sourceVersion || null });
  }
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id], b = a.bridgeStatus || { status: 'IDLE', detail: 'Awaiting job receipt' };
    const n = OFFICE_STATE.approvals.filter(g => g.agentId === id).length;
    if (['WORKING','THINKING'].includes(b.status)) setAgentStatus(id, b.status, b);
    else if (n) setAgentStatus(id, 'WAITING', { detail: `${n} waiting for you · ${b.detail || ''}` });
    else setAgentStatus(id, b.status, b);
  }
  BUS.emit('approval', { type: 'sync' });
}

/**
 * Real issues only, for the glass ampersand: never simulated work.
 *   · a real decision waiting on Igor (a real gate, or one sent by the Studio)
 *   · a live feed that has failed (Follow Up Boss key or connection, an unreadable hot sheet,
 *     an NJMLS session that needs a sign-in)
 *   · the Studio bridge going offline after it had connected
 * Returns [{ kind, text }]; empty when all is well.
 */
function realIssues() {
  const out = [];
  for (const g of OFFICE_STATE.approvals) if (g.simulated === false) out.push({ kind: 'gate', text: g.need });
  const br = OFFICE_STATE.meta.bridge;
  if (OFFICE_STATE.meta.feed === 'offline' && br) out.push({ kind: 'bridge', text: 'Studio bridge offline' });
  const feeds = (br && br.feeds) || {};
  // a key problem counts at once; a connection problem only once it has repeated (one blip is not an issue)
  if (feeds.fub && (feeds.fub.state === 'auth' || (feeds.fub.state === 'error' && (feeds.fub.failures || 0) >= 2))) out.push({ kind: 'feed', text: feeds.fub.note || 'Follow Up Boss feed down' });
  if (feeds.hotsheet && feeds.hotsheet.state === 'error') out.push({ kind: 'feed', text: feeds.hotsheet.note || 'Hot sheet unreadable' });
  if (feeds.hotsheet && feeds.hotsheet.state === 'stale' && /sign-in/i.test(feeds.hotsheet.note || '')) out.push({ kind: 'feed', text: feeds.hotsheet.note });
  if (OFFICE_STATE.fleet) for (const j of OFFICE_STATE.fleet.jobs) if (j.ok === false) out.push({ kind: 'job', text: `${j.name}: ${j.summary || 'reported a failure'}` });
  return out;
}

/**
 * Derived numbers for the top bar and the main screen.
 * WORKING / THINKING / WAITING / IDLE count agents right now (an agent that has
 * just finished is between tasks, so it counts as IDLE). DONE counts delivered
 * work — on record plus finished here — the same number as the board's DONE column.
 */
function officeCounts() {
  const c = { WORKING: 0, THINKING: 0, WAITING: 0, IDLE: 0 };
  for (const id of OFFICE_STATE.order) {
    const st = OFFICE_STATE.agents[id].status;
    c[st === 'DONE' ? 'IDLE' : st]++;
  }
  c.HELD = OFFICE_STATE.held.length;
  c.DONE = OFFICE_STATE.fleet ? OFFICE_STATE.fleet.doneToday : OFFICE_STATE.tasks.filter(t => t.record).length + OFFICE_STATE.stats.finished;
  c.GATES = OFFICE_STATE.approvals.length;
  return c;
}

/** Public handle for phase 2 (and for the console). */
window.AgentOffice = { state: OFFICE_STATE, setAgentStatus, pushLog, requestApproval, resolveApproval, replyToGate, moveTask, assignTask, addAgent, setHotSheet, pushHotSheet, setPanel, setTicker, setFleet, syncApprovals, realIssues, on: BUS.on };
