#!/usr/bin/env node
// PostToolUse fast path — re-runs this repo's own document linter the moment an edit
// lands, so a structural break surfaces in the turn that caused it instead of at
// `git commit` (stele:ADR-0027).
//
// It is a fast path and nothing else. It is NOT enforcement, and deleting this file
// weakens no invariant: every rule it can report is a rule `scripts/lint-docs.mjs`
// already holds inside `READ_SCOPE`, enforced by the git hook and CI (stele:ADR-0003,
// stele:ADR-0021). Two measured reasons this layer cannot be an invariant's only home
// (stele:ADR-0027):
//
//   1. A rule in a client config fires for one client. A colleague using anything else,
//      or CI, would see a corpus this never checked.
//   2. The feedback is advisory even in the right client. A 2026-09-09 probe against
//      Claude Code 2.1.236 showed the tool result stays `is_error: false` and the write
//      stands; whether anything follows is the model's judgement. Given a legitimate
//      finding it complied silently, and given one that conflicted with the user's
//      instruction it refused outright — correctly. So the message below is phrased as a
//      report of a repo rule with the fix attached, never as a competing instruction.
//
// Wire it with a project-scope `.claude/settings.json` entry:
//
//   "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/post-tool-lint.mjs\"" }] }]
//
// Exit 2 with the findings on stderr is the only channel that reaches the model: plain
// stdout from `PostToolUse` goes to a debug log nothing reads (measured — the event does
// not even appear in `--output-format stream-json`). Any other non-zero exit is a
// configuration fault, shown to the operator alone.

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative } from 'node:path';

import { inReadScope, lint } from '../../scripts/lint-docs.mjs';

/**
 * Most findings we will print before summarising the rest.
 *
 * A repo that installs the hook mid-migration can be a hundred errors deep, and pasting
 * all of them into the turn spends more context than the whole corpus is worth. Ten is
 * enough to see the shape of the problem; the pointer to the full report covers the rest.
 */
const MAX_FINDINGS_SHOWN = 10;

/**
 * What to do about one `PostToolUse` payload, as `{ exitCode, stderr }`.
 *
 * Separated from stdin and `process.exit` so the decision is testable against the
 * fixture repos in `test/fixtures/` rather than by spawning a process and reading a
 * pipe (`docs/quality-bar.md`: test observable behaviour).
 */
export function evaluate({ payload, root }) {
  const edited = payload?.tool_input?.file_path;

  // The gate below needs to know where the edited file is, and only an absolute path says
  // so: the contract supplies one (measured 2026-09-09) and `Edit`/`Write` require one.
  // A missing or relative value is relative to nothing we can name, and resolving it
  // against the root would be a silent guess — so lint instead. Skipping on "cannot prove
  // it was irrelevant" is how a check becomes decorative.
  const editedRelative = typeof edited === 'string' && isAbsolute(edited)
    ? relative(root, edited)
    : null;

  // Outside the checked scope, so this edit cannot have changed the linter's verdict;
  // running anyway would report standing findings and blame them on this edit
  // (stele:ADR-0021).
  //
  // This covers a file outside the repo altogether — a scratch path, another worktree,
  // which the 2026-09-09 probe produced on its very first write — because `inReadScope`
  // rejects a root-relative path that climbs out of the root. A `startsWith('..')` test
  // here would be a second copy of that decision, and it stood here until a mutation
  // probe showed nothing could kill its removal.
  if (editedRelative !== null && !inReadScope(editedRelative)) return { exitCode: 0, stderr: '' };

  const { findings } = lint(root);
  const errors = findings.filter((f) => f.severity === 'error');

  // Warnings are deliberately silent. They do not fail the git hook either
  // (stele:ADR-0003), and the only channel that reaches the model is a blocking exit —
  // so surfacing a warning here would mean escalating it, which is a rule change made by
  // a hook rather than by a decision.
  if (!errors.length) return { exitCode: 0, stderr: '' };

  // The edit's own findings first. `lint()` reports in corpus order, so on a repo carrying
  // more standing errors than the cap below, the error this edit just introduced is
  // precisely the one that gets cut — leaving a message that blocks the turn while naming
  // only other people's problems. An adversarial pass (stele:ADR-0017) reproduced it with
  // twelve standing errors sorting ahead of the edited file.
  const isEdited = (f) => relative(root, f.path) === editedRelative;
  const ranked = [...errors.filter(isEdited), ...errors.filter((f) => !isEdited(f))];

  const shown = ranked.slice(0, MAX_FINDINGS_SHOWN);
  const lines = shown.map((f) => `  ${relative(root, f.path) || '.'}: ${f.message}`);
  const omitted = errors.length - shown.length;
  if (omitted > 0) lines.push(`  … and ${omitted} more.`);

  return {
    exitCode: 2,
    stderr: [
      `docs-lint: ${errors.length} error(s) in this repo's document corpus (stele:ADR-0003).`,
      ...lines,
      'The pre-commit hook enforces these same rules against the commit, so they will block',
      'it until they pass. Full report: `node scripts/lint-docs.mjs .`',
      '',
    ].join('\n'),
  };
}

/** The repo root, from the hook contract. `CLAUDE_PROJECT_DIR` is the documented answer
 *  and `cwd` in the payload is the observed one; with neither there is nothing to lint,
 *  and guessing would check a directory the operator never named. */
function projectRoot(payload) {
  const root = process.env.CLAUDE_PROJECT_DIR || payload?.cwd;
  if (!root) throw new Error('neither CLAUDE_PROJECT_DIR nor a `cwd` in the hook payload');
  return root;
}

function main() {
  if (process.stdin.isTTY) {
    console.error('post-tool-lint: expects a PostToolUse hook payload on stdin.');
    return 1;
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch (cause) {
    // Exit 1, not 2: a payload we cannot parse is our problem or the client's, and
    // reporting it to the model as a document error would be a lie.
    console.error(`post-tool-lint: unreadable hook payload — ${cause.message}`);
    return 1;
  }

  let result;
  try {
    result = evaluate({ payload, root: projectRoot(payload) });
  } catch (cause) {
    console.error(`post-tool-lint: ${cause.message}`);
    return 1;
  }

  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

// realpath, not a string compare on argv[1]: invoked through a symlink the naive form
// silently does nothing, which is how `npx stele` shipped as a no-op (stele:ADR-0015).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
