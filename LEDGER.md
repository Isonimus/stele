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

- [feature] `scripts/build-index.mjs` — generate `adr/INDEX.md` (supersession graph,
  architecture-vs-slice view) from frontmatter (ADR-0001).
- [feature] `/init-method` bootstrap so the kit installs into any git repo (ADR-0003).
- [deferred] Rule 9 (bare `ADR NNNN` prose references) ships as a warning, not an error —
  567 legacy references exist in boxel and some point at external context. Revisit
  promoting it to an error once the corpus is migrated and the true failure rate is
  known (ADR-0003). Note rule 9 cannot distinguish a typo from a deliberate reference to
  *another repo's* ADR — this repo's own ADRs trip it six times citing boxel and gamatar
  ids. Promoting it to an error needs a way to mark cross-repo citations first.
- [deferred] `slices/` directory and the ADR/slice split apply to **new** documents only.
  boxel's existing 130 keep `type:` in frontmatter instead — a physical split would
  rewrite 567 cross-references for no additional query power (ADR-0002).
- [feature] Migrate boxel's `mob-egg-rule` and `block-detail-default` out of assistant
  memory into its `CLAUDE.md` §5 invariants table, keeping the GLASS exception and its
  reason. Lands with Phase 3 (ADR-0004).
- [feature] Wire boxel's eleven unwired `scripts/*-verify.mjs` into `package.json` and run
  their console-error half in CI. They currently run never (ADR-0004).
- [feature] gamatar has no verification harness at all despite the same untestable-render
  problem. Seed `scripts/` and a first verify script for the renderer (ADR-0004).
- [audit] ~12 boxel ADRs are `type: batch` (several unrelated features in one document)
  and cannot map 1:1 to a work item. Decide whether batches should be retired as a
  practice going forward, or remain a legitimate document kind (ADR-0002).
- [audit] 36 boxel ADRs carry dated `## Amendment` blocks. The `amended` status covers
  them, but whether an amendment should instead be a superseding ADR is unresolved
  (ADR-0002).

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR or slice doc that fixed the problem, not here — this file is a worklist, not a
changelog.
