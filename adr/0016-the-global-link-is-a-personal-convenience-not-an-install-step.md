---
id: 0016
title: The global-conventions link is a personal convenience, not an install step
type: architecture
status: accepted
date: 2026-07-23
supersedes: []
superseded_by: []
---

# ADR 0016 — The global-conventions link is a personal convenience, not an install step

## Context

ADR-0006 made `/init-method` manage the operator's `~/.claude/CLAUDE.md` as a three-state
global link into the toolkit, in every mode. That was written when the only way to run the kit
was from a stable local checkout, and it conflated two separate things — installing the method
*into a repo* and wiring the operator's *machine-level* global conventions.

The npx-distribution decision (ADR-0015) broke the conflation open:

- **Under `npx` the toolkit is an ephemeral cache directory.** Creating a persistent
  `~/.claude/CLAUDE.md` symlink into it is broken by construction — the target vanishes on the
  next cache GC. When a link already existed pointing at a real checkout, the step could not
  validate it against the ephemeral toolkit path and reported a `problem` with a non-zero exit,
  so an otherwise-clean install of the kit into a repo announced failure.
- **The shipped `global/CLAUDE.md` was the author's *personal* conventions.** It was published
  in the tarball and the installer tried to symlink every consumer's `~/.claude/CLAUDE.md` to
  it — imposing one operator's "how I work" file on every user of the tool. That is not a
  default a distributed tool gets to set.

The root error is scope: linking the operator's global conventions is a personal, machine-level
choice. Vendoring the method into repo X must not reach outside repo X, and certainly must not
write into `$HOME`.

## Decision

`/init-method` no longer touches `~/.claude/CLAUDE.md` in any mode. The `globalLink` step, the
`GLOBAL_LINK` constant, and the `inspect` helper that served only it are removed; the exported
`initMethod` no longer takes a `home`.

- **`global/CLAUDE.md` is removed from the published `files`.** The personal conventions file is
  not distributed. It stays in this repo for the author's own dogfooding (a version-controlled
  global file, linked by a one-time personal `ln -s`), but that setup is the operator's, not
  the installer's to create.
- **`/remember` drops the repo-specific global guidance.** It no longer tells a user to edit
  `global/CLAUDE.md` in "the stele repo"; it points at their own `~/.claude/CLAUDE.md`, wherever
  their global conventions live.
- **This withdraws only ADR-0006's global-link handling.** The rest of ADR-0006 — install the
  kit, and refuse a hook on a linter-red corpus — stands unchanged. ADR-0006 is therefore not
  wholly superseded; it carries a dated amendment pointing here. A change to one sub-decision of
  a multi-part ADR is what the amendment marker is for; a superseding ADR would force restating
  the parts that did not change.

## Consequences

- **Installing into a repo never writes outside that repo.** The blast radius now matches what a
  per-repo vendoring tool should have: the repo, and nothing in `$HOME`.
- **The false "1 problem" on a clean install is gone.** `/init-method`'s exit reflects the repo
  install alone, not the state of an unrelated home-directory symlink.
- **The author's own global setup is untouched.** `~/.claude/CLAUDE.md → global/CLAUDE.md` is a
  manual personal symlink; removing the installer's management of it does not disturb the link,
  and the file stays in the repo (unpublished) for that use.
- **Registry cleanup follows.** `0.1.0` and `0.1.1` shipped the personal file; they are
  unpublished and replaced by a clean `0.1.2`. The operational step is carried in `LEDGER.md`
  until done.
- **The test harness no longer injects a fake home.** The global-link fixtures are removed with
  the behaviour they covered; `scratchRepo` builds only the target repo.
