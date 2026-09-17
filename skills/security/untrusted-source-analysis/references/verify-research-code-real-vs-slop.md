# Verifying whether untrusted "research" code is real or AI-padded slop

When a pseudonymous/bot source presents formally-styled "research" code (a
"unified theory" repo, an academic-looking framework), docs alone can both
over- and under-rate it. The honest way to tell a **working prototype** from
**pure AI padding** is to (1) cross-check its own docs against its own metrics,
and (2) run the code safely in isolation.

## A. Docs-vs-metrics cross-check (no code needed)

Pull the README plus status/implementation/catalog docs (`CURRENT_STATE.md`,
`IMPLEMENTATION_SUMMARY.md`, `EXPERIMENTS_CATALOG.md`, `STATUS.md`) and the git
tree (to see which files exist). Then compare every headline number to the
docs' own numbers. Classic padding tells:
- Claims "22 working experiments" but its own summary admits "8 working".
- Claims "12/12 tests passing" but the summary says "11/11", and the tests are
  smoke checks ("verify import works", `assert hasattr(cls, ...)`).
- Claims "~7,000 lines" but the summary says "~3,400".
- Claims "Four Core Theorems (Proven)" but no proofs/lemmas/derivations exist —
  the "theorems" are named concepts in the prose.
- Absent grounding: simulations citing no real dataset (no IPA, no corpora),
  "0.165% false-positive rate" with no methodology, "novel contribution" that
  is standard textbook re-labeling.

Feed the actual code + docs to the **zero-tool sandboxed model** (the same
injection-hardened contract as `github-honeypot-signals.md`) and ask it to be
skeptical: quote real function/test names and line-level evidence, don't be
flattered by jargon.

## B. Run the code safely (isolated)

Pull only raw source files via `raw.githubusercontent.com/<owner>/<repo>/main/<path>`
(not the API — avoids the ~60/hr rate limit) into a throwaway dir. Execute
with the **plain system python in that dir** — never the agent's own
context/venv, no `pip install` of untrusted deps (plain numpy is fine). Use
`python3 -c` one-liners and the file's own `__main__` block.

**Do NOT pipe through `tail`/`head`** — that masks the real exit code (the pipe
makes exit_code report tail's 0). Run bare and read the exit status directly.

### Expected finding for a vanity-press repo
The code is REAL and runs — field solvers produce bounded, NaN-free output and
conservation tests pass under the correct physics conditions — BUT the claims
are inflated:
- the test suite fails as shipped (`ModuleNotFoundError: No module named 'src'`
  unless `PYTHONPATH=.`),
- a core module emits NaN/divide-by-zero warnings on its own default input.
That is the tell: **working prototype scaffolding wrapped in a fabricated
"unified theory"**. It is not pure slop (the numerics are real), but it is not
the peer-reviewed research the docs claim either.

## Safety gate
Running untrusted code is a decision: only do it in an isolated temp dir with
no network, no writes, no agent venv. If you cannot guarantee isolation, state
the verdict from the docs alone.

## Worked example
`standardgalactic/flyxion` `rsvp` suite: `field_solver.py` + conservation
tests actually pass (entropy non-neg, energy decay), but `network_rg.py`
throws divide-by-zero/NaN warnings on its own default input and the test suite
fails as shipped unless `PYTHONPATH=.` is set → real prototype code under a
fabricated "RSVP unified theory" brand. Compare against a real paper
(DeepSeek-R1, arXiv:2501.12948, published in Nature): real authors/affiliations,
a peer-review gate, concrete reproducible benchmark numbers (AIME pass@1
15.6%→71.0%), open-sourced weights. The difference is the **verification chain**
— authorship, venue, reproducibility, testability — not the prose style.
