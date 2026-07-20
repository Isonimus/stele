---
id: 0005
title: Write routing and the bounds of assistant memory
type: architecture
status: accepted
date: 2026-07-20
supersedes: []
superseded_by: []
---

# ADR 0005 — Write routing and the bounds of assistant memory

## Context

ADR-0001 governs documents *inside* a method-managed repo — its decision reads "every
document in a method-managed repo", and its no-fourth-category clause is scoped
"nothing else **in the repo**". Assistant memory sits outside that boundary and was
therefore never governed by anything. A survey of it found cause #5 from the roadmap —
*lessons don't propagate; the method lives in per-project files, so every repo re-derives
it* — replaying one layer below the docs layer where it was first found.

**The evidence.** 71 memory files across 15 project directories. The rule "no
`Co-Authored-By` trailers" appeared in **12 of them, across 8 projects** — twice within
c-level alone. On 2026-06-22 it cost an amend and force-push to scrub a trailer already
pushed to chiron: the rule had been recorded in three other projects by then and was
simply absent from the one being committed to.

**The mechanism is not model failure.** c-level's copy states the rule applies "when
creating any git commit **in any repo the user works on**". The model had correctly
generalised. Memory is keyed by absolute path — `~/.claude/projects/<path-slug>/memory/`
— so a per-directory store was the only destination available. It wrote a global rule to
a local address because no global address existed. Fifteen directories, fifteen
independent re-derivations.

**Memory is the weakest available store for a rule that governs code.** It is invisible
to every other reader of the repo, unversioned, unreviewable, has no diff and no commit
gate, and does not survive a repo move or a change of machine. Every property ADR-0003
relies on for enforcement is absent.

**The failure has a self-referential proof.** gamatar's memory contained a file whose
entire content was *"conventions live in the repo's `CLAUDE.md`; don't duplicate them
into memory"* — the right instinct, filed in the wrong place, and by the time it was read
it was itself stale, still naming the `BACKLOG`/`ISSUES` split that ADR-0001 had
replaced with `LEDGER.md`. A pointer stored in the store it points away from goes stale
like anything else hand-maintained.

**The trigger is a phrasing habit, not a judgement lapse.** The operator says *"save this
to the project memory"* — naming a destination rather than describing a fact. The
assistant obliges, because it was given an address instead of a routing problem. Nothing
in the exchange ever asks *what does this fact govern?*

## Decision

Writes route by **what the fact governs**, never by where the conversation happens to be
or which store the operator names.

| The fact governs… | Destination | Because |
|---|---|---|
| A codebase — invariants, architecture, definition-of-done | that repo's `CLAUDE.md` | must be greppable, diffable, reviewable, visible to collaborators |
| How the operator works, everywhere | `~/.claude/CLAUDE.md` | written once, applies to every repo |
| Open work — deferrals, defects, follow-ups | that repo's `LEDGER.md` | it is a worklist, not a fact (ADR-0001) |

**Memory is the residual, and it is bounded.** It holds only what fits none of the above:
operator-personal, cross-session facts not worth committing to any repo. Git identity is
the canonical example — which identity a given repo commits under is stated per project
at kickoff, so it is genuinely local and genuinely personal.

Three consequences follow:

1. **A rule that governs a codebase never goes in memory.** No exceptions. If it
   constrains code, it is committed where reviewers see it.
2. **When asked to remember something, say which destination it went to.** The routing
   decision is stated out loud, so a misroute is correctable in the moment rather than
   discovered in a survey three weeks later.
3. **A destination named by the operator is an input, not an instruction.** "Save this to
   project memory" describes where they expect it to land, not where it governs. Route it
   correctly and say so.

`global/CLAUDE.md` is version-controlled in this repo and installed by symlink, not by
copy. A copy would be dual-write with manual sync — the precise failure ADR-0001 exists
to eliminate.

## Relationship to ADR-0001

This extends ADR-0001 rather than superseding it. ADR-0001's taxonomy
(immutable / generated / the one ledger) is scoped by its own text to documents inside a
method-managed repo, and remains exactly as written. ADR-0005 governs the territory
outside that boundary, which previously had no rule. Memory is not a fourth category
*within* the repo taxonomy; it is a store outside the repo, now bounded to a residual
that the three in-repo destinations deliberately exclude.

## Consequences

- The 12 duplicated trailer memories and their general-practice siblings are deleted;
  `global/CLAUDE.md` §5 carries the rule once. gamatar's memory store empties completely,
  which is the shape this ADR predicts for a fully-routed repo.
- A repo without a `CLAUDE.md` has no destination for its own invariants, so memory
  becomes the only available store and the failure recurs by construction. boxel and
  l33t-mmorpg are both in this state; both are logged in the ledger. **Scaffolding
  `CLAUDE.md` is a precondition for routing, not a follow-up to it.**
- `/remember` is a **router, not a store** — it takes a fact, classifies it against the
  table above, writes it to the correct destination, and reports which. Implementing it as
  a memory-writing command would automate the exact failure this ADR records.
- Routing is not machine-checkable the way ADR-0003's rules are: no linter can tell
  whether a sentence governs a codebase or a person. Per this repo's own standard, that is
  said out loud rather than written down and trusted. The mitigation is procedural —
  consequence 2 above makes each routing decision visible at the moment it is made.
- The symlink install has a silent failure mode: if this repo moves, `~/.claude/CLAUDE.md`
  dangles and the global conventions vanish with no error, because a missing file there is
  a legal state. A `--check` mode is logged in the ledger.

## Alternatives considered

**Leave memory ungoverned and rely on the model generalising.** Rejected by the evidence:
the model *did* generalise — c-level's copy says "in any repo the user works on" — and the
rule still cost a force-push. Correct generalisation with no global destination produces
duplication, not propagation.

**Put general practices in every repo's `CLAUDE.md`.** This is dual-write across ~100
repos, with no sync mechanism and no reconciliation point. It is the boxel backlog rule at
larger scale, and that rule executed zero times in three weeks (ADR-0001).

**Ban memory entirely.** Rejected: per-project operator-personal facts are real and have
no other home. Git identity is per-repo by the operator's explicit practice, so a global
file would be the wrong destination for it, not merely an unnecessary one.
