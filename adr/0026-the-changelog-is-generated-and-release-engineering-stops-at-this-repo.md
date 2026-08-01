---
id: '0026'
title: "The changelog is generated from tags, and release engineering is not enforced on the repos the method installs into"
type: architecture
status: accepted
date: 2026-08-01
supersedes: []
superseded_by: []
---

# ADR-0026 — The changelog is generated from tags; release engineering stops at this repo

## Context

This kit is published to npm — `0.1.2`, `0.2.0` and `0.3.0` are on the registry — and until
today it had **zero git tags**. Nothing in history marked where a release began or ended, and
a consumer had no way to learn that 0.4.0 fixes a crash in the installer and changes a
vendored command they must run `--update` to receive. The facts existed; nothing published
them.

Four places already record what changed, and none of them answers a consumer's question:
`adr/` records *why* a decision was made, `LEDGER.md` records what is still open, `README.md`
carries a little history prose, and the git log records everything at a granularity nobody
wants to read. A hand-written `CHANGELOG.md` would be a fifth statement of facts already
recorded in the other four, kept in step by hand.

That arrangement has a measured outcome here. ADR-0001 killed the previous convention —
record a deferral in an ADR *and* in the tracker, keep them in sync by hand — after it was
mandated for three weeks across two repos and executed **exactly zero times**. A changelog is
a worse instance of that failure than most, because its content is fully derivable: every
line of it is already in the commit history, so writing it by hand means transcribing a
source of truth into a file that can then silently disagree with it.

The second question is whether any of this should be pushed onto the repos the method
installs into. It should not, and the reasoning generalises past changelogs to the whole
category of repo-hygiene files — `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, a PR
template — which this repo has and its consumers mostly do not.

## Decision

**1. `CHANGELOG.md` is a Generated document** (ADR-0010, row two), built by
`scripts/build-changelog.mjs` and never hand-edited, exactly like `adr/INDEX.md`. Its content
is the commit subjects between annotated tags. Nothing about it is a judgement call, which is
what makes generating it possible and hand-writing it pointless.

**2. It is generated from tags only, with no "Unreleased" section.** That is what makes a
`--check` affordable: the file changes *only* when a tag is created, so CI can assert it
matches the corpus on every push without the file churning on every commit. An Unreleased
section would make every commit a changelog commit, and a check that fires constantly is a
check that gets bypassed. Commits after the newest tag appear when the next release is
tagged, and the file says so about itself.

**3. An annotated tag pointing at a commit is the release boundary**, and the generator
enforces both halves rather than assuming them: a lightweight tag is a local bookmark and an
annotated tag may point at a blob, so neither is a release, and both are *named* on stderr
instead of dropped in silence — a release tagged with a bare `git tag` would otherwise vanish
from the changelog with no symptom but an absence. The release procedure
([`docs/releasing.md`](../docs/releasing.md)) orders the steps: tag, regenerate, commit,
publish. The three tags written retroactively on 2026-08-01 say in their own messages that
they mark the commit which *set* the version rather than a state observed at publish time —
the closest recoverable approximation, labelled as one rather than presented as fact. `0.2.1`
was bumped at `7d2086e` and never published, so it gets no tag and its commits belong to
`v0.3.0`, which is where they actually reached consumers.

**4. No linter rule requires a changelog, here or anywhere.** A rule with no incident behind
it is a preference (`CLAUDE.md` §3), and nothing has yet gone wrong for want of a changelog in
any installed repo. The temptation is real because the property is trivially checkable — does
`CHANGELOG.md` exist, does it have a heading matching `package.json`'s version — and that is
the trap ADR-0024 walked into from the other side: *checkable* and *worth checking* are
different questions. A heading matching a version number says nothing about whether the entry
under it is true, complete, or of any use to the person reading it. Here the answer is to not
ship the check, rather than to ship it and discover its limits later.

**5. Release engineering is not installed into consumer repos at all** — no changelog, no
scaffolded `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` or PR template, and no rule
about any of them. Three reasons, in ascending order of force:

- Most installed repos publish nothing. boxel and gamatar have no consumers, so a release
  convention there enforces ceremony against nobody.
- `CLAUDE.md` and `LEDGER.md` are scaffolded because the method *reads and writes them* — the
  linter parses the ledger's citations, and the invariant table lives in `CLAUDE.md`. They are
  load-bearing machinery. Community-health files are load-bearing for nothing this kit does,
  and adding them turns an ADR workflow into a repo scaffolder: a different product, which
  already exists and is far better tested as GitHub's own community-health templates and
  org-level `.github` defaults. That is ADR-0025 applied to its author one day after it was
  written, and no departure argument survives contact with it.
- `SECURITY.md` is the case that settles it. Its content is a **promise** — a disclosure
  address, a response window, a supported-version range. Scaffolding a template promise into a
  repo that has made none produces a document that lies to whoever reads it, in the one moment
  they are relying on it. A missing `SECURITY.md` says "no stated policy", which is true. A
  templated one says something false.

The defensible version of the idea, if it is ever wanted, is `/init-method` **reporting** what
a repo that publishes lacks. Reporting is not scaffolding and not a rule, and it is not built
now because no incident asks for it.

## Consequences

- This repo takes on a release-time obligation it did not have: a tag now makes `CHANGELOG.md`
  stale, and CI goes red until it is regenerated and committed. That is deliberate — the whole
  point of a generated document is that drift is loud rather than discovered by a reader.
- `CHANGELOG.md` covers `v0.1.2`, `v0.2.0` and `v0.3.0` on landing. `0.4.0` is committed but
  untagged and therefore absent, and appears when it is tagged at publish time. The first real
  exercise of `docs/releasing.md` is the release that follows this decision.
- The retroactive tags are an approximation and are marked as such in their own messages. No
  later reader can mistake them for observed publish states, which is the only property that
  matters about a record that cannot be reconstructed exactly.
- Consumers of the method get nothing from this decision, by design. If that ever changes it
  changes with an incident attached, as a superseding ADR.
