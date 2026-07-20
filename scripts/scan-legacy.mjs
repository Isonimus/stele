#!/usr/bin/env node
// Reads UNMIGRATED ADRs and recovers their status and supersession claims from prose.
//
// Two jobs, deliberately in one place:
//   1. It is the input to migrate-adrs.mjs — the facts that become frontmatter.
//   2. It is the known-answer test (ADR-0003): run against boxel it must independently
//      rediscover exactly the four catalogued defects and nothing else. A scanner that
//      finds three, or five, is wrong and must not be trusted to drive a migration.
//
// Three claim sources, each matched to a dialect's structure — see extractSupersession.
// Every widening of them cost a false positive somewhere, so each is deliberately narrow.
//
//   node scripts/scan-legacy.mjs <repo-root> [--json] [--defects]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const normId = (v) => String(v).trim().padStart(4, '0');

/** Legacy status vocabulary -> the ADR-0002 closed set. */
const STATUS_MAP = {
  accepted: 'accepted',
  implemented: 'accepted', // used exactly once (boxel 0129)
  proposed: 'proposed',
  superseded: 'superseded',
  amended: 'amended',
};

/**
 * Recovers the status value across all three dialects.
 *
 * Anchoring matters more than pattern breadth here. `0095-status-effects.md` has an H1
 * reading "# ADR 0095 — Status effects: ...", so a first-hit grep for /status/i returns
 * the title. Every pattern below is anchored to line-start structure the title cannot
 * satisfy, which defeats that hazard structurally rather than by special-casing.
 */
function extractStatus(lines) {
  // Dialect A (68 files): "## Status" heading, value on the next non-empty line.
  const heading = lines.findIndex((l) => /^#{2,3}\s+Status\s*$/i.test(l.trim()));
  if (heading !== -1) {
    for (let i = heading + 1; i < Math.min(heading + 5, lines.length); i++) {
      if (lines[i].trim()) return { raw: lines[i], line: i + 1, dialect: 'heading' };
    }
  }

  for (let i = 0; i < Math.min(12, lines.length); i++) {
    const line = lines[i];
    // Dialect C (8 files, gamatar): "- Status: superseded (2026-07-20) by [ADR-0008](...)"
    const bullet = line.match(/^\s*[-*]\s*\*{0,2}Status\*{0,2}\s*:\s*(.+)$/i);
    if (bullet) return { raw: bullet[1], line: i + 1, dialect: 'bullet' };

    // Dialect B (62 files): bare "Status: ..." heading a multi-paragraph prose blob.
    const inline = line.match(/^\*{0,2}Status\*{0,2}\s*:\s*(.+)$/i);
    if (inline) return { raw: inline[1], line: i + 1, dialect: 'inline' };
  }

  return null;
}

/**
 * Reduces a raw status blob to one vocabulary token.
 *
 * The inline dialect opens a blob that runs to the next `## ` heading, so the value must
 * terminate at the first sentence/parenthetical boundary rather than at end-of-line.
 */
function normaliseStatus(raw) {
  const head = raw
    .replace(/\*\*/g, '')
    .split(/[.;(]/)[0]
    .trim()
    .toLowerCase();

  for (const [legacy, mapped] of Object.entries(STATUS_MAP)) {
    if (head.startsWith(legacy)) return { status: mapped, legacy: head };
  }
  return { status: null, legacy: head };
}

const idsIn = (s) => [...s.matchAll(/ADR[-\s]*(\d{2,4})\b/gi)].map((m) => normId(m[1]));

/** Bold spans, which may wrap across source lines. */
const BOLD_SPAN = /\*\*([^*]+?)\*\*/gs;

/** How far past a bold span to look for the target id, in characters. `**Superseded by
 *  ADR 0122**` carries it inside; a span ending at the colon may carry it just after. */
const LOOKAHEAD = 80;

/**
 * Recovers supersession claims and flags claims that name no target.
 *
 * The discriminator is **bold**, not line position. Across all ten supersession-shaped
 * lines in boxel this separates the four genuine claims from the six traps perfectly,
 * and it is semantically honest: authors bolded exactly the ones they meant as status
 * declarations. Line-start anchoring appeared to work only by accident — boxel 0112
 * reads `**Placement\nsuperseded by ADR 0122**`, where the word reaches column zero
 * purely because of where the paragraph happened to wrap. Rewrapping that file would
 * have silently hidden a real defect.
 */
function extractSupersession(text, lines, status, selfId) {
  const supersedes = new Set();
  const supersededBy = new Set();
  const dangling = [];

  const lineAt = (index) => text.slice(0, index).split('\n').length;

  /** "superseded by X" is passive and inverts the direction of "supersedes X". */
  const record = (word, targets) => {
    const set = /^superseded$/i.test(word) ? supersededBy : supersedes;
    for (const t of targets) set.add(t);
  };

  const targetsIn = (s) => [...new Set(idsIn(s))].filter((id) => id !== selfId);

  // Source 1 — the status field, but ONLY in the bullet dialect:
  //   "- Status: superseded (2026-07-20) by [ADR-0008](...)"
  //
  // Restricting this to `bullet` is the whole point. There, status is a structured
  // one-line field and its content is a declaration by position. In the heading and
  // inline dialects the "status" is a multi-sentence paragraph — boxel 0051's runs
  // "**Accepted** (2026-07-06). Design locked before any code. Supersedes the scattered
  // IOUs in 0022, 0025, 0026, 0044." — where a supersession word is ordinary prose and
  // carries no declarative weight. For those dialects, bold (Source 3) is the signal.
  if (status?.dialect === 'bullet' && status.raw) {
    const word = status.raw.match(/(supersed\w+)/i)?.[1];
    if (word) {
      const targets = targetsIn(status.raw);
      if (targets.length) record(word, targets);
      else dangling.push({ line: status.line, text: status.raw.slice(0, 90), word: word.toLowerCase() });
    }
  }

  // Source 2 — a field-form bullet: "- Supersedes: [ADR-0005](...)".
  //
  // The colon must follow the word immediately. gamatar 0007 reads "- Supersedes no ADR:
  // ADR-0001's procedural-parts decision is unchanged" — a bullet that declares it
  // supersedes *nothing* while naming an ADR. Accepting a colon anywhere on the line
  // would mark ADR-0001, a live architecture decision, as dead. gamatar 0006's
  // "- Supersedes the parenthetical in [ADR-0002]" is the same trap without a colon:
  // it retires a parenthetical inside that ADR, not the decision.
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s*\*{0,2}(Supersedes|Superseded by)\*{0,2}\s*:/i);
    if (!m) continue;
    const word = m[1].toLowerCase().startsWith('superseded') ? 'superseded' : 'supersedes';
    const targets = targetsIn(line);
    if (targets.length) record(word, targets);
  }

  // Source 3 — bold spans (boxel's dialect).
  for (const m of text.matchAll(BOLD_SPAN)) {
    const span = m[1].replace(/\s+/g, ' ');
    const word = span.match(/(supersed\w+)/i)?.[1];
    if (!word) continue;

    const window = span + ' ' + text.slice(m.index + m[0].length, m.index + m[0].length + LOOKAHEAD);
    const targets = [...new Set(idsIn(window))].filter((id) => id !== selfId);

    if (targets.length === 0) {
      dangling.push({ line: lineAt(m.index), text: span.slice(0, 90), word: word.toLowerCase() });
      continue;
    }
    record(word, targets);
  }

  return { supersedes: [...supersedes], supersededBy: [...supersededBy], dangling };
}

