// Regression tests for the Claude Code lifecycle hooks (ADR-0027). Run: node --test
//
// These cover the layer's two jobs and, more importantly, the boundary around them: the
// fast path must stay silent wherever its verdict would not be about the edit that just
// happened, and the digest must stay inside a stated budget it pays again on every
// resume. Neither hook enforces anything — the git hook and CI do (ADR-0003) — so what
// is worth pinning is exactly when they speak.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { evaluate } from '../.claude/hooks/post-tool-lint.mjs';
import { DIGEST_BUDGET_BYTES, buildDigest, openLedgerItems } from '../.claude/hooks/session-digest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(here, 'fixtures', name);

/** A `PostToolUse` payload of the shape the client actually sends — the absolute
 *  `tool_input.file_path` was captured from a live hook on 2026-09-09, and the scope gate
 *  depends on it being absolute. */
/** A minimal architecture document, optionally missing its `status` — which is the
 *  cheapest way to give a scratch corpus a known number of errors. */
const doc = (id, status) => `---\nid: '${id}'\ntitle: "Doc ${id}"\ntype: architecture\n`
  + (status ? `status: ${status}\n` : '')
  + 'date: 2026-07-20\nsupersedes: []\nsuperseded_by: []\n---\n\n## Context\n\nx.\n';

const write = (root, absoluteFilePath) => ({
  cwd: root,
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: absoluteFilePath },
});

// --- the fast path ----------------------------------------------------------

test('an edit inside the checked scope reports the corpus errors and blocks', () => {
  const root = fixture('r1-missing-field');
  const { exitCode, stderr } = evaluate({ payload: write(root, join(root, 'adr/0001-alpha.md')), root });

  // Exit 2 specifically: it is the only code whose stderr reaches the model. Exit 1 shows
  // the operator a failed hook and tells the model nothing (ADR-0027).
  assert.equal(exitCode, 2);
  assert.match(stderr, /R1 missing required field "status"/);
  // The path is named relative to the repo, not absolutely: a tmpdir prefix is noise, and
  // hardcoded absolute paths are forbidden even in output.
  assert.match(stderr, /adr\/0001-alpha\.md/);
  assert.doesNotMatch(stderr, new RegExp(root));
});

test('the same red corpus is silent when the edit lands outside the checked scope', () => {
  // The gate is the whole reason this is a fast path and not a nag: `src/` is outside
  // READ_SCOPE, so this edit cannot have changed the linter's verdict, and reporting the
  // standing errors would blame them on a change that did not cause them (ADR-0021).
  const root = fixture('r1-missing-field');
  assert.deepEqual(evaluate({ payload: write(root, join(root, 'src/thing.ts')), root }),
    { exitCode: 0, stderr: '' });
});

test('an edit outside the repo entirely is silent', () => {
  // Observed in the 2026-09-09 probe: the model wrote to its own scratchpad while the
  // hook ran in the project directory. Without this the hook lints on every such write.
  const root = fixture('r1-missing-field');
  assert.deepEqual(evaluate({ payload: write(root, join(tmpdir(), 'elsewhere/note.md')), root }),
    { exitCode: 0, stderr: '' });
});

test('a clean corpus says nothing', () => {
  const root = fixture('clean');
  assert.deepEqual(evaluate({ payload: write(root, join(root, 'adr/0001-alpha.md')), root }),
    { exitCode: 0, stderr: '' });
});

test('warnings alone never block', () => {
  // Warnings do not fail the git hook (ADR-0003), and the only channel that reaches the
  // model is a blocking exit — so surfacing one here would silently promote it to an
  // error, which is a rule change made by a hook instead of by a decision.
  const root = fixture('r9-prose-ref');
  assert.deepEqual(evaluate({ payload: write(root, join(root, 'adr/0001-alpha.md')), root }),
    { exitCode: 0, stderr: '' });
});

