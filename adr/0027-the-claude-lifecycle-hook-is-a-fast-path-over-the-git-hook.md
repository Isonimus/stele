---
id: '0027'
title: "The Claude Code lifecycle hook is a fast path over the git hook, never an invariant's only enforcement"
type: architecture
status: accepted
date: 2026-09-09
supersedes: []
superseded_by: []
---

# ADR-0027 — The Claude lifecycle hook is a fast path, not a second floor

## Context

Claude Code exposes a lifecycle of some thirty hook events, configurable per project in a
committable file. This kit uses none of them. `.claude/` holds six slash commands and a
*git* pre-commit hook; the assistant's own lifecycle is untouched surface. Three measurements
taken today say what that costs.

**First, half the method runs on memory.** `lint-docs.mjs` is executable and automatic: the
git hook runs it against the commit (ADR-0003, ADR-0018) and CI runs it again. But the four
questions, the mutation check and the adversarial pass all run because `/wrap-up` was
invoked, and `/wrap-up` is invoked because somebody remembered to type it. That is ADR-0003's
own thesis failing one level up — the invariants are executable, the decision to execute them
is not. ADR-0003 was written because five supersession defects sat undetected in boxel for
weeks; the same argument applies unchanged to a gate whose trigger is a habit.

**Second, most of the law is not in context.** Only `CLAUDE.md` files auto-load: 6,682 bytes
here plus 7,300 in the operator's global file, about 3.5k tokens, and neither uses an
`@`-import. So `docs/quality-bar.md` (~2.7k tokens), `LEDGER.md` (~3.1k) and `adr/INDEX.md`
(~0.7k) — the standard this repo ships, its entire open worklist, and the map of its corpus —
are **absent from an ordinary turn**. CLAUDE.md §3 cedes the quality bar to a file and cites
it rather than copying it, which was right; what nobody checked is whether anything ever opens
it. ADR-0024 feared the bar would drift into a lossy restatement. The measured failure is
worse and quieter: on a turn where no one runs `/wrap-up` or greps for it, the bar is not
drifted, it is simply not there.

**Third, this is the mistake ADR-0025 already named.** The established solution is the
default, and a hand-rolled replacement is argued in writing with a named cost and a measured
build. A slash command invoked from memory is a hand-rolled replacement for a lifecycle
event, and no record prices it. Read honestly, ADR-0025 indicts the present arrangement
rather than defending it — which is the reason this ADR exists and the reason it is not a
supersession: ADR-0003's claim was never wrong, it was under-applied.

Against that, one property of the git hook must not be traded away. It is client-agnostic.
It fires for a commit made by a human in an editor, by a script, by CI, by a different
assistant, or by an assistant with hooks disabled. A rule that lives in `.claude/settings.json`
fires for exactly one client on exactly one configuration — and it is invisible to `--check`,
which reconciles vendored files, not settings. Enforcement moved there would look stronger
and be weaker, in the specific way this repo already documented once when R14 and R15 shipped
dead inside the hook for a whole release because they read outside `READ_SCOPE` (ADR-0021) and
reported green.

The documented contract bounds what the layer can usefully do, and the limits are not
symmetric:

- `SessionStart` stdout **is** injected into the model's context. It fires on `startup`,
  `resume`, `clear`, `compact` and `fork` — so its payload is paid again after every
  compaction, not once per day.
- `UserPromptSubmit` stdout is injected too, which means it is paid on every single turn.
- `PostToolUse` **cannot block**, and its stdout is *not* injected — it goes to a debug log.
  The only channel back to the model is exit code 2, which shows **stderr**.
- `Stop` exit 2 prevents the turn from ending and continues the conversation.

Two facts settle how an install must behave. Hooks live in `~/.claude/settings.json` (user),
`.claude/settings.json` (project, committable) and `.claude/settings.local.json` (gitignored),
and *all* matching hooks for an event run — in parallel — with a handler defined in two
settings files running once. So a project entry does not displace a user entry: this
operator's machine already dispatches eleven events into one external handler, and a
project-level hook lands beside it. There is no slot to win, which is a friendlier situation
than ADR-0008 faced. What *can* be owned is the file: a repo may already keep permissions and
hooks of its own in `.claude/settings.json`, and that is ADR-0008's problem moved from a hook
file to a JSON key.

## Decision

**1. The git hook and CI remain the floor. No invariant is enforced only by a Claude Code
hook.** Anything that must hold gets a rule in `lint-docs.mjs`, reading inside `READ_SCOPE`
(ADR-0021), running from the pre-commit hook against the commit (ADR-0018). A settings entry
may only invoke a check that already exists and already runs there. If a thing is worth a
Claude hook and cannot be expressed as a linter rule, say so out loud as CLAUDE.md §2
requires — do not smuggle it into a config as though that were enforcement.

