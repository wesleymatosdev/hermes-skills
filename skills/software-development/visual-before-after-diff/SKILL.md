---
name: visual-before-after-diff
description: Use to capture/compare two visual states with proof.
---

# Visual before/after diff — generic capture + compare

The reusable core for "does this actually look different / did the fix work":
capture two comparable states, produce a labeled side-by-side (or stacked)
image, and vision-verify the specific claimed difference before saying it's
done. This is the primitive underneath **any** "prove it visually" task —
GitHub PR evidence, canvas-animation fixes, website redesigns, UI regression
checks, before/after screenshots for a client. It does NOT know about GitHub
hosting or canvas virtual-clocks — for those specifics, see
`github-pr-visual-evidence` (PR embedding via release assets) and
`web-animation-render-verify` (deterministic canvas timing), both of which
should delegate their raw capture step to this skill rather than reinventing it.

## When to reach for this vs. the specialized skills

| Situation | Use |
|---|---|
| Comparing two static pages/states, any source (local file, live URL, two git branches, two PNGs someone sent you) | **This skill** |
| The result needs to land in a GitHub PR description | This skill for capture, then `github-pr-visual-evidence` for hosting/embedding |
| The thing changing is a **time-based canvas/CSS animation** and timing/motion itself is in question | This skill for the composite, `web-animation-render-verify` for the virtual-clock capture mechanics |
| Open-ended "find bugs by clicking around" | `dogfood` (different job — exploratory, not a targeted A/B check) |

## Core workflow

1. **Pin down what "before" and "after" actually are.** Don't assume the live
   URL is a valid "before" — it could be stale, geo/flag-gated, or blocked.
   State the source explicitly for both: local file path, URL, git ref, or a
   user-supplied image. If a screenshot was supplied by the user (e.g. pasted
   into chat), that image IS a state — don't discard it, anchor the comparison
   to it directly instead of re-deriving your own guess of "before."

2. **Match capture conditions.** Same viewport size, same DPR, same page state
   (scroll position, animation timestamp/phase, logged-in vs not). A mismatch
   here invalidates the comparison even if both screenshots are individually
   correct.

3. **Capture both with headless Playwright/Puppeteer Chromium** (never a real
   user Chrome profile — see the browser-automation rule in memory). For a
   static page: navigate, wait for network idle, screenshot. For something with
   a deterministic replay/state param (`?t=5000`, a seeded random, a URL
   fragment), use it to land on the exact comparable frame — don't rely on
   guessing a `waitForTimeout` and hoping both captures landed at the same
   point.

4. **Build ONE composite image**, not two separate files the reviewer has to
   flip between:
   ```bash
   # side-by-side, labeled
   ffmpeg -i before.png -i after.png -filter_complex \
     "[0:v]drawtext=text='BEFORE':fontsize=28:fontcolor=white:x=10:y=10:box=1:boxcolor=black@0.6[b]; \
      [1:v]drawtext=text='AFTER':fontsize=28:fontcolor=white:x=10:y=10:box=1:boxcolor=black@0.6[a]; \
      [b][a]hstack=inputs=2" composite.png
   ```
   Use `vstack` instead of `hstack` when the two states are naturally tall/narrow
   or when more than 2 states need to read top-to-bottom in sequence.

5. **Vision-verify the SPECIFIC claimed difference**, not just "do these look
   different." Ask a pointed question naming the exact thing under test:
   *"Does the after-image show the gold ring and pink ring moving in the same
   rotational direction with no visible seam, unlike the before-image which
   shows them crossing?"* — not *"what changed?"*. A vague question gets a
   vague answer that can rubber-stamp a non-fix. If the vision answer doesn't
   clearly confirm the claimed property, the fix is NOT verified — say so
   plainly rather than reporting success on a technicality (e.g. metadata
   changed but pixels didn't — this exact miss happened once: a ring-merge
   was tagged as "merged" in hit-test data while the actual rendering never
   changed, and it got reported as fixed before a real screenshot caught it).

6. **Report with the composite path + the precise vision answer**, and name
   the capture conditions (viewport, timestamp/state, source of "before").
   Never claim "visually verified" on the strength of a screenshot existing —
   only on the strength of having actually looked at it (vision_analyze or
   equivalent) and gotten a specific yes/no on the claimed property.

## Pitfalls

- **Metadata/data changes ≠ visual changes.** Selection logic, hit-test tags,
  or config flags can be "fixed" while the rendered pixels are untouched.
  Always re-render and re-look after any claimed visual fix, even if the code
  diff looks obviously correct.
- **Don't trust a cache-busted URL alone to rule out staleness** — confirm via
  file hash (md5sum) or explicit timestamp in the captured page, not just a
  `?_cb=` query param.
- **A single settled-state screenshot can't prove a motion/direction claim.**
  If the dispute is about how something moves (not just its end state), you
  need multiple timestamps — hand off to `web-animation-render-verify`.
- **User-supplied images are ground truth for what they saw** — if a pasted
  screenshot contradicts your own render, trust the user's capture as the
  "before" and investigate why your render differs (browser cache, wrong
  build, wrong port/instance) rather than assuming their image is stale.
- **A page can draw the "same" visual concept in more than one code path.**
  A canvas particle system fixed in one function (e.g. `disk()`) can still
  visibly fail because a SECOND, separate drawing function (e.g. a decorative
  `blackHole()` stroke-ring overlay) implements the same concept independently
  and was never touched. Grep for the same magic numbers/constants
  (`plane%3`, a shared color palette, a shared radius formula) across the
  WHOLE file before declaring a geometry/rendering fix complete — don't stop
  at the first function that matches the bug description.
- **When two agent attempts both "fix" the same visual bug and both fail
  independent re-verification, stop trusting self-reports and read the
  geometry/math yourself.** A ring-crossing bug survived two direction-only
  fixes because the real cause was a plane mismatch (two ellipses on
  different tilts always cross, regardless of spin direction) — confirmable
  with a few lines of arithmetic (compare radii/flatness) faster than a
  fourth round of ambiguous vision-model opinions.
- **Vision-model answers about "crossing" near a busy/multi-element scene can
  be contaminated by adjacent unrelated shapes.** If a fix is analytically
  provable (e.g. "ring A's radius and flatness both exceed ring B's, so they
  cannot cross"), prefer that proof over a fourth ambiguous vision read —
  vision models can flag correct concentric rings as "crossing" when a
  DIFFERENT set of diagonal lines shares the same frame.
