---
id: 0001
title: Every document is either immutable or generated
type: architecture
status: accepted
date: 2026-07-20
supersedes: []
superseded_by: []
---

# ADR 0001 — Every document is either immutable or generated

## Context

Three weeks of ADR-driven work across two repos (boxel, 130 ADRs; gamatar, 8) produced
good decision records that nonetheless drifted out of sync with reality. A full survey
located the cause, and it was not discipline.

boxel's `BACKLOG.md` mandates: *"On completion, close the item here (remove it) AND
annotate the source ADR's deferral note in the same commit — the ledger and the ADRs
must never disagree."* Five of five spot-checked closures were never annotated back.
The phrase `"closed by ADR"` appears once across 130 files. The rule did not decay over
time; it never executed once.

gamatar's `CLAUDE.md` carries the same instruction in gentler words: *"Each item is
noted BOTH in the relevant ADR and here."*

This is dual-write of mutable state with manual reconciliation. It fails without
exception, because it asks a writer to remember, at closure time, every place a fact was
recorded at creation time. boxel's own backlog header records the aftermath: the file
was *"consolidated 2026-07-14 from the playtest notes, every ADR's recorded deferrals,
and the running conversation backlog"* — a manual reconciliation performed only after
the drift became unmanageable.

A second, subtler failure compounds it. Roughly 22 of boxel's 130 ADRs are architectural
decisions; the other ~108 are feature work-units (`0084-ladder`, `0093-cow`,
`0100-sugar-cane`). These have opposite lifecycles. A decision record asserts *"on date
X we chose Y because Z"* — a historical claim, true forever. A feature spec asserts
*"the system works like this"* — a current-state claim, false the moment the system
moves. Filed under one name, "is this ADR stale?" has no answer.

## Decision

Every document in a method-managed repo is exactly one of:

- **Immutable** — asserts a historical fact. Written once, never edited. Only its
  status/supersession fields may change, because "this decision was later replaced" is
  itself a historical fact about the decision. ADRs and closed slice docs are immutable.
- **Generated** — derived from immutable sources by a script. Never hand-edited.
  `adr/INDEX.md` and the supersession graph are generated.
- **The ledger** — exactly one hand-maintained mutable file per repo (`LEDGER.md`).

There is no fourth category. Nothing else in the repo is both hand-maintained and
mutable.

Corollary — **single writer, one direction**: an ADR records a deferral once, as a fact
about that decision. The ledger cites the ADR. We never reach back into an ADR to close
a ledger item. The ADR's claim ("at the time of this decision, we deferred X") stays
true forever, so it cannot go stale.

## Consequences

- Staleness becomes structurally impossible rather than diligently avoided. An immutable
  document cannot go stale; a generated one is rebuilt; only one file per repo needs
  human upkeep.
- The architecture/slice distinction becomes a queryable `type:` field (ADR-0002) rather
  than folklore.
- Feature specs must be *frozen at merge* and rewritten to past tense — "this is what
  shipped" — which converts them from current-state claims into historical ones.
- Cost: writing a new ADR to reverse an old one is heavier than editing in place. This
  is the intended trade. The edit is what destroys the record of why we changed our mind,
  and that record has repeatedly proved the most valuable content we produce — see
  gamatar's ADR-0005, whose superseding note explains that its premise assumed *static*
  geometry, a caveat an in-place edit would have erased.
- Nothing here is self-enforcing. The rules are only real once a linter checks them and a
  hook runs the linter (ADR-0003).
