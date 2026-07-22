---
id: '0009'
title: "A citation into another repo's corpus is qualified by repo name, and the linter skips it"
type: architecture
status: accepted
date: 2026-07-22
supersedes: []
superseded_by: []
---

# ADR-0009 — A citation into another repo's corpus is qualified by repo name

## Context

Rules 8 and 9 resolve `ADR-NNNN` references against the corpus of the repo being linted.
Neither can tell a typo from a deliberate reference to a *different* repo's decision, and
they treat both the same way: rule 9 warns, rule 8 — which reads `LEDGER.md` — errors.

That has cost real work three times, in ascending order of severity:

1. This repo's own ADRs trip rule 9 five times citing boxel and gamatar ids. Harmless as
   warnings, but they are the entire reason rule 9 cannot be promoted to an error, which
   in turn is why 567 legacy references in boxel stay unchecked.
2. A ledger line here citing `boxel/adr/0134` had to be written as a **path** to get a
   commit through, because the natural `ADR-0134` was rejected. The workaround is now in
   the corpus, unrecognisable to any tool as a citation at all.
3. The one that forced the issue: `templates/LEDGER.md` opens with "The single mutable
   file in this repo (ADR-0001)" — a reference to *this toolkit's* ADR-0001. Scaffolded
   into a fresh repo, that repo has no ADR-0001, so rule 8 errors, so the corpus is red,
   so `/init-method` refuses the hook. **The installer's own template made every new
   repo permanently unhookable**, and nothing found it until the tool was pointed at a
   genuinely fresh repository (2026-07-22).

Point 3 also disposes of "just don't cite other repos". The templates must, because the
reasoning that governs an installed repo lives here.

## Decision

A reference to another repo's decision is written **qualified**: `<repo>:ADR-NNNN`, as in
`boxel:ADR-0134` or `claude-method:ADR-0001`. Rules 8 and 9 skip qualified references
entirely and resolve only bare ones.

Qualification is a claim about *location*, not existence: this linter cannot open another
repo's corpus and does not try. What it buys is that a bare reference now means
unambiguously "in this repo", so failing to resolve one is a real defect rather than a
maybe — the precondition for ever promoting rule 9 to an error.

The syntax is a repo name and a colon immediately before `ADR`, so an ordinary sentence
ending in a colon ("see also: ADR-0004") is unaffected by the space. It is greppable, it
reads as prose, and it survives a future tool that does resolve across repos, which the
path workaround does not.

## Consequences

- `templates/LEDGER.md` cites `claude-method:ADR-0001`, so a scaffolded repo is green on
  arrival and `/init-method` can install the hook on a fresh repository. That path was
  broken from the day the template was written and had never been exercised.
- The `boxel/adr/0134` path workaround in this repo's ledger is gone — the line that
  carried it closed with this decision.
- The five existing rule-9 warnings here **stay**. ADRs 0001–0004 already cite boxel and
  gamatar ids in prose that is immutable, and requalifying them would be exactly the
  in-place rewrite ADR-0001 forbids. The syntax governs new writing; the warnings are the
  visible cost of the corpus predating its own rule, which is the honest state.
- Promoting rule 9 to an error is now a decision about boxel's 567 legacy references
  alone; the mechanism no longer blocks it. That promotion stays a separate ADR — this
  one only removes the obstacle.
- A typo'd repo name silently suppresses the check for that line. Accepted: the failure
  is a citation nobody validates, not a false green on a local reference.
