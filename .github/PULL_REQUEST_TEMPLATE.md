<!--
Thanks for contributing to Stele! Skim CONTRIBUTING.md first if you haven't — this
template is the /wrap-up gate in checkbox form. Stele dogfoods its own method, so a PR
follows the same rules the method prescribes.
-->

## Summary

<!-- 1–3 bullets on WHAT changed and WHY. Link the issue if there is one. -->

-

## Type of change

<!-- Tick all that apply. -->

- [ ] Decision record (new or superseding **ADR** in `adr/`)
- [ ] Feature (a **slice**: Goal, Definition of Done, Design, Verification)
- [ ] Bug fix
- [ ] Docs (README / CONTRIBUTING / a live doc)
- [ ] Test fixture / coverage
- [ ] Tooling (linter, index builder, init)

## The gate — must be green

<!-- Exactly what the pre-commit hook and CI enforce. -->

- [ ] `npm run lint` — **0 errors** (legacy R9 warnings are acceptable)
- [ ] `npm run index` regenerated and staged, if any ADR/slice changed
- [ ] `npm test` passes, and every new/changed rule has a regression fixture that **fails
      before the change and passes after**
- [ ] **Zero new dependencies** (or an ADR justifies the exception)

## The four questions (/wrap-up)

<!-- Tick each that applies; N/A the rest. -->

- [ ] **Decision** later work must obey → recorded as a new ADR (immutable; a change of
      mind is a *superseding* ADR, never an edit)
- [ ] **User/dev-facing** change → `README.md` updated in this same PR
- [ ] **Deferred** something → one line added to `LEDGER.md` citing the relevant ADR
- [ ] **Wrote code a later operator might "fix"** → governing ADR cited in a comment at
      that site (ADR-0012)
