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
- [feature] A ledger rule for **section loss**: fail when a commit removes a `###`/`####`
  heading from `LEDGER.md`. Every existing rule reads the ledger's *content* — rule 8
  resolves citations — and none notices the file getting smaller, so the one tracker in a
  repo can be silently truncated by a commit that greens every check. Incident (the
  precedent this repo requires before a rule): boxel `1c156b9` deleted its entire
  `### Mobs & AI` section, 78 lines of unrelated worklist, while rewriting one entry two
  sections below; it survived pre-commit, review and a push, and was found nine commits
  later only by running `git log -S` on a line that looked new. Closing an item deletes a
  **bullet**, never a heading, which is what makes the heading set a sound invariant to
  guard — the one legitimate removal is a section whose last item closed, rare enough to
  carry an explicit allowance or a `--no-verify`. Cheap: the hook already reads the commit
  rather than the working tree (ADR-0018), so both sides of the comparison are in hand
  (ADR-0010).
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
  **Run 2 (2026-07-28, uncommitted ADR-0023 diff, Sonnet 5):** 2 findings, both the same
  governance defect from two angles, reproduced and fixed — the draft reversed ADR-0007 on
  whether a command difference may fail `--check` while filing itself as an unrelated new
  decision, leaving two accepted ADRs asserting contradictory permanent claims. Fixed by
  making it a supersession. Seven probes were **rejected** with reasons (corrupt-record
  recovery, orphaned record entries, READ_SCOPE interaction, vendored citation
  qualification, `--force` validation, dry-run suppression, mutant coverage), so the
  finding-to-noise ratio was 2 real to 7 correctly-dismissed — and the dismissals were
  cheap because it reproduced each one. Notably the author had *prompted* the reviewer to
  check the exact question it caught, and had still shipped the draft: the value was not
  novel insight but an unmotivated reader acting on it.
  One pre-existing crash it surfaced and correctly ruled out of scope has since been fixed
  (0.4.0), which is why no separate entry for it remains below.
  **Run 3 (2026-07-30, uncommitted ADR-0024 diff, Sonnet 5, correctness brief):** **zero
  findings.** The reviewer traced the five-state classifier over the new adaptable-doc path,
  installed into a scratch repo and committed through the resulting hook, checked the
  `docs/` read-scope against both the linter and the hook, and independently confirmed each
  new test fails when the production change is reverted. It reported that it could not
  construct a state producing a wrong output, a crash, or a corrupt record — a null result,
  reported as one rather than padded. Nothing to reject, so no code-site notes were needed.
  Three runs now exist (2 real + 2 real + 0, against 7 correctly-dismissed), so the
  precondition on this item is met and the rule question is decidable.
  **Run 4 (2026-07-31, uncommitted 0.4.0 diff, Sonnet 5, correctness brief):** 2 findings,
  both reproduced, both fixed. The first is the sharpest result yet: the change under review
  *was* a crash fix — a refusal replacing an `EISDIR` stack trace — and the reviewer found the
  refusal itself threw a raw `ENOTDIR` when an ancestor of a managed path was a file, because
  `throwIfNoEntry: false` suppresses `ENOENT` and nothing else. The same defect, reintroduced
  one level up, inside its own fix, in two modes that write nothing and are advertised as safe
  to run. The second was a pre-existing `EACCES` on an unreadable managed file, out of the
  change's scope but inside the new function's stated claim, so it was fixed rather than
  logged. Zero rejected, so no code-site notes were needed. First run under the
  no-sub-delegation instruction this same commit adds to the brief; it read its own files,
  reproduced both findings with commands, and returned in one pass.
  **Run 5 (2026-08-01, uncommitted ADR-0026 diff, Sonnet 5, correctness brief):** 3 findings,
  all reproduced, all fixed — the highest count yet, and all three in the git-reading half of a
  new generator whose pure half was already covered by tests and two mutants. A lightweight tag
  was published as a release, contradicting the script's own header; an annotated tag on a blob
  crashed with `fatal: ambiguous argument ''` and a stack trace; and a tagged branch merged in
  later had its commits listed under two releases, which `--check` could never notice because it
  compares the file against the same generator that produced it. Zero rejected. The pattern
  across runs 4 and 5 is worth naming: both changes were reviewed *because* they added a check,
  and in both the defect was in the checking code rather than in what it checked.
- [bug] Every repo already running an install carries the twenty misrouted bare citations in
  its vendored `.claude/commands/*.md` and `CLAUDE.md` — gamatar and boxel both. Nothing in
  those repos can detect it, so each needs `/init-method --update` and a re-read of its
  scaffolded `CLAUDE.md`, which `--update` does not overwrite (ADR-0020).
- [bug] The install preflight checks read permission only, so a managed file that is
  readable but not writable passes it and then crashes with a bare `EACCES` from
  `writeFileSync` — the same stack-trace-instead-of-a-path defect the preflight exists to
  remove, on the write side. Not fixed with the read side because refusing on write
  permission would reject a read-only vendored file that already matches the toolkit and
  needs no write at all, which is a legitimate install; the fix is to check writability only
  where a write is actually about to happen (ADR-0006).
- [decision] `global/CLAUDE.md` and the shipped `docs/quality-bar.md` now carry the same
  rules twice. The shipped bar is the method's standard; the global file is the operator's
  personal one and governs repos with no install, so ADR-0024 deliberately left it alone
  rather than change a machine-level file on its own initiative. Decide whether the personal
  file shrinks to identity and routing and cedes the bar to the method, or stays whole and
  the two are knowingly parallel. Neither is checkable, so whichever is chosen gets written
  down (ADR-0024, ADR-0005).
- [deferred] Three of this repo's own reinventions predate the rule that now governs them and
  do not satisfy it: the doc linter (`adr-tools`, `log4brains`), the index generator, and the
  vendor/update mechanism (a package manager). ADR-0022 satisfies the rule for the mutation
  runner — a named cost plus a measured build — and no record does the same for the other three;
  the zero-dependency property is asserted in ADR-0003 but never priced against what the
  existing tools would have cost. Either write that comparison or record that the choice was
  made without one. Not fixable by asserting here that it was obviously right, which is what an
  unmeasured departure always feels like from inside (ADR-0025).
- [audit] 36 boxel ADRs carry dated `## Amendment` blocks. The `amended` status covers
  them, but whether an amendment should instead be a superseding ADR is unresolved
  (ADR-0002).

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR or slice doc that fixed the problem, not here — this file is a worklist, not a
changelog.
