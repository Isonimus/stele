---
id: '0023'
title: "Slash commands are vendored per repo, and an update overwrites only what the repo has not touched"
type: architecture
status: accepted
date: 2026-07-28
supersedes: ['0007']
superseded_by: []
---

# ADR-0023 — Vendored commands, and what an update may overwrite

Supersedes ADR-0007, which granted a repo the right to adapt a vendored command but gave
`--update` no way to honour it, and which called all command drift uncountable. The first
made the grant unenforceable; the second made a known-buggy command undetectable. Both are
corrected here, and the reasoning for each is below.

## Context

ADR-0007 decided two things that turned out to be in conflict. A repo may adapt a vendored
slash command, because commands are prose telling an assistant how to work *in this repo*
and boxel's `/slice` reasonably says things a generic `/slice` cannot. And `--update` is the
one-way channel by which a toolkit fix reaches an installed repo (ADR-0006).

`vendorCommands` took a single boolean, `force`, and on update overwrote every command whose
bytes differed from the toolkit's. **A stale copy of an older release and a deliberate local
adaptation are the same observation** — "differs from the toolkit" — so the only reading
available was the destructive one, and the only way to take a machinery fix was to discard
every adaptation in the repo. The right ADR-0007 granted could not survive the mechanism
ADR-0006 required.

Found in `pull_request` on 2026-07-27. That repo had independently fixed `/adr` to compute
the next id across both document directories, which was correct and which the toolkit had
wrong. An `--update` would have silently reverted a fix to a defect. It survived because the
adaptation was noticed by hand and adopted upstream — luck, not a mechanism, and the ledger
recorded it as such.

The second half of ADR-0007 failed in the opposite direction. It ruled that a command
difference is reported but never counted, so `--check`'s exit code keeps meaning "this
install is broken" rather than "this install is unusual". That reasoning was sound given
what the tool could see, and wrong about what it cost: twenty misrouted bare citations sit
in the vendored commands of every repo already running an install, and **nothing in those
repos can fail because of it**. A defect that only ever prints a line nobody reads is
enforced by memory, which is the failure this whole kit exists to remove (ADR-0003).

The missing thing in both cases is not a merge algorithm. It is a **third reference point**:
the toolkit never recorded what it last handed over, so it could only compare two states
where three are needed.

## Decision

**1. Commands are vendored per repo, as ADR-0007 decided.** `/init-method` copies
`.claude/commands/*.md` into the target, enumerating the toolkit's directory at run time
rather than from a hard-coded list, so a new command reaches installed repos without anyone
remembering to extend an array. It vendors itself along with the rest: an installed repo
does not need to bootstrap again, but it does need `--check` and `--update`, and those are
the same command.

A single symlink from `~/.claude/commands/` remains rejected for ADR-0007's reason, which is
untouched by anything here — user-level commands appear in **every** repo, including repos
that never ran `/init-method`, where `/wrap-up` would invoke a `scripts/lint-docs.mjs` that
does not exist and the failure would look like a broken command rather than an uninstalled
kit.

**2. Machinery and commands keep different rules.** A locally edited linter is a silently
*different* linter whose findings no longer mean what this repo's ADRs say they mean; that is
a defect, and `VENDORED` is overwritten unconditionally. A locally edited command is use, not
drift. The asymmetry is still the point.

**3. Record provenance at vendor time.** `.claude/.stele-vendored.json` maps each vendored
command path to the SHA-256 of the content the toolkit wrote there. It is committed, not
ignored — a fresh clone that lost it would classify every command as unreconciled. It is
written only by `--apply` and `--update`, never by a dry run or `--check`.

**4. Classify, do not merge.** Five states, from the target's bytes, the toolkit's bytes and
the record:

| State | Meaning | `--apply` | `--update` | `--check` |
|---|---|---|---|---|
| `absent` | never installed | copy | copy | `missing`, uncounted |
| `current` | equals the toolkit | — | — | `ok` |
| `stale` | equals the record, not the toolkit | keep | **overwrite** | **`problem`** |
| `adapted` | equals neither | keep | keep, reported | `local`, uncounted |
| `unknown` | differs, no record | keep | keep, reported | `local`, uncounted |

A textual three-way merge (`git merge-file`) was rejected. These files are instructions an
assistant reads as law, and a conflict-markered `/slice` is worse than either version: a
half-broken rule that still parses. The expensive question is "may I overwrite this?", and
classification answers it exactly; merging answers a question nobody asked.

**5. `stale` is a `--check` problem, reversing ADR-0007.** A command that is behind the
toolkit *and unmodified here* is not an unusual install — it is a repo missing a fix, and
for machinery ADR-0007 already called exactly that state a problem. Its reason for treating
commands differently was that an adaptation must not be called broken, and that reason
survives: `adapted` and `unknown` stay uncounted. What does not survive is extending that
protection to files nobody adapted, which is how a known defect became invisible in every
installed repo at once. The old rule was not wrong about adaptations; it was wrong to
protect staleness with the same shield, and it could only do so because it could not tell
them apart.

**6. `unknown` is a distinct state, and it is conservative.** Every install predating this
decision has no record, so a differing command cannot be told from an adaptation. It is kept
and reported with the reason, never overwritten, and never counted — treating a missing
record as permission to clobber would reintroduce the incident on the very run that fixes
it, and calling it a problem would fail every existing install for a state it cannot help.

**7. `--force` is the way to discard an adaptation**, and it must be typed. `--update` alone
is now safe by default, so the escape hatch that used to be implicit becomes explicit. It is
refused outside `--update`, rather than ignored, so a mistyped invocation says so.

## Consequences

- A corrupt or unrecognised record file reports a problem and is treated as **no record** —
  every command classifies as `unknown` and nothing is overwritten. Failing safe here is not
  a silenced error: the problem is reported, and the conservative branch is the one that
  cannot lose work.
- The record is bootstrapped by observation, not migration. Any command that currently
  equals the toolkit gets an entry on the next apply or update, which is how existing
  installs acquire a record without a separate step. Commands that already differ stay
  `unknown` until the operator reconciles them once.
- A repo one release behind on a command now **fails `--check`**, which is a deliberate
  change of what a red check means for commands: it now covers "missing a fix" as well as
  "broken". The remedy is one command, and it is the same treatment machinery has always
  had.
- This unblocks the misrouted-citations remediation: `--update` can be recommended to every
  installed repo without asking anyone to audit their commands first, and after that record
  exists the *next* such defect fails a check instead of printing a line.
- A repo that adapts a command still receives no upstream fix to it, and now learns so
  loudly instead of silently losing the adaptation. That is an improvement, not a solution;
  reconciling an adapted command remains manual, and deliberately so, because merging prose
  that carries instructions is the thing point 4 refuses to do. ADR-0007's consequence still
  holds: an edit made in an installed repo does not travel home.
- ADR-0022 scoped the mutation check to the pure predicates of `lint-docs.mjs` and
  `check-immutable.mjs`, excluding `init-method.mjs` on the reasoning that a mutant there
  mostly proves the filesystem still works. `classifyCommand` is the first total, IO-free
  predicate in that file, so it falls inside the scope ADR-0022 *described* rather than the
  file it *named*, and two mutants against it join the list. Recorded here as a refinement
  of that scope, because a silent exception is the thing this repo does not do.
- **This ADR was filed as a plain new decision first**, with `supersedes: []`, describing
  point 5 as a "narrowing" of ADR-0007. The adversarial pass (ADR-0017) rejected that draft:
  two accepted ADRs asserting contradictory permanent claims about the same exit code, where
  a reader consulting ADR-0007 alone — the whole point of an immutable record — is told
  something false. The author had even prompted the reviewer to check that specific question
  and still shipped the draft, which is the argument for handing a diff to someone who does
  not know what it was meant to do.
