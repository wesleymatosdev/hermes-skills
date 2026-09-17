---
name: tmux-persistent-agent-session
description: "Run Claude Code in tmux so ancestry-locked CLI tools work."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [tmux, Claude-Code, Persistence, Process-Ancestry, Session-Management]
    related_skills: [claude-code]
---

# Persistent tmux Claude Code session for ancestry-checking tools

## Problem

Some CLI agent frameworks (e.g. firstmate, a fleet-supervision tool) require
a **session lock** that walks the calling process's ancestry looking for a
known harness binary (`claude`, `codex`, `opencode`, `grok`, `kimi`, `pi`,
etc.) before allowing mutating operations (spawn, steer, merge, drain queue).

Hermes's own `terminal` tool spawns each command through Hermes' own
subprocess tree — no `claude`/`codex` binary anywhere in that ancestry — so
tools like this correctly refuse and force read-only mode. This is not a bug
to route around inside Hermes; it means the work must happen inside an
actual, persistent Claude Code process.

## Solution: dedicated tmux session running real Claude Code

1. Create (or reuse) a tmux session and launch `claude` inside it — this
   gives the tool a real `claude` process in its own ancestry chain:
   ```
   tmux new-session -d -s <name> -c <workdir>
   tmux send-keys -t <name> 'claude' C-m
   sleep 5   # wait for Claude Code's welcome screen
   ```
2. Drive it via `tmux send-keys` / `tmux capture-pane`, same as any
   interactive Claude Code orchestration (see the `claude-code` skill for
   the general PTY patterns). cd into the target repo first, then run
   whatever startup script the tool needs (e.g. `bin/fm-session-start.sh`).
3. The session — and the process tree Claude Code runs in — persists in
   tmux independent of the Hermes chat. Killing a Hermes session, or this
   conversation ending, does not touch tmux. Conversely, do NOT kill the
   tmux session/server unless the user explicitly asks — it's meant to
   outlive the chat.
4. If the user has an existing keeper tmux session (commonly session `0`,
   attached via a shell function like `t`), prefer renaming your new
   session onto that slot (`tmux rename-session -t <new> 0`) after killing
   whatever was idle there, so the user's normal attach flow keeps working
   without behavior change. Confirm the old session is genuinely idle
   (capture-pane, check for a bare prompt) before killing it — never kill a
   tmux session that has an in-flight agent turn without the user's OK.

## Pitfalls

- Don't run the tool's session-start / lock-acquiring command through
  Hermes' `terminal` tool directly and expect it to succeed — it will
  correctly refuse (no known harness in ancestry) and that's by design, not
  a fixable bug from the Hermes side.
- Only one live process can hold the tool's lock at a time. If a second
  tmux/Claude Code session tries to start work, expect it to report another
  session already owns the lock and go read-only — check the first session
  before assuming something is stuck.
- Text typed into Claude Code's input box via `tmux send-keys` without a
  following `C-m`/`Enter` sits as an unsent draft — always verify via
  `capture-pane` that a message was actually submitted, not just queued in
  the prompt box. Enter mid-multiline-paste can be swallowed as a newline
  rather than submit; send a bare `Enter` as its own `send-keys` call if a
  large message doesn't appear to submit.
- If the user asks to "just open a tmux tab" for anything else needing a
  shell, do that (new session or window) rather than interrupting a
  session where an agent has live in-flight work.
- When steering a mid-task agent with a correction, prefer sending it as a
  live `tmux send-keys` message (with Escape first if something else is
  half-typed) rather than restarting the session — it preserves context
  and any work already correctly completed before the correction.
