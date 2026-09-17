---
name: blog-authoring
description: "Use when drafting and publishing evidence-based blog posts."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [blog, writing, drafts, publishing, verification]
    related_skills: [grounded-citations, humanizer]
---

# Blog Authoring

Use this skill to turn a real project, investigation, lesson, or opinion into a blog post without publishing prematurely.

A draft is an editorial artifact, not a production page.
Preserve the distinction in both the filesystem and the delivery conversation.

## When to Use

- The user asks to write, outline, revise, or prepare a blog post.
- The user has a useful engineering or career lesson but wants to validate it first.
- A post is based on an implementation, experiment, personal application, or result that is not complete yet.

Do not use this to publish, commit, or announce a post unless the user explicitly asks for that separate action.

## Draft-first workflow

1. **Name the evidence boundary.**
   - Identify what is already observed, what is planned, and what is still an assumption.
   - Do not frame a proposed method as a proven outcome.
   - Completion: every strong claim can be labelled as observed, sourced, or deferred.

2. **Choose the post angle.**
   - Start with a tension the reader recognizes, then explain the practical model or lesson.
   - A useful engineering post should give the reader a decision rule, not merely narrate the work.
   - Completion: the title and opening answer why the reader should care.

3. **Write a draft outside publishable content.**
   - Store unpublished drafts in the repository's dedicated draft area, never a generator's production content directory.
   - Do not assign a publish date, deploy, commit, or create a public preview unless separately requested.
   - Completion: a normal production build cannot expose the draft.

4. **Make claims defensible.**
   - Use specific examples, baselines, and sources where relevant.
   - Remove confidential employer information, unsupported comparative claims, and metrics without context.
   - Completion: the author could comfortably explain every claim in a public comment or interview.

5. **Prepare the applied follow-up.**
   - If the post is about a method the user will apply personally, explicitly retain the draft until they have applied it and can report what changed.
   - When revisiting, update the post with real decisions, failures, trade-offs, and results rather than publishing generic advice.
   - Completion: the future publication has a concrete evidence checklist.

## Static-site verification

For a static-site repository:

1. Build the site after moving a draft out of production content.
2. Verify that the former post URL is absent or returns a non-success status.
3. Check repository status to confirm only the draft location changed.
4. Keep the build output uncommitted unless the user explicitly wants it versioned.

For Marmite-specific path and build conventions, see `references/marmite-draft-workflow.md`.

## Pitfalls

- A source Markdown file in a publishable content directory is not “just a draft.” Static generators can include it on the next build or deployment.
- Do not write a retrospective as if its outcome is already known.
- Do not turn private employer context into public evidence just because it makes the story more compelling.
- Do not use generic career or engineering advice as a substitute for firsthand learning.
- “Draft complete” does not mean “ready to publish.” It means the idea and evidence plan are preserved for later revision.

## Verification

Before declaring a post draft complete, report:

- the draft path
- whether it is excluded from production output
- the real evidence still required before publication
- whether any commit, deploy, or announcement was performed
