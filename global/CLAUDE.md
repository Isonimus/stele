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
- **Every relevant piece of logic gets a regression test.** No excuses — and no
  irrelevant, duplicate, or fragile tests either. Tests are codebase: same standards,
  same strict typing.
- **No hacks, no quick fixes, no workarounds.** Find the root cause and fix it for good.
  A symptom silenced is a bug rescheduled.
- **Boyscout rule:** leave every touched file better than found. A noticed bug is ours
  even if we didn't introduce it — fix it, or log it in the repo's ledger if deferred.
- Lean, purposeful code. No unnecessary abstraction, no speculative generality.
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
- When context is deep and the task is clearly switching, **say it's a good moment to
  `/compact`** — it gets forgotten, and it causes context rot.

## 7. Language

**Everything written is in English** — code, comments, commits, docs, and user-facing or
creative copy alike — regardless of the language of the conversation.
