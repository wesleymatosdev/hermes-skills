---
name: headless-canvas-capture
description: "Render canvas/HTML animations to frames and video."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Puppeteer, Canvas, Animation, Video, Screenshots, ffmpeg]
    category: creative
    related_skills: [p5js, manim-video, branded-export-graphics]
---

# Headless Canvas Capture

Capture an arbitrary `<canvas>` / HTML animation (raw `requestAnimationFrame`
loop, p5 sketch, WebGL, an OBS stinger, a site intro animation) to **exact,
evenly-spaced frames** and stitch them into an mp4/webm — all headless via
Puppeteer + ffmpeg, no screen recorder, no GPU. Also covers grabbing single
labeled screenshots at chosen timestamps to build comparison filmstrips.

## When to use
- "Show me the animation" / a motion idea needs a video or filmstrip preview.
- Turning a live HTML hero/intro into an OBS stinger, social reel, or a
  before/after motion strip for a PR.
- Comparing design proposals at multiple timestamps (t=0/2/5s) side by side.

## Core pattern: serve → screenshot → encode
1. Tiny Node static server (`http.createServer`) rooted at the HTML's dir so
   relative `src="starfield.js"` etc. resolve. Pick an unused port.
2. `puppeteer.launch({ headless: true, args:['--disable-gpu','--no-sandbox',
   '--force-color-profile=srgb'] })`, `setViewport({width,height,
   deviceScaleFactor:1})`.
3. For single frames at wall-clock moments: `page.goto(url,{waitUntil:'load'})`,
   `await sleep(t_ms)`, `page.screenshot()`. This is the simple, robust path
   when you just need a few frames (the render-proposals pattern).
4. Encode: `ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -pix_fmt yuv420p
   -crf 20 -movflags +faststart out.mp4`. Verify with `ffprobe` (codec, WxH,
   duration).

## Deterministic even-spacing: the virtual-clock override
For a smooth video with exactly-spaced frames (not dependent on real render
speed), drive the animation's clock yourself. The animation reads time from
`requestAnimationFrame`'s timestamp — so you MUST feed virtual time **through
rAF**, overriding `performance.now`/`Date.now` alone is NOT enough:

```js
await page.evaluateOnNewDocument(() => {
  let vt = 0;
  window.__tick = (ms) => { vt = ms; };
  performance.now = () => vt;
  window.Date.now  = () => vt;
  const pending = [];
  window.requestAnimationFrame = (cb) => { pending.push(cb); return pending.length; };
  window.__flush = () => { pending.splice(0).forEach(cb => cb(vt)); }; // pass vt to the cb
});
await page.goto(url, { waitUntil: 'load' });
for (let i = 0; i < frameCount; i++) {
  const vt = Math.round(i * 1000 / FPS);
  await page.evaluate((t) => { window.__tick(t); window.__flush(); }, vt);
  await page.screenshot({ path: `f${String(i).padStart(4,'0')}.png` });
}
```

Most canvas loops call `init()` on load (setting `startTime = performance.now()`)
then `draw(now)` where `now` is the rAF timestamp — this override makes `elapsed
= now - startTime` land on your exact virtual ms every frame.

## Pitfalls
- **CDP `Emulation.setVirtualTimePolicy: 'pause'` blocks `page.goto` from ever
  firing `load`** → 30s navigation timeout. Prefer the JS rAF-override above, or
  real-time `sleep` for a handful of frames. Don't reach for CDP virtual time.
- **Overriding only `performance.now` doesn't move the animation** — the rAF
  callback still receives the browser's real high-res timestamp. Override rAF
  itself and pass `vt` into the callback (above).
- CSS keyframe animations (title fade-ins etc.) run on the real compositor clock,
  NOT your virtual clock — they won't be synced in the captured video. Judge
  *canvas* motion from the capture; the CSS timing is correct on the live page.
  Note this to the user when you send a preview.
- Serve from the file's own directory or relative asset `src`s 404. Basename the
  request path to avoid traversal.
- `deviceScaleFactor:1` + `--force-color-profile=srgb` keeps output size and
  colors predictable across machines.

## Filmstrips & montages (ffmpeg, no ImageMagick needed)
Label frames and grid them in one ffmpeg call — `drawtext` for labels, `hstack`
rows then `vstack`. A 3×3 example (also works 2×2):

```
ffmpeg -y -i a.png -i b.png ... -filter_complex "\
 [0:v]scale=640:360,drawtext=text='0.2s implode':x=14:y=12:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=7[a];\
 ... [a][b][c]hstack=3[r1];[d][e][f]hstack=3[r2];[r1][r2]vstack=2[out]" -map "[out]" strip.png
```

Frame byte-size is a quick sanity signal: tiny during a collapse/dark moment,
large when the full field is spread — a cheap check the motion actually varied
before you bother encoding.

## Delivery
Send the mp4 inline (`MEDIA:/abs/path.mp4`) for real motion; send the labeled
filmstrip PNG for the whole arc at a glance. Keep the render script in the
project (e.g. a `render-*.js`) so any machine can regenerate — document it in a
`REGENERATE.md` alongside the outputs.
