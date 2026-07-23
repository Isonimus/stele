---
id: 0012
title: Cite the governing ADR at the code site
type: architecture
status: accepted
date: 2026-07-23
supersedes: []
superseded_by: []
---

# ADR 0012 — Cite the governing ADR at the code site

## Context

The method records *why* a deliberate choice was made, but never at the place where a later
operator — human or model — meets that choice and is tempted to "fix" it. The decision lives
in an immutable ADR and, when it binds future work, in the `CLAUDE.md` §4 standing-invariants
table with its exception column (ADR-0004). Both are real; both are *elsewhere*. The person
about to change a line is reading the line, not grepping the conventions file.

ADR-0004 already names the failure mode this leaves open. Its Finding 3 records the GLASS
exception — glass deliberately ships no procedural speckles, tried live and vetoed ("read as
grime on a window") — and warns that "the GLASS veto is the kind of deliberate choice a later
'consistency fix' silently undoes." The §4 table is the reviewer's index of such choices, but
it only helps a reader who already thinks to consult it. A counterintuitive line with no
marker reads as an oversight, and an obedient model "tidying" the code removes it in good
faith. The intent was recorded; it just was not recorded *where the edit happens*.

A code comment at the site is the missing half. It is the editor's warning where the reviewer
already has an index: `// see ADR-NNNN` — or, at a deviation, the one-line reason — turns a
line that looks like a mistake into a line that announces it is on purpose and says where the
reasoning lives. This is not a substitute for the §4 table; it is its twin. The table lets a
reviewer enumerate the deliberate choices in a repo; the comment stops one from being undone
by someone who never opened the table.

## Decision

Where code makes a choice a later operator would plausibly try to "fix" — a deliberate
deviation, a non-obvious constraint, a hard-won exception — cite the governing ADR (or slice)
in a comment at that site:

```
// ADR-0007: commands are vendored — local edits here survive re-runs, do not regenerate.
copyIfAbsent(command);
```

- **It marks surprise, not everything.** The citation belongs where the code contradicts a
  reasonable expectation, not on every line that happens to trace to a decision. A comment on
  the obvious is noise, and noise is what gets skimmed past — which would bury the citations
  that matter. This is the WHY-not-WHAT comment rule (`~/.claude/CLAUDE.md` §3) aimed at its
  sharpest case: the WHY a reader would otherwise "correct."
- **It cites, it does not restate.** The comment names the ADR and gives at most a one-line
  reason; the durable rationale stays in the immutable ADR, which is its job. A paragraph of
  reasoning copied to the code site is the duplication-without-a-sync-path this workflow
  exists to prevent (ADR-0001) — when the ADR is superseded, the copy silently lies. The
  citation is a pointer precisely so it cannot drift out of sync with what it points to.
- **It complements §4, it does not replace it.** A standing invariant still earns its §4 row
  (the reviewer's index); the code comment is the same fact placed where the edit happens. A
  choice local to one call site needs only the comment; one that binds all future work needs
  both.

**Enforcement — the split this method always draws.** Two rules hide here, and only one is
machine-checkable (ADR-0003):

- **That critical code *carries* a citation** is the coverage question. "Critical" is a
  judgement no linter can make from one version of a file — the same limit ADR-0004 draws for
  "does a verify script test something true" and ADR-0011 for "are the acceptance scenarios
  complete." It is **review-only**: `/wrap-up` surfaces it for a human read-through, and a
  linter that claimed to check it would be the false green rule 10 exists to kill.
- **That a citation, once written, *resolves*** is mechanical — a source-side sibling of the
  ledger's rule 8. It is worth having: a comment pointing at a superseded or non-existent ADR
  is exactly the drift this project catches everywhere else. But the linter's corpus today is
  the document tree; extending it to walk source means settling a *repo-specific* file scope
  (what counts as source, what is vendored or generated and skipped) that the doc tree does
  not have. That scope is a real design question, not a line to bolt on blind, so the resolve
  check lands as its own rule once the scope is decided — carried in `LEDGER.md` until then,
  not asserted as enforced when it is not.

Reading a `.ts` or `.js` comment does not breach ADR-0002: the machine-readable *schema* stays
the frontmatter, untouched. A source-side resolve check would read a citation token, never
treat code comments as a data surface — the same line rule 12 draws when it reads a markdown
heading's presence but never its contents.

## Consequences

- **Deliberate choices announce themselves at the edit.** The GLASS veto, the same-commit
  spawn-egg rule, any hard-won exception — each stops reading as an oversight to a fresh
  operator, which is the specific way ADR-0004 says such choices get silently undone.
- **It raises the floor; it does not lock the code.** A comment is a warning, not a guard: a
  determined or careless edit still removes it. The claim is only that a marked line is far
  less likely to be "fixed" by someone acting in good faith on incomplete context — the
  overwhelming case. Overclaiming would be the aspiration §4 says to measure, not assert.
- **The convention costs nothing to adopt and is enforced by review now.** No new machinery
  ships with this ADR; `/wrap-up` gains the read-through question. The mechanical resolve
  check is deferred with its scope question stated, not silently skipped — the honest layer
  ADR-0003 requires.
- **`/wrap-up` carries the reminder.** The convention reaches work only if the workflow
  surfaces it, and the citation is written *during* implementation — so `/wrap-up`, the
  after-code gate, is where it belongs, not the `/slice` scaffold that runs before any code
  exists. `/wrap-up` asks whether counterintuitive code cites its decision; this ADR is the
  record a `/remember` routes such a rule to (ADR-0005) — the code site, not assistant memory.
