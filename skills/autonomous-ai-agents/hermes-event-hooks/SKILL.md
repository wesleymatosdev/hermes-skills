---
name: hermes-event-hooks
description: Build/deploy Hermes gateway hooks (HOOK.yaml+handler.py).
---

# Hermes Event Hooks

Gateway hooks are the right tool whenever the user wants something to happen
automatically on a lifecycle event (session start/end, agent turn end, a slash
command, a reaction) without asking every time. They live at
`~/.hermes/hooks/<name>/` as a `HOOK.yaml` (which events to subscribe to) plus
a `handler.py` (must define `handle(event_type, context)`, sync or async).

Full event catalog and payload shapes: load skill `hermes-agent`, reference
`references/background-systems.md`, or fetch
https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/ directly
(the local skill copy can lag — always verify the event list against live
docs before committing to a payload shape).

## Build sequence (in order, do not skip steps)

1. **Write `HOOK.yaml`** — name, description, `events:` list. Wildcards work
   (`command:*`).
2. **Write `handler.py`** — `async def handle(event_type: str, context: dict)`.
   Wrap the entire body in try/except that logs to a local jsonl file and
   swallows the exception. Hermes catches handler errors, but a hook that
   raises still loses its work silently — log it yourself so you can debug.
3. **Unit-test the handler directly before touching the gateway.** Import it
   with the SAME interpreter Hermes actually runs, not system `python3` —
   dependencies like `httpx` only exist in that venv:
   ```bash
   cat $(which hermes)   # shows the exec target, e.g. .../hermes-agent/venv/bin/python
   /path/to/that/venv/bin/python -c "
   import sys; sys.path.insert(0, '$HOME/.hermes/hooks/<name>')
   import handler, asyncio
   asyncio.run(handler.handle('event:name', {'session_id': 'some-real-id'}))
   "
   ```
   Pull real context (e.g. a real `session_id` from `~/.hermes/state.db`)
   instead of inventing fixture data — the DB schema has fields (like `cwd`,
   `git_repo_root`) a fabricated payload will miss.
4. **Restart the gateway to load it — hooks do NOT hot-reload.** Directory
   discovery happens once at gateway startup only. Prefer the CLI over raw
   launchctl (classifiers may block launchctl shapes):
   ```bash
   hermes gateway restart
   # restart DEFERS while any agent turn is in flight ("Restart deferred:
   # waiting on N active work unit(s)" in gateway.log) — that's fine; it
   # completes when the turn ends. Then verify:
   grep "\[hooks\] Loaded hook '<name>'" ~/.hermes/logs/gateway.log
   ```
   Don't declare the hook "deployed" without that log line — a typo in
   HOOK.yaml or an import error in handler.py fails silently otherwise.
5. **Re-verify after any handler.py edit** — same restart + grep, every time.

## Pitfalls

- Testing with system `python3` instead of the hermes venv python passes
  locally and then `ModuleNotFoundError`s in the real hook — always resolve
  the venv via `cat $(which hermes)` first.
- Assuming a hot-reload exists (like the webhook adapter's dynamic routes
  have) — gateway hooks don't; only a restart picks up new/changed files.
- Only some events fire in the CLI; most gateway hooks (`agent:end`,
  `session:*`) only fire on the **gateway** (Telegram/Discord/etc. sessions),
  not in an interactive CLI/TUI session — don't expect to observe them by
  testing in the CLI.
- Throttle high-frequency events (`agent:end`, `agent:step`) yourself with a
  small JSON state file keyed by session_id — nothing upstream rate-limits
  the handler for you.

## Local-model-as-judge pattern

For a background decision a hook needs to make on every event (e.g. "is this
worth acting on?") without cloud API cost, call a local Ollama model instead
of the user's configured provider — see `references/local-ollama-judge.md`
for a working prompt/schema pattern (JSON-only response format, low
temperature, strict pass/fail schema) plus the exact test commands used to
validate it end-to-end (positive case, negative case, throttle check).
