# Agent Office 9.2 — natural robot movement up close

Page 9.2.0 / bridge 1.7.2 (bumped together, so open pages reload onto the new build). Built on main after 9.1 (PR #3).

Igor's ask (2026-11-08): zoomed in, robot parts go into their own bodies or through furniture, some furniture
disappears as the camera moves closer, and typing looks skippy. Make every movement more human.

## What was measured first

All measured headless (Playwright + SwiftShader) on a virtual 30 fps clock, the office's own frame rate. Same seeded
random numbers before and after.

| Check | 9.1 | 9.2 |
|---|---|---|
| Right-hand fingertips while typing: frames with a jerk spike (20 s) | 476–497 | ~20 |
| Mean fingertip acceleration, right ring/little finger | 14–15 m/s² | ~1.5 m/s² |
| Worst hand jump in one frame, seated pose change (done → type) | 46 cm | ~10 cm |
| Worst hand jump, keys → lap | 16 cm | 3 cm |
| Desk-guard oscillation (hand lifted one frame, dropped the next) | every frame at the keys | none |
| Fingers splayed to their joint limit while typing | all eight | none (each finger square over its key) |
| Station meshes sliced by the camera's near plane, close-up sweep | 0.6 m near plane | 0.14 m at close zoom + soft fade |

## Causes found and fixes

1. **Skippy typing.**
   - The desk guard checked last frame's fingers against this frame's wrist, lifted the hand, then dropped it the
     next frame: a two-frame flicker on the right hand all the time. Fingers on the keys are now left to the finger
     solver (which already keeps each tip clear of the caps); the guard no longer feeds its correction back into the
     pose, keeps the way round the edge it chose last frame, and eases out instead of dropping.
   - Each hand sat about 3 cm inside its home keys, so every finger was bent sideways to its limit and the knuckles
     bent backwards. Wrist placement is now measured per hand (`HAND_OUT`, `TYPE_WRIST`).
   - A new stroke restarted a finger from its home key, even mid-return (a visible snap on double letters and
     same-finger pairs). A stroke now starts from where the tip actually is, follows a minimum-jerk path (lift, arc
     over the caps, press with the cap, a beat, release), and a busy finger finishes before the next key on it.
     A fast spring on each tip removes any remaining corner. Strokes are slightly calmer (0.2–0.26 s).
   - Thumbs no longer swing in to meet over the space bar.
2. **Every other motion.** Joints moved on a first-order ease that starts each move at full speed and stops it dead.
   Every pose value now rides a critically damped spring (exact for any frame time), with human top speeds per joint
   outside walking and the quick incident choreography. Habits (look, lean, stretch, nod) start and end at rest; the
   stretch brings the hands up in front of the chest before raising them.
3. **Through the desk.** Changing what it does at the desk, a robot briefly folds its forearms up and in, so the hands
   pass above and behind the desk's edge. The lap hands sit 4 cm further back, and the thinking pose's left hand lies
   across the lap instead of under the edge. Brief contacts remain during some pose changes (worst ~2.6 cm for a few
   frames, measured over 150 s of the whole crew).
4. **Furniture disappearing up close.** Two causes:
   - The camera's near plane sat at 0.6 m, so zoomed in a chair or desk between the lens and the subject was sliced
     away. It now follows the zoom (0.14 m close up, back to 0.6 m far out for depth precision on the skyline), and
     anything within a few centimetres of the lens thins out softly instead of being cut.
   - With an agent open, the line-of-sight tunnel was 2.5 m wide at the camera, so zooming in dissolved the desks
     round the agent. It is now the sight line's own cone, slim at the lens.
   (A frustum-culling audit found no meshes culled while in view.)

## Self-collision audit

Arm and hand samples against each robot's own torso, head and legs, every pose forced (seated and free-standing):
nothing new. The seated lap pose reports a 6 cm overlap with the torso samples, but close-ups from front, side and
top show the forearms beside the narrow waist, not in it; the torso samples there are wider than the body.

## Checks

- 172 bridge tests pass.
- Smoke test 20/20 (twice). One test change: the Esc check now waits for the Desks glide to finish before reading
  the radius it compares against (software rendering was still mid-glide after 2.5 s).
- Before/after close-ups from fixed viewpoints and the QA scripts: project files `office-v92/`.

## Deploy

Not deployed. Merge the PR; the Studio installer picks up main as usual.
