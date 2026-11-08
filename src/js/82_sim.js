/* =============================================================================
   82 · THE SIMULATION — believable work, driving the office only via the API
   -----------------------------------------------------------------------------
   Each agent cycles: pick a task → work a step (coding / browsing) → think →
   … → done → idle (maybe a calm walk) → next task. Now and then a step gets
   stuck and resolves. Every 3–6 minutes a fresh gate asks for the owner —
   never while two or more already wait. Phase 2 swaps this file for real hooks.
   ============================================================================= */

const PLAYBOOK = {
  crimson: {
    tasks: [
      { title: 'Morning brief for the fleet', steps: [['browsing', 'Reading the overnight logs across eight desks'], ['coding', "Writing today's plan to durable memory"], ['browsing', "Checking today's schedule — TEST ledger billing check"], ['coding', 'Giving every open item an owner']] },
      { title: 'Weekly goals review', steps: [['browsing', "Pulling this week's goals from memory"], ['coding', "Drafting Monday's priorities note"], ['browsing', 'Confirming an owner for each open issue']] },
      { title: 'Gate prep for Igor', steps: [['browsing', 'Reviewing what the crew needs signed off'], ['coding', 'Preparing each request to one step']] },
    ],
    think: ['Ranking open items by owner effort', 'Choosing what reaches Igor today', 'Checking the queue against the schedule'],
    stuck: ['Memory write conflict between two models'],
    gates: [{
      need: "Confirm Monday's priorities note before it syncs to every model?",
      brief: {
        action: "Crimson syncs Monday's priorities note to durable memory, so every agent plans the week from the same list.",
        facts: [['Note', "Monday's priorities"], ['Goes to', 'Durable memory, shared by every model'], ['Drafted in', 'Weekly goals review']],
        why: 'Once it syncs, every desk works from it.',
        ifDecline: "The note stays a draft in Crimson's memory. Nothing syncs.",
        undo: 'Reversible: a corrected note can be synced over it.',
      },
    }],
    go: ['board', 'screen', 'server'],
  },
  builder: {
    tasks: [
      { title: 'manual.beyderco.com — constellation polish', steps: [['coding', 'Tightening node labels in the manual constellation'], ['browsing', 'Checking manual.beyderco.com at phone width'], ['coding', 'Linking new pages into the constellation graph'], ['browsing', 'Reviewing the preview deploy on Vercel']] },
      { title: 'Flagship — journal index template', steps: [['coding', 'Building the journal index template'], ['browsing', 'Checking image weights on the flagship'], ['coding', 'Tidying the grid at tablet width'], ['browsing', 'Opening the PR for Engineer to review']] },
    ],
    think: ['Comparing two layouts for the index', 'Checking the build against the brand rules'],
    stuck: ['Preview build failed once'],
    gates: [{
      need: 'Promote the manual.beyderco.com preview to production?',
      brief: {
        action: 'Builder promotes the current Vercel preview of manual.beyderco.com to production. The public manual changes for every visitor.',
        facts: [['Site', 'manual.beyderco.com'], ['From', 'Vercel preview deploy'], ['To', 'Production (public)']],
        why: 'Production is public, so it ships only with your yes.',
        ifDecline: 'The preview stays up for review. Production is untouched.',
        undo: 'Reversible: Vercel can roll back to the previous deployment.',
      },
    }],
    go: ['screen', 'lounge', 'tree'],
  },
  engineer: {
    tasks: [
      { title: "Review Builder's journal-template PR", steps: [['browsing', "Reading Builder's PR on Beyder-Co/bco-website"], ['coding', 'Requesting one fix — image dimensions'], ['browsing', 'Reading CI logs — lint and build'], ['coding', 'Merging once the checks pass']] },
      { title: 'Dataset repo — README pass', steps: [['coding', 'Updating the Bergen County dataset README'], ['browsing', 'Verifying the 2026-Q3 files render on GitHub']] },
      { title: 'Studio bridge — event contract', steps: [['coding', 'Writing the hot-sheet and panel event schemas'], ['browsing', 'Testing the bridge socket on the Studio']] },
    ],
    think: ['Reading the diff once more', 'Choosing the smallest safe change'],
    stuck: ['CI queue is slow — waiting on a runner'],
    gates: [{
      need: 'Merge the journal-template PR into Beyder-Co/bco-website main?',
      brief: {
        action: "Engineer merges Builder's journal-template pull request into main of Beyder-Co/bco-website, the branch the website is built from.",
        facts: [['Repository', 'Beyder-Co/bco-website'], ['Change', 'Journal index template (Builder)'], ['Review', 'One fix requested: image dimensions'], ['Checks', 'Lint and build']],
        why: 'Main is what the live site is built from.',
        ifDecline: 'The pull request stays open. Nothing reaches main.',
        undo: 'Reversible: a revert pull request undoes the merge.',
      },
    }],
    go: ['server', 'screen', 'tree'],
  },
  strategist: {
    tasks: [
      { title: 'November SEO plan — targets by town', steps: [['browsing', 'Reviewing SEO wave results through Oct 30'], ['coding', 'Choosing November targets by town'], ['browsing', 'Checking each target against Operating Manual §22'], ['coding', 'Handing briefs to Publisher, Scout and Builder']] },
      { title: 'Positioning review — §22', steps: [['browsing', 'Re-reading Operating Manual §22'], ['coding', 'Noting three sharper positioning lines']] },
    ],
    think: ['Weighing reach against focus', 'Sequencing the plan by town', 'Testing the plan against the brand'],
    stuck: ['Two goals pull in opposite directions'],
    gates: [{
      need: 'Approve the November SEO plan before it goes to Publisher and Scout?',
      brief: {
        action: "Strategist hands the November SEO plan to Publisher, Scout and Builder as their briefs for the month.",
        facts: [['Plan', 'November SEO targets, by town'], ['Built on', 'SEO wave results through Oct 30'], ['Checked against', 'Operating Manual §22'], ['Goes to', 'Publisher, Scout, Builder']],
        why: "It sets three agents' work for the month.",
        ifDecline: "The plan stays with Strategist. Current priorities stand.",
      },
    }],
    go: ['board', 'lounge', 'screen'],
  },
  analyst: {
    tasks: [
      { title: 'TEST ledger watch — TEST date rebill', steps: [['browsing', 'Watching TEST ledger for a TEST date rebill — $100 (TEST) recovery open'], ['coding', 'Matching Case TEST-001 notes to the Finance Tracker'], ['browsing', 'Checking the TEST subscription $50 (TEST) verification'], ['coding', 'Categorizing new Plaid transactions']] },
      { title: 'TEST transfer — retry prep', steps: [['browsing', 'Reviewing the blocked TEST transfer'], ['coding', 'Preparing the TEST date retry checklist']] },
    ],
    think: ['Reconciling against the ledger', 'Checking for a second duplicate'],
    stuck: ['Plaid rate-limited — backing off'],
    gates: [{
      need: 'Mark the TEST subscription $50 (TEST) charge as expected?',
      brief: {
        action: 'Analyst records the TEST subscription charge of $50 (TEST) as expected in the Finance Tracker, and it stops being flagged.',
        facts: [['Charge', 'TEST subscription'], ['Amount', '$50 (TEST)'], ['Recorded in', 'Finance Tracker (Plaid)'], ['Verify by', 'TEST date']],
        why: 'Only you know whether this charge was expected.',
        ifDecline: 'It stays flagged for review. Nothing is disputed automatically.',
      },
    }],
    go: ['server', 'board', 'lounge'],
  },
  scout: {
    tasks: [
      { title: 'Visibility sweep', steps: [['browsing', 'Sweeping the SEO Tracker for overnight rank moves'], ['browsing', 'Verifying GBP hours — Mon–Sat 9–8, Sun 8–8'], ['browsing', 'Confirming NJMLS shows the TEST office number'], ['coding', 'Queuing review requests in the FUB review engine']] },
      { title: 'Profile consistency pass', steps: [['browsing', 'Checking the Wikidata entry Q141948654'], ['browsing', 'Checking OpenStreetMap node 14335917712'], ['coding', 'Logging any drift in the SEO Tracker']] },
    ],
    think: ['Comparing listings for drift', 'Choosing which profile to fix first'],
    stuck: ['GBP page timed out'],
    gates: [{
      need: 'Send the queued review requests from the FUB review engine?',
      brief: {
        action: 'Scout sends the queued review requests to clients from the Follow Up Boss review engine.',
        facts: [['System', 'Follow Up Boss review engine'], ['Messages', 'Review requests queued in the visibility sweep'], ['Recipients', '[Needs Confirmation] (the count is in Follow Up Boss)']],
        why: 'They reach clients in your name.',
        ifDecline: 'The requests stay queued. Nothing is sent.',
      },
    }],
    go: ['board', 'screen', 'tree'],
  },
  publisher: {
    tasks: [
      { title: 'YouTube archive — Day 2', steps: [['coding', 'Formatting Day 2 titles and descriptions'], ['browsing', 'Checking Ep #195 listings on all platforms'], ['coding', 'Scheduling the Day 2 social cut-downs'], ['browsing', 'Naming check on the Brenner reels archive']] },
      { title: 'Journal — next essay', steps: [['coding', "Outlining the next Journal essay from Strategist's brief"], ['browsing', 'Pulling quotes from Ep #195']] },
    ],
    think: ['Choosing the opening line', 'Ordering the archive by town'],
    stuck: ['Upload stalled at 80%'],
    gates: [{
      need: 'Publish YouTube archive Day 2 to the channel?',
      brief: {
        action: 'Publisher publishes the Day 2 batch of the YouTube archive to the channel; its social cut-downs go out on their schedule.',
        facts: [['Batch', 'YouTube archive · Day 2'], ['Ready', 'Titles and descriptions formatted'], ['With it', 'Day 2 social cut-downs, scheduled']],
        why: 'It is public under the Beyder&Co. name.',
        ifDecline: 'Day 2 stays private. Day 1 is unaffected.',
        undo: 'Reversible: the videos can be set back to private.',
      },
    }],
    go: ['lounge', 'screen', 'tree'],
  },
  // the study (TEST sample only: a personal runtime is never simulated as connected)
  attache: {
    tasks: [
      { title: 'Personal inbox triage (TEST)', steps: [['browsing', 'Sorting the personal inbox — sample messages'], ['coding', 'Drafting two replies for Igor to read first'], ['browsing', 'Checking the calendar for the week — sample']] },
      { title: 'Appointment prep (TEST)', steps: [['browsing', 'Confirming the sample appointment details'], ['coding', 'Writing the reminder note for Igor']] },
    ],
    think: ['Deciding what Igor needs to see today', 'Holding a draft until Igor reads it'],
    stuck: ['Sample mailbox took too long to answer'],
    gates: [{
      need: 'Send the drafted reply to the sample dentist’s office?',
      brief: {
        action: 'Attaché sends the reply it drafted, confirming the sample appointment. Nothing leaves until you say so.',
        facts: [['To', 'Sample dentist’s office (TEST)'], ['Draft', 'Confirms Thursday 9:00 AM'], ['Channel', 'Personal email']],
        why: 'It goes out under your name.',
        ifDecline: 'The draft stays in the personal outbox.',
        undo: 'A sent message cannot be recalled; a correction can follow.',
      },
    }],
    go: [],
  },
  bursar: {
    tasks: [
      { title: 'Bills due this week (TEST)', steps: [['browsing', 'Listing the sample bills due in the next seven days'], ['coding', 'Preparing the payment list with amounts and due dates'], ['browsing', 'Checking the sample statements for anything unusual']] },
      { title: 'Renewals review (TEST)', steps: [['browsing', 'Reading the sample subscriptions renewing this month'], ['coding', 'Noting which to keep, pause or question']] },
    ],
    think: ['Checking a sample amount against last month', 'Sorting what is due from what can wait'],
    stuck: ['Sample statement did not load'],
    gates: [{
      need: 'Approve paying the sample utility bill?',
      brief: {
        action: 'Bursar queues the sample utility payment for the due date. No payment moves without your approval.',
        facts: [['Payee', 'Sample utility (TEST)'], ['Amount', 'TEST figure'], ['Due', 'In four days']],
        why: 'Money leaves your account.',
        ifDecline: 'The bill stays on the list, marked unpaid.',
        undo: 'A scheduled payment can be cancelled before the due date.',
      },
    }],
    go: [],
  },
  _default: {
    tasks: [
      { title: 'First-day setup', steps: [['browsing', 'Reading the Operating Manual'], ['coding', 'Connecting to its systems'], ['browsing', 'Confirming access and scopes'], ['coding', 'Writing a first-day plan for Crimson']] },
      { title: 'Standing duties', steps: [['browsing', 'Checking its queue'], ['coding', 'Working the next item'], ['browsing', 'Verifying the result']] },
    ],
    think: ['Weighing the next step'],
    stuck: ['A system took too long to respond'],
    gates: [{
      need: 'Confirm the first-day plan?',
      brief: {
        action: 'The new agent starts on the first-day plan it wrote for Crimson.',
        facts: [['Plan', 'First-day setup'], ['Covers', 'Operating Manual, system access, scopes']],
        ifDecline: 'The agent stays in setup until the plan is revised.',
      },
    }],
    go: ['screen', 'lounge', 'tree'],
  },
};
/** Work that takes two or three lanes at once. Whoever is on it meets in the conference room (the Market Room). */
const JOINT = [
  { title: 'Journal template — Builder and Engineer pair on it', lead: 'builder', with: ['engineer'], steps: [['coding', 'Pairing on the journal index template'], ['browsing', 'Walking through the diff together'], ['coding', 'Fixing image dimensions in the template'], ['browsing', 'Watching the checks pass together']] },
  { title: 'November SEO kickoff', lead: 'strategist', with: ['publisher', 'scout'], steps: [['browsing', 'Reading the November targets together'], ['coding', 'Splitting the briefs by town'], ['browsing', 'Checking each brief against §22'], ['coding', 'Setting owners and dates']] },
  { title: 'Finance review with Crimson', lead: 'analyst', with: ['crimson'], steps: [['browsing', 'Going through the open finance items'], ['coding', 'Updating the Finance Tracker notes'], ['browsing', 'Agreeing what reaches Igor']] },
  { title: 'Visibility and content sync', lead: 'scout', with: ['publisher'], steps: [['browsing', 'Comparing rank moves with the publishing calendar'], ['coding', 'Re-ordering the next posts']] },
];

