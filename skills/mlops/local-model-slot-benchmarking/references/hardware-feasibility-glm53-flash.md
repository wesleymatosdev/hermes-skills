# Case study: glm-5.3-flash feasibility on 48GB Mac vs 32GB Ryzen box (2026-08-31)

Session-validated hardware-feasibility walkthrough. Model: GLM-5.3-Flash — 320B total / 18B active MoE, hybrid linear attention (34 of 45 layers), 1M context, multimodal, MIT license.

## Key facts verified via web search (2026-08-31)

- Smallest published build: Unsloth `UD-IQ1_S` GGUF = **93.1 GB** (decimal, summed across shards). Full ladder: UD-IQ1_M 97.6, UD-Q2_K_XL 108.7, UD-IQ3_XXS 120.4, UD-Q3_K_XL 147.5, UD-IQ4_XS 156.8, UD-Q4_K_XL 199.7.
- Source: `unsloth/GLM-5.3-Flash-GGUF` on Hugging Face. Runs only on Unsloth's llama.cpp fork (branch `glm5next/upstream`, PR #61) — glm5_next architecture NOT merged in mainline llama.cpp as of 2026-08-31.
- Ollama's only tag is `glm-5.3-flash:cloud` (hosted, no local weights). LM Studio has no local build either (downstream of mainline llama.cpp).
- Total params set the memory bill (320B ≈ 180-195GB at Q4); active params (18B) only set speed.
- Multimodal needs the separate `mmproj-BF16.gguf` projector (~1.2GB).

## The decision that was made

- 48GB MacBook: unusable — 93GB > 48GB unified memory (even ~44GB after `iogpu.wired_limit_mb`). No cleanup level fixes this; RAM is the wall, not SSD.
- 32GB Ryzen desktop with NPU: unusable — iGPU/NPU share the CPU's 32GB RAM pool (no capacity gain), and llama.cpp doesn't target XDNA NPUs anyway.
- Outcome: stay cloud (`glm-5.3-flash:cloud` or Z.ai API, ~$0.25/M output tokens); locally the existing ~35B-class MoE lineup (Ornith-1.5-35B, qwen3-30b, gemma4 26B) is already the 48GB ceiling.

## User-correction sequence (context for the reasoning)

1. User proposed Windows box (2TB 7000MB/s SSD) vs Mac. First analysis: SSD irrelevant, RAM/VRAM decides — asked for the PC's RAM/GPU.
2. Answer "32GB" → Mac recommended (bigger pool + Metal).
3. Correction "it has a Ryzen NPU + iGPU" → NPU adds compute, not memory; still Mac — but then research showed even the Mac can't hold the 93GB smallest build.
4. Follow-up "can't I clean the SSD more?" → cleanup frees storage, not RAM; inference needs weights resident; swap-thrash never viable.
5. Follow-up "so Colibri just runs the same models Ollama can?" → yes: frontends wrap the same runtime and weights; the RAM ceiling is physics, not software. Note: nothing called "Colibri" was found installed on the machine (apps, brew, projects, Hermes config, Spotlight all searched) — the frontend comparison was answered generically.

## Lesson to carry

Lead with the capacity check (smallest-build size vs usable RAM) before ANY comparison of machines, quant ladders, or frontends. It collapses the whole decision tree in one step and prevents three rounds of optimistic back-and-forth. Secondary lesson: verify a "known" app name exists on the user's machine before reasoning about its capabilities.
