---
name: integration-contract-verification
description: Verify mocks and adapters against real API contracts.
license: MIT
metadata:
  hermes:
    tags: [verification, testing, mocks, contracts, code-review, agents]
    related_skills: [proof-bearing-verification, requesting-code-review]
---

# Integration Contract Verification

Use when writing or reviewing mocks/e2e harnesses for a local daemon or API,
when an integration suite is green but unproven against the live service, or
when reviewing agent-authored adapter/connector code for slop. Mocks,
fixtures, and agent-written integration code describe an external system from
memory; the real system's route registry, DTO structs, and wire payloads are
the only authority. A green suite against an invented mock proves the mock,
not the integration.

## Procedure

1. **Locate the real contract source before trusting any fixture.**
   - Find the service's route registrations, DTO/response structs, and its
     own client or frontend types — these encode the actual wire shapes.
   - Diff every mock route, field name, enum value, and service identifier
     against them. Common drift: invented wrapper fields (e.g. a
     `pendingApprovals` array where the real payload models approvals as
     timeline items), wrong key names (`agents[]` vs `supported[]`,
     `decisionId` vs `id`), wrong service id strings in health payloads,
     fabricated status codes.
2. **Run one read-only smoke pass against the real service.**
   - Headless/ephemeral instance with isolated data dir, run file, and port
     env overrides when the service supports them; never the user's
     production instance or profile.
   - Exercise only non-mutating endpoints; assert the same identifiers the
     mock-based suite asserts (service name, envelope shape). This is the
     only layer that catches contract drift the mock cemented.
3. **Tear down completely** — kill the ephemeral process, verify the port is
   closed, delete the temp data dir.

## Reviewing agent-authored adapters/connectors

Agent-written integration code systematically fabricates its integration
surface. Review in this order; each pass is cheap and catches the next
pass's blind spots:

1. **Gates first.** Run the project's own build/vet/lint/test commands (from
   its AGENTS.md or CI config) before reading the code. A failing gate is
   disqualifying and yields concrete violations (unused imports, invalid
   enum values) faster than manual review.
2. **Verify every claim against the real thing.** Check each comment and
   string — CLI flag names and values, env-var mechanisms, config file
   paths, "X is not supported" statements — against the real binary
   (`--help`), the real config files, and the service source. Typical slop:
   flag values from a different tool's vocabulary, env vars mentioned only
   in comments and never set anywhere, "no resume mechanism" claims when
   the binary documents a resume flag.
3. **Check reachability wiring.** Grep the registry entries, domain enums,
   and generated schema that make the new code loadable. An adapter that is
   never registered is dead code regardless of internal quality.
4. **Compare against the sibling template** the repo's own docs name as the
   pattern to copy. Hand-rolled substitutes for provided helpers (custom
   binary-resolution loops where a shared BinarySpec utility exists) are
   slop signals, as are placeholder files and zero tests where siblings ship
   table tests.

## Pitfalls

- A poll helper that tests `fn()` truthiness passes on the first tick when
  the predicate is async — a Promise is always truthy, so the wait never
  waits and the readiness check is vacuous. Await the predicate inside the
  loop and return an explicit boolean; when fixing this, the predicate must
  resolve to `true` on success, not `undefined`, or the wait times out
  against a healthy service.
- Non-strict JSON decode on the server side silently drops unknown request
  fields — a client sending a field the DTO lacks fails no test and does
  nothing live. Confirm the field exists in the request DTO before exposing
  it as a tool/flag option.
- Docs and skills that teach a mock's invented shape ("read the
  `pendingApprovals` field") keep failing silently after the mock is fixed —
  update every layer that describes the shape, not just the fixture.
