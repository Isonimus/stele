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
  section on slices, a sibling of R12/R13 (R14 is now taken — ADR-0020). Deliberately not
  shipped with the ADR:
  this repo's precedent is that a rule follows the incident, and the practice has zero runs
  behind it. Revisit after several triggered passes, citing what they found and what the
  finding-to-noise ratio actually was — if it earns a rule, that rule is its own ADR
  (ADR-0017).
  **Run 1 (2026-07-27, `a165fa1~1..75d36ae`, Sonnet 5):** 2 findings, both reproduced, both
  fixed — an unhandled `RangeError` that killed the linter on `date: 2026-00-01`, and R8/R14
  reading an ordinal inside a URL as a citation, which blocked a correct commit with advice
  that cannot be followed. Zero rejected, so no code-site rejection notes were needed. Both
  sat in machinery the author had just audited by hand and published. One run, so no ratio
  yet; two more before deciding.
- [bug] Every repo already running an install carries the twenty misrouted bare citations in
  its vendored `.claude/commands/*.md` and `CLAUDE.md` — gamatar and boxel both. Nothing in
  those repos can detect it, so each needs `/init-method --update` and a re-read of its
  scaffolded `CLAUDE.md`, which `--update` does not overwrite (ADR-0020).
- [bug] `--update` overwrites the slash commands unconditionally (`force: true`), so a repo
  cannot both adapt a command (ADR-0007 grants this) and take a machinery fix — the only
  route by which fixes arrive. Both a stale copy and a local adaptation report as "differs
  from the toolkit", and nothing distinguishes them. Found in `pull_request`, which had
  adapted `/adr` correctly and would have lost it; the adaptation was adopted upstream
  instead, which is luck, not a mechanism. Decide the mechanism — a three-way merge against
  the version last vendored, or a per-file opt-out — then ship it (ADR-0007).
- [deferred] Decide whether the mutation probe becomes a standing wired script rather than a
  one-off. Measured 2026-07-27 over the pure predicates in `lint-docs.mjs` and
  `check-immutable.mjs`: ten hand-applied operators, **3 killed / 7 survived**; six survivors
  were correct-but-unpinned behaviour and now have fixtures (9/10 killed, the tenth
  equivalent). Suite runtime 2.18s, so ten mutants cost ~22s — too slow for the hook, fine
  for `/wrap-up` or CI. Against adopting a framework: Stryker breaks the zero-dependency
  principle, and the curated mutant list is the work, not the runner. Note what this does
  *not* buy — none of the three defects this repo has actually suffered (the `RangeError`,
  the URL citation, the prefix-vs-subsequence rule) would have been caught, because all
  three were missing inputs or a wrong spec, which mutation testing is blind to by
  construction. It buys regression durability, not bug discovery; decide on that basis
  (ADR-0004).
- [audit] 36 boxel ADRs carry dated `## Amendment` blocks. The `amended` status covers
  them, but whether an amendment should instead be a superseding ADR is unresolved
  (ADR-0002).

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR or slice doc that fixed the problem, not here — this file is a worklist, not a
changelog.
