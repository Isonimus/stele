---
id: 0013
title: Surface the reuse decision; a generated capability index
type: architecture
status: accepted
date: 2026-07-23
supersedes: []
superseded_by: []
---

# ADR 0013 — Surface the reuse decision; a generated capability index

## Context

An assistant working in a large codebase reinvents logic that already exists — a fresh
`capitalize` beside the repo's `toTitleCase`. This is not laziness; it has structural causes
that no amount of "please check first" removes:

- **Bounded context.** The model cannot reuse a helper it never loaded. The existing util is
  in a file outside its window, so it does not exist as far as the model is concerned. This is
  the dominant cause.
- **Retrieval is probabilistic and naming-bound.** Even with grep, the model must think to
  search, choose terms, and the target must be findable by those terms. A search for
  `capitalize` never finds `toTitleCase`; semantic duplicates are invisible to text search by
  construction.
- **A local cost gradient.** A fresh three-liner is cheaper — fewer tokens, no unfamiliar
  abstraction to read and trust — than finding and adopting one. The model optimizes for
  making the task pass; duplication is an externality it does not feel.

Two conclusions follow, and both cut against the naive fix.

**Zero duplication is the wrong target.** An assistant that *always* reused would force every
new need onto the nearest existing helper and produce the wrong abstraction, which costs more
than an honest duplication — the reason `~/.claude/CLAUDE.md` §3 says *rule of three*, not
*rule of one*. The goal is not "always reuse." It is **awareness**: the model should know what
exists and make a deliberate, recorded reuse-or-duplicate choice.

**The guarantee lives at a gate, never at the intent.** A rule enforced only by the prose that
states it ("check for existing code first") is the failure mode ADR-0003 exists to fix — and
worse here, because *whether the model searched* cannot be checked from any version of a file.
Prompting raises the find-rate from bad to better; it never reaches "always," because the model
is stochastic and its context is bounded. So the controllable part is: raise the probability
the model *finds* existing code, and make the reuse decision *visible* so an un-considered
duplication is caught by review. Preventing it outright at write-time is not on the table, and
claiming otherwise would be the false green this project refuses everywhere.

## Decision

Two mechanisms, one principle — *make reuse a visible, supported choice, not a guaranteed one.*
They ship together because they answer the same finding and share this Context; splitting them
into two ADRs would duplicate the reasoning, the exact move this decision is about.

**1. Slices record the reuse decision (review-only).** `## Design` gains a required line:
*what existing code was considered* — what was searched for, what was reused, and what was
deliberately not reused and why. This does for duplication what `## Definition of Done`
(ADR-0011) did for acceptance: it puts the choice in a form where its *absence* is visible.
It is not a mandate to reuse — a deliberate "did not reuse, because the abstraction would be
forced" is a complete answer. Enforcement is **review-only**: whether the search truly happened
is the coverage question, surfaced by `/wrap-up`, never linted. A rule that checked for the
*words* would reward theatre, not reuse.

**2. An optional generated capability index (opt-in by wiring).** The method ships
`scripts/gen-capability-index.mjs`: a best-effort, zero-dependency scanner that reads a repo's
exported functions/classes/constants and emits `docs/CAPABILITIES.md` — a greppable map of
"what reusable logic exists and where," which a repo's `CLAUDE.md` points the assistant to
consult *before* writing a helper. This attacks the two dominant causes — bounded context and
naming-bound retrieval — at once: it puts the existence and location of every export into one
loadable, searchable surface.

- **It is a Generated document** in the four-kinds taxonomy (ADR-0010), the same kind as
  `adr/INDEX.md`: built by script, never hand-edited, stale-means-drift.
- **Best-effort and zero-dependency.** It scans `export` sites textually rather than
  type-resolving them. A false positive in a discoverability aid costs nothing; a build
  dependency would breach the zero-dep constraint that lets the kit drop into any repo. If a
  repo wants type-accurate indexing, that is its own tool, wired the same way.
- **Opt-in by wiring, not a toggle flag.** A repo that wants the index wires
  `gen-capability-index.mjs` into `package.json` and points its `CLAUDE.md` at the output —
  exactly the opt-in mechanism verify scripts already use (ADR-0004). Wiring *is* the signal;
  it needs no `--with-index` flag, no config key, no toggle state to drift out of sync with
  reality. An unwired generator simply does not run, and the index is absent rather than stale.
  This keeps the index out of the core linter's required corpus: not every repo has source to
  index or wants the noise, so it cannot be a rule every repo must pass.

**What this deliberately does not do.** No core lint rule *forces* reuse or *forbids*
duplication — the reuse-truth is uncheckable and forced reuse is the wrong-abstraction harm
above. Textual clone detection (jscpd and kin) genuinely catches the copy-paste half, but it
carries a dependency and a repo-specific tuning surface, so it stays a per-repo opt-in, not
method core — noted for the repo that wants it, never claimed as shipped. Semantic duplication
stays where it must: a review-and-judgment function, surfaced, not automated.

## Consequences

- **The reuse choice becomes inspectable.** A slice that reinvents a helper now shows it as a
  `## Design` with no "existing code considered" answer — a gap a reviewer or `/wrap-up` sees,
  the same way a missing acceptance scenario shows under ADR-0011. It converts an invisible
  externality into a visible omission.
- **Discoverability is the load-bearing lever.** The capability index does more than any prompt
  can, because it fixes the cause — the model cannot reuse what it cannot find — rather than
  exhorting against the symptom. Its value is bounded by its freshness, which is why it is
  Generated and wired, not hand-kept.
- **It raises the find-rate; it guarantees nothing.** Both mechanisms are probabilistic or
  review-gated by nature. The honest claim is a higher rate of deliberate reuse and a higher
  rate of *caught* accidental duplication — not the elimination of duplication, which is
  neither achievable at write-time nor desirable as an absolute.
- **The generator is deferred, its design settled here.** This ADR decides the index's shape,
  kind, and opt-in mechanism; building `gen-capability-index.mjs` and its fixtures is carried
  in `LEDGER.md`. The `## Design` line ships now with this ADR, as it needs no machinery.
- **No new core dependency, no new required rule.** The `## Design` change is command prose;
  the index is opt-in tooling within the standard library. The core linter's corpus and the
  zero-dependency guarantee are both untouched.
