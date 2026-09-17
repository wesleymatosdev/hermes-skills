# Refactor recovery acceptance checklist

This is a general checklist, not a reconstructed execution transcript.

1. Confirm the old worker has stopped before assigning a recovery writer.
2. Preserve tracked changes and untracked files on a recovery branch before destructive cleanup.
3. Establish the original commit as the behavioral baseline; use an isolated worktree when comparing original behavior.
4. Inspect implementation completeness. Process exit status alone does not prove a working artifact.
5. Independently run build, tests, and lint gates. Record actual output rather than accepting a worker summary.
6. Report live integration separately from unit and fixture tests; workspace tests do not prove live dispatch.
7. Report committed/pushed status separately from test status.

The reviewed conversation reported preserved failed-worker changes, passing workspace tests and Clippy, and explicitly unverified live dispatch. Detailed failure transcripts were unavailable in this review; no specific model, compiler error, or failure cause is established here.
