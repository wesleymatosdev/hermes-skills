# Cross-engine benchmark runner template

Spawns node/bun/deno on one generated pure-ESM worker so the timed code is byte-identical across engines. Adapt the three blocks marked ADAPT.

```js
// bench/bench.mjs — node bench/bench.mjs [--iters=N] [--depth=N] [--engines=node,bun,deno]
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TARGET = join(ROOT, 'node_modules', '<pkg>', 'dist', 'index.mjs'); // ADAPT: import under test

const ITERS = 2000, DEPTH = 32, ENGINES = ['node', 'bun', 'deno'];

// ADAPT: fixture builder — stress the lib's real workload; keep the target
// discoverable only after the FULL traversal so every op pays full cost.
const FIXTURE = mkdtempSync(join(tmpdir(), 'bench-'));
{
  let d = FIXTURE;
  writeFileSync(join(d, 'package.json'), '{}');
  for (let i = 0; i < DEPTH; i++) {
    d = join(d, `d${String(i).padStart(2, '0')}`);
    mkdirSync(d);
    for (let f = 0; f < 5; f++) writeFileSync(join(d, `f${f}.txt`), 'x');
  }
}

// ADAPT: worker body — hot loop over ITERS, validate result EVERY iteration,
// print one JSON line with opsPerSec at the end. Only node:/ imports.
const WORKER = `
import { join } from 'node:path';
import lib from ${JSON.stringify(TARGET)};
const ITERS = ${ITERS}, FIXTURE = ${JSON.stringify(FIXTURE)};
const t0 = performance.now();
for (let i = 0; i < ITERS; i++) {
  const r = await lib(FIXTURE);            // ADAPT
  if (r !== EXPECTED) { console.error('MISMATCH ' + r); process.exit(1); }
}
const t1 = performance.now();
console.log(JSON.stringify({ opsPerSec: ITERS / ((t1 - t0) / 1000) }));
`;
const workerPath = join(FIXTURE, 'worker.mjs');
writeFileSync(workerPath, WORKER);

function runEngine(engine, extra = []) {
  return new Promise(res => {
    const p = spawn(engine, [...extra, workerPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => res({ code, out: out.trim(), err: err.trim() }));
  });
}

const results = [];
for (const engine of ENGINES) {
  const extra = engine === 'deno' ? ['run', '-A'] : [];
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const r = await runEngine(engine, extra);
    if (r.code !== 0) { runs.length = 0; console.error(`${engine} FAILED: ${r.err}`); break; }
    runs.push(JSON.parse(r.out.split('\n').pop()).opsPerSec);
  }
  const median = runs.length ? runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)] : null;
  results.push({ engine, medianOpsPerSec: median, runs: runs.map(Math.round) });
  console.error(`${engine}: ${median ? Math.round(median).toLocaleString() : 'FAILED'} ops/s`);
}
rmSync(FIXTURE, { recursive: true, force: true });
writeFileSync(join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
```

Rules that travel with this template:
- Fresh process per run — never loop inside one JS process for the headline number (JIT warmup flatters engines differently).
- Median of 5, not mean — one slow cold spawn skews a mean badly.
- Validate the output every iteration; a wrong-answer benchmark is worthless.
- If timing sync vs async variants of the same lib, run BOTH in the worker and report side by side — the sync/async ratio is usually the more interesting finding than the engine ranking.
