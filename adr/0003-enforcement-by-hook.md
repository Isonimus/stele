---
id: 0003
title: Invariants are enforced by a hook, not by memory
type: architecture
status: amended
date: 2026-07-20
supersedes: []
superseded_by: []
---

# ADR 0003 — Invariants are enforced by a hook, not by memory

## Context

Every convention in both repos is prose, read by a model that may or may not comply, with
nothing checking the result. The consequences are not hypothetical — the survey found
five live defects that no one noticed for weeks:

| Defect | Detail |
|---|---|
| 0112 → 0122 one-way | 0112 declares "Superseded by ADR 0122"; 0122 never links back |
| 0113 → 0122 one-way | same, and the claim sits in a blockquote at line 103 |
| 0114 → 0122 one-way | same |
| 0051 dangling | "Supersedes the scattered..." — names no target ADR |
| 0061 dangling | "**Superseded (2026-07-09):**" — names no superseding ADR |

ADR 0122's only acknowledgement of any of this is at line 270, inside a consequences
bullet: `zone-field approach is superseded (annotate both)` — a to-do written in the
document that was supposed to perform the annotation, and "both" omits 0113 entirely.
Additionally 0112 and 0114 still carry `Status: Accepted` while declaring themselves
superseded four lines later.

These are exactly the errors a fifty-line script finds instantly. They survived because
no script ran.

The same pattern explains ADR-0001's dual-write failure: it was never that the rule was
wrong, only that compliance was discretionary. A rule enforced by memory is a rule that
holds until the first busy afternoon.

## Decision

Invariants are executable. `scripts/lint-docs.mjs` checks nine rules, each traceable to
an observed failure:

> **Corrected 2026-07-21.** Ten rules, not nine — rule 10 was added the same day; see the
> amendment below. This marker, rather than an edit to the line above, is the correction
> convention sanctioned by ADR-0001's 2026-07-21 amendment.

| # | Rule | Severity |
|---|---|---|
| 1 | Frontmatter present, parseable, required fields non-empty | error |
| 2 | `id` matches filename ordinal; no duplicate ids | error |
| 3 | `status` and `type` in vocabulary | error |
| 4 | Supersession bidirectional: `A.superseded_by ∋ B` ⟺ `B.supersedes ∋ A` | error |
| 5 | Every referenced id exists | error |
| 6 | `status: superseded` ⟺ `superseded_by` non-empty | error |
| 7 | No `accepted` ADR that another ADR claims to supersede | error |
| 8 | Every `LEDGER.md` ADR citation resolves | error |
| 9 | Bare `ADR NNNN` prose references resolve | warning |

Rule 9 is a warning by design: 567 legacy prose references exist, some referring to
external or historical context, and failing the build on them would make the linter
something to disable rather than obey.

The linter runs from a **pre-commit hook**. This is the load-bearing decision, not the
linter itself — a checker nobody runs is another convention resting on memory, which is
the failure being fixed. It also runs in CI, so the check survives a repo cloned without
hooks installed.

**Zero runtime dependencies**, plain Node ESM. boxel is npm, gamatar is pnpm 9.15.4, and
`pnpm` is not on PATH in this environment. A dependency-free script drops into any repo
regardless of package manager, and matches boxel's existing `scripts/*-verify.mjs` idiom.
Frontmatter's closed seven-field schema (ADR-0002) is small enough to parse by hand.

## Consequences

- Compliance becomes mechanical. The three questions that actually get forgotten — did
  this change a user-facing API, record a decision, defer something — move into a
  `/wrap-up` command rather than relying on recall.
- The linter must be validated against ground truth before it is trusted: a known-answer
  test requires it to independently rediscover exactly the five defects above in
  unmigrated boxel, and report nothing else. A linter that finds four, or six, is wrong.
- Hooks are per-clone and easy to skip (`--no-verify`); CI is the backstop. Neither repo
  has CI today, so a minimal workflow is part of the work.
- Cost: false positives are expensive to a workflow's credibility. Rule severities are
  chosen so that anything advisory warns rather than blocks.
- The rules encode today's failures. New failure modes mean new rules — the rule table is
  expected to grow, and each addition should cite the incident that motivated it.

## Amendment — 2026-07-21: rule 10, a non-empty corpus

The decision above anticipated this: *"new failure modes mean new rules — the rule table
is expected to grow, and each addition should cite the incident that motivated it."*

**Incident.** During the boxel migration survey the linter was pointed at `boxel/adr`
rather than the boxel root. It printed `0 document(s) — ok` and exited 0. `loadDocs` looks
for `adr/` and `slices/` *beneath* the path it is given; `boxel/adr` contains neither, so
it loaded nothing, no rule fired, and an empty finding list rendered as a pass. A hook or
CI job wired to a wrong path would have gone green forever while checking nothing — the
exact failure mode this ADR exists to prevent, in the tool that enforces it.

| # | Rule | Severity |
|---|---|---|
| 10 | Corpus is non-empty: no `adr/` or `slices/` directory at the root | error |
| 10 | Corpus is non-empty: directory present but holding no documents | warning |

**Why the severity splits.** The ledger item asked for an empty corpus to be an error
outright. That over-fires. The observed defect is the *wrong root* case, where neither
document directory exists — and no repo using this method lacks both, so that is
unambiguously an error. A repo whose `adr/` exists but is still empty is correctly
scaffolded and merely new; erroring there would fail `npm run lint` during install, in a
method whose whole purpose is being installed into fresh repos. It warns loudly instead.

Rule 10 is checked before the per-document rules and returns immediately once any document
is found, so it never fires alongside a real finding.
