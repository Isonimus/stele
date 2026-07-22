// Regression fixtures for every rule in ADR-0003. Run: node --test
//
// Each fixture in test/fixtures/ is a miniature repo built to trip exactly one rule.
// Per CLAUDE.md §3 there is one fixture per rule and no duplicates: the point is that a
// rule which stops firing gets caught, not that the corpus is large.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { lint, parseFrontmatter } from '../scripts/lint-docs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(here, 'fixtures', name);

/** Rule codes reported at a given severity, e.g. ['R4', 'R7'].
 *  Matched by pattern rather than sliced to a fixed width: at ten rules a slice(0, 2)
 *  reads "R10" as "R1" and the two become indistinguishable. */
function codes(name, severity) {
  return lint(fixture(name))
    .findings.filter((f) => f.severity === severity)
    .map((f) => f.message.match(/^R\d+/)[0])
    .sort();
}

const errors = (name) => codes(name, 'error');
const warnings = (name) => codes(name, 'warn');

test('a clean corpus produces no findings at all', () => {
  assert.deepEqual(errors('clean'), []);
  assert.deepEqual(warnings('clean'), []);
});

test('R1 rejects a file with no frontmatter', () => {
  assert.deepEqual(errors('r1-no-frontmatter'), ['R1']);
});

test('R1 rejects frontmatter missing a required field', () => {
  assert.deepEqual(errors('r1-missing-field'), ['R1']);
});

test('R2 catches an id that disagrees with the filename ordinal', () => {
  assert.deepEqual(errors('r2-id-mismatch'), ['R2']);
});

test('R2 catches two files claiming one id', () => {
  // Slug is not a key: boxel has 0068-lava-fluid and 0128-lava-fluid.
  assert.deepEqual(errors('r2-duplicate-id'), ['R2']);
});

test('R3 rejects legacy status and type vocabulary', () => {
  // "implemented" appeared once in boxel; "epic" never existed but is the kind of
  // plausible invention the closed vocabulary exists to refuse.
  assert.deepEqual(errors('r3-bad-vocab'), ['R3', 'R3']);
});

test('R4 catches a one-way supersession', () => {
  // The live boxel defect: 0112/0113/0114 declare themselves superseded by 0122,
  // and 0122 acknowledges none of them.
  assert.deepEqual(errors('r4-one-way'), ['R4']);
});

test('R5 catches a supersession naming a target that does not exist', () => {
  // Legacy 0051 and 0061 claimed supersession with no resolvable target.
  assert.deepEqual(errors('r5-dangling'), ['R5']);
});

test('R6 catches status disagreeing with supersession', () => {
  assert.deepEqual(errors('r6-status-mismatch'), ['R6']);
});

test('R7 catches a live ADR that another claims to supersede', () => {
  // R6 cannot see this case: the superseded ADR says nothing at all, so the only
  // evidence is on the superseding side.
  assert.ok(errors('r7-accepted-but-superseded').includes('R7'));
});

test('R8 catches a ledger citation that does not resolve', () => {
  assert.deepEqual(errors('r8-bad-ledger'), ['R8']);
});

test('R9 warns on an unresolved prose reference but never errors', () => {
  // 567 legacy bare references exist, some pointing at external context. Failing the
  // build on those would make the linter something to disable rather than obey.
  assert.deepEqual(errors('r9-prose-ref'), []);
  assert.deepEqual(warnings('r9-prose-ref'), ['R9']);
});

test('R10 errors when the root holds no document directory at all', () => {
  // The reported defect: pointed at boxel/adr rather than the repo root, the linter
  // printed "0 document(s) — ok" and exited 0. A hook on a wrong path passed forever.
  assert.deepEqual(errors('r10-wrong-root'), ['R10']);
});

test('R10 only warns when a document directory exists but is empty', () => {
  // A scaffolded repo that has not written its first ADR is correctly configured, not
  // misconfigured. Erroring here would fail `npm run lint` during install.
  assert.deepEqual(errors('r10-empty-corpus'), []);
  assert.deepEqual(warnings('r10-empty-corpus'), ['R10']);
});

test('R10 stays silent whenever any document is found', () => {
  // Guards the early return: R10 must not fire alongside real per-document findings.
  assert.ok(!errors('clean').includes('R10'));
  assert.ok(!errors('r5-dangling').includes('R10'));
});

