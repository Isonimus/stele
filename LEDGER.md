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
- [deferred] Three bare cross-repo citations still warn under R9 — `ADR 0122` in ADR-0003,
  `ADR 0121` and `ADR 0101` in ADR-0004 — and all three name boxel's corpus, so ADR-0009
  requires `boxel:ADR-NNNN`. They sit in immutable bodies, so the source line cannot be
  corrected (ADR-0019). Decided 2026-09-09: the correction is an **inline marker on the line
  following the claim**, machine-read, so the warning clears rather than persisting as a
  floor that hides a genuine fourth. That needs R9 to parse the marker and suppress the
  corrected id for that document, plus fixtures and a mutant. Until it ships the floor is 3,
  and `/audit` cannot tell a new warning from a standing one (ADR-0009, ADR-0019).
- [feature] Build the Claude Code hook layer whose boundary ADR-0027 fixes: a `PostToolUse`
  script re-running the linter on `Edit|Write` inside the checked scope (stderr, exit 2), a
  `SessionStart` digest under a ~1k-token cap, and an opt-in installer step that merges into
  `hooks.<Event>[]` idempotently and refuses unparseable JSON. The measurement the ADR made a
  precondition **is done** (2026-09-09, three `claude -p` runs against scratch repos, client
  2.1.236) and the mechanism holds, so the design stands and the build can start:
  - A project-scope `PostToolUse` entry fires *beside* the user-scope one, and both matchers
    match the same call: a repo declaring `Edit|Write` and `*` logged two firings per `Write`
    and per `Edit`. A `SessionStart` run showed two `hook_started` events where the project
    declared one and the operator's user settings declared one, against a control run that
    declared none and showed exactly one. Nothing displaces anything, so ADR-0008's
    fight-for-the-slot problem does not arise for a JSON key — only the *file* is contested.
  - Exit-2 stderr does reach the model, as a transcript `attachment` of type
    `hook_blocking_error` carrying the text verbatim under `hookName: "PostToolUse:Write"`.
  - `SessionStart` stdout is injected, and re-fires on resume (`source: "resume"`) re-injecting
    the whole payload — which is what makes ADR-0027's token cap a cap on a *recurring* cost.
  - **New fact the ADR does not contain, and the sharpest reason for its boundary:** that
    feedback is advisory, not a gate. The tool result stays `is_error: false` and the write
    stands; whether anything follows is the model's judgement. Given a legitimate check
    (a missing required frontmatter key) the model complied silently and the re-run went
    green — the fast path works. Given a demand that conflicted with the user's instruction it
    refused, reasoning in the open: *"This appears to be a test hook that's trying to get me to
    violate the user's explicit instruction."* Correct behaviour, and exactly why an invariant
    cannot live here: ADR-0027 argued that from client-agnosticism, and in-client discretion is
    the second, independent reason.
  - Testability constraint for the build: `PostToolUse` hook activity is **invisible** to
    `--output-format stream-json` (only `SessionStart` surfaces there), so a test asserts on the
    hook script's own side effects or reads the session transcript, never on the stream.
  - Built 2026-09-09: `.claude/hooks/post-tool-lint.mjs` (asks the linter's own `inReadScope`
    rather than restating the list) and `.claude/hooks/session-digest.mjs` (1,869 bytes / ~470
    tokens against a 4,000-byte cap, where the whole ledger is 15,691). Wired for this repo in
    `.claude/settings.json` on 2026-09-10 and verified live — both `SessionStart` entries fire,
    the operator's and this repo's, and the digest reaches the session. An adversarial pass
    (ADR-0017) found and fixed two defects in them first: the cap hid the edit's own error on a
    corpus deeper than ten errors, and the digest dropped an item that fitted and then blamed
    the budget for it.
  - **What is left is the installer half only**, and it still waits on the delivery decision
    below. `.claude/settings.json` is deliberately absent from `package.json` `files`, so
    nothing reaches a consumer repo until that step exists (ADR-0027 clause 5).
