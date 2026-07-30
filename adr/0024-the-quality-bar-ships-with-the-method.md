---
id: '0024'
title: "The quality bar ships with the method, vendored into the repo, and tests derive from the spec rather than from the code"
type: architecture
status: amended
date: 2026-07-30
supersedes: []
superseded_by: []
---

# ADR-0024 — The quality bar ships with the method

## Context

ADR-0011 made every slice carry a `## Definition of Done` in Given/When/Then, written
before the code. R13 checks the triad exists. Nothing checks — and nothing can check —
that the scenarios are *met by work anyone would accept*: that the code has no `any`, that
errors fail loud rather than being swallowed, that the regression test would have failed
before the fix. A Definition of Done is a claim about quality, and this kit shipped the
claim without shipping the standard the claim is measured against.

That standard existed the whole time. `global/CLAUDE.md` in this repo carries it — quality
bar, design-first, commit hygiene, delegation, correction, language — and ADR-0005 routed
it to `~/.claude/CLAUDE.md`, the operator's machine-level file. Two things followed from
that routing, and both are now known to be wrong for this artifact:

**It reaches no consumer.** ADR-0016 withdrew the install-time global link and held that
vendoring the method into repo X must not reach outside repo X. That holding is correct and
is not disturbed here. Its effect, though, is that a repo which runs `/init-method` gets the
document taxonomy, the linter, the hook and the slash commands — and gets *nothing* of the
standard those commands assume. `templates/CLAUDE.md` states outright that general practices
"live in `~/.claude/CLAUDE.md` and apply here without being restated", which for anyone who
is not this repo's author is a citation to a file that does not exist.

**ADR-0005 rejected the alternative on grounds that no longer hold.** It rejected "put
general practices in every repo's `CLAUDE.md`" as "dual-write across ~100 repos, with no
sync mechanism and no reconciliation point". That reasoning was exactly right in 2026-07-20.
ADR-0023 then built the missing mechanism for a different reason: `.claude/.stele-vendored.json`
records what the toolkit last wrote, which is the third reference point that separates a
stale copy from a deliberate adaptation, and `--update` reconciles on it. The rejection was
never about the desirability of reaching every repo; it was about the absence of a
reconciliation point. The reconciliation point now exists.

### The missing rule, and what it is worth

The operator raised a gap the bar did not cover: a test must assert what the code **should**
do, not what it **does**. This is ISTQB's *test basis* — a test derives from requirements,
specification or acceptance criteria, never from the item under test. A test written by
reading the implementation and recording its current output cannot fail when that output is
wrong. It detects change. It pins a bug in place and defends it against the fix.

Measured before deciding, 2026-07-29/30. Two repos, 497 tests read against their primary
sources, identical rubric:

| Stratum | Tests | Implementation-derived | Ambiguous | No basis available |
|---|---|---|---|---|
| stele (all) | 115 | 0 | 2 | 0 |
| boxel, before method adoption | 142 | 2 (1.4%) | 1 | 4 |
| boxel, after method adoption | 240 | 2 (0.8%) | 0 | 5 |

Three findings, and the second is the one that shapes the decision.

**Adoption of this method had no measurable effect.** 1.4% against 0.8% is two instances
against two. This rule is therefore adopted as *unproven*, not as validated — the honest
claim is that the practice is sound in principle and that this corpus cannot tell whether it
works.

**The instrument found real bugs, not hygiene violations.** Of the four implementation-derived
tests, two were live production defects, reproduced against primary sources before being
reported (ADR-0017) and logged in that repo's ledger. In `anvil.ts`, MC repairs
`getMaxDamage() / 4` per unit — Java integer division, which truncates — against our
`Math.ceil`, so a 250-durability tool restores 63 where MC restores 62. In `blocks.ts`, lava
is declared `emission: 13` where MC's `setLightLevel(1.0F)` resolves to 15. In both cases the
test asserted our number, so the suite passed the bug and would have *failed the fix*. The
lava defect had additionally been written into an ADR, so code, test and decision record all
agreed with each other and none with the source. This is a defect-detection instrument that
happens to look like a style rule.

**Citing the test basis is not the same as consulting it.** The anvil test's own comment cites
`ContainerRepair` and then states `perUnit = ceil(250/4) = 63` — confidently, and wrongly.
Before this measurement the intended enforceable core was "a test names its test basis at the
site"; that test satisfies it and is still wrong. Citation is necessary and demonstrably not
sufficient.

**Nine of 382 tests had no basis to derive from.** boxel's procedural cloud layer has no MC
analogue and its save format is not NBT. A rule with no clause for "no specification exists"
would make those tests violations, which would train people to write a fictitious citation.

## Decision