/** Steps for work Igor assigns from an agent's panel. */
const assignedSteps = title => [['browsing', `Reading Igor's brief — ${title}`], ['coding', 'Working on it'], ['browsing', 'Checking the result against the brief'], ['coding', 'Reporting back to Igor']];
const pb = id => PLAYBOOK[id] || PLAYBOOK._default;

const SIM = { enabled: true, speed: 1, agents: {}, nextGateAt: 0, nextWalkAt: 0, nextJointAt: 0, clock: () => performance.now() / 1000 };
const simDur = (a, b) => rand(a, b) / SIM.speed;

/* ---------- seeding: the office opens in a realistic working state -------------- */

/* The office records the decision; it never clicks anything outside. The one step left is Igor's own, and the brief says so. */
const REAL_GATES = [];

/* A decision on a real gate outlives a reload: it is kept in this browser and, on the Studio, in the bridge's
   private ledger (which replays it on connect), so a cleared gate never comes back to ask again. */
const DECIDED_KEY = 'bco-office:decided-gates';
function decidedHere() {
  try {
    const d = JSON.parse(localStorage.getItem(DECIDED_KEY) || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch (e) {
    return {};
  }
}
function rememberDecision(gateId, decision) {
  try {
    const d = decidedHere();
    d[gateId] = decision;
    localStorage.setItem(DECIDED_KEY, JSON.stringify(d));
  } catch (e) { /* private window or blocked storage: the Studio ledger still has it */ }
}
/** Clears gates already decided, quietly: no new ledger entry, no second ask. */
function applyDecided(list) {
  for (const { gateId, decision } of list || []) {
    if (typeof gateId === 'string' && OFFICE_STATE.approvals.some(g => g.id === gateId)) resolveApproval(gateId, decision === 'approve' ? 'approve' : 'decline', { remote: true });
  }
}
const decidedList = () => Object.entries(decidedHere()).map(([gateId, decision]) => ({ gateId, decision }));
function seedRealGates() {
  REAL_GATES.forEach(g => requestApproval('crimson', g.need, { id: g.id, simulated: true, detail: 'Sample request (TEST)', brief: g.brief }));
  applyDecided(decidedList());
}
BUS.on('approval', ev => {
  if (ev.type !== 'resolve') return;
  if (ev.gate.simulated === false && ev.gate.source !== 'fub') rememberDecision(ev.gate.id, ev.decision);
  // without the simulation nobody else moves the agent on: once its last gate is answered it goes back to what the
  // Studio last said it was doing (or quiet, before the Studio has said anything)
  const a = OFFICE_STATE.agents[ev.gate.agentId];
  if (!SIM.enabled && a && !OFFICE_STATE.approvals.some(g => g.agentId === ev.gate.agentId)) {
    const b = a.bridgeStatus;
    if (b) setAgentStatus(a.id, b.status, { activity: b.activity, detail: b.detail, stuck: b.stuck });
    else setAgentStatus(a.id, 'IDLE', { detail: 'Awaiting live events' });
  }
});

/** The Studio's jobs drive the crew from here on: the simulation stops and everything it made up is cleared —
 *  its tasks, its gates (and the old one-step gates), the dated reminders and the logs. What stays is real. */
function goLive() {
  SIM.enabled = false;
  for (const g of OFFICE_STATE.approvals.slice()) if (g.source !== 'fub') OFFICE_STATE.approvals.splice(OFFICE_STATE.approvals.indexOf(g), 1);
  OFFICE_STATE.held = [];
  OFFICE_STATE.tasks = [];
  OFFICE_STATE.stats = { finished: 0, finishedByDay: {} };
  OFFICE_STATE.issues = [];
  OFFICE_STATE.schedule = [];
  for (const s of Object.values(SIM.agents)) if (s) s.task = null; // no simulated work survives into the mirror
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id];
    a.log = [];
    a.held = [];
    a.delivered = [];
    a.paused = false;
    if (a.zone === 'personal') {
      // the study's pair are not Studio business jobs; they stay quiet until a personal runtime reports in
      a.engine = 'Personal runtime · not connected';
      setAgentStatus(id, 'IDLE', { detail: 'Personal runtime not connected' });
      pushLog(id, 'Waiting for a personal runtime on the Studio — nothing is read, sent or paid', 'system');
      continue;
    }
    a.engine = 'Studio job mirror';
    setAgentStatus(id, 'IDLE', { detail: 'Connecting to the Studio' });
    pushLog(id, 'Connected to the Studio — mirroring its jobs, read-only', 'system');
  }
  BUS.emit('approval', { type: 'sync' });
  BUS.emit('task', null);
  BUS.emit('meta', OFFICE_STATE.meta);
}

