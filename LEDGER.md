# Ledger

The single mutable file in this repo (ADR-0010). Everything else is immutable or
generated. Open work, deferrals, and known defects all live here — there is no second
tracking file, because two files require manual sync and manual sync does not happen.

**Closing an item means deleting its line here.** Do not annotate the source ADR; the
ADR's claim ("at the time of this decision we deferred X") stays true forever and needs
no update. Single writer, one direction.

Format: `- [type] description (ADR-NNNN)` — type is `bug` | `feature` | `deferred` |
`audit`. Cite the source ADR where one exists; rule 8 checks that the citation resolves.

## Open

- [deferred] Rule 9 (bare `ADR NNNN` prose references) ships as a warning, not an error —
  567 legacy references exist in boxel. Revisit promoting it to an error once that corpus
  is migrated and the true failure rate is known (ADR-0003). The cross-repo obstacle is
  gone: a bare reference now means unambiguously "in this repo" (ADR-0009), so what
  remains is boxel's legacy volume alone.
- [deferred] `slices/` directory and the ADR/slice split apply to **new** documents only.
  boxel's existing 130 keep `type:` in frontmatter instead — a physical split would
  rewrite 567 cross-references for no additional query power (ADR-0002).
- [feature] gamatar still has no verify script despite the same untestable-render problem
  as boxel: nothing renders an avatar headlessly and leaves an artifact to look at. Its
  `scripts/` now exists (the vendored linter landed there 2026-07-22), so this is the
  script itself, not the scaffolding (ADR-0004).
- [feature] Lint rule: every `type: slice` ADR must contain a `## Verification` section.
  ADR-0004 requires it but nothing checks it; it is cheap and machine-checkable, unlike the
  §5 invariants the ADR admits cannot be linted. Must be **warning-only on legacy** like
  rule 9 — boxel's ~104 existing slices predate the rule and would otherwise go red
  (ADR-0004).
- [feature] `/init-method` needs a survey step to supply the architectural `type:` set.
  `migrate-adrs.mjs` now takes it as `--arch=id,id,...` (default: boxel's 22-id survey),
  proven on gamatar's all-architecture corpus — but a fresh repo still has no set, so init
  must prompt for or detect it and pass `--arch`. Without that, everything defaults to
  `slice` (ADR-0003).
- [audit] 4 boxel ADRs are `type: batch` by title (`0061, 0070, 0074, 0106`); roughly 8
  more are batches by *content* under ordinary titles, left as `slice` because no textual
  signal separates them — the same absence that motivates ADR-0002. Decide whether batch is
  retired going forward or stays a legitimate kind, and retype the content-batches by hand
  (ADR-0002).
- [audit] 36 boxel ADRs carry dated `## Amendment` blocks. The `amended` status covers
  them, but whether an amendment should instead be a superseding ADR is unresolved
  (ADR-0002).

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR or slice doc that fixed the problem, not here — this file is a worklist, not a
changelog.
