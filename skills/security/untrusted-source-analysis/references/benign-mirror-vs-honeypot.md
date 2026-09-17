# Distinguishing a benign mirror-hoard from a true honeypot

Worked follow-up to `github-honeypot-signals.md`. The `standardgalactic`
account that LOOKED like a dangerous mirror-bot turned out to also host a real
original persona — the opposite of an injection trap. These are the nuances
that let you call it correctly.

## Volume ≠ hostility

Bot/mirror signals (24k repos, 1.28M following, mostly-forks) prove
**automation**, not **hostile content**. A hoard can still be a broad shallow
mirror collection built by a competent human with a separate original body of
work. Judge hostility by whether the *content itself* tries to steer an agent
— not by volume alone. Say plainly when something is benign ("broad shallow
hoard, not a conspiracy") instead of keeping the honeypot framing as the
default.

## The `standardgalactic` persona (what the depth looked like)

- Author alias surfaced via **AUTHORS.md** at repo root: **"Flyxion"** (also
  the "Flyxion works" in the `scriptorium` repo).
- "Standard Galactic Alphabet" = the **Minecraft enchantment-font name**, reused
  as playful branding — NOT a universal-language conspiracy claim.
- `language-evolution` = legitimate-looking computational-linguistics framework
  (22 experiments, ~7k lines Python, tests, "four core theorems (proven)").
  `abraxas` = occult *flavor* ("Chaos Magic", "Thaumaturgy"), decorative only.
- Extrapolated hoard: ~22k forks / ~1.5k originals, ~2.2 TB, **<1 star/repo**
  on average — a wide shallow hoard, not hidden depth.

## Fork-ratio sorting trap

The default `/repos?...&sort=updated` surfaces actively-maintained originals
first (~47% forks read). **Sort by `?sort=created`** to see the true hoard
shape (~94% forks for this account). Always take a creation-order sample when
sizing an account.

## Identity tracing behind an alias

- `AUTHORS.md` at repo root, or commit-author metadata
  (`/repos/{owner}/{repo}/commits` → `commit.author.name`/`email`) — strongest
  signal.
- Cross-reference `company` + `location` as a *hypothesis* only (here "Xanadu"
  + "Canada" → Xanadu, a Canadian quantum-computing firm). Personas lean on
  deliberate aliases, so do not overclaim.

## Rate-limit escape

- Commit-author API is under the unauthenticated `/api` core cap (~60/hr).
- When exhausted, fetch repo files directly from
  **`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`** —
  NOT under the same `/api` core rate cap.
