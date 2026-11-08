# Agent Office 8.9 — the study, and fifteen improvements

Branch `office-v8-9-upgrade` · page 8.9.0 · bridge unchanged in version, extended in scope · 2026-11-08

## 1. What was inspected first

The TEST build (`python3 build.py --public office`) was run headless (Chromium + SwiftShader, 1200×750, `?maxdt=1.5`) and shot from every camera preset before anything changed; the same script re-shoots the same views after. Three workflows were walked: *see who needs me and respond*, *find an agent and read its card*, *move between the rooms (presets, ⌘K, deep links)*. The Studio copy (`~/work/bco-agent-office`) was confirmed identical to `origin/main` c9f7e82 before branching.

Facts from the baseline: 0 console errors, 4 requests (everything inlined), 870 geometries / 101 textures, ~1.34 M triangles in the overview, 21 s to ready under SwiftShader (CPU rendering; not a user number). Assumptions, kept separate: the Studio's live bridge state was not visible from the cloud container; it is covered by Audit 2 (Remote Control) below.

## 2. Design thesis

A penthouse floor in the firm's flagship-store language: white oak, white wool, paper white, ink-black screens, crimson only as punctuation. Light and material carry the luxury; nothing glows that would not glow in a real room. Three distances must each hold: the whole floor from the Hudson, a working distance over the desks, and close inspection of a desk or the entrance. Status is read from real sources and labelled as what it is (TEST, stale, unconfigured) — never dressed up.

## 3. The fifteen, ranked, with status

| # | Improvement | Status | Done when |
|---|---|---|---|
| 1 | **The study replaces the right-side lounge**: dark stone inlay, two standard stations facing the room, an oak console, a low glass screen with a way in at each end and a west return | implemented | Visible from `#study`, `#overview`, `#desks`; crew never enter; the left lounge is untouched |
| 2 | **Attaché and Bursar**, Igor's two personal assistants (inbox & calendar · bills, payments & renewals), in the crew rail under a *Personal* divider, with their own cards | implemented | Cards open without error; no "Ask Crimson" (they have no coordinator); scope stated |
| 3 | **Bridge personal runtime**: `config.json → personal_runtime {model, label_prefix, key_file}` shape-checked only (the key is never read), a `personal` feed with honest states, `com.igorbeyder.personal.*` jobs mapped to the pair, diagnostics | implemented | Three new tests; 167 pass; readiness ignores the personal feed |
| 4 | Cameras, nav graph, deep links and the view menu rewired for the study (`#study`, `#lounge` fixed) | implemented | Walkers leave the study through the glass gaps only |
| 5 | **Entrance**: the lift core clad in jointed graphite with a dark base instead of blank plaster | implemented | Door view no longer reads as a white box |
| 6 | **The tower below**: a faint curtain-wall grid after dark so the Hudson view shows a building, not a slab | implemented | Hudson screenshot before/after |
| 7 | **Keyboard camera + a11y**: the scene takes focus (role application), arrows orbit, ⇧arrows pan, +/− zoom, each view change announced via a live region | implemented | Headless key test changes `controls.goal`; live region text |
| 8 | **My view**: *More → Save view* / ⌘K *Save this view* keeps one camera of Igor's own in preferences; appears in the menu, ⌘K, opening-view choice; forgettable | implemented | Persists across reload; corrupt storage ignored |
| 9 | **Status at a glance** on the collapsed crew rail: a state dot on every tile (ink working, half-ink thinking, crimson waiting) | implemented | Visible in phone/tablet shots |
| 10 | **The mail tray** on the study console holds one sheet per queued personal task, nothing when empty (a memorable touch that is also honest) | implemented | Stack scales with `OFFICE_STATE.tasks` |
| 10b | **The study's board** (Igor's ask, 2026-11-08): a 3.4 m screen on a plinth behind the two desks showing open / done-today / needs-Igor counts, each assistant's work in progress and queued, the first gate that needs him, and the personal runtime's state (TEST until a runtime is connected). Click-to-focus and ⌘K *The study board* | implemented | Visible from `#study`; redraws on task, approval, agent and bridge events |
| 11 | Night-time interior light coherence | not done | Deferred: the sweeps found no defect worth the change this round |
| 12 | Measured performance pass | partial | Measured before/after (below); no reductions made beyond removing dead code |
| 13 | Honest state words for the study's pair (Reading… / Writing… rather than Coding…) and personal-card fix | implemented | Card renders; words match the role |
| 14 | Audit-driven fixes (from the sweeps and Audit 1): 19 confirmed findings, all fixed (§6) | implemented | 169 bridge tests pass; headless checks green |
| 15 | Regression checks for the new behaviour | partial | Bridge: 5 new tests (personal config, study mapping, honest feed states, fleet isolation, repair limit). Page: headless Playwright checks were run (keyboard, deep links, preferences, reduced motion, nav vs glass, 65 s wander, zero console errors) but are not committed as a test suite |

