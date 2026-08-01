# Releasing

How a version of `@isonimus/stele` reaches npm. A **live doc** (ADR-0010): update it in the
same change as the procedure it describes.

It exists because the steps below were previously done from memory, in the repo whose thesis
is that a rule enforced by memory holds until the first busy afternoon (ADR-0003). Two things
had already gone wrong by the time it was written: three published versions had **no git tags
at all**, and a build tarball had been sitting in version control since 2026-07-27.

## The order, and why it is this order

```
1.  npm run lint && npm test          the corpus is green and the suite passes
2.  npm run index                     regenerate adr/INDEX.md; commit if it moved
3.  edit package.json                 bump the version
4.  commit                            the last commit before the tag
5.  git tag -a vX.Y.Z -m "…"          on the commit being published (ADR-0026)
6.  npm run changelog                 regenerate CHANGELOG.md from the new tag
7.  commit                            "chore: changelog for vX.Y.Z"
8.  git push && git push --tags       tag and history reach the remote together
9.  npm publish                       irreversible: a version number is never reusable
10. /init-method --update             in every installed repo, so the fix actually lands
```

**Why the tag comes before the changelog.** `scripts/build-changelog.mjs` reads tags and
nothing else, so a tag that does not exist yet produces a changelog missing its own release.
Tagging first is not a preference; it is the data dependency.

**Why the changelog is a second commit, and why publish is one commit past the tag.** The
changelog describes commits up to and including the tagged one, so it cannot live inside the
object it is naming. `npm publish` therefore packs a tree one commit ahead of `vX.Y.Z` —
identical to it but for `CHANGELOG.md`, which is the file that could not have been there. That
skew is deliberate and bounded; anything else in the diff at step 9 means the release is not
what the tag says it is.

**Step 3 bumps the version, but step 5 tags the commit you are about to publish** — and on
0.4.0 those were three commits apart, because work continued after the bump. `npm publish`
packs the working tree, not the version-bump commit, so a tag left behind on the bump would
name bytes nobody received. Bump last where you can; tag what ships where you cannot.

**Why publish is last and by hand.** `npm publish` cannot be undone: a version number is burned
even if the release is unpublished within the 72-hour window. Everything reversible happens
first, so the irreversible step runs against a state already checked.

**Why step 10 is part of the release.** The linter, the hook and the commands are *vendored*
per repo (ADR-0006, ADR-0023). Publishing changes nothing in boxel or gamatar until
`/init-method --update` runs there, so a release that stops at step 9 has shipped to the
registry and to nobody.

## Version numbers

Pre-1.0, so the minor slot carries breaking changes:

- **patch** — a fix that changes no vendored file's behaviour.
- **minor** — a new linter rule, a change to a vendored command or to `docs/quality-bar.md`,
  or any change to the installer's behaviour. A new rule makes commits fail that were green in
  the previous version, which is breaking however small the diff.
- **major** — reserved for 1.0.

## What the changelog does and does not say

It is generated from commit subjects between tags (ADR-0026). It therefore inherits exactly
the quality of the commit messages, which is the argument for writing them properly rather
than an argument for editing the changelog afterwards — **never hand-edit it**; the CI check
will fail and the edit is lost at the next regeneration.

It cannot say "you must run `--update` for this one". If a release needs that, say so in the
release commit's subject, where the changelog will pick it up verbatim.

## If something goes wrong

- **Anything changed after tagging, including docs:** do not move the tag. Bump a patch
  version, tag that, and publish it instead — the working tree is what `npm publish` packs, so
  a tree that has moved past the tag is no longer the release the tag names. This happened on
  the first run of this procedure: `v0.4.0` was tagged, a README update followed, and `0.4.1`
  was published in its place. `v0.4.0` stays in the history as a tagged release that was never
  published, which the changelog shows and which is the honest record (`0.2.1` is the same).
- **Tagged the wrong commit, not yet pushed:** `git tag -d vX.Y.Z`, retag, regenerate.
- **Tagged and pushed the wrong commit:** do not move the tag. Tag the correction as the next
  patch version — a moved tag means two clones disagree about what a release was.
- **Published a broken version:** publish the fix as a new version. Unpublishing is available
  for 72 hours and is worse than a superseding release: it breaks every lockfile that already
  pinned it.
