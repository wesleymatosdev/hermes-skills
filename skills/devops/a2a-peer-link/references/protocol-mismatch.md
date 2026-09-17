# A2A vs api_server vs peer dm — protocol mismatch reference

## The three communication surfaces in Hermes

1. **A2A platform** (`plugins/platforms/a2a/`) — JSON-RPC 2.0 at `POST /`.
   - Methods: `message/send`, `message/stream`, `tasks/get`, etc.
   - Inbound adapter routes messages into the live gateway session.
   - Client tools: `a2a_call`, `a2a_discover`, `a2a_orchestrate` (in the `a2a` toolset).
   - Config: `a2a_agents` in config.yaml for outbound peers.
   - Auth: `A2A_PEER_TOKENS` (per-peer bearer tokens).

2. **api_server platform** (`gateway/platforms/api_server.py`) — REST at `/api/sessions/*`.
   - Endpoints: `GET /api/sessions`, `POST /api/sessions/{id}/chat`, etc.
   - OpenAI-compatible: also serves `/v1/chat/completions`.
   - Auth: `API_SERVER_KEY`.

3. **`hermes peer dm`** (`hermes_cli/subcommands/peer.py`) — CLI client for bot-to-bot DMs.
   - Calls api_server REST endpoints: `_ensure_bot_chat` → `GET /api/sessions`, then `POST /api/sessions/{id}/chat`.
   - Stores peer config in `config.yaml` under `bot_peers`.
   - Key stored as `HERMES_PEER_<NAME>_KEY` in `.env`.
   - **Does NOT speak A2A JSON-RPC at all.**

## The 404 diagnosis (2026-08-31)

- Mac had `a2a` platform enabled on port 9900, but NOT `api_server`.
- PC ran `hermes peer dm mac "ping"` → hits `http://macbook.local:9900/api/sessions?...`.
- A2A adapter's `do_GET` only serves `/`, `/health`, `/metrics`, `/.well-known/agent-card.json` — returns 404 for everything else.
- No `/api/sessions` route exists on the A2A adapter → 404.
- Auth was fine (no 401/403). The request reached the server but the path doesn't exist.
- Mac gateway log showed no inbound request because `do_GET` returns 404 silently (only `do_POST` logs at INFO level).

## Fix options

1. **Enable `api_server` on the Mac** — add it to `config.yaml` platforms, set `API_SERVER_KEY`. Then `hermes peer dm` works as designed.
2. **Use A2A client tools instead** — `a2a_call` tool speaks JSON-RPC to the A2A adapter. But this is for agent-to-agent tasks, not CLI-initiated DMs.
3. **Skip both** — for file transfer, use scp over SSH. For agent-to-agent task delegation, A2A tools. For CLI bot-to-bot DMs, api_server. Pick the right tool for the job.

## Key source files

- `hermes_cli/subcommands/peer.py` — `hermes peer dm` implementation (api_server REST client)
- `plugins/platforms/a2a/adapter.py` — A2A inbound adapter (JSON-RPC server, `do_POST` routing)
- `plugins/platforms/a2a/tools.py` — A2A outbound client tools (`a2a_call`, etc.)
- `plugins/platforms/a2a/security.py` — `get_peer_tokens()`, `authenticate()`, `resolve_bind_host()`
- `gateway/platforms/api_server.py` — REST API server platform
