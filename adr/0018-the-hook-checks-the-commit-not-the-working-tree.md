---
id: 0018
title: The hook checks the commit, not the working tree
type: architecture
status: accepted
date: 2026-07-27
supersedes: []
superseded_by: []
---

# ADR 0018 — The hook checks the commit, not the working tree

## Context

`.claude/hooks/pre-commit` ran its two checks against the files on disk:

```sh
node scripts/lint-docs.mjs .
node scripts/build-index.mjs --check .
```

What `git commit` records is not the files on disk. It is the **index**. The two agree most
of the time, and the hook was written as if they always did.

They do not, and the gap is a false green. Reproduced in a throwaway repo:

```
stage an ADR with status: superseded and superseded_by: []
fix it in the working tree, do not stage the fix
git commit  →  hook: "0 error(s)"  →  accepted
lint what actually landed  →  ERROR R6 status is superseded but superseded_by is empty
```

The likelier everyday variant needs no contrivance at all: regenerate `adr/INDEX.md`, forget
`git add`, and `build-index --check` reads the regenerated file on disk, passes, and HEAD
keeps the stale one. `/wrap-up` step 1 already compensates in prose — "regenerate `adr/INDEX.md`
**and stage it** if it changed" — which is a hand-written instruction propping up a mechanical
check, the shape ADR-0003 exists to remove.

Two things make this worse than an ordinary bug.

**It is the enforcement surface itself.** Every other rule in this kit is trustworthy only
insofar as the thing that runs them looks at the right bytes. A linter that checks a state no
commit will ever contain is the false green rule 10 was written to kill, one level up.

**The two install shapes disagree.** ADR-0008 chose to compose into the `pre-commit` framework
rather than fight it for the file, on the understanding that the two paths enforce the same
thing. They did not: the framework stashes unstaged changes before running its hooks, so the
composed install was already checking the index, while the symlink install was not. A repo's
protection depended on which installer branch it happened to take.

CI (`.github/workflows/docs.yml`) checks out the commit and so catches all of this — it is a
leak, not an escape. But CI is the backstop by design; a hook that reports green on a commit CI
will reject is the hook teaching people to distrust it.

## Decision

**The hook materialises the staged tree and checks that.**

```sh
tree=$(git write-tree)
git archive "$tree" -- $paths | tar -x -C "$staged"
node "$staged/scripts/lint-docs.mjs" "$staged"
node "$staged/scripts/build-index.mjs" --check "$staged"
```

**1. Materialise, do not stash.** The obvious alternative is `git stash push --keep-index`,
which is the widely-copied recipe and is rejected here: it mutates the operator's working tree
during a commit, and any failure between stash and pop — a killed hook, a full disk, an
interrupt — leaves their uncommitted work in a stash they did not create and were not told
about. `git write-tree` writes a tree object and touches nothing else; the extraction lands in
a `mktemp -d` removed by an `EXIT` trap. A check that can lose work is not worth the state it
protects.

**2. Only the paths the checks read, because the whole tree does not scale.** Measured, on the
two corpora available:

| corpus | tracked files | full tree | read-set only |
|---|---|---|---|
| stele | 100 | 0.056s | — |
| boxel | 796 | 0.882s | 0.093s |

That is ~1.1ms per tracked file, linear: a 10k-file monorepo pays ~11 seconds on every commit,
which is a hook people delete. Restricting the archive to `adr slices LEDGER.md scripts
package.json` — the complete read-set of the two scripts — is ~10x cheaper and independent of
repo size.

The cost is a coupling: that list must track what the checks read. It is stated here, cited at
the code site (ADR-0012), and it fails loud rather than quietly under-checking — a path absent
from the tree is dropped from the pathspec (`git archive` errors on a pathspec matching
nothing), and if *no* doc path survives, the checks run against an empty directory and R10
reports "no adr/ or slices/ directory here", which is the correct diagnosis.

**3. The commit's own checkers run, not the working tree's.** `node "$staged/scripts/..."`,
not `node scripts/...`. Checking the commit's documents with the working tree's linter is the
same defect one turn removed — most visibly in this repo, where the linter *is* the product and
an unstaged edit to it would grade the commit that does not contain it. If the tree carries no
vendored checker the hook stops and says so, rather than falling back to the working copy; a
silent fallback would reintroduce exactly what this ADR removes.

**4. The composed install is left alone.** The `repo: local` block in `init-method.mjs` keeps
running `node scripts/lint-docs.mjs .` against the working tree, because the framework has
already stashed unstaged changes by the time it dispatches. The reason is written at that
block, since a later reader comparing it to the hook would otherwise "fix" it into a
duplicate of machinery the framework already provides.

## Consequences

- **The hook and CI now agree on what they check.** A green hook means the commit is green,
  which is what everyone already believed it meant.
- **Both install shapes enforce the same thing**, restoring the equivalence ADR-0008 assumed
  and did not verify.
- **`/wrap-up`'s "and stage it" is now belt-and-braces rather than load-bearing.** The
  instruction stays — staging the index is still what the operator wants — but forgetting it
  is caught by a check instead of by memory.
- **A partial-path commit is still unchecked.** `git commit -- some/path` builds its tree from
  HEAD plus those paths, not from the index, so `git write-tree` describes a state that commit
  will not create. Git exposes no hook-visible handle on that tree; the `pre-commit` framework
  has the same limitation. CI remains the backstop for it, and this is stated rather than
  papered over.
- **The read-set path list is a maintenance obligation.** A future rule that reads a file
  outside `adr slices LEDGER.md scripts package.json` must extend the list in the same change,
  or it will check a file the hook never extracts. This is the one place the fix trades a small
  standing duty for a 10x cost reduction, and it is the first thing to revisit if a rule ever
  reads `CLAUDE.md`.
- **Adopting repos need `--update`.** The hook is vendored (ADR-0006), so installed repos keep
  the old one until `/init-method <repo> --update` re-syncs it; `--check` reports the drift in
  the meantime.
