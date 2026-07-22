---
id: '0007'
title: "Slash commands are vendored per repo, and a repo's edits to them survive"
type: architecture
status: accepted
date: 2026-07-22
supersedes: []
superseded_by: []
---

# ADR-0007 — Slash commands are vendored per repo, and a repo's edits to them survive

## Context

ADR-0006 built `/init-method` and decided what it vendors: the linter, the index
builder, and the pre-commit hook. It said nothing about the slash commands themselves —
`/adr`, `/slice`, `/wrap-up`, `/audit`, `/remember`, `/init-method`. That was not a
decision to leave them out; it was an omission, and it showed the day boxel finished its
migration: boxel had the whole enforcement half of the kit and none of the authoring
half. `.claude/commands/` did not exist there. The commands are the operator-facing
surface of this method — a repo with the linter but not `/wrap-up` has the check and not
the habit the check exists to support.

The obvious cheap alternative was a single symlink from `~/.claude/commands/` into this
toolkit, installing every command once for the whole machine. It is wrong: user-level
commands appear in **every** repo, including repos that never ran `/init-method`. There
`/wrap-up` would invoke `scripts/lint-docs.mjs`, which is not present, and the failure
would look like a broken command rather than an uninstalled kit. The kit's commands must
be visible exactly where the kit is installed.

## Decision

`/init-method` vendors `.claude/commands/*.md` into the target repo, enumerating the
toolkit's directory at run time rather than from a hard-coded list — a command added to
the toolkit reaches installed repos without anyone remembering to extend an array.

Commands are vendored under **different rules from the machinery**, because they are
different things:

|  | machinery (`lint-docs.mjs`, `build-index.mjs`, the hook) | commands (`*.md`) |
|---|---|---|
| `--apply` over an existing copy | overwrites — the toolkit's version is the only correct one | **keeps** the repo's copy |
| `--check` on a difference | `problem` (exit non-zero) | `local` — reported, not counted |
| a missing file | `problem` | `missing` — reported, not counted |
| `--update` | restores the toolkit version | restores the toolkit version |

The asymmetry is the point. A locally edited linter is a silently *different* linter, and
its findings no longer mean what this repo's ADRs say they mean — that is a defect. A
locally edited command is prose telling an assistant how to work **in this repo**, and
boxel's `/slice` reasonably says things a generic `/slice` cannot. Adapting it is use,
not drift. So `--check` surfaces the difference (an invisible divergence would be its own
problem) without ever calling a working install broken, and `--update` remains the
explicit, opt-in way to take the toolkit's version back — the same one-way channel
ADR-0006 gave the machinery.

`/init-method` vendors itself along with the rest. An installed repo does not need to
bootstrap again, but it does need `--check` and `--update`, and those are the same
command; leaving it out would put the only documentation of the repo's own maintenance
in a different repo.

## Consequences

- A repo's `.claude/commands/` is now part of what `--check` reports on, so the report
  has three severities where it had two. `problems` still counts only the machinery, so
  the exit code keeps meaning "this install is broken", not "this install is unusual".
- Editing a vendored command is now a supported act rather than an undefined one — but
  an edit is invisible to the toolkit, so a fix made in a repo's copy does not travel
  home. Improving a command for everyone means editing it here.
- boxel gains six commands it did not have.
