// render-canvas-video.js — deterministic headless capture of a canvas/HTML
// animation to evenly-spaced frames, ready to encode with ffmpeg.
//
// Usage:  node render-canvas-video.js <html-basename> [fps] [durationMs] [w] [h]
// Then:   ffmpeg -y -framerate <fps> -i /tmp/canvas-video/f%04d.png \
//               -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out.mp4
//
// Edit PROPOSALS_DIR to the directory containing the HTML + its relative assets.
// Requires: `npm i puppeteer` in the cwd (pulls Chrome for Testing).

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const PROPOSALS_DIR = process.env.HTML_DIR || process.cwd();
const htmlName   = process.argv[2] || 'index.html';
const FPS        = Number(process.argv[3] || 30);
const DURATION   = Number(process.argv[4] || 4200);   // ms
const W          = Number(process.argv[5] || 1280);
const H          = Number(process.argv[6] || 720);
const PORT       = 8953;
const outDir     = '/tmp/canvas-video';
fs.mkdirSync(outDir, { recursive: true });

const frameCount = Math.round(DURATION / 1000 * FPS);
const stepMs = 1000 / FPS;

const server = http.createServer((req, res) => {
  const filePath = path.join(PROPOSALS_DIR, path.basename(req.url));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const ct = ext === '.html' ? 'text/html'
      : ext === '.js' ? 'application/javascript'
      : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.end(fs.readFileSync(filePath));
  } else { res.statusCode = 404; res.end('not found'); }
});

server.listen(PORT, '127.0.0.1', async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    // Feed virtual time THROUGH requestAnimationFrame — draw(now) reads the rAF
    // timestamp, so overriding performance.now alone would not move the anim.
    await page.evaluateOnNewDocument(() => {
      let vt = 0;
      window.__tick = (ms) => { vt = ms; };
      performance.now = () => vt;
      window.Date.now = () => vt;
      const pending = [];
      window.requestAnimationFrame = (cb) => { pending.push(cb); return pending.length; };
      window.__flush = () => { pending.splice(0).forEach(cb => cb(vt)); };
    });
    await page.goto(`http://127.0.0.1:${PORT}/${htmlName}`, { waitUntil: 'load' });
    for (let i = 0; i < frameCount; i++) {
      const vt = Math.round(i * stepMs);
      await page.evaluate((t) => { window.__tick(t); window.__flush(); }, vt);
      await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(4, '0')}.png`), type: 'png' });
    }
    console.log('captured', frameCount, 'frames ->', outDir);
  } finally { await browser.close(); server.close(); }
});
