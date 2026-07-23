---
id: 0015
title: Distribution by npx-delivered vendoring, not a runtime dependency
type: architecture
status: amended
date: 2026-07-23
supersedes: []
superseded_by: []
---

# ADR 0015 — Distribution by npx-delivered vendoring, not a runtime dependency

## Context

The kit needs a way to reach a repo that is not "clone this and copy files by hand." npm is
the obvious channel, and it offers two models that look similar and are opposites:

- **Runtime dependency** — the consumer adds Stele to its `package.json`, and the linter, hook,
  and commands run out of `node_modules`.
- **Installer** — a published package whose *only* job is to vendor the kit into the target
  repo, after which the package is no longer involved.

The first is incompatible with what this project *is*. ADR-0007 vendors the linter and commands
into each repo, byte-identical and greppable, precisely so the enforcement is visible in the
repo and survives independent of any dependency graph; ADR-0003 puts the hook in the repo's own
`.git/hooks`. A version pinned in `node_modules` is invisible in review, re-resolvable out from
under the repo, and gone on a fresh install with different lockfile state — every property the
vendoring decision exists to avoid.

## Decision

Distribute Stele as an **npx-delivered installer that vendors**, never as a runtime dependency.

- **Delivery.** `npx @isonimus/stele <repo-root>` runs `init-method`, which vendors the kit into
  the target repo (dry-run by default, ADR-0006). From that point the repo owns its copy; the
  package is done. This is the `create-*` / `husky` model, not the `lodash` model.
- **Never a dependency.** Stele is not added to a consumer's `dependencies`. The linter, hook,
  and commands live *in the repo*, not in `node_modules` — the whole point of ADR-0007. A repo
  that `npm install`s Stele as a dep is using it against its design.
- **The `bin` needs no path fix.** `bin.stele → scripts/init-method.mjs`, whose entry already
  resolves its toolkit root from its own file URL rather than `cwd` (`dirname(dirname(
  fileURLToPath(import.meta.url)))`), so `npx`-from-anywhere finds the templates and vendored
  machinery with no change.
- **The package name is scoped: `@isonimus/stele`.** Not a preference — the unscoped `stele` is
  occupied by an abandoned 2018 compile-time-i18n package (single `0.0.1` release, untouched
  since), which holds the name regardless of being dead. The CLI command and brand stay `stele`,
  so the scope is invisible after the first `npx`.
- **The published surface is a whitelist** (`files`): `scripts/`, `templates/`, `global/`, the
  `.claude/` commands and hook, `README.md`, `LICENSE`. Deliberately excluded are this repo's own
  `adr/`, `LEDGER.md`, `CLAUDE.md`, and `test/` — those are Stele's *own* records and history,
  not payload a consumer vendors. The installer ships; the method's autobiography does not.
- **License: MIT** — maximally permissive, the least friction for a tool people vendor into their
  own repos.

## Consequences

- **npm is the delivery van, not the dependency graph.** This keeps ADR-0007 intact end to end:
  the thing that enforces the repo's records is in the repo, and npm only ever handed it over.
- **Preparing is not publishing.** This ADR settles the package's *shape* — name, bin, files,
  license. The act of `npm publish` is deliberately out of scope: publishing is effectively
  irreversible (a claimed name and version are squatted forever, even after an unpublish), so it
  is a manual, explicit step taken when chosen, not a consequence of this record.
- **`repository` points at `github.com/Isonimus/stele`.** The remote and the npm scope
  (`@isonimus`) share the same owner, so package and source resolve to one identity.
- **The scoped name is forced, not chosen, and costs nothing in use.** After the first `npx
  @isonimus/stele`, the installed command is `stele`; the scope shows only in the install line.

## Amendment — 2026-07-23

The claim above that "the `bin` needs no path fix" was right about *toolkit resolution* — the
`TOOLKIT` constant derives from `import.meta.url` and is unaffected by how the script is invoked
— but it missed the CLI *entry-point guard*, and the two are not the same thing.

A `bin` is invoked through a symlink (npm links `node_modules/.bin/stele` → the real
`init-method.mjs`), so at runtime `process.argv[1]` is the *symlink* path while `import.meta.url`
resolves to the *real* file. The original guard,
`import.meta.url === \`file://${process.argv[1]}\``, is therefore false under `npx`, and `main()`
never runs: the published `0.1.0` bin exited 0 and scaffolded nothing, an invisible no-op on the
one path this ADR made primary. It went undetected because every test drove the exported
`initMethod()` directly and none exercised the guard.

Fixed by resolving both sides to real paths before comparing —
`realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)` — with a regression test that
invokes the bin *through a symlink*, and a WHY comment at the site (ADR-0012) so the guard is not
"simplified" back. Shipped in `0.1.1`. The decision this ADR records — npx-delivered vendoring,
not a runtime dependency — is unchanged; only the incidental "no path fix" claim needed this
correction, which is why this is an amendment and not a superseding ADR.
