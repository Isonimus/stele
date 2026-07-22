---
id: 0004
title: Verification harness and in-repo standing invariants
type: architecture
status: amended
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

## Amendment — 2026-07-22: wiring becomes rule 11; invariants declare enforcement

The Decision above makes two requirements that nothing checks, and the gap is the same one
this ADR exists to close — now visible in the ADR about closing it.

**The wiring requirement was never enforced.** The Decision calls `package.json` wiring
"the load-bearing half," and the Consequences call an unwired verify script one that
"documents that a slice worked once, which is not what a regression check is for." Yet
Finding 2 — eleven of twelve scripts unwired — was true when this ADR was accepted and
stayed true, because no rule looked. A requirement enforced only by the prose that states
it is precisely the failure ADR-0003 exists to fix, recurring in the ADR about the harness.

**Rule 11 closes it.** `lint-docs.mjs` now asserts that every `scripts/*-verify.{mjs,mts}`
is referenced by some `package.json` script. It reads `scripts/` and `package.json`, never
`CLAUDE.md`, so no body prose enters the machine-readable surface (ADR-0002 stands). Probes
are excluded by name: a probe answers a design question once and the ADR cites the number,
so it is not a standing regression and is not required to be wired. This is the first
*harness* rule — R1–R10 are the *document* rules ADR-0003 owns; each ADR owns the rules its
own findings motivate.

**What rule 11 deliberately does not do.** It checks that a verify script is wired, not
that it verifies anything true, and not that every §4 invariant has a script at all.
Whether code actually satisfies "every block ships its icon" cannot be decided by reading
one version of a file — that is the *coverage* question, and it stays where the
Consequences already put it: unlinted, surfaced by `/wrap-up` for human read-through. Rule
11 enforces that the checks we *have* run; it cannot enforce that the checks we *need*
exist. Claiming otherwise would be the false-green rule 10 was added to kill.

**Invariants declare their enforcement.** Between "wired and checked" and "cannot be
checked at all" sits a third state that Finding 3's rules — and boxel's block-completeness
rule, the incident that prompted this amendment — all occupy: recorded, real, but not yet
enforced. A §4 row in that state is indistinguishable from an enforced one, so a reader
takes an aspiration for a guarantee. Each §4 invariant now declares its enforcement in a
new column:

- `verified_by: <script>` — a wired verify script (or lint rule) checks it;
- `pending (LEDGER)` — enforceable, not yet enforced; a ledger item carries the debt;
- `review-only` — enforceable only by human judgement (the GLASS-veto aesthetic call no
  script can make), so `/wrap-up` is the enforcement, by design.

This last part is a **convention, enforced by review, not by the linter**. Linting it would
mean parsing §4 prose, which ADR-0002 keeps off the machine-readable surface and which
three invariants do not yet justify — if a structured invariant manifest ever earns its
place, that is its own ADR. The limit is stated rather than papered over, the discipline §2
already holds this project to. The template's §4 gains the column so the convention has an
exemplar, and §3 records that wiring is now rule-checked.

## Amendment — 2026-07-23: the Verification section becomes rule 12

The Decision requires every slice to name its proof in a `## Verification` section — "A
slice with no `## Verification` section is incomplete," as the `/slice` command puts it. As
with the wiring requirement before rule 11, nothing checked it: a slice could ship with the
section absent and the linter said nothing. The requirement was enforced only by the prose
that stated it — the exact recurrence rule 11's amendment named.

**Rule 12 closes it**, alongside rule 13 from ADR-0011, which adds the sibling
`## Definition of Done` requirement. The two are one piece of work: both assert a required
slice section on `type: slice` documents, so they share a single severity rule and are
checked together. Severity splits on the slice's own `date` — a slice predating the rules
(boxel's ~104, gamatar's) only warns, so a repo does not go red on its legacy corpus the
day it adopts the linter, while a slice dated on or after must comply. A rule that only ever
warned, as the ledger first sketched this one, would gate legacy in but never enforce the
section on new work; the date split does both.

Rule 12 reads a markdown heading in the body, the first body prose the linter inspects. That
does not breach ADR-0002: the machine-readable *schema* stays the frontmatter; a heading's
presence is structure, not schema, and its *contents* are never read. What rule 12 does not
do is what rule 11 did not do — it checks the section exists, not that the proof it names is
real or sufficient. That is the coverage question, and it stays with `/wrap-up`.