function seedOffice() {
  const params = new URLSearchParams(location.search);
  SIM.speed = clamp(Number(params.get('speed')) || 1, 0.25, 40);
  const studio = !!resolveBridgeUrl(params);
  SIM.enabled = !studio && params.get('sim') !== '0'; // the Studio bridge feeds the screens; the crew stays simulated
  OFFICE_STATE.meta.feed = SIM.enabled ? 'simulated' : 'standby';
  const now = SIM.clock();
  for (const def of CAST) {
    const a = makeAgent(def);
    OFFICE_STATE.agents[a.id] = a;
    OFFICE_STATE.order.push(a.id);
    a.location = 'desk';
    for (const d of studio ? [] : def.delivered) {
      pushLog(a.id, `On record — ${d}`, 'record');
      moveTask({ title: d, agentId: a.id, record: true }, 'done');
    }
  }
  if (studio) { goLive(); OFFICE_STATE.meta.feed = 'standby'; return; }
  if (!SIM.enabled) return seedLive();
  // the work in flight at load
  const start = {
    builder: ['WORKING', 0, 0], engineer: ['WORKING', 0, 1], strategist: ['THINKING', 0, 0],
    analyst: ['WORKING', 0, 0], scout: ['WORKING', 0, 1], publisher: ['WORKING', 0, 0],
    attache: ['WORKING', 0, 0], bursar: ['THINKING', 0, 0],
  };
  for (const [id, [status, ti, si]] of Object.entries(start)) {
    const t = pb(id).tasks[ti];
    const task = moveTask({ title: t.title, agentId: id }, 'progress');
    pushLog(id, `Started — ${t.title}`, 'task');
    for (let i = 0; i <= si; i++) pushLog(id, t.steps[i][1]);
    const s = (SIM.agents[id] = { task, steps: t.steps, i: si, cycle: ti + 1, phase: status === 'WORKING' ? 'work' : 'think', until: now + simDur(4, 15) });
    if (status === 'WORKING') setAgentStatus(id, 'WORKING', { activity: t.steps[si][0], detail: t.steps[si][1] });
    else setAgentStatus(id, 'THINKING', { detail: pick(pb(id).think) });
    // keep one follow-up queued per agent so the board shows what's next
    const nxt = pb(id).tasks[(ti + 1) % pb(id).tasks.length];
    moveTask({ title: nxt.title, agentId: id }, 'queued');
  }
  // Automations: paused by design during the Studio merge tests
  setAgentStatus('automations', 'IDLE', { detail: 'Paused by design' });
  pushLog('automations', 'Paused by design during Studio merge tests', 'system');
  moveTask({ title: 'Resume Studio automations after merge tests', agentId: 'automations', note: 'Paused by design' }, 'queued');
  SIM.agents.automations = { phase: 'paused', until: Infinity };
  // dated follow-ups from the record
  moveTask({ title: 'Citi ERU callback — due Nov 2', agentId: 'analyst' }, 'queued');
  moveTask({ title: 'TEST subscription $50 (TEST) — verify before TEST date', agentId: 'analyst' }, 'queued');
  moveTask({ title: 'TEST transfer — retry transfer TEST date', agentId: 'analyst' }, 'queued');
  // Crimson: the two real gates, each prepared to one step
  const coTask = moveTask({ title: "Clear today's two gates with Igor", agentId: 'crimson' }, 'progress');
  pushLog('crimson', `Started — ${coTask.title}`, 'task');
  moveTask({ title: pb('crimson').tasks[0].title, agentId: 'crimson' }, 'queued');
  SIM.agents.crimson = { task: coTask, steps: [], i: 0, cycle: 0, phase: 'waiting', until: Infinity };
  seedRealGates();
  SIM.nextGateAt = now + simDur(180, 360);
  SIM.nextJointAt = now + simDur(70, 140);
}

