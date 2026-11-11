# Agent Office 9.3 — B&Co. Design | Build and B&Co. Surfaces

Page 9.3.0 / bridge 1.7.4 (bumped together, so open pages reload onto the new build). Built on main at 9.2.0 (after PRs #5 and #6).

Igor's ask (2026-11-11): the office still shows a conference room (the Market Room) where he expects rooms for
B&Co. Design | Build and B&Co. Surfaces. They had never been built.

## What changed

**The Market Room is now two studios**, behind the same frameless glass in the north-east corner (`src/js/54_studios.js`):

| Studio | Where | In it |
|---|---|---|
| **B&Co. Design \| Build** | x 3.4 → 5.6 | A white-oak drafting table on ink-black trestles with the drawings laid out (sheet A-101 ground floor plan on top, A-201 south elevation under it, two rolled sheets, a scale rule); a black plan chest with a white massing model and a bin of rolls; a **rendering screen** on the north glass cycling three concept renderings (dusk, morning, aerial massing) every 14 s; a linear pendant. |
| **B&Co. Surfaces** | x 5.6 → 8.0 | The **materials library** along the east glass: 45 stone, wood and tile samples on five black ledges against a black panel, over a plinth of drawers (Calacatta, Statuario, Carrara, Nero Marquina, Pietra grey, soapstone, limestone, travertine; white oak, smoked oak, walnut, ash; zellige, black hex, terrazzo, herringbone, matte black, subway). A book-matched Calacatta slab on a black steel frame by the north glass. A selection counter along the partition with a scheme laid out (stone, wood, tile, dark accent). A linear pendant. |

- Each glass section is **one pane with no line across it**: the west side, the partition and the two south fronts.
  The partition meets the façade exactly on its mullion. Each studio's way in is the open bay at the west end of its
  south glass. The panes stop short of the markets band where it passes, as before.
- The names are etched on the south glass, readable from the open floor: a crimson section number (01, 02), then
  **"B&Co. Design | Build"** and **"B&Co. Surfaces"** in the house serif (Didot on the Mac), the ampersand crimson
  italic. The same lockup is on the rendering screen's caption and the drawings' title block.
- Colour: ink black, white and crimson `#a70008` only as punctuation (section numbers, ampersands, the north arrow,
  the slide index). No gold, no brass. The samples keep their own natural colours.
- The rendering screen is translucent LED glass like every other screen (opacity 0.86, both sides).

**The Forum takes the hot sheet and the shared meetings.**

- The racetrack Nero Marquina table, its five white chairs and laptops, the rug and the Bergen County hologram moved
  from the Market Room to the Forum, square before the main screen. The two benches went: the table's three
  screen-facing chairs are now the Forum's seats (`ROOM_OBJ.forumSeats`), one set with one reservation each.
- The county hologram now lies low over the stone, nearly flat, so it never crosses the main screen. The table has no
  pendant (its blade would have crossed the main screen from every view).
- The **hot sheet (Pipeline)** hangs on the Forum side of Design | Build's west glass, facing the table, as translucent
  LED glass on four standoffs (2.8 × 1.575 m, 16:9 like its canvas).
- Shared work (Igor's rule: two or more agents on one task work on it together) now meets at the Forum table. Visitors
  who are only watching the screen make way for a meeting, and no one takes a Forum seat while a meeting is on.

**Robots visit the studios.** Two new idle destinations, one visitor at a time each: *In B&Co. Design | Build*
(standing at the drawings) and *In B&Co. Surfaces* (at the library). Builder visits both, Strategist visits
Design | Build, Publisher visits Surfaces. Each studio and the steps between the Forum chairs are single-file zones.

**Names in the interface.** The camera button "Market Room" is now "Studios" (same key `boardroom`, so saved links
and the `M` key still work). The keyboard list, the workspace camera list and the settings list follow. Agent cards
say "walking to B&Co. Design | Build" with the brand's capitals kept. Sim log lines say "at the Forum table".

## Checks

- Bridge: 175 tests pass (the two version assertions moved to 9.3.0 / 1.7.4).
- Page smoke test (`tests/smoke.cjs`, headless SwiftShader): 21 checks pass, including a new one that the studios are
  built, the Forum seats are the table's, the hot sheet faces the Forum from the studios' glass, and both studios'
  visit spots are reachable and clear of furniture.
- Walk test: four robots sent at once (two to the Forum table, one to each studio) all arrive, sit or stand, and all
  walk back to their desks.
- Cost: overview 1017 → 1048 draw calls (+3%), triangles flat (1.903 M → 1.904 M). The library is one draw (one
  sample atlas); the studios add about 30 small static batches.

## Screenshots

Project files `office-v93/`: `before/` and `after/` from the same camera stations, plus `before_after_sheet.jpg`.
`after/meet_forum.png` shows a meeting at the Forum table; `visit_studios.png` and `visit_surfaces.png` show robots in
the studios.

## Not installed

Igor reviews the screenshots first. Deployment stays the normal Studio installer path.
