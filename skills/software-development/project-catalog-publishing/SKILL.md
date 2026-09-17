---
name: project-catalog-publishing
description: "Use when publishing an index of your own work. Audit truth."
version: 1.0.0
---

# Project Catalog Publishing

Use when building, regenerating, or auditing a public index of your own work —
an OSS catalog, a portfolio, a skills directory, a "things I've built" page.

The delivery seam (DNS, Pages, TLS) belongs to `github-pages-deployment` and
`static-site-delivery`. This skill owns the part those don't: **is what the
catalog says actually true?** A catalog is a set of public claims about
repositories, and claims drift from reality silently. Nothing in the build
fails when an entry starts lying.

## The core risk

A catalog is generated once and trusted forever. Between generations, repos go
public, go private, get renamed, stop being maintained, or never get pushed at
all — and the catalog keeps asserting whatever was true the day the curated
table was hand-written. Every stale entry is a broken promise to a visitor:
a dead link, a "coming soon" for something already shipped, a tool that is
three lines of `cargo new`.

**Audit every entry against live reality before publishing. Never trust the
curated table.**

## Mandatory pre-publish audit

Run all of these. Each one caught a real defect in practice (see
`references/oss-catalog-audit-2026-09.md`).

### 1. Verify repository visibility per entry — every time

```bash
gh api repos/<owner>/<name> --jq '{private,stargazers_count,pushed_at}'
```

Two distinct failures live here, and they point opposite directions:

- **Entries marked local/unpublished whose repos are public.** The catalog
  renders "coming soon" for work that shipped weeks ago. Usually a pipeline
  bug: enrichment backfills some fields from the API (stars) but not others
  (url), so a hardcoded `url: None` survives forever.
- **Entries with a url pointing at a PRIVATE repo.** A dead link for every
  visitor. The tell in generated data: url-bearing entries whose `stars` is
  `null`, because the API never matched them.

Carry visibility as an explicit field (`public: bool`) and gate every outbound
link and star button on it. An entry that cannot be linked should say so
plainly rather than linking nowhere.

### 2. Sweep for client and third-party names

**A public catalog of your own work must never name a client.** Check the entry
name, the description, the URL, *and* every generated output — including
machine-facing ones like `llms.txt`, which exist specifically for scrapers.

When a per-client deployment shows up in the catalog, the fix is **exclusion,
not renaming**. A renamed client instance is still a client instance, still a
deployed artifact rather than a project, and (usually) still a private repo
behind a dead link. Record the exclusion reason in the pipeline so nobody
re-adds it later.

Gate it in verification:

```bash
grep -rin "<client-name>" data/*.json www/*.js www/llms.txt   # must be empty
```

Generalize the rule in the pipeline's comments: no client-identifying names in
any entry name, description, or url — ever.

### 3. Reconcile every claim against the code

Publishing a project's README copy publishes its overclaims. Before a
description ships, check the claim against the source. Recurring shapes:

- **"Cross-platform" with a platform-locked dependency.** Grep the encoder /
  backend / syscall layer for a hardcoded platform path with no fallback.
- **Install instructions for an unpublished package.** If the README says
  `npm install <pkg>`, confirm the package actually resolves on npm *and* any
  alternate registry. An unpublished 0.1.0 in the manifest is not a release.
- **Unfalsifiable praise.** "Battle-tested", "production-ready", "blazing
  fast" with no artifact to point at. Drop it or evidence it.
- **Stub repos catalogued as tools.** A `src/main.rs` that is still
  `fn main() { println!("Hello, world!"); }` does not get an entry. Read the
  entry point, don't trust the name.
- **False group blurbs.** "Forks kept alive with real work on them" over forks
  that are 0 commits ahead of upstream. Check with the GitHub compare API.
- **Upstream README text presented as your own work.** On a personal catalog,
  a fork's inherited description reads as authorship. Attribute or rewrite.

The model to imitate is a repo whose own README leads with
"proof of concept, unmaintained — use X instead." Honest state labels cost
nothing and buy all the credibility the catalog has.

### 4. Count before you design

Ask how many entries there are before agreeing to a per-entry layout. A
request for "a section for each project" over 70 entries buries the good work
under years of learning repos. Propose an explicit split — full sections for
the portfolio, compact rows for the archive — entry by entry, with a
justification per full-section pick. Let the user approve or move items; do
not silently decide the split.

## Star buttons and live counts

**GitHub `/stargazers` pages return 404 — globally, for every repo.** Verified
against both a personal repo and `microsoft/vscode`. Never link that path.
There is also no separate "star intent" URL: the repo page is the star surface.
A logged-out visitor clicking Star routes through
`github.com/login?return_to=<repo>`.

Ranked options:

