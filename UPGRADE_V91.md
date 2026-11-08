# Agent Office 9.1 — the landscape to the horizon

Branch `office-exterior-detail` (from `main` after PRs #1 and #2 merged) · page 9.1.0 · bridge 1.7.1 · 2026-11-08

Igor asked for substantially more exterior detail on top of 9.0's terrace, river traffic and forecourt, and, mid-round, for two interior fixes: the study's glass screens as single panes, and every screen made transparent LED glass like the study's board. This round finishes the world beyond the modelled nine kilometres — out to the real horizon — and fills in the shoreline, the sky and the air in between. Everything is a real place or a real thing on this reach of the Hudson; nothing loops for its own sake.

## What was added

### The far horizon (`56_landscape.js`, one draw call)
A camera-centred ring at the far plane carries the land's true skyline, sampled by real azimuth and distance from Fort Lee, with real heights, the earth's curve (with normal refraction) and 20–60 km of air:

- **New Jersey west and north-west**: the First and Second Watchung ridges (Garret Mountain past Eagle Rock toward Plainfield), High Mountain's Preakness range, and the Ramapos.
- **Up the Hudson**: Hook Mountain and High Tor, then the Hudson Highlands — Bear Mountain, Dunderberg, Storm King, Breakneck Ridge, Mount Beacon.
- **East and south**: Westchester's hills, Long Island's Harbor Hill moraine, Staten Island's Todt Hill, and the **Verrazzano-Narrows Bridge** — towers, deck and cables to scale in the gap of the Narrows, with its necklace lit after dark. Through that one gap the horizon is the open sea's.
- After dark the far hills prick with the lights of their towns (points carry farther through haze than surfaces, and the shader says so); by day the ridges sit faint and blue over the rolling tree line of Bergen and Passaic.

### Birds, by day (one draw call, instanced, wings flap in the vertex shader)
- **Herring gulls** work the river and ride the Palisades' updraft — slow circles with a bob, wings crooked when they glide, a few beats now and then.
- **Canada geese**, October to December only: two skeins in V formation high over the river, heading down the Hudson flyway.
- Gone after dusk; still under reduced motion (positions are a pure function of the sky's clock).

### The shoreline
- **Riprap** against both banks up to a few metres above the water, its lower band dark and wet — the Hudson is tidal here — with a wrack line where the tide turns.
- **Water**: silt brightens the shallows along the banks; a fringe of foam breaks on the stone and laps outward; the glitter path of the **moon** joins the sun's on the water.

### The sky
- **Fair-weather cumulus** on a low deck seen in perspective down to the horizon, lit tops toward the sun, grey bases away from it; a combed band of **cirrus** that catches the dusk. How much sky they cover changes from day to day (keyed to the date — scenery, not a forecast). Far off, where a cloud would shimmer below a pixel, the deck averages to its cover.
- **The moon at its real position and phase** for the hour (same low-precision ephemeris as SunCalc, good to a fraction of a degree): the terminator falls where it really does, earthshine on the dark side, a halo and a glitter path after dark, hidden where cloud crosses it. A `?time=` preview moves it with the sun.

### Fort Lee after dark
- **Traffic on the through streets**: headlight and tail-light pairs run the town's grid on seven real alignments, clipped to the blocks that are actually town (never the woods, the parkway's own lanes, the cliff or the forecourt). They reuse the city's existing light-point draw call.

### The interior asks (Igor, mid-round)
- **The study's glass**: each of the two runs is now a single pane — the middle posts are gone; a post only where a run starts and ends.
- **Every screen is transparent LED glass** in an open frame, as the study's board: the Forum screen floats its live feed over the bridge, the data wall shows the town through "Needs you", the hot list hangs in the south glass. The solid slab bezels became open picture frames (one mesh each, so picking and the focus glow are unchanged); the markets band keeps its solid strip, which carries the focus view's backing.

## Honesty
- The ridges, the Verrazzano, the flyway geese, the tides and the moon are real things in real places; their heights, distances, azimuths, seasons and phases are taken from real coordinates and real ephemerides, not invented.
- Cloud cover is explicitly scenery keyed to the date. Nothing claims to be weather data.
- No business data is touched; the bridge stays read-only toward FUB/RealScout. Versions: page 9.1.0, bridge 1.7.1, bumped together as the reload rule requires.

## How it was checked
Same harness as 9.0: the TEST build (`python3 build.py --public office`) headless in Chromium with SwiftShader, 1200×750, `?maxdt=1.5`, shot from six fixed exterior viewpoints (the Hudson preset plus five orbit stations at the camera's limits) at 14:00, 16:35 and 22:00, before and after, plus interior views (study, desks, data wall, Forum screen) day and night.

### Measurements (SwiftShader, same script, before → after)

| | 16:35 | 22:00 |
|---|---|---|
| Draw calls, worst viewpoint | 1023 → 1023 | 1020 → 1021 |
| Draw calls, typical delta | +3 … +5 | −2 … +4 |
| Triangles (orbit views) | 1.87 M → 1.90 M (+1.6%) | 1.87 M → 1.90 M |
| Console errors / failed requests | 0 / 0 | 0 / 0 |

The horizon ring, all its ridges and the Verrazzano are one mesh (one call); the birds are one instanced mesh (one call); street traffic rides the existing light points (zero calls); clouds, moon, shoreline and water changes are shader work in existing passes.

### Tests
- `tests/smoke.cjs`: all 20 checks pass. One check was made robust rather than weakened: the line-of-sight assertion now waits for the frames that ease the tunnel open instead of a fixed 2.5 s, because the first select after this round compiles six more tunnel shader variants (the screens' new glass materials), which stalls software rendering past the old window. The assertion itself is unchanged.
- Bridge: 172 tests pass (`python3 -m unittest discover`), including the version-string test updated to 1.7.1.

## Sweep notes
- Night before/after shots were compared pixel-wise at all six stations: the only intended differences are the new horizon lights, traffic, moon and screen glass. A pale floating quad near the far shore in the west night view predates this round (it is in the 9.0 captures).
- The ring sits between the sky dome (radius 4300) and the far plane (5000); the city's farthest compressed geometry reaches ≈4580, so the ridges never cut a building. Its haze has no 25 km cut-off, unlike surface haze, because the far hills are the one thing meant to survive that distance.