- [decision] The hook layer is delivered as a vendored `.claude/settings.json` merged by
  `/init-method` — decided 2026-09-10, and **provisional on purpose.** The alternative is a
  Claude Code plugin carrying `hooks/hooks.json` plus the commands; a plugin is the platform's
  own answer and therefore ADR-0025's default, but it moves the commands out of the repo tree
  and takes the per-repo adaptation of ADR-0023 with them, which is a real loss since a Python
  repo cutting the rule about `any` is use, not drift. **This is not yet an ADR, and cannot be
  one as it stands:** ADR-0025 requires a departure from the established solution to be argued
  with a named cost *and a measured build*, and no plugin has been built or measured. Either
  spend an hour proving what a plugin actually costs in adaptation, or write the ADR admitting
  the choice was made on reasoning alone and say so — never a silent exception (ADR-0027,
  ADR-0015, ADR-0023, ADR-0025).
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
- [bug] R8/R14 and the immutable-body check silently skip **every** qualified citation in a
  repo with no `package.json`. `repoName()` in `scripts/lint-docs.mjs` returns null without a
  manifest, and `localCitations` then yields only unqualified ids, so a self-qualified
  citation with an id that does not exist passes green. Measured in `dupin` 2026-09-10
  (C++/PlatformIO firmware, no manifest by decision, cites `dupin:ADR-0002`): the qualifier
  ADR-0020 introduced to keep vendored citations checkable is exactly what stops being
  checked, in the repos that most need the qualifier. Every fallback has its own cost worth
  arguing on its own terms — a git-remote basename needs a remote, a directory basename means
  a clone renamed on disk stops recognising itself, an explicit field needs somewhere to live
  in a repo that declined a manifest — so this is a citation-rule decision, not a harness one.
  Do not fold it into the R11 item below: that one is a trap for a file that does not exist
  yet, this one is unenforced today (ADR-0009, ADR-0020).
- [bug] R11 (`harnessWiring`) enforces nothing in a repo with no `package.json` — it returns
  early on the missing manifest, so an unwired `*-verify.mjs` sitting in `scripts/` reports
  green. The ADR-0021 shape again: the rule shipped, the file it reads was never there.
  Measured in `dupin` 2026-09-10, whose single named entry point is a `Makefile`; it has no
  verify scripts today, so the hole is a trap laid for the first one — the state ADR-0004 was
  written against. It cannot be fixed downstream: `scripts/` and `.claude/hooks/` appear
  nowhere in `.claude/.stele-vendored.json`, so `--update` re-copies the linter unconditionally
  and a local edit is drift, not adaptation (ADR-0006). Design settled 2026-09-10, replacing
  the handoff brief this entry absorbs: **wired means the basename appears in a declared
  entry-point file**, whichever file that is, token-scanned whole on the same separator the npm
  branch splits on — *not* a recipe-line parser per format. A Makefile grammar misses
  `VERIFY := scripts/a-verify.mjs` used as `$(VERIFY)`, a wrong red, to buy protection against
  a basename mentioned but not run, which is rare and benign; and it buys that once per runner,
  with `justfile`, `Taskfile.yml`, `Rakefile` and `pyproject.toml` each wanting their own ten
  lines, which is the surface ADR-0025 exists to argue about. Scanning the whole file also
  collapses the "neither entry-point file exists" case into the rule itself. Keep the
  `pkg.scripts` branch as it is: it is more precise than a whole-file scan of JSON and already
  covered. Both scope lists gain the entry-point filenames — `READ_SCOPE` and the `git archive`
  list in `.claude/hooks/pre-commit`, held equal by `test/read-set.test.mjs` — or the hook
  grades a file it never extracted (ADR-0021, ADR-0018); tests come from the spec, not the
  implementation (ADR-0024). Carrying it downstream needs `--update`, which also clears two
  vendored fixes `dupin` is behind on, after which `dupin` flips its invariant 2 from pending
  to a `verified_by` declaration. Related, found while measuring: `dupin`'s vendored comments
  in both files promise a `test/read-set.test.mjs` that does not exist there and could not run
  if it did (its `test/` holds Unity suites) — a vendored comment claiming a guard the
  installed repo lacks is the same class of defect as the inert rule (ADR-0004).
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
  `.claude/hooks/pre-commit` joined the same list on 2026-09-09: it carried seven bare
  citations of its own, in the comments an operator reads precisely when a commit is
  blocked, and it sits in the installer's byte-identical `VENDORED` set — so until each repo
  updates, `--check` reports it as differing, correctly. The directory had been outside the
  vendored-citation guard entirely, which is why the defect the guard's own header describes
  was sitting in the hook's.
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

Entries move out of "Open" by deletion. A narrative of what merely *happened* belongs in
the git log; what belongs on an open item is evidence it cannot be re-derived later —
a measured result, a reproduction, a finding-to-noise count the eventual decision turns
on. Keep that with the item while it is open, and move it into the ADR or slice that
closes it. What this file is not is a record of completed work.