/** Live/standby start: the real record and Crimson's real gates, no simulated work. */
function seedLive() {
  for (const id of OFFICE_STATE.order) {
    const a = OFFICE_STATE.agents[id];
    if (a.paused) setAgentStatus(id, 'IDLE', { detail: 'Paused by design' });
    else if (a.zone === 'personal') setAgentStatus(id, 'IDLE', { detail: 'Personal runtime not connected' });
    else setAgentStatus(id, 'IDLE', { detail: 'Awaiting live events' });
  }
  pushLog('automations', 'Paused by design during Studio merge tests', 'system');
  const coTask = moveTask({ title: "Clear today's two gates with Igor", agentId: 'crimson' }, 'progress');
  seedRealGates();
  if (!OFFICE_STATE.approvals.some(g => g.agentId === 'crimson')) moveTask(coTask, 'done');
}

/* ---------- the loop --------------------------------------------------------------- */

function simTick() {
  if (!SIM.enabled) return;
  const now = SIM.clock();
  for (const id of OFFICE_STATE.order) {
    const s = SIM.agents[id];
    const a = OFFICE_STATE.agents[id];
    if (!s || a.paused || now < s.until) continue;
    advance(id, s, a, now);
  }
  if (now >= SIM.nextGateAt) {
    if (OFFICE_STATE.approvals.length < 2) spawnGate();
    SIM.nextGateAt = now + simDur(180, 360);
  }
  if (now >= SIM.nextJointAt) {
    startJoint(now);
    SIM.nextJointAt = now + simDur(240, 420);
  }
}

