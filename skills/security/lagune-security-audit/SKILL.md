---
name: lagune-security-audit
description: "Run a Lagune read-only security audit via Claude Code."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Security, Audit, Lagune, Claude-Code, SDH, Read-Only]
    related_skills: [claude-code, github-code-review]
---

# Lagune Security Audit

Run [Lagune](https://lagune.ai) (Security-Driven Hardening) against a codebase. Lagune is NOT a
scanner binary — it's a command/skill pack installed into an AI coding agent (`.claude/skills/lagune*`).
The agent (Claude Code) does the work, guided by Lagune's five-phase Blue Team flow.

## When to use
User says "run lagune on <repo>" or wants an AI-driven security audit/hardening of a codebase.

## The five phases (1–3 are READ-ONLY; 4 changes code)
1. `/lagune.charter` — derive/set the project's security principles (writes `.lagune/memory/charter.md`)
2. `/lagune.detect`  — read the code, map what it does + where risks are (`detect.md`) — READ ONLY, slow (dozens of shell reads)
3. `/lagune.plan`    — score each finding (CVSS), pair a fix, write `plan.md` + `tracking.json` — READ ONLY
4. `/lagune.harden`  — **applies fixes to code, one at a time** — STOP here unless the user approved code changes
5. `/lagune.verify`  — prove each applied fix holds

**Default to charter→detect→plan (audit only). Never run `/lagune.harden` without explicit user go-ahead.**

## Critical setup decisions (ASK the user first)
- **Whose repo / which account?** Company repos are often owned by another macOS user and not writable by you.
  Run Claude Code AS THE OWNER (`sudo -u <owner>`), don't chown a live repo.
- **Scope?** Isolated git worktree + new branch off clean `main` (not the dirty working tree). Audit-only vs through-harden.
- These are real trade-offs — use the clarify tool with multi-question.

## Procedure

### 0. Locate repo + confirm ownership/writability
```
find ~ /Users/* -maxdepth 5 -type d -iname "*<repo>*" 2>/dev/null
git -C <repo> config --global --add safe.directory <repo>   # if "dubious ownership"
ls -ld <repo>; whoami   # is it writable by me?
test -w <repo> && echo WRITABLE || echo "NOT writable — run as owner"
```

### 1. Run-as another user (when repo owned by e.g. Influencer.com)
`sudo -u <owner>` needs a password. Ask the user to add a scoped, temporary sudoers drop-in LOCALLY:
```
echo '<me> ALL=(<owner>) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/lagune-temp
sudo chmod 440 /etc/sudoers.d/lagune-temp && sudo visudo -cf /etc/sudoers.d/lagune-temp   # -> parsed OK
```
This grants ONLY run-as-<owner>, not root. Remove it at teardown: `sudo rm /etc/sudoers.d/lagune-temp`.
Verify: `sudo -n -u <owner> whoami`.

### 2. Isolated worktree off clean main + install Lagune
```
sudo -n -u <owner> bash -lc '
  cd <repo>
  git worktree add -b lagune-hardening <repo>-lagune-audit HEAD
  cd <repo>-lagune-audit
  export HOME=/Users/<owner> npm_config_cache=/Users/<owner>/.npm   # avoid EACCES on your npm cache
  npx -y lagune@latest init claude   # MUST name the agent (claude); bare init errors
'
```

### 3. Auth Claude Code as the owner (no keychain login available via sudo)
That account usually has no unlocked keychain. Pass YOUR OAuth token via an owner-only file (never on argv/chat):
```
# stage token through stdin into owner's home
sudo -n -u <owner> env HOME=/Users/<owner> bash -c 'umask 077; cat > ~/.cc_tok' <<< "$CLAUDE_CODE_OAUTH_TOKEN"
# launch, sourcing token then shredding the file
tmux send-keys -t lagune "cd <wt> && export CLAUDE_CODE_OAUTH_TOKEN=\$(cat ~/.cc_tok) && rm -f ~/.cc_tok && claude" Enter
```
(If the owner is logged into the GUI, their keychain is unlocked and `claude` may already be authed.)

### 4. Drive the phases in tmux (as owner)
```
sudo -n -u <owner> env HOME=/Users/<owner> bash -lc '
  tmux new-session -d -s lagune -x 200 -y 50
  tmux send-keys -t lagune "cd <wt> && export HOME=/Users/<owner> && claude" Enter'
# then, per phase: type the command, THEN send Enter as a SEPARATE call
tmux send-keys -t lagune "/lagune.charter"   # (one call)
tmux send-keys -t lagune Enter               # (separate call)
# monitor:
sudo -n -u <owner> env HOME=/Users/<owner> tmux capture-pane -t lagune -p -S -55
```
Each phase takes 2–5 min on a monorepo. Poll capture-pane until you see "done"/`❯` prompt.
**After `/lagune.plan` finishes, it pre-fills `/lagune.harden` in the input box. Clear it with `C-u` + `Escape` — do NOT press Enter** unless hardening was approved.

### 5. Save artifacts to a durable, user-owned folder
Copy out of the worktree (which may get torn down):
```
DEST=~/lagune-audits/<repo>; mkdir -p $DEST
for f in memory/charter.md memory/detect.md memory/plan.md tracking.json; do
  sudo -n -u <owner> cat <wt>/.lagune/$f > $DEST/$(basename $f); done
```
Then write a consolidated `FINDINGS.md` (priority-ordered, file paths from `tracking.json`, CVSS + fix from `plan.md`) and a `RESUME.md`.

### 6. Teardown
```
sudo -n -u <owner> env HOME=/Users/<owner> tmux kill-session -t lagune
sudo -n -u <owner> bash -lc 'rm -f ~/.cc_tok*'   # ensure no token left
# keep the worktree if resuming harden later; else:
# sudo -n -u <owner> bash -lc 'cd <repo> && git worktree remove <wt> --force && git branch -D lagune-hardening'
sudo rm /etc/sudoers.d/lagune-temp   # remove the temp grant when fully done
```

## Pitfalls
1. `npx lagune init` needs an agent arg (`init claude`) or it just lists 72 agents and exits.
2. npm EACCES: env leaks `HOME` to the calling user → npm cache points at their root-owned dir. Set `HOME` + `npm_config_cache` for the owner.
3. Slash command stays in the input box if command+Enter are sent together — send Enter as a separate `tmux send-keys`.
4. Claude Code launches in **auto mode**; for harden, drop to a review mode (Shift+Tab) or review the worktree diff before commit.
5. Never chown/chmod a live company repo to gain write access — run as the rightful owner instead.
6. Base the worktree on clean `HEAD`, not the dirty working tree, so the audit isn't polluted by uncommitted WIP.
7. Token hygiene: stage OAuth token via stdin to an owner-only (umask 077) file, source + shred at launch, never echo to chat/argv.
8. `lagune.ai/docs/<subpage>` often 404s to scrapers — pull the raw README from `raw.githubusercontent.com/wellwelwel/lagune/main/README.md` instead.
