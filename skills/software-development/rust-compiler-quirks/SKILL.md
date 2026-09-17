---
name: rust-compiler-quirks
description: Use for Rust trait/macro build errors. Check deps first.
---

# Rust compiler quirks: diagnose before rewriting

Rust's error messages for two common failure classes look like application bugs but
are almost always environment/dependency problems. Don't start rewriting handler
signatures or struct fields until you've ruled these out — it wastes turns and can
introduce real bugs while chasing a phantom one.

## Quirk 1: axum `Handler<_, _>` not satisfied (or any framework's similar trait-bound error)

**Symptom:** `error[E0277]: the trait bound \`fn(...) -> ...: Handler<_, _>\` is not
satisfied`, often on a `.route(path, get(handler))` call, sometimes with 5-10 near-
identical errors across every handler in the file.

**Root cause (check this FIRST, before touching handler code):** a version mismatch
between the web framework and a companion extractor/extension crate. Framework major
versions pin exact core-crate versions (e.g. axum 0.7 requires axum-core 0.4; axum
0.8 requires axum-core 0.5). A companion crate built against the framework's *next*
major version silently fails to satisfy the `Handler` trait for your handler fn
signature — no explicit "incompatible version" error, just a wall of generic trait-
bound failures.

**Diagnose:**
```bash
grep -E '^(axum|axum-htmx|axum-.*) = ' Cargo.toml
cargo tree -p <companion-crate>   # shows which axum-core it pulled in
```
Compare the companion crate's docs.rs "Compatible versions" table (or its own
Cargo.toml on crates.io, e.g. `https://crates.io/crates/<crate>/<version>`) against
your pinned framework version.

**Fix:** pin the companion crate to the version whose own manifest requires your
framework's major version — don't bump the framework unless you actually want to
upgrade it. Example: `axum = "0.7"` + `axum-htmx = "0.6"` (not `0.8`, which needs
`axum ^0.8`).

**Verify:** `cargo build` should go from 5-10 Handler trait errors to zero (or to a
small number of genuinely unrelated errors) in one shot. If the trait errors persist
after matching versions, then — and only then — suspect an actual extractor-order
bug in your handler signature (state-consuming extractors like `State<T>` must come
after request-consuming ones).

## Quirk 2: Askama (or other compile-time template DSL) "problems parsing template
   source" on a Rust-looking expression

**Symptom:** `error: problems parsing template source at row N, column M near: "..."`
pointing at something that looks like valid Rust, e.g. a closure inside a `{% if %}`.

**Root cause:** Askama's template expression language is a *subset* of Rust — it does
NOT support closures (`|x| ...`), and has limited support for chained method calls
with lambda arguments (`.map(|i| ...)`, `.filter(|x| ...)`). This is a hard DSL
limitation, not a syntax typo.

**Fix:** precompute the value in the Rust struct that derives `Template`, pass it as
a plain field, and reference the field directly in the template.
```rust
// Before (fails to parse):
// {% if it.id == iterations.first().map(|i| i.id.as_str()).unwrap_or("") %}

// After — add a field, compute it in Rust before constructing the template:
pub struct IterationListTemplate {
    pub iterations: Vec<Iteration>,
    pub latest_id: Option<String>,   // computed: iterations.first().map(|i| i.id.clone())
}
// Template: {% if it.id == latest_id.as_deref().unwrap_or("") %}
```

**General rule for template DSLs:** if an expression needs a closure, a match guard,
or anything beyond simple field access / method calls with literal args, move the
computation into the surrounding Rust code and expose it as a plain field or a
no-argument method on the template struct.

## Workflow when you see either symptom

1. Read the *first* error only — don't scroll past it into 5+ near-identical repeats.
2. Check `Cargo.toml` pins + `cargo tree` for a version mismatch before editing any
   application code (Quirk 1).
3. If the error is from a `#[derive(Template)]`/proc-macro parse step rather than a
   type-check step, suspect a DSL-syntax limitation, not a real syntax error (Quirk 2).
4. Fix the minimal thing (one Cargo.toml line, or one struct field), rebuild, confirm
   the error class disappears entirely before addressing anything else.
