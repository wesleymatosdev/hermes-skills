# Local Ollama model as a background judge

When a hook must decide something on every event (worth checkpointing? worth
alerting?) without burning cloud API cost, route the decision through a local
Ollama model rather than the user's main provider. Verified working pattern:

```python
import httpx, json

OLLAMA_URL = "http://localhost:11434/api/chat"
JUDGE_MODEL = "qwen3:30b"  # pick any local model already pulled — check `ollama list`

JUDGE_SYSTEM = """You are a silent background process deciding X.
Respond with ONLY a compact JSON object, no markdown fences, no commentary:
{"worth_action": true|false, "title": "...", "summary": "..."}
"""

def judge(transcript: str) -> dict:
    payload = {
        "model": JUDGE_MODEL,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": transcript},
        ],
        "stream": False,
        "format": "json",       # forces valid JSON out, skip manual parsing/fences
        "options": {"temperature": 0.1},
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(OLLAMA_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return json.loads(data["message"]["content"])
```

Key points that made this reliable in testing:

- `"format": "json"` on the Ollama chat endpoint is what keeps output
  parseable — without it the model wraps JSON in prose or code fences.
- Low temperature (~0.1) for a binary/classification decision; keep the
  system prompt terse with explicit YES/NO criteria and a fixed schema, not
  open-ended judgment.
- Cap the transcript/context fed in (a few thousand chars) — local models
  degrade on very long context and it's wasted latency for a binary call.
- Check the model is actually present with `ollama list` before wiring a
  hook to it; `ollama ps` shows what's currently loaded/warm.

## Validation checklist (what to actually run before trusting it)

1. Positive case: feed a transcript that obviously should trigger the action,
   confirm the judge returns `true` with a sane title/summary.
2. Negative case: feed trivial content ("what time is it in Tokyo?" /
   answer), confirm it returns `false` — a judge that always says yes is
   useless.
3. Full handler run: call `handle()` end-to-end (not just `judge()`) against
   a real session_id and confirm the side effect (file write, alert, etc.)
   actually happened and is well-formed.
4. Throttle check: call `handle()` twice in a row and confirm the second call
   is a no-op if a throttle window is in play.
