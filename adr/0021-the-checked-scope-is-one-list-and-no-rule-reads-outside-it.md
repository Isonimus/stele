---
id: '0021'
title: "The checked scope is one exported list, and no rule reads outside it"
type: architecture
status: accepted
date: 2026-07-27
supersedes: []
superseded_by: []
---

# ADR-0021 — The checked scope is one list, and no rule reads outside it

## Context

ADR-0018 made the hook check the commit rather than the working tree by materialising the
staged tree with `git archive`, and copied a *subset* of it — the paths the checks read —
because the full tree costs ~1.1ms per tracked file, some 11 seconds on a 10k-file repo.
That is a hook people delete.

The subset creates an obligation, and ADR-0018 wrote it down in a comment: *"a rule that
starts reading a file outside this list must extend it here, or the hook checks a file it
never extracted."* It was also recorded as a standing maintenance obligation in that ADR's
Consequences.

**It was missed by the very next feature.** ADR-0020 added rules 14 and 15, reading
`CLAUDE.md`, `README.md`, `docs/` and `.claude/commands/` — none of which the hook copied.
Both rules therefore ran against paths that did not exist in the extracted tree and found
nothing, in every commit, for the whole release. `npm run lint` and CI still saw them,
which is why the corpus stayed honest and nothing looked wrong.

Reproduced 2026-07-27 in a throwaway repo installed on 0.1.2 and updated: `npm run lint`
reported two errors on the working tree, and the hook passed the identical state as clean.

Two things make this worse than an ordinary miss. It is a check reporting green **because
it never opened the file** — the exact failure mode this project exists to remove, in the
project's own machinery. And the interval between writing the obligation down and breaking
it was one commit, by the author who wrote it, which is all the evidence needed that a
prose obligation is not a mechanism.

A second defect surfaced in the same reproduction. `--apply` refuses to install a hook onto
a red corpus, because a hook that blocks every commit is the tool bricking the repo it
protects. `--update` reaches that same state through the other door — a release that adds
an error-severity rule lands a stricter linter behind a hook that is *already* live — and
it never linted at all.

## Decision

**1. The checked scope is a single exported list.** `lint-docs.mjs` exports `READ_SCOPE`,
composed from the constants the rules already use (`DOC_DIRS`, `LEDGER.md`, the prose files
and directories, `scripts`, `package.json`). The hook's `git archive` pathspec is the same
list, and `test/read-set.test.mjs` parses the hook's shell source and asserts the two are
equal.

They stay two copies, deliberately. The hook is POSIX `sh` that runs before node has been
asked for anything, so it cannot import a JavaScript constant; the duplication is forced.
What is not forced is the duplication being *silent*, and that is what the test removes.

**2. No rule reads outside the scope, and rule 15 is narrowed to match.** Rule 15 checked
that a relative markdown link resolves, against the filesystem — so a `README.md` linking
to `src/index.ts` passed on disk and failed under the hook, where `src/` was never
extracted. It now skips targets outside `READ_SCOPE`.

This is a real narrowing: links into a repo's source tree are no longer checked. It is
preferable to the alternative on offer. A rule whose verdict depends on *where it ran* is
worse than no rule, because it produces a failure the author cannot reproduce and a pass
they cannot trust; and the fix in the other direction — archiving the whole tree — is the
11-second hook ADR-0018 measured and rejected.

**3. `--update` lints the corpus after vendoring, and reports.** It reports rather than
refuses: by the time the copy is written, the previous linter is gone, so there is nothing
to decline into, and rolling back would leave the repo on machinery the operator explicitly
asked to replace. The message names the consequence — the hook is live, so commits are
blocked — and points at `--no-verify` as the escape hatch while the reds are fixed.

## Consequences

- Adding a rule that reads a new path now fails `npm test` until the hook's list is
  extended. The obligation is enforced at the only moment it can be acted on cheaply.
- Every repo installed before this carries a scaffolded `CLAUDE.md` whose citations predate
  ADR-0020, so its first `--update` will report red. That is correct and is what the new
  report is for; `--update` does not overwrite `CLAUDE.md` by design (ADR-0006), so the
  operator fixes it. The ledger carries the migration.
- `READ_SCOPE` is now part of the linter's public surface. A repo wanting a rule over its
  own source tree — the source-side citation check still deferred in the ledger — must
  extend the scope and pay the archive cost for those paths, which is the honest trade
  rather than a rule that quietly works in CI only.
- The `test/read-set.test.mjs` guard is textual: it parses a `for candidate in … ; do` line
  out of the hook. Rewriting that loop in another shape breaks the test loudly, which is
  the intended failure direction.
- This does not make the hook and CI equivalent. CI runs `npm run lint` over a full
  checkout and can therefore see more than the hook does; the difference is now confined to
  paths no rule is allowed to read.
