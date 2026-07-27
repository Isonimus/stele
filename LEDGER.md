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
- [deferred] Source-side citation resolve-check: a rule that reads `ADR-NNNN` tokens in
  source comments and fails when the citation does not resolve, the code-site sibling of
  rule 8. Blocked on settling a repo-specific file scope — what counts as source, what is
  vendored/generated and skipped — which the document tree does not have. Decide the scope,
  then ship the rule; until then the presence half is review-only via `/wrap-up` (ADR-0012).
- [feature] Build `scripts/gen-capability-index.mjs`: a best-effort, zero-dependency scanner
  that reads exported functions/classes/constants and emits `docs/CAPABILITIES.md` (a
  Generated doc), so an assistant can grep what reusable logic exists before writing its own.
  Opt-in by wiring into `package.json`; design settled, build outstanding — needs the export
  scanner and its regression fixtures (ADR-0013).
- [deferred] Decide whether the adversarial pass earns a `## Adversarial review` required
  section on slices (rule 14, the sibling of R12/R13). Deliberately not shipped with the ADR:
  this repo's precedent is that a rule follows the incident, and the practice has zero runs
  behind it. Revisit after several triggered passes, citing what they found and what the
  finding-to-noise ratio actually was — if it earns a rule, that rule is its own ADR
  (ADR-0017).
- [bug] The pre-commit hook checks the **working tree**, not the commit. Reproduced: stage a
  broken ADR, fix it without staging the fix — hook reports 0 errors, the commit lands red
  (R6). Same route lets a regenerated-but-unstaged `adr/INDEX.md` pass `--check` while HEAD
  keeps the stale one. CI is the backstop, so it leaks rather than escapes. The composed
  install is already correct — the `pre-commit` framework stashes unstaged changes — so the
  two install shapes ADR-0008 kept equivalent are not (ADR-0003).
- [feature] ADR body immutability is enforced by nothing. Reproduced: rewrote the body of a
  committed ADR to say the opposite of its decision, hook green. Not an R-rule — `lint(root)`
  is a pure function over one directory and must stay one — so it is a sibling of
  `build-index --check`, diffing staged `adr|slices/*.md` against `HEAD:<path>` below the
  closing `---`. Needs a decided escape hatch for genuine typo fixes, which makes it an ADR
  (ADR-0010).
- [bug] Citations resolve only in `LEDGER.md` (R8) and doc bodies (R9). The ~40 `ADR-NNNN`
  references in `CLAUDE.md`, `README.md`, `templates/CLAUDE.md` and `.claude/commands/*.md`,
  and the README's `](adr/….md)` path links, are unchecked. All resolve today — this is
  prevention. `CLAUDE.md` is read at the start of every session, so a citation rotting there
  routes every future session to a decision that does not exist (ADR-0009).
- [bug] `date` is unvalidated but load-bearing: it picks R12/R13 severity by string compare
  against `SLICE_SECTIONS_SINCE`. `date: sometime last tuesday` lints clean today only
  because `'s' > '2'`. A new slice with copy-pasted frontmatter dated before the cutoff grades
  as legacy and ships with no Definition of Done on a green build (ADR-0011).
- [bug] An ADR may supersede itself: `supersedes: [0002]` + `superseded_by: [0002]` +
  `status: superseded` lints clean. Two lines in the supersession rule (ADR-0003).
- [bug] `sectionText` does not skip fenced code blocks, so a `## Verification` quoted inside a
  code sample satisfies R12. Reasoned from the regex, not reproduced (ADR-0011).
- [audit] 36 boxel ADRs carry dated `## Amendment` blocks. The `amended` status covers
  them, but whether an amendment should instead be a superseding ADR is unresolved
  (ADR-0002).

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR or slice doc that fixed the problem, not here — this file is a worklist, not a
changelog.
