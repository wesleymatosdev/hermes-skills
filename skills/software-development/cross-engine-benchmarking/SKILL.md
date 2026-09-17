---
name: cross-engine-benchmarking
description: Benchmark JS/TS libs across node/bun/deno or vs Rust/WASM.
---

# Cross-engine benchmarking (JS/TS + Rust native/wasm comparison)

## Standing rules

- The benchmark harness is JS/TS, always. Criterion/`cargo bench` may supplement a Rust port, but the numbers the user wants come from the JS engines running identical code. Native Rust vs JS vs wasm is compared from the JS side (or a JS runner spawning every engine).
- Test runners like poku do not solve this: they run tests, not identical timed workloads. A single worker script spawned by every engine is the cross-engine mechanism.
- Every timed variant passes a correctness gate first: assert it returns the exact expected value before any timing loop runs. A silent mismatch (empty result, wrong path) benches nothing at full speed.
- Report median of >=5 runs; state iters, scenario depth, and engine versions in the table. Show the comparison as a percentage vs the baseline variant.
- Measure sync and async APIs separately — sync is often ~2x faster for syscall-bound work, and reporting only async misleads the port decision.

## Procedure

1. Read the library's actual dist source (node_modules/<pkg>/dist, sync/ subdir if present) before writing the bench — the fixture must exercise the real hot path.
2. Build the fixture to maximize the hot path: e.g. for parent-directory ascent, a deep tree (depth ~32) with the target only at the root and filler entries so readdir isn't trivially empty.
3. Write ONE worker file (TS ok) that each engine executes byte-identically:
   - node: `node --experimental-strip-types worker.ts`
   - bun: `bun worker.ts`
   - deno: `deno run -A worker.ts` + a `deno.json` import map mapping bare builtins (`fs`, `path`, `util`, `os`) to `node:*` — npm packages importing bare specifiers fail in Deno otherwise.
4. Worker prints one JSON line of results; the runner (spawn per engine, N runs) parses the last line and computes medians.
5. For a wasm comparison, build Rust for `wasm32-wasip1` (`cargo build --release --target wasm32-wasip1`, crate-type cdylib) and instantiate from the same TS worker — see references/wasi-preview1-host.md.
6. Run a host control: time the wasm variant under node's native `node:wasi` too (use `wasi.initialize(instance)` for reactor modules without `_start`). If the TS host and native host disagree wildly, the host is the bottleneck, not wasm.

## Bench-shape variants for a wasm comparison

- `js-<variant>`: the npm library as-is (sync + async).
- `wasm-hybrid`: hot loop in JS, the syscall wrapper (readdir/stat) exported from wasm — the realistic FFI shape you'd ship.
- `wasm-full`: entire loop inside wasm (matcher hard-coded) — the upper bound for wasm.

## Pitfalls

- Bench loop must RUN the op ITERS times AND divide by ITERS. Running it once and dividing by ITERS inflates results by ITERS-x — verify ops/s is plausible for the syscalls involved before publishing.
- FFI lengths are BYTES, not string length. Pass `new TextEncoder().encode(s)` and its `.length`; a hardcoded `str.length` off by the NUL or by UTF-8 width silently never matches, and the correctness gate is the only thing that catches it.
- Verdict heuristic: syscall-bound loops (stat/readdir walks, fs scans) LOSE in wasm on every engine (~25-35% slower) — the boundary cost per syscall exceeds what compiled code saves; there is no compute to optimize. Wasm wins when the boundary is crossed once and the work inside is hot (parse/hash/codec). Native Rust ties JS on syscall-bound work; say so plainly.
- In a TS WASI host, refresh the DataView/Uint8Array of linear memory at the top of every imported WASI function — memory growth detaches the buffers, and even reading `.byteLength` on a detached view throws.
- Path args into wasm must be absolute; resolve on the JS side first (mirrors `path.resolve('.', start)`).
- Keep the Rust wasm protocol minimal: exports `alloc(u32)->u32`, `memory`, and typed `extern "C"` functions taking (ptr, len) pairs over a shared out-buffer. No wasm-bindgen needed for buffer protocols — it adds import surface for nothing.
- Measure a native-addon (napi) variant in BOTH shapes when the package ships both: a sync export (walk inline, callback called directly — fast, blocks the loop) and the async export (threadpool walk + per-directory JS callback). The ranking can differ per engine: the napi sync export can beat the JS package's own sync path on engines with slow fs bindings (Deno) while losing on node/bun — the per-directory Rust-String→JS-string array marshaling is the cost JS readdir gets free. Report per-engine winners, not one verdict.
- For the async napi variant the comparison includes a thread hop per directory; that is the real cost of event-loop safety, not overhead to engineer away. Do not "optimize" it into a sync addon and present it as the same product.
- A/B every optimization attempt in-process against the current winner AND the JS baseline in the same run — cross-run comparisons swallow few-percent effects. If the attempt lands within noise or only works on some engines, drop it and report the boundary/callback tax as the floor; a rejected optimization with numbers is a finding, an unmeasured one is a risk.
- Publishing a bench that references another repo's `node_modules` by absolute path is a non-starter for upstream contribution: vendor the baseline package (tiny MIT libs: copy dist + license into `bench/vendor/`) and use relative imports; re-run all engines on the vendored copy before pushing.
