# Ledger

The single mutable file in this repo (ADR-0001). Everything else is immutable or
generated. Open work, deferrals, and known defects all live here — there is no second
tracking file, because two files require manual sync and manual sync does not happen.

**Closing an item means deleting its line here.** Do not annotate the source ADR; the
ADR's claim ("at the time of this decision we deferred X") stays true forever and needs
no update. Single writer, one direction.

Format: `- [type] description (ADR-NNNN)` — type is `bug` | `feature` | `deferred` |
`audit`. Cite the source ADR where one exists; rule 8 checks that the citation resolves.

## Open

- [feature] l33t-mmorpg is not method-migrated: no `adr/` tree, no `LEDGER.md` (it still
  has `ISSUES.md`), no `scripts/`. Its new `CLAUDE.md` therefore omits the taxonomy,
  enforcement and verification sections — stating rules about files that do not exist
  would make the file false on arrival. Migrate the repo, then add them (ADR-0001).
- [deferred] Rule 9 (bare `ADR NNNN` prose references) ships as a warning, not an error —
  567 legacy references exist in boxel and some point at external context. Revisit
  promoting it to an error once the corpus is migrated and the true failure rate is
  known (ADR-0003). Note rule 9 cannot distinguish a typo from a deliberate reference to
  *another repo's* ADR — this repo's own ADRs trip it six times citing boxel and gamatar
  ids. Promoting it to an error needs a way to mark cross-repo citations first. **Rule 8 has the
  same gap and is already an error**: a ledger line citing another repo's decision fails,
  so such citations must be written as paths (`boxel/adr/0134`) until the marking exists.
- [deferred] `slices/` directory and the ADR/slice split apply to **new** documents only.
  boxel's existing 130 keep `type:` in frontmatter instead — a physical split would
  rewrite 567 cross-references for no additional query power (ADR-0002).
- [feature] gamatar has no verification harness at all despite the same untestable-render
  problem. Seed `scripts/` and a first verify script for the renderer (ADR-0004).
- [audit] Reference/technique knowledge has no home in the immutable/generated/mutable
  taxonomy. boxel's `mc-texture-color-source` (how to fetch real MC textures and compute
  authoritative colors) is neither a decision, a worklist item, nor a codebase invariant.
  Candidate resolution: treat such docs as **live docs under the README precedent** (a
  `docs/` tree, updated in the same change as the code they describe) rather than a new
  mutable governance kind — and split the *decision* ("derive colors from real textures")
  into an ADR from the *procedure*. This amends the governing taxonomy, so it is an
  ADR-0001 amendment/supersession, not a filing tweak (ADR-0001). **The candidate has
  now been tried in the field**: boxel's `docs/harness-notes.md` (2026-07-22) is exactly
  such a live doc — the verification rig's operating mechanics, harvested out of assistant
  memory, cited from its `CLAUDE.md` §3 and governed by nothing else. Decide the taxonomy
  question on that evidence rather than in the abstract.
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
