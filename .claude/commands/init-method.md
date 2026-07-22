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
`lint-docs.mjs` / `build-index.mjs` / the hook, generates `adr/INDEX.md`, links
`~/.claude/CLAUDE.md`, and installs the pre-commit hook **only if the corpus lints
clean**.

## 3. If it refused the hook

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

## 4. Finish the scaffold

If `CLAUDE.md` was newly scaffolded it contains `{{PLACEHOLDER}}` fields. Fill them from
the repo itself — read the README, the manifest, the source layout. Do not invent a
project description. Then delete the sections that describe machinery the repo does not
have: a verification-harness section in a repo with no `scripts/` states rules about
files that do not exist, which makes the file false on arrival.

## 5. Verify, and say what happened

```
node scripts/init-method.mjs <target> --check
```

Writes nothing; fails on a missing or broken hook, a drifted vendored copy, a stale
index, a red corpus, or a broken `~/.claude/CLAUDE.md` link. Report its output verbatim
rather than summarising it as "installed".

`--update` re-copies the vendored scripts and hook when `--check` reports drift. It is
the only way a toolkit fix reaches an installed repo — the copies are deliberate
(ADR-0006), and drift is the price.
