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

A citation is bare (`ADR-NNNN`) only when it means *this* repo, and qualified
(`<repo>:ADR-NNNN`) otherwise (ADR-0009). Anything vendored out — `templates/`,
`.claude/commands/` — must qualify even our own decisions, or the copy names the target
repo's decision of that number; write `stele:ADR-NNNN` there, which the linter still
resolves here (ADR-0020). An illustrative number in vendored text is a citation to the
linter, so examples use the `NNNN` placeholder.

`node scripts/lint-docs.mjs` checks fifteen rules and runs from a pre-commit hook and CI. The
hook checks the **commit**, not the working tree (ADR-0018), and runs two checks the linter
cannot: the generated index matches the corpus, and immutable bodies only ever gained lines
(`scripts/check-immutable.mjs`, ADR-0019).
`/init-method` installs both into a target repo (ADR-0006) — and refuses to install the
hook while the linter is red, because a hook on a red corpus blocks every commit.
`--update` cannot refuse (the old linter is already gone) so it lints and reports instead.

**A new rule reads only inside `READ_SCOPE`.** The hook copies exactly that list out of the
staged tree, so a rule reading anywhere else finds nothing and reports green — which is how
R14/R15 shipped dead in the hook for a release. `test/read-set.test.mjs` holds the linter's
list and the hook's equal; extend both together or the suite fails (ADR-0021).

A rule enforced by memory is a rule that holds until the first busy afternoon. Five
supersession defects sat undetected in boxel for weeks because nothing ran. If a
convention matters, it gets a rule; if it can't be checked, say so out loud rather than
writing it down and trusting it.

Run `/wrap-up` before finishing a task. It runs the linter and asks the three questions
that actually get forgotten: did this change a user-facing API, record a decision, or
defer something?

Publishing follows [`docs/releasing.md`](docs/releasing.md) — the order there is a data
dependency, not a preference, and `CHANGELOG.md` is generated from tags and never hand-edited
(ADR-0026). None of it is installed into consumer repos: release engineering stops at this
repo, and the reasoning that keeps `SECURITY.md` and friends out of a scaffold is in that ADR.

The coverage layer has two instruments, and both state their limits. `npm run mutants`
(ADR-0022) applies a curated list of behaviour changes to the linter's pure predicates and
requires each to break a test — a survivor is correct behaviour nothing is watching, fixed
by writing the missing test, never by deleting the mutant. It is blind to a missing input
and to a wrong rule, so a green run is not a correctness claim; the adversarial pass below
is what covers that.

What a linter cannot check, a **fresh reader** can. Where a change touches a §4 invariant,
a public API, a data format, or a risky Definition of Done scenario, `/wrap-up` runs an
adversarial pass: a subagent given the diff and the ADR corpus but **not** the author's
reasoning, whose findings must state a concrete failure and get reproduced before they are
acted on (ADR-0017). Correctly *rejected* findings get written at the code site (ADR-0012)
— otherwise every future fresh reader raises them again.

## 3. Quality bar — [`docs/quality-bar.md`](docs/quality-bar.md)

The quality bar, the testing standard, commit hygiene, the operator-may-be-wrong framing,
delegation and language live there and apply here without being restated (ADR-0024). It is
the file this repo ships, so this repo is bound by it like any consumer — and until
2026-07-30 four of its sections were restated here in drifted, lossy form, which is the
ADR-0005 failure running inside the repo that recorded it. Cite it; do not copy from it.

Three things it does not cover, because they are specific to this repo:

- **New linter rules cite the incident that motivated them.** A rule with no incident behind
  it is a preference, and preferences do not earn a place in a pre-commit hook.
- **A justified rule-violation is recorded as a new or superseding ADR** — never a silent
  exception. The bar says a justification gets written down; here, that is where it goes.
- **A correction is argued from this repo's ADR corpus.** Citing the decision that already
  settled a question *is* the correction; the operator can lack context a record holds. This
  repo exists because a survey found a three-week-old rule that had never once been followed.
