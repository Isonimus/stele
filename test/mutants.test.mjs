// The mutant list stays aimed at real code. Run: node --test
//
// This checks the *list*, not the runner. Running the runner here would execute the whole
// suite ten times from inside the suite — 21s and recursive — so the runner's own
// correctness rests on two loud guards instead: it refuses to grade anything unless the
// unmutated suite passes, and it throws on an anchor that no longer matches.
//
// That first guard exists because its absence produced exactly the failure this repo is
// built to prevent. The initial draft ran `node --test test/`, which node reads as a module
// path rather than a directory, so every run crashed instantly and all ten mutants were
// reported killed — a perfect score, in 621ms, against a suite that never started.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MUTANTS } from '../scripts/check-mutants.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('every mutant anchors to exactly one place in the file it names', () => {
  // A mutant whose anchor has rotted tests nothing. Caught here in 2ms rather than after a
  // 21s run, and caught even when nobody runs the mutation check at all.
  for (const mutant of MUTANTS) {
    const source = readFileSync(join(ROOT, mutant.file), 'utf8');
    const hits = source.split(mutant.find).length - 1;
    assert.equal(hits, 1, `${mutant.label}: anchor matched ${hits} times in ${mutant.file}`);
  }
});

test('every mutant actually changes the source it is applied to', () => {
  for (const mutant of MUTANTS) {
    assert.notEqual(mutant.find, mutant.replace, `${mutant.label}: mutation is a no-op`);
  }
});

test('an exempt mutant says why it cannot be killed', () => {
  // Exemption is the one way a survivor is allowed to pass, so it carries a stated reason
  // rather than a bare flag — otherwise it becomes the place to hide an inconvenient gap.
  for (const mutant of MUTANTS.filter((m) => m.equivalent)) {
    assert.equal(typeof mutant.equivalent, 'string');
    assert.ok(mutant.equivalent.length > 20, `${mutant.label}: exemption reason is too thin`);
  }
});

test('the list covers both modules it claims to cover', () => {
  // Guards against a vacuous pass: an empty or one-sided list satisfies every assertion
  // above while checking nothing.
  const files = new Set(MUTANTS.map((m) => m.file));

  assert.ok(MUTANTS.length >= 8, `expected a real list, got ${MUTANTS.length} mutant(s)`);
  assert.ok(files.has('scripts/lint-docs.mjs'));
  assert.ok(files.has('scripts/check-immutable.mjs'));
});
