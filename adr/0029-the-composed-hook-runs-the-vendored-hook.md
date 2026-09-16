---
id: '0029'
title: "The composed framework block runs the vendored hook, because the framework's stash does not make the working tree the commit"
type: architecture
status: accepted
date: 2026-09-16
supersedes: []
superseded_by: []
---

# ADR-0029 — The composed framework block runs the vendored hook

## Context

ADR-0018 made the vendored hook check the commit: it writes the index as a tree, extracts
the paths the checks read, and runs the commit's own checkers against that copy. Its §4 left
the other install shape alone. The `repo: local` block `/init-method` composes into a
`pre-commit` framework config kept running `node scripts/lint-docs.mjs .`,
`node scripts/build-index.mjs --check .` and `node scripts/check-immutable.mjs` from the
repo root, on this premise: *the framework has already stashed unstaged changes by the time
it dispatches*, so the working tree already is the index.

The premise is half true. The framework's stash sets aside unstaged edits to **tracked**
files. It leaves **untracked** files on disk, and a new ADR or slice is untracked until
someone adds it. The two working-tree entries therefore check a state no commit contains
whenever a record exists on disk but not in the index. `check-immutable.mjs` defaults to
`HEAD` against `git write-tree` and was never affected.

Found in bida-ia on 2026-09-16, which composes the block verbatim. Both directions were
reproduced there:

| Scenario | Composed block | Vendored hook |
|---|---|---|
| a new slice untracked, the commit touching neither it nor `INDEX.md` | **refused** — the index check saw a slice the commit lacks | passes |
| `INDEX.md` regenerated and staged, the record it lists left untracked | **passes** — the committed tree then fails `build-index.mjs --check` | refused, "out of date" |
| the same, with the record staged | passes | passes |

The first row blocks a correct commit, which is how it was noticed. The second row is the
dangerous one: a green hook on a red commit, which is precisely what ADR-0018 exists to
remove, left open in one of the two install shapes. ADR-0018 also claimed in its
consequences that both shapes now enforce the same thing. They did not, and nothing tested
the claim: every hook fixture drove the symlink shape.

## Decision

**The composed block is one entry, and it runs the vendored hook.**

```yaml
- id: stele-docs
  name: doc checks against the commit
  entry: sh .claude/hooks/pre-commit
  language: system
  pass_filenames: false
  always_run: true
```

1. **One implementation of "check the commit".** The hook already materialises the staged
   tree, restricts the extraction to the read scope, refuses when the commit lacks its
   checker, and skips immutability on an unborn branch. Reproducing that as framework
   entries would be a second copy of the same machinery, which is the drift ADR-0021 was
   written against. The alternative, adding the extraction to each entry, was rejected for
   that reason.
2. **`sh`, not the path alone.** The framework runs a `language: system` entry as a command,
   so a bare path depends on the vendored copy's executable bit, which a copy or an archive
   can drop. `sh` does not.
3. **The id stays `stele-docs`** (ADR-0014), so `--check` recognises both old and new blocks
   as ours.
4. **An old block is reported, never rewritten.** ADR-0008 keeps `--update` from restoring
   our version of a config the repo owns, and that stands. `--apply`, `--check` and
   `--update` all report a block that names our id but not the hook, with the replacement
   spelled out. `--update` is included because it is the moment a repo takes the fixed hook,
   and an old block would gain nothing from it.
5. **The regression runs the composed entries as the framework does**, from the repo root with
   no filenames, against an index naming an untracked record. The framework's stash is not
   reproduced, because it does not touch untracked files, which is the whole point. The suite
   keeps zero dependencies and needs no `pre-commit` binary.

## Consequences

- ADR-0018's status becomes `amended`. Its decision holds; its §4 and its claim that both
  shapes enforce the same thing are corrected in place by dated markers (ADR-0019).
- Both install shapes now run the same script, so a fixture proving the hook proves both,
  instead of relying on an unverified equivalence.
- The framework's stash is now redundant for the doc checks, and harmless: the hook reads a
  tree object and never the working copy.
- Every repo composed before this decision stays on the working-tree block until its
  operator replaces it by hand. `--check` and `--update` say so, and that is the most this
  tool does to a file it does not own.
- A partial-path commit (`git commit -- path`) remains unchecked in both shapes, as
  ADR-0018 already states.