**2. The layer does exactly two jobs, and both are named.**

- **Earlier, not extra.** A `PostToolUse` hook matching `Edit|Write` re-runs the *same*
  linter when the edited path is inside the checked scope, writes findings to stderr and
  exits 2, so they reach the model in the turn that produced them instead of at commit time
  hours later. One checker, one rule list, one severity table. A hook that reimplements a
  rule is the defect this decision exists to prevent.
- **Loaded, not merely cited.** A `SessionStart` hook injects what CLAUDE.md points at and
  nothing opens. It injects a **digest, not the files**: the first line of each open ledger
  item is 1,350 bytes for all fifteen (~340 tokens) against 3,145 for `LEDGER.md` whole.

**3. The injected payload is capped and the cap is stated in the script.** Because
`SessionStart` fires on compaction and resume, its cost recurs; the budget is ~1k tokens, and
anything larger becomes a pointer to a path rather than its content. A number in the script
with the reason beside it (ADR-0012) is what keeps this from growing into the 6.6k-token
preamble the measurement above was complaining about.

**4. Installing settings is additive, marked, idempotent, and refuses what it cannot read.**
This is ADR-0008 applied to a JSON key. The installer merges into `hooks.<Event>[]`; it
identifies its own entries by the vendored script path they invoke, exactly as
`FRAMEWORK_HOOK_ID` identifies the composed pre-commit block; it rewrites only entries it
recognises as its own and never touches another; and on JSON it cannot parse it **refuses and
reports** rather than rewriting — the same choice `/init-method` already makes when it will
not install a hook onto a red corpus (ADR-0006).

**5. It is opt-in, not part of the default install.** A vendored document changes what an
assistant reads when asked; a settings hook changes what runs on every session and every tool
call in that repo, including sessions about something else entirely. That blast radius earns
an explicit flag. This is a narrower carve-out than ADR-0026's — release engineering stopped
here because consumers do not publish, whereas every consumer has this exact enforcement gap,
so the layer is offered rather than withheld.

**Rejected, so the next fresh reader need not re-raise them (ADR-0012):**

- **`Stop` exit 2 to force `/wrap-up`.** It turns a judgement call into a gate the model
  cannot clear without doing work the operator may not have asked for, and a hook that
  mis-decides re-enters the turn indefinitely. The trigger conditions for the adversarial
  pass are prose about risk, not a predicate; a gate needs a predicate.
- **`PreToolUse` deny on an edit to an immutable body.** Tempting and wrong:
  `check-immutable.mjs` compares two trees, and a `PreToolUse` hook sees one pending edit
  against a dirty working tree. It would have to reimplement the subsequence test on the
  wrong inputs and would fire on the legitimate append that ADR-0019 exists to permit.
- **`UserPromptSubmit` as the carrier for the quality bar.** It pays the full cost on every
  turn to fix a problem that recurs per session.
- **Moving any rule out of the linter into a hook script**, for the reason in decision 1.

## Consequences

Two of this kit's stated properties survive intact, and that is the point of the boundary: a
repo with the hook layer switched off is enforced exactly as it is today, and a repo with it
switched on is enforced by the same rules, sooner. Nothing becomes checkable only for one
client, and nothing about the layer can silently become the only thing holding a rule up —
if it did, deleting `.claude/settings.json` would turn the corpus green while broken, which
is the failure mode ADR-0021 was written after.

The cost is a third install surface with its own reconciliation problem. `--check` compares
vendored files byte-for-byte; a merged JSON key cannot be compared that way, because a repo's
own hooks legitimately sit beside ours in the same array. Recognising our entries by the
script path they invoke is what makes the merge decidable, and it is weaker than a hash: a
consumer who edits our entry in place keeps the edit, the way an adapted command does
(ADR-0023). That is a deliberate consequence of choosing merge over ownership, not an
oversight.

What is **not** decided here is anything about the build. No hook script exists, no event is
wired, and the mechanism above is read off the documented contract rather than measured — so
the first build step is to prove, in a scratch repo, that a project-level `PostToolUse` entry
fires beside the user-level handler and that its exit-2 stderr actually reaches the model.
Nor is the delivery vehicle settled: whether this ships as vendored settings or as a Claude
Code plugin is a distribution question of the same shape as ADR-0015 and ADR-0023, and it is
open in `LEDGER.md` rather than answered here. This ADR fixes the boundary before any of that
is built, which is the order ADR-0025 asks for.
