// Regression tests for the migrator, which rewrites 130 historical records in place.
//
// The scanner's known-answer test proves the *facts* are recovered correctly. This file
// covers the half that writes: that the emitted frontmatter parses back to those facts,
// that prose survives byte-for-byte, and that a second run is a no-op. A migration you
// cannot safely re-run is a migration you cannot safely interrupt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { planMigration } from '../scripts/migrate-adrs.mjs';
import { parseFrontmatter } from '../scripts/lint-docs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'fixtures', 'legacy-corpus');

const plan = () => planMigration(corpus);
const byId = (entries) => new Map(entries.map((p) => [p.record.id, p]));

/** A throwaway repo, so a test can control whether git knows the file. */
function scratch(files) {
  const root = mkdtempSync(join(tmpdir(), 'migrate-test-'));
  mkdirSync(join(root, 'adr'), { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(root, 'adr', name), text);
  }
  return root;
}

test('every legacy file is planned for a write, none blocked', () => {
  const actions = plan().reduce((a, p) => ({ ...a, [p.action]: (a[p.action] ?? 0) + 1 }), {});
  assert.deepEqual(actions, { write: 16 });
});

test('emitted frontmatter parses back to the facts the scanner recovered', () => {
  // The real contract: the migrator's output is the linter's input. A block that renders
  // prettily but does not round-trip through parseFrontmatter would fail R1 across the
  // whole corpus at the first lint, after 130 files had already been written.
  for (const p of plan()) {
    const parsed = parseFrontmatter(p.content);
    assert.ok(parsed.ok, `ADR ${p.record.id}: ${parsed.error}`);

    assert.equal(parsed.data.id, p.record.id);
    assert.equal(parsed.data.status, p.record.status);
    assert.deepEqual(parsed.data.supersedes, p.record.supersedes.sort());
    assert.deepEqual(parsed.data.superseded_by, p.record.supersededBy.sort());
    assert.match(parsed.data.date, /^20\d{2}-\d{2}-\d{2}$/);
  }
});

test('a title containing a quote or colon survives the round trip', () => {
  // Titles are the one free-text field. 0095's is "Status effects: poison that ticks…";
  // an unquoted colon would make the linter read `title` as a truncated value.
  const root = scratch({
    '0001-tricky.md': [
      '# ADR 0001 — Signals: "quoted", colons: and — dashes',
      '',
      '## Status',
      '',
      'Accepted (2026-07-01).',
      '',
    ].join('\n'),
  });

  const parsed = parseFrontmatter(planMigration(root)[0].content);
  assert.ok(parsed.ok, parsed.error);
  assert.equal(parsed.data.title, 'Signals: "quoted", colons: and — dashes');
  rmSync(root, { recursive: true, force: true });
});

test('prose is prepended to, never rewritten', () => {
  for (const p of plan()) {
    const original = readFileSync(p.path, 'utf8');
    assert.ok(
      p.content.endsWith(original),
      `ADR ${p.record.id}: original text is not preserved verbatim at the tail`,
    );
    // The legacy ## Status section stays put. Frontmatter duplicates the fact; it does
    // not license deleting the historical claim that recorded it.
    assert.equal(p.content.slice(0, p.content.length - original.length).endsWith('---\n\n'), true);
  }
});

test('a file that already has frontmatter is skipped, so a re-run is a zero diff', () => {
  const root = scratch({
    '0001-done.md': ['---', "id: '0001'", 'title: "Done"', 'type: slice', 'status: accepted',
                     'date: 2026-07-01', 'supersedes: []', 'superseded_by: []', '---', '',
                     '# ADR 0001 — Done', ''].join('\n'),
  });

  const [p] = planMigration(root);
  assert.equal(p.action, 'skip');
  assert.equal(p.content, undefined, 'a skip must carry no content to write');
  rmSync(root, { recursive: true, force: true });
});

test('the date stated in the document beats the date git recorded', () => {
  // Design-first ADRs are written days before they land. The document is the author's
  // claim about when the decision was made; the git date only says when the file
  // appeared, and for this workflow those routinely disagree.
  const dated = byId(plan()).get('0051');
  assert.equal(dated.dateSource, 'stated');
  assert.equal(dated.fields.date, '2026-07-06');
});

test('a supersession date is not mistaken for the decision date', () => {
  // `Status: superseded (2026-07-20) by ADR-0008` dates the *transition*. Reading it as
  // the decision date backdates the ADR to the day it died — gamatar's 0005 was decided
  // 2026-07-18 and would have claimed 07-20, the same day as the ADR that replaced it.
  // Only a transition header is affected; an accepted header still wins over git.
  const root = scratch({
    '0005-replaced.md': [
      '# ADR 0005 — Replaced',
      '',
      '- Status: superseded (2026-07-20) by [ADR-0008](0008-next.md)',
      '',
    ].join('\n'),
  });

  const [p] = planMigration(root);
  // Outside git there is no better source, so the transition date is used — but it is
  // labelled as such, so a migration summary shows how many dates are approximate.
  assert.equal(p.dateSource, 'transition');
  rmSync(root, { recursive: true, force: true });
});

test('a dateless file outside git is blocked rather than given an invented date', () => {
  const root = scratch({
    '0001-undated.md': ['# ADR 0001 — Undated', '', '## Status', '', 'Accepted.', ''].join('\n'),
  });

  const [p] = planMigration(root);
  assert.equal(p.action, 'block');
  assert.match(p.reason, /date/);
  rmSync(root, { recursive: true, force: true });
});

test('known drift is migrated faithfully, not silently repaired', () => {
  // 0112 declares itself superseded by 0122 while its status still reads Accepted.
  // Writing `status: superseded` here would be the migrator quietly deciding an
  // open question, and would erase the evidence that the linter exists to surface.
  const p = byId(plan()).get('0112');
  assert.equal(p.fields.status, 'accepted');
  assert.deepEqual(p.fields.superseded_by, ['0122']);

  // And 0122 is left with the empty `supersedes` that makes it an R4 violation.
  assert.deepEqual(byId(plan()).get('0122').fields.supersedes, []);
});

test('type is seeded from the survey, with batches detected by title', () => {
  const p = byId(plan());
  assert.equal(p.get('0051').fields.type, 'architecture');
  assert.equal(p.get('0122').fields.type, 'architecture');
  assert.equal(p.get('0061').fields.type, 'batch'); // "Flora batch — …"
  assert.equal(p.get('0129').fields.type, 'slice');
});

test('the architectural set is per-repo, overridable from the default', () => {
  // The default set is boxel's survey; any other corpus passes its own. gamatar's ADRs
  // are all architecture, including 0129 — which would otherwise default to slice.
  const p = byId(planMigration(corpus, { architecture: new Set(['0129']) }));
  assert.equal(p.get('0129').fields.type, 'architecture');
  assert.equal(p.get('0051').fields.type, 'slice'); // in boxel's default, not this set
  // A title batch still wins even when the id is not in the set — batch is content-shaped.
  assert.equal(p.get('0061').fields.type, 'batch');
});