/* ---------- shared work: two or more agents on one task, together in the conference room ---------- */

/** Can this agent drop what it is doing and join a shared task now? */
function jointFree(id) {
  const a = OFFICE_STATE.agents[id], s = SIM.agents[id];
  return !!(a && s && !a.paused && !s.joint && !OFFICE_STATE.approvals.some(g => g.agentId === id) && ['work', 'think', 'idle', 'done'].includes(s.phase) && !(typeof INCIDENT !== 'undefined' && INCIDENT.owns(id)));
}
/** Start one of the JOINT tasks (or `def`) whose people are all free: their own work is parked until it is done. */
function startJoint(now, def = null) {
  const options = def ? [def] : JOINT.filter(j => [j.lead].concat(j.with).every(jointFree) && !OFFICE_STATE.tasks.some(t => t.column === 'progress' && t.title === j.title));
  if (!options.length) return null;
  const J = pick(options);
  const members = [J.lead].concat(J.with);
  const task = J.existing ? moveTask(J.existing.id, 'progress') : moveTask({ title: J.title, agentId: J.lead, with: J.with }, 'progress');
  for (const id of members) {
    const s = SIM.agents[id];
    if (s.task && s.task.column === 'progress' && s.task.id !== task.id) {
      s.parked = { task: s.task, steps: s.steps, i: s.i };
      moveTask(s.task.id, 'queued');
    }
    const others = members.filter(m => m !== id).map(m => OFFICE_STATE.agents[m].name.charAt(0) + OFFICE_STATE.agents[m].name.slice(1).toLowerCase());
    pushLog(id, `Started — ${J.title} (with ${others.join(' and ')}, in the conference room)`, 'task');
    Object.assign(s, { joint: task.id, task, steps: J.steps, i: 0, stuckUsed: true });
    if (id === J.lead) beginStep(id, s, now);
    else {
      s.phase = 'joint'; // follows the lead's steps until the task is done
      s.until = Infinity;
      mirrorJoint(id, J.steps[0], 1);
    }
  }
  BUS.emit('task', task);
  return task;
}
/** A member's status follows the lead's step; they take turns at the keyboard. */
function mirrorJoint(id, step, k) {
  const [mode, text] = step;
  setAgentStatus(id, 'WORKING', { activity: k % 2 ? (mode === 'coding' ? 'browsing' : 'coding') : mode, detail: text });
}
BUS.on('agent', a => {
  // the lead's every step is the members' step too
  const s = SIM.agents[a.id];
  if (!SIM.enabled || !s || !s.joint || s.phase === 'joint') return;
  const task = OFFICE_STATE.tasks.find(t => t.id === s.joint);
  if (!task || task.agentId !== a.id) return;
  (task.with || []).forEach((m, k) => {
    const ms = SIM.agents[m];
    if (!ms || ms.joint !== task.id) return;
    if (a.status === 'WORKING' && s.steps[s.i]) mirrorJoint(m, s.steps[s.i], k + 1);
    else if (a.status === 'THINKING' && OFFICE_STATE.agents[m].status !== 'THINKING') setAgentStatus(m, 'THINKING', { detail: 'Talking it through with the team' });
  });
});
/** The lead finished: everyone on it is done, and each goes back to what it parked. */
function finishJoint(task, now) {
  for (const m of task.with || []) {
    const ms = SIM.agents[m];
    if (!ms || ms.joint !== task.id) continue;
    ms.joint = null;
    pushLog(m, `Done — ${task.title}`, 'done');
    setAgentStatus(m, 'DONE', { detail: `Done — ${task.title}` });
    ms.phase = 'done';
    ms.until = now + simDur(5, 9);
  }
}

