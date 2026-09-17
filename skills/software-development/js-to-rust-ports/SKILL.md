---
name: js-to-rust-ports
description: Use when porting a JS library to Rust with benchmarks first.
---

# JS-to-Rust ports, measured first

Class of task: take a small JS utility (escalade-class: tens of lines, syscall-bound) and produce a Rust equivalent, with honest cross-engine numbers to justify it; also covers benchmarking a JS lib across node/bun/deno on its own. Workflow is measurement-first: never port blind.

## Procedure

1. **Read the actual shipped JS** — `node_modules/<pkg>/dist/index.mjs` (and any subpath variants like `sync/`). Extract exact semantics: path resolution, callback contract, termination condition. The dist file is the truth, not the README.
2. **Benchmark JS before porting.** Write ONE cross-engine runner (`node bench/bench.mjs`; template below) that:
   - builds a fixture that stresses the real workload (e.g. a depth-32 dir tree with filler files so `readdir` is non-trivial, target present only at the root so every op pays the full ascent);
   - generates a single pure-ESM worker script (only `node:path`/`node:fs` imports — all three engines support those) and spawns each engine on it: plain `node worker.mjs`, plain `bun worker.mjs`, `deno run -A worker.mjs`;
   - validates the result every iteration (MISMATCH → exit 1) — a benchmark that returns the wrong answer is not a benchmark;
   - runs N=5 fresh processes per engine, reports the MEDIAN ops/s, dumps JSON next to the script.
   - Do not use poku for this — it is a test runner, not a timing harness; the cross-engine spawn runner is the same idea specialized for measurement.
3. **Port std-only, blocking-first.** Zero runtime deps (criterion is `--dev` only). If the workload is syscall-bound (stat/readdir-dominated), make the blocking function the core and document async as a wrapper (`spawn_blocking`) — JS sync beat async ~2:1 on every engine, so an async-first Rust API just re-pays that overhead.
4. **Mirror semantics exactly**, then improve the API where it's free: e.g. a typed variant that passes each entry's `is_dir` from the dirent type hint so callers don't re-stat.
5. **Bench Rust with criterion** on an identical fixture, same assertions; convert µs/op → ops/s to put in the same table as the JS numbers. Report honestly — if Rust only edges out Bun on a syscall-bound workload, say so.
6. **Deliver as a drop-in package, not a Rust API.** The port's contract: consumer code stays byte-identical, ONLY the import specifier changes (`import escalade from 'escalade-native'`). Mirror the original package's export surface exactly — if it ships a default async export plus a `sync` subpath, ship the same two shapes (`module.exports = fn; fn.sync = ...`). The default export MUST be Promise-returning: a sync native addon on the hot path blocks the event loop, which is disqualifying for library use; sync exists only as the explicit opt-in subpath. The benchmark too must call every variant through consumer-identical code — if the harness uses a special API the package doesn't have, the comparison is not of the package.
7. **For JS-facing delivery use napi-rs** (`napi build --release` in the crate, needs a package.json with a `napi` field and `"type": "commonjs"`). Async exports: `#[napi] pub async fn` with a `ThreadsafeFunction<(Dir, Vec<String>), ErrorStrategy::CalleeHandled>` param — the walk runs on the async runtime, the JS callback crosses per directory via `call_async(Ok(tuple))`. Verify event-loop liveness: a `setTimeout` must fire while a walk is in flight.

## napi-rs pitfalls

- Exports are camelCase: `escalade_sync` surfaces as `escaladeSync`. Check `Object.keys(require('...node'))` before wiring the wrapper — don't trust the Rust fn name.
- The CLI writes the binary as `index.node` (name derivable from package.json config); an older differently-named `.node` left beside it loads fine and serves STALE exports. After every rebuild, list the module's keys — a "missing export" is usually a stale binary, not a bad build.
- A `ThreadsafeFunction` calls the JS fn as `(this, ...tuple)` — the consumer callback receives shifted args. Adapt positionally in the JS wrapper; never make consumers deal with it.
- `JsUnknown::coerce_to_bool(self)` takes ownership, so you can't reuse the value for `coerce_to_string`. Parse the callback result once as `Option<String>` via `FromNapiValue::from_unknown(result)` — null/undefined → None, string → Some — which also matches the lib's real semantics.
- `.call(None, &[a.into_unknown(), b.into_unknown()])`; `create_array_with_length` takes `usize`; `#[napi] async fn` needs the `napi` crate's `async` feature.
- After writing the FFI loop, re-read it for computed-then-discarded values — a callback result bound but never returned compiles clean and never terminates the walk. The correctness gate catches it; keep one.
- napi handle scopes: values created inside one `run_in_scope` closure die when that scope closes — hoisting them into an earlier, separate scope yields `InvalidArg` at use time. When machinery (split fn, separator, cached arrays) must live across directories, wrap the ENTIRE walk in ONE `run_in_scope` and resolve everything once at its top.
- Do not replace the per-element `set_element` array build with a joined-string + `String.prototype.split` handoff: measured within ~1% of the naive build on Node (the engine split call costs what the N allocations cost), and it breaks on Bun — `get_named_property::<JsObject>` on the `String` global returns a non-Object there. Also avoid global-prototype lookups through napi generally; engines disagree on constructor shapes. The per-directory `callback.call` round trip is the floor — optimize nothing below it.
- Deno loads the CJS addon wrapper only with `--unstable-detect-cjs` (import via `.default`). Node/bun load it through `createRequire`.

## Pitfalls

- Sanity-check every ops/s number against iteration count before trusting it — a harness that runs the op once but divides by ITERS reports ITERS× the real throughput. Cross-check: `ops/s × seconds ≈ iterations`.
- Give each `#[test]` its own uniquely-named fixture directory — tests run in parallel threads of one process, and a shared `temp_dir()` fixture makes `create_dir` fail with AlreadyExists mid-suite.
- Compare `PathBuf` entries via `e.as_os_str() == "literal"` — `PathBuf` has no `PartialEq<str>`, and this breaks in unit tests AND doctests (`cargo test` compiles both; grep your doc examples too).
- Long cargo commands (bench builds) exceed the 600s foreground cap — they auto-promote to a tracked background process; wait on the session id instead of re-running.
- Keep the new crate OUTSIDE repos with strict constraint docs (screening/AGENTS.md style repos forbid dependency additions) — sibling directory under the same parent.

## Templates

- `templates/cross-engine-bench.mjs` — the runner/worker generator: copy, swap the import under test and the fixture builder.