## 4. Measurements (headless SwiftShader; relative numbers only)

| | main c9f7e82 | this branch |
|---|---|---|
| Page size (TEST build) | 1,444,214 B | 1,459,000 B (approx.) |
| Draw calls · overview / desks / study | 867 / 790 / 870 | 866 / 869 / 319 |
| Triangles · overview | 1.83 M | 1.90 M |
| Geometries / textures / programs | 869 / 101 / 40 | 984 / 110 / 39 |
| Console errors | 0 | 0 |

The two extra stations and robots account for the added draw calls (~50 each); the glass screen adds 13 meshes. Frame rate is not meaningful under SwiftShader; the live build caps at 30 fps and adapts resolution as before.

## 5. Two sweeps

**Sweep A (design/realism/usefulness)** and **Sweep B (engineering)** were run as independent reviews with adversarial verification of every finding; confirmed findings and their fixes are listed in §6.

## 6. Audits

**Audit 1 — code paths** (real-time connectivity, bounded self-repair, honesty of states): see the findings table below.

**Audit 2 — the live Studio** (bridge at 127.0.0.1:4317, launchd job states, repair ledger): run over Remote Control, read-only, on 2026-11-08 (below).

### Sweep A — design (5 weakest points, all fixed)
1. The study camera was a steep overhead survey (void above, floor below, ticker cropped) → reframed from the front aisle at working height; fit box raised to the glass caps.
2. The corner kentia stood inside the study on the Bursar's chair; glass posts crossed both monitors → palm retired; two panes with the post in the gap between the desks; the floor line lengthened.
3. The TEST layout printed STALE in crimson twelve times → a sample is labelled TEST in grey; STALE is reserved for kept-but-expired live data.
4. The etched wordmark was white on a white vestibule → ink letters, crimson ampersand kept; the PH plate sits in a bezel.
5. The Bursar's bone paint vanished against the white desks → warm stone (#8f877a); roster tile contrast still ink-on-stone.

### Sweep B — engineering (all fixed)
- Added agents were listed under *Personal* (order.push) → inserted ahead of the study; digit shortcuts stay crew-first.
- A WAITING study agent turned in the wrong frame (STATION_YAW) → the station's own rotation.
- The personal card's *Runtime* row contradicted its runtime line → one source (the bridge's personal feed), with a *stale* wording.
- The study's failed jobs offered "Ask Crimson to repair", which the bridge rightly rejects → no control; the recovery step is shown instead (card and Workspace).
- Dead `furnitureSheet`, stale ambient comments, the vacuous assertions in the new test → removed / made real.

