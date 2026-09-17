# AI Usage Monitor installation notes

Observed 2026-08-31 on Hermes Agent v0.20.6:

- The upstream repository README and installation guide described v0.7.5, but GitHub's release/tag API exposed v0.7.4 as the newest published release and no `v0.7.5` tag. Do not call the repository head a v0.7.5 release.
- The default profile passed a canonical-root preflight: no legacy Desktop tree and no existing unified `plugins/ai-usage-monitor` clone.
- A pinned current-main install was blocked by Hermes' community scanner with a CAUTION verdict and 32 findings. Examples included a literal `eval(` match inside a security-invariants script, package-install commands in CI/docs, test subprocess code, and broad `profile` persistence matches in UI bundles.
- The installer reported that `--force` is required to override this CAUTION verdict. It must be an explicit user decision; no forced install occurred.
- The documented runtime ID is `ai-usage-monitor`. The unified tree contains agent, Dashboard, and Desktop halves. Agent/Dashboard enablement does not activate the Desktop half; it must be enabled separately in Desktop Settings → Plugins after inventory/rescan.

Verification after a future authorized install:

1. confirm installed Git HEAD matches the selected SHA;
2. run `hermes plugins doctor ai-usage-monitor --ci` and inspect `hermes plugins list`;
3. explicitly opt into the Desktop inventory entry;
4. verify Desktop status/UI, Dashboard `/ai-usage`, and authenticated plugin health endpoint;
5. confirm no duplicate legacy `desktop-plugins/ai-usage-monitor` tree exists.
