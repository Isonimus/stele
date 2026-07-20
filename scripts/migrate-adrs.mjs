#!/usr/bin/env node
// Prepends ADR-0002 frontmatter to a legacy corpus, using facts recovered by
// scan-legacy.mjs. Dry-run by default (ADR-0003's migration plan).
//
//   node scripts/migrate-adrs.mjs <repo-root> [--apply] [--verbose]
//
// Three guarantees, because this rewrites 130 files that are historical records:
//
//   1. Prose is never touched. The only write is a frontmatter block prepended to the
//      file. The legacy `## Status` section stays exactly where it is — it is part of
//      the historical claim, and duplicating a fact into frontmatter does not license
//      deleting the original.
//   2. Idempotent. A file that already opens with `---` is reported as `skip` and left
//      alone, so a partial run can be resumed and a full re-run is a zero diff.
//   3. Drift is migrated faithfully, not silently repaired. boxel 0112 says "superseded
//      by 0122" while its status reads Accepted; the migration writes exactly that, and
//      the linter then reports it as the R6 violation it has been for weeks. Papering
//      over it here would destroy the evidence and leave the linter unvalidated.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { scanLegacy, findDefects } from './scan-legacy.mjs';

/**
 * The 22 architectural ids from boxel's corpus survey: decisions later work must obey
 * (a mechanism, data format, or boundary). Everything else is a feature work-unit.
 *
 * Seeded from a hand survey rather than inferred. There is no textual signal that
 * separates the two kinds — that absence is the reason ADR-0002 exists — so a heuristic
 * here would be a guess wearing a script's authority.
 *
 * This is boxel's set, and it is only a default. The architectural set is per-repo — a
 * fact the deferred `/init-method` survey step exists to capture — so any other corpus
 * must pass its own via the `architecture` option (CLI: `--arch=0001,0002,...`).
 */
const DEFAULT_ARCHITECTURE = new Set(
  ['0001', '0002', '0003', '0004', '0005', '0006', '0009', '0010', '0011', '0012',
   '0013', '0014', '0021', '0025', '0036', '0041', '0051', '0054', '0057', '0068',
   '0122', '0123'],
);

/** Bundles several unrelated features and cannot map 1:1 to a work item (LEDGER audit). */
const isBatch = (record) => /\bbatch\b/i.test(record.title);

const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})\b/;

/**
 * Recovers the decision date.
 *
 * Preference order matters. The status blob's own date is the author's claim about when
 * the decision was made; the git date only says when the file landed. For design-first
 * ADRs those differ, and the document's own account wins.
 */
function resolveDate(root, record, text) {
  const header = text.split('\n').slice(0, 12).join('\n');
  const stated = header.match(ISO_DATE);
  if (stated) return { date: stated[1], source: 'stated' };

  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--format=%ad', '--date=short', '--', join('adr', record.file)],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const first = out.split('\n').filter(Boolean).pop();
    if (first) return { date: first, source: 'git' };
  } catch {
    // Not a git repo, or the file is untracked. Fall through.
  }

  return { date: null, source: 'none' };
}

/** Serialises the closed ADR-0002 schema. Ids stay quoted so `0112` survives as a string. */
function renderFrontmatter(fields) {
  const list = (ids) => `[${ids.map((i) => `'${i}'`).join(', ')}]`;
  return [
    '---',
    `id: '${fields.id}'`,
    `title: ${JSON.stringify(fields.title)}`,
    `type: ${fields.type}`,
    `status: ${fields.status}`,
    `date: ${fields.date}`,
    `supersedes: ${list(fields.supersedes)}`,
    `superseded_by: ${list(fields.superseded_by)}`,
    '---',
    '',
    '',
  ].join('\n');
}