### Sweep C — the study's board (17 reviewers, 11 confirmed findings, all fixed)
- The board did not redraw on gate events (approve/decline, new personal gates) → dirtied on `approval` and `agent` as well.
- *Done today* counted every done row the pruner had not yet dropped → a per-agent daily counter in `stats` that survives pruning.
- A personal runtime in *attention* showed a green Live; *missing*/*error* notes were hidden; a dropped socket relabelled real data TEST → the header now says exactly what the bridge's personal feed says, and TEST means the simulator.
- The opaque board hid both assistants from `#overview` and `#desks` (the cameras look in through the south glass) → a transparent LED glass in a thin frame: read from the room, seen through from the floor.
- Click-to-focus from a south-side camera landed outside the building; square-on focus put the middle glass post across the centre → framed from the room side only, 0.2 rad off-axis.
- The plinth crossed the glass sill and the chairs rolled into it → two slim blades on pads outside the chairs' arc.

### Audit 1 — code paths (bridge)
Verified good: the page is pushed over a WebSocket (no polling); feed states are downgraded to *stale* on age or missing timestamps; automatic repair runs only on the installed Studio, baselines pre-existing failures, allows one handoff per failure episode and three open at once, and the study can never reach Crimson's command path (ROLE_CATALOG). Fixed:
- The personal feed never aged (threshold `None`) and survived a dead fleet tick as *ok* → 45 s threshold; a failed tick marks it *error* when configured.
- Personal jobs counted in the business fleet feed (degrading readiness) and linked to the business Command Center → business-only counts; no link; mirrored only when a personal runtime is configured.
- Every tick rebroadcast bridge meta twice → a quiet refresh when nothing but the timestamp changed.
- A flapping job could draw an unbounded stream of automatic repairs over a day → two per label per day, then *repair paused* is shown on the card (no repair loops, as Igor asked).

### Audit 2 — the live Studio (run 2026-11-08 ≈ 08:35 UTC, read-only; nothing changed, restarted or repaired)
**Live install:** bridge 1.6.0, page 8.8.1 (this branch is 8.9.0 and is not installed yet), up 2.6 days, `/` answers in 3 ms. Four feeds live (FUB 40 s old, RealScout, rates 12/12, hot sheet 16 rows); the hot sheet's `asOf` is 20 h old with no age limit, which the code-path audit did not flag. Readiness *degraded* for one reason: the fleet reports 3 failing jobs (Vercel fleet audit, skiptrace-scan, propertyviewed.tagger). Feed transitions all recovered; none in the last 31 h. FUB budget healthy: 596 calls/h, zero 429s, 742/750 left.

**launchd:** 21 jobs, every last exit 0; the Office bridge is KeepAlive and running. Eleven daily jobs show 0 runs since a reload around 23:50 ET on Nov 7 and have simply not reached their slot; their receipts show Nov 7 runs.

**Self-repair, as it really behaves:** 7 automatic handoffs in the ledger. 4 resolved by the source, 1 is *needs Igor* since Nov 4 (Vercel fleet audit: PRs beyderco-automation#229 and bco-monitoring-loop#21 await his pause/approval), and **2 have sat *queued* for ~52 h and ~7 h without ever being picked up by Crimson** (skiptrace-scan; property-viewed follow-up). The site-publishing audit raised and self-resolved three handoffs in three days (flappy). skiptrace-scan and njmls-matrix-intake fail with the same `ValueError` scrape error — one NJMLS collection problem, no writes made.

**What this branch does and does not fix:** the per-job daily repair cap (two, then *repair paused* on the card) covers the flappy publishing audit once installed. The stuck *queued* handoffs are a pickup problem between the bridge's command queue and Crimson's chat, outside this repo; the Office can only show it. Recommended follow-up (separate thread): surface *queued for > N h* as an attention state on the card, and age the hot sheet.

**Audit 1 vs Audit 2:** no contradiction. Everything Audit 1 verified as good (push over WebSocket, honest downgrades, bounded repair, no study path to Crimson) holds in the live logs; the two things Audit 1 could not see — the stalled pickup and the unaged hot sheet — are recorded above.

## 7. Limitations, stated plainly

- No model runs in the office. The personal assistants are stations and a runtime *configuration*; connecting a runtime (Meta Muse Wonder or any other) needs a key on the Studio and jobs under `com.igorbeyder.personal.*`. Until then their cards say so.
- Automatic repair remains a reviewed handoff to Crimson with bounded attempts; the office never repairs anything itself.
- Headless numbers are CPU-rendered; they compare builds, not user experience.

## 8. How to open

`python3 build.py --public office && (cd dist/public && python3 -m http.server 4399)` → http://127.0.0.1:4399/#study. On the Studio the bridge serves the live build at 127.0.0.1:4317 after the usual installer.
