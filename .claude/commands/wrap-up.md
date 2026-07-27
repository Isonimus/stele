---
description: End-of-task gate — run the checks and ask the four questions that get forgotten
---

Run before finishing a task. The point is to make mechanical what memory keeps dropping:
the linter catches structural drift, and four questions catch the follow-ups that never
get recorded until they have gone stale (ADR-0003).

1. Run the linter and the index check:
   - `npm run lint` — must be green (rule 9 warnings are acceptable on a legacy corpus).
   - `npm run index` — regenerate `adr/INDEX.md` and stage it if it changed. A stale
     generated index is drift by another name.
   - `npm test` — the test suite must pass; docs changes must not disturb code.

2. **Adversarial pass** (ADR-0017) — run it if this change touched a `CLAUDE.md` §4
   standing invariant, an exported/public API, a data format or anything persisted, or a
   Definition of Done scenario the slice flagged as risky. Otherwise skip it and say so.

   - Spawn one subagent (two only if the second gets a *different* brief: **correctness** —
     edge cases, error paths, boundaries, ordering and partial-failure hazards; **cost** —
     complexity class, allocation, IO in loops). Sonnet 5 for correctness; announce the
     delegation before it starts (`~/.claude/CLAUDE.md` §6).
   - Brief it **blind to intent, aware of law**: give it the diff, this repo's `CLAUDE.md`,
     and `adr/INDEX.md`. Do *not* give it the conversation, your rationale, or the slice's
     claims about itself. A reviewer handed the reasoning returns the reasoning; one handed
     nothing flags every deliberate deviation as a bug.
   - Require a concrete failure scenario per finding — input or state → wrong output,
     crash, or a counted cost. Reject "consider validating this" at intake, uninvestigated.
   - **Reproduce before acting.** An accepted correctness finding becomes a test that fails
     before the fix and passes after; one you cannot reproduce is rejected. The reviewer had
     no intent context and is confidently wrong a predictable share of the time.
   - Route what survives through the four questions below — fix, `LEDGER.md`, `/adr`, or
     `/slice`. **And record the rejections**: a finding you correctly dismissed will be
     raised again by every future fresh reader until the reason is written at the site
     (ADR-0012) or in the §4 table. That is what makes the next pass cheaper than this one.

3. Then answer these four out loud, and act on each:
   - **Did this change a user- or dev-facing API or feature?** If so, update `README.md`
     (and any docs) in the same change — it is a live document.
   - **Did this make a decision later work must obey?** If so, write it with `/adr` now,
     while the reasoning is fresh. An unrecorded decision is re-litigated later from
     nobody's memory.
   - **Did this defer something** — a follow-up, a known-but-unfixed bug, a TODO? If so,
     add one line to `LEDGER.md` citing the relevant ADR. The ledger is the only place
     deferrals live; a TODO in code or a note in your head is not tracked.
   - **Did this write code a later operator would plausibly try to "fix"?** — a deliberate
     deviation, a non-obvious constraint, a hard-won exception. If so, cite the governing
     ADR at that site in a comment (ADR-0012), so the choice announces it is on purpose
     where the edit happens, not only in the §4 table nobody thinks to open.

4. Report what you found and did for each of the four, so the operator can confirm
   nothing was silently skipped.
