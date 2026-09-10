---
id: '0022'
title: "Mutation checking is a curated list in a wired script, and measures durability rather than correctness"
type: architecture
status: amended
date: 2026-07-28
supersedes: []
superseded_by: []
---

# ADR-0022 — Mutation checking is a curated list, not a framework

## Context

The coverage layer (ADR-0003, README) is the set of questions no linter can answer, and
until now it had one instrument: the adversarial pass (ADR-0017). The question "do these
tests actually bite?" belongs to that layer and had no instrument at all — the suite
reported 101 passing and nothing measured whether any of them would notice a regression.

Measured 2026-07-27, before deciding anything: ten hand-applied mutation operators over the
pure predicates in `lint-docs.mjs` and `check-immutable.mjs`, suite run against each.

**Three killed, seven survived.** A 30% kill rate on hand-picked mutations.

Chasing every survivor mattered more than the number. **None was a live defect.** A lone
`Given` was already rejected, `2026-02-30` was already caught, a root-level link was already
checked — the behaviour was correct in every case, and nothing objected when it changed. One
survivor was an equivalent mutant (`!==` to `!=` between two strings), which is not a gap at
all and cost review time to establish.

That leads to the finding that decides the shape of this: **mutation checking would not have
caught a single defect this repo has actually suffered.** The `RangeError` on
`date: 2026-00-01` and the URL read as a citation were both *missing inputs* — no test passed
those values, and mutating code cannot invent a case nobody wrote. The prefix-versus-
subsequence immutability rule was a *wrong specification*, which mutation checking would have
scored perfectly, because the tests asserted the wrong rule and passed. All three were found
by the adversarial pass and by running against real history.

## Decision

**1. Adopt the technique; do not adopt a framework.** `scripts/check-mutants.mjs` holds a
curated list of mutants and runs the suite against each. Stryker would cost the
zero-dependency property that lets this kit drop into any repo regardless of package manager
— and it would not buy the expensive part. Curating the list *is* the work; the runner is
twenty lines. A generator emits hundreds of mutants over these files, most equivalent or
trivial, so the triage cost rather than the runtime is what makes it a bad trade at this
size.

**2. Scope is the pure predicates.** `normId`, `isCalendarDate`, `citableText`,
`inReadScope`, `withoutFences`, `sectionText`, `hasGherkinTriad`, the R6 boundary, and
`firstLostLine`. These are total and IO-free, and every subtle-logic defect this repo has
had lived in that class. `init-method.mjs` is excluded — its behaviour is pinned by
real-filesystem fixtures, where a mutant mostly proves the filesystem still works — and the
hook is shell.

**3. It runs from `/wrap-up`, never from the hook.** Measured 21.5s, against a 2.18s suite.
That is a fine price for an end-of-task gate and an intolerable one per commit; a slow hook
is a deleted hook (ADR-0018). The `/wrap-up` step is conditional on the change touching a
covered module, and written so a repo without the script skips it.

**4. A survivor is fixed by writing the missing test, never by deleting the mutant.** The one
way a survivor may pass is an `equivalent` field carrying the reason it cannot be killed.
That field is the obvious place to bury an inconvenient gap, so it is required to be prose,
not a flag.

**5. The limit is documented at every surface.** A green run is not a correctness claim. It
says a behaviour is watched, not that it is right, and it is blind by construction to missing
inputs and wrong specifications — which is where every real defect here has come from. The
README, the script header, and the `/wrap-up` step each say so, because the number is
seductive and 90% reads like a correctness score.

## Consequences

- Six regression tests were written for the survivors. The kill rate went from 3/10 to 9/10,
  the tenth being the equivalent mutant. The value was realised on adoption; the standing
  script exists to keep it.
- The mutant list is a maintenance obligation of the same kind as ADR-0018's read set. A
  mutant whose anchor no longer matches is a **failure, not a skip** — `test/mutants.test.mjs`
  asserts every anchor matches exactly once, so rot is caught in milliseconds by the ordinary
  suite rather than after a 21.5s run nobody triggered.
- The check runs against a throwaway copy of the tree, never the working files. An
  interrupted run must not leave mutated source behind.
- **The first draft reported a perfect score against a suite that never ran.** It invoked
  `node --test test/`, which node reads as a module path rather than a directory, so every
  run crashed instantly and all ten mutants counted as killed — in 621ms, a sixth of the
  honest runtime. The tell was the equivalent mutant "dying", which is impossible. The
  runner now refuses to grade anything unless the unmutated suite passes first. A tool built
  to detect false greens shipped one in its first draft, which is the argument for that guard
  better than any reasoning.
- **The equivalent mutant is retained as a canary, and killing it fails the run.** It cannot
  be detected by any honest test, so a kill means the suite failed for a reason unrelated to
  the mutation and every other verdict that run is worthless. It earned that status twice in
  one sitting: first when the test command crashed, and again when the guard in
  `test/mutants.test.mjs` — which asserts every anchor matches exactly once — failed under
  every mutated tree, because applying a mutant is exactly what stops its anchor matching.
  That second one scored a flawless 9/10 for entirely circular reasons. The guard now runs in
  the ordinary suite and is excluded from the mutated one.
- Adopting this elsewhere means writing a list against that repo's own predicates. The script
  is not vendored, because a mutant list is not portable; the `/wrap-up` step is worded to
  skip cleanly where the script is absent.
- What is still not measured: whether the *fixtures* describe reality. Both instruments now
  ask whether the tests are watching and whether the reasoning holds — neither asks whether
  the corpus a fixture imitates looks like a real one. That remains review-only.
