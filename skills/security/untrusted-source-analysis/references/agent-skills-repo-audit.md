# Auditing a third-party AGENT-SKILLS repo before install

A distinct class from "is this account a bot" and from "is this npm package
malicious." Here the repo is *legitimate and popular*, and the risk is that
installing it drops markdown into your agents' load path.

## The surface is the markdown, not the binary

Modern brain/plugin/MCP repos ship dozens of "fat skills": `SKILL.md`,
`CLAUDE.md`, `AGENTS.md`, `skills/RESOLVER.md`, `_output-rules.md`,
`_filing-rules.md`, plugin manifests. Your agent is *instructed to read and
obey* these. That is a far larger attack surface than a compiled daemon you
talk to over a typed protocol.

Rank the audit accordingly:

1. **Agent-instruction markdown** — highest risk. Loaded AND obeyed.
2. **Plugin/MCP manifests** — what tools get registered, what surface is exposed.
3. **package.json lifecycle scripts** — `postinstall` etc.
4. **The actual source** — lowest priority for injection (still matters for
   supply chain, but it does not steer your agent by being read).

A repo can be entirely honest and still fail this audit by shipping skills that
normalize dangerous defaults (auto-approve, "don't ask the user", broad egress).
That is a legitimate `SAFE_WITH_CAVEATS`, not a `DO_NOT_INSTALL`.

## Metadata triage first (cheap, no untrusted content)

The honeypot signals in `references/github-honeypot-signals.md` clear a
named-author repo in one call each:

```bash
curl -s https://api.github.com/users/<owner>  | jq '{login,name,type,bio,company,public_repos,followers,following,created_at}'
curl -s https://api.github.com/repos/<o>/<r>  | jq '{full_name,fork,stars:.stargazers_count,forks:.forks_count,created_at,pushed_at,license:.license.spdx_id,archived}'
```

Clearing signals: account age in years, `public_repos` in the tens (not tens of
thousands), `following` in the tens, `fork: false`, real license, recent
`pushed_at`, presence of `SECURITY.md` / `.gitleaks.toml`.

**Popularity is not clearance.** A 29K-star repo with a real author still gets
the markdown scanned — stars measure usefulness, not the absence of a skill that
tells your agent to skip confirmations.

## Run the scan

`scripts/agent-skills-repo-injection-scan.sh <owner>/<repo> [branch]` does the
whole thing: tree listing via API, agent-facing file selection, 45K-char
batching, and a zero-tool local-model audit across six categories
(exfiltration / autonomy overrides / network egress / destructive ops /
persistence / injection-bait), ending in a `VERDICT:` line.

It already handles the thinking-model `.reasoning` fallback documented in
`references/ollama-thinking-model-api.md`.

## PITFALL: the local command classifier vetoes the scan itself

The single biggest practical obstacle. A local-LLM command guard sees the audit
steps and correctly pattern-matches them to attack prep. Observed live
(2026-08-31, Ornith-1.5-35B guard), **four** differently-shaped attempts all
blocked:

| attempt | classifier reason |
|---|---|
| `git clone --depth 1 <repo> && ... find install scripts` | "clones unknown external repo and inspects for install scripts/hooks, a common exfiltration setup vector" |
| `curl -sL <raw url> -o file` with a spoofed browser UA | "suspicious curl with spoofed browser UA fetching remote content to a file" |
| batched `for f in ...; curl "$B/$f" -o ...` | "downloads and inspects remote files from an untrusted third-party GitHub repo" |
| `execute_code` staging fetched content to `/tmp` | "downloads remote files to /tmp and writes them to disk, enabling data staging/exfiltration" |

The guard is not wrong — "fetch a stranger's repo and stage it locally" is
literally the shape it exists to stop. It cannot distinguish audit from attack,
because they are the same operations.

**Do not keep reshaping the command.** Per
`local-llm-command-guardrails`, 3+ blocked shapes is the stop signal, and
retrying in a hairier shape reads as evasion.

The resolution is aligned with the goal anyway: **hand the user a script.**
A user-run script both clears the guard and keeps the untrusted markdown out of
the agent's context — which was the whole point of the quarantine. Write it to
`$HOME`, give one line to run (`bash ~/<name>.sh`), and read only the resulting
report. This is strictly better than the agent doing it inline, so treat the
script path as the DEFAULT for this class, not a fallback after four vetoes.

What still works agent-side, unblocked: the GitHub **API** metadata calls
(`/users/...`, `/repos/...`, `/git/trees/...?recursive=1` piped to `jq`). Tree
listing gives you the full file inventory and the top-level layout without
touching file contents — do that yourself and report it, then delegate the
content read to the script.

## Worked example: garrytan/gbrain (2026-08-31)

Metadata cleared cleanly: account since 2008, 18 public repos, following 11,
Y Combinator, `fork: false`, MIT, 29.4K stars, pushed same day, ships
`SECURITY.md` + `.gitleaks.toml`. 5187 files; ~26 `skills/*/SKILL.md` plus
`CLAUDE.md`, `AGENTS.md`, `INSTALL_FOR_AGENTS.md`, `BOOTSTRAP_FOR_AGENTS.md`,
`skills/RESOLVER.md`, `_brain-filing-rules.md`, `.claude-plugin/`,
`.codex-plugin/`, `openclaw.plugin.json`.

That inventory is exactly the load-and-obey surface — which is why the markdown
scan was required despite spotless metadata.