test('a payload with no usable file path lints rather than skipping', () => {
  // Fail-safe toward checking. A tool matched the pattern, so an edit happened; a
  // relative or absent path is relative to nothing we can name, and skipping on "cannot
  // prove it was irrelevant" is how a check becomes decorative.
  const root = fixture('r1-missing-field');
  for (const toolInput of [{}, { file_path: 'adr/0001-alpha.md' }]) {
    const { exitCode } = evaluate({ payload: { tool_name: 'Write', tool_input: toolInput }, root });
    assert.equal(exitCode, 2);
  }
});

test('the error the edit introduced is reported even on a corpus deep in others', () => {
  // `lint()` reports in corpus order, so on a corpus carrying more standing errors than the
  // cap, the edit's own error is exactly the one cut — which defeats the point of running
  // here at all rather than at commit time. Found by an adversarial pass (ADR-0017).
  const root = mkdtempSync(join(tmpdir(), 'hook-rank-'));
  mkdirSync(join(root, 'adr'));
  for (let n = 1; n <= 12; n += 1) {
    const id = String(n).padStart(4, '0');
    writeFileSync(join(root, 'adr', `${id}-existing.md`), doc(id, null));
  }
  writeFileSync(join(root, 'adr', '0013-edited.md'), doc('0013', 'bogus-status'));

  const { exitCode, stderr } = evaluate({ payload: write(root, join(root, 'adr/0013-edited.md')), root });
  assert.equal(exitCode, 2);
  // First in the list, not merely somewhere in it: a reader stops at the first line.
  assert.match(stderr.split('\n')[1], /0013-edited\.md/);
});

test('a long error list is summarised rather than pasted whole', () => {
  // A repo installing the hook mid-migration can be a hundred errors deep; the whole list
  // costs more context than the corpus is worth, which is the one way this layer could
  // make a turn worse instead of better.
  const root = mkdtempSync(join(tmpdir(), 'hook-cap-'));
  mkdirSync(join(root, 'adr'));
  const count = 14;
  for (let n = 1; n <= count; n += 1) {
    const id = String(n).padStart(4, '0');
    writeFileSync(join(root, 'adr', `${id}-thing.md`), doc(id, null));
  }

  const { exitCode, stderr } = evaluate({ payload: write(root, join(root, 'adr/0001-thing.md')), root });
  assert.equal(exitCode, 2);
  assert.match(stderr, new RegExp(`${count} error\\(s\\)`));
  assert.match(stderr, /… and 4 more\./);
  assert.equal(stderr.split('\n').filter((l) => l.startsWith('  adr/')).length, 10);
});

// --- the session digest -----------------------------------------------------

const LEDGER = [
  '# Ledger', '', 'Preamble prose that is not an item.', '',
  '## Open', '',
  '- [bug] first open item', '  a continuation line carrying the argument',
  // An indented item, so the top-level anchor is pinned: unanchor the pattern and this
  // sub-item is read as open work of its own.
  '  - [bug] a sub-item of the first, not an item in its own right',
  '- [feature] second open item', '',
  '## Resolved', '',
  '- [bug] a closed item nobody should act on', '',
].join('\n');

test('the digest carries open items only, one line each', () => {
  // A closed item read as open is worse than not reading the ledger at all, and the
  // continuation lines are the argument — which is what LEDGER.md itself is for.
  assert.deepEqual(openLedgerItems(LEDGER), ['- [bug] first open item', '- [feature] second open item']);
});

test('a repo with no ledger produces no digest', () => {
  // Not an error: it is a repo /init-method has not run in yet, and erroring on every
  // session start would be hostile to the one case where nothing is installed.
  assert.equal(buildDigest(mkdtempSync(join(tmpdir(), 'hook-noledger-'))), '');
});

