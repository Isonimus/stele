# claude-method

A zero-dependency workflow that keeps a codebase's **decisions, work, and definition of
done** honest — enforced by a git hook and CI, not by anyone remembering to.

It is meant to be **vendored into any git repo**: one command drops in a decision-record
tree, a worklist, a linter, and a pre-commit hook, and from then on the repo refuses commits
that let its own records rot.

> This README is a **live doc** — the *how-to* and the vision. The *why* behind every rule
> lives in [`adr/`](adr/), and each section below links to the decision that governs it.
> Where the two ever disagree, the ADR wins; tell us so we can fix the README.

---

## The problem

Conventions kept in a model's memory, a wiki, or someone's head hold until the first busy
afternoon. They are invisible in review, unversioned, and gone on a change of machine. Three
failures recur:

- **Decisions drift.** A choice recorded as prose gets quietly edited until the record no
  longer says what was actually decided, and the reasoning that made it right is lost.
- **Work-in-progress lies.** A doc written in the present tense ("the system does X") is
  true the day it is written and slowly false forever after.
- **"Done" is assumed, not defined.** A feature with three required outputs and no written
  acceptance criteria ships with two of them, because the intent was never in a form that
  made the omission visible.

claude-method's answer is a single principle: **if a convention matters, it is executable;
if it genuinely cannot be checked, that limit is stated out loud rather than trusted.**

---

## The mental model — four kinds of document

Every document is exactly one kind. There is no fifth. ([ADR-0010](adr/0010-live-docs-are-the-fourth-kind.md), superseding [ADR-0001](adr/0001-immutable-or-generated.md))

| Kind | Files | Rule |
|---|---|---|
| **Immutable** | `adr/*.md`, `slices/*.md` | Written once. Body prose is never edited — only status/supersession fields change. |
| **Generated** | `adr/INDEX.md` | Built from frontmatter by script. Never hand-edited. |
| **Mutable** | `LEDGER.md` | Exactly one per repo. The only file maintained by hand. |
| **Live** | `README.md`, `docs/*` | Describes how something behaves *now*; updated in the same change as the code it describes. |

- An **ADR** records a decision later work must obey: *"on date X we chose Y because Z"* — a
  historical claim, true forever.
- A **slice** is one feature work-unit, written *before* implementation and **frozen to past
  tense at merge** ("this is what shipped") — which converts a going-stale claim into a
  never-stale one.

**Single writer, one direction.** An ADR records a deferral once, as a fact. `LEDGER.md`
cites the ADR. You never reach back into an ADR to close a ledger item — **closing an item
means deleting its line from the ledger.** Changing your mind means a **new** ADR that
supersedes the old one and says *why the old reasoning was wrong* — that record is the most
valuable thing this workflow produces, and an in-place edit destroys it.

---

## Quickstart

Install into a git repo — dry-run first, always ([ADR-0006](adr/0006-init-method-bootstrap.md)):

```
node scripts/init-method.mjs <repo-root>            # dry run: shows what it would do
node scripts/init-method.mjs <repo-root> --apply    # install the kit
node scripts/init-method.mjs <repo-root> --check    # verify an install is intact
node scripts/init-method.mjs <repo-root> --update   # re-sync vendored machinery
```

It installs `CLAUDE.md`, `LEDGER.md`, the linter, the index builder, and a pre-commit hook —
and **refuses to install the hook on a linter-red corpus**, because a hook that blocks every
commit is the tool bricking the repo it was meant to protect. If a hook framework already
owns the pre-commit slot, the doc checks join it rather than fight for the file
([ADR-0008](adr/0008-compose-with-an-existing-hook-framework.md)).

The linter and slash commands are **vendored per repo** and a repo's local edits to the
commands survive re-runs ([ADR-0007](adr/0007-commands-are-vendored-and-adaptable.md)).

---

## Commands

Run in Claude Code as `/<name>`.

