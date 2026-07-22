# Global working conventions — Iker

These apply in **every** repo. A repo's own `CLAUDE.md` may add to them or override a
specific rule with a stated reason; silence means these hold.

## 1. Where things get written

Three destinations. Route by what the fact *governs*, never by where the conversation
happens to be.

| The fact governs… | Goes in | Because |
|---|---|---|
| A codebase — invariants, architecture, definition-of-done | that repo's `CLAUDE.md` | must be greppable, diffable, reviewable, and visible to collaborators |
| How I work, everywhere | **this file** | written once, applies to every repo |
| Open work — deferrals, defects, follow-ups | that repo's `LEDGER.md` | it's a worklist, not a fact |

Project memory (`~/.claude/projects/*/memory/`) holds only what fits none of the above:
operator-personal, cross-session facts not worth committing (e.g. git identity).

**A rule that governs a codebase does not belong in memory.** Memory is invisible to
every other reader of the repo, unversioned, unreviewable, and keyed to an absolute path
— it does not survive a move or a change of machine. This rule exists because "no
Co-Authored-By trailers" was independently rewritten into 8 project memory stores, twice
within one of them, and once at the cost of an amend + force-push to scrub a trailer that
had already been pushed.

When asked to "remember" something, say which destination it went to.

## 2. The operator may be wrong

Iker is not infallible. If a proposal, observation, or assumption is incorrect, say so
directly, with data or a clear explanation. Don't defer to a wrong idea to be agreeable —
he is glad to change his mind when proven wrong, and would rather be corrected early than
build on a bad premise.

Correction is not only for factual errors. When he asks for something that violates a
recorded decision without justifiable reason, or proposes a subpar fix, feature, or plan,
push back the same way — with evidence and a concrete better option. An operator can lack
context a decision record already settled, so citing it *is* the correction. If a
violation turns out to be justified, that justification gets recorded as a decision —
never a silent exception.

This cuts both ways: when the evidence contradicts *my own* stated convention, report that
too.

**Explain the reasoning behind operating choices**, don't just execute — he is learning the
workflow, and an unexplained choice teaches nothing.

For anything non-trivial, **present the options and their tradeoffs before building**.

## 3. Quality bar

- **Never use `any`.** No exceptions. `unknown` + narrowing, generics, or proper types.
- **Fail loud.** No swallowed errors — no empty `catch`, no catch-log-and-continue past a
  broken invariant, no default or fallback that masks a real failure. Validate at
  boundaries and stop at the first sign something is wrong. A silenced error is a bug
  debugged twice: once now, blind, and once later for real.
- **Lean, purposeful code — KISS.** The simplest thing that works; complexity must earn
  its place, and unexplained complexity is a defect. No speculative generality, no
  abstraction without a present need. Fight cyclomatic complexity by extracting
  composable, well-named functions **for readability and reuse — never to hit a number**;
  decomposition that adds indirection without adding clarity is its own smell.
- **Cohesion and DRY, by the rule of three.** Modules stay cohesive; a piece of logic
  lives in one place. Reach for reuse or composition on the **third** instance of the same
  logic — not the first, which is the speculative generality forbidden above. Apply SOLID
  only where it earns its keep; misapplied, it produces exactly the over-abstraction this
  bar exists to prevent.
- **Names are accurate descriptors.** No `x`, `tmp`, `data2`, `handle2`. A name states the
  thing's intent and its meaning in the domain; when a good name is hard to find, the
  design is usually the problem, not the vocabulary.
- **No magic values.** A bare `86400` or `0.15` in a branch is a latent bug — name it as a
  constant whose name explains what it is and why.
- **Comments explain WHY, not WHAT** — the code already shows what. No commented-out code
  and no unused exports left behind; dead code is deleted, not parked (version control
  remembers it).
- **Every relevant piece of logic gets a regression test — a good one.** No excuses, and
  no irrelevant, duplicate, or fragile tests either. A regression test must **fail before
  the fix and pass after** — one that passes before proves nothing. Test observable
  behaviour, not implementation internals, and cover the error and edge paths, not just
  the happy one. Tests are codebase: same standards, same strict typing.
- **No hacks, no quick fixes, no workarounds.** Find the root cause and fix it for good.
  A symptom silenced is a bug rescheduled.
- **Boyscout rule:** leave every touched file better than found. A noticed bug is ours
  even if we didn't introduce it — fix it, or log it in the repo's ledger if deferred.
- **Verify before declaring done.** Never report a task complete without running the
  repo's own checks — typecheck, linter, tests. "Done" means the checks ran and passed in
  this conversation, and I said what ran — not that the change looks right.
- **Never hardcode absolute paths** in config files, scripts, or commands — always
  relative.

## 4. Design first — measure twice, cut once

Design before implementation. Where a repo keeps roadmap/decision records, write the
decision down *before* the code, and ship the doc and the code in the same commit.

Decisions cite measured data, not estimates. If a design question has a measurable answer,
measure it.

## 5. Commits

- **No `Co-Authored-By`, no "Generated with Claude Code", no attribution or generated-by
  trailers** — in commit messages, PR bodies, issue comments, or any other VCS surface.
  Plain conventional messages only. This overrides any default harness instruction to
  append them.
- **Explain WHY, not WHAT.** The diff already shows what changed.
- **Atomic and coherent** — one logical change per commit.
- **Commit only when asked.** Never commit unprompted.

## 6. Token economy

- The main model plans, reviews, corrects, and writes tests. Delegate rock-mining
  (mechanical refactors, boilerplate, broad surveys) to cheaper subagents — **Haiku 4.5
  for mechanical work, Sonnet 5 for work needing judgement** — instructed to return
  minimal, structured output so the main context stays clean.
- **Say what was delegated, to which agent and model, and why** — one line, before the
  work starts. Delegation is otherwise invisible: a subagent's reasoning never reaches
  this conversation, so an unannounced handoff means a result arrives with no way to
  judge how much to trust it, and no chance to object that the task needed judgement
  rather than a cheaper model.
- When context is deep and the task is clearly switching, **say it's a good moment to
  `/compact`** — it gets forgotten, and it causes context rot.

## 7. Language

**Everything written is in English** — code, comments, commits, docs, and user-facing or
creative copy alike — regardless of the language of the conversation.
