---
id: 0004
title: Verification harness and in-repo standing invariants
type: architecture
status: accepted
date: 2026-07-20
supersedes: []
superseded_by: []
---

# ADR 0004 — Verification harness and in-repo standing invariants

## Context

ADRs 0001–0003 addressed how documents drift. A review of what the boxel and gamatar
`CLAUDE.md` files actually capture found a different and larger failure: the two most
valuable practices in the workflow are recorded in neither.

**Finding 1 — the harness is undocumented.** boxel has no `CLAUDE.md` at all. It does
have twelve headless verification scripts (`creeper-verify.mjs`, `trap-verify.mjs`,
`redstone-verify.mjs`, `worldgen-probe.mts`, …, 1,522 lines) that drive the real game in
Chromium, fail on console errors, and save screenshots for review. They are the answer to
"how do you regression-test a voxel renderer", and they work.

They appear in no conventions file, no ADR-level rule, and no memory note. The practice
exists only as a habit visible in `ls scripts/`. gamatar — same stack, same
untestable-render problem, started four days after boxel's consolidation — has zero verify
scripts and no `scripts/` directory. The single most valuable practice in the workflow
propagated **not at all**, which is a sharper case of the same failure ADR-0001 addresses:
a rule that lives nowhere cannot be followed.

**Finding 2 — the harness decays after one run.** Eleven of the twelve scripts are absent
from `package.json`; only `smoke` is wired. Each verified its slice on the day it was
written and has not run since. Screenshot review does need human eyes, and that part
cannot be automated away — but every script also fails on console and page errors, and
that half is pure pass/fail. It is machine-checkable and currently runs never.

**Finding 3 — engineering rules live outside version control.** Two boxel rules are real
definition-of-done constraints:

- `mob-egg-rule` — every new mob ships its spawn egg and spawner-table row in the same
  commit (standing rule since ADR 0121).
- `block-detail-default` — every block gets procedural speckles; custom meshers must call
  `addSpeckles` explicitly. Carries a hard-won exception: GLASS deliberately has none,
  tried live and vetoed ("read as grime on a window").

Both live in `~/.claude/projects/-home-iker-local-repo-boxel/memory/`. They are not in the
repo: not greppable, not in any diff, not reviewable at commit, and lost on a change of
machine. This is exactly the objection this project raised against graph memory stores —
writes that are invisible and unreviewable — and we were already doing it.

The `block-detail-default` note also records that the cake (ADR 0101) shipped bare and the
operator caught it by eye. An in-repo checklist row is what would have caught it earlier.

## Decision

Two sections are added to the template `CLAUDE.md`.

**Verification harness.** Any slice whose behaviour a unit test cannot assert ships a
`scripts/<slice>-verify.mjs` that drives the real system headlessly. It must fail on
console/page errors, write artifacts for human review, be named in the slice's
`## Verification` section, and be **wired into `package.json`** with its error-check half
running in CI. Probes are the same tool applied before the fact: a design question with a
measurable answer gets a probe, and the ADR cites the measured numbers rather than an
estimate.

**Standing invariants.** A numbered table in `CLAUDE.md` §5 holding repo-specific
definition-of-done rules, each citing the ADR that created it, with exceptions listed
alongside their reason. When an ADR's consequences bind all future work, the row lands in
the same commit as the ADR.

Assistant memory keeps who the operator is and how they prefer to work. It does not keep
rules about how a codebase must behave.

## Consequences

- The wiring requirement is the load-bearing half. Without it a verify script documents
  that a slice worked once, which is not what a regression check is for.
- Invariants are visible in review. A slice that violates one is now visible in a diff
  against a checklist rather than dependent on the operator noticing at runtime.
- The exception column matters as much as the rule. The GLASS veto is the kind of
  deliberate choice a later "consistency fix" silently undoes.
- Standing invariants are not linted. They are prose claims about a specific codebase and
  cannot be machine-checked from here; per §2 that limit is stated rather than papered
  over. `/wrap-up` surfaces the table for a read-through instead.
- Migrating boxel's memory files into its `CLAUDE.md` is recorded in `LEDGER.md` and lands
  with the Phase 3 migration.
