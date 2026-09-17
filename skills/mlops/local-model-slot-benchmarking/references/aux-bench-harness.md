# aux-bench: a working slot-benchmark harness

Rust harness built 2026-08-31 at `~/projects/personal/aux-bench` (commits e566808,
d439840). Reference implementation of the procedure in SKILL.md. Rust chosen per the
standing preference to avoid Python for tooling.

## Shape

```
aux-bench/
  src/main.rs              # single binary, ureq + serde_json
  suites/<slot>.json       # one suite per auxiliary slot
  results/<run>.json|.log  # COMMITTED - benchmarks accumulate over time
```

Run:

```bash
cargo build --release
./target/release/aux-bench --suite suites/title_generation.json --out results/title_generation.json
./target/release/aux-bench --suite suites/title_generation.json --models gemma4:26b,ornith...
```

Flags: `--suite` (required), `--models` (default = all local), `--host`
(`$OLLAMA_HOST` or `http://127.0.0.1:11434`), `--out`, `--timeout`, `--keep-alive`.

## Suite format

```json
{
  "task": "title_generation",
  "system": "You generate short conversation titles. Output ONLY the title...",
  "options": { "num_predict": 40, "temperature": 0.3 },
  "cases": [
    {
      "name": "classifier_handoff",
      "user": "resuming a classifier benchmark handoff",
      "max_words": 6,
      "forbid_substrings": ["Hmm", "the user wants", "First,", "I need to", "Let me", "\n\n"],
      "expect_any": ["classifier", "benchmark", "handoff", "resume"]
    }
  ]
}
```

## Implementation notes that mattered

- Use Ollama's **native `/api/chat`**, not the OpenAI-compat route. Native keeps reasoning
  in a separate `thinking` field when the model honours `think:false`, which lets you
  distinguish "reasoned internally, returned empty" from "dumped CoT into content." The
  OpenAI-compat route collapses that signal.
- Read both `message.content` and `message.thinking` / `message.reasoning`. Empty content
  plus non-empty reasoning is a distinct, reportable failure mode.
- `keep_alive` default `"5m"`, NOT `0`. Setting `0` unloads after every single case and each
  call then pays a full model reload — this inflated one model to 21.6s of pure reload time
  and produced a bogus ranking.
- Two warm-up calls before scoring. One is not enough on 20GB+ models.
- Unload (`/api/generate` with `keep_alive: 0`) between candidates, not between cases.
- ureq 3.x API differs from 2.x: `Agent::config_builder().timeout_global(...)`,
  and `resp.body_mut().read_json()` instead of `resp.into_json()`.

## Measured: title_generation, 6 cases, 5 local models

Settled pass/fail (environment-independent):

| model | pass | failure mode |
|---|---|---|
| Ornith-1.5-35B-A3B-GGUF:Q5_K_M | 6/6 | — |
| gemma4:26b | 6/6 | — |
| qwen3:30b | 0/6 | leaks chain-of-thought into content |
| qwen3-30b-64k:latest | 0/6 | leaks chain-of-thought into content |
| muse-glimmer:latest | 0/6 | empty content |

Both qwen3 variants ignore `think:false` on **both** the OpenAI-compat and native routes,
answering instantly with `"Hmm, the user wants me to generate a short conversation title..."`
as the content, 30+ words, every case.

Latency, same models and suite, different conditions — the cautionary result:

| condition | Ornith | gemma4 |
|---|---|---|
| contended (stale background run resident) | 16606ms | 17180ms |
| idle, warm | 199ms | 189ms |
| idle, warm, order swapped | 188ms | 189ms |

The first row was reported as a finding and had to be retracted. Ornith and gemma4 are
**tied**; the apparent ordering in row 1 was contention plus cold load, not model speed.
Warm local title generation (~190ms) is *faster* than a cheap cloud call (~1.5s wall
including network), which reverses the intuition that local trades latency for cost.

## Extending

The harness currently speaks only Ollama's native `/api/chat`. Adding an OpenAI-compatible
mode (`--api openai`) would cover cheap cloud models and llama.cpp-backed servers such as
Kronk (`ardanlabs/kronk`, Go, OpenAI-compatible on :11435) in a single change, enabling
cost-effectiveness comparison across local and cloud in one table.
