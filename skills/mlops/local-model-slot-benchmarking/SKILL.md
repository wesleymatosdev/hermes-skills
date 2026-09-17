---
name: local-model-slot-benchmarking
description: "Pick a task-slot model by measurement, not vibes."
version: 0.1.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [LLM, Benchmarking, Ollama, Local-Inference, Auxiliary-Models, Measurement, Cost-Effectiveness]
    related_skills: [llm-model-availability, llama-cpp, evaluating-llms-harness, hermes-agent]
---

# Local Model Slot Benchmarking

Use when choosing which model to wire into a *task slot* — a Hermes `auxiliary.*` role,
a cron worker, a subagent tier, a classifier, a summarizer — and the honest answer is
"whichever one actually does the job cheapest," not "the biggest one available."

This is **fitness-for-slot screening**, not academic capability benchmarking. For MMLU /
GSM8K-style capability scores use `evaluating-llms-harness`. For "where can I even get
model X and is it free" use `llm-model-availability`.

## Hardware feasibility gate (before any slot candidate is considered)

Check RAM capacity **before** quant selection or benchmarking. Capacity, not speed, is the wall: the whole model must sit resident in RAM/VRAM, so disk size is irrelevant to feasibility, and a fast SSD only accelerates mmap thrashing on a half-fitting model.

- **Apple Silicon:** GPU-usable memory is ~75% of unified memory by default (48GB → ~36GB), raisable via `sudo sysctl iogpu.wired_limit_mb=<MB>`. High unified-memory bandwidth makes Apple Silicon strong for MoE models that fit; 32GB+ models are at home on 48GB+ Macs.
- **NPUs and iGPUs add no capacity.** They share the CPU's system RAM pool — they add compute, not memory. llama.cpp also does not execute LLM layers on AMD XDNA NPUs; its acceleration paths are CPU + GPU (CUDA/ROCm/Vulkan/Metal).
- **Smallest published build is the feasibility test.** If even the most aggressive 1-bit quant exceeds usable RAM (e.g. a 93GB smallest build vs 48GB machine), the machine cannot run the model at any cleanup level — recommend cloud/API or larger hardware, never disk cleanup.
- **Frontends do not change this ceiling.** Colibri/LM Studio/Open WebUI wrap the same runtimes pulling the same weights; a new frontend can arrive earlier for a new architecture but never makes an oversized model fit.

## Why this exists

Slot models fail in ways that capability benchmarks never surface. The dominant failure is
not a wrong answer — it is a **reasoning model that ignores `think:false`, spends its whole
token budget on chain-of-thought, and returns empty or unusable content.** The slot looks
configured, the model exists, the request returns HTTP 200, and the caller gets nothing.
That is silent breakage, and only a behavioral probe catches it.

See `references/aux-bench-harness.md` for a working Rust harness and the measured
title_generation results that motivated it, and
`references/hardware-feasibility-glm53-flash.md` for a worked hardware-feasibility
case study (glm-5.3-flash on 48GB Mac vs 32GB Ryzen NPU box).

## Procedure

1. **Enumerate real candidates and their transport.** List what is actually installed and runnable
   (`ollama list`), and exclude what cannot serve the slot: `:cloud` tags are remote,
   embedding models cannot chat. For hosted candidates, verify the intended provider before
   wiring the benchmark: an available model name does not establish its authentication or
   OpenAI-protocol route. In particular, a ChatGPT/Codex subscription candidate such as
   `gpt-5.6-luna` must use the `openai-codex` route, not Copilot. Do not benchmark models
   you have not confirmed exist and can reach through the exact target transport.

2. **Write the slot's suite before running anything.** 5-6 cases that represent real
   traffic for that slot, including at least one non-English and one non-technical case if
   the slot sees them. Assert on the *content field*, not on "did it respond." The suite is
   also that slot's regression test when models are updated — keep it in git.

3. **Assert against the real failure modes:**
   - empty content → always a failure, counted separately (it is the dominant mode)
   - forbidden substrings (`"Hmm"`, `"the user wants"`, `"Let me"`, `"\n\n"`) → leaked
     chain-of-thought
   - a max word/length bound → catches a model writing a paragraph where a label was asked for
   - a keyword floor (`expect_any`) → stops a fast model winning by emitting confident nonsense

4. **Control the measurement environment.** See Pitfalls — this is where the method usually
   breaks, and an uncontrolled run produces a confident, wrong, publishable-looking ranking.

5. **Require a clean pass to declare a winner.** 100% or nothing. A slot that passes 4 of 6
   is a slot that fails silently in production; report `NO CLEAN WINNER` rather than
   recommending a partial pass.

6. **Commit the results, including the bad runs.** Benchmarks accumulate into a
   cost-effectiveness record over time. A retracted or contaminated run kept alongside its
   correction is evidence about the method, not clutter.

