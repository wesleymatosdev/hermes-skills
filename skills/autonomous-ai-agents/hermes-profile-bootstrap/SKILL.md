---
name: hermes-profile-bootstrap
description: "Fix a new Hermes profile/bot 429ing or 400ing on providers."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [hermes, profiles, bot-mode, credentials, auth, troubleshooting]
    related_skills: [hermes-agent, tmux-persistent-agent-session]
---

# Hermes Profile Bootstrap

Use when a **newly created Hermes profile** (via `hermes profile create`, or
a Bot Mode bot created through Desktop/the `profiles.*` RPC) fails every
inference call with 429/400 errors, even though the CURRENT session that
created it is working fine. This is a credential-isolation gotcha, not a
broken provider — the fix is mechanical once you know the cause.

## Root cause

A new profile gets its own `~/.hermes/profiles/<name>/auth.json` with an
**empty or unrelated credential pool** — it does NOT inherit the active
session's working provider/credentials, even though they're the same OS
user and the same machine. Its `config.yaml` may also point at a provider
or model name that was never actually validated (e.g. hand-copied from a
`fallback_providers` list without checking it's real).

Symptoms, in the order they tend to appear as you retry blindly:
- `HTTP 429: Usage credits are required for this model` (Anthropic, out of
  credits on that provider specifically for the new profile's pool)
- `HTTP 429: ...session usage limit...` (Ollama-cloud, free-tier session cap)
- `HTTP 400: The 'X' model is not supported when using Codex with a ChatGPT
  account` (invalid/alias model name — see below)
- `HTTP 429: The usage limit has been reached` with a `resets_in_seconds` in
  the tens of millions — a real plan-level quota (e.g. ChatGPT "go" plan),
  not fixable by retrying or switching models.

## Fix: copy a known-working credential across

1. Find out what provider the CURRENT (working) session actually
   authenticates through — don't assume it matches `config.yaml`'s nominal
   `model.provider`, since fallback chains can be in play:
   ```bash
   python3 -c "import json; d=json.load(open('/Users/<you>/.hermes/auth.json')); print(d.get('active_provider')); print(list(d['providers'].keys()))"
   ```
2. Copy that provider's token block into the new profile's `auth.json` and
   add it to the pool:
   ```bash
   python3 -c "
   import json
   src = json.load(open('/Users/<you>/.hermes/auth.json'))
   dst = json.load(open('/Users/<you>/.hermes/profiles/<name>/auth.json'))
   dst['providers']['<provider>'] = src['providers']['<provider>']
   if '<provider>' not in dst.get('credential_pool', []):
       dst.setdefault('credential_pool', []).append('<provider>')
   dst['active_provider'] = '<provider>'
   json.dump(dst, open('/Users/<you>/.hermes/profiles/<name>/auth.json', 'w'), indent=2)
   "
   ```
3. Point the new profile's own `config.yaml` at that provider + a **verified
   real model name** for it (see pitfall below) — don't hand-edit; write the
   whole small `model:` block, or use `<profile-alias> config set` if a CLI
   alias/wrapper exists for that profile.
4. Relaunch the profile's task. If it still 429s, the provider itself may be
   quota-exhausted account-wide (see "real quota exhaustion" below) — check
   `resets_in_seconds` in the error body before trying a third provider.

## Pitfall: model name must be real, not guessed from context

`openai-codex` (ChatGPT OAuth) only accepts specific bare model family
names — verified against `agent/transports/codex.py` in the hermes-agent
source: `gpt-5.5`, `gpt-5.4`, `gpt-5.2`, `gpt-5.1-codex-max`,
`gpt-5.1-codex-mini`, `gpt-5.1-chat-latest`, `gpt-5.1-codex`, `gpt-5.1`,
`gpt-5-codex`, `gpt-5`, `gpt-4.1`. A name copied from elsewhere in the
config (e.g. a `fallback_providers` entry with a suffix like `-sol`, or any
other invented-looking variant) will 400 with `"model is not supported when
using Codex with a ChatGPT account"`. When you hit that error, don't retry
the same string or guess a different suffix — grep the actual transport
source for the allowed list, or fall back to a bare, well-known family name.

## Pitfall: real quota exhaustion looks identical to a config error at first

A 429 with a large `resets_in_seconds` (tens of millions = weeks) in the
JSON body is a genuine plan-level limit, not a retryable or fixable-by-
config issue. Don't keep swapping providers/models chasing it — check that
field before spending another cycle. If every available provider for that
profile is quota-exhausted, the honest move is to do the work in the
already-working session/profile instead of the new one, and note the new
profile needs its own credits/plan sorted before it's usable.

## Verification

After copying credentials, confirm with a cheap real call (not just "file
looks right"): `<profile-alias> chat -q "hi" -Q --max-turns 1` and check
for a real reply instead of another 4xx.
