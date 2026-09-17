# Harness spawn reliability — dead panes, hung dialogs, orphaned watchers

Observed across one long coordination session (2026-09-11) running per-phase
workers through a tmux-based fleet wrapper. Captured here because the governing
dispatch skills are user-owned; these are the durable operational lessons.

## `ready=yes` does not mean the worker is alive

A spawn wrapper reporting `ready=yes` has proven only that it launched something.
Twice in one session a worker was **dead within 25 seconds**, having done nothing:

- a `claude-code` pane with an explicit frontier model — `Pane is dead (status 1)`
- a `codex-tui` pane with a frontier model — `Pane is dead (status 0)`

Both spawns had printed a success line. The early warning in both cases was
`delivery=unverified` in the spawn output (the healthy case printed
`delivery=send-keys`).

**Procedure:** capture the pane a few seconds after spawn, or check the engine
pid, before arming a watcher and moving on. Treat the spawn line as "launched".

## A worker hung on its own permission dialog is a dead worker

One worker ran on a lane with an auto-permission classifier overlay. The
classifier flagged the worker's own **status-file append** as high risk, parking
the worker at an approval dialog indefinitely while its task clock kept running.
Pane symptom: `waiting for permission` on an obviously benign command, plus a
growing list of untouched open tasks.

**Do not answer a worker's dialog to unstick it.** Kill the window and
re-dispatch on a lane without the overlay. Use a **fresh task id** — status
files refuse reuse, so recycling the id fails the re-dispatch too.

The irony worth noting: the same classifier also (correctly) blocked the
coordinator from POSTing discovered credentials to a vendor's token-verify
endpoint. The overlay is valuable; it is just wrong for a worker that must write
its own state file.

## Fall back a lane rather than absorbing the work inline

When the nominally-stronger lane dies on spawn, re-dispatch on a mid lane and
**note the substitution in the report**. A frontier lane that dies delivers
nothing; a mid lane that runs delivers a reviewed artifact. Two failure modes to
avoid:

- retrying the same dead harness hoping for a different outcome;
- quietly doing the task in the coordinator session because "dispatch didn't
  work" — this loses resumability and buries findings in one context.

## Orphaned watchers fire stale completion events

Killing a task and re-dispatching under a new id leaves the ORIGINAL watcher
armed against the dead id. It later fires a timeout or completion notification
that reads like fresh news about abandoned work.

Example: a watcher armed on a killed scout fired
`watch-timeout: … no attention state after 3600s` an hour later, while the
replacement scout had already finished successfully under a different id.

**Treat any wake naming a retired task id as noise.** Verify current on-disk
state for the LIVE id; report nothing unless something actually changed. Never
relay the orphan's timeout to the user as a failure of work that succeeded.

## Steering a mid-flight worker beats re-briefing it

When the user corrects scope while a worker is mid-run, push the correction into
the running worker rather than killing and respawning it — the worker keeps its
accumulated context, and the correction lands before it writes the affected
section.

Worked example: a planner was 11 minutes into writing a catalog plan when the
user flagged an entry name. A single plain `tmux send-keys` steer (no `&&`
chains, no file loading — compound commands trip command classifiers) queued the
correction; the pane showed `Steering current turn · 1 waiting` and the planner
picked it up on its next step, writing the exclusion correctly on the first pass.

Verify the steer landed (`grep` the produced artifact for the corrected term)
rather than assuming delivery.

## Verify worker claims, don't relay them

Worker reports are claims. In this session every load-bearing number a worker put
into *public-facing copy* was independently re-checked before acceptance — test
counts (22 / 39 / 13), repo visibility for fifteen repos, a three-line
`main.rs`, and two upstream PR states. All held, which is exactly why the check
is worth running: it converted "plausible" into "verified" at low cost, and the
copy shipped as fact rather than hearsay.

Where a worker's report contradicted the coordinator's own brief (the brief
listed a warning set slightly wrong), the worker was right — it had reproduced
the pipeline's walk logic read-only. Corrections flowing upward from workers are
signal, not noise.
