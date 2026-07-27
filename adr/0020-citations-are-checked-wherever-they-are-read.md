---
id: '0020'
title: "Citations are checked wherever they are read, and vendored text names its own repo"
type: architecture
status: accepted
date: 2026-07-27
supersedes: []
superseded_by: []
---

# ADR-0020 — Citations are checked wherever they are read

## Context

Rule 8 resolves `ADR-NNNN` citations in `LEDGER.md`; rule 9 resolves them in the bodies of
`adr/` and `slices/`. Those are the only two files sets either rule opens. Everything else
a reader is routed by — `CLAUDE.md`, `README.md`, `docs/`, and the slash commands under
`.claude/commands/` — carries citations that nothing has ever checked. An audit of this
repo's machinery (2026-07-27) counted roughly forty such references.

Left there, this is a prevention argument, and a weak one: all forty resolve today. What
turned it into a defect report was pointing the check at an *installed* repo.

gamatar's vendored `/remember` command reads *"that is the exact failure ADR-0005 exists to
prevent"*. It means this repo's ADR-0005, on write-routing. gamatar:ADR-0005 is *"Faces
are canvas-generated textures, not geometry"* — and it has been superseded by its 0008. The
command file was copied verbatim (ADR-0007) into a repo where, since ADR-0009, a bare
citation means unambiguously "in this repo". Twenty references across five command files
and `templates/CLAUDE.md` were in that state.

Two things about this failure decide the shape of the fix:

1. **It lints green from both ends.** gamatar owns ids 0001–0008, so every misrouted
   reference *resolves* — to the wrong record. A resolve-check in the installed repo cannot
   see it. Confirmed by running the rule below against gamatar: zero findings.
2. **Only the source repo can detect it**, because only the source repo knows which of its
   files get copied elsewhere. The same file that is a defect here is correct in gamatar
   once gamatar adapts it and cites its own decisions bare, which ADR-0007 explicitly
   permits.

## Decision

**1. Rule 14 — citations resolve in prose read as instruction.** The linter resolves
`ADR-NNNN` in `CLAUDE.md`, `README.md`, `docs/*.md` and `.claude/commands/*.md`, on the same
terms as rule 8.

**Error severity, not rule 9's warning.** Rule 9 warns because of legacy volume — boxel's
567 bare references, some pointing at context this linter cannot open. That argument does
not transfer, and the difference is measured rather than assumed: across boxel's prose files
(43 bare references) and gamatar's (20), every reference meant to be local resolves. Both
corpora stay green under rule 14 at error severity. The blast radius that forced rule 9 to
warn simply is not present in this file set.

**2. Rule 15 — relative link targets exist**, in the same files. `](adr/0001-….md)` is a
citation wearing different clothes, and it rots the same way when a document is renamed.
Scoped to prose deliberately: a broken link inside an immutable document could not be fixed
without the in-place rewrite ADR-0019 forbids, so failing a build on one would leave the
author with no legal move.

**3. A citation qualified with this repo's own name resolves locally.** `stele:ADR-0005`
is checked inside stele and skipped inside gamatar. The repo's name is the unscoped half of
`package.json` `name`; absent or unreadable, there is no self-qualifier to recognise and
behaviour is unchanged.

This is what makes fixing the vendored files possible without creating a second blind spot.
ADR-0009 skips every qualified reference, so simply writing `stele:ADR-0005` everywhere
would put those twenty references permanently beyond checking — trading a wrong answer for
no answer. Self-qualification keeps them verified in the one corpus that can verify them.

**4. Vendored text must qualify its citations, and a test enforces it — not a rule.** The
detection has to live in the source repo (Context, point 2), and it has to know the vendored
set, which is `init-method`'s knowledge and not the linter's. So it is
`test/vendored-citations.test.mjs`: every `.md` under `.claude/commands/` and `templates/`
must be free of bare citations. A lint rule would be actively wrong shipped downstream,
failing exactly the local adaptation ADR-0007 grants.

## Consequences

- Twenty references in `.claude/commands/*.md` and `templates/CLAUDE.md` now read
  `stele:ADR-NNNN`. Every installed repo carrying the old copies is misrouted until it takes
  an `--update`; nothing in those repos will report it, because nothing there can.
- Rule 14 gives the whole `<repo>:` syntax its first enforcement. Before this, ADR-0009's
  qualifier was a convention a writer could simply forget, in the very files where
  forgetting it is most expensive.
- ADR-0009 accepted that "a typo'd repo name silently suppresses the check for that line".
  That stays true for other repos' names and is now false for our own: qualifying with our
  own name and an id we do not own is an error. The remaining exposure is a *wrong* name
  that is not ours, which is
  indistinguishable from a deliberate reference elsewhere.
- The vendored-citation test is a standing maintenance obligation of the same kind ADR-0018
  created: a new vendored directory is not covered until it is added to the list. The test
  asserts its own file count so that a bad path fails loudly rather than passing vacuously.
- Rule 15 checks existence, not correctness. A link to the wrong existing file passes, as
  does a rotted in-page anchor. Anchors were left out because resolving them means parsing
  headings in the target, which is a markdown renderer's job.
- **An illustrative number in a template is a citation.** The first draft of this change
  documented the new syntax in `templates/CLAUDE.md` using `ADR-0011` as the example, which
  scaffolded a fresh repo straight to two rule-14 errors and a refused hook — the identical
  failure ADR-0009 records as point 3, reintroduced by the commit adding the rule against it.
  Examples in vendored text use the `NNNN` placeholder, which no citation pattern matches.
  Nothing needed to be built to find this: `init-method`'s own fixture asserts a fresh
  install reports zero problems, and it failed. That assertion is the load-bearing one for
  every future rule, because *every* new rule can brick the installer this way.
- The source-side citation rule deferred in the ledger — reading `ADR-NNNN` from source
  comments (ADR-0012) — is unaffected and stays deferred. Its blocker was never the
  mechanism but deciding what counts as source, and prose files do not settle that.
