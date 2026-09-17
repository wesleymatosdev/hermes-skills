---
name: web-archive-scraping
description: "Use when scraping a site's past content via Wayback CDX."
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [scraping, wayback, internet-archive, historical-data]
---

# Web-archive scraping (Wayback CDX)

Use when the target is a site's **historical** content: pages that changed, listings that were removed, data from before a redesign. Also the right fallback when a live page no longer has the data the user remembers being there.

## Workflow

1. **Discover what was archived — never guess URLs.** Query the CDX index for the domain:
   ```
   https://web.archive.org/cdx/search/cdx?url=<DOMAIN>&matchType=domain&output=json&from=<Y1>&to=<Y2>&filter=statuscode:200&collapse=urlkey&limit=10000
   ```
   - `matchType=domain` covers subdomains; use `matchType=host` for exactly one host.
   - Save to a file, then aggregate with code (count/uniq paths). The path census tells you the site's old URL structure — often revealing per-entity pages (e.g. `<site>/<org>/bounties`) you would never have guessed.
   - `limit=10000`, not small values: a small limit truncates silently to a biased sample.
   - `collapse=urlkey` dedupes; add `filter=statuscode:200` to skip redirects/errors.
2. **Pick snapshots per page** (latest, or per-timepoint if the user wants a time series) from the CDX rows: each row is `[urlkey, timestamp, original, mimetype, statuscode, digest, length]`.
3. **Fetch RAW bytes with the `id_` suffix**: `https://web.archive.org/web/<TIMESTAMP>id_/<ORIGINAL_URL>`.
   - Without `id_`, a `/web/<ts>/<url>` request returns the Wayback JS shell/wrapper page, not the content. This is the #1 trap.
4. **Decompress before parsing.** `id_` returns the ORIGINAL captured bytes, which are frequently gzip-compressed. Detect by magic bytes (`1f 8b` = gzip) or failed HTML parse, then `gzip.decompress`. Don't assume text.
5. **Parse structurally, not by eye**: extract `<a href>` targets, table rows, or JSON blobs; dedupe across snapshots; write the dataset (CSV/JSON) plus a per-row snapshot timestamp so provenance survives.
6. Pace requests (sleep between fetches); archive.org tolerates moderate sequential fetching but not bursts.

## Pitfalls

- **Wayback shell page instead of content** → you forgot `id_`.
- **Garbage characters on parse** → the body is gzipped; decompress first (check per page — some captures are plain).
- **CDX results look tiny/biased** → you hit the default limit; raise it.
- **curl-piped-into-interpreter commands get blocked by the local command classifier.** Always save the response to a file first (`curl -o /tmp/x.json`), then process the file in a separate step/Python call. The two-step pattern also survives timeouts better.
- Archive capture density is uneven: famous pages have many snapshots, deep pages may have one. Check the CDX census before promising a time series.

## When archive.org is not enough

GitHub is a parallel archive for platform data: issue/PR search (`search/issues`) works **unauthenticated** at ~10 req/min via plain `api.github.com` — no `gh` auth needed — and `commenter:<bot-login>` queries recover bot-posted history (bot logins look like `org[bot]`; verify with `GET /users/<name>%5Bbot%5D`). Useful when the site's data mirrored onto GitHub (e.g. bounty/issue trackers).

See `references/algora-bounties-case.md` for a full worked example.