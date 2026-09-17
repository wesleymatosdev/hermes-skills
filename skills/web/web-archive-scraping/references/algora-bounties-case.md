# Case study: scraping Algora's old bounty listings (2026-09-02)

Task: recover the list of projects + bounties Algora (algora.io) displayed on its website up to ~2025. The live site no longer shows the old listing pages.

## What worked

1. **CDX domain census** (`matchType=domain`, 2022–2025, `collapse=urlkey`, `limit=10000`, saved to file). The path census revealed the old URL structure: per-org bounty pages at `algora.io/<org>/bounties` (56 orgs captured: remotion, cal, browser-use, Qdrant, twentyhq, activepieces, trieve, windmill-labs, rustdesk, …), plus global `algora.io/bounties` and `algora.io/projects`.
2. **`/projects` page** names every project on the platform with one-line descriptions. **`/<org>/bounties` and `/bounties`** list bounties with GitHub issue link, issue title, and dollar amount (e.g. Golem Cloud #1514 $1,500; Cap #363 $500; Cal.com #11953 $500).
3. **HTML row structure** (2025-era Phoenix/LiveView app): each bounty row is `<a href="https://github.com/<org>/<repo>/issues/<n>">` containing avatar, org, issue number, amount, title — one extraction pass per page; GitHub links make rows self-identifying, so cross-snapshot dedupe is trivial.

## Hits along the way (do not repeat)

- `web.archive.org/web/2025/<url>` without `id_` → 4KB Wayback shell page, zero content.
- `id_` replay of `/bounties` and homepage → binary garbage → gzip; `gzip.decompress` fixed it. (One page, `remotion/bounties`, came back as plain HTML starting `<!DOCTYPE` — check per page, don't blanket-decompress.)
- First CDX call used default/small limit → only 500 rows, structure looked sparse; re-pull with `limit=10000` revealed all 56 orgs.
- GitHub bot-commenter search: `commenter:algora-io[bot]` (URL-encode brackets) finds only CURRENT bounty comments (12 results); the archived website listing pages were the richer source. Search API works unauthenticated, 10 req/min — sleep ~7s between queries.
- `gh` CLI reported tokens invalid (local keyring/TCC issue; tokens fine elsewhere); unauthenticated curl to api.github.com sidestepped it entirely.

## Data location

Fetch list built at `/tmp/algora_fetch_list.txt` (org → best snapshot ts → URL); decoded sample pages were at `/tmp/p_*.decoded.html`. /tmp is ephemeral — re-derive from the CDX index if gone.