## Pitfalls

- **Latency is only meaningful on an idle machine.** Wall time against a shared local server
  reports machine state, not model speed. Measured spread on identical work: ~16.6s under
  contention vs ~188ms idle and warm — a ~90x swing, large enough to invert the ranking
  between two models that are genuinely tied. Check `ollama ps` first; never benchmark while
  another model is resident or another run is in flight.
- **Confirm any ranking by swapping candidate order.** If the ranking flips on reorder, the
  models are tied and must be reported as tied. This is the cheapest possible guard against
  publishing noise as a finding.
- **Warm up twice, not once.** One warm-up call still leaves ~12s of cold load bleeding into
  the first scored case on 20GB+ models, which moves the median enough to change the answer.
- **Unload between candidates.** Large local models cannot be co-resident (a 26GB and a 21GB
  model will not both fit in 48GB); sequential execution with an explicit unload is required,
  not a nicety.
- **`think:false` is widely ignored.** Do not assume a flag suppressed reasoning — verify by
  inspecting returned content. Some models honour it, some dump chain-of-thought into
  `content`, some reason internally and return an empty string. All three shapes appear in
  the same local model set.
- **Suspiciously fast can mean *failing* fast.** A model returning in 412ms while others take
  seconds was not efficient — it was emitting chain-of-thought immediately instead of
  thinking. Always read sample outputs; never rank on latency alone.
- **Suspiciously fast can also mean warm vs cold, not better.** ~190ms for a 26B model is
  plausible for a short generation on loaded weights. Confirm it is real generation by
  checking that outputs differ per case and are substantively correct.
- **Do not conclude from a background run you did not watch finish.** Poll for real exit
  status and read the completed artifact; a job producing no output has not necessarily died,
  and reporting from its partial log yields confident wrong numbers.
- **Swap does not clear without a reboot.** A machine that enters a run carrying tens of GB of
  encrypted swap stays memory-starved for the whole run even after the contending model is
  unloaded — free stays ~0 and the compressor keeps growing. Check swap before AND during the
  run (`sysctl vm.swapusage`, `memory_pressure`); a pre-swap-contaminated run is cleaner, not
  clean. Only a post-reboot run is a pristine measurement.

## Concurrency benches for expert-streaming runtimes

When benchmarking a runtime that streams MoE experts from SSD/RAM/VRAM (Colibri-class,
llama.cpp `-ot "exps=CPU"`), the usual resident-weights mental model misleads:

- **Low engine RSS is success, not failure.** mmap expert streaming keeps weights in the file
  cache; a ~3GB RSS while serving a 25GB model means streaming works. The bottleneck is
  page-fault rate, visible as compressor pages and swap-in growth between rounds.
- **Anchor against a reference point before classifying.** Compare to the same model
  fully-resident on the same machine (e.g. 81.5 tok/s single-stream for a 35B A3B on Metal).
  Anything under a few tok/s with a starved-RAM signature is contamination, not an engine
  verdict; record it as machine state, retracted with the cause named.
- **Expect degradation across rounds, not stability.** Per-slot tok/s falling while compressed
  pages grow (e.g. 1.40 → 0.92 tok/s over consecutive c=1 rounds) is the starvation signature;
  a healthy concurrent engine holds roughly flat per-stream throughput as c rises.
- **Wrap long benches in a self-restoring script.** A bash wrapper with an EXIT trap that
  restores any displaced service (classifier model, server RAM budget) makes the run safe to
  leave running across a handoff — the trap fires on ANY exit, including the session dying.
  Record the wrapper path and its wedge-case protocol (kill PID, verify restoration manually)
  in the handoff, never rely on the creating session for supervision.
- **Worked case:** `references/expert-streaming-concurrency-bench.md` — Colibri/qwen36 with
  Ornith-35B-A3B on a 48GB Mac: contaminated numbers, the starvation diagnosis, and the
  re-run protocol.

## Classifier Slots

A command classifier is a task slot too: its actual configured model must override any
plugin default. Before changing the default in source, first set an explicit
`classifier_mode.model` in Hermes configuration, then issue one harmless non-read-only
command and confirm the selected model is resident with `ollama ps`. This proves the
pre-execution hook read the override rather than merely proving the model is installed.

## Reporting

Report pass rate as the primary metric and latency strictly as a tiebreaker. State the
measurement conditions (idle or not, warm or cold, order-swapped or not) alongside any
latency figure. When two candidates tie, say they tie and surface the *other* deciding
factors — memory footprint, output quality on sampled cases, licence — rather than
manufacturing a winner from noise.

If an earlier reported number turns out to be contaminated, correct it explicitly and say
what the contamination was. A retracted benchmark is recoverable; a silently wrong one
propagates into config.