**1. The quality bar is a method artifact and ships with the method.** It is vendored into
the target repo as `docs/quality-bar.md` and cited from that repo's `CLAUDE.md`. It is a
**live doc** under ADR-0010 — it describes how work is done now, is updated in the same
change as the practice it describes, and is cited from `CLAUDE.md` so it is never orphaned.
Placing it under `docs/` also puts it inside R14's prose scope, so citations that rot inside
it fail the build (ADR-0020).

**2. Nothing outside the target repo is written.** ADR-0016's holding stands untouched and is
the reason this is a vendored file rather than a link, a copy into `$HOME`, or an install-time
edit of the operator's own conventions. An operator who keeps a machine-level `~/.claude/CLAUDE.md`
continues to do so as a personal choice; the repo's copy is self-contained and does not
assume it.

**3. It is vendored under the command rules, not the machinery rules (ADR-0023).** A repo
may adapt its own bar — a Python repo has no use for a rule about `any` — and an `--update`
keeps that adaptation and reports it, while overwriting a copy the repo never touched. This
is the mechanism whose absence was ADR-0005's stated ground for rejecting per-repo general
practices. That ground is answered rather than overruled: the alternative was rejected for
being unreconcilable, and it is now reconcilable.

**4. What ships and what stays personal.** The bar ships impersonally: quality standards,
design-first, commit hygiene, token economy, the operator-may-be-wrong framing, and language.
What does not ship is the operator's name, the second-person framing, and per-operator facts
such as git identity — those remain where ADR-0005 put them, and git identity remains its
canonical example of a legitimate memory entry.

**5. Tests derive from the specification, never from the implementation.** The bar carries
this rule:

> Tests assert intended behaviour, not observed behaviour. A test derives from the spec —
> the slice's `## Definition of Done`, the API contract, the reference implementation, the
> issue — never from reading the code and recording what it currently returns. A test written
> from the code cannot fail when the code is wrong: it detects change, and it will pin a bug
> in place and defend it against the fix. Where there is no prior behaviour to fail against,
> write the expected value down **before** running it, and treat a first-run pass as
> unverified rather than as proof. Where no specification exists, say so at the test site and
> name what the expectation is derived from instead — an invented citation is worse than an
> admitted gap. When the spec is ambiguous, settle the spec; never let the implementation cast
> the deciding vote.

**6. This rule is `review-only`, and that is stated at every surface.** It is not
machine-checkable by this kit and will not be presented as if it were. `lint-docs.mjs` reads
documents; it has no AST, no language awareness, and R14's scope is prose. Even a
language-aware checker would only reach the weaker property that a test does not import the
constant it asserts — which the anvil finding shows is not the property that matters, since
that test imported nothing and derived the wrong number by hand. `/wrap-up`'s adversarial
pass (ADR-0017) is the enforcement, because the question "was this expectation derived from
the source?" is answerable only by opening the source.

**7. `npm run mutants` cannot detect this class of defect, and says so.** A tautological test
kills mutants perfectly well — mutate the constant and the test that asserts the constant
fails. ADR-0022 already records that mutation checking is blind to a missing input and to a
wrong specification; a test derived from the implementation is the *wrong specification* case
in its purest form, and a green mutation run on a suite full of them is exactly the seductive
number that ADR warned about.

## Consequences

- `templates/CLAUDE.md` stops citing `~/.claude/CLAUDE.md` as the home of general practice
  and cites `docs/quality-bar.md` instead. The paragraph warning that restating a global rule
  creates a second copy with no sync path stays true and still applies to *restating* — the
  vendored file is a single copy with a reconciler, which is a different thing.
- **This repo's own `CLAUDE.md` was the failure it documents.** It restates four sections of
  `global/CLAUDE.md` in drifted, lossy form — its token-economy section carries two bullets
  against the global file's three, and its commit section compresses four rules to two. The
  ADR-0005 dual-write failure had been running inside the repo that recorded it, undetected,
  because nothing checks prose against prose. Those sections are replaced by a citation to
  the shipped file in the same commit as this decision.
- **`global/CLAUDE.md` in this repo now duplicates most of the shipped bar, and is left
  alone deliberately.** It is the operator's personal machine-level file, it governs ~100
  repos that never installed this kit, and gutting it would silently drop the bar from all
  of them — a change to somebody's machine, which is precisely what ADR-0016 says this
  toolkit does not make on its own initiative. So the duplication is real, it is named here
  rather than hidden, and reconciling it is the operator's call, logged in `LEDGER.md`. The
  honest reading is that the two files answer different questions: the shipped bar is the
  method's standard, the personal file is one person's, and they happen to agree today.
- `classifyCommand` is renamed `classifyVendored`, because it no longer classifies only
  commands. ADR-0023 §"Consequences" names the old symbol; that record is immutable and
  stays as written — an ADR is a historical claim about a decision, not a live index of
  identifiers.
- The vendoring record's JSON key is still `commands` despite now holding a doc. Renaming it
  means bumping `PROVENANCE_VERSION`, and an unrecognised version is deliberately read as
  *no record*, so the rename would reclassify every command in every installed repo as
  `unknown` on the next run. A comment at the constant carries the discrepancy instead.
