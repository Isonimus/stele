---
id: '0028'
title: "Mutation scope is the class of decision a mutant can prove, not the list of files ADR-0022 named"
type: architecture
status: accepted
date: 2026-09-10
supersedes: []
superseded_by: []
---

# ADR-0028 — Mutation scope is the class of decision, not the file list

## Context

ADR-0022 scoped the mutant list to "the total, IO-free predicates in `lint-docs.mjs` and
`check-immutable.mjs`", and excluded `init-method.mjs` on a stated ground: *a mutant there
mostly proves the filesystem still works*. Two different things were written down in one
sentence — a **reason** about what a mutant can prove, and a **file list** that happened to
satisfy it. They coincided only because the sole IO-heavy module in the repo at the time was
the installer.

They have since come apart twice, and both times the divergence was resolved by a note in
`scripts/check-mutants.mjs` rather than by a decision:

- `classifyVendored` (ADR-0023) is a total, IO-free predicate living inside the *excluded
  file*. It was admitted with a comment arguing it "falls inside the scope ADR-0022 actually
  described rather than the file it named."
- On 2026-09-10 seven mutants were added over `.claude/hooks/post-tool-lint.mjs` and
  `.claude/hooks/session-digest.mjs` (ADR-0027). These are the inverse case: they *do* read
  the filesystem, so the file list excludes them, while the reason does not — each reverses a
  decision (which edits are worth checking, which severities block, how much output is
  printed, what the digest's budget reserves) and the file read is incidental to all of them.

A rule amended twice in its own implementation's comments is a rule that no longer says what
is being done. That is the ADR-0005 failure — the record and the practice drifting apart —
running inside the file that implements the check.

The extension is not free, and the measurement argues both ways.

**For it:** the seven hook mutants killed 24 of 24 on the first full run, but one survivor
appeared before that — the digest's trailing newline was left out of its own byte budget, so
the cap it advertised was off by one. Correct behaviour that no test was watching, in code
that reads a file, and therefore invisible to the file list. It was fixed by a boundary sweep
test, per ADR-0022's own rule that a survivor is repaired by the missing test and never by
deleting the mutant. The layer these mutants cover is also *advisory* by ADR-0027: a defect
in a Claude Code lifecycle hook is not caught by a red build the way a linter defect is, so
it is caught by nobody.

**Against it:** each mutant costs one full suite run. Measured on 2026-09-10, 25 mutants take
**93.6 seconds** wall clock, against roughly 35 seconds when the list held 16. The growth is
linear in list length and the check runs in CI. Scope that expands by argument rather than by
a file list expands more easily, and this one is paid for on every push.

## Decision

**The boundary is the class of decision a mutant can prove, and ADR-0022's file list is
demoted from the rule to an example of it.** No file is in or out by name.

1. A mutant belongs in `MUTANTS` when it **reverses a decision the code makes** and the test
   that should notice is a test of that decision. Whether the enclosing function performs IO
   is not the question.
2. ADR-0022's exclusion **stands, with its reason intact**: a mutant that would mostly prove
   the filesystem, the network, or git still works stays out. That rules out `init-method`'s
   copy-and-symlink work, the git-reading half of `build-changelog.mjs` (ADR-0026), and
   anything whose failure mode is "the environment changed".
3. A mutant over IO-touching code must **name the decision it reverses in its label**, so the
   entry itself carries the argument for its own admission. Every current entry does.
4. The list stays **curated and hand-picked** — ADR-0022 is unchanged on this, and the
   measured runtime is why. A generator over this class would emit hundreds and cost hours.
5. The runtime is a **stated cost, not an open budget**. It is reported here at 93.6s/25 so a
   later reader can see what a mutant costs before adding the fiftieth. If the check grows to
   where CI or an operator starts skipping it, the answer is a faster runner — the current one
   copies the tree and runs the whole suite per mutant — and not a quieter rule.

## Consequences

ADR-0022's status becomes `amended`. Its mechanism, its curation argument, its
survivor-means-write-a-test rule and its explicit statement of what mutation testing does not
buy all continue to hold; only the scope sentence is superseded by the one above.

The two in-file notes stop being exceptions and become applications, and
`scripts/check-mutants.mjs` cites this decision at the site instead of arguing from
first principles in a comment (ADR-0012).

The cost is a softer boundary. "Names the decision it reverses" is a judgement call in a way
that "which file is it in" was not, so a marginal mutant is now argued rather than looked up.
That is accepted because the file list was already being overridden in practice by two
documented notes, and a boundary that gets argued each time is worth more than one that reads
cleanly and is quietly ignored — which is the whole thesis of ADR-0003 applied to this repo's
own rule.

This does not license mutation testing of `init-method.mjs`'s installer behaviour, of CI
configuration, or of anything reached through a network call. Those are excluded by clause 2,
for the reason ADR-0022 gave and this ADR keeps.
