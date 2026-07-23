---
id: 0014
title: Rename the method to Stele
type: architecture
status: accepted
date: 2026-07-23
supersedes: []
superseded_by: []
---

# ADR 0014 — Rename the method to Stele

## Context

`claude-method` was a working title. It names the assistant that happens to use the kit,
not the thing the kit *is* — an enforced, immutable decision record — and it dates the
project to one vendor. A durable name was wanted; the first pick, "Cairn," turned out to be
taken by a tool in the same space, so the search continued and landed on **Stele**: an
inscribed stone slab bearing law, which is precisely the metaphor — a record cut once,
standing, not editable.

The rename is not cosmetic, and that is the reason it earns an ADR rather than a quiet
find-and-replace. The repo name is load-bearing in two conventions future work and *other
repos* obey:

- **The cross-repo citation prefix.** ADR-0009 fixed the qualified form as `<repo>:ADR-NNNN`,
  with a bare `ADR NNNN` meaning "this repo." The prefix for citing *this* corpus from
  elsewhere is derived from the repo's name — so renaming the repo changes the prefix.
- **The generated hook id.** ADR-0008 composes the doc checks into a `pre-commit`-framework
  config under a fixed id, and that id is the *idempotency key* — a re-run recognises its own
  block by it. The id carried the old name (`claude-method-docs`, `claude-method-index`).

## Decision

The toolkit, CLI command, brand, and npm package are all **Stele** (the package is scoped —
see ADR-0015 for why).

- **The citation prefix for this repo becomes `stele:ADR-NNNN`.** Bare `ADR NNNN` still means
  "this repo" (ADR-0009 unchanged). The `templates/` that cite this corpus are updated to the
  new prefix. The linter needs *no* change: its `CITATION` regex detects any `<repo>:` prefix
  structurally and never hardcoded the name (ADR-0009) — which is exactly why the rename costs
  prose, not code.
- **The framework hook ids become `stele-docs` and `stele-index`.** Because the id is the
  idempotency key (ADR-0008), this is a behavioural change for a repo already scaffolded under
  the old id: a re-run no longer recognises the old block and appends a fresh one. The
  migration is a one-time manual delete of the stale `claude-method-*` block, and it is done
  *now, before wide distribution*, so the blast radius is the two repos we control (boxel,
  gamatar) rather than every future consumer. Doing it after distribution would multiply that
  radius by every install.
- **The immutable ADR bodies that used the former name are not edited.** ADR-0008 records the
  id as `claude-method-docs` and ADR-0009 illustrates the format with `claude-method:ADR-0001`.
  At the time each was written the name was correct, so both stand as true historical claims
  (ADR-0010, ADR-0001); editing them would destroy the record this workflow exists to keep.
  This ADR is the pointer that reconciles them: read those examples as the format bearing the
  then-current name, and read the current prefix and ids as the ones decided here.

## Consequences

- **No supersession.** Nothing those earlier ADRs *decided* is reversed — ADR-0009's format
  and ADR-0008's compose-by-id mechanism both stand verbatim. A rename is a new fact about the
  project's identity, not a change of mind, so it supersedes nothing and simply records what
  the name now is.
- **The rename cost is prose plus two identifiers.** The linter, the compose mechanism, and the
  vendoring all work unchanged. That is the dividend of ADR-0009's decision never to hardcode
  the repo's own name: a name-agnostic checker survives its own project being renamed.
- **The hook-id migration is a stated, bounded debt, not a silent break.** It is carried openly
  here and taken now while it is cheapest; a consumer that re-runs `/init-method` and finds a
  duplicated block has this ADR as the explanation and the one-line fix.