- The bar is graded by the vocabulary of `templates/CLAUDE.md` §4 — `verified_by: <script>`,
  `pending (LEDGER)`, `review-only` — so a reader can tell an enforced rule from an
  aspiration without testing which is which. Most of the bar is `review-only`. Saying so is
  the point; a standard that overstates its own enforcement is the failure ADR-0003 exists
  to prevent, committed one level up.
- The two boxel defects are logged in that repo's ledger rather than fixed here. Each needs
  the constant **and** the test's expected value re-derived from the vendored Java; changing
  the constant alone leaves the test re-asserting the old number and the loop re-forms.
- Adoption is unproven and is recorded as such. If a later audit of a repo that had the bar
  from the first commit shows a materially lower rate, that is the evidence this decision
  lacks, and it belongs in a new ADR rather than an edit to this one.

## Amendment — 2026-07-31: the import-the-constant subset is worth checking after all

Decision 6 dismissed the one machine-checkable part of this rule in a subordinate clause:
"Even a language-aware checker would only reach the weaker property that a test does not
import the constant it asserts — **which the anvil finding shows is not the property that
matters**, since that test imported nothing and derived the wrong number by hand."

The first half is right. The bolded conclusion does not follow from it, and a wider
measurement says so.

**The measurement.** boxel's suite was swept on 2026-07-30 — ~765 of 2124 cases across ~54
files, against the vendored Java, by parallel review with each finding reproduced before
being logged. It produced three new production bugs, and a distribution the 382-case sample
behind the table above was too small to show: **the single most repeated defect in the suite
is a test importing the very constant it asserts.** Six sites, verified by hand:

| Site | Form |
|---|---|
| `test/effects.test.ts:30` | `toBe(Math.floor(7 / POISON_TICK_SECONDS))` |
| `test/effects.test.ts:50` | `toBeCloseTo(30 * HUNGER_EXHAUSTION_RATE, 3)` |
| `test/physics.test.ts:34` | `toBeCloseTo(-GRAVITY / 60, 5)` |
| `test/physics.test.ts:42` | `toBe(-TERMINAL_VELOCITY)` |
| `test/signs.test.ts:141` | `toHaveLength(SIGN_LINE_LENGTH)` |
| `test/temptation.test.ts:44` | `toBeCloseTo(TEMPT_SPEED, 5)` |

Five import the constant from **the module under test**. The sixth imports it from a
collaborator — `TEMPT_SPEED` lives in `senses.ts`, the subject is `cow.ts` — so the
assertion is still `K === K` while the import names a different file.

**The anvil finding and these six are different failures, and Decision 6 collapsed them.**
The anvil test proves a checker of this kind is not *sufficient*: an author can read the
source, misread it, and hand-write a wrong literal that no import rule sees. That is a claim
about coverage. Decision 6 promoted it to a claim about worth — that the property "is not the
property that matters" — and a property holding at six sites in one suite plainly matters. A
rule need not catch every instance of a defect to be worth running; the linter this repo
ships catches none of the interesting prose defects and is still the reason five supersession
errors got found. The error was treating "insufficient" as "not worth automating", which is
the same reasoning that would delete a smoke detector for missing a flood.

**What the rule must be, and what it must not be.** Scoped to *scalar constants imported
from the module under test and used as an expected value*, it catches five of the six
directly. Widened to "any value imported from `src/` used as an expected value" it catches
the sixth too — and fires on **594 legitimate assertions** in that same suite, where
`toBe(ItemId.Apple)` and `toBe(BlockId.Stone)` are exactly the right way to assert an
enumerated result. That count is why the rule is scoped narrowly and why the collaborator
variant stays review-only: the broad form is unshippable, not merely noisy.

**This kit still does not ship the check.** `lint-docs.mjs` has no AST and gains none here;
the check belongs to the consuming repo's own language tooling, as an ESLint rule in a
TypeScript repo. Recording it as a `review-only` rule with a named mechanical subset is the
change — the bar now says which part a repo can automate, instead of implying none of it can.
boxel has no ESLint installed at all, so there the work is a toolchain addition rather than a
rule addition, and it is logged in that repo's ledger as such.

**The author committed the failure this ADR names, while writing this ADR's evidence up.**
The eight sites first logged in boxel's ledger were taken from reviewer reports without
opening all eight. Two of them (`hunger.test.ts:114`, `:124`) assert hand-written literals
against MC's food table and are not instances of this defect at all; one line number was
wrong by two; the total was reported as seven while eight were listed. Every error was found
by reading the six real files, which took minutes. Decision 5's "citing the test basis is not
the same as consulting it" therefore has a second instance, and its subject is this document:
an aggregated report of other agents' findings is a writeup, and the rule against trusting a
writeup does not exempt one's own.
