# Project — Autonomous Pipeline Backlog

> This file is the single source of truth for the autonomous pipeline.
> The orchestrator reads this every 30 min, picks the next unstarted item(s),
> spawns subagents to work them, and updates status inline.
>
> **Status values:** `todo` -> `in_progress` -> `in_review` -> `done` (or `blocked`)
> **Priority:** P0 (critical) > P1 (high) > P2 (medium) > P3 (low/research)
>
> **Guardrails:** Code, test, open PRs, research freely. NEVER merge, deploy, or
> publish without the user's explicit approval. Leave PRs open for morning review.

---

## P0 — Critical (blocking something visible)

### P0-1: [Title]
- **Status:** todo
- **Repo:** [path or org/repo]
- **What:** [description of the work]
- **Deliverable:** [what done looks like]

---

## P1 — High (should ship this week)

### P1-1: [Title]
- **Status:** todo
- **What:** [description]
- **Deliverable:** [expected output]

---

## P2 — Medium (important, not urgent)

### P2-1: [Title]
- **Status:** todo
- **What:** [description]
- **Deliverable:** [expected output]

---

## P3 — Research / Low priority

### P3-1: [Title]
- **Status:** todo
- **What:** [description]
- **Deliverable:** [expected output]

---

## Completed

(none yet — items move here when done)

---

## Session Log

(The orchestrator appends a summary here after each tick.)

## How the pipeline works

1. Every 30 min, the orchestrator wakes up and reads this file.
2. It picks the highest-priority `todo` item(s) that aren't blocked.
3. It spawns subagents via delegate_task to work them in parallel.
4. When a subagent finishes, the orchestrator updates the item's status here.
5. A digest of what was completed/started/blocked is sent to Telegram.
6. The user reviews in the morning, merges PRs, and refines the backlog.

**To add items:** Just add a new section under the relevant priority heading.
Format: `### P{N}-{seq}: Title` with Status, What, Deliverable fields.