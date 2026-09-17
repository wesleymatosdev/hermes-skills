# Marmite Draft Workflow

Use for the user's Marmite blog repository when a post must remain unpublished.

## Repository convention

- Publishable source: `content/`
- Unpublished editorial work: `drafts/`
- Build command: `marmite . site`
- Generated output: `site/`

A Markdown file under `content/` is eligible for the next generated site and eventual Pages deployment.
A Markdown file under `drafts/` is intentionally outside that path.

## Procedure

1. Write or move the unpublished post to `drafts/<slug>.md`.
2. Run `marmite . site` from the repository root.
3. Locate the prior generated article slug under `site/` and request it from a local static server, or confirm it is absent from generated files.
4. Inspect `git status --short` and confirm the draft is the only intended source change.
5. Do not commit, push, or publish without an explicit separate request.

## Publication promotion

When the user has applied the method and wants to publish:

1. Re-read the draft and replace predictions with results.
2. Add concrete before/after evidence, limitations, and any decisions that changed after real use.
3. Move the final Markdown file into `content/`.
4. Build locally and verify the exact generated page before proposing a commit or deployment.

## Known build output

Marmite can warn that an unsupported code-fence language is emitted as plain code.
That does not by itself fail a build, but remove or adjust the fence language if syntax highlighting is material to the post.