| Command | What it does |
|---|---|
| `/adr <title>` | Scaffold a new Architecture Decision Record, frontmatter pre-filled. |
| `/slice <title>` | Scaffold a new slice (one feature work-unit). |
| `/audit` | Full-corpus health check — run every invariant, surface warnings and drift. |
| `/wrap-up` | End-of-task gate — run the checks and ask the three questions that get forgotten. |
| `/remember <fact>` | Route a fact to the destination that governs it (see [Where things live](#where-things-live)). |
| `/init-method` | Install the kit into a git repo. |

Under the hood, the npm scripts are the enforcement surface:

```
npm run lint     # node scripts/lint-docs.mjs .   — the invariant checker
npm run index    # regenerate adr/INDEX.md
npm test         # the regression suite (every rule has a fixture)
```

---

## Scenarios

**Record a decision.** `/adr "Use a hand-rolled frontmatter parser"`. Fill Context /
Decision / Consequences, cite measured numbers where a question has a measurable answer, and
commit. Never edit it afterward.

**A decision changed.** Do *not* edit the old ADR. `/adr` a new one, set `supersedes: [NNNN]`
on it and `superseded_by` on the old, and spend a paragraph on *why the old reasoning was
wrong*. The linter enforces that the supersession is bidirectional and that a superseded ADR
no longer reads as "accepted" (rules R4–R7).

**Start a feature.** `/slice "CSV export"`. Before you write code, fill:
- `## Goal` — what ships and why;
- `## Definition of Done` — the acceptance criteria as **Given / When / Then** scenarios
  ([ADR-0011](adr/0011-slices-carry-a-definition-of-done.md));
- `## Design` — the approach, citing probe numbers not estimates;
- `## Verification` — the unit tests, or a `scripts/<slice>-verify.mjs` for behaviour a unit
  test can't assert.

At merge, freeze `## As built` in past tense, confirming each Definition-of-Done scenario was
met. The linter requires both `## Verification` (R12) and a `## Definition of Done` holding a
real Given/When/Then triad (R13).

**Behaviour a unit test can't assert** (rendering, worldgen, physics, timing). Write
`scripts/<slice>-verify.mjs` that drives the real system headlessly, **fails on any console
error**, and writes artifacts (screenshots, numbers) for human review. Name it in
`## Verification` and **wire it into `package.json`** — an unwired verify script runs once and
is dead thereafter, so the linter fails if any is unwired (R11). ([ADR-0004](adr/0004-verification-harness-and-in-repo-invariants.md))

**Adopt into an existing repo.** `/init-method <repo> --apply`. Migrate the corpus and hand-
fix any red supersession pairs *before* the hook goes on. Legacy documents that predate a
rule warn rather than error, so adoption is never blocked by history.

**A rule you must break, with reason.** Don't take a silent exception. Record the
justification as a new or superseding ADR — in this workflow, a justified violation *is* a
decision, and decisions are immutable records.

---

## Enforcement, in three honest layers

The linter ([`scripts/lint-docs.mjs`](scripts/lint-docs.mjs)) runs from the pre-commit hook
and in CI. Its rules are graded by what can actually be mechanised
([ADR-0003](adr/0003-enforcement-by-hook.md)):

1. **Machine-checked (error — blocks the commit).** Frontmatter shape and completeness
   (R1), id/filename agreement and uniqueness (R2), closed status/type vocabulary (R3), the
   supersession graph (R4–R7), ledger citations resolve (R8), the linter isn't pointed at an
   empty corpus (R10), verify scripts are wired (R11), and slices carry their required
   sections (R12/R13).
2. **Legacy-aware (warning, not error).** Bare prose cross-references (R9) and slice-section
   rules on documents that predate them warn instead of failing, so a repo's history never
   blocks its next commit — while *new* work is held to the full bar.
3. **Coverage — unenforceable, and said so.** Whether a verify script tests something *true*,
   whether a §4 invariant actually holds, whether the acceptance scenarios are *complete* —
   none can be decided by reading one version of a file. These are surfaced by `/wrap-up` for
   a human read-through, never claimed as guaranteed. A linter that pretended to check them
   would be a false green, the exact failure this project exists to prevent.

The dividing line is the whole point: **a rule is enforced, legacy-tolerated, or explicitly
declared uncheckable — never silently trusted.**

---

## Where things live

`/remember` routes a fact to whatever *governs* it, never to wherever the conversation
happened ([ADR-0005](adr/0005-write-routing-and-the-bounds-of-memory.md)):

| The fact governs… | Goes in |
|---|---|
| A codebase — invariants, architecture, definition-of-done | that repo's `CLAUDE.md` |
| How you work, everywhere | global `~/.claude/CLAUDE.md` |
| Open work — deferrals, defects, follow-ups | that repo's `LEDGER.md` |
| Operator-personal, cross-session facts (e.g. git identity) | assistant memory |

A rule that governs a codebase never belongs in assistant memory: memory is invisible to
every other reader of the repo, unversioned, and lost on a change of machine.

---

## Design principles

- **Zero dependencies.** The whole kit is Node's standard library. It drops into any repo
  regardless of package manager, and the frontmatter schema is small enough to parse by hand.
- **Enforce with a hook, remember nothing.** A convention that matters becomes a rule; one
  that can't be checked is stated as such, out loud.
- **Grammar over toolchain.** Given/When/Then is adopted as *writing discipline*, not a test
  framework — the verify scripts are the executable layer.
- **The diff is the audit trail.** Immutable records, generated indexes, and single-writer
  ledgers mean the git log *is* the history — no hand-maintained changelog to drift.

For the reasoning behind any of these, read the ADR it links to. That is what the ADRs are
for.
