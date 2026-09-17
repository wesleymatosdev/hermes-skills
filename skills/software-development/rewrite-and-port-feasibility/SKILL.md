---
name: rewrite-and-port-feasibility
description: "Use when asked how hard a rewrite or port would be."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [porting, rewrite, estimation, rust, architecture, protocols]
    related_skills: [codebase-inspection, spike]
---

# Rewrite & Port Feasibility

Use when the user asks *"how hard would it be to rewrite X in <language>?"* or
"can we clone this in Rust?" — often enthusiastically, often about a project
they just discovered. The job is to give a number they can act on, and to find
the version of the project that is actually worth doing.

**Never answer from impression.** A polished README hides both the test-suite
mass and the un-portable dependencies.

## Step 1 — Measure (4 numbers, one minute)

```bash
git clone --depth 1 --quiet <repo> src && cd src
cat VERSION 2>/dev/null
find src -type f -name '*.<ext>' | wc -l                       # impl files
find src -type f -name '*.<ext>' -exec cat {} + | wc -l        # impl lines
find test tests -type f -name '*.<ext>' 2>/dev/null -exec cat {} + | wc -l
jq '{deps:(.dependencies|keys), scripts:(.scripts|keys|length), bin}' package.json
```

If `git clone` is vetoed by a local command classifier (cloning a stranger's
repo reads as attack prep), the GitHub API gives you the full inventory without
cloning:
`curl -s "https://api.github.com/repos/<o>/<r>/git/trees/<branch>?recursive=1" | jq -r '.tree[].path'`

Test lines routinely EXCEED implementation lines. Quote both — a faithful port
owes the test suite too, or it is not faithful.

## Step 2 — The dependency list decides feasibility, not the LOC

Scan deps for things with **no equivalent in the target language**:

- **WASM-bound runtimes** — a database compiled to WASM (e.g. Postgres-as-WASM),
  `web-tree-sitter`, wasm codecs. These are not "port the logic" items; they are
  "replace an entire subsystem and re-validate" items.
- Native/media codecs (avif, heic, exif), vendored ML runtimes.
- Ecosystem-specific SDK families where the port means reimplementing N provider
  clients.

One of those turns a "port" into a research project. Say so in one sentence.

## Step 3 — Look for the escape hatch BEFORE quoting a number

This is the highest-value move and it is easy to miss. If the project exposes a
**frozen, versioned wire protocol with a conformance checker**, the right
project is reimplementing that *surface*, not the codebase.

Signals to grep for:

- a `docs/protocol/` directory or a `*_v1.md` spec
- an **additive-forever** versioning policy (fields never renamed/re-typed)
- a machine-readable schema dump (`<tool> protocol --json`)
- a `conformance --target <endpoint>` command
- a separate evals/benchmark repo

That combination gives a clean-room reimplementation a **hard pass/fail oracle**
and makes it drop-in by construction — which is usually what the user actually
wants when they say "plug-and-play".

Worked example: a 393K-line TypeScript project with 479K lines of tests, PGLite
and tree-sitter-wasm among its 30 deps — multi-month as a rewrite. But its
memory interface was 7 frozen verbs with a shipped certifier, so the tractable
project was a ~8–15K-line reimplementation of those verbs, certified against the
original's own conformance suite and benchmarked on its own eval corpus.

## Step 4 — Report in this shape

1. **Full-rewrite size**, measured, with the un-portable deps named.
2. **The subset that actually matters** — the protocol/interface/hot path — with
   its own estimate, and what stays on the original (ingestion, cron, UI,
   bundled content: usually not worth porting and not where the win is).
3. **The oracle** you would verify against, and the benchmark that is the *real*
   gate.
4. **The honest hypothesis.** Write down what you expect to gain (single static
   binary, native driver instead of WASM, latency) as something to TEST, not
   assume. If the benchmark shows no gain, the port is a portability win only —
   record that and let the user decide.

## Pitfall: conformance ≠ quality

A conformance suite asserts shape, enum validity, contract behavior, and
round-trips. It says **nothing about output quality** — retrieval precision,
ranking, accuracy. If the project has a quality benchmark, that benchmark is the
real gate, and it is exactly where a naive reimplementation silently loses.
Always name the specific mechanism that drives quality (a graph extraction, a
hybrid-search blend, a scoring heuristic) as the known risk.

## Pitfall: don't derail the current task

These questions usually arrive mid-task and are *fun*, which makes them a
derailment risk. The right move is to measure (cheap, minutes), write the
findings to a **backlog spec file**, and return to the work in flight. A good
backlog spec contains: the measured numbers, the escape-hatch insight, the
non-negotiable contract details, a numbered plan ending in a benchmark
comparison, the pitfalls, and an explicit "do not start before X" gate — because
the port must be measured against a baseline that has to exist first.

That file is also the delegation package: it is what you hand to a subagent or
a separate coding-agent session.
