# Contributing to Stele

Thanks for your interest. Stele is a zero-dependency ADR workflow that keeps a
codebase's decisions, work, and definition of done honest — enforced by a git hook and
CI, not by anyone remembering to. **This repo dogfoods its own method:** its rules are its
own ADRs, and its linter checks itself. Contributing here means working the way the method
prescribes — which is the best way to understand it.

## Prerequisites

- **Node.js ≥ 20.** That is the entire toolchain.
- **git.**

There is nothing to install. Stele has **zero dependencies** — it is Node's standard
library only — so there is no `npm install` step, no lockfile, and no build.

```bash
git clone git@github.com:Isonimus/stele.git
cd stele
npm test          # the regression suite — every rule has a fixture
npm run lint      # the invariant checker (what the pre-commit hook and CI run)
npm run index     # regenerate adr/INDEX.md from frontmatter
```

## The one rule that matters

**Stele enforces its own method, so your change follows it too.** The slash commands
(`/adr`, `/slice`, `/wrap-up`, …) are Claude Code conveniences that scaffold the right
file; if you don't use Claude Code, author the same artifact by hand — the shape is what
matters, not the tool.

- **Recording a decision** → a new **ADR** in `adr/` (`/adr`). An accepted ADR is
  **immutable**: its body prose is never edited, only its status/supersession fields. If a
  past decision was wrong, do **not** edit it — write a **new ADR that supersedes it** and
  says *why the old reasoning was wrong*. That record is the most valuable thing this
  workflow produces (ADR-0001, ADR-0010).
- **Building a feature** → a **slice** in `adr/` (`/slice`), written *before* you code:
  `## Goal`, a `## Definition of Done` as Given/When/Then scenarios (ADR-0011), a
  `## Design` that states **what existing code you considered** — searched, reused, or
  deliberately did not reuse and why (ADR-0013), and a `## Verification` naming the tests.
  Freeze `## As built` to past tense at merge.
- **Deferring something** — a follow-up, a known bug, a TODO → **one line in `LEDGER.md`**
  citing the relevant ADR. The ledger is the only place deferrals live; a TODO in code or
  in your head is not tracked.
- **Writing code a later operator might try to "fix"** — a deliberate deviation, a
  non-obvious constraint → **cite the governing ADR in a comment at that site** (ADR-0012),
  so the choice announces it is on purpose where the edit happens.
- **Before you finish**, run `/wrap-up` (or its checklist by hand): run the gate, then ask
  the four questions — did this change a user/dev-facing feature (update `README.md`), make
  a decision (write an ADR), defer something (add a ledger line), or write code someone
  would try to fix (cite the ADR at the site)?

## The bar

Every PR must clear the same gate the hook and CI enforce:

- **`npm run lint` is green — 0 errors.** Legacy R9 warnings are acceptable; errors are not.
- **`npm run index` is regenerated and staged** if you added or changed any ADR/slice. A
  stale `adr/INDEX.md` is drift by another name.
- **`npm test` passes, and every new or changed rule ships a regression fixture** in
  `test/`. A test that passes before your change proves nothing — it must fail before the
  fix and pass after. Test observable behaviour, not internals.
- **Zero new dependencies.** The zero-dependency guarantee is what lets the kit drop into
  any repo regardless of package manager (see the README's Design principles). A PR that
  adds a runtime or build dependency will be declined unless an ADR justifies the exception
  — in this workflow, a justified violation *is* a decision, recorded as an ADR.

There is deliberately **no `CHANGELOG.md`**: the immutable ADRs, the generated index, and
the single-writer ledger mean the git log *is* the history (README, Design principles).
Please don't add one — a hand-maintained changelog is exactly the drift-prone artifact the
method argues against; GitHub Releases cover consumer-facing version notes.

## Proposing a change

- **Open an issue first** for anything that adds a lint rule, changes a document kind, or
  touches the zero-dependency guarantee — those are decisions worth discussing before code.
- **PRs are welcome directly** for bug fixes, new regression fixtures, docs, and tooling.
- Fill in the pull-request template; it is the `/wrap-up` gate in checkbox form.

## Commits

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Explain WHY, not WHAT** — the diff already shows what changed.
- **Atomic and coherent** — one logical change per commit.
