# Ollama OpenAI-compatible API: thinking-model quirks

Observed against `qwen3-30b-64k` served by local Ollama `v0.32.15`
via `POST http://127.0.0.1:11434/v1/chat/completions`.

## The field is `reasoning`, not `reasoning_content`

When a thinking-capable model (e.g. Qwen3 family) responds, its chain-of-thought
is returned in the assistant message's `reasoning` field:

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "391",
      "reasoning": "Okay, the user wants me to calculate... "
    },
    "finish_reason": "stop"
  }]
}
```

Do not assume the OpenAI `reasoning_content` / `reasoning` naming without
inspecting the actual response. Print `list(msg.keys())` first.

## Over-thinking empties `content` at low max_tokens

These models burn their entire `max_tokens` budget on reasoning and never reach
an answer. Observed: a 50-token cap on a trivial query returned `finish_reason:
"length"` with empty `content` — all 50 tokens went to thinking. Even a simple
`17*23` consumed 365 completion tokens of reasoning.

**Fix:** read `message.reasoning` (transparency) AND set a generous `max_tokens`
(4000-8000 for a real task). Treat empty `content` + `finish_reason: length` as
"thinking overflowed the budget," not a server error. Run long calls in the
background (`terminal(background=true, notify_on_complete=true)`) because
reasoning + answer over 100 repo descriptions can take minutes.

## General shape

```python
payload = {
  "model": "qwen3-30b-64k",
  "messages": [{"role": "user", "content": contract}],
  "temperature": 0.2,       # low for analysis
  "max_tokens": 8000,       # generous — over-thinking
}
# POST to http://127.0.0.1:11434/v1/chat/completions
```

Bare chat completion == ZERO tools by construction, which is exactly what you
want for a prompt-injection quarantine sandbox (the model can only emit text).
