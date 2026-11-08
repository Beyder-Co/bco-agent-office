/* =============================================================================
   90 · THE INTERFACE — top bar, crew rail, head bubbles, detail panel, gate
   card, task board, main-screen mirror, add-an-agent flow. All drawn from
   OFFICE_STATE; every owner action goes back through the event API.
   ============================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Words for a state, shared by bubbles, roster and panel. */
function stateWords(a) {
  if (OFFICE_STATE.meta.feed === 'offline' || (OFFICE_STATE.fleet && OFFICE_STATE.fleet.stale)) return { cls: 'wait', text: 'STALE · reconnecting' };
  if (a.status === 'WAITING') return { cls: 'wait', text: OFFICE_STATE.approvals.some(g => g.agentId === a.id) ? 'Needs you' : 'Needs attention' };
  if (a.location === 'arriving') return { cls: 'idle', text: 'Arriving' };
  if (a.paused) return { cls: 'paused', text: 'Paused', long: 'Paused by design' };
  if (a.location === 'walking') {
    const ph = AMB.agents[a.id] && AMB.agents[a.id].phase;
    return { cls: 'idle', text: ph === 'back' ? 'Heading back' : /arriv/i.test(a.detail) ? 'Arriving' : 'Walking' };
  }
  if (DESTINATIONS[a.location]) return { cls: 'idle', text: 'Away', long: DESTINATIONS[a.location].label };
  switch (a.status) {
    case 'WORKING': return { cls: 'work', text: a.activity === 'browsing' ? 'Browsing…' : 'Coding…' };
    case 'THINKING': return a.stuck ? { cls: 'think stuck', text: 'Stuck', long: 'Stuck · retrying' } : { cls: 'think', text: 'Thinking…' };
    case 'DONE': return { cls: 'done', text: 'Done' };
    default: return { cls: 'idle', text: 'Idle' };
  }
}
/** Each agent's own colour on its tile (Crimson: charcoal, with the crimson kept for "needs you"). */
const agentHex = a => colorsOf(a.look.color).main; // the robot's body paint: each chip matches its robot
const tileStyle = a => `style="--c:${agentHex(a)};--ct:${inkOn(agentHex(a))}"`;
const tileHTML = (a, extra = '') => `<span ${tileStyle(a)} class="tile${extra}">${esc(a.monogram)}</span>`;
/** Each live source the office reads, as the Studio bridge reports it: healthy, quiet, or down (and since when). */
const FEED_NAMES = [['fleet', 'Studio jobs'], ['fub', 'Follow Up Boss'], ['realscout', 'RealScout'], ['hotsheet', 'NJMLS hot sheet'], ['rates', 'Markets'], ['personal', 'Personal runtime']];
function feedsHTML() {
  const br = OFFICE_STATE.meta.bridge;
  if (!br || !br.feeds || OFFICE_STATE.meta.feed === 'simulated') return '';
  const when = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : Date.now() - d.getTime() < 20 * 3600e3 ? fmtTime(d) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  };
  const word = { ok: 'live', partial: 'partial', quiet: 'quiet', starting: 'connecting', missing: 'missing', stale: 'stale', error: 'down', auth: 'key problem', rate: 'slowed', attention: 'needs a look', unconfigured: 'not set up' };
  const rows = FEED_NAMES.filter(([k]) => br.feeds[k]).map(([k, name]) => {
    const f = br.feeds[k];
    const bad = ['error', 'auth', 'missing'].includes(f.state);
    const t = when(f.asOf);
    return `<span class="fd${bad ? ' bad' : f.state === 'ok' ? ' ok' : ''}" title="${esc(f.note || '')}"><i aria-hidden="true"></i>${esc(name)} · ${esc(word[f.state] || f.state)}${t ? ' ' + esc(t) : ''}</span>`;
  });
  return rows.length ? `<span class="feeds">${rows.join('')}</span>` : '';
}

/** What exactly is being approved: the action, the facts, why it needs Igor, and what a decline does. */
function briefHTML(g, mode = 'full') {
  const b = gateBrief(g);
  if (mode === 'line') return `<span class="g-action"><b>Approve to:</b> ${esc(b.action)}</span>`;
  // the floating card already names who asks and whether it is real: it keeps to the facts of the request itself
  // (the full brief, task and step included, is one click away in the agent's panel)
  const card = mode === 'card';
  const shown = card ? b.facts.filter(([k]) => !['Asked by', 'Kind', 'At step', 'Task', 'Source'].includes(k)) : b.facts;
  const facts = shown.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  return `<div class="g-brief${card ? ' compact' : ''}">
      <p class="g-action"><span class="k">If you approve</span>${esc(b.action)}</p>
      ${facts ? `<dl class="g-facts">${facts}</dl>` : ''}
      ${b.why && !card ? `<p class="g-why"><span class="k">Why it needs you</span>${esc(b.why)}</p>` : ''}
      <p class="g-decline"><span class="k">If you decline</span>${esc(b.ifDecline)}</p>
      ${b.undo ? `<p class="g-undo">${esc(b.undo)}</p>` : ''}
      ${b.note && !card ? `<p class="g-note">${esc(b.note)}</p>` : ''}
    </div>`;
}

/** Starting points for new work, one lane per agent. */
const SUGGEST = {
  crimson: ['Brief me at 5 PM on what moved today', "Re-rank this week's priorities", "Prepare tomorrow's gates tonight"],
  builder: ['Build a landing page for a new listing', 'Fix the flagship at phone width', 'Ship the manual.beyderco.com preview'],
  engineer: ['Review and merge the open PRs', 'Refresh the Bergen County dataset', 'Check the Studio bridge health'],
  strategist: ['Draft positioning for a new listing', "Pick next month's SEO targets by town", 'Review a competitor’s positioning'],
  automations: ['Review current job receipts', 'Review the scheduled jobs (§§13–14)', 'Review follow-up needs'],
  analyst: ["Reconcile this week's transactions", 'Review a finance item', 'Prepare a finance checklist'],
  scout: ['Run a visibility sweep of the focus towns', 'Check every public profile for drift', "Send this week's review requests"],
  publisher: ['Draft a Journal essay from the SEO brief', 'Publish the next podcast episode', 'Cut three reels from the latest walkthrough'],
  _default: ['Report on your queue', 'Draft a first-week plan', 'Check your system access'],
};

/** The task an agent is on right now (latest in progress). */
const currentTask = id => OFFICE_STATE.tasks.filter(t => t.agentId === id && t.column === 'progress').sort((x, y) => y.at - x.at)[0] || null;

/** Second line of a crew row: what the agent is doing, in plain words. */
/** The crew mirrors the Studio's jobs (the bridge drives it) rather than the simulation. */
const isLiveCrew = () => !!(OFFICE_STATE.meta && OFFICE_STATE.meta.feed === 'live' && OFFICE_STATE.meta.bridge && OFFICE_STATE.meta.bridge.drivesAgents);
/** 7:31 PM today; Tue 7:15 AM on another day (Eastern). */
function whenShort(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const day = x => x.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric' });
  return (day(d) !== day(new Date()) ? d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) + ' ' : '') + fmtTime(d);
}

function rosterLine(a) {
  if (a.status === 'WAITING') {
    const g = OFFICE_STATE.approvals.find(x => x.agentId === a.id);
    if (g) return { text: g.need };
  }
  if (a.paused) return { text: 'Paused by design during the Studio merge tests', quiet: true };
  const t = currentTask(a.id);
  if (t && (a.status === 'WORKING' || a.status === 'THINKING')) return { text: t.title };
  if (a.status === 'DONE') {
    const d = OFFICE_STATE.tasks.filter(x => x.agentId === a.id && x.column === 'done' && !x.record).sort((x, y) => y.at - x.at)[0];
    return { text: d ? `Finished — ${d.title}` : 'Finished', quiet: true };
  }
  if (DESTINATIONS[a.location]) return { text: DESTINATIONS[a.location].label, quiet: true };
  if (a.location === 'walking') return { text: t ? t.title : 'Between tasks', quiet: !t };
  return { text: a.detail || 'Between tasks', quiet: true };
}

