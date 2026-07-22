---
description: Install the method kit (CLAUDE.md, LEDGER.md, linter, index, pre-commit hook) into a git repo
argument-hint: [repo-root] [--check | --update]
---

Install this kit into a repo, or verify an existing install (ADR-0006). The script does
the mechanical half; you do the two halves that need judgement — filling the scaffolded
`CLAUDE.md`, and wiring verify scripts.

Target repo: `$ARGUMENTS` (default: the current repo root).

## 1. Look before writing

Run the dry run first and read what it plans:

```
node scripts/init-method.mjs <target>
```

It writes nothing. `WOULD` lines are the plan, `KEEP` means a file already exists and
will be left alone, `PROBLEM` means something needs a decision. Report the plan to the
operator before applying it if anything is being scaffolded over a repo that already has
conventions of its own.

If the target is not a git repository the run refuses. Offer `git init`; do not work
around it — the hook has nowhere to live.

## 2. Apply

```
node scripts/init-method.mjs <target> --apply
```

This scaffolds `adr/`, `CLAUDE.md` and `LEDGER.md` (never overwriting), vendors
`lint-docs.mjs` / `build-index.mjs` / the hook and the slash commands, generates
`adr/INDEX.md`, links `~/.claude/CLAUDE.md`, and installs the pre-commit hook **only if
the corpus lints clean**.

The commands are vendored under softer rules than the machinery (ADR-0007): a repo may
edit its own copy of `/slice` or `/wrap-up` to say something repo-specific, and an
install keeps that edit rather than overwriting it. If you edit one, say so — an edit
made in an installed repo does not travel back to the toolkit.

## 3. If the repo already has a hook framework

A target with a `.pre-commit-config.yaml` gets the doc checks **composed into it** as a
`repo: local` block rather than a symlink (ADR-0008) — the framework owns
`.git/hooks/pre-commit`, and a symlink there is silently erased by the next
`pre-commit install`. The append is idempotent and additive; the existing config is
never reordered or rewritten, and `--update` leaves it alone.

Two things to watch:

- A config the script does not recognise (no top-level `repos:`) is **refused**, not
  guessed at. Add the block by hand and say you did.
- `--check` reports a problem when the framework is configured but never installed. That
  is not our hook failing — it means *no* hook runs, including the repo's own ruff and
  mypy. Tell the operator to run `pre-commit install`; do not paper over it by
  symlinking ours instead.

## 4. If it refused the hook

A refusal is normal on a repo that already has work in it, and the reason is almost
always **rule 11: a `scripts/*-verify.mjs` that no `package.json` command runs**. An
unwired verify script ran once, the day it was written; the linter treats that as an
error, so the corpus is red and a hook would block every commit.

Fix it, in this order — the order is the whole point:

1. Add one `"verify:<name>": "node scripts/<name>-verify.mjs"` per unwired script. Use
   the name a human would recognise, not the filename verbatim. A `verify:all` chaining
   the headless ones is worth adding; leave out any script that needs a human watching
   or listening, and say so in a comment or in `CLAUDE.md`.
2. Fix any other lint errors (dangling supersessions, bad frontmatter). Never silence a
   rule to get green.
3. Re-run `--apply`. The hook installs.

Do **not** edit the target's `package.json` without telling the operator what you added.

## 5. Finish the scaffold

If `CLAUDE.md` was newly scaffolded it contains `{{PLACEHOLDER}}` fields. Fill them from
the repo itself — read the README, the manifest, the source layout. Do not invent a
project description. Then delete the sections that describe machinery the repo does not
have: a verification-harness section in a repo with no `scripts/` states rules about
files that do not exist, which makes the file false on arrival.

## 6. Verify, and say what happened

```
node scripts/init-method.mjs <target> --check
```

Writes nothing; fails on a missing or broken hook, a drifted vendored **script**, a stale
index, a red corpus, or a broken `~/.claude/CLAUDE.md` link. Report its output verbatim
rather than summarising it as "installed".

`LOCAL` and `MISSING` lines are about commands only and are **not** failures — they say
this repo adapted or declined one. Read them, mention them, do not "fix" them without
asking; that is somebody's deliberate edit.

`--update` re-copies the vendored scripts, the hook and the commands — for a command it
discards a local edit, which is exactly what it is for. It is the only way a toolkit fix
reaches an installed repo: the copies are deliberate (ADR-0006, ADR-0007), and drift is
the price.
