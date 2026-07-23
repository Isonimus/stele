# Stele — Project Conventions

A linted, installable ADR workflow for git projects using Claude as an assistant.
This repo dogfoods its own method: its rules are its ADRs, and its linter checks itself.

## 1. Document taxonomy — four kinds (ADR-0010, superseding ADR-0001)

Every document is exactly one of four things.

| Kind | Files | Rule |
|---|---|---|
| **Immutable** | `adr/*.md`, `slices/*.md` | Written once. Body prose is never edited. Only status/supersession fields may change. |
| **Generated** | `adr/INDEX.md` | Built by script from frontmatter. Never hand-edited. |
| **Ledger** | `LEDGER.md` | Exactly one per repo. The only hand-maintained tracker. |
| **Live doc** | `README.md`, `docs/*.md` | Describes how something behaves *now*. Updated **in the same change** as the thing it describes, and cited from `CLAUDE.md` so it is never orphaned. |

- **ADR** — a decision that later work must obey (a mechanism, data format, or boundary).
  Asserts *"on date X we chose Y because Z"*: a historical claim, true forever.
- **Slice** — one feature work-unit. Written before implementation, **frozen at merge**
  and rewritten to past tense: *"this is what shipped."* Freezing is what converts it
  from a current-state claim (always going stale) into a historical one (never stale).
- **README.md** — a live doc; update it in the same change that alters any
  user/dev-facing feature or API. When something is both a choice and a procedure, the
  choice becomes an ADR and the procedure a live doc that cites it (ADR-0010).

**Single writer, one direction.** An ADR records a deferral *once*, as a fact about that
decision. `LEDGER.md` cites the ADR. **Never reach back into an ADR to close a ledger
item.** The previous convention — record it in both, keep them in sync by hand — was
mandated for three weeks in two repos and executed exactly zero times (ADR-0001).

Changing our minds means writing a **new** ADR that supersedes the old one, never editing
it. The superseding note must say *why the old reasoning was wrong* — that record is the
most valuable thing this workflow produces, and an in-place edit destroys it.

## 2. Enforcement — invariants are executable (ADR-0003)

`node scripts/lint-docs.mjs` checks eleven rules and runs from a pre-commit hook and CI.
`/init-method` installs both into a target repo (ADR-0006) — and refuses to install the
hook while the linter is red, because a hook on a red corpus blocks every commit.

A rule enforced by memory is a rule that holds until the first busy afternoon. Five
supersession defects sat undetected in boxel for weeks because nothing ran. If a
convention matters, it gets a rule; if it can't be checked, say so out loud rather than
writing it down and trusting it.

Run `/wrap-up` before finishing a task. It runs the linter and asks the three questions
that actually get forgotten: did this change a user-facing API, record a decision, or
defer something?

## 3. Quality bar

- **Every relevant piece of logic gets a regression test.** No excuses — and no
  irrelevant, duplicate, or fragile tests either. Tests are codebase: same standards,
  same strict typing.
- **Never use `any`.** Use `unknown` + narrowing, generics, or proper types.
- Industry standards. No hacks, no quick fixes. Find the root cause and fix it for good.
- **Boyscout rule:** leave every touched file better than found. A noticed bug is ours
  even if we didn't introduce it — fix it, or log it in `LEDGER.md` if deferred.
- New linter rules cite the incident that motivated them.

## 4. Commits

- **No `Co-Authored-By` or generated-by trailers.** Plain conventional messages.
- Ship the doc and the code in the same commit.

## 5. The operator may be wrong

The operator (Iker) is not infallible. If a proposal or assumption is incorrect, say so
directly, with data or a clear explanation. Don't defer to a wrong idea to be agreeable —
the operator is glad to change their mind when proven wrong, and would rather be
corrected early than build on a bad premise.

This cuts both ways: when the evidence contradicts *our own* stated convention, report
that too. This repo exists because a survey found a three-week-old rule that had never
once been followed.

Correction is not only for factual errors. When the operator asks for something that
violates an ADR without a justifiable reason, or proposes a subpar fix, feature, or
plan, push back the same way — with evidence and a concrete better option, argued from
this repo's best-practices and ADR-conscious perspective. An operator can lack context a
decision record already settled, so citing it *is* the correction. And if a violation
turns out to be justified, that justification is a new (or superseding) ADR — never a
silent exception.

## 6. Token economy

- The main model plans, reviews, corrects, and writes tests. Delegate rock-mining
  (mechanical refactors, boilerplate, broad surveys) to cheaper subagents — **Haiku 4.5
  for mechanical work, Sonnet 5 for work needing judgement** — instructed to return
  minimal, structured output so the main context stays clean.
- When context is deep and the task context is clearly switching, **tell the operator
  it's a good moment to `/compact`** — they forget, and it causes context rot.
