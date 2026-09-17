---
name: photo-to-ascii-art
description: "Convert a photo to ASCII art that visually matches it."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [ascii-art, image-conversion, verification, console-easter-egg]
    related_skills: [ascii-art, proof-bearing-verification]
---

# Photo-to-ASCII Art

Use when the user gives (or references) a specific photo and wants ASCII art that recognizably matches *that image* — not a generic scene of the same subject drawn from description. Common case: console-log easter eggs, terminal banners, README art.

## Core rule: never hand-approximate

Do not compute geometry (distance-to-center math, hand-typed box-drawing characters) to "draw" what the reference photo shows, even when you can describe the shape precisely. This reliably produces something that reads as noise or an unrelated blob to the user — confirmed on a black-hole photo where mathematically-verified circular geometry still looked wrong, while running the actual photo through a real image-to-ASCII converter nailed it on the first correctly-configured attempt.

## Workflow

1. **Get the photo on disk** as a real file path (save attachments immediately).
2. **Install and run the neethanwu/ascii-art converter** (a proper tonal/edge image-to-ASCII pipeline, not text-art generators like pyfiglet/cowsay):
   ```bash
   git clone https://github.com/neethanwu/ascii-art.git /tmp/ascii-art-skill
   bash /tmp/ascii-art-skill/scripts/setup.sh   # Pillow/NumPy/pyfiglet into a local venv, ~10s
   /tmp/ascii-art-skill/scripts/.venv/bin/python /tmp/ascii-art-skill/scripts/convert.py \
     --input "<photo path>" --type image --style classic --color original \
     --background dark --export png --cols 100 --filename check
   ```
3. **Try 2-3 `--style` values and compare rendered PNGs, don't default to one.** `classic` (tonal ramp `$@%#*+=-.`) preserves broad shading and works well for photographic subjects. `edge` and `block` frequently destroy fine detail — thin bright lines on a dark background turn into arrow-slash noise (`edge`) or a flat gray mass (`block`). Compare before picking.
4. **Verify with `--color original` + PNG export FIRST**, not plain grayscale text. For high-contrast/thin-detail subjects (e.g. a bright ring on near-black), grayscale-only text conversion can look like unreadable noise even when the underlying conversion is technically correct — color carries shape information that brightness alone loses at ASCII resolution. Only fall back to plain grayscale text if the subject has broad, even tonal ranges and the colored PNG confirms the shape is legible without color.
5. **Render to an actual image and inspect with vision before showing the user anything.** A string of characters that "should" look right per source data, or per your own re-reading of the text, is not proof — see `proof-bearing-verification`. This is the single most important step; skipping it is what produces embarrassing "that's not a black hole" corrections.
6. **Crop to content.** Image-to-ASCII output is often mostly background fill (e.g. rows of `$$$$$...`) padding the actual subject — trim rows/columns where every character is background before finalizing, or the shape drowns in filler.

## Delivering to a colored console.log (not a static image)

If the destination is `console.log('%c...', ...)` rather than a plain image:

1. Export with `--export html` — this gives exact per-character `rgb(r,g,b)` colors you can parse (`<span style="color:rgb(r,g,b)">char</span>` per cell).
2. **Quantize into a small palette (4-6 color buckets by brightness)** and **run-length-encode consecutive same-color characters per row.** Raw per-character color spans balloon into thousands of `%c` tokens; quantized + RLE keeps a typical small-to-medium art piece to dozens–~200 runs, which is a reasonable `console.log` call size.
3. **Build the format string and the color/text argument arrays from the same source list of `[color, text]` pairs** — never hand-interleave `%c` tokens and color strings as separate literals. Manual interleaving silently drifts out of sync (extra/missing `%c` vs argument count) and produces a garbled or broken console render with no error thrown. Generate both from one data structure, e.g.:
   ```js
   const runs = [['#5c2a00','8WM*hb'], ['#b34700','dqwwwqpb'], ...]; // one row, or flattened across rows with '\n' prefixed onto each row's first run
   console.log(runs.map(() => '%c%s').join(''), ...runs.flatMap(([c,t]) => [`color:${c};font-family:monospace;`, t]));
   ```

## Delivering to a chat platform (WhatsApp, etc.)

**Never paste multi-line ASCII/color art directly into a chat message on a platform that doesn't preserve monospace alignment.** Confirmed on WhatsApp: a correctly-generated multi-row ASCII piece collapsed into an unreadable single garbled line when pasted as chat text, even though the same content rendered correctly in a real terminal/browser console. Render it to a PNG (colored, matching the intended console/terminal look) and deliver as a media attachment (`MEDIA:/path/to/file.png`) instead — this is also how to *prove* the art is correct to the user in the first place, independent of where it will finally ship.

## Pitfalls

- Don't trust "I verified the math is right" as proof of visual correctness — render and look.
- Don't skip the PNG/color check and go straight to plain grayscale text for high-contrast subjects.
- Don't paste raw ASCII into a chat message as your only proof — the platform may mangle it even when the source art is correct.
- Don't hand-interleave format tokens and color arguments in a generated `console.log` call — derive both from one list.
