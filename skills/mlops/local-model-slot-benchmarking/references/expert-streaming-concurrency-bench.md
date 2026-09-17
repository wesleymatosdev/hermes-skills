# Expert-streaming concurrency bench: worked case (Ornith-35B on 48GB Mac)

Session-derived case study, 2026-09-01. Machine: M4 Max 48GB, macOS, encrypted swap.

## Setup

- Runtime: Colibri fork (`coli serve --model <ornith_i8 container> --ram N`), qwen36 engine,
  OpenAI-compatible on 127.0.0.1:11500, model id exposed as `qwen3.6-colibri` (generic engine
  id despite Ornith weights).
- Model: Ornith-1.5-35B-A3B, ~35GB i8 container on NVMe, ~3B active params/token.
- Reference point: same GGUF fully-resident under llama.cpp/Metal did **81.5 tok/s**
  single-stream (Kronk PoC). That anchor is what makes starvation diagnosable.
- Harness: wave benchmark, warmup + 2 rounds each at c=1/2/4, 256 generated tokens/request,
  RAM snapshot (`vm_stat` + `sysctl vm.swapusage` + engine RSS) after every round.

## The contaminated runs (retracted, kept as evidence)

| Run | Conditions | Numbers |
|-----|-----------|---------|
| Night 1 | 35B classifier (25GB) resident on Ollama simultaneously; ~15GB swap pre-existing | warmup ~0.90 tok/s |
| Clean attempt 1 | classifier unloaded first, but machine entered with 19GB swap, free 0.1GB | warmup 1.88, c=1: 1.40 → 0.92, c=2 mean 0.93 / agg 1.04 |

Both show the starvation signature: free ~0.1GB, compressor growing every round
(9 → 10.5 → 12.6GB), per-round throughput DEGRADING, engine RSS ~2.9GB (streaming fine).
Not an engine verdict. Under 5 tok/s single-stream for this model on this hardware =
starvation until proven otherwise.

## Diagnosis chain

1. RSS tiny while serving 25GB → mmap expert streaming is working as designed (weights in
   file cache, not RSS).
2. Free ≈ 0 + compressor growing → hot-expert pages evicted to encrypted swap; every decode
   stalls on page faults. Swap on macOS does not clear without a reboot.
3. Contention source identified: the command-guard classifier keeps its 25GB model resident
   and re-loads it; Colibri's `--ram` budget fights it. Mitigation during bench: switch the
   classifier to a small model (9B, ~6GB) for the window, restore after.

## Re-run protocol (the only one that yields a real verdict)

1. REBOOT first — clears swap; nothing else does.
2. Run the self-restoring wrapper (it unloads the 35B, restarts serve with tuned `--ram`, runs
   the waves, and its EXIT trap restores classifier → 35B and serve → documented budget on any
   exit).
3. Read per-round RAM snapshots alongside tok/s; verdict only from a run that started with
   single-digit swap and free RAM headroom.
4. If the pristine run STILL starves: the fallback is llama.cpp directly (`llama-server` with
   mmap + `--n-cpu-moe` / `-ot "exps=CPU"` expert offload) — same SSD-hierarchy shape, and the
   identical GGUF already decodes cleanly under llama.cpp in Ollama. If two streaming runtimes
   both starve, it is the machine, not the engine.

## Pitfalls hit (do not repeat)

- Foreground terminal timeout caps (~600s) — long benches must go through a background process
  with completion notification.
- Do not block-wait on the bench; arm notification and continue other work.
- A reconstructed report written by an agent after a specialist died mid-run is PROVENANCE-
  FLAGGED data: read its header before trusting its numbers.
