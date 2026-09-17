---
name: subagent-recovery
description: "Recover a crashed background subagent's state from disk."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [delegate_task, subagent, recovery, restart, crash-recovery, delegation]
    related_skills: [hermes-agent, tmux-persistent-agent-session, orchestrating-tmux-cli-agents]
---

# Recovering interrupted subagent work

## Trigger

The user reports "the computer restarted" / "everything went down" / "check on that
background task" and the last thing you have on record is a chat message saying
work was "dispatched in the background" (`delegate_task`) or running in a spawned
`hermes`/tmux session. Do not trust that message as current state — a background
subagent process dies silently with the host machine/session; nothing marks it
failed, and `delegate_task(action='list')` only shows *live* children of THIS
session, so a subagent orphaned by a restart simply won't appear — that absence is
not proof it finished or wasn't started.

## Recovery procedure

1. **Find the dispatch call.** `session_search` for the goal text or the chat
   message that said "dispatched in the background." Its tool-call result contains
   `delegation_id` and `subagent_ids`, plus a `live_transcripts` path like
   `~/.hermes/cache/delegation/live/<delegation_id>/task-0.log`.
2. **Read the live transcript file directly** (it survives process death — it's
   just a file on disk, append-only while the child ran). It shows a timestamped
   line per tool call: what the child actually did, in what order, and the exact
   last action before it went silent. This is ground truth for "how far did it get,"
   not the chat summary that was written *before* the child's real final actions.
3. **Cross-check against the actual target repo/filesystem**, not the transcript's
   claims: `git status`, `git diff --stat`, `git log` in the repo the child was
   touching. The transcript tells you intent ("wrote sw.js, about to read main.tsx
   to register it"); `git diff`/`git status` tells you what's actually sitting on
   disk right now — uncommitted, committed, or never written. Report the disk
   state, not the transcript's narration, when they'd otherwise conflict.
4. **Report precisely where it stopped** — which files/steps are done, which are
   half-done (e.g. "manifest + service worker files exist, but nothing registers
   the service worker yet, and the build was never verified") — not a vague
   "probably fine" or "in progress." The user needs to know exactly what's left
   to finish the class of work, not just that something ran.
5. **Classify why it stopped before blaming the provider.** Distinguish local
   supervisor/tool timeout, host/process exit, user cancellation, provider 429,
   and model failure from the evidence. A process killed at the tool's timeout
   boundary (often exit `-9`) is a local supervision failure, not provider
   instability. Preserve that classification for routing and observability.
6. **Resume the exact durable session when one exists.** For a Hermes worker,
   recover its exact session ID and resume it with a supervisor timeout longer
   than the expected task. Do not silently substitute a similar session or
   restart from the original brief if committed/uncommitted work is salvageable.
   Instruct the resumed worker to inspect and preserve disk state first.
7. Only after that ground-truth check, redispatch or resume a worker that picks
   up exactly where the old one left off (reference the specific missing step)
   rather than restating the original goal from scratch.

## Before dispatch: confirm the delegated model is alive

A child spawned on an exhausted/dead credential dies in seconds and its batch-
completion notice arrives later looking like a normal (if truncated) result. Before
or immediately after spawning: check the credential pool status in
`~/.hermes/auth.json` (`last_status: exhausted`, `last_error_code: 429`) for the
delegation provider, and ~30s after spawn `tail` the live transcript — a healthy
child shows its first tool call within ~15s; an auth-dead one shows `API call
failed after 3 retries: HTTP 429` and `exit_reason=max_iterations` almost
immediately. Switch `delegation.model`/`delegation.provider` (`hermes config set …`)
and respawn; don't redispatch onto the same dead credential.

## Exit zero does not prove a completed artifact

Treat a normal harness exit as process status only. Permission auto-rejection,
placeholder-only output, and an unfinished rewrite can all end with exit 0.
Before accepting a coding result, inspect the final transcript AND run the
smallest real build/test gate. Missing entry points or implementation replaced
by comments mean failed work, regardless of the completion notice.

For a failed refactor, preserve tracked diffs AND untracked files on a reference
branch/commit before repairing anything. Keep the original HEAD as the behavioral
baseline; test it in an isolated worktree, then compare the recovered implementation
against it. A scaffold compiling is not behavioral parity. Independently rerun
workspace tests and lint, and distinguish fixture/CLI parity from an unexercised
live agent dispatch. Never discard partial work merely to obtain a clean tree.

See [zero-exit refactor recovery](references/zero-exit-refactor-recovery.md)
for a preservation and acceptance checklist.

## "Interrupted" ≠ "didn't finish"

A completion notice with `status=interrupted` (e.g. model-response timeout) can
arrive after the child already did all the work — only its closing summary was
lost. Before redispatching: check disk (`git log`, the deliverable files, the audit
doc the brief required). If the work is there, verify it independently instead of
re-running the task — the child's summary is a self-report; re-derive the claims
(grep the file for each promised fix, re-run the checks in a real browser). Expect
to find gaps the child didn't (this session: a 282px overflow its checklist never
covered) — that's the point of independent verification.

## Dispatch is not confirmed by intent

A shell invocation, one output line, or an ambiguous `exit ?` is not a running
worker. Treat dispatch as confirmed only when you have either (a) a durable
session/process handle that can be inspected, or (b) a completed synchronous
run whose exit status and output are available. If neither exists, correct the
invocation and dispatch again before reporting that work is underway.

## Pitfall

Do not equate "no live subagent in `delegate_task(action='list')`" with "nothing
was running" or "it must have finished." A silently-orphaned subagent from a dead
session is indistinguishable from "never dispatched" in that listing — the only
way to tell them apart is the transcript log + real repo state per steps 2–3.
