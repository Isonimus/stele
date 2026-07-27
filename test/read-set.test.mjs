// The hook must copy every path the linter reads (ADR-0018). Run: node --test
//
// ADR-0018 chose to archive a subset of the staged tree — the full tree costs ~1.1ms per
// tracked file, ~11s on a 10k-file repo — and wrote the resulting obligation down as prose:
// "a rule that starts reading a file outside this list must extend it here". That
// obligation was missed by the very next feature. Rules 14 and 15 read CLAUDE.md,
// README.md, docs/ and .claude/commands/, none of which the hook copied, so they were dead
// in the hook for a release while passing in CI and in `npm run lint` — a check that
// reports green because it never saw the file, which is the precise failure this whole
// project exists to remove.
//
// The two lists cannot be a single source: the hook is POSIX sh with no dependency on
// node having run yet. So they stay duplicated and this test holds them equal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { READ_SCOPE } from '../scripts/lint-docs.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The pathspec list the hook feeds to `git archive`, read out of the shell source. */
function hookReadSet() {
  const hook = readFileSync(join(ROOT, '.claude/hooks/pre-commit'), 'utf8');
  const loop = hook.match(/^for candidate in (.+); do$/m);
  assert.ok(loop, 'the hook no longer declares its archive list as a `for candidate in` loop');
  return loop[1].trim().split(/\s+/);
}

test('the hook archives exactly the paths the linter reads', () => {
  assert.deepEqual(hookReadSet().sort(), [...READ_SCOPE].sort());
});

test('the read set is checked against something real, not an empty list', () => {
  // Without this, a regex that stops matching turns the assertion above into `[] == []`.
  assert.ok(READ_SCOPE.includes('adr'), 'the corpus must be in scope');
  assert.ok(READ_SCOPE.includes('CLAUDE.md'), 'the prose read as instruction must be in scope');
  assert.ok(hookReadSet().length >= READ_SCOPE.length);
});