function beginStep(id, s, now, prefix = '') {
  const [mode, text] = s.steps[s.i];
  setAgentStatus(id, 'WORKING', { activity: mode, detail: text });
  pushLog(id, prefix + text);
  s.phase = 'work';
  s.until = now + simDur(8, 16);
}

function finishTask(id, s, now) {
  if (s.task) {
    moveTask(s.task.id, 'done');
    pushLog(id, `Done — ${s.task.title}`, 'done');
    if (s.joint) {
      finishJoint(s.task, now);
      s.joint = null;
    }
  }
  setAgentStatus(id, 'DONE', { detail: s.task ? `Done — ${s.task.title}` : 'Done' });
  s.phase = 'done';
  s.until = now + simDur(7, 11);
}

function startNextTask(id, s, now) {
  const P = pb(id);
  if (s.parked && s.parked.task && s.parked.task.column !== 'done') {
    const k = s.parked;
    s.parked = null;
    moveTask(k.task.id, 'progress');
    pushLog(id, `Back to — ${k.task.title}`, 'task');
    Object.assign(s, { task: k.task, steps: k.steps, i: Math.min(k.i, k.steps.length - 1), stuckUsed: true });
    return beginStep(id, s, now);
  }
  s.parked = null;
  const mine = OFFICE_STATE.tasks.find(t => t.agentId === id && t.column === 'queued' && t.assigned);
  if (mine && mine.with && mine.with.length) {
    // a task for several agents: they take it to the conference room together
    if (mine.with.every(jointFree)) return void startJoint(now, { title: mine.title, lead: id, with: mine.with, steps: assignedSteps(mine.title), existing: mine });
    s.until = now + simDur(4, 8); // someone it needs is busy: try again shortly
    return;
  }
  if (mine) {
    moveTask(mine.id, 'progress');
    pushLog(id, `Started — ${mine.title}`, 'task');
    Object.assign(s, { task: mine, steps: assignedSteps(mine.title), i: 0, stuckUsed: true });
    return beginStep(id, s, now);
  }
  let task = OFFICE_STATE.tasks.find(t => t.agentId === id && t.column === 'queued' && P.tasks.some(p => p.title === t.title));
  let tpl = task && P.tasks.find(t => t.title === task.title);
  if (!task || !tpl) {
    tpl = P.tasks[s.cycle % P.tasks.length];
    task = moveTask({ title: tpl.title, agentId: id }, 'queued');
  }
  s.cycle++;
  moveTask(task.id, 'progress');
  pushLog(id, `Started — ${task.title}`, 'task');
  s.task = task;
  s.steps = tpl.steps;
  s.i = 0;
  s.stuckUsed = false;
  // keep a follow-up visible in QUEUED
  const nxt = P.tasks[s.cycle % P.tasks.length];
  if (!OFFICE_STATE.tasks.some(t => t.agentId === id && t.column === 'queued' && t.title === nxt.title)) moveTask({ title: nxt.title, agentId: id }, 'queued');
  beginStep(id, s, now);
}

