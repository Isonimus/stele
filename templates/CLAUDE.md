# {{PROJECT_NAME}} — Project Conventions

{{PROJECT_DESCRIPTION}}

Stack: {{STACK}}

## 1. Document taxonomy — immutable or generated

Every document is exactly one of three things. There is no fourth.

| Kind | Files | Rule |
|---|---|---|
| **Immutable** | `adr/*.md`, `slices/*.md` | Written once. Body prose is never edited. Only status/supersession fields may change. |
| **Generated** | `adr/INDEX.md` | Built by script from frontmatter. Never hand-edited. |
| **Mutable** | `LEDGER.md` | Exactly one per repo. The only file maintained by hand. |

- **ADR** — a decision later work must obey (a mechanism, data format, or boundary).
  Asserts *"on date X we chose Y because Z"*: a historical claim, true forever.
- **Slice** — one feature work-unit. Written before implementation, **frozen at merge**
  and rewritten to past tense: *"this is what shipped."* Freezing converts it from a
  current-state claim (always going stale) into a historical one (never stale).
- **README.md** — live document; update it in the same change that alters any
  user/dev-facing feature or API.

**Single writer, one direction.** An ADR records a deferral *once*, as a fact about that
decision. `LEDGER.md` cites the ADR. **Never reach back into an ADR to close a ledger
item.** Closing an item means deleting its line from the ledger.

Changing our minds means writing a **new** ADR that supersedes the old one, never editing
it. The superseding note must say *why the old reasoning was wrong* — that record is the
most valuable thing this workflow produces, and an in-place edit destroys it.

## 2. Enforcement — invariants are executable

`node scripts/lint-docs.mjs` runs from a pre-commit hook and in CI.

A rule enforced by memory is a rule that holds until the first busy afternoon. If a
convention matters, it gets a rule; if it genuinely can't be checked, say so out loud
rather than writing it down and trusting it.

Run `/wrap-up` before finishing a task.

## 3. Quality bar

- **Every relevant piece of logic gets a regression test.** No excuses — and no
  irrelevant, duplicate, or fragile tests either. Tests are codebase: same standards,
  same strict typing.
- **Never use `any`.** Use `unknown` + narrowing, generics, or proper types.
- Industry standards. No hacks, no quick fixes. Find the root cause and fix it for good.
- **Boyscout rule:** leave every touched file better than found. A noticed bug is ours
  even if we didn't introduce it — fix it, or log it in `LEDGER.md` if deferred.

## 4. Verification harness — measure, don't assume

Some changes cannot be asserted in a unit test: rendering, world generation, physics,
timing, anything whose correctness is "does it look and behave right at runtime". The
answer is **not** to skip verification and eyeball it once by hand.

**Any slice whose behaviour a unit test cannot assert ships a verification script.**

`scripts/<slice>-verify.mjs` — drives the real system headlessly, exercises the specific
behaviour the slice claims, and:

- **fails on any console error or page error** — this half is pass/fail and machine-checkable;
- **writes artifacts** (screenshots, dumps, measured numbers) for human review — this half
  needs eyes, and that is fine, as long as the first half still runs unattended;
- **is named in the slice's `## Verification` section**, so the claim and its evidence are
  linked;
- **is wired into `package.json`**, and its error-check half runs in CI.

That last point is the one that gets skipped. A verify script that is not in
`package.json` runs exactly once, on the day it was written, and is dead thereafter —
it documents that the slice worked once, which is not what a regression check is for.

Probes are the same tool used before the fact: when a design question has a measurable
answer (how many caves per chunk, what the frame cost is), write `scripts/<topic>-probe.mjs`
and put the **measured numbers** in the ADR. Design decisions cite data, not estimates.

## 5. Standing invariants

Repo-specific definition-of-done rules. A slice is not complete until it satisfies every
one that applies. Each cites the ADR that created it; exceptions are listed with the
reason, so nobody "fixes" a deliberate choice.

These live **here, in the repo** — not in assistant memory. A rule that governs the
codebase must be greppable, diffable, reviewable, and survive a change of machine.

| # | Invariant | Source |
|---|---|---|
| 1 | _(none yet — add as they are decided)_ | |

When an ADR's consequences create a rule that all *future* work must follow, add the row
in the same commit as the ADR.

## 6. Commits

- **No `Co-Authored-By` or generated-by trailers.** Plain conventional messages.
- Ship the doc and the code in the same commit.

## 7. The operator may be wrong

The operator ({{OPERATOR}}) is not infallible. If a proposal or assumption is incorrect,
say so directly, with data or a clear explanation. Don't defer to a wrong idea to be
agreeable — the operator is glad to change their mind when proven wrong, and would rather
be corrected early than build on a bad premise.

This cuts both ways: when the evidence contradicts *our own* stated convention, report
that too.

Correction is not only for factual errors. When the operator asks for something that
violates an ADR without a justifiable reason, or proposes a subpar fix, feature, or
plan, push back the same way — with evidence and a concrete better option, argued from
this repo's best-practices and ADR-conscious perspective. An operator can lack context a
decision record already settled, so citing it *is* the correction. And if a violation
turns out to be justified, that justification is a new (or superseding) ADR — never a
silent exception.

## 8. Token economy

- The main model plans, reviews, corrects, and writes tests. Delegate rock-mining
  (mechanical refactors, boilerplate, broad surveys) to cheaper subagents — **Haiku 4.5
  for mechanical work, Sonnet 5 for work needing judgement** — instructed to return
  minimal, structured output so the main context stays clean.
- When context is deep and the task context is clearly switching, **tell the operator
  it's a good moment to `/compact`** — they forget, and it causes context rot.
