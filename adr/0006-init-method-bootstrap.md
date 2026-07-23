---
id: '0006'
title: "/init-method installs the kit, and refuses to install a hook that would brick the repo"
type: architecture
status: amended
date: 2026-07-22
supersedes: []
superseded_by: []
---

# ADR-0006 — /init-method bootstrap

## Context

ADR-0003 decided that invariants are enforced by a hook rather than by memory. It did
not say how the hook, the linter, and the scaffolding get *into* a repo. Until now they
got there by hand, and the hand-migration of boxel (2026-07-22) is the only complete
run of the sequence that exists. Three things that pass showed, none of which were in
the original plan:

1. **Install order is load-bearing.** Rule 11 makes an unwired `scripts/*-verify.mjs`
   an error, so an unwired script *is* a red corpus. boxel had nine of them. A hook
   installed at that moment would have blocked every subsequent commit — the repo would
   have arrived bricked, by the tool meant to protect it. Wiring must precede hooking.

2. **A mis-pathed check reports green.** Rule 10 exists because `lint-docs.mjs` pointed
   at a directory with no documents printed `ok` and exited 0. An installer that
   confirms its own work by running the linter must point it at the **repo root**, or it
   certifies an install that checks nothing.

3. **`~/.claude/CLAUDE.md` has three states, not two.** It can be absent (legal — global
   conventions simply do not apply), a symlink into this toolkit (installed), or a real
   file somebody wrote (their work, which an installer must never overwrite). The
   failure mode that motivated the ledger item is subtler than clobbering: because
   *absent* is legal, a **broken** symlink is silently equivalent to absent, and global
   conventions vanish with no error at all.

## Decision

`/init-method` is a slash command driving `scripts/init-method.mjs`. Three modes, and
the script never writes unless asked twice — dry-run is the default, `--apply` performs,
matching `migrate-adrs.mjs`.

**Install** (`--apply`) does, in this order:

1. Verify the target is a git repository. Refuse otherwise.
2. Scaffold what is missing — `adr/`, `CLAUDE.md` from `templates/`, `LEDGER.md` from
   `templates/` — and **never overwrite what exists**. An existing file is reported as
   `keep`, not merged. A repo's own conventions outrank a template.
3. Copy `lint-docs.mjs` and `build-index.mjs` into the target's `scripts/`, and the hook
   into `.claude/hooks/`. Copies, not symlinks: a symlink into a sibling checkout
   resolves on exactly one machine and dies silently everywhere else (boxel's
   `adr/0134` weighs the alternatives). The cost — drift — is what `--check` and
   `--update` exist to pay.
4. Generate `adr/INDEX.md`.
5. Run the linter **against the repo root**.
6. Install the hook *only if step 5 is clean*. On any error the hook is not linked, the
   errors are printed, and the run exits non-zero. This is a refusal, not a warning: the
   hook comment has warned against a red install since it was written, and a warning is
   a rule enforced by memory.

**`--check`** writes nothing and verifies what an install claims: hook linked and
resolving, vendored copies byte-identical to the toolkit's, index current, corpus green,
and the global symlink resolving. It is the guard against the silent-vanish state above.

**`--update`** re-copies the vendored scripts and hook, and nothing else.

The global `~/.claude/CLAUDE.md` link is handled in every mode by the same three-state
logic: absent → link it; symlink already pointing at this toolkit → ok; **anything
else** (a real file, or a symlink elsewhere) → refuse, name the conflict, and leave it
untouched.

What the script deliberately does **not** do is edit `package.json`. Wiring a verify
script needs a name a human recognises, and rewriting a repo's scripts block is not an
installer's business. Instead the linter reports the unwired ones and the hook is
withheld, so the operator (or the model running `/init-method`) wires them and re-runs.
The command's prose carries that instruction.

## Consequences

- A repo cannot receive a hook that would block its own commits. The failure that would
  have hit boxel is now unreachable.
- Drift becomes visible on demand rather than never: `--check` names every vendored file
  that no longer matches the toolkit.
- A repo whose `CLAUDE.md` predates the kit keeps it. The scaffold is a starting point,
  not an authority, and `{{PLACEHOLDER}}` fields are left for a human or the model to
  fill — an installer inventing a project description would be writing fiction into a
  governance file.
- The three-state global link means an operator with their own `~/.claude/CLAUDE.md`
  gets a refusal and a diff hint, never a lost file.

## Verification

`test/init-method.test.mjs` builds throwaway git repos in `os.tmpdir()` and asserts the
behaviour, not the internals: dry-run writes nothing; install scaffolds and links; an
unwired verify script (R11-red) blocks hook installation while everything else still
lands; an existing `CLAUDE.md` survives; `--check` fails on a deleted hook and on a
drifted copy; a real `~/.claude/CLAUDE.md` is refused rather than clobbered. The global
link is exercised against an injected fake home directory, never the operator's own.

## Amendment — 2026-07-23

The global-conventions link described above — `/init-method` managing the operator's
`~/.claude/CLAUDE.md` as a three-state link into the toolkit — is **withdrawn** (ADR-0016). It
predated npx distribution (ADR-0015): under `npx` the toolkit is an ephemeral cache directory,
so linking a persistent `$HOME` file into it is broken by construction, and the step also shipped
the author's personal conventions and force-linked them into every consumer's home. Linking
global conventions is a personal, machine-level choice, not part of vendoring the kit into a repo.

The rest of this ADR stands: `/init-method` still installs the kit and still refuses to install a
hook on a linter-red corpus. Only the global-link handling — and the `home`/`globalLink` machinery
and its fixtures — is removed. See ADR-0016 for the reasoning; this is an amendment rather than a
supersession because a single sub-decision changed, not the decision this ADR is named for.