const UI = {
  selected: null,
  panelExpanded: false,
  composerOpen: false,
  prevView: null,
  currentView: 'desks',
  u: 1,
  bubbles: {},
  logCount: 0,
  step: 0,
  draft: null,

  init() {
    this.renderCounts();
    this.renderRoster();
    this.renderGate();
    this.renderBoard();
    this.buildBubbles();
    this.tickClock();
    setInterval(() => this.tickClock(), 1000);

    BUS.on('agent', a => {
      this.renderCounts();
      this.renderRosterRow(a.id);
      this.renderBubble(a.id);
      if (this.hoverId === a.id && !this._overCard && this._cardOpen) this.renderHover();
      if (this.selected === a.id) this.renderPanel(false);
    });
    BUS.on('log', ({ id, line }) => {
      if (this.selected === id) this.appendLog(line);
    });
    BUS.on('approval', ev => {
      this.renderGate();
      this.renderCounts();
      if (ev.type === 'request') {
        const a = OFFICE_STATE.agents[ev.gate.agentId];
        if (OFFICE_STATE.approvals.length > 1) this.toast(`${a.name} also needs you`);
      }
      if (this.selected) this.renderPanel(false);
      this.renderBoard();
    });
    BUS.on('assign', ({ agentId }) => {
      if (this.selected === agentId) this.renderPanel(false);
      this.renderRosterRow(agentId);
    });
    BUS.on('task', () => this.boardDirty = true);
    BUS.on('meta', () => this.renderFeed());
    this.renderFeed();
    BUS.on('add', a => {
      this.renderRoster();
      this.addBubble(a.id);
      this.renderCounts();
      this.updateInsets();
    });
    setInterval(() => {
      if (this.boardDirty) {
        this.renderBoard();
        this.renderCounts();
        OFFICE_STATE.order.forEach(id => this.renderRosterRow(id));
        this.boardDirty = false;
      }
    }, 600);

    // top bar
    document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => this.view(b.dataset.view)));
    $('#viewSelect').addEventListener('change', e => this.view(e.target.value));
    $('#btnBoard').addEventListener('click', () => this.toggleBoard());
    $('#boardClose').addEventListener('click', () => this.toggleBoard(false));
    $('#btnAdd').addEventListener('click', () => this.openAdd());
    $('#btnFull').addEventListener('click', () => this.fullscreen());
    const more = $('#officeMore');
    more.addEventListener('click', e => { if(e.target.closest('button')) more.open=false; });
    document.addEventListener('click', e => { if(!more.contains(e.target)) more.open=false; });
    $('#rosterToggle').addEventListener('click', () => {
      const r = $('#roster');
      r.classList.toggle('collapsed');
      this.syncRailToggle();
      setTimeout(() => this.updateInsets(), 320);
      try { localStorage.setItem('bco-office-rail', r.classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
    });
    let collapsed = true;
    try { collapsed = localStorage.getItem('bco-office-rail') !== '0'; } catch (e) {}
    $('#roster').classList.toggle('collapsed', collapsed);
    this.syncRailToggle();
    $('#counts').addEventListener('click', e => {
      const b = e.target.closest('.count');
      if (!b) return;
      if (b.dataset.k === 'WAITING') { const id=OFFICE_STATE.approvals[0]?.agentId || OFFICE_STATE.order.find(id=>OFFICE_STATE.agents[id].status==='WAITING'); if(id)this.select(id); }
      if (b.dataset.k === 'DONE') this.toggleBoard(true);
    });
    $('#rosterList').addEventListener('click', e => {
      const b = e.target.closest('.row');
      if (b) this.select(b.dataset.id);
    });
    $('#labels').addEventListener('click', e => {
      const b = e.target.closest('.bubble');
      if (b) this.select(b.dataset.id);
    });
    document.addEventListener('keydown', e => {
      const typing = e.target && e.target.closest && e.target.closest('input, textarea, select');
      if (e.key !== 'Escape') {
        if (typing || e.metaKey || e.ctrlKey || e.altKey || !$('#addModal').hidden) return;
        const k = e.key.toLowerCase();
        if (/^[0-9]$/.test(k)) {
          const id = OFFICE_STATE.order[k === '0' ? 9 : Number(k) - 1];
          if (id) this.select(id);
        } else if (k === 'b') this.toggleBoard();
        else if (k === 'o') this.view('overview');
        else if (k === 'd') this.view('desks');
        else if (k === 'm') this.view('boardroom');
        else if (k === 'w') this.view('datawall');
        else if (k === 'n') this.view('hudson');
        else if (k === 'h') this.view('hotlist');
        else if (k === 's') this.openMirror();
        return;
      }
      if (more.open) { more.open=false; $('#moreSummary').focus(); return; }
      if (typing) return e.target.blur();
      if (this._mirrorT || !$('#mirror').hidden) return this.closeMirror();
      if (this._focus) return this.unfocusScreen();
      if (!$('#addModal').hidden) return this.closeAdd();
      if (!$('#mirror').hidden) return this.closeMirror();
      if (this.selected) return this.deselect();
      if (!$('#board').hidden) return this.toggleBoard(false);
    });

    // the room: click to open, hover to say hello
    controls.onTap = (x, y) => this.pick(x, y);
    renderer.domElement.addEventListener('pointermove', e => {
      this._hoverXY = [e.clientX, e.clientY];
      this.hoverPointer(e.clientX, e.clientY);
    });
    renderer.domElement.addEventListener('pointerleave', () => {
      this._hoverXY = null;
      if (this._botDrag) return; // the drag holds the pointer
      renderer.domElement.style.cursor = '';
      this.setHover(null);
    });
    this.bindBotDrag(renderer.domElement);
    setInterval(() => this.hoverTick(), 90);
    controls.onUserMove = () => this.markView(null);
    window.addEventListener('resize', () => {
      this.applyScale();
      refreshFreshness();
      this.updateInsets();
    });
    this.applyScale();
    // always-on screen: the cursor fades after 8 s still; the overview breathes after 3 min untouched
    this.lastInput = performance.now();
    const wake = () => {
      this.lastInput = performance.now();
      document.body.classList.remove('quiet-cursor');
      if (this.drifting) {
        this.drifting = false;
        const from = this.ambientFrom;
        this.ambientFrom = null;
        if (from && from.view !== 'hudson') {
          controls.glideTo(from.view ? viewOf(from.view) : from.cam, 1.8);
          this.markView(from.view || null);
        } else controls.goal.theta = this.driftBase;
      }
    };
    ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, wake, { passive: true }));
    setInterval(() => {
      const idle = performance.now() - this.lastInput;
      if (idle > 8000) document.body.classList.add('quiet-cursor');
      const calm = !REDUCED_MOTION && idle > 180000 && !this.selected && !this._focus && $('#mirror').hidden && $('#addModal').hidden && $('#board').hidden;
      if (calm && !this.drifting && !controls.glide) {
        // three quiet minutes: the office settles into the Hudson view, Manhattan across the river
        this.drifting = true;
        this.ambientFrom = { view: this.currentView, cam: controls.view };
        if (this.currentView !== 'hudson') {
          controls.glideTo(viewOf('hudson'), 7);
          this.markView('hudson');
        }
        this.driftBase = VIEWS.hudson.theta;
        this.driftT0 = performance.now();
      }
      if (this.drifting && !controls.glide) controls.goal.theta = this.driftBase + Math.sin(((performance.now() - this.driftT0) / 120000) * TAU) * 0.05;
    }, 250);
    this.updateInsets();
    this.wakeLock();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.wakeLock());
  },

  /* ---------- top bar ---------- */
  renderCounts() {
    const c = officeCounts();
    const k = [['WORKING', 'Working', 'key'], ['THINKING', 'Thinking'], ['WAITING', 'Waiting', 'key'], ['IDLE', 'Idle']];
    $('#counts').innerHTML =
      k.map(([key, label, cls]) => {
        const hot = key === 'WAITING' && c[key] > 0;
        const tag=key==='WAITING'?'button':'span';
        return `<${tag} ${tag==='button'?'type="button"':''} class="count ${cls || ''} ${hot ? 'hot' : ''}" data-k="${key}" ${key === 'WAITING' ? 'aria-label="Agents needing attention: ' + c[key] + '"' : ''}>${hot ? '<span class="pip" aria-hidden="true"></span>' : ''}<span class="n tnum">${c[key]}</span><span class="l">${label}</span></${tag}>`;
      }).join('') +
      `<button type="button" class="count total key" data-k="DONE" title="Studio job runs finished today. Opens the task board; job completion is not client delivery."><span class="n tnum">${c.DONE}</span><span class="l">Done</span></button>`;
    if (this._booted) requestAnimationFrame(() => this.updateInsets());
    const n = deskAgents().length;
    $('#btnAdd').disabled = n >= CAST_CAP;
    $('#btnAdd').title = n >= CAST_CAP ? 'All ten desks are taken' : 'Bring a new agent aboard';
    $('#deskCount').textContent = n >= CAST_CAP ? `${n} agents · every desk taken` : `${n} agents · room for ${CAST_CAP - n} more`;
  },
  /** One scale unit for the whole interface: 1px up to 1600×1000, growing to 1.6px on a 5K display. */
  applyScale() {
    const u = clamp(Math.min(window.innerWidth / 1600, window.innerHeight / 1000), 1, 1.6);
    this.u = Math.round(u * 100) / 100;
    document.documentElement.style.setProperty('--u', this.u + 'px');
  },
  tickClock() {
    $('#clock').textContent = fmtTime(new Date());
  },
  renderFeed() {
    const br = OFFICE_STATE.meta.bridge;
    const mode = OFFICE_STATE.meta.feed === 'live' && br && br.drivesAgents ? 'fleet' : OFFICE_STATE.meta.feed;
    $('#feedNote').innerHTML = (FEED_NOTES[mode] || FEED_NOTES.simulated) + feedsHTML();
    VIEW.dirty('main', 'hotnew', 'hotdone', 'today', 'pipeline', 'ticker');
    const save=$('#pCompose [data-act="assign"]');
    if (save) save.disabled=!!resolveBridgeUrl() && OFFICE_STATE.meta.feed !== 'live';
  },

  /* ---------- roster ---------- */
  renderRoster() {
    // the crew first; a quiet divider before the study's personal pair
    $('#rosterList').innerHTML = OFFICE_STATE.order.map((id, i) => `${OFFICE_STATE.agents[id].zone === 'personal' && (!i || OFFICE_STATE.agents[OFFICE_STATE.order[i - 1]].zone !== 'personal') ? '<li class="rail-sep" role="presentation"><span class="eyebrow">Personal</span></li>' : ''}<li id="r-${id}"></li>`).join('');
    OFFICE_STATE.order.forEach(id => this.renderRosterRow(id));
  },
  renderRosterRow(id) {
    const a = OFFICE_STATE.agents[id];
    const li = $('#r-' + id);
    if (!li || !a) return;
    const s = stateWords(a);
    const wait = a.status === 'WAITING';
    const line = rosterLine(a);
    // built once, then patched in place: a row under the pointer is never swapped out mid-click
    let b = li.firstElementChild;
    if (!b || !b.classList.contains('row')) {
      li.innerHTML = `<button type="button" class="row" data-id="${id}"><span class="tile"></span>` +
        '<span class="who"><span class="top"><span class="nm"></span><span class="chip"><span class="d" aria-hidden="true"></span> </span></span><span class="tk"></span></span></button>';
      b = li.firstElementChild;
    }
    const hex = agentHex(a), ink = inkOn(hex);
    const set = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
    const txt = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    const tile = b.querySelector('.tile'), chip = b.querySelector('.chip'), tk = b.querySelector('.tk');
    for (const el of [b, tile]) {
      if (el.style.getPropertyValue('--c') !== hex) el.style.setProperty('--c', hex);
      if (el.style.getPropertyValue('--ct') !== ink) el.style.setProperty('--ct', ink);
    }
    set(b, 'aria-current', String(this.selected === id));
    set(b, 'title', `${a.name} — ${a.specialty}`);
    set(b, 'aria-label', `${a.name} · ${s.text} · ${line.text}`);
    set(tile, 'class', 'tile' + (wait ? ' wait' : ''));
    txt(tile, a.monogram);
    txt(b.querySelector('.nm'), a.name);
    set(chip, 'class', 'chip ' + s.cls);
    if (chip.lastChild.nodeValue !== s.text) chip.lastChild.nodeValue = s.text;
    set(tk, 'class', 'tk' + (line.quiet ? ' quiet' : ''));
    txt(tk, line.text);
  },

  /* ---------- head bubbles ---------- */
  buildBubbles() {
    $('#labels').innerHTML = '';
    OFFICE_STATE.order.forEach(id => this.addBubble(id));
  },
  addBubble(id) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.dataset.id = id;
    $('#labels').appendChild(el);
    const lead = document.createElement('span');
    lead.className = 'lead';
    // the name bubble counts as the bot: the same reaction, the same short rest before the card
    el.addEventListener('pointerenter', () => {
      this._bubbleHover = id;
      this.setHover(id);
    });
    el.addEventListener('pointerleave', () => {
      if (this._bubbleHover === id) this._bubbleHover = null;
      this.scheduleHide();
    });
    this.bubbles[id] = { el, lead, x: 0, y: 0 };
    this.renderBubble(id);
  },
  renderBubble(id) {
    const b = this.bubbles[id];
    if (!b) return;
    const a = OFFICE_STATE.agents[id];
    const s = stateWords(a);
    b.el.className = `bubble ${s.cls}${this.selected === id ? ' sel' : ''}${this.compact ? ' compact' : ''}`;
    b.el.style.setProperty('--c', agentHex(a));
    if (!b.el.querySelector('.st')) {
      b.el.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="nm"></span><span class="st"></span>';
      b.el.appendChild(b.lead);
    }
    const nm = b.el.querySelector('.nm'), st = b.el.querySelector('.st'), words = s.long || s.text;
    if (nm.textContent !== a.name) nm.textContent = a.name;
    if (st.textContent !== words) st.textContent = words;
    b.wait = a.status === 'WAITING';
  },
  _v: new THREE.Vector3(),
  updateBubbles() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    // at a distance the pills shrink to name + state glyph; a waiting agent always says so
    const compact = controls.sph.r > 23 || w <= 620; // the overview; Desks and closer keep the state words
    if (compact !== this.compact) {
      this.compact = compact;
      for (const id in this.bubbles) this.bubbles[id].el.classList.toggle('compact', compact);
    }
    const list = [];
    for (const id of OFFICE_STATE.order) {
      const b = this.bubbles[id];
      const wb = WORLD.byId[id];
      if (!b || !wb) continue;
      wb.fig.anchor.getWorldPosition(this._v);
      this._v.project(camera);
      b.vis = this._v.z < 1 && Math.abs(this._v.x) < 1.2 && Math.abs(this._v.y) < 1.2;
      b.x = (this._v.x * 0.5 + 0.5) * w;
      b.y = (-this._v.y * 0.5 + 0.5) * h;
      b.w = b.el.offsetWidth || 90;
      b.h = b.el.offsetHeight || 22;
      list.push(b);
    }
    // nearest first (lowest on screen); later pills step up past the ones already placed,
    // never more than two pill heights, and a hairline keeps each tied to its character
    list.sort((p, q) => q.y - p.y);
    const placed = [];
    list.forEach((b, i) => {
      let y = b.y;
      const floor = b.y - b.h * 2.1;
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const o of placed) {
          if (Math.abs(b.x - o.x) < (b.w + o.w) / 2 + 4 && y > o.py - o.h - 3 && y < o.py + b.h + 3) {
            const ny = Math.max(floor, o.py - o.h - 3);
            if (ny < y) {
              y = ny;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
      // only the nudge eases; the pill itself tracks its character exactly, even mid-glide
      const off = y - b.y;
      b.off = b.off == null ? off : b.off + (off - b.off) * 0.3;
      b.py = b.y + b.off;
      placed.push(b);
      const shift = b.y - b.py;
      b.lead.style.height = shift > 6 ? (shift - 5).toFixed(1) + 'px' : '0px';
      b.el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.py.toFixed(1)}px) translate(-50%, -100%)`;
      b.el.style.visibility = b.vis ? 'visible' : 'hidden';
      b.el.style.zIndex = String((b.wait ? 200 : 100) + (list.length - i));
      b.el.classList.toggle('dim', !!(this.selected && this.selected !== b.el.dataset.id));
    });
    if (this.hoverId) this.placeHover();
    // keep a selected agent in frame while it walks
    if (this.selected && MOVE.walkers[this.selected] && !controls.glide && !controls.pointers.size) {
      WORLD.byId[this.selected].fig.root.getWorldPosition(this._v);
      controls.goalTarget.x += (this._v.x - controls.goalTarget.x) * 0.06;
      controls.goalTarget.z += (this._v.z - controls.goalTarget.z) * 0.06;
    }
  },

  syncRailToggle() {
    const collapsed = $('#roster').classList.contains('collapsed');
    const b = $('#rosterToggle');
    b.setAttribute('aria-expanded', String(!collapsed));
    b.setAttribute('aria-label', collapsed ? 'Expand the crew list' : 'Collapse the crew list');
    b.title = collapsed ? 'Expand the crew list' : 'Collapse the crew list';
  },
  syncPanelSize() {
    const p = $('#panel');
    p.classList.toggle('panel-expanded', this.panelExpanded || this.composerOpen);
    if ($('#pDetails')) $('#pDetails').hidden = !this.panelExpanded;
    if ($('#pCompose')) $('#pCompose').hidden = !this.composerOpen;
    const b = $('#pExpand');
    if (b) { b.setAttribute('aria-expanded', String(this.panelExpanded)); b.textContent = this.panelExpanded ? 'Less detail' : b.dataset.label; }
    const c = p.querySelector('[data-act="compose-toggle"]');
    if (c) { c.setAttribute('aria-expanded', String(this.composerOpen)); c.textContent = this.composerOpen ? 'Close reminder' : 'Add reminder'; }
    requestAnimationFrame(() => this.updateInsets());
  },
  /* ---------- selection & detail panel ---------- */
  select(id) {
    if (!OFFICE_STATE.agents[id]) return;
    const screenUp = this._focus; // a screen was up close: closing the agent returns to where the room was before it
    if (screenUp) this.unfocusScreen(false);
    if (this.selected !== id) { this.replyTo = null; this.panelExpanded = false; this.composerOpen = false; }
    $('#officeMore').open = false;
    this.gateOpen = null;
    $('#hovercard').hidden = true;
    this._cardOpen = false;
    if (!this.selected) {
      this.prevView = screenUp ? screenUp.from : controls.view;
      this.prevViewName = this.currentView;
    }
    const was = this.selected;
    this.selected = id;
    this.logCount = 0;
    $('#panel').hidden = false;
    this.renderPanel(true);
    this.renderGate();
    if (was) this.renderRosterRow(was), this.renderBubble(was);
    this.renderRosterRow(id);
    this.renderBubble(id);
    this.focus(id);
    this.markView(null);
  },
  focus(id) {
    const wb = WORLD.byId[id];
    if (!wb) return;
    const p = new THREE.Vector3();
    wb.fig.root.getWorldPosition(p);
    p.y = 0.7;
    const wide = window.innerWidth > 900;
    this.updateInsets();
    if (wide) controls.glideTo({ target: p, r: 6.2, theta: -0.6, phi: 1.08 }, 1.5);
    else controls.glideTo({ target: p.add(new THREE.Vector3(0, 0.15, 0.2)), r: 9.5, theta: -0.6, phi: 0.98 }, 1.5);
  },
  deselect() {
    const id = this.selected;
    this.selected = null;
    $('#panel').hidden = true;
    this.renderGate();
    this.updateInsets();
    if (id) this.renderRosterRow(id), this.renderBubble(id);
    if (this.prevViewName) controls.glideTo(viewOf(this.prevViewName), 1.4);
    else if (this.prevView) controls.glideTo(this.prevView, 1.4);
    this.markView(this.prevViewName || null);
    this.prevView = null;
    this.prevViewName = null;
  },
  renderPanel(full) {
    const a = OFFICE_STATE.agents[this.selected];
    if (!a) return;
    const p = $('#panel');
    if (full || !$('#pScroll')) {
      p.innerHTML = '<div id="pHead"></div><div class="p-body" id="pScroll"></div><div class="p-compose" id="pCompose"></div>';
      p.onclick = e => this.panelAct(e);
      if (full) this.replyTo = null;
      this.renderCompose();
    }
    // The card is the agent at a glance: one status line, what it needs from Igor (a line each, opened in place),
    // the Studio jobs it runs (last and next), the last few things it did, and a way to hand it work. Its profile
    // (engine, lane, systems, delivered, held) waits under About.
    if (full) (this.needOpen = null), (this.needsAll = false), (this.logAll = false);
    const s = stateWords(a);
    const live = isLiveCrew();
    const simTask = SIM.enabled && SIM.agents[a.id] && SIM.agents[a.id].task;
    const task = (simTask && simTask.column === 'progress' ? simTask : null) || OFFICE_STATE.tasks.find(t => t.agentId === a.id && t.column === 'progress') || sharedTaskOf(a.id);
    // live, the Studio's schedule is listed with its jobs: Up next keeps only what Igor put on the list himself
    const queued = OFFICE_STATE.tasks.filter(t => t.agentId === a.id && t.column === 'queued' && (!live || t.assigned));
    const gates = OFFICE_STATE.approvals.filter(g => g.agentId === a.id);
    const amb = AMB.agents[a.id];
    const where = a.location === 'walking' && amb && amb.phase === 'out' && DESTINATIONS[amb.key] ? `walking to the ${DESTINATIONS[amb.key].label.replace(/^(At the|In the|Under the) /, '').toLowerCase()}`
      : DESTINATIONS[a.location] && !isBusy(a) ? DESTINATIONS[a.location].label.toLowerCase() : '';
    const failing = live && OFFICE_STATE.fleet ? (OFFICE_STATE.fleet.jobs || []).find(j => j.agent === a.id && j.ok === false) : null;
    const raisedNow=typeof COORDINATION_GESTURES!=='undefined' && COORDINATION_GESTURES.waiting.has(a.id);
    const coordinating=a.id==='crimson' && typeof OFFICE_COMMAND_UI!=='undefined' ? OFFICE_COMMAND_UI.rows.filter(r=>['received','working','attempt_failed'].includes(r.state)).length : 0;
    const statusLine = s.text.startsWith('STALE') ? s.text : coordinating && !gates.length ? `Coordinating ${coordinating} request${coordinating===1?'':'s'}` : raisedNow ? (a.status==='WORKING' ? 'Working · question with Crimson' : 'Hand raised · waiting for Crimson’s response') : a.status === 'WAITING' ? (gates.length ? `${gates.length} waiting for you` : failing ? `Needs a look · ${failing.name} failed` : a.detail || 'Needs a look')
      : a.paused ? 'Paused by design'
      : (a.status === 'WORKING' || a.status === 'THINKING') ? (task ? task.title : a.detail || s.text)
      : live ? ['Idle', where].filter(Boolean).join(' · ')
      : task ? task.title : ['Between tasks', where].filter(Boolean).join(' · ');
    const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
    const head = `<div class="p-head">
        ${tileHTML(a, a.status === 'WAITING' ? ' wait' : '')}
        <div><h2>${esc(a.name)}</h2><div class="sp">${esc(a.specialty)}</div></div>
        <button type="button" class="closeX" data-act="close" aria-label="Close detail panel"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12"/></svg></button>
      </div>`;
    // what it needs from Igor: a line each, three at a time; a click opens the draft and the one action that fits
    const shown = this.needsAll ? gates : gates.slice(0, 3);
    const needRow = g => {
      const open = this.needOpen === g.id;
      const facts = gateBrief(g).facts || [];
      const due = (facts.find(([k]) => k === 'Due') || [])[1];
      const sub = [g.simulated ? 'Simulated (TEST)' : due, g.draft ? 'draft ready' : ''].filter(Boolean).join(' · ') || (g.source === 'fub' ? 'Follow Up Boss task' : 'Real item');
      const acts = g.source==='crimson' ? `<button type="button" class="btn ink" data-office-command="respond" data-source="${esc(g.commandId || '')}">Answer Crimson</button>` : g.source === 'fub'
        ? `<button type="button" class="btn ink" data-office-command="gate" data-source="${esc(g.id)}">Review with Crimson</button><button type="button" class="btn ink" data-act="fub" data-g="${g.id}">Open in Follow Up Boss ↗</button>`
        : `<button type="button" class="btn" data-act="reply" data-g="${g.id}">Reply</button><button type="button" class="btn" data-act="decline" data-g="${g.id}">Decline</button><button type="button" class="btn ink" data-act="approve" data-g="${g.id}">Approve</button>`;
      return `<li class="p-need${open ? ' open' : ''}">
          <button type="button" class="pn-row" data-act="need" data-g="${g.id}" aria-expanded="${open}"><span class="pn-need">${esc(g.need)}</span><span class="pn-sub">${esc(sub)}</span><span class="chev" aria-hidden="true">${open ? '‹' : '›'}</span></button>
          ${open ? `<div class="pn-more">${g.draft ? `<div class="pn-draft">${esc(g.draft)}</div>` : ''}${g.source === 'fub' ? (g.draft ? '' : `<p class="pn-what">${esc(gateBrief(g).action)}</p>`) : briefHTML(g)}</div>` : ''}
          <div class="btns pn-actions">${['crimson','fub'].includes(g.source) || open ? acts : `<button type="button" class="btn ink" data-act="need" data-g="${g.id}">Review & respond</button>`}</div>
        </li>`;
    };
    const needsHtml = gates.length ? `<h3 class="eyebrow needs">Needs you · ${gates.length}</h3><ol class="p-needs">${shown.map(needRow).join('')}</ol>
        ${gates.length > shown.length ? `<button type="button" class="linkbtn p-more" data-act="needs-all">Show all ${gates.length}</button>` : ''}` : '';
    // the Studio jobs it runs: last run (✓ or ✕) and next
    const jobs = live && OFFICE_STATE.fleet ? (OFFICE_STATE.fleet.jobs || []).filter(j => j.agent === a.id) : [];
    const jobRow = j => {
      const failed = j.ok === false;
      const last = j.running ? 'running now' : j.lastAt ? `${whenShort(j.lastAt)} ${failed ? '✕' : j.ok ? '✓' : ''}` : '—';
      return `<li class="${failed ? 'fail' : ''}${j.running ? ' run' : ''}"><span class="pj-name">${esc(j.name)}</span><span class="pj-last">${esc(last.trim())}</span><span class="pj-next">${j.next ? 'next ' + esc(whenShort(j.next)) : ''}</span>
          ${j.summary ? `<span class="${failed ? 'pj-why' : 'pj-note'}">${esc(j.summary)}</span>` : ''}${failed ? `<button type="button" class="linkbtn" data-office-command="repair" data-source="${esc(j.label)}" data-agent="${esc(a.id)}">Ask Crimson to repair</button>` : ''}</li>`;
    };
    const jobsHtml = jobs.length ? `<h3 class="eyebrow">On the Studio</h3><ul class="p-jobs">${jobs.map(jobRow).join('')}</ul>` : '';
    const nextHtml = queued.length ? `<p class="p-next"><span class="eyebrow">Up next</span><span>${esc(queued[0].title)}${queued.length > 1 ? ` <span class="g-meta">+${queued.length - 1}</span>` : ''}</span></p>` : '';
    const ownerRows = (OFFICE_STATE.meta.bridge?.commands?.owners || []).filter(r=>a.id==='automations' ? r.workflow==='desktop:fub-sms-flush-local' : a.id==='scout' ? /njmls|seed-intake/.test(r.workflow) : a.id==='publisher' ? /content|journal/.test(r.workflow) : false);
    const ownersHtml=ownerRows.length ? `<h3 class="eyebrow">Codex schedules</h3><ul class="p-jobs">${ownerRows.map(r=>`<li><span class="pj-name">${esc(r.name)}</span><span>${esc(r.status.toLowerCase())}</span></li>`).join('')}</ul>` : '';
    const about = `<details class="p-about"${this.aboutOpen ? ' open' : ''}><summary>About ${esc(nm)}</summary>
        <p class="p-text">${esc(a.role || a.specialty)}</p>
        <dl class="pa-facts"><div><dt>${personal ? 'Runtime' : 'Connected owner'}</dt><dd>${esc(a.engine)}</dd></div>${personal ? '<div><dt>Scope</dt><dd>Personal only · outside Beyder&amp;Co. · nothing sent, booked or paid without Igor</dd></div>' : ''}${a.systems.length ? `<div><dt>Systems</dt><dd>${a.systems.map(esc).join(' · ')}</dd></div>` : ''}</dl>
        ${a.delivered.length ? `<span class="eyebrow">Delivered</span><ul class="delivered">${a.delivered.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        ${a.held.length ? `<span class="eyebrow">Held</span><ul class="delivered held">${a.held.map(h => `<li><span>${esc(h.need)} <span class="g-meta">· held ${fmtTime(new Date(h.at))}</span></span></li>`).join('')}</ul>` : ''}
      </details>`;
    const detailLabel = gates.length ? 'Review & respond' : failing ? 'View failure details' : 'Details';
    // the study's pair: no coordinator, so no Ask Crimson; the runtime's real state instead, never a dead control
    const personal = a.zone === 'personal';
    const pf = OFFICE_STATE.meta.bridge?.feeds?.personal;
    const runtimeText = !personal ? '' : !live ? 'TEST sample · no personal runtime is connected'
      : pf?.state === 'ok' || pf?.state === 'attention' ? `Personal runtime · ${pf.note || 'connected'}`
      : pf?.state === 'missing' ? `Personal runtime · ${pf.note || 'configured, not running'}` : 'Personal runtime · not connected';
    const askHtml = personal ? `<span class="p-runtime" title="Configured on the Studio in config.json → personal_runtime">${esc(runtimeText)}</span>`
      : `<button type="button" class="btn ink" data-office-command="instruction" data-agent="${esc(a.id)}">${a.id === 'crimson' ? 'Tell Crimson' : 'Ask Crimson'}</button>`;
    const escalated=a.id==='crimson' && typeof OFFICE_COMMAND_UI!=='undefined' ? OFFICE_COMMAND_UI.rows.filter(r=>r.state==='needs_igor') : [];
    const escalatedHtml=escalated.length ? `<p class="p-text"><b>${escalated.length} decision${escalated.length===1?'':'s'} for Igor</b> · ${esc(escalated[0].dependency)} <button class="linkbtn" data-office-command="respond" data-source="${esc(escalated[0].id)}">Answer Crimson</button></p>` : '';
    const body = `
        ${escalatedHtml}<div class="status p-summary-line"><span class="chip ${s.cls}"><span class="d" aria-hidden="true"></span></span><span>${esc(statusLine)}</span></div>
        <div class="source-age" title="${esc(sourceAgeText())}">${esc(sourceAgeSummary())}</div>
        <div class="p-compact-actions">${askHtml}<button type="button" class="btn" id="pExpand" data-act="panel-expand" data-label="${esc(detailLabel)}" aria-controls="pDetails" aria-expanded="false">${esc(detailLabel)}</button><button type="button" class="linkbtn" data-act="compose-toggle" aria-controls="pCompose" aria-expanded="false">Add reminder</button></div>
        <div id="pDetails" hidden>${needsHtml}${failing && !gates.length ? '<p class="p-text">This job reported a failure. No approval is waiting for you here; its next scheduled run is shown below.</p>' : ''}${jobsHtml}${ownersHtml}${nextHtml}
        <h3 class="eyebrow p-recent-h">Recent${a.log.length > 3 ? `<button type="button" class="linkbtn" data-act="log-all">${this.logAll ? 'Less' : 'All'}</button>` : ''}</h3>
        <div class="logbox${this.logAll ? ' all' : ''}" id="logbox"><ol class="log" id="logList"></ol></div>
        ${about}</div>`;
    const box0 = $('#logbox');
    const keepScroll = !full && box0 ? box0.scrollTop : null;
    const pinned = !full && box0 ? box0.scrollHeight - box0.scrollTop - box0.clientHeight < 30 : true;
    const bodyScroll = !full ? $('#pScroll').scrollTop : 0;
    const active = p.contains(document.activeElement) ? document.activeElement : null;
    const focusAct = active?.dataset.act, focusGate = active?.dataset.g;
    $('#pHead').innerHTML = head;
    $('#pScroll').innerHTML = body;
    const det = $('#pScroll .p-about');
    if (det) det.ontoggle = () => (this.aboutOpen = det.open);
    if (bodyScroll) $('#pScroll').scrollTop = bodyScroll;
    $('#logList').innerHTML = (this.logAll ? a.log : a.log.slice(-3)).map(l => this.logLine(l)).join('');
    this.syncPanelSize();
    if (focusAct && active && !active.isConnected) {
      const replacement = [...p.querySelectorAll('[data-act]')].find(b => b.dataset.act === focusAct && b.dataset.g === focusGate);
      replacement?.focus({preventScroll:true});
    }
    this.logCount = a.log.length;
    const box = $('#logbox');
    box.scrollTop = pinned || keepScroll == null ? box.scrollHeight : keepScroll;
    if (this.replyTo && !OFFICE_STATE.approvals.some(g => g.id === this.replyTo)) {
      this.replyTo = null;
      this.renderCompose();
    }
  },
  panelAct(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') this.deselect();
    else if (act === 'panel-expand') { this.panelExpanded = !this.panelExpanded; if(this.panelExpanded){const g=OFFICE_STATE.approvals.find(g=>g.agentId===this.selected);if(g)this.needOpen=g.id;} this.renderPanel(); }
    else if (act === 'compose-toggle') { this.composerOpen = !this.composerOpen; this.syncPanelSize(); if(this.composerOpen) $('#cText')?.focus(); }
    else if (act === 'need') (this.needOpen = this.needOpen === b.dataset.g ? null : b.dataset.g), this.renderPanel();
    else if (act === 'needs-all') (this.needsAll = true), this.renderPanel();
    else if (act === 'log-all') (this.logAll = !this.logAll), this.renderPanel();
    else if (act === 'fub') this.openInFub(OFFICE_STATE.approvals.find(g => g.id === b.dataset.g));
    else if (act === 'approve') this.answer(b.dataset.g, 'approve');
    else if (act === 'decline') this.answer(b.dataset.g, 'decline');
    else if (act === 'reply') this.composeReply(b.dataset.g);
    else if (act === 'cancel-reply') {
      this.replyTo = null;
      this.renderCompose();
    } else if (act === 'suggest') {
      const t = $('#cText');
      t.value = b.dataset.t;
      this.composeDraft = { id: this.selected, mode: 'task', text: t.value };
      t.focus();
    } else if (act === 'assign') this.assign();
    else if (act === 'send-reply') this.sendReply();
  },
  /** The panel's footer: give the agent work, or answer one of its requests in words. */
  renderCompose() {
    const a = OFFICE_STATE.agents[this.selected];
    const el = $('#pCompose');
    if (!a || !el) return;
    const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
    const reply = this.replyTo && OFFICE_STATE.approvals.find(g => g.id === this.replyTo && g.agentId === a.id);
    if (reply) {
      el.innerHTML = `<div class="c-head"><span class="eyebrow needs">Reply to ${esc(nm)}</span><button type="button" class="linkbtn" data-act="cancel-reply">Cancel</button></div>
        <p class="c-ctx">${esc(reply.need)}</p>
        <textarea id="cText" rows="3" placeholder="What should change? ${esc(nm)} reworks it and asks again."></textarea>
        <div class="c-foot"><span class="g-meta">⌘↩ to send</span><button type="button" class="btn ink" data-act="send-reply">Send reply</button></div>`;
    } else {
      // live, the crew mirrors the Studio's jobs: a task goes on the agent's list (and the Studio's ledger), not to a robot
      const sug = (SUGGEST[a.id] || SUGGEST._default).map(t => `<button type="button" class="sugg" data-act="suggest" data-t="${esc(t)}">${esc(t)}</button>`).join('');
      const ph = isLiveCrew() ? `Add to ${nm}'s list…` : `Give ${nm} a task or a standing job…`;
      el.innerHTML = `<div class="suggs" aria-label="Suggestions">${sug}</div>
        <p class="g-meta">Saved on this Mac for your review. No job runs it; repeat is a reminder label.</p><div class="c-row"><input id="cText" maxlength="140" autocomplete="off" placeholder="${esc(ph)}" aria-label="${esc(ph)}">
        <select id="cRepeat" aria-label="How often">${Object.entries(REPEATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button type="button" class="btn ink" data-act="assign" ${resolveBridgeUrl() && OFFICE_STATE.meta.feed !== 'live' ? 'disabled' : ''}>${resolveBridgeUrl() ? 'Save reminder' : 'Assign (TEST)'}</button></div>`;
    }
    this.syncPanelSize();
    const t = $('#cText');
    const mode = reply ? 'reply' : 'task';
    if (this.composeDraft && this.composeDraft.id === a.id && this.composeDraft.mode === mode) t.value = this.composeDraft.text;
    t.oninput = () => (this.composeDraft = { id: a.id, mode, text: t.value });
    t.onkeydown = e => {
      if (e.key === 'Enter' && (mode === 'task' || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        mode === 'task' ? this.assign() : this.sendReply();
      }
    };
  },
  composeReply(gateId) {
    this.composerOpen = true;
    this.replyTo = gateId;
    this.composeDraft = null;
    this.renderCompose();
    const t = $('#cText');
    if (t) t.focus();
  },
  assign() {
    if (resolveBridgeUrl() && OFFICE_STATE.meta.feed !== 'live') return this.toast('Reconnect to the Studio before saving a reminder');
    const a = OFFICE_STATE.agents[this.selected];
    const t = $('#cText');
    const text = t ? t.value.trim() : '';
    if (!a || !text) return t && t.focus();
    const repeat = $('#cRepeat').value;
    assignTask(a.id, text, { repeat });
    this.composeDraft = null;
    this.renderCompose();
    const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
    if (isLiveCrew()) this.toast(`On ${nm}'s list${repeat === 'once' ? '' : ' · ' + REPEATS[repeat].toLowerCase()} — saving on the Studio…`);
    else this.toast(repeat === 'once' ? `Queued for ${nm} — ${text}` : `${nm} takes on a standing job · ${REPEATS[repeat].toLowerCase()}`);
  },
  sendReply() {
    const t = $('#cText');
    const text = t ? t.value.trim() : '';
    const g = OFFICE_STATE.approvals.find(x => x.id === this.replyTo);
    if (!g || !text) return t && t.focus();
    const a = OFFICE_STATE.agents[g.agentId];
    replyToGate(g.id, text);
    this.replyTo = null;
    this.composeDraft = null;
    this.renderCompose();
    this.toast(`Sent to ${a.name.charAt(0) + a.name.slice(1).toLowerCase()} — it will rework and ask again`);
  },
  logLine(l) {
    return `<li class="${l.kind}"><time datetime="${new Date(l.t).toISOString()}">${fmtTimeS(new Date(l.t))}</time><span>${esc(l.text)}</span></li>`;
  },
  appendLog(line) {
    const list = $('#logList'), box = $('#logbox');
    if (!list) return;
    const pinned = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
    list.insertAdjacentHTML('beforeend', this.logLine(line));
    const cap = this.logAll ? LOG_CAP : 3; // the card keeps the last three; All shows the rest
    while (list.children.length > cap) list.firstElementChild.remove();
    if (pinned) box.scrollTop = box.scrollHeight;
    if (!this.logAll && OFFICE_STATE.agents[this.selected] && OFFICE_STATE.agents[this.selected].log.length === 4) this.renderPanel(); // the All toggle appears
  },

  /* ---------- the gate card ---------- */
  renderGate() {
    const el = $('#gate');
    const strip = $('#boardGate');
    const q = OFFICE_STATE.approvals;
    const panelOpen = this.selected && !$('#panel').hidden;
    const boardOpen = !$('#board').hidden;
    // with an agent's panel open, its own gates are answered there; the card shows the next one
    const g = panelOpen ? q.find(x => x.agentId !== this.selected) : q[0];
    const more = g ? q.length - 1 - (panelOpen ? q.filter(x => x.agentId === this.selected).length : 0) : 0;
    const act = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const what = b.dataset.act;
      if (what === 'expand') (this.gateOpen = g.id), this.renderGate();
      else if (what === 'collapse') (this.gateOpen = null), this.renderGate();
      else if (what === 'fub') this.openInFub(g);
      else if (what === 'open') this.select(g.agentId);
      else if (what === 'reply') {
        this.select(g.agentId);
        this.composeReply(g.id);
      } else this.answer(g.id, what);
    };
    if (!g || panelOpen) {
      el.hidden = true;
      strip.hidden = true;
      requestAnimationFrame(() => this.updateInsets());
      return;
    }
    const a = OFFICE_STATE.agents[g.agentId];
    if (boardOpen) {
      // the board owns the bottom of the screen: the gate rides in its header instead of covering the room
      el.hidden = true;
      strip.hidden = false;
      strip.innerHTML = `<span class="eyebrow needs">${q.length} waiting</span><button type="button" class="btn" data-act="open">Review</button>`;
      strip.onclick = act;
      requestAnimationFrame(() => this.updateInsets());
      return;
    }
    strip.hidden = true;
    el.hidden = false;
    el.classList.toggle('stacked', more > 0);
    const fub = g.source === 'fub';
    const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
    if (this.gateOpen !== g.id) {
      // the small box: who, what for, one line of context; a click opens the rest
      const facts = (gateBrief(g).facts || []).filter(([k]) => ['Channel', 'Due', 'Contact'].includes(k)).map(([, v]) => v);
      const sub = fub ? [facts.find(v => /text|email|call/i.test(v)), facts.find(v => /overdue|today|am|pm/i.test(v)), g.draft ? 'draft ready' : ''].filter(Boolean).join(' · ') || 'Follow Up Boss task'
        : g.simulated ? 'Simulated request (TEST)' : 'Real item · ' + fmtTime(new Date(g.at));
      el.classList.add('mini');
      el.innerHTML = `${tileHTML(a, ' wait')}
        <button type="button" class="g-mini" data-act="expand" title="${esc(sub)}" aria-expanded="false" aria-label="${esc(nm + ' needs you: ' + g.need + '. Show details')}">
          <span class="g-top"><span class="eyebrow needs">Needs you${g.simulated ? ' · TEST' : ''}</span><span class="from">${esc(a.name)}</span>${more > 0 ? `<span class="more">+${more}</span>` : ''}</span>
          <span class="g-mini-need">${esc(g.need)}</span>
          <span class="g-mini-sub">${esc(sub)}<span class="chev" aria-hidden="true">Details ›</span></span>
        </button>`;
      el.onclick = act;
      requestAnimationFrame(() => this.updateInsets());
      return;
    }
    el.classList.remove('mini');
    el.innerHTML = `${tileHTML(a, ' wait')}
      <div>
        <div class="g-top"><span class="eyebrow needs">Needs you</span><span class="from">${esc(a.name)} · ${esc(a.specialty)}</span>${more > 0 ? `<span class="more">+${more} waiting</span>` : ''}<button type="button" class="linkbtn g-less" data-act="collapse" aria-label="Show less">Less ‹</button></div>
        <p class="g-need">${esc(g.need)}</p>
        ${g.title && g.title !== g.need ? `<p class="g-title">${esc(g.title)}</p>` : ''}
        ${g.draft ? `<div class="g-draft"><span class="k">The prepared draft</span>${esc(g.draft)}</div>` : ''}
        ${briefHTML(g, 'card')}
        <div class="g-foot">
          <span class="g-meta">${fub ? 'Follow Up Boss task · handled there' : g.simulated ? 'Simulated request' : 'Real item'} · ${fmtTime(new Date(g.at))}</span>
          <div class="btns">
            <button type="button" class="linkbtn" data-act="open">Open ${esc(nm)}</button>
            ${g.source==='crimson' ? `<button type="button" class="btn ink" data-office-command="respond" data-source="${esc(g.commandId || '')}">Answer Crimson</button>` : fub ? `<button type="button" class="btn ink" data-office-command="gate" data-source="${esc(g.id)}">Review with Crimson</button><button type="button" class="btn" data-act="fub">Open in Follow Up Boss ↗</button>`
              : `<button type="button" class="btn" data-act="reply">Reply</button>
            <button type="button" class="btn" data-act="decline">Decline</button>
            <button type="button" class="btn ink" data-act="approve">Approve</button>`}
          </div>
        </div>
      </div>`;
    el.onclick = act;
    requestAnimationFrame(() => this.updateInsets());
  },
  /** A Follow Up Boss approval is approved where it lives: the contact opens in FUB; the card clears once the task is done there. */
  openInFub(g) {
    if (!g || !g.link) return this.toast('No Follow Up Boss link for this one');
    const w = window.open(g.link, '_blank');
    if (w) w.opener = null;
    pushLog(g.agentId, `Opened in Follow Up Boss — ${g.need}`, 'approve');
    this.toast('Opened in Follow Up Boss. The Office will reflect the next source check; leaving the queue alone does not prove delivery.');
  },
  answer(gateId, decision) {
    const g = OFFICE_STATE.approvals.find(x => x.id === gateId);
    if (!g) return;
    // a Follow Up Boss item is decided where it lives: dismissing it here would only bring it back on the next poll
    if (g.source === 'crimson') return OFFICE_COMMAND_UI.open({mode:'respond',sourceId:g.commandId,agentId:'crimson'});
    if (g.source === 'fub') return decision === 'approve' ? this.openInFub(g) : this.toast('This one lives in Follow Up Boss: complete or reschedule the task there');
    if (isLiveCrew()) return OFFICE_COMMAND_UI.open({mode:'instruction',agentId:g.agentId,message:decision + ': ' + g.need});
    const a = OFFICE_STATE.agents[g.agentId];
    resolveApproval(gateId, decision);
    const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
    this.toast(decision === 'approve' ? `Decision recorded for ${nm}; execution is not confirmed` : `Held — saved in ${nm}'s panel`);
  },

  /* ---------- task board ---------- */
  toggleBoard(force) {
    if (this._focus) this.unfocusScreen();
    const el = $('#board');
    const open = force != null ? force : el.hidden;
    const returnToMenu = !open && !el.hidden && el.contains(document.activeElement);
    el.hidden = !open;
    document.body.classList.toggle('board-open', open);
    $('#btnBoard').setAttribute('aria-pressed', String(open));
    if (open) { this.renderBoard(); $('#boardClose').focus({preventScroll:true}); }
    else if (returnToMenu) $('#moreSummary').focus({preventScroll:true});
    this.renderGate();
  },
  renderBoard() {
    if ($('#board').hidden) return;
    let age=$('#boardAge');
    if (!age) { age=document.createElement('div');age.id='boardAge';age.className='source-age';$('#board .b-head').appendChild(age); }
    age.textContent=(OFFICE_STATE.fleet && OFFICE_STATE.fleet.stale ? 'STALE · ' : '')+sourceAgeText();
    const by = col => OFFICE_STATE.tasks.filter(t => t.column === col);
    const card = t => {
      const a = OFFICE_STATE.agents[t.agentId];
      const waiting = t.column === 'progress' && a && a.status === 'WAITING';
      const meta = t.record ? 'On record' : t.note ? esc(t.note) : fmtTime(new Date(t.at));
      const mates = (t.with || []).map(m => OFFICE_STATE.agents[m]).filter(Boolean);
      return `<li class="card">${a ? tileHTML(a, waiting ? ' wait' : '') : '<span class="tile">·</span>'}<div><div class="t">${esc(t.title)}</div><div class="m">${a ? esc(a.name) : ''}${mates.length ? ` + ${mates.map(m => esc(m.name)).join(', ')}` : ''} · ${meta}${mates.length && t.column === 'progress' ? ' · Conference room' : ''}${waiting ? ' · <b>Needs you</b>' : ''}</div></div></li>`;
    };
    const q = by('queued'), p = by('progress'), d = by('done');
    $('#colQueued').innerHTML = q.map(card).join('');
    $('#colProgress').innerHTML = p.map(card).join('');
    $('#colDone').innerHTML = d.slice().sort((x, y) => (y.record === x.record ? y.at - x.at : x.record ? 1 : -1)).slice(0, 60).map(card).join('');
    $('#nQueued').textContent = q.length;
    $('#nProgress').textContent = p.length;
    $('#nDone').textContent = officeCounts().DONE;
    $('#boardMeta').textContent = OFFICE_STATE.fleet ? `${OFFICE_STATE.fleet.doneToday} successful Studio job runs today · read-only mirror` : `${OFFICE_STATE.stats.finishedByDay[etDay()] || 0} finished today · ${d.filter(t => t.record).length} on record`;
  },

  /* ---------- camera ---------- */
  /** Shift the projection so the room centres in the space the panels leave. */
  updateInsets() {
    const W = window.innerWidth, H = window.innerHeight;
    const r = $('#roster').getBoundingClientRect();
    const left = !$('#roster').hidden ? r.right : 0;
    const panelOpen = !$('#panel').hidden;
    const right = panelOpen && W > 900 ? W - $('#panel').getBoundingClientRect().left : 0;
    const top = $('#topbar').getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--bar-h', Math.ceil(top) + 'px');
    let bottom = ($('#freshness')?.getBoundingClientRect().height || 0) + 12;
    if (!$('#board').hidden) bottom = Math.max(bottom, H - $('#board').getBoundingClientRect().top);
    else if (!$('#gate').hidden) bottom = Math.max(bottom, H - $('#gate').getBoundingClientRect().top);
    if (panelOpen && W <= 900) bottom = H - $('#panel').getBoundingClientRect().top;
    const ox = -(left - right) / 2, oy = this.currentView === 'hudson' ? 0 : -(top - bottom) / 2; // the Hudson view keeps its horizon
    if (this._focus) this._focus.offsets = [ox, oy]; // a screen up close keeps its square frame; these apply on the way back
    else {
      controls.viewOffsetX = ox;
      controls.viewOffsetY = oy;
    }
    // keep every preset fitted to the free area (portrait screens look down more steeply)
    const portrait = W / H < 0.9;
    VIEWS.overview.phi = portrait ? 0.8 : 0.98;
    VIEWS.desks.phi = portrait ? 0.86 : 0.98;
    const aw = W - left - right - 24, ah = H - top - bottom - 24;
    const before = {};
    for (const k of FITTED) before[k] = VIEWS[k].r;
    fitAllViews(aw, ah);
    const cur = this.currentView;
    if (!this._focus && FITTED.includes(cur) && Math.abs(VIEWS[cur].r - before[cur]) > 0.05) {
      if (this._booted) controls.glideTo(viewOf(cur), 1.0);
      else controls.set(viewOf(cur));
    }
  },
  view(name) {
    if (this._focus) this.unfocusScreen(false);
    if (this.selected) {
      this.selected = null;
      $('#panel').hidden = true;
      this.updateInsets();
      OFFICE_STATE.order.forEach(id => (this.renderRosterRow(id), this.renderBubble(id)));
      this.prevView = null;
    }
    controls.glideTo(viewOf(name), name === 'door' ? 1.8 : 1.6);
    this.markView(name);
  },
  markView(name) {
    if(this._booted && window.OfficeExperience) OfficeExperience.rememberView(name);
    const was = this.currentView;
    this.currentView = name;
    if ((was === 'hudson') !== (name === 'hudson') && this._booted) this.updateInsets();
    document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    if (name) $('#viewSelect').value = name === 'hotsheet' ? 'hotlist' : name;
  },
  _ray: new THREE.Raycaster(),
  raycast(x, y) {
    const rect = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(v, camera);
    const legacy = [ROOM_OBJ.screen && ROOM_OBJ.screen.group, ROOM_OBJ.hot && ROOM_OBJ.hot.group, ...(ROOM_OBJ.panels || []).map(p => p.group),
      ROOM_OBJ.server && ROOM_OBJ.server.live, ROOM_OBJ.logo && ROOM_OBJ.logo.group];
    const targets = [...WORLD.stations.map(s => s.group), ...WORLD.figures.map(f => f.root), ...(ROOM_OBJ.pickables || legacy)].filter(Boolean);
    return this._ray.intersectObjects(targets, true).find(h => h.object.visible && (h.object.userData.agentId || h.object.userData.pick)) || null;
  },
  pick(x, y) {
    if (this._focus) {
      // up close, the feed, the highlight tabs and the "needs you" rows answer a click; anywhere else goes back
      const key = this._focus.key;
      const h = this.raycast(x, y);
      const face = key === 'main' ? ROOM_OBJ.screen && ROOM_OBJ.screen.face : key === 'today' ? ((ROOM_OBJ.panels || []).find(p => p.key === 'today') || {}).face : null;
      const spot = h && face && h.object === face && typeof hitAt === 'function' ? hitAt(key, h.uv) : null;
      if (spot) return this.screenAct(key, spot.act);
      return this.unfocusScreen();
    }
    const hit = this.raycast(x, y);
    if (!hit) return;
    const u = hit.object.userData;
    const screenKey = !u.pick ? null
      : u.pick.startsWith('screen:') ? u.pick.slice(7)
      : u.pick === 'mainscreen' ? 'main' : u.pick === 'hotsheet' ? 'hot' : u.pick.startsWith('panel:') ? u.pick.slice(6) : null;
    if (u.agentId) {
      this.select(u.agentId);
      if (WORLD.byId[u.agentId]) WORLD.byId[u.agentId].fig.greet('click');
    } else if (screenKey === 'manual') this.openManual();
    else if (screenKey === 'ticker' && ROOM_OBJ.ticker) this.focusScreen(ROOM_OBJ.ticker.face, 'ticker'); // any run of the ring: the north run up close
    else if (screenKey) this.focusScreen(hit.object, screenKey);
    else if (u.pick === 'server') {
      this.view('server');
      this.toast('The server cabinet — one light per desk: steady when idle, quick when working, crimson when someone needs you');
    } else if (u.pick === 'logo') this.toast('Beyder&Co. — Curating Your Life.');
    else if (u.pick === 'sculpture') {
      const issues = typeof realIssues === 'function' ? realIssues() : [];
      if (!issues.length) this.toast('All clear. The ampersand breathes slowly while nothing needs you, and quickens when something does.');
      else this.toast(`${issues.length === 1 ? 'One real issue' : `${issues.length} real issues`}: ${issues.slice(0, 3).map(i => i.text).join(' · ')}${issues.length > 3 ? ' …' : ''}`);
    }
  },
  /**
   * Hover: the pointer changes over anything clickable. Only the bot's own body counts as hovering an agent (not its
   * rug, desk, chair or screen): the bot reacts at once (leans back, follows the pointer), and its card opens once the
   * pointer has rested on it for a moment, so it can be pushed and pulled first.
   */
  hoverTick() {
    if (this._botDrag || controls.pointers.size || controls.glide || this._focus) return;
    if (!this._hoverXY) {
      if (this._bubbleHover && this._bubbleHover === this.hoverId) this.cardDwell(); // resting on a name bubble
      return;
    }
    const hit = this.raycast(...this._hoverXY);
    const u = hit && hit.object.userData;
    const id = u && u.body && u.agentId && OFFICE_STATE.agents[u.agentId] ? u.agentId : null;
    renderer.domElement.style.cursor = !hit ? '' : id ? 'grab' : 'pointer';
    this.setHover(id);
    this.cardDwell();
  },
  setHover(id) {
    const figOf = k => k && WORLD.byId[k] && WORLD.byId[k].fig;
    if (id === this.hoverId) {
      if (id) {
        this.cancelHide();
        if (figOf(id)) figOf(id).hoverOn(true);
      }
      return;
    }
    if (!id) {
      if (figOf(this.hoverId)) figOf(this.hoverId).hoverOn(false); // the bot settles at once
      return this.scheduleHide(); // the card leaves shortly after the pointer does
    }
    this.cancelHide();
    if (this.hoverId && this.bubbles[this.hoverId]) this.bubbles[this.hoverId].el.classList.remove('hov');
    if (figOf(this.hoverId)) figOf(this.hoverId).hoverOn(false);
    this.hoverId = id;
    if (figOf(id)) figOf(id).hoverOn(true);
    if (this.bubbles[id]) this.bubbles[id].el.classList.add('hov');
    $('#hovercard').hidden = true;
    this._cardOpen = false;
    this._dwell = { t: performance.now(), x: this._hoverXY ? this._hoverXY[0] : 0, y: this._hoverXY ? this._hoverXY[1] : 0 };
  },
  /** The card opens once the pointer has rested on the bot for ~0.9 s, never while pressing or dragging. */
  cardDwell() {
    if (!this.hoverId || this._cardOpen || this._botDrag || this._overCard || !this._dwell) return;
    if (performance.now() - this._dwell.t < 900) return;
    this._cardOpen = true;
    this.renderHover();
  },
  /** The pointer moving over a hovered bot: its head follows (a point along the pointer's ray, near the bot). */
  hoverPointer(x, y) {
    const w = this.hoverId && WORLD.byId[this.hoverId];
    if (!w) return;
    const fig = w.fig, hv = this._hv || (this._hv = new THREE.Vector3());
    fig.head.getWorldPosition(hv);
    const rect = renderer.domElement.getBoundingClientRect();
    this._ray.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
    fig.hoverLook(this._ray.ray.at(hv.distanceTo(camera.position) * 0.82, new THREE.Vector3()));
    const D = this._dwell;
    if (!this._cardOpen && D && Math.hypot(x - D.x, y - D.y) > 10) this._dwell = { t: performance.now(), x, y }; // not resting yet
  },
  /**
   * Push and pull: a press on a bot's body belongs to the bot, not the camera. Dragging moves it (and its chair) on a
   * damped spring, clamped clear of the desk and neighbours; letting go, it settles back. A click without movement
   * still selects. The card stays hidden while pressing and dragging.
   */
  bindBotDrag(cv) {
    window.addEventListener('pointerdown', e => {
      if (e.target !== cv || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || this._focus || this._botDrag || controls.pointers.size) return;
      const hit = this.raycast(e.clientX, e.clientY);
      const u = hit && hit.object.userData;
      if (!u || !u.body || !u.agentId || !WORLD.byId[u.agentId]) return;
      e.stopPropagation(); // the camera never sees this press: no orbit
      const fig = WORLD.byId[u.agentId].fig;
      // the part under the pointer: an arm, a leg or the head is pulled by itself (in the screen's plane), the torso moves the whole body
      const part = fig.partOf ? fig.partOf(hit.object) : 'torso';
      const n = part === 'torso' ? new THREE.Vector3(0, 1, 0) : camera.getWorldDirection(new THREE.Vector3()).negate();
      this._botDrag = { fig, part, pid: e.pointerId, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false,
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point), p0: hit.point.clone() };
      if (part !== 'torso' && !fig.grab(part, hit.point)) this._botDrag.part = 'torso';
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic event) */ }
      this.lastInput = performance.now();
      document.body.classList.remove('quiet-cursor');
      $('#hovercard').hidden = true;
      this._cardOpen = false;
      cv.style.cursor = 'grabbing';
    }, true);
    cv.addEventListener('pointermove', e => {
      const D = this._botDrag;
      if (!D || e.pointerId !== D.pid) return;
      if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) > 4) D.moved = true;
      if (!D.moved) return;
      const rect = cv.getBoundingClientRect();
      this._ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const p = this._ray.ray.intersectPlane(D.plane, new THREE.Vector3());
      if (p) {
        if (D.part === 'torso') D.fig.pushDrag(p.sub(D.p0));
        else D.fig.grabTo(p);
      }
    });
    const end = e => {
      const D = this._botDrag;
      if (!D || e.pointerId !== D.pid) return;
      this._botDrag = null;
      if (D.part !== 'torso') D.fig.grabRelease();
      D.fig.pushRelease();
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* (already released) */ }
      cv.style.cursor = '';
      if (!D.moved && e.type === 'pointerup' && performance.now() - D.t < 600) this.pick(e.clientX, e.clientY); // a click still selects
      if (this.hoverId) this._dwell = { t: performance.now(), x: e.clientX, y: e.clientY }; // the card may come once the pointer rests again
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  },
  /**
   * Hide the card a moment after the pointer leaves the agent (long enough to reach the card's buttons).
   * Once a hide is on its way it is never pushed back by the hover poll, which re-asks every 90 ms;
   * only coming back to the agent or onto the card cancels it.
   */
  scheduleHide() {
    if (this._hideT) return;
    this._hideT = setTimeout(() => {
      this._hideT = null;
      if (this._overCard) return;
      if (this.hoverId && this.bubbles[this.hoverId]) this.bubbles[this.hoverId].el.classList.remove('hov');
      if (this.hoverId && WORLD.byId[this.hoverId]) WORLD.byId[this.hoverId].fig.hoverOn(false);
      this.hoverId = null;
      this._cardOpen = false;
      this._dwell = null;
      $('#hovercard').hidden = true;
    }, 280);
  },
  cancelHide() {
    clearTimeout(this._hideT);
    this._hideT = null;
  },
  /** The small card: who, state, what it is on, and the one action that matters now. */
  renderHover() {
    const id = this.hoverId;
    const a = OFFICE_STATE.agents[id];
    const el = $('#hovercard');
    if (!a || this.selected === id) return (el.hidden = true);
    const s = stateWords(a);
    const line = rosterLine(a);
    const mine = OFFICE_STATE.approvals.filter(x => x.agentId === id);
    const g = mine[0];
    const info = `<div class="h-top">${tileHTML(a, g ? ' wait' : '')}<div><div class="h-nm">${esc(a.name)}</div><div class="h-status">${esc(s.text)}</div></div></div><div class="h-task${line.quiet ? ' quiet' : ''}">${esc(g ? g.need : line.text)}</div>`;
    const acts = '<button type="button" class="btn" data-h="open">Details</button>';
    // the text refreshes in place; the buttons are only rebuilt when the choice of actions changes
    if (!el.querySelector('.h-info') || el._id !== id) {
      el.innerHTML = '<div class="h-info"></div><div class="h-acts"></div>';
      el._id = id;
      el._info = el._acts = null;
    }
    if (el._info !== info) el.querySelector('.h-info').innerHTML = el._info = info;
    if (el._acts !== acts) el.querySelector('.h-acts').innerHTML = el._acts = acts;
    el.onclick = e => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      el.hidden = true;
      this._overCard = false;
      this.select(id);
      this.panelExpanded = true;
      this.syncPanelSize();
    };
    el.onpointerenter = () => {
      this._overCard = true;
      this.cancelHide();
    };
    el.onpointerleave = () => {
      this._overCard = false;
      this.scheduleHide();
    };
    el.hidden = false;
    this.placeHover();
  },
  placeHover() {
    const el = $('#hovercard');
    const b = this.bubbles[this.hoverId];
    if (el.hidden || !b || this._overCard) return; // it holds still while the pointer is on it
    const W = window.innerWidth, H = window.innerHeight;
    const cw = el.offsetWidth || 296, ch = el.offsetHeight || 150;
    let x = b.x + b.w / 2 + 12;
    if (x + cw > W - 16) x = b.x - b.w / 2 - 12 - cw;
    const top = $('#topbar').getBoundingClientRect().bottom + 8;
    const y = clamp(b.py - b.h - 6, top, H - ch - 12);
    if (this._hx != null && Math.abs(this._hx - x) < 2.5 && Math.abs(this._hy - y) < 2.5) return;
    this._hx = x;
    this._hy = y;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
  },

  /* ---------- the hot sheet and the data wall, full screen ---------- */
  openDataList(key) {
    this.closeMirror();
    this.unfocusScreen(false);
    if (this.selected) this.deselect();
    this.mirrorReturn = controls.view;
    this.dataListKey = key;
    this._dataHtml = null;
    this.renderDataList();
    $('#mirror').hidden = false;
    this._mirrorI = setInterval(() => this.renderDataList(), 1000);
  },
  renderDataList() {
    const key = this.dataListKey, P = OFFICE_STATE.panels;
    const H = OFFICE_STATE.hotsheet;
    const p = key === 'today' ? P.needs : key === 'pipeline' ? P.pipeline : key.startsWith('hot') ? H : P.feed;
    const title = {today:'Needs you, follow-ups & leads',pipeline:'Pipeline & critical dates',hotnew:'NJMLS · new, returning & open',hotdone:'NJMLS · price, under contract & sold',main:'Activity & contact highlights'}[key];
    const row = i => `<li><div class="a">${esc(i.title || i.text || '')}</div>${i.who ? `<div class="b">${esc(i.who)}</div>` : ''}${i.when ? `<div class="b">${esc(i.when)}${i.createdAt?' · '+Math.floor(Math.max(0,Date.now()-new Date(i.createdAt))/60000)+' min old':''}</div>` : ''}${i.detail?`<p>${esc(i.detail)}</p>`:''}${i.draft ? `<details><summary>Read complete prepared draft</summary><pre class="data-draft">${esc(i.draft)}</pre></details>` : ''}${i.fubLink||i.link ? `<a href="${esc(i.fubLink||i.link)}" target="_blank" rel="noopener noreferrer">Open in Follow Up Boss ↗</a>` : ''}</li>`;
    const section = (label,items) => `<section><h3>${esc(label)}</h3><ol class="m-list">${items.length ? items.map(row).join('') : '<li>No records in this source window.</li>'}</ol></section>`;
    let content = '';
    if (key === 'today') {
      content = '<p class="source-age">Appointments are FUB-native records exposed by its API. Calendar-synced appointments are unavailable from this source.</p>' + section('Needs you',P.needs.items || []);
      content += section('Follow-ups',(P.today.followups?.items || []).map(i=>({title:i.who+' · '+i.what,when:i.when})));
      content += section('New leads · 7 days',(P.buyers.newLeads || []).map(i=>({title:i.name+' · '+i.source,when:new Date(i.at).toLocaleString('en-US',{timeZone:'America/New_York',hour12:true})+' ET'})));
      content += section('Hot buyers',(P.buyers.hot || []).map(i=>({title:i.name,when:i.signal})));
    } else if (key === 'pipeline') {
      content = section('Current counts',Object.entries(P.pipeline.stages || {}).map(([k,v])=>({title:({listings:'Listings',underContract:'Under contract',closing30:'Closing within 30 days',closedYTD:'Closed this year',offers:'Offers',offMarket:'Off market',buyerContracts:'Buyer contracts'}[k] || k)+': '+v})));
      content += `<p>${esc(P.pipeline.closedBasis || '')}</p>` + section('Next 14 days',(P.pipeline.dates || []).map(i=>({title:i.deal+' · '+i.label,when:i.date})));
    } else if (key.startsWith('hot')) {
      content = section('Source rows',(H.rows || []).filter(i=>(key==='hotnew'?['new','bom','coming','open']:['price','uc','sold']).includes(i.kind)).map(i=>({title:i.kind.toUpperCase()+' · '+i.address+' · '+i.town,when:[i.price?money(i.price):'',i.openAt || '',i.ours?'Our listing':'',i.views!=null?i.views+' client views':''].filter(Boolean).join(' · ')})));
    } else {
      content = `<p>${esc(P.feed.windowLabel || 'Recent grouped activity')}</p>` + section('Recent activity',P.feed.items || []);
      content += `<p class="source-age history-age">60-day context checked ${P.highlights.historyAsOf ? esc(fmtTime(new Date(P.highlights.historyAsOf)))+' ET' : 'awaiting source'} · ${esc(feedLine(P.highlights).text)}</p>`;
      content += ['engaged','reengaged','slipping'].map(tab=>section({engaged:'Most engaged',reengaged:'Recently re-engaged',slipping:'Slipping away'}[tab],(P.highlights[tab] || []).map(i=>({title:i.who+' · '+i.reason,link:i.link})))).join('');
    }
    const html = `<button type="button" class="btn m-close" id="closeDataList">Close</button><div class="m-wrap data-list"><h2>${esc(title)}</h2><div>${esc(feedLine(p).text)} · ${esc(sourceAgeText())}</div>${content}</div>`;
    if (html === this._dataHtml) return;
    this._dataHtml = html;
    $('#mirror').innerHTML = html;
    $('#closeDataList').onclick = () => this.closeMirror();
  },
  openScreen(key) {
    if (['main','today','pipeline','hotnew','hotdone'].includes(key)) return this.openDataList(key);
    this.closeMirror();
    key = { hot: 'hotnew', hotsheet: 'hotnew', hotlist: 'hotnew', buyers: 'today' }[key] || key;
    const sc = typeof VIEW !== 'undefined' && VIEW.screens[key];
    if (!sc) return;
    if (this.selected) this.deselect();
    if (this._focus) this.unfocusScreen();
    if (key === 'manual') return this.openManual();
    this.focusScreen(sc.face, key);
  },
  renderScreenMirror() {
    const sc = VIEW.screens[this.mirrorKey];
    const cv = $('#mirrorCanvas');
    if (!sc || !cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(window.innerWidth - 48, ((window.innerHeight - 110) * sc.W) / sc.H);
    cv.style.width = w + 'px';
    cv.style.height = (w * sc.H) / sc.W + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round((w * dpr * sc.H) / sc.W);
    const ctx = cv.getContext('2d');
    ctx.setTransform(cv.width / sc.W, 0, 0, cv.width / sc.W, 0, 0);
    sc.draw(ctx);
  },

  /* ---------- the main-screen mirror ---------- */
  /**
   * Click a screen: the camera glides square-on to it and frames it, and the screen switches to its
   * detailed layout (VIEW.focusKey). Any click or Esc glides back to exactly where the camera was.
   */
  focusScreen(mesh, key) {
    if (['main','today','pipeline','hotnew','hotdone'].includes(key)) return this.openDataList(key);
    if (!mesh || !mesh.geometry) return;
    this._focusStyle();
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const size = new THREE.Vector3(), mid = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    geo.boundingBox.getCenter(mid);
    mesh.updateWorldMatrix(true, false);
    const center = mid.applyMatrix4(mesh.matrixWorld);
    const q = new THREE.Quaternion(), sc = new THREE.Vector3();
    mesh.getWorldQuaternion(q);
    mesh.getWorldScale(sc);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
    if (normal.dot(camera.position.clone().sub(center)) < 0) normal.negate(); // face the side we're looking from
    const w = Math.abs(size.x * sc.x), h = Math.abs(size.y * sc.y);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const rect = renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const r = Math.max(h / 2 / t, w / 2 / (t * aspect)) * 1.1;
    this._focus = { key, from: controls.view, offsets: [controls.viewOffsetX, controls.viewOffsetY] };
    controls.viewOffsetX = controls.viewOffsetY = 0; // square in the frame, whatever panels are open
    controls.glideTo({ target: center, r, theta: Math.atan2(normal.x, normal.z), phi: Math.acos(clamp(normal.y, -1, 1)) }, 1.15);
    if (typeof VIEW !== 'undefined') {
      VIEW.focusKey = key;
      if (VIEW.dirty) VIEW.dirty(key);
    }
    this.setHover && this.setHover(null);
    document.body.classList.add('screen-focus');
    this.toast(key === 'today' ? 'Click an item to handle it in Follow Up Boss · anywhere else to go back'
      : key === 'main' ? 'Click a tab, or a name to open it in Follow Up Boss · anywhere else to go back'
      : 'Details up close. Click anywhere to go back.');
  },
  /** A click on a row or a tab of a screen up close: switch the highlights tab, or open where the item is handled. */
  screenAct(key, act) {
    if (!act) return;
    if (act.tab != null) {
      HL.tab = act.tab;
      HL.picked = HL.at = performance.now();
      VIEW.dirty('main');
      return;
    }
    if (act.link) {
      const w = window.open(act.link, '_blank');
      if (w) w.opener = null;
      const fub = /followupboss\.com/.test(act.link);
      this.toast(fub ? `Opening ${act.label ? act.label + ' ' : ''}in Follow Up Boss` : `Opening ${act.label || act.link.replace(/^https?:\/\//, '').split('/')[0]}`);
      return;
    }
    const n = act.need || {};
    this.toast(n.detail ? `${n.title} — ${n.detail}` : n.title || 'Nothing to open for this one');
  },
  /** While a screen is up close, the floating panels step aside so nothing covers it. */
  _focusStyle() {
    if (document.getElementById('focusStyle')) return;
    const st = document.createElement('style');
    st.id = 'focusStyle';
    st.textContent = ['#roster', '#panel', '#gate', '#labels', '#hovercard', '#board'].map(id => `body.screen-focus ${id}`).join(', ') +
      ' { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; transition: none !important; }';
    document.head.appendChild(st);
  },
  /** The Field screen: open the Operating Manual's constellation itself, in its own tab. */
  openManual() {
    const url = typeof FIELD !== 'undefined' ? FIELD.URL : 'https://manual.beyderco.com/#map';
    const w = window.open(url, '_blank'); // ('noopener' would make this return null, so detach by hand)
    if (w) w.opener = null;
    else this.toast('Open manual.beyderco.com to see the field');
  },
  unfocusScreen(glideBack = true) {
    const f = this._focus;
    if (!f) return;
    this._focus = null;
    controls.viewOffsetX = f.offsets[0];
    controls.viewOffsetY = f.offsets[1];
    if (glideBack) controls.glideTo(f.from, 1.15);
    if (typeof VIEW !== 'undefined') {
      VIEW.focusKey = null;
      if (VIEW.dirty) VIEW.dirty(f.key);
    }
    document.body.classList.remove('screen-focus');
  },
  openMirror() {
    if (this._focus) this.unfocusScreen(false);
    if (this.selected) this.deselect();
    this.mirrorReturn = controls.view;
    controls.glideTo(viewOf('screen'), 1.3);
    this.markView(null);
    clearTimeout(this._mirrorT);
    this._mirrorT = setTimeout(() => {
      this.renderMirror();
      $('#mirror').hidden = false;
      this._mirrorI = setInterval(() => this.renderMirror(), 1000);
    }, REDUCED_MOTION ? 0 : 1100);
  },
  closeMirror() {
    clearTimeout(this._mirrorT);
    this._mirrorT = null;
    $('#mirror').hidden = true;
    $('#mirror').classList.remove('dark');
    this.mirrorKey = null;
    this.dataListKey = null;
    this._mirrorHtml = null;
    clearInterval(this._mirrorI);
    if (this.mirrorReturn) controls.glideTo(this.mirrorReturn, 1.3);
  },
  renderMirror() {
    const c = officeCounts();
    const now = new Date();
    const items = [['WORKING', 'Working'], ['THINKING', 'Thinking'], ['WAITING', 'Waiting'], ['IDLE', 'Idle'], ...(OFFICE_STATE.fleet ? [] : [['HELD','Held']]), ['DONE', OFFICE_STATE.fleet ? 'Job runs today' : 'Done']];
    const g = OFFICE_STATE.approvals[0];
    if (!$('#mirrorBody')) {
      this._mirrorHtml = null;
      $('#mirror').innerHTML = `<button type="button" class="btn m-close" data-act="close">Close</button><div id="mirrorBody"></div>`;
      $('#mirror').onclick = e => e.target.closest('[data-act="close"]') && this.closeMirror();
    }
    const html = `
      <div class="m-wrap">
        <div class="m-head"><div><span class="wordmark">BEYDER<i>&amp;</i>CO. REALTY</span><div class="eyebrow sub">Agent Office · Main screen</div></div>
          <div class="m-time"><div class="tt tnum">${fmtTime(now)}</div><div class="eyebrow dd">${esc(fmtDate(now))} · Eastern · ${esc(FEED_LABEL[OFFICE_STATE.meta.feed] || 'Simulated feed')}</div></div></div>
        <div class="m-counts">${items.map(([k, l]) => `<div class="${k === 'WAITING' && c[k] ? 'hot' : ''}"><div class="n tnum">${c[k]}</div><div class="eyebrow l">${l}</div></div>`).join('')}</div>
        ${g ? `<div class="m-need"><span class="eyebrow needs">Needs you</span><span><b>${esc(OFFICE_STATE.agents[g.agentId].name)}</b> — ${esc(g.need)}${OFFICE_STATE.approvals.length > 1 ? ` <span class="g-meta">(+${OFFICE_STATE.approvals.length - 1} more)</span>` : ''}${briefHTML(g, 'line')}</span></div>` : '<div class="m-calm">No Follow Up Boss approval is currently listed. Review source status and job issues below.</div>'}
        <div class="m-cols">
          <section><h3 class="eyebrow">Running</h3><ul class="m-list">${OFFICE_STATE.running.length ? OFFICE_STATE.running.map(r => `<li><div class="a">${esc(r.name)}</div><div class="b">${esc(r.cadence)}</div></li>`).join('') : '<li>No job is currently running.</li>'}</ul></section>
          <section><h3 class="eyebrow">Issues</h3><ul class="m-list">${OFFICE_STATE.issues.map(i => `<li><div class="a">${esc(i.text)}</div><div class="b">${esc(OFFICE_STATE.agents[i.owner] ? OFFICE_STATE.agents[i.owner].name : '')}</div></li>`).join('')}</ul></section>
          <section><h3 class="eyebrow">Next scheduled jobs</h3><ul class="m-list">${nextItems(6).map(n => `<li><div class="date">${esc(n.when)}</div><div class="b">${esc(n.what)}</div></li>`).join('')}</ul></section>
        </div>
      </div>`;
    if (html !== this._mirrorHtml) {
      $('#mirrorBody').innerHTML = html;
      this._mirrorHtml = html;
    }
  },

  /* ---------- add an agent ---------- */
  openAdd() {
    if (deskAgents().length >= CAST_CAP) return this.toast('All ten desks are taken.');
    this.draft = { name: '', specialty: '', systems: '', engine: 'Display only', color: freeColors()[0], style: 'headset', instruction: '' };
    this.step = 0;
    $('#addModal').hidden = false;
    this.renderAdd();
    $('#addClose').onclick = () => this.closeAdd();
    $('#addBack').onclick = () => {
      this.readForm();
      this.step = Math.max(0, this.step - 1);
      this.renderAdd();
    };
    $('#addNext').onclick = () => this.nextAdd();
  },
  closeAdd() {
    $('#addModal').hidden = true;
    $('#moreSummary').focus();
  },
  readForm() {
    if (this.step !== 2) return;
    const d = this.draft;
    d.name = $('#fName').value;
    d.specialty = $('#fSpec').value;
    d.systems = $('#fSys').value;
    d.engine = $('#fEngine').value;
    d.color = $('#fColor').value;
    d.style = $('#fStyle').value;
    d.instruction = $('#fInstr').value;
  },
  nextAdd() {
    $('#addErr').textContent = '';
    if (this.step === 2) {
      this.readForm();
      if (!this.draft.name.trim()) return ($('#addErr').textContent = 'Give the agent a name.');
      if (!this.draft.specialty.trim()) return ($('#addErr').textContent = 'Add a specialty so the crew knows its job.');
    }
    if (this.step === 3) {
      const d = this.draft;
      const res = addAgent({ name: d.name, specialty: d.specialty, systems: d.systems.split(',').map(s => s.trim()), engine: d.engine, color: d.color, style: d.style, instruction: d.instruction.trim() });
      if (typeof res === 'string') return ($('#addErr').textContent = res);
      this.closeAdd();
      return;
    }
    this.step++;
    this.renderAdd();
  },
  renderAdd() {
    const d = this.draft;
    document.querySelectorAll('#addSteps li').forEach((li, i) => {
      li.classList.toggle('on', i === this.step);
      li.classList.toggle('past', i < this.step);
    });
    $('#addBack').disabled = this.step === 0;
    $('#addNext').textContent = this.step === 3 ? 'Bring aboard' : 'Next';
    const body = $('#addBody');
    if (this.step === 0) {
      body.innerHTML = `<p>Add a display agent to this office for this browser session. It does not create a worker, connect an AI service, or change a Studio job.</p>`;
    } else if (this.step === 1) {
      body.innerHTML = `<p>The Office reads the Studio’s sources and sends reviewed instructions to Crimson. Business jobs keep their owners and schedules. Crimson tracks new failures automatically; queued requests are not completed work.</p>`;
    } else if (this.step === 2) {
      const colors = freeColors().map(k => `<option value="${k}" ${k === d.color ? 'selected' : ''}>${esc(AGENT_COLORS[k].label)}</option>`).join('');
      const styles = Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${k === d.style ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
      const engines = ['Display only'].map(e => `<option ${e === d.engine ? 'selected' : ''}>${e}</option>`).join('');
      body.innerHTML = `<div class="form">
          <label for="fName">Name<input id="fName" maxlength="14" autocomplete="off" placeholder="CONCIERGE" value="${esc(d.name)}"></label>
          <label for="fSpec">Specialty<input id="fSpec" maxlength="40" autocomplete="off" placeholder="Client Relations" value="${esc(d.specialty)}"></label>
          <label for="fSys" class="full">Systems<input id="fSys" autocomplete="off" placeholder="Follow Up Boss, RealScout, Calendar" value="${esc(d.systems)}"></label>
          <label for="fEngine">Engine<select id="fEngine">${engines}</select></label>
          <label for="fColor">Colour<select id="fColor">${colors}</select></label>
          <label for="fStyle">Look<select id="fStyle">${styles}</select></label>
          <label for="fInstr" class="full">First reminder<textarea id="fInstr" placeholder="A local reminder for your review.">${esc(d.instruction)}</textarea></label>
        </div>`;
    } else {
      const mono = d.name.trim().toUpperCase().slice(0, 1) + d.name.trim().slice(1, 2).toLowerCase();
      const hex = colorsOf(d.color).main;
      body.innerHTML = `<div class="summary"><span class="tile" style="--c:${hex};--ct:${inkOn(hex)}">${esc(mono)}</span><div><div class="nm">${esc(d.name.trim().toUpperCase())}</div><div class="sp">${esc(d.specialty)} · ${esc(d.engine)} · ${esc(AGENT_COLORS[d.color].label)} · ${esc(STYLES[d.style].label)}</div></div></div>
        <p style="margin-top:14px">The lift doors open, the glass door slides, and ${esc(d.name.trim().toUpperCase())} walks in to ${this.freeDeskIsNew() ? 'a new desk set beside the crew' : `desk ${this.freeDesk() + 1}`}.</p>
        ${d.instruction.trim() ? `<p class="g-meta">First instruction: ${esc(d.instruction.trim())}</p>` : ''}`;
    }
    const first = body.querySelector('input, textarea, select, button');
    if (first && this.step === 2) first.focus();
  },
  freeDesk() {
    const taken = new Set(OFFICE_STATE.order.map(id => OFFICE_STATE.agents[id].slot));
    return [8, 9, 0, 1, 2, 3, 4, 5, 6, 7].find(s => !taken.has(s));
  },
  freeDeskIsNew() {
    return [8, 9].includes(this.freeDesk());
  },
  /* ---------- misc ---------- */
  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3600);
    while ($('#toasts').children.length > 3) $('#toasts').firstElementChild.remove();
  },
  fullscreen() {
    this.wakeLock();
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => this.toast('Full screen is not available here — use ⌃⌘F'));
      else this.toast('Full screen is not available here — use ⌃⌘F');
    } catch (e) {
      this.toast('Full screen is not available here — use ⌃⌘F');
    }
  },
  async wakeLock() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') this._lock = await navigator.wakeLock.request('screen');
    } catch (e) {
      /* the display may sleep; nothing else depends on it */
    }
  },
};
