---
id: '0025'
title: "The established solution is the default; a hand-rolled replacement is argued in writing with a named cost and a measured build"
type: architecture
status: accepted
date: 2026-07-31
supersedes: []
superseded_by: []
---

# ADR-0025 — The established solution is the default; reinvention is argued, not assumed

## Context

The quality bar (ADR-0024) says an assistant pushes back on a subpar plan with a concrete
better option. It does not say what to do in the most common case where the better option is
not something to invent: a library, pattern, or protocol that already exists, is already
tested by more users than this project will ever have, and already handles the edge cases the
bespoke version will meet one at a time in production.

The gap is not hypothetical here. Two records in this corpus sit on either side of it, and
they are why this decision has a shape more complicated than "prefer the standard."

**ADR-0008 is the bill for not asking.** ADR-0003 put the doc checks in
`.git/hooks/pre-commit` and ADR-0006 had `/init-method` symlink them there. Both assumed the
slot was free. It is not free in any repo using the Python `pre-commit` framework — which
owns that exact file, is widely deployed, and would silently replace our symlink on its next
`install`, leaving the checks gone and nothing saying so. That was found by survey on
2026-07-22, three ADRs after the design was set, and the repair is permanent: `/init-method`
now carries two install shapes, a branch, and a refusal path for unfamiliar YAML. The cost of
not asking "what already owns this slot?" was not a rewrite. It was a second shape to
maintain forever.

**ADR-0022 declines the standard, and does it correctly.** It rejects Stryker for mutation
checking, and it earns the rejection twice over: it names the property the dependency would
cost (zero-dependency drop-in, which is what lets this kit land in a repo regardless of
package manager) *and* it measures the replacement rather than guessing at it — "curating the
list *is* the work; the runner is twenty lines." That is not reinvention. That is a departure
with a receipt.

So a rule reading "where a standard exists, use it" would be false in this repo on the day it
shipped. This kit is itself a hand-rolled ADR linter where `adr-tools` and `log4brains` exist,
a hand-rolled mutation runner where Stryker exists, and a hand-rolled vendor/update mechanism
where package managers exist. A bar whose first design rule is broken by the tool shipping the
bar is the ADR-0003 failure — a stated standard nothing honours — committed one level up.

The motivating observation was the operator's own ("the operator tends to reinvent the
wheel"), which is an unmeasured self-assessment and not, by this repo's convention, sufficient
grounds for a rule. The two records above are the incidents that are.

## Decision

**1. The established solution is the default.** Where a well-tested library, pattern, protocol,
or industry standard covers the need, it is proposed first and **by name**, before any bespoke
design is drawn. This holds when the operator asked for a bespoke build: a request for one is
not evidence that no standard exists, and the operator is frequently the person who does not
know that it does. Not proposing it is the ADR-0024 §7 failure — deferring to a plan because
it was the plan on the table.

**2. A departure is admissible, and it is admissible under two conditions together.** It
names the property the standard would cost — a hard constraint, a dependency budget, a
platform or licence limit, a supply-chain rule — **and** it states the build cost as a
measurement rather than an estimate (ADR-0024 §3). ADR-0022 is the worked example of both
halves. One half alone does not carry it: a named cost with an unmeasured build is how a
twenty-line estimate becomes a subsystem, and a measurement with no named cost is a
preference dressed as arithmetic.

**3. The departure is written down before the code, in the ADR that chooses it.** Not in a
commit message, not in a comment, not only in the conversation. This is ADR-0004's rule
applied to this specific decision class, and it is what makes the reinventions in this repo
legible as choices rather than as ignorance.

**4. What is not admissible** is reinventing by default, or meeting the standard after the
code exists. The second is the expensive one: at that point the sunk build argues for itself,
and the comparison is no longer between two designs but between a design and a rewrite.

**5. Enforcement is `review-only`, and this is a ceiling, not a gap left open.** ADR-0013
already settled why: whether the model searched for what exists *cannot be checked from any
version of a file*. The absence of a proposal leaves no artifact. The same argument that put
the reuse decision at a gate rather than in prose applies, and there is no gate here — a
missing counter-proposal is invisible to every commit. Per §2 of this repo's `CLAUDE.md`, that
limit is stated out loud rather than written down and trusted.

## Consequences

- `docs/quality-bar.md` §2 gains the rule, and §7 gains one clause pointing at it. The
  clause does not restate it; ADR-0024 exists because restating a rule in a second place
  produces two drifted copies.
- Nothing is added to `global/CLAUDE.md`. That file and the shipped bar already carry the bar
  twice, which is the open `[decision]` item this repo owes an answer to (ADR-0024, ADR-0005);
  writing a *new* rule into both is the drift that item exists to stop, committed knowingly.
- This repo's existing reinventions are now governed retroactively by a rule they predate.
  ADR-0022 already satisfies it. The linter, the index generator and the vendor mechanism do
  not — no record names what `adr-tools` or `log4brains` would have cost. That is a real debt
  and it goes to `LEDGER.md` rather than being fixed by asserting here that the choice was
  obviously right; the whole point of the rule is that "obviously right" is what an unmeasured
  departure always feels like from inside.
- The rule cannot be checked, so it will be followed exactly as often as it is read. It is in
  the bar, which `/wrap-up` and review actually open, rather than in a rule file it would be
  invisible in.