export function scanLegacy(root) {
  const dir = join(root, 'adr');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md' && /^\d/.test(f))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      const lines = text.split('\n');
      const id = normId(file.match(/^(\d{1,4})/)[1]);

      const found = extractStatus(lines);
      const { status, legacy } = found
        ? normaliseStatus(found.raw)
        : { status: null, legacy: null };

      const title = (lines.find((l) => l.startsWith('# ')) || `# ${file}`)
        .replace(/^#\s*/, '')
        .replace(/^ADR[-\s]*\d+\s*[—–:-]\s*/i, '')
        .trim();

      return {
        id,
        file,
        title,
        status,
        legacyStatus: legacy,
        dialect: found?.dialect ?? null,
        statusLine: found?.line ?? null,
        ...extractSupersession(text, lines, found, id),
      };
    });
}

/** The defect classes the linter's R4/R5 will enforce once frontmatter exists. */
export function findDefects(records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const defects = [];

  for (const r of records) {
    for (const target of r.supersededBy) {
      const t = byId.get(target);
      if (!t) {
        defects.push({ kind: 'missing-target', id: r.id, target });
      } else if (!t.supersedes.includes(r.id)) {
        defects.push({ kind: 'one-way', id: r.id, target });
      }
    }
    for (const target of r.supersedes) {
      const t = byId.get(target);
      if (t && !t.supersededBy.includes(r.id)) {
        defects.push({ kind: 'one-way-reverse', id: r.id, target });
      }
    }
    for (const d of r.dangling) {
      defects.push({ kind: 'dangling', id: r.id, line: d.line, text: d.text });
    }
  }
  return defects;
}

function main(argv) {
  const root = argv.find((a) => !a.startsWith('--')) ?? process.cwd();
  const records = scanLegacy(root);

  if (argv.includes('--json')) {
    console.log(JSON.stringify(records, null, 2));
    return 0;
  }

  const defects = findDefects(records);

  if (!argv.includes('--defects')) {
    const dialects = {};
    const statuses = {};
    for (const r of records) {
      dialects[r.dialect ?? 'NONE'] = (dialects[r.dialect ?? 'NONE'] ?? 0) + 1;
      statuses[r.status ?? `UNMAPPED:${r.legacyStatus}`] =
        (statuses[r.status ?? `UNMAPPED:${r.legacyStatus}`] ?? 0) + 1;
    }
    console.log(`${records.length} ADR(s) in ${root}`);
    console.log('dialects:', dialects);
    console.log('statuses:', statuses);
  }

  console.log(`\n${defects.length} defect(s):`);
  for (const d of defects) {
    if (d.kind === 'dangling') {
      console.log(`  ${d.kind.padEnd(16)} ADR ${d.id} line ${d.line}: "${d.text}"`);
    } else {
      console.log(`  ${d.kind.padEnd(16)} ADR ${d.id} -> ${d.target}`);
    }
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
