---
id: 0019
title: Immutable bodies may gain lines, never lose them
type: architecture
status: accepted
date: 2026-07-27
supersedes: []
superseded_by: []
---

# ADR 0019 — Immutable bodies may gain lines, never lose them

## Context

"Body prose is never edited" is the first rule of the taxonomy (ADR-0010, superseding
ADR-0001). Every other guarantee in this kit rests on it: the index is generated from
frontmatter because bodies do not move, supersession is a graph of records that stay true,
and the reason the workflow is worth anything at all is that a decision written in 2026 still
says in 2027 what was actually decided.

Nothing enforces it. Reproduced: rewrite the body of a committed ADR so it asserts the
opposite of its decision, `git commit` — hook green, no warning, no trace outside `git log`.
A grep of the corpus finds no ADR that has ever discussed enforcing this; it is the one rule
the project's own machinery leaves to memory, which is what ADR-0003 says a rule left to
memory is worth.

It was left there for a defensible reason. `lint(root)` is a pure function over one directory,
and that purity is what makes it testable and reusable from `init-method`. `README.md` states
the layer-3 boundary as "none can be decided by reading one version of a file" — true, and it
quietly swallowed this one, because immutability is not decided by reading one version. It is
decided by reading **two**, and the hook has had git in hand the whole time.

**The rule as written is too strong, and the corpus says exactly how.** Five documents here
have been edited after their commit. Across all five, `git diff` from first version to HEAD
shows **zero deleted body lines** — every edit is a frontmatter field change (`status`,
`superseded_by`), an appended `## Amendment — <date>: …` block, or an insertion. `amended` is
already in the status vocabulary (ADR-0002) and ADR-0004 carries two amendment blocks.

The first draft of this decision read that as *append-only* and proposed a prefix test. Running
it against the repo's history refuted it in one line: ADR-0003 carries a correction note
inserted mid-body, immediately above the claim it corrects —

> **Corrected 2026-07-21.** Ten rules, not nine … This marker, rather than an edit to the line
> above, is the correction convention sanctioned by ADR-0001's 2026-07-21 amendment.

— which is not an accident but this repo's *sanctioned* way to correct a wrong claim, chosen
precisely so the correction is read by whoever reads the claim. A prefix rule would have made
the corpus's best example of doing this right illegal. The measurement that suggested
append-only had only looked for deleted lines; it never asked where the added ones went.

So the invariant the practice actually follows is:

> frontmatter may change; body lines may be **added anywhere**, and never removed or rewritten.

That is mechanically checkable, and the corpus is compliant with it — so unlike rules 12 and
13, this one needs no legacy date split. It can ship as an error today.

## Decision

**`scripts/check-immutable.mjs <base> <head>` compares two trees and fails when an immutable
document's body is not an append-only extension of its earlier self.**

**1. A sibling of `build-index --check`, not a lint rule.** It shells out to git, so it cannot
live inside `lint-docs.mjs` without destroying the purity that makes `lint(root)` testable and
reusable. It takes two tree-ish arguments and is called by the hook (`HEAD` vs the staged tree
that ADR-0018 already materialises) and by CI (the base of the push or PR vs `HEAD`).

**2. The test is a subsequence, not a prefix.** Every line of the old body must still be
present in the new one, in the same order; anything may be inserted between them. Trailing
blank lines are ignored so a final-newline change is not an edit. This is a two-pointer scan —
no diff algorithm, no dependency — and it is the shape the corpus argued for above.

It has one known hole, stated rather than hidden: deleting a line that recurs verbatim later
in the same body reads as intact, because the scan finds the later copy. In practice the lines
that recur verbatim are blanks and bare headings (`## Decision`), which are scaffolding rather
than claims. Closing it would mean a real diff, and buying that against a failure mode nobody
has produced is the speculative generality `CLAUDE.md` §3 forbids.

**3. Frontmatter is explicitly out of scope.** Status and supersession fields are the mutable
surface by design (ADR-0002): they are how a superseded document announces it. The body is
everything below the closing `---`, and only that is compared.

**4. Removing an immutable document is the same offence.** A path present in `<base>` and
absent from `<head>` fails. Deleting a decision record destroys more than editing one does. The
cost is that a genuine file rename reads as a deletion — accepted, because renaming an ADR
breaks every path citation to it (the README links a dozen by filename) and is not a thing to
do casually.

**5. Unparseable documents are skipped, not guessed at.** If either version's frontmatter does
not parse, the body boundary is unknown, and comparing whole files instead would be a silent
change of meaning. Rule 1 already errors on exactly those files, so the corpus is red anyway
and nothing escapes: the two checks own disjoint halves of the same failure.

**6. The escape hatch is the one that already exists.** `git commit --no-verify`, documented at
the top of the hook, with CI as the backstop that makes the bypass visible in a PR. No new
allowance token, no per-file opt-out: this repo's rule is that a justified violation is written
down as a new or superseding ADR (`CLAUDE.md` §5), and a mechanism for taking silent exceptions
would be a mechanism for not writing that ADR.

## Consequences

- **The taxonomy's first rule is now the kind of rule this project claims to build.** Layer 3
  of the README loses a question it should never have been holding — immutability was never a
  coverage question, it was a two-version question filed under a one-version limit.
- **Ships green on this corpus and, in principle, on any honest one.** Zero body deletions in
  19 documents across the repo's history is why there is no date split here. An adopting repo
  whose history contains real body rewrites will see them only from the install point forward,
  since the check compares commits rather than auditing the past.
- **In-place correction markers stay legal, and that was decided by evidence rather than
  taste.** The first draft of this ADR would have banned them on a chronology argument that
  sounded good and that the repo's own history contradicted. Writing the check before
  finalising the decision is what surfaced it — a design question with a measurable answer,
  measured (`~/.claude/CLAUDE.md` §4).
- **A rename now needs `--no-verify` and a reason.** This is friction on purpose, but it is
  friction on a rare and citation-breaking operation; if it turns out to be needed routinely,
  that is evidence for a superseding ADR, not for a quiet exception.
- **CI must fetch enough history to have a base.** `fetch-depth: 0`, and a push to a brand-new
  branch has no comparable base — that case reports out loud that it is skipping rather than
  passing silently.
- **Adopting repos need `--update`.** The checker joins the vendored set (ADR-0006) alongside
  the linter and the index builder, and the hook refuses to run without it.
