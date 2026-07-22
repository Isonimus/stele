---
id: '0010'
title: "There is a fourth kind: the live doc, which describes how something behaves now"
type: architecture
status: accepted
date: 2026-07-22
supersedes: ['0001']
superseded_by: []
---

# ADR-0010 — There is a fourth kind: the live doc

## Context

ADR-0001 closed the enumeration: immutable, generated, or the ledger, and *"there is no
fourth category. Nothing else in the repo is both hand-maintained and mutable."*

That sentence was wrong when it was written, and the same ADR proves it: `CLAUDE.md` §1
lists `README.md` as *"a live document; update it in the same change that alters any
user/dev-facing feature or API"* — hand-maintained, mutable, and sitting outside the
table it was supposed to be governed by. `ROADMAP.md` in gamatar and l33t-mmorpg is the
same shape.

Two cases forced the issue rather than leaving it a tidiness complaint.

**boxel's `docs/harness-notes.md`** (2026-07-22, 69 lines). Driving boxel headlessly has
mechanics that cost a wasted screenshot each to learn: `?seed=N` is required to reach play
mode or `window.__boxel` never exists; a lightning stroke lives ~0.12 s and **cannot** be
screenshotted, so the assertion must read the scene graph instead; fog reaches ~220 so the
camera must stay within ~150 blocks. None of that is a decision — nobody *chose* that fog
reaches 220 as a governance act. It is a property of the rig, it changes when the rig
changes, and an immutable ADR is exactly the wrong container: the first fog change would
make the ADR false, and ADRs may not be rewritten.

**boxel's texture-colour procedure.** How to fetch real MC 1.8 textures and compute
authoritative colours had no home at all, so it lived in assistant memory — invisible to
every other reader of the repo, unversioned, unreviewable, and keyed to an absolute path.
It is *two* things welded together, which is why it fit nowhere: a decision (derive block
colours from the real textures rather than by eye) and a procedure (which mirror, which
computation).

The cost of the missing category is not filing tidiness. It is that knowledge with no
legal home ends up somewhere illegitimate — in memory, in a commit message, or nowhere.

## Decision

There are **four** kinds. The fourth is the **live doc**: a hand-maintained, mutable
document describing how something *is* or *is done* right now.

| Kind | Asserts | Updated |
|---|---|---|
| Immutable (`adr/*.md`) | "on date X we chose Y because Z" — true forever | never; superseded instead |
| Generated (`adr/INDEX.md`) | a view of the immutable set | by script |
| Ledger (`LEDGER.md`) | what is still open | continuously; closing is deletion |
| **Live doc** (`README.md`, `ROADMAP.md`, `docs/*.md`) | "here is how this behaves / how this is done" | **in the same change as the thing it describes** |

Three rules make the fourth kind safe rather than a loophole:

1. **The same-change rule is the whole guarantee.** A live doc that drifts is worse than
   no doc, because it reads as current. It is updated in the commit that changes what it
   describes — not afterwards, not in a docs pass.
2. **Every live doc is cited from `CLAUDE.md`.** An uncited live doc is orphaned and
   nobody will know to update it. boxel's §3 cites `harness-notes.md`; that citation is
   what makes rule 1 enforceable by review.
3. **Split the decision out.** When something contains both a choice and a procedure, the
   choice becomes an ADR and the procedure a live doc, and the live doc cites the ADR.
   "Derive block colours from real MC textures" is an ADR; "here is the mirror and the
   computation" is a live doc. Welding them together is what left the texture procedure
   homeless.

The discriminator, when it is not obvious: *would this sentence still be true in five
years?* If yes, it is a decision. If it goes stale the next time the code changes, it is
a live doc.

Live docs are **not linted** — no frontmatter, no id, not in the index, not cited by rule
8 or 9. The linter checks claims about the past, and a live doc makes none.

## Consequences

- ADR-0001 is superseded rather than amended, because the sentence being corrected is a
  closed enumeration. Everything else it decided — immutability, generation, the single
  ledger, single-writer-one-direction — **carries forward unchanged**; only the count is
  wrong. Its prose stands as written, which is the point of superseding rather than
  editing.
- `CLAUDE.md` in each repo grows a live-doc row and a citation list. boxel's
  `harness-notes.md` is retroactively legitimate; it was already being maintained the
  correct way before there was a rule for it, which is the evidence this ADR rests on.
- The texture-colour procedure moves out of assistant memory into boxel's `docs/`, split
  from its decision. Memory keeps only what governs no codebase.
- A live doc can still rot, and nothing mechanical will catch it — this is the least
  enforceable of the four kinds. It is accepted deliberately: the alternative on offer
  was not "no rot", it was knowledge stored in a place no reviewer can see.