function advance(id, s, a, now) {
  const P = pb(id);
  switch (s.phase) {
    case 'work':
      if (!s.stuckUsed && Math.random() < 0.14) {
        s.stuckUsed = true;
        const why = pick(P.stuck);
        setAgentStatus(id, 'THINKING', { stuck: true, detail: why });
        pushLog(id, `Stuck — ${why}. Retrying.`, 'stuck');
        s.phase = 'stuck';
        s.until = now + simDur(5, 8);
      } else {
        setAgentStatus(id, 'THINKING', { detail: pick(P.think) });
        s.phase = 'think';
        s.until = now + simDur(3, 7);
      }
      break;
    case 'stuck':
      pushLog(id, 'Resolved — continuing');
      setAgentStatus(id, 'THINKING', { detail: 'Re-planning the next step' });
      s.phase = 'think';
      s.until = now + simDur(2, 4);
      break;
    case 'think':
      s.i++;
      if (s.i >= s.steps.length) finishTask(id, s, now);
      else beginStep(id, s, now);
      break;
    case 'revise':
      requestApproval(id, s.revised.need, { simulated: s.revised.simulated, detail: `Revised per your note — “${s.revised.message}”`, brief: s.revised.brief });
      s.phase = 'waiting';
      s.until = Infinity;
      break;
    case 'done': {
      const brk = Math.random() < 0.5; // a longer break now and then; the ambient layer may use it for a walk
      setAgentStatus(id, 'IDLE', { detail: brk ? 'Taking a short break' : 'Between tasks' });
      s.phase = 'idle';
      s.until = now + (brk ? simDur(45, 80) : simDur(30, 50)); // long enough to leave the desk and sit down
      break;
    }
    case 'idle':
      startNextTask(id, s, now);
      break;
    default:
      break;
  }
}

BUS.on('assign', ({ agentId }) => {
  if (!SIM.enabled) return;
  const s = SIM.agents[agentId];
  const a = OFFICE_STATE.agents[agentId];
  if (!s || a.paused) return;
  if (s.phase === 'idle' || s.phase === 'done') s.until = Math.min(s.until, SIM.clock() + simDur(2, 4));
});

/* ---------- gates ------------------------------------------------------------------------ */

function spawnGate() {
  const eligible = OFFICE_STATE.order.filter(id => {
    const a = OFFICE_STATE.agents[id], s = SIM.agents[id];
    return s && !a.paused && a.location === 'desk' && ['work', 'think'].includes(s.phase) && !OFFICE_STATE.approvals.some(g => g.agentId === id);
  });
  if (!eligible.length) return;
  const id = pick(eligible);
  const s = SIM.agents[id];
  s.phase = 'waiting';
  s.until = Infinity;
  const G = pick(pb(id).gates);
  const gate = typeof G === 'string' ? { need: G } : G;
  requestApproval(id, gate.need, { simulated: true, brief: gate.brief });
}