| approach | live count | third-party request | verdict |
|---|---|---|---|
| plain anchor to repo + build-time count | no | none | **use this** |
| `buttons.github.io` / `ghbtns.com` iframe | yes | one per button | rejected — per-button third-party dependency |
| client-side `api.github.com` fetch | yes | yes | rejected — 60 req/hr per IP unauthenticated, adds a loading state to a static page |
| self-hosted like-counter (Firebase etc.) | own metric | yes + infra | rejected — not a GitHub star, and not self-hosted in any real sense |

Collect `stargazers_count` at generation time and render it beside a plain
anchor. The page's "generated <date>" line already discloses staleness.

**Design the zero state deliberately.** New catalogs have 0 stars on nearly
everything. Render nothing at 0 rather than a sad `★ 0` on every card.

Be honest in the copy: the button deep-links to the repo, where GitHub's own
Star control lives. Do not imply one-click starring from your page.

## Generated files are outputs, not files

Catalogs are almost always data-driven: one collector script emits JSON, a JS
global, and a text index. **Fix the pipeline, never the output.** A hand-edit
to generated data survives exactly until the next regeneration, and its loss
is silent.

Two pipeline features worth adding once and keeping:

- **An explicit exclude/ignore set** with a reason comment per entry, so
  deliberately-absent items stop producing warnings on every run and nobody
  re-adds them by accident.
- **Deterministic key order** in the entry dict, so regeneration diffs stay
  reviewable instead of churning.

Check idempotence: regenerate twice, confirm byte-identical output.

## What to keep OUT of the catalog

- **Per-client deployments and instances.** Not projects; often private; name
  leakage.
- **Operational repos that map your infrastructure.** Secret-manager vault and
  item names, provider endpoints, relay topology, private repo names. Even
  with zero secret *values* committed, the topology is the disclosure. Zero
  visitor value.
- **Upstream clones and PR-staging checkouts.** The contribution is real;
  represent it as one row pointing at the upstream repo and its merged PRs,
  not as entries for your local clones.
- **Stubs and scaffolds.** See above.

## Cross-property navigation

When the catalog is one of several sibling subdomains, a shared nav is the
usual follow-on ask. Two rules that matter:

- **Resolve before you link.** Sweep every sibling host's DNS and HTTP status
  before writing the nav (`github-pages-deployment` ships
  `scripts/subdomain-sweep.sh`). A nav pointing at `NXDOMAIN` is worse than
  no nav — and note that an existing hand-rolled link row may already be
  doing exactly that.
- **Prefer a vendored static partial over a JS injector.** Nav must render
  without JS; a per-site copy of one delimited block plus a sync script beats
  a script that leaves the nav absent when JS fails. For generator-backed
  sites, use the generator's own menu/config hook rather than fighting it.

## Verification

Assert on rendered content in a headless browser, never on HTTP status codes
(static hosts answer 200 for missing paths via 404 fallback). Prove:

- per-entry counts match the data, including per-group counts;
- any live filter/search still works across *both* entry shapes after a layout
  change;
- private-source entries render no repo anchor and no star button;
- unpublished entries render their "not yet published" state;
- the client-name grep is empty across every generated output;
- the page renders over `file://` if the catalog ships data as a JS global for
  exactly that reason.

## Dispatching this work to agent workers

A catalog audit fans out naturally (per-repo README reads, visibility checks,
browser research), so it tends to be dispatched to workers. Two rules the audit
depends on:

- **Re-verify every number a worker puts into public-facing copy.** Worker
  reports are claims. Test counts, repo visibility, stub detection, and PR
  states are all cheap to re-check with `gh api` / a direct file read, and copy
  that ships as fact should have been verified as fact. In practice the
  re-checks passed — which is the point: the cost is low and it converts
  "plausible" into "verified".
- **Corrections flowing upward from workers are signal.** When a worker's report
  contradicts the brief you wrote, the worker is often right (it read the code;
  the brief was from memory). Fold the correction in rather than restating the
  brief.

When the user corrects scope mid-run, steer the live worker instead of killing
and respawning — it keeps its context and applies the fix before writing the
affected section. See `references/harness-spawn-reliability.md` for the steering
mechanics plus the dead-pane, hung-dialog, and orphaned-watcher failure modes
that interrupt this kind of multi-phase run.

## Reference

See `references/oss-catalog-audit-2026-09.md` for the worked audit: 72 entries,
the ten false "coming soon" repos, five dead private links, a client name in
three generated files, and four overclaim findings — with the exact commands
that surfaced each.

See `references/harness-spawn-reliability.md` for worker-dispatch failure modes
hit during that audit: spawn lines that report success on a pane already dead,
auto-classifier overlays that hang a worker on its own status write, orphaned
watchers firing stale timeouts for retired task ids, and the plain `send-keys`
steer that lands a mid-run scope correction.
