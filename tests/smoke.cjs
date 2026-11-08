#!/usr/bin/env node
/* Headless regression checks for the Agent Office page (TEST build).
 *
 *   python3 build.py --public office
 *   node tests/smoke.cjs                # needs Playwright with Chromium (NODE_PATH to a global install is fine)
 *
 * Software rendering (SwiftShader) is slow: the whole run takes a few minutes. It checks behaviour, not looks:
 * boot without console errors or failed requests, every camera view, opening and closing an agent with the camera
 * returned, the address bar following what is open, deep links, the keyboard list, the line-of-sight tunnel, the
 * terrace and the river traffic, reduced motion holding the river still, and the phone layout's crew strip.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist', 'public');
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('Build first: python3 build.py --public office'); process.exit(2); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, path.normalize(p));
  if (!f.startsWith(DIST)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) failures++; };

async function open(browser, url, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1200, height: 750 }, reducedMotion: opts.reducedMotion || 'no-preference' });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
  page.on('request', r => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  return { page, errors, requests };
}

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/?maxdt=1.5`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // 1 · boot, views, selection, address bar
    const { page, errors, requests } = await open(browser, base + '&time=14:00');
    check(requests.length <= 6, `boot makes ${requests.length} requests (everything inlined)`);
    for (const v of ['overview', 'hudson', 'desks', 'boardroom', 'datawall', 'door', 'study', 'lounge', 'hotlist', 'screen', 'server']) {
      await page.evaluate(v => window.__office.UI.view(v), v);
      await page.waitForTimeout(400);
    }
    check(await page.evaluate(() => location.hash === '#server'), 'the address bar follows the view');
    await page.evaluate(() => window.__office.UI.view('desks'));
    await page.waitForTimeout(2500);
    const before = await page.evaluate(() => window.__office.controls.goal.r);
    await page.evaluate(() => window.__office.UI.select('crimson'));
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => location.hash === '#agent/crimson' && !document.getElementById('panel').hidden), 'opening an agent shows its card and #agent/crimson');
    check(await page.evaluate(() => XRAY.u.uCutR.value > 0.5), 'the line-of-sight tunnel opens for the selected agent');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__office.controls.glide, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ r: window.__office.controls.goal.r, hash: location.hash, panel: document.getElementById('panel').hidden, cut: XRAY.u.uCutR.value }));
    check(Math.abs(after.r - before) < 0.05 && after.hash === '#desks' && after.panel, 'Esc closes the card, returns the camera and the address');
    check(after.cut === 0, 'the tunnel closes with the card');
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => document.getElementById('keysDialog')?.open === true), '? opens the keyboard list');
    await page.keyboard.press('Escape');
    // 2 · the exterior
    const ext = await page.evaluate(async () => {
      const t0 = SKY.common.uTime.value, p0 = CITY.BOATS.mesh.instanceMatrix.array[12], f0 = OFFICE_RUNTIME.frames;
      for (let i = 0; i < 120 && OFFICE_RUNTIME.frames < f0 + 4; i++) await new Promise(r => setTimeout(r, 500)); // software rendering: wait for real frames
      return { terrace: !!TERRACE.group && TERRACE.grass.count > 100, boats: CITY.BOATS.list.length, moved: CITY.BOATS.mesh.instanceMatrix.array[12] !== p0 && SKY.common.uTime.value > t0 };
    });
    check(ext.terrace, 'the roof terrace is built with its planting');
    check(ext.boats >= 3 && ext.moved, 'vessels run the river');
    check(errors.length === 0, `no console errors or failed requests${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();

    // 3 · deep link to an agent
    const deep = await open(browser, base + '#agent/analyst');
    await deep.page.waitForTimeout(1500);
    check(await deep.page.evaluate(() => window.__office.UI.selected === 'analyst'), '#agent/analyst opens the Analyst on load');
    await deep.page.close();

    // 4 · reduced motion: the river holds still
    const rm = await open(browser, base, { reducedMotion: 'reduce' });
    const still = await rm.page.evaluate(async () => { const a = CITY.BOATS.mesh.instanceMatrix.array[12]; await new Promise(r => setTimeout(r, 2000)); return CITY.BOATS.mesh.instanceMatrix.array[12] === a; });
    check(still, 'reduced motion holds the vessels still');
    await rm.page.close();

    // 5 · phone: the crew rail is a strip along the bottom and the room keeps the full width
    const ph = await open(browser, base, { viewport: { width: 390, height: 844 } });
    const strip = await ph.page.evaluate(() => { const r = document.getElementById('roster').getBoundingClientRect(); return { w: r.width, bottom: innerHeight - r.bottom, ox: window.__office.controls.viewOffsetX }; });
    check(strip.w > 300 && strip.bottom < 80 && Math.abs(strip.ox) < 1, 'phone: the crew strip runs along the bottom, the room is centred');
    await ph.page.close();
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await browser.close();
    server.close();
    console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
    process.exit(failures ? 1 : 0);
  }
});