BUS.on('approval', ev => {
  if (ev.type !== 'resolve' || !SIM.enabled) return;
  const id = ev.gate.agentId;
  const s = SIM.agents[id];
  if (!s) return;
  const now = SIM.clock();
  if (ev.decision === 'changes') {
    // the agent takes the note, reworks the step, and asks again
    const need = ev.gate.need.replace(/^Revised — /, '');
    s.revised = { need: `Revised — ${need}`, simulated: ev.gate.simulated, message: ev.message, brief: ev.gate.brief };
    if (OFFICE_STATE.approvals.some(g => g.agentId === id)) {
      s.pendingRevise = (s.pendingRevise || []).concat([s.revised]);
      return;
    }
    setAgentStatus(id, 'THINKING', { detail: `Revising — ${ev.message}` });
    pushLog(id, 'Revising per Igor\'s note');
    s.phase = 'revise';
    s.until = now + simDur(18, 32);
    return;
  }
  if (OFFICE_STATE.approvals.some(g => g.agentId === id)) return; // more gates still pending
  if (s.pendingRevise && s.pendingRevise.length) {
    s.revised = s.pendingRevise.shift();
    setAgentStatus(id, 'THINKING', { detail: `Revising — ${s.revised.message}` });
    s.phase = 'revise';
    s.until = now + simDur(18, 32);
    return;
  }
  if (ev.decision === 'decline') pushLog(id, 'Continuing without it');
  if (!s.steps || !s.steps.length || s.i >= s.steps.length - 1) {
    finishTask(id, s, now);
  } else {
    s.i++;
    beginStep(id, s, now, ev.decision === 'approve' ? 'Approved — ' : '');
  }
});

/* ---------- arrivals: lift → glass door → a free desk ---------------------------------- */

function choreographArrival(a) {
  const w = WORLD.byId[a.id];
  const s = (SIM.agents[a.id] = { phase: 'arriving', until: Infinity, steps: [], i: 0, cycle: 0 });
  const fig = w.fig;
  scene.attach(fig.root);
  fig.root.scale.set(1, 1, 1); // the desk is still materialising; the figure is not
  fig.root.position.set(-10.55, 0, ROOM.door.zc);
  fig.root.rotation.set(0, HALF_PI, 0);
  fig.setMode('stand');
  if (typeof UI !== 'undefined') UI.view('door');
  setTimeout(() => (ROOM_OBJ.lift.target = 1), 500);
  const begin = () => {
    if (MOVE.count() >= AMB.maxWalkers) return setTimeout(begin, 500);
    const path = navPath('LIFT', SLOT_EXIT[w.slot]).map(n => [NAV.nodes[n].x, NAV.nodes[n].z]).concat([slotSeat(w.slot)]);
    a.location = 'walking';
    setAgentStatus(a.id, 'IDLE', { detail: 'Arriving' });
    MOVE.walk(a.id, path, {
      face: STATION_YAW,
      speed: 1.0,
      onArrive: () => {
        sitAtDesk(a.id);
        a.location = 'desk';
        pushLog(a.id, `Came aboard — desk ${w.slot + 1}`, 'system');
        if (a.instruction) pushLog(a.id, `First instruction — ${a.instruction}`, 'task');
        const title = a.instruction || 'First-day setup';
        if (!SIM.enabled) {
          setAgentStatus(a.id, 'IDLE', { detail: 'Awaiting live events' });
          if (typeof UI !== 'undefined') UI.toast(`${a.name} is at desk ${w.slot + 1}`);
          return;
        }
        const task = moveTask({ title, agentId: a.id }, 'progress');
        s.task = task;
        s.steps = PLAYBOOK._default.tasks[0].steps.map(([m, t]) => [m, t === 'Connecting to its systems' && a.systems[0] ? `Connecting to ${a.systems[0]}` : t]);
        s.i = 0;
        s.cycle = 1;
        beginStep(a.id, s, SIM.clock());
        if (typeof UI !== 'undefined') UI.toast(`${a.name} is at desk ${w.slot + 1}`);
      },
    });
  };
  setTimeout(begin, 1700);
  // the lift closes once it is empty; the camera follows inside once the newcomer is through the door
  let liftClosed = false;
  const watch = setInterval(() => {
    const x = fig.root.position.x;
    if (!liftClosed && fig.root.parent === scene && x > ROOM.vestibule.x0 + 1.3) {
      ROOM_OBJ.lift.target = 0;
      liftClosed = true;
    }
    if (fig.root.parent === scene && x > ROOM.door.x + 1.1) {
      clearInterval(watch);
      if (typeof UI !== 'undefined' && UI.currentView === 'door') UI.view('desks');
    }
    if (a.location === 'desk') clearInterval(watch);
  }, 250);
}
