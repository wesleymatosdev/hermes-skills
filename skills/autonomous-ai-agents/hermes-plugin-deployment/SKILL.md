---
name: hermes-plugin-deployment
description: "Use when deploying third-party Hermes plugins safely."
version: 1.0.0
---

# Hermes Plugin Deployment

Deploy third-party native Hermes plugins into the explicitly selected profile while preserving provenance, scanner decisions, and runtime verification.

## Scope

Use this for `hermes plugins install`, release-archive deployments, upgrades, removals, and Desktop/Dashboard activation checks. Load `hermes-agent` for current official CLI and plugin API documentation.

## Installation workflow

1. Identify the target profile explicitly with `hermes profile list` then `hermes profile show <name>`. Use its reported path as `HERMES_HOME`; do not assume the default path.
2. Read the upstream installation guide and reconcile it with the installed Hermes version before making changes.
3. Preflight the plugin roots and destination: reject symlinked/non-canonical plugin roots, unexpected legacy installation trees, and destinations that are not standalone Git clones. Do not broadly delete unrelated plugin directories.
4. Resolve a requested release tag to an immutable 40-character commit SHA before installation. Verify the installed clone HEAD equals that SHA.
5. If the requested release tag is absent, stop and report the mismatch. Do not silently replace it with `main`; `main` may be installed only when the user explicitly chooses that unversioned source after being told the release is unavailable.
6. Keep the installer security scan enabled. Read every CAUTION finding in context. `--force` is an explicit scanner override, not a normal install flag: use it only with the user's affirmative approval after reporting the finding categories and pinned revision. Never override a BLOCK verdict.
7. Enable only through `hermes plugins enable` or the installer `--enable` flag. Do not copy a unified plugin's Desktop entry point into `desktop-plugins/`, which can create duplicate Desktop inventory.
8. Verify with `hermes plugins doctor <runtime-id> --ci`, `hermes plugins list`, and the installed clone's exact HEAD. Then verify the plugin's documented Desktop/Dashboard health endpoint or UI surface in the real runtime before declaring it deployed.

## Published-release versus repository-head provenance

A README's stated current version and a repository's published GitHub releases can diverge. Treat GitHub's release/tag ref as authoritative for a versioned deployment. A current-branch commit can be useful for a deliberate preview install, but label it as an exact unversioned commit and retain the SHA for rollback.

## Upgrade and removal

For exact-SHA installations, preserve the old SHA before removal and verify both old and intended revisions are reachable. Disable and remove only the named plugin, reinstall the target pinned SHA, and run the same doctor and runtime checks. Avoid broad plugin-root cleanup.

Use `hermes plugins remove <runtime-id>` for supported removal. Validate the remaining plugin inventory afterwards.

## Session lesson: AI Usage Monitor

For `masterlf/hermes-ai-usage`, the upstream guide requires a unified install at runtime ID `ai-usage-monitor` and a separate Desktop opt-in after agent/Dashboard enablement. See `references/ai-usage-monitor-install-notes.md` for the observed release/tag discrepancy and scanner result.
