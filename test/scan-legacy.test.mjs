// Known-answer test for the legacy scanner (ADR-0003).
//
// The scanner drives the migration, so it must be validated against ground truth before
// it is trusted to rewrite 130 files. `legacy-corpus` reproduces every supersession-shaped
// line found in boxel: four genuine defects and six traps that must not fire.
//
// Ground truth was established by reading all ten occurrences by hand. Note it disagrees
// with the original survey, which reported five defects — it counted boxel 0051, whose
// prose supersedes "the scattered IOUs in 0022, 0025, 0026, 0044" rather than those
// decisions. Marking those four live architecture ADRs superseded would have been a real
// corruption, introduced by trusting a summary over the text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scanLegacy, findDefects } from '../scripts/scan-legacy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'fixtures', 'legacy-corpus');

const scan = () => scanLegacy(corpus);
const byId = (records) => new Map(records.map((r) => [r.id, r]));

test('finds exactly the four genuine defects', () => {
  const defects = findDefects(scan());
  const summary = defects.map((d) => `${d.kind}:${d.id}${d.target ? `->${d.target}` : ''}`).sort();

  assert.deepEqual(summary, [
    'dangling:0061',
    'one-way:0112->0122',
    'one-way:0113->0122',
    'one-way:0114->0122',
  ]);
});

test('recovers the bullet dialect, where supersession is a markdown link', () => {
  // gamatar declares supersession in the status field with no bold anywhere. A
  // bold-only reader drops the fact silently: 0005 would migrate as
  // "status: superseded, superseded_by: []".
  const r = byId(scan());
  assert.deepEqual(r.get('0005').supersededBy, ['0008']);
  assert.deepEqual(r.get('0008').supersedes, ['0005']);
});

test('a bullet naming an ADR while superseding nothing leaves it live', () => {
  // gamatar 0007: "- Supersedes no ADR: ADR-0001's decision is unchanged, only its
  // numbers." Requiring the colon immediately after the word is what keeps ADR-0001 —
  // a live architecture decision — from being marked dead.
  const r = byId(scan());
  assert.deepEqual(r.get('0007').supersedes, []);
  assert.deepEqual(r.get('0001').supersededBy, []);

  // 0006 retires a parenthetical inside 0002, not the decision.
  assert.deepEqual(r.get('0006').supersedes, []);
  assert.deepEqual(r.get('0002').supersededBy, []);
});

test('ignores supersession prose that is not an ADR-level claim', () => {
  const r = byId(scan());

  // 0123's "Superseded mesh jobs" opens a line — the false-positive trap that line-start
  // anchoring alone would not survive without requiring an ADR reference.
  assert.deepEqual(r.get('0123').supersedes, []);
  assert.deepEqual(r.get('0123').supersededBy, []);
  assert.deepEqual(r.get('0123').dangling, []);

  // 0051 supersedes IOUs recorded in those ADRs, not the decisions themselves.
  assert.deepEqual(r.get('0051').supersedes, []);

  // 0011 supersedes a note within itself; 0085 a justification.
  assert.deepEqual(r.get('0011').supersedes, []);
  assert.deepEqual(r.get('0085').supersedes, []);

  // 0122's line 270 is a to-do about annotating, not a claim.
  assert.deepEqual(r.get('0122').supersedes, []);
});

test('recovers status across all three dialects', () => {
  const r = byId(scan());

  assert.equal(r.get('0061').dialect, 'heading'); // ## Status, value on next line
  assert.equal(r.get('0112').dialect, 'inline'); // bare Status: opening a prose blob
  assert.equal(r.get('0051').status, 'accepted'); // **Accepted** — bold stripped
});

test('terminates an inline status blob at the first sentence boundary', () => {
  // The inline dialect runs to the next heading; a line-bounded read captures a paragraph.
  const r = byId(scan()).get('0112');
  assert.equal(r.status, 'accepted');
  assert.equal(r.legacyStatus, 'accepted');
});

test('maps the lone legacy "Implemented" onto the closed vocabulary', () => {
  assert.equal(byId(scan()).get('0129').status, 'accepted');
});

test('every record resolves to a known status', () => {
  // An unmapped status would silently become missing frontmatter at migration time.
  for (const r of scan()) {
    assert.ok(r.status, `ADR ${r.id} produced no status (legacy: "${r.legacyStatus}")`);
  }
});

// A live-boxel integration test lived here: it scanned the real corpus and pinned its
// file count (130), dialect census, and defect set. It validated the scanner against
// ground truth before the one-time migration — which it did, successfully. That premise
// has now expired: boxel is migrated and still growing (a parallel session added 0130),
// so its count/census assertions can only break on boxel's own evolution, never catch a
// claude-method regression — a fragile test by our own rule (§3). The frozen
// `legacy-corpus` fixture reproduces all four defects and six traps; the "finds exactly
// the four genuine defects" test above is the durable known-answer guard.
