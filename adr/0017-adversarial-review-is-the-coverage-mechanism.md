---
id: 0017
title: Adversarial review gives the coverage layer a mechanism
type: architecture
status: accepted
date: 2026-07-27
supersedes: []
superseded_by: []
---

# ADR 0017 — Adversarial review gives the coverage layer a mechanism

## Context

The method's enforcement has three layers, and the third one has no machinery in it.

`README.md` states the split: rules are machine-checked, legacy-tolerated, or "explicitly
declared uncheckable — never silently trusted". The third layer is honest, and the honesty
is load-bearing. But read what it actually delegates:

- whether a verify script tests something *true* (ADR-0004, amendment 2026-07-22);
- whether the acceptance scenarios are *complete* (ADR-0011, rule 13);
- whether counterintuitive code *carries* its citation (ADR-0012);
- whether a §4 standing invariant actually *holds* (ADR-0004).

Four coverage questions, accumulated across four ADRs, every one of them routed to the same
destination: `/wrap-up` surfaces it "for a human read-through". That is not a mechanism. It
is a prose instruction to look harder, and this project exists because a prose instruction
to look harder is the thing that does not happen. ADR-0003 puts it plainly — a rule enforced
by memory holds until the first busy afternoon. ADR-0004's Finding 2 counted eleven of
twelve verify scripts unwired, each one having run on the day it was written and never
since. The survey that started this repo found a three-week-old rule followed exactly zero
times in two repos.

Layer 3 is currently in that state, and it is in that state *by construction*: every ADR
that met a question it could not lint deposited it there, correctly declined to fake a check,
and moved on. Nothing has ever gone back to ask what layer 3 could be enforced *by*, if not
a linter.

**The specific defect is who is asked, and when.** Each coverage question has the shape "is
what you wrote sufficient?", and it is addressed to the person who just wrote it. They
already believe it is sufficient — that belief is *why* the code looks the way it does. The
reader holds the author's context, so the review returns the author's conclusion. This is
not a discipline failure that trying harder fixes; it is the predictable output of asking a
question of the one reader structurally unable to answer it. ADR-0004 anticipated the shape
of this without naming it, in the Consequence that a §4 exception "is the kind of deliberate
choice a later 'consistency fix' silently undoes" — a later reader, lacking context, sees
what the author cannot. The same asymmetry that makes a fresh reader *dangerous* to a
deliberate choice makes them *useful* against an unexamined one.

A fresh-context reviewer is therefore the one instrument that fits layer 3's questions. What
is new is that it is now cheap: a subagent can be spawned per task with a controlled context,
which a second human reviewer per task never was.

## Decision

Work that meets the trigger below gets an **adversarial pass** before `/wrap-up`'s four
questions: one or two subagents, briefed to find what the author missed, whose findings are
dispositioned through the recording machinery that already exists.

**1. Trigger.** The pass fires when a change touches any of: a `CLAUDE.md` §4 standing
invariant, an exported/public API surface, a data format or anything that persists, or a
Definition of Done scenario the slice itself flagged as risky. This mirrors ADR-0004's
harness trigger ("any slice whose behaviour a unit test cannot assert") — a behavioural test,
not a judgement call about importance. Everything else is opt-in. An untriggered pass on a
docs-only change is the ceremony that gets abandoned by the third repetition, taking the
triggered passes with it.

**2. Blind to intent, aware of law.** The reviewer receives the diff, the repo's `CLAUDE.md`,
and `adr/INDEX.md`. It does **not** receive the conversation, the author's rationale, or the
slice's own claims about itself.

The distinction is the whole design. A reviewer given the rationale is anchored by it and
returns it; that is the defect in Context. A reviewer given *nothing* is the "later operator"
of ADR-0012 — it re-derives intent from the diff, and flags every deliberate deviation as a
defect. That failure is not hypothetical noise: it is the exact reader ADR-0012 was written
to defend against, now invoked deliberately, every task. Three rounds of confident findings
about things an ADR already settled and the pass stops being run, which is how layer 3 gets
its second dead mechanism.

Withholding intent while supplying the corpus is what avoids both. The reviewer cannot agree
with reasoning it has not seen, and it can say "this contradicts ADR-0009" — a finding
strictly more valuable than "this looks wrong", and one the author was the least likely
person to produce.

**3. Two disjoint mandates, not two reviewers.** Two agents asked the same question return
substantially the same list; the second one costs tokens and buys overlap. Where a second
pass is used, it gets a different brief:

- **Correctness** — edge cases, error and failure paths, boundary values, partial-failure and
  ordering hazards. Needs judgement; delegate to Sonnet 5 (`~/.claude/CLAUDE.md` §6).
