# Deepening a bot-account analysis: unmask the persona + verify its claims

Once you've characterized a source as a bot/pseudonym account (see
`github-honeypot-signals.md`), two deeper questions usually follow. Both are
safe and repeatable; neither requires trusting the source's content.

## 1. Tracing the human behind a pseudonym (no API rate limit needed)

GitHub's **REST API rate-limits unauthenticated requests (~60/hr core)**. To keep
digging past the limit, use the plain HTML pages and the **raw / atom endpoints**
which are not throttled the same way:

- **Probe whether a handle is a real account:** `curl -s -o /dev/null -w "%{http_code}"
  -A "Mozilla/5.0" "https://github.com/<handle>"`. A `200` means a real profile;
  `404` means none.
- **Commit author names/emails:** `curl -s "https://github.com/<owner>/<repo>/commits.atom"`
  → grep `<name>` / `<email>`. GitHub hides author *emails* by default but
  returns the author *handle*; several pseudonymous personas reuse a distinct
  commit handle that differs from the account login.
- **Profile page payload:** `curl -s -A "Mozilla/5.0" "https://github.com/<handle>"`
  saves a ~200KB HTML page. Grep `itemprop="name|additionalName|homeLocation|
  worksFor|description"` for identity fields and `<meta name="description"`
  for repo count. A large empty `itemprop="name"` = deliberately anonymized.
- **AUTHORS.md / README on the account's own repos** often names the author
  handle (e.g. a repo's `AUTHORS.md` listed `Flyxion`). Fetch via
  `raw.githubusercontent.com/<owner>/<repo>/<branch>/<file>` — a separate host,
  not API-throttled.
- **The persona's own framing is the tell.** Read the tagline of repos named
  `vanity-press-economy` (Latin "Argumenta ad Absurda"), `profile-README`, or
  a "research program" catalog — a self-aware label reveals the author knows
  exactly what they're producing (e.g. a one-man vanity-press theory factory).

**Honest stopping rule:** if the public trail (web search, page probes, atom
feeds, raw files) yields **no real name, no employer, no LinkedIn**, stop and
report that the identity is deliberately anonymized. Do NOT keep hammering
rate-limited endpoints to un-mask it — absence of signal is the finding.

## Verifying whether "research" claims are real or AI-generated padding

AI-assist tooling lets one person mass-produce formally-styled theory. To test
whether a repo's claims hold up, cross-check its **own documents against its
own metrics** (no need to run code):

1. Pull the README plus any status/implementation/catalog docs
   (`CURRENT_STATE.md`, `IMPLEMENTATION_SUMMARY.md`, `EXPERIMENTS_CATALOG.md`,
   `STATUS.md`), and the repo's git tree to see which files actually exist.
2. **Compare every headline number to the docs' own numbers.** Classic padding:
   - Claims "22 working experiments" but its own summary admits "8 working".
   - Claims "12/12 tests passing" but the summary says "11/11", and the tests
     are smoke checks ("verify import works", `assert hasattr(cls, ...)`).
   - Claims "~7,000 lines" but the summary says "~3,400".
   - Claims "Four Core Theorems (Proven)" but no proofs, lemmas, or derivations
     exist anywhere — the "theorems" are named concepts in the prose.
3. **Look for absent grounding:** simulations that cite no real dataset (no IPA,
   no historical corpora), "0.165% false-positive rate" with no methodology, and
   "novel contribution" claims that are standard textbook re-labeling.
4. Feed the actual code + docs to the **zero-tool sandboxed model** (the same
   injection-hardened contract) and ask it to be skeptical — quote real
   function/test names and line-level evidence, don't be flattered by jargon.
5. Do NOT run the code to "verify" unless you're sure it's safe; you can state
   the verdict from the docs alone. Running untrusted code is a separate
   decision (isolated throwaway venv, or skip).

**AI-padding tells:** inflated metrics vs own docs, jargon over substance,
unverifiable statistics, "NEW"/unimplemented labels on listed features, and a
glossy "unified framework" applied to many unrelated fields.

## Worked session notes (what this landed on)

`standardgalactic` (mirror bot, 24k repos) author = pseudonym **Flyxion**:
`github.com/flyxion` (real, 8 repos, empty name), commit author `flyxion`, plus
a `vanity-press-economy` repo taglined to absurdity — i.e. a self-aware
AI-assisted vanity-press theory author, not a conspiracy bot. Its
`language-evolution` repo's "proven theorems / 22 experiments / 12 tests"
claims did not hold up against its own docs (no proofs, smoke tests only,
inflated counts).
