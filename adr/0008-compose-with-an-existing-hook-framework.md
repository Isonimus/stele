---
id: '0008'
title: "Where a hook framework already owns the pre-commit slot, the doc checks join it rather than fight for the file"
type: architecture
status: accepted
date: 2026-07-22
supersedes: []
superseded_by: []
---

# ADR-0008 — Where a hook framework already owns the pre-commit slot, the doc checks join it

## Context

ADR-0003 put the doc checks in `.git/hooks/pre-commit`, and ADR-0006 had `/init-method`
install them there as a symlink to a vendored script. Both assumed the slot was free.

l33t-mmorpg (surveyed 2026-07-22) is the first repo where it is not. It uses the Python
`pre-commit` framework: `.pre-commit-config.yaml` configures ruff, mypy, and
`no-commit-to-branch --branch main`, and `pre-commit install` writes its own dispatcher
into `.git/hooks/pre-commit`. There is exactly one such file and two tools that want it.

`/init-method` already refuses to overwrite a hook it did not write, so the visible
collision is handled. The dangerous one is invisible and runs the other way: if our
symlink goes in first, the next `pre-commit install` — run by anyone, at any time,
for reasons having nothing to do with us — silently replaces it. Commits keep
succeeding, the doc checks are simply gone, and nothing says so. That is the same
failure class ADR-0006 named for a broken `~/.claude/CLAUDE.md` symlink: not a loud
clobber, a quiet absence. A guarantee that a third party can revoke without an error is
not a guarantee.

Worth noting about the repo that motivated this: the framework is *configured but not
installed* there — `.git/hooks/` is empty. Its declared checks, including its own ban on
committing to `main`, have never run.

## Decision

When `/init-method` finds a `.pre-commit-config.yaml` in the target, it does **not**
symlink. It appends a `repo: local` block to that file running the same two commands the
vendored hook runs, and reports what it did.

The block is identified by hook id (`claude-method-docs`), so the operation is
idempotent: present means done, absent means append. The append is textual — the toolkit
is zero-dependency by ADR-0003 so that it runs on a bare clone, and adding a YAML parser
to edit one list would cost more than the edit is worth. To stay honest about the limits
of a textual edit, the run **refuses** on any file without a top-level `repos:` key
rather than guessing at an unfamiliar shape.

Composing brings a second benefit beyond survival: the doc checks then run under the
same tool, in the same order, with the same `--no-verify` bypass and the same skip list
as ruff and mypy. One mechanism, not two racing for one file.

`--check` follows the same branch, and gains a failure the symlink path does not have:
a framework that is configured but never installed means **no hook runs at all**. That
is reported as a problem naming `pre-commit install` as the fix, because a repo in that
state looks protected in its config and is not.

## Consequences

- Two install shapes now exist, chosen by what the target already has, and `--check`
  must agree with `--apply` about which is in force. The framework's presence is the
  single discriminator, so they cannot disagree.
- The composed entries are `language: system` and call `node` directly. A machine
  without node on PATH fails the hook loudly, which is the vendored hook's behaviour
  too.
- We now write into a file we do not own. The append is additive, id-guarded and
  idempotent, but `--update` deliberately does **not** rewrite it: a repo may reorder or
  edit those entries, and silently restoring our version of somebody's hook config is
  precisely the overreach the rest of this tool refuses.
