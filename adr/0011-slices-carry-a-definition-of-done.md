---
id: 0011
title: Slices carry a Definition of Done in Given/When/Then
type: architecture
status: accepted
date: 2026-07-22
supersedes: []
superseded_by: []
---

# ADR 0011 — Slices carry a Definition of Done in Given/When/Then

## Context

A slice today scaffolds four body sections (`/slice`): `## Goal` (what ships and why),
`## Design`, `## Verification` (required — the unit tests and the wired `-verify.mjs`), and
`## As built` (the freeze). Between the one-line want in `LEDGER.md` that spawns a slice and
the narrow, machine-checkable assertion a verify script makes, nothing states what *done*
means in the language of the feature. `## Goal` is a paragraph of intent; `## Verification`
is proof mechanics — *how* we check, not *what* must hold. The acceptance criteria — the
list a reader, a reviewer, or a model measures "is it finished?" against — have no home.

This gap has a cost already paid. boxel's block-completeness rule requires every new block
to ship a mesher shape, a hotbar/drop icon, and a hand-held version; models routinely
deliver one and silently drop the others. The failure is not laziness — it is that a
work-unit with three required outputs and no enumerated acceptance criteria is one a model
can complete to the letter of its `## Goal` paragraph while an output goes missing, because
the intent was never written in a form that makes the omission visible.

Two additions were considered; they earn opposite verdicts.

A separate `## Rationale` block is **rejected.** `## Goal` already carries "what ships **and
why**," and where a slice implements an ADR the durable rationale is that ADR's immutable
job. A second home for the *why* is the duplication-without-a-sync-path this workflow exists
to prevent (ADR-0001).

A `## Definition of Done` block is **accepted**, in a **closed grammar**: Given / When /
Then. The triad forces a precondition, an action, and an *observable* outcome — the three
parts a vague criterion omits. It is the move this project already makes with the closed
`status` and `type` vocabularies (ADR-0002): constrain the shape, and ambiguity has fewer
places to hide.

## Decision

Every slice carries a `## Definition of Done` section, placed between `## Goal` and
`## Verification`, holding one or more acceptance scenarios written in **Given / When /
Then**.

- **The grammar, not a toolchain.** Scenarios are markdown prose in Given/When/Then form.
  This project is zero-dependency by design; it does not adopt Cucumber, `.feature` files,
  or step-definition runners. The verify-script harness (ADR-0004) is the executable layer —
  Gherkin here is *writing discipline*, and its guarantee is human.
- **Each scenario names its proof.** A scenario states what must be true; `## Verification`
  states how it is shown — a named unit test, or an assertion in the wired `-verify.mjs`.
  That mapping is what keeps the two from drifting: a DoD scenario with no corresponding
  proof is an unmet acceptance criterion, not a finished one.
- **Rationale stays in `## Goal`.** No separate block, for the reason in Context.
- **The loop closes at the freeze.** `## As built` confirms, in past tense, that each
  scenario was met — or records the deviation and why. Promised (DoD) → shown
  (Verification) → shipped (As built).

**Enforcement.** Presence is machine-checkable; substance is not — the same split ADR-0004
draws for the harness. The linter gains a rule: a `type: slice` document must contain a
`## Definition of Done` section holding at least one `Given` … `When` … `Then` triad. It
checks *shape*, never truth. Whether a scenario is correct, or whether the scenarios are
*complete*, is the coverage question, and it stays where ADR-0004's amendment left its
sibling: unlinted, surfaced by `/wrap-up` for a human read-through. A linter that claimed to
validate intent would be the false-green that rule 10 exists to kill.

The rule is **warning-only on legacy, error on new** — boxel's ~104 existing slices and
gamatar's predate it and would otherwise go red on arrival. This is the migration path the
pending `## Verification`-section rule already takes; the two are siblings — each asserts a
required slice section, warning on legacy — and should be built as one piece of work.

## Consequences

- **Intent is written where an omission becomes visible.** A required output absent from the
  shipped work is now a DoD scenario with no passing proof, caught at review or by
  `/wrap-up` — not by the operator noticing at runtime, the failure mode ADR-0004's Finding 3
  records for the bare cake.
- **It reduces ambiguity; it does not remove it.** A step is still English — "When the
  player places the block" has fuzzy edges. Given/When/Then raises the floor sharply and
  forces the observable outcome to be named, but it is not a proof, and this ADR claims none.
  Overclaiming would be the aspiration §4 says to measure, not assert.
- **No new dependency.** The grammar is prose; the executable layer stays the verify scripts
  already in place.
- **It survives the freeze.** Given/When/Then is tense-neutral, so a pre-implementation
  scenario reads unchanged in `## As built` as the record of what done meant. A scenario
  found wrong mid-flight is edited freely — a slice is mutable until merge; found wrong
  after, it takes a dated correction (ADR-0001 amendment), never a silent rewrite.
- **It ships as one change.** Per §4 the ADR, the `/slice` command's new section, the lint
  rule, and its regression fixtures land in one commit, alongside the `templates/CLAUDE.md`
  note on required slice sections.
