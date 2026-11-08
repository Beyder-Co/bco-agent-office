# Agent Office 9.0 — two rounds of fifteen

Branch `office-v9-0-upgrade` (from `office-v8-9-upgrade`, PR #1) · page 9.0.0 · bridge 1.7.0 · 2026-11-08

Igor asked for three things in one thread: the next fifteen most important improvements, as much believable detail as possible in the landscape around the building, and then fifteen more that make the office more useful, more precise and more alive, with transitions and moving elements but no fluff. They are recorded here as two rounds. Each round had its own inspection, measurements and two sweeps.

How it was checked: the TEST build (`python3 build.py --public office`) was run headless (Chromium with SwiftShader, 1200×750, `?maxdt=1.5`). It was shot from every camera before and after, at night and at 14:00. SwiftShader is CPU rendering, so its times only compare runs with each other; they are not numbers a user would see. The live Studio audit (bridge 1.6.0, page 8.8.1, relayed by the coordinator) supplied three honesty defects, which round two fixes.

---

## Round two

### Thesis

The office already reads well from the desks. It is weakest at its edges: the black void around the floor at night, a city with nothing moving in it, an agent's card that hides the agent it opened, and status words that sound live when the data is not. Round two fills the edges with real-world detail that earns its place (a planted terrace, working river traffic, a lit forecourt). It makes the selected agent always visible. It also makes three statuses from the live audit say exactly what they are.

### The fifteen

| # | Improvement | Done when (tested) |
|---|---|---|
| 1 | **Roof terrace** round the glass box: pale pavers on 60 cm modules, stone coping, a frameless glass balustrade with a steel cap, and charcoal troughs of fountain grass and clipped box. The grass turns from green to November straw by date. Two weathered-teak lounge chairs and a stone table sit on the east terrace, where the planting breaks. At night the room's light spills onto the deck and fades with distance, and a low warm wash lights the planters. | The Hudson and Overview views show the terrace day and night; the city's tower block now matches the terrace footprint. |
| 2 | **River traffic**: two tugs pushing barges (one down the river, one up), an excursion boat, and a yacht by day only. There are no sailboats, since it is November. Each vessel has a Kelvin wake, and at night shows a masthead light, red to port and green to starboard, plus towing lights. | Vessel positions advance between frames; under reduced motion they hold still (smoke test). |
| 3 | **Forecourt and cliff walk**: a ring of 18 street trees and 14 lamps round the drive, parked cars, and lamps every 22 m along the cliff walk. | Visible from Hudson and Overview at night. |
| 4 | **Line of sight to the opened agent**: a narrow cone from the camera to the agent clears the walls, the markets band and other desks with a screen-door dissolve. The robots themselves are never dissolved. It opens and closes over a third of a second and costs nothing when nothing is selected. | Opening Crimson shows Crimson rather than the BOND MARKET band; the radius is 0 after Esc (smoke test). |
| 5 | **Stalled handoffs** (live audit: two automatic repairs queued for 52 h and 7 h, never picked up): the bridge flags any handoff queued for more than 2 h. Crimson's history lists those first, in crimson: *Not picked up · queued N h, not yet received by Crimson*. A single "Crimson hasn't picked up N handoffs" item goes into Needs you. Nothing is resent automatically. | `test_stalled_handoffs_are_reported_never_resent`. |
| 6 | **One cause, one item** (live audit: skiptrace-scan and the NJMLS Matrix intake failed with the same scrape error): failures whose summaries match once numbers are folded out become a single need that names every affected job. | `test_same_error_is_one_need`. |
| 7 | **Hot-sheet age in words** (live audit: shown as live while the pull was 20 h old): a scheduled pull still inside its schedule stays live, but now says *Scheduled pull · published … · next …* once it is more than 6 h old. | `test_a_day_old_scheduled_pull_says_its_age`. |
| 8 | **Phone layout**: at ≤620 px the collapsed crew rail becomes a strip along the bottom, so the room uses the full width. | The strip spans the bottom and the camera offset is 0 (smoke test). |
| 9 | **Name labels declutter**: a label that still overlaps another after the existing nudges shrinks to its dot until there is room again. It never shrinks while waiting, selected or under the pointer. Labels hide while a screen is up close. | Overview shots: no overlapping names. |
| 10 | **Pointer labels for working objects**: screens, the ticker, the server and the ampersand say what a click opens. | Hovering a screen shows *Open · …*. |
| 11 | **Deep links and an honest address bar**: `#agent/<id>` and `#screen/<key>` open on load, and the hash follows the open view or agent (replaceState, no history noise). | `#agent/analyst` opens the Analyst on load. This was found broken during the round: the boot views rewrote the hash before it was read. Fixed, and covered by the smoke test. |
| 12 | **Keyboard list**: `?`, More → Keyboard, and ⌘K → Keyboard shortcuts. | `?` opens the dialog (smoke test). |
| 13 | **Tests**: a committed headless smoke test (`tests/smoke.cjs`), and the time-of-day flaky bridge test made deterministic. | 172 bridge tests pass at any hour; the smoke test is green. |
| 14 | **Exterior performance budget**: the whole exterior stays within ~3% more draw calls; boats, wakes and lights are instanced or points. | See measurements. |
| 15 | **Sweep fixes** (below). | All listed fixes in place. |

### Measurements (SwiftShader, night, same script)

| | before (8.9 branch) | after round two |
|---|---|---|
| Draw calls · desks / overview / hudson | 890 / 986 / 984 | 915 / 913 / 1017 |
| Triangles · desks / overview | 1.86 M / 1.90 M | 1.83 M / 1.82 M |
| Geometries / textures / programs | 984 / 111 / 39 | 1006 / 109 / 52 |
| Requests at boot · console errors | 4 · 0 | 4 · 0 |

The 13 extra shader programs are line-of-sight variants of existing materials, compiled once at boot. The after-run shared the CPU with a second capture, so its time to ready (29.9 s against 21.0 s) is not comparable. The serial run in round three is.

### Sweep A — design, realism, usefulness (the five weakest points, all fixed)
1. The grass looked sparse and spiky. It now has more blades with an arching habit, in two staggered rows, in a warmer straw.
2. The troughs read as flat boxes. They now have a lip and a recessed plinth.
3. The teak chairs faced into grass. The east planting now breaks at the seating zone, and the teak is darker and grained.
4. At night the terrace was lit like day by the interior lights. Room spill now falls off with distance, and the warm wash sits only at the planters.
5. The line-of-sight cut left stippled edges across the frame. It is now a cone that is wide near the camera and narrow at the agent, with a short dissolve band.

### Sweep B — engineering (all fixed)
1. Shrunk labels never showed, because `renderBubble` overwrote the class. The class now carries `crowd`.
2. `#agent/` deep links were lost on load, because the boot views rewrote the hash first. The hash is now read at the start of boot.
3. A bridge test failed at night: its expiry step was shorter than the night limit. It now steps past both limits.
4. The smoke test's movement checks could sample zero frames under software rendering. They now wait for real frames.
5. The Esc check compared an exact camera radius mid-glide. It now waits for the glide to end.

---

## Round three

### Thesis

Make the office tell Igor what changed, and take him to it in one key. Every transition here reports a real change: a state, an arrival, a decision, a count. Every moving element exists in the real place: helicopters on the Hudson corridor, jets for Teterboro. Nothing loops for its own sake. Everything respects reduced motion, and TEST data says so.

### The fifteen

| # | Improvement | Done when (tested) |
|---|---|---|
| 1 | **Go through what needs you** (`A`, the Waiting count, or ⌘K): steps through every open decision, then every fix only Igor can make, then the Needs-you list. Each one opens with the camera on the agent and the decision expanded in its card. A chip shows *2 of 5 · Decision · …*, with Next and close. | `A` opens the first item, and the chip names it with its place (smoke test). |
| 2 | **Next and previous agent**: `]` and `[`, plus ‹ › in the card header. The new card settles in place, and the address follows. | `]` opens the next agent in crew order, `#agent/<id>` (smoke test). |
| 3 | **While you were away**: after 10 minutes hidden or untouched, the first touch shows what the office recorded meanwhile: tasks finished and by whom, new decisions (with *Go through them*), problems reported, and the latest log lines (each opens its agent). It claims nothing from before the page opened, and says *TEST · simulated office* when the data is simulated. | A check that reaches back before the page opened shows nothing (smoke test). |
| 4 | **Arced camera moves**: zoom eases in equal ratios. Long moves rise a little and take a little longer, and short ones stay low and quick. | The Esc round trip lands on the same radius (smoke test). |
| 5 | **Card transitions**: the card slides in, steps aside over 0.22 s on close (the room reclaims the space at once), and crossfades when switching agents. | Visible; `#panel.leaving`/`.swap`. |
| 6 | **State transitions**: when an agent's state changes, its label rings once in the new colour and its dot pops. The crew-list row's state word slides in. | Only on a change, never on first render. |
| 7 | **Rolling counts**: the top-bar numbers roll up or down to a new value. | Only when the value changes. |
| 8 | **Floor ripples**: one crimson ring runs across the floor when an agent starts waiting on Igor, and one ink ring when it finishes a task. Eight pooled rings, nothing drawn at rest. | A new decision starts a ripple (smoke test). |
| 9 | **Copy link** to exactly what is open (`L`, the card's link button, ⌘K). If the clipboard is unavailable it says so. | Toast confirms. |
| 10 | **Screens in the address bar**: `#screen/today` while a screen or list is open; closing it returns the address to the view or agent beneath. | Smoke test. |
| 11 | **The air over the river**: a sightseeing helicopter loops the corridor every four minutes (beacon, strobe, navigation lights, turning rotor). Three jets cross in the distance (landing light and beacon) as shader-only traffic with no CPU cost. | Helicopter pose advances (smoke test); close-up shot. |
| 12 | **Toasts that lead somewhere**: an arrival or a second decision carries **Show**, which opens that agent. Toasts rise in, leave to the side, and stay while the pointer is on them. | Toast renders with a Show button. |
| 13 | **The crew list points into the room**: hovering a row lights that robot and its label. | Visible. |
| 14 | **⌘K finds every decision and fix by its own words**: type a client's name or a job's name and go straight to it. | Entries under *Needs you*. |
| 15 | **Version and tests**: page 9.0.0, bridge 1.7.0 (bumped together, so the Studio reload check matches). The smoke test grows from 13 to 20 checks. | Bridge 172 pass; smoke 20 of 20. |

### Measurements

| | before (8.9 branch) | after round two | after round three |
|---|---|---|---|
| Draw calls · desks / overview / hudson | 890 / 986 / 984 | 915 / 913 / 1017 | 921 / 1019 / 1017 |
| Triangles · desks / overview | 1.86 M / 1.90 M | 1.83 M / 1.82 M | 1.83 M / 1.87 M |
| Geometries / textures / programs | 984 / 111 / 39 | 1006 / 109 / 52 | 1010 / 110 / 52 |
| Time to ready (serial run, SwiftShader) | 21.0 s | not comparable | 26.4 s |
| Requests at boot · console errors | 4 · 0 | 4 · 0 | 4 · 0 |

Round three adds 6 draw calls at the desks: the helicopter (one instanced mesh plus its lights). Floor ripples draw only while running. The jets are points inside the existing city light buffer. Time to ready is up about 5 s on CPU rendering, from the terrace, boats and extra shader variants compiled at boot. On the Studio's GPU this is shader compilation, not frame cost.

### Sweep A — design, realism, usefulness (five weakest points, all fixed)
1. The helicopter first flew 100 m above the roof, out of frame in every view. It now flies at roof height, as the corridor's tours do relative to a cliff-top tower.
2. The walk-through chip's source label carried the whole TEST note. It is now *Follow Up Boss (TEST)*.
3. The away card could summarise time before the page existed (*Since 3:46 AM · 60 min* on a page a minute old). It is now clamped to the page's start.
4. The counts faded from fully transparent, so on a slow frame a number vanished for a moment. They now start at 30% opacity.
5. Two `slideIn` keyframes competed. One remains, with opacity.

### Sweep B — engineering (all fixed)
1. Closing the card used to leave the room's framing offset until the card was hidden. Insets now treat a leaving card as closed, so the camera recentres at once.
2. Switching agents mid-close could hide the new card. The close timer is cleared on select and checks `selected` before hiding.
3. The walk-through stays correct when a decision is answered elsewhere: it keeps its place by key, and ends when the item is no longer open.
4. In the smoke test, a page-only global was referenced in Node. Fixed.
5. The page and bridge versions are bumped together, so the bridge's reload check cannot loop.

---

## Limitations, stated plainly

- Nothing was deployed. The Studio picks this up through its normal installer run after merge.
- The live Studio was not re-audited after these changes. The three live-audit defects are fixed in code and covered by tests, but not yet observed on the Studio.
- The helicopter and jets are believable traffic, not live ADS-B data, and the vessels are not AIS. Both are scenery and are never presented as information.
- The away card reports what this page saw. A page opened after the events cannot report them; the Studio's own receipts remain the record.
- SwiftShader times are relative. On the Studio the page caps at 30 fps (18 at night) and adapts resolution as before.

## How to run

```
python3 build.py --public office
node tests/smoke.cjs            # Playwright with Chromium; NODE_PATH to a global install is fine
python3 -B -m unittest discover -s bridge -p 'test_*.py'
```
