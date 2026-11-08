/* =============================================================================
   94 · ATTENTION — what needs Igor, in turn; what happened while he was away;
   the crew list and the room pointing at the same robot
   -----------------------------------------------------------------------------
   Everything here reads the office's own state: open decisions (gates), the
   Studio's "fix" items, the agents' logs and the task board. Nothing is
   summarised that the office did not record, and TEST data says so.
   ============================================================================= */

const ATTENTION = {
  i: -1,
  list: [],
  /** Every open decision, then every fix only Igor can make, then the full Needs-you list if it has more. */
  items() {
    const S = OFFICE_STATE, out = [];
    for (const g of S.approvals) if (S.agents[g.agentId]) out.push({ key: 'g:' + g.id, agent: g.agentId, title: g.need || g.title || 'A decision', kind: g.simulated ? 'Decision (TEST)' : 'Decision' });
    const N = S.panels && S.panels.needs;
    const items = N && N.status !== 'awaiting' && Array.isArray(N.items) ? N.items : [];
    for (const it of items) if (it && (it.group === 'system' || String(it.id || '').startsWith('sys-')) && it.agent && S.agents[it.agent])
      out.push({ key: 'n:' + it.id, agent: it.agent, title: it.title || 'A fix', kind: 'Fix' });
    const rest = items.filter(it => !(it && it.agent && S.agents[it.agent] && (it.group === 'system' || String(it.id || '').startsWith('sys-'))));
    if (rest.length) out.push({ key: 'list', screen: 'today', title: `The Needs-you list · ${N.total || items.length} item${(N.total || items.length) === 1 ? '' : 's'}`, kind: N.status === 'live' ? 'Follow Up Boss' : /TEST/.test(N.note || '') ? 'Follow Up Boss (TEST)' : 'Follow Up Boss · ' + N.status });
    return out;
  },
  start() {
    this.list = this.items();
    this.i = -1;
    if (!this.list.length) { this.chip(null); UI.toast('Nothing needs you right now'); return; }
    this.next();
  },
  /** A, the Waiting count, ⌘K: the next item, wrapping to the first. */
  next() {
    const fresh = this.items();
    // the list may have changed since the last step (a decision answered elsewhere): keep the place by key
    const at = this.list[this.i] ? fresh.findIndex(x => x.key === this.list[this.i].key) : -1;
    this.list = fresh;
    if (!fresh.length) { this.chip(null); UI.toast('Nothing needs you right now'); return; }
    this.go(at < 0 ? (this.i < 0 ? 0 : Math.min(this.i, fresh.length - 1)) : (at + 1) % fresh.length, true);
  },
  go(i, kept) {
    if (!kept) this.list = this.items();
    const it = this.list[i];
    if (!it) return;
    this.i = i;
    if (it.screen) UI.openScreen(it.screen);
    else {
      UI.select(it.agent);
      const g = it.key.startsWith('g:') && OFFICE_STATE.approvals.find(x => 'g:' + x.id === it.key);
      if (g) { UI.needOpen = g.id; UI.renderPanel(); } // the decision itself, opened in the card
    }
    this.chip(it);
  },
  chip(it) {
    let el = document.getElementById('tourChip');
    if (!it) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'tourChip';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="tc-n"></span><span class="tc-t"></span><button type="button" class="tc-next">Next <kbd>A</kbd></button><button type="button" class="tc-x" aria-label="Stop going through">×</button>';
      el.querySelector('.tc-next').onclick = () => this.next();
      el.querySelector('.tc-x').onclick = () => this.stop();
      document.body.appendChild(el);
    }
    el.querySelector('.tc-n').textContent = `${this.i + 1} of ${this.list.length}`;
    el.querySelector('.tc-t').textContent = `${it.kind} · ${it.title}`;
    el.querySelector('.tc-next').hidden = this.list.length < 2;
    el.hidden = false;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  },
  stop() { this.i = -1; this.chip(null); },
};
// the chip leaves with the card (Esc, a click in the room, another view) and when the list empties
BUS.on('approval', () => { if (ATTENTION.i >= 0 && !ATTENTION.items().length) ATTENTION.stop(); });
setInterval(() => {
  const el = document.getElementById('tourChip');
  if (!el || el.hidden || ATTENTION.i < 0) return;
  const it = ATTENTION.list[ATTENTION.i];
  const still = it && (it.screen ? !$('#mirror').hidden || UI._focus : UI.selected === it.agent);
  if (!still) ATTENTION.stop();
}, 400);

/* ---------- while you were away ----------------------------------------------------------------------------------
   After ten minutes with the tab hidden or nobody at the screen, the first touch brings a short account of what the
   office recorded meanwhile: tasks finished, decisions that arrived, problems reported, the latest log lines. */
