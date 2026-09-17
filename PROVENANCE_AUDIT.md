# Provenance audit

## Finding

The repository's initial commit copied the locally installed skill corpus and labeled it as Wesley's reusable skills. Local installation is not evidence of authorship. The publication did not meet the repository's required provenance standard.

## Evidence

The removed import contained 156 skill packages:

- 71 had a byte-identical `SKILL.md` in the checked-out Hermes Agent built-in or optional skill collections.
- 32 were `ce-*` Compound Engineering skills whose canonical upstream is `EveryInc/compound-engineering-plugin`.
- 98 declared an author other than Wesley.
- 58 declared no author.
- 0 declared Wesley as an author.

Some categories overlap; these figures are evidence dimensions, not additive totals.

No imported package had sufficient repository-local evidence to classify it as authored by Wesley. Unmatched content was therefore treated as unproven rather than assumed to be original.

## Corrective action

All 156 imported packages were removed. The repository now publishes no installable skill until each candidate has evidence supporting one of these states:

- `authored`: written here from scratch;
- `derived`: substantively changed from a named upstream source, with attribution and compatible licensing;
- `imported_verbatim`: not republished here; linked to its canonical upstream instead.

The root README now points users to the known canonical collections for Hermes Agent, Compound Engineering, and Cloudflare skills.

## Release gate

A future skill release must include:

1. author and license metadata;
2. canonical upstream URL when derived;
3. a recorded upstream diff supporting the `derived` classification;
4. PII and secret scans across the complete package;
5. package-path and clean-install verification.
