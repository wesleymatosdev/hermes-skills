# Autonomous Pipeline Setup — Concrete Walkthrough

This reference details how to set up an active executor pipeline using Hermes
cron jobs, a BACKLOG.md file, and delegate_task subagents.

## When to use this

The user wants to wake up to completed work, not just status reports. They
have a backlog of tasks (P0-P3 priority) and want the agent to work through
them autonomously overnight, sending a digest to Telegram each tick.

## Components

### 1. BACKLOG.md (the contract)

Create a structured markdown file at the project root:

```markdown
# Project — Autonomous Pipeline Backlog

> Status values: todo -> in_progress -> in_review -> done (or blocked)
> Priority: P0 (critical) > P1 (high) > P2 (medium) > P3 (low/research)

## P0 — Critical

### P0-1: Title
- **Status:** todo
- **What:** description of the work
- **Deliverable:** what done looks like

## P1 — High
...
```

The orchestrator reads this every tick and updates Status inline.

### 2. Cron job

```
cronjob(action='create', {
  schedule: '30m',
  repeat: 0,            # CRITICAL: without this, duration schedules
                         # resolve to one-shot
  continuity: true,     # each tick gets previous output for dedup
  deliver: 'telegram',  # morning digest goes to phone
  workdir: '/path/to/project',
  enabled_toolsets: ['web', 'terminal', 'file', 'delegation'],
  prompt: '...self-contained orchestrator prompt...'
})
```

After creating, verify it's recurring:
```
cronjob(action='update', job_id='...', repeat: 0, schedule: '30m')
```

### 3. Orchestrator prompt (self-contained)

The cron prompt must contain:
- Path to BACKLOG.md
- Process: read backlog, pick highest-priority todo items, spawn subagents
- Guardrails: never merge, never deploy, never publish
- Conventions: file paths, repo locations, language preferences
- Continuity instructions: deduplicate against previous output
- Digest format: what was started, completed, blocked, needs user review

### 4. Subagent spawning

The orchestrator uses delegate_task to spawn workers:
- Max 3 concurrent (configurable via delegation.max_concurrent_children)
- Each gets a specific goal + context with file paths
- Orchestrator verifies results independently before marking done

## Verification checklist

- [ ] BACKLOG.md exists and has items with Status fields
- [ ] Cron job created with continuity=true, repeat=0, deliver=telegram
- [ ] First dry run triggered via cronjob(action='run')
- [ ] Artifacts verified to exist (ls -la, ffprobe, etc.)
- [ ] BACKLOG.md Status fields updated after first run
- [ ] Telegram digest received

## Known issues

- delegate_task may fail if the cron provider lacks an API key for
  delegation. The orchestrator falls back to inline execution — works for
  light items but loses parallelism.
- DeepSeek models via Ollama proxy may put response content in a `reasoning`
  field instead of `content`. Set max_tokens >= 500 to ensure the model gets
  past reasoning and produces actual content.
- The `repeat` field in cronjob create may default to 1 (one-shot) for
  duration schedules. Always set repeat=0 explicitly or update after creation.