test('the digest stays inside its budget and says what it dropped', () => {
  const root = mkdtempSync(join(tmpdir(), 'hook-digest-'));
  const items = Array.from({ length: 200 }, (_, n) => `- [bug] open item number ${n} with enough prose to cost bytes`);
  writeFileSync(join(root, 'LEDGER.md'), ['# Ledger', '', '## Open', '', ...items, ''].join('\n'));

  const digest = buildDigest(root);
  assert.ok(Buffer.byteLength(digest) <= DIGEST_BUDGET_BYTES,
    `digest is ${Buffer.byteLength(digest)} bytes, over the ${DIGEST_BUDGET_BYTES}-byte budget`);
  // Silent truncation would make the digest lie about being the open list.
  assert.match(digest, /further item\(s\) omitted to stay inside the digest budget/);
  assert.match(digest, /200 of them/);
});

test('an item that fits is not dropped, and nothing claims it was', () => {
  // Reserving the truncation notice's bytes on every item, rather than only when there is
  // going to be a notice, drops an item that would have fitted and then blames the budget
  // for it. A digest that misreports why it is short is worse than a longer one. Found by
  // an adversarial pass (ADR-0017).
  const root = mkdtempSync(join(tmpdir(), 'hook-boundary-'));
  const ledger = join(root, 'LEDGER.md');
  const small = '- [feature] short one';

  // Land the pair exactly on the budget, measured rather than guessed: build a one-item
  // digest, and the slack left over is what a second item may cost. Both counts are
  // single-digit, so the header is the same length in both builds.
  writeFileSync(ledger, ['# Ledger', '', '## Open', '', small, ''].join('\n'));
  const baseline = Buffer.byteLength(buildDigest(root));
  const prefix = '- [bug] ';
  const big = prefix + 'x'.repeat(DIGEST_BUDGET_BYTES - baseline - 1 - prefix.length);

  writeFileSync(ledger, ['# Ledger', '', '## Open', '', big, small, ''].join('\n'));
  const digest = buildDigest(root);

  assert.equal(Buffer.byteLength(digest), DIGEST_BUDGET_BYTES);
  assert.ok(digest.includes(small), 'the second item fits inside the budget and must be kept');
  assert.doesNotMatch(digest, /omitted to stay inside the digest budget/);
});

test('the budget holds at every boundary, not only in the middle of the range', () => {
  // A single mid-range case cannot see an off-by-one in the accounting: the digest is
  // assembled from a head, the items, an optional notice and a trailing newline, and
  // leaving any one of those out of the sum only shows up when an item lands within a byte
  // or two of the cap. Sweeping across the boundary is what pins it — the trailing newline
  // was uncounted, and only a mutation probe noticed (ADR-0022).
  const root = mkdtempSync(join(tmpdir(), 'hook-sweep-'));
  const ledger = join(root, 'LEDGER.md');
  const small = '- [feature] short one';
  const prefix = '- [bug] ';

  writeFileSync(ledger, ['# Ledger', '', '## Open', '', small, ''].join('\n'));
  const baseline = Buffer.byteLength(buildDigest(root));

  for (let offset = -20; offset <= 20; offset += 1) {
    const big = prefix + 'x'.repeat(DIGEST_BUDGET_BYTES - baseline + offset - prefix.length);
    writeFileSync(ledger, ['# Ledger', '', '## Open', '', big, small, ''].join('\n'));
    const bytes = Buffer.byteLength(buildDigest(root));
    assert.ok(bytes <= DIGEST_BUDGET_BYTES,
      `at offset ${offset} the digest is ${bytes} bytes, over the ${DIGEST_BUDGET_BYTES}-byte budget`);
  }
});

test("this repo's own digest is inside the budget", () => {
  // The claim ADR-0027 rests on is that the digest is cheap *here*, on the corpus that
  // ships it. If this repo's ledger ever outgrows the cap, the digest starts truncating
  // and the fix is a better summary, not a bigger budget.
  const digest = buildDigest(join(here, '..'));
  assert.ok(Buffer.byteLength(digest) < DIGEST_BUDGET_BYTES);
  assert.doesNotMatch(digest, /omitted to stay inside the digest budget/);
});
