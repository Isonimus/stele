---
description: End-of-task gate — run the checks and ask the three questions that get forgotten
---

Run before finishing a task. The point is to make mechanical what memory keeps dropping:
the linter catches structural drift, and three questions catch the follow-ups that never
get recorded until they have gone stale (ADR-0003).

1. Run the linter and the index check:
   - `npm run lint` — must be green (rule 9 warnings are acceptable on a legacy corpus).
   - `npm run index` — regenerate `adr/INDEX.md` and stage it if it changed. A stale
     generated index is drift by another name.
   - `npm test` — the test suite must pass; docs changes must not disturb code.

2. Then answer these three out loud, and act on each:
   - **Did this change a user- or dev-facing API or feature?** If so, update `README.md`
     (and any docs) in the same change — it is a live document.
   - **Did this make a decision later work must obey?** If so, write it with `/adr` now,
     while the reasoning is fresh. An unrecorded decision is re-litigated later from
     nobody's memory.
   - **Did this defer something** — a follow-up, a known-but-unfixed bug, a TODO? If so,
     add one line to `LEDGER.md` citing the relevant ADR. The ledger is the only place
     deferrals live; a TODO in code or a note in your head is not tracked.

3. Report what you found and did for each of the three, so the operator can confirm
   nothing was silently skipped.