- **Cost** — complexity class, allocation, IO inside loops, anything sound at n=10 and dead at
  n=10⁵. Claims must be countable.

**4. A finding states a failure, or it is not a finding.** Every reported item must give a
concrete failure scenario — input or state → wrong output, crash, or a counted cost. "Consider
validating this" is rejected at intake without being investigated. This is `~/.claude/CLAUDE.md`
§4 ("decisions cite measured data, not estimates") applied to the reviewer, and it is what
separates this from a review that returns forty plausible worries and costs more to triage
than to ignore.

**5. Disposition — the main model verifies, then routes.** A finding is a claim, not a verdict.
The main model reproduces it before acting: an accepted correctness finding is reproduced *as
a test that fails before the fix and passes after*, which is not a new requirement but the
regression-test rule this repo already holds (`CLAUDE.md` §3). A finding that cannot be
reproduced is rejected — the reviewer had no intent context and is confidently wrong a
predictable share of the time.

Findings route to the destinations that already exist (ADR-0005). Critical and reproduced:
fix now. Real but deferred: one line in `LEDGER.md`. A decision it forces: an ADR. A separable
work-unit: a slice.

**6. Rejections are recorded, and this is the part with the most value.** A finding correctly
rejected — the loop is O(n²) but n is bounded at 12 — is hard-won reasoning that the next
task's fresh reviewer will raise *again*, and the one after that, forever. Recording it is
what makes the practice get cheaper per run instead of costing the same every run. The
mechanism is already specified and already exactly right: a code-site citation (ADR-0012) where
the rejection is local to a call site, a §4 row where it binds future work. An adversarial pass
is the best generator of ADR-0012 citations this method has, because it identifies precisely
the lines a later operator would try to "fix" — by having one try.

**7. Enforcement: review-only, deliberately unlinted, for now.** Nothing here is
machine-checkable. Whether a pass happened, and whether its findings were honestly
dispositioned, cannot be decided by reading one version of a file — it is a coverage question
about the coverage mechanism, and claiming otherwise would be the false green rule 10 exists
to kill.

A `## Adversarial review` required-section rule on slices is available and would be the exact
sibling of rules 12 and 13. It is **not** shipped with this ADR. This repo's own precedent is
that a rule follows the incident that motivates it: rule 11 was written after Finding 2
counted the unwired scripts, not before. Shipping a section-presence rule on day one would
enforce that the heading exists — never that the review was real — on a practice with zero
runs of evidence behind it. The pass runs from `/wrap-up` for some slices first; if it earns a
rule, that rule is its own ADR, citing what it found.

## Consequences

- **Layer 3 has an instrument.** The four accumulated coverage questions get a reader who can
  actually answer them, rather than a fourth restatement of "surfaced for human read-through".
  The layer stays honestly unlinted; it stops being empty.
- **The cost is bounded by the trigger, and the trigger is the fragile part.** Two extra agents
  per qualifying task is real spend. If the trigger widens by habit until every change gets a
  pass, the finding-to-noise ratio falls, the operator starts skimming the reports, and the
  mechanism dies exactly the way an unwired verify script dies. The trigger is not decoration.
- **The reviewer will be confidently wrong sometimes, and the design assumes it.** Requirement
  5 exists because a fresh-context reviewer with no intent will produce findings that are
  deliberate choices misread. The reproduce-before-acting rule is what stops a confident report
  from driving a bad fix; a pass whose findings are accepted on assertion is worse than no pass,
  because it launders a guess into an authorised change.
- **It generates ADR-0012 citations as a by-product**, which is the compounding effect. Each
  rejected-with-reason finding leaves a marker at the site that stops the next reader —
  human, this pass, or a future one — from re-raising it. Reviews get cheaper as the corpus
  gets marked.
- **It does not check that the checks we need exist.** The limit rule 11's amendment drew still
  holds one level up: this pass finds what *this* reviewer thought to look for, on this diff.
  It is a better instrument than an author reading their own work, not a guarantee of coverage,
  and it is not claimed as one.
- **No machinery ships with this ADR.** `/wrap-up` gains the step, and `README.md` and
  `CLAUDE.md` §2 gain a pointer to it — all in this commit. `templates/CLAUDE.md` is
  deliberately left alone: commands are vendored (ADR-0007), so an adopting repo receives the
  behaviour with `/wrap-up` itself, and restating it in the template would create the second
  copy with no sync path that the template's own preamble warns against. Nothing is added to
  the linter, and the case for adding something is deferred until there are runs to cite.
