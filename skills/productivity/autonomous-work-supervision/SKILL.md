---
name: autonomous-work-supervision
description: "Use when supervising work while user owns priorities."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [monitoring, cron, project-management, autonomous-work, escalation]
---

# Autonomous Work Supervision

Use when a user wants a recurring product-manager or operations layer that keeps active work moving while they are away, while the user retains control of priorities and irreversible decisions.

## Operating Boundary

- The user owns priorities, scope changes, budget, public commitments, and merges.
- The supervisor owns observation, status collection, stale-work detection, concise blocker reporting, and proposing the next safe action.
- Do not silently reprioritize, merge, post externally, dismiss review findings, or approve security-sensitive actions.
- Treat an existing task system, CI pipeline, PR tracker, or worker state as the source of truth. Do not reconstruct status from memory.

## Setup Procedure

1. **Discover the work surfaces.** Identify the task tracker, active-worker state, pull requests, CI system, and validation pipeline that matter for the user's workflow.
2. **Define reportable states.** At minimum: active, waiting on CI, needs user decision, blocked, failed, and complete.
3. **Define a quiet path.** Use monitor hashing or continuity so unchanged healthy state does not generate repetitive messages.
4. **Create a self-contained recurring job.** Name the exact sources to inspect, prohibit writes by default, state the user's authority boundary, and require direct links or identifiers for every blocker.
5. **Make escalation actionable.** Say what is blocked, why, the smallest safe next action, and whether it needs a user decision.
6. **Verify the first run.** Inspect its output before calling the monitor ready.

## Recommended Reporting Shape

Only report material changes or problems:

```markdown
## Work pulse

- **Blocked:** <work item> — <cause>. Next safe action: <action>. **Needs you:** <decision>, if any.
- **Waiting:** <PR/task> — <specific external state>.
- **Completed:** <work item> — <verified result/link>.
```

If every inspected surface is healthy and unchanged, remain silent where the scheduler supports it; otherwise send one brief `No material change` update.

## Pipeline and PR Feedback

When a review comment lands on a change already under validation:

1. Inspect the current pipeline state before touching the branch.
2. Do not hand-edit or start a parallel validation run while a gate still owns the branch.
3. If the run has ended, resolve the feedback with a regression test first, then run the owning pipeline again.
4. Preserve the branch and earlier pipeline-fix commits; do not reset or replace history merely to restart validation.
5. Report a blocked pipeline as a blocker, not a completed fix.

## Worker Lifecycle and Safe Cleanup

For tmux-backed workers or similar mutable process surfaces:

1. Treat the task status file as the source of truth, but inspect the live pane/process when a watcher times out. A timeout is not proof of worker failure.
2. If an interactive worker is stalled on a permission dialog, do not answer the dialog on its behalf. Record the exact failure cause, stop treating that attempt as healthy, and retry once with a fresh task ID and the harness's automatic permission mode. For Claude Code, the installed spelling is `--permission-mode auto`; do not invent a `--mode auto` flag.
3. Never delete windows by numeric index while iterating: deletion renumbers later windows. Snapshot stable window IDs, revalidate ID/name/status immediately before mutation, and prefer moving terminal work into a separate, inspectable parking session over killing it.
4. Test cleanup in dry-run mode first. Do not install a recurring cleanup job until one manual parking run has produced an accurate candidate list and the parked result has been inspected.

## Pipeline and PR Feedback

When a review comment lands on a change already under validation:

1. Inspect the current pipeline state before touching the branch.
2. Do not hand-edit or start a parallel validation run while a gate still owns the branch.
3. If the run has ended, resolve the feedback with a regression test first, then run the owning pipeline again.
4. Preserve the branch and earlier pipeline-fix commits; do not reset or replace history merely to restart validation.
5. Report a blocked pipeline as a blocker, not a completed fix.

## Pitfalls

- A dashboard is not a product manager if it only repeats raw logs. It must identify ownership and the smallest next safe action.
- A monitor that sends routine identical updates becomes noise. Prefer change detection.
- “Keep things moving” does not authorize hidden scope expansion or merges.
- Never claim a PR or pipeline is green based only on a local process being alive; read its current external status.
- Never treat a watcher timeout as a terminal task state without reading the status file, report, and live pane.
- Never remove a mutable resource by a shifting positional index; stable identity plus immediate revalidation is mandatory.