const AWAY = {
  AFTER: 10 * 60e3,
  since: Date.now(),
  shown: false,
  mark() { this.since = Date.now(); },
  bootAt: Date.now(),
  check(from) {
    from = Math.max(from, this.bootAt); // only what this page saw: nothing is claimed for before it opened
    const gone = Date.now() - from;
    if (gone < this.AFTER || !UI._booted) return;
    const d = this.digest(from);
    if (d) this.show(d, from);
  },
  digest(from) {
    const S = OFFICE_STATE, name = id => (S.agents[id] ? S.agents[id].name.charAt(0) + S.agents[id].name.slice(1).toLowerCase() : id);
    const done = S.tasks.filter(t => t.column === 'done' && !t.record && t.at > from);
    const gates = S.approvals.filter(g => g.at > from);
    const lines = [];
    for (const id of S.order) for (const l of S.agents[id].log) if (l.t > from) lines.push({ id, ...l });
    lines.sort((a, b) => b.t - a.t);
    const trouble = lines.filter(l => l.kind === 'stuck' || /fail|error|problem/i.test(l.text));
    if (!done.length && !gates.length && !lines.length) return null;
    const by = {};
    done.forEach(t => (by[t.agentId] = (by[t.agentId] || 0) + 1));
    const who = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${name(id)}${n > 1 ? ' ' + n : ''}`).join(', ');
    return {
      test: S.meta.feed !== 'live',
      rows: [
        done.length ? [`${done.length} task${done.length === 1 ? '' : 's'} finished`, who] : null,
        gates.length ? [`${gates.length} new decision${gates.length === 1 ? '' : 's'} for you`, gates.slice(0, 2).map(g => `${name(g.agentId)} · ${g.need}`).join(' / '), 'attention'] : null,
        trouble.length ? [`${trouble.length} problem${trouble.length === 1 ? '' : 's'} reported`, `${name(trouble[0].id)} · ${trouble[0].text}`] : null,
      ].filter(Boolean),
      recent: lines.slice(0, 4).map(l => ({ id: l.id, who: name(l.id), text: l.text, t: l.t })),
    };
  },
  show(d, from) {
    let el = document.getElementById('awayCard');
    if (!el) {
      el = document.createElement('section');
      el.id = 'awayCard';
      el.setAttribute('aria-labelledby', 'awayTitle');
      document.body.appendChild(el);
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-away]');
        if (!b) return;
        if (b.dataset.away === 'close') this.hide();
        else if (b.dataset.away === 'attention') { this.hide(); ATTENTION.start(); }
        else if (OFFICE_STATE.agents[b.dataset.away]) { this.hide(); UI.select(b.dataset.away); }
      });
    }
    const mins = Math.round((Date.now() - from) / 60000);
    const span = mins >= 90 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
    el.innerHTML = `<header><p class="eyebrow">${d.test ? 'TEST · simulated office' : 'Recorded by the office'}</p><h2 id="awayTitle">While you were away</h2><p class="aw-span">Since ${esc(fmtTime(new Date(from)))} · ${span}</p>
        <button type="button" class="closeX" data-away="close" aria-label="Close">${ICON_PATH('M2 2l10 10M12 2 2 12')}</button></header>
      ${d.rows.map(([h, sub, act]) => `<div class="aw-row${act ? ' hot' : ''}"><b>${esc(h)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}${act ? '<button type="button" class="btn ink" data-away="attention">Go through them</button>' : ''}</div>`).join('')}
      ${d.recent.length ? `<ol class="aw-log">${d.recent.map(r => `<li><button type="button" data-away="${esc(r.id)}"><time>${esc(fmtTime(new Date(r.t)))}</time> <b>${esc(r.who)}</b> ${esc(r.text)}</button></li>`).join('')}</ol>` : ''}`;
    el.hidden = false;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.hide(), 90e3);
  },
  hide() {
    const el = document.getElementById('awayCard');
    if (!el || el.hidden) return;
    clearTimeout(this._t);
    if (REDUCED_MOTION) { el.hidden = true; return; }
    el.classList.add('out');
    setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 240);
  },
};
(() => {
  let hiddenAt = null, lastTouch = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt) { const from = Math.min(hiddenAt, lastTouch); hiddenAt = null; AWAY.check(from); lastTouch = Date.now(); }
  });
  const touch = () => {
    const now = Date.now();
    if (now - lastTouch > AWAY.AFTER && document.visibilityState === 'visible') AWAY.check(lastTouch);
    lastTouch = now;
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, touch, { passive: true, capture: true }));
  AWAY.debugFrom = from => { const b = AWAY.bootAt; AWAY.bootAt = 0; AWAY.check(from); AWAY.bootAt = b; }; // tests only
})();

/* ---------- the crew list and the room point at the same robot ------------------------------------------------------ */
(() => {
  const list = document.getElementById('rosterList');
  if (!list) return;
  let over = null;
  list.addEventListener('pointerover', e => {
    const row = e.target.closest('.row');
    const id = row && row.dataset.id;
    if (id === over) return;
    if (over && WORLD.byId[over]) { WORLD.byId[over].fig.hoverOn(false); UI.bubbles[over]?.el.classList.remove('hov'); }
    over = id || null;
    if (over && WORLD.byId[over]) { WORLD.byId[over].fig.hoverOn(true); UI.bubbles[over]?.el.classList.add('hov'); }
  });
  list.addEventListener('pointerleave', () => {
    if (over && WORLD.byId[over]) { WORLD.byId[over].fig.hoverOn(false); if (UI.hoverId !== over) UI.bubbles[over]?.el.classList.remove('hov'); }
    over = null;
  });
})();