export function planMigration(root, { architecture = DEFAULT_ARCHITECTURE } = {}) {
  const records = scanLegacy(root);

  return records.map((record) => {
    const path = join(root, 'adr', record.file);
    const text = readFileSync(path, 'utf8');

    if (text.startsWith('---\n')) {
      return { record, path, action: 'skip', reason: 'already has frontmatter' };
    }
    if (!record.status) {
      return { record, path, action: 'block', reason: `unmapped status "${record.legacyStatus}"` };
    }

    const { date, source } = resolveDate(root, record, text);
    if (!date) {
      return { record, path, action: 'block', reason: 'no date in header and none in git' };
    }

    const fields = {
      id: record.id,
      title: record.title,
      type: architecture.has(record.id) ? 'architecture' : isBatch(record) ? 'batch' : 'slice',
      status: record.status,
      date,
      supersedes: record.supersedes.sort(),
      superseded_by: record.supersededBy.sort(),
    };

    return { record, path, action: 'write', dateSource: source, fields,
             content: renderFrontmatter(fields) + text };
  });
}

function report(root, plan, verbose) {
  const counts = plan.reduce((a, p) => ({ ...a, [p.action]: (a[p.action] ?? 0) + 1 }), {});
  const writes = plan.filter((p) => p.action === 'write');

  const tally = (key) =>
    writes.reduce((a, p) => ({ ...a, [p.fields[key]]: (a[p.fields[key]] ?? 0) + 1 }), {});

  console.log(`${plan.length} ADR(s) in ${root}`);
  console.log('actions:', counts);
  console.log('type:   ', tally('type'));
  console.log('status: ', tally('status'));
  console.log('date:   ', writes.reduce((a, p) => ({ ...a, [p.dateSource]: (a[p.dateSource] ?? 0) + 1 }), {}));

  const blocked = plan.filter((p) => p.action === 'block');
  if (blocked.length) {
    console.log(`\n${blocked.length} blocked:`);
    for (const p of blocked) console.log(`  ${p.record.id}  ${p.reason}`);
  }

  // Supersession is the one field a reviewer must check by eye: it is recovered from
  // prose, and a wrong link marks a live decision dead.
  const linked = writes.filter((p) => p.fields.supersedes.length || p.fields.superseded_by.length);
  console.log(`\n${linked.length} with supersession links:`);
  for (const p of linked) {
    const f = p.fields;
    const arrows = [
      f.supersedes.length ? `supersedes ${f.supersedes.join(',')}` : '',
      f.superseded_by.length ? `superseded_by ${f.superseded_by.join(',')}` : '',
    ].filter(Boolean).join('  ');
    console.log(`  ${f.id}  [${f.status}]  ${arrows}`);
  }

  const defects = findDefects(plan.map((p) => p.record));
  console.log(`\n${defects.length} pre-existing defect(s), migrated as-is for the linter to catch:`);
  for (const d of defects) {
    console.log(`  ${d.kind.padEnd(16)} ${d.id}${d.target ? ` -> ${d.target}` : ` line ${d.line}`}`);
  }

  if (verbose) {
    console.log('\nfrontmatter to be written:\n');
    for (const p of writes) console.log(`--- ${p.record.file}\n${renderFrontmatter(p.fields)}`);
  }
}

function main(argv) {
  const root = argv.find((a) => !a.startsWith('--'));
  if (!root) {
    console.error('usage: migrate-adrs.mjs <repo-root> [--apply] [--verbose] [--arch=0001,0002,...]');
    return 2;
  }

  const archArg = argv.find((a) => a.startsWith('--arch='));
  const architecture = archArg
    ? new Set(archArg.slice('--arch='.length).split(',').map((s) => s.trim()).filter(Boolean))
    : undefined;

  const plan = planMigration(root, { architecture });
  report(root, plan, argv.includes('--verbose'));

  const blocked = plan.filter((p) => p.action === 'block');
  if (!argv.includes('--apply')) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply.`);
    return 0;
  }
  if (blocked.length) {
    console.error(`\nRefusing to apply: ${blocked.length} file(s) blocked. Resolve them first.`);
    return 1;
  }

  const writes = plan.filter((p) => p.action === 'write');
  for (const p of writes) writeFileSync(p.path, p.content);
  console.log(`\nWrote frontmatter to ${writes.length} file(s).`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