test('R11 flags a verify script no package.json command runs', () => {
  // The load-bearing wiring requirement of ADR-0004, now enforced. The same fixture
  // carries an unwired *-probe.mjs, so a lone R11 also proves probes are exempt.
  assert.deepEqual(errors('r11-unwired'), ['R11']);
});

test('R11 accepts scripts wired through a single aggregate runner', () => {
  // `node scripts/a-verify.mjs && node scripts/b-verify.mjs` wires both — the reason
  // wiring is matched per-token by basename rather than by a substring scan.
  assert.deepEqual(errors('r11-wired'), []);
  assert.deepEqual(warnings('r11-wired'), []);
});

test('R11 stays silent where there is no harness to wire', () => {
  // No scripts/ or package.json (every document-rule fixture, and clean) means nothing
  // to check — R11 must not invent a finding.
  assert.ok(!errors('clean').includes('R11'));
  assert.ok(!errors('r5-dangling').includes('R11'));
});

test('a complete slice — both sections, a real triad — produces no findings', () => {
  // The happy path: proves R12/R13 do not fire on a slice that honours the contract.
  assert.deepEqual(errors('slice-complete'), []);
  assert.deepEqual(warnings('slice-complete'), []);
});

test('R12 errors when a current slice omits its ## Verification section', () => {
  // ADR-0004 required the section from the start but nothing checked it — the same gap
  // R11 closed for wiring. Dated on/after the rule, the omission is an error.
  assert.deepEqual(errors('r12-slice-no-verification'), ['R12']);
});

test('R13 errors when a current slice omits its ## Definition of Done section', () => {
  assert.deepEqual(errors('r13-slice-no-dod'), ['R13']);
});

test('R13 errors when the Definition of Done is prose, not a Given/When/Then triad', () => {
  // Presence of the header is not enough: the section must hold a real scenario. Shape,
  // not truth — the check reads that the three step kinds exist, never what they claim.
  assert.deepEqual(errors('r13-slice-no-triad'), ['R13']);
});

test('R12/R13 only warn on a legacy slice dated before the rule', () => {
  // boxel's ~104 slices and gamatar's predate the rule; erroring would turn every repo
  // red on the day it adopts this linter. The date split warns on legacy, errors on new.
  assert.deepEqual(errors('slice-legacy'), []);
  assert.deepEqual(warnings('slice-legacy'), ['R12', 'R13']);
});

test('R12/R13 never fire on a non-slice document', () => {
  // The rules key off type: slice. An architecture ADR has no Verification/DoD contract.
  assert.ok(!errors('clean').includes('R12'));
  assert.ok(!errors('clean').includes('R13'));
});

// --- frontmatter parser -----------------------------------------------------

test('parser reads inline lists, block lists, and empty values', () => {
  const inline = parseFrontmatter('---\nsupersedes: [0001, 0002]\n---\nbody\n');
  assert.deepEqual(inline.data.supersedes, ['0001', '0002']);

  const block = parseFrontmatter('---\nsupersedes:\n  - 0001\n  - 0002\n---\n');
  assert.deepEqual(block.data.supersedes, ['0001', '0002']);

  const empty = parseFrontmatter('---\nsupersedes: []\n---\n');
  assert.deepEqual(empty.data.supersedes, []);

  const bare = parseFrontmatter('---\nsupersedes:\n---\n');
  assert.deepEqual(bare.data.supersedes, []);
});

test('parser separates body from frontmatter', () => {
  const r = parseFrontmatter('---\nid: 0001\n---\n\n# Title\n\nProse.\n');
  assert.equal(r.ok, true);
  assert.match(r.body, /# Title/);
  assert.doesNotMatch(r.body, /id: 0001/);
});

test('parser refuses an unterminated frontmatter block', () => {
  const r = parseFrontmatter('---\nid: 0001\n\n# Title\n');
  assert.equal(r.ok, false);
  assert.match(r.error, /not terminated/);
});

test('parser preserves ids as strings, never octal-parsed numbers', () => {
  // Bare 0112 in real YAML is ambiguous; keeping ids as padded strings sidesteps it.
  const r = parseFrontmatter('---\nid: 0112\n---\n');
  assert.equal(r.data.id, '0112');
});
