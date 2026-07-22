#!/usr/bin/env node
// Checks the document invariants defined in ADR-0003.
//
// Zero dependencies by design: this drops into any repo regardless of package manager.
// The frontmatter schema (ADR-0002) is a closed seven-field shape, small enough to parse
// by hand and not worth a YAML dependency.
//
//   node scripts/lint-docs.mjs [repo-root ...]     (default: cwd)
//   --quiet   only print problems
//
// Exit 1 if any error-severity rule fails. Warnings never fail the build.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const STATUSES = ['accepted', 'proposed', 'superseded', 'amended'];
const TYPES = ['architecture', 'slice', 'batch'];
const REQUIRED = ['id', 'title', 'type', 'status', 'date'];
const DOC_DIRS = ['adr', 'slices'];

// --- frontmatter ------------------------------------------------------------

/** Ids are always 4-digit strings. Normalising early sidesteps YAML's octal reading of
 *  bare 0112 and makes ids safe as object keys. */
const normId = (v) => String(v).trim().padStart(4, '0');

const isId = (v) => /^\d{1,4}$/.test(String(v).trim());

/**
 * Parses a flat scalar: quoted string, inline list, or bare value.
 *
 * A double-quoted value is decoded as a JSON string, because that is how the migrator
 * emits free-text titles (`"Status effects: \"poison\"…"`). The two must share one
 * escaping convention or a title with an inner quote round-trips wrong: migrated clean,
 * misread at lint. Single-quoted values (ids) carry no escapes and only shed their quotes.
 */
function parseScalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseScalar(s));
  }
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v.replace(/^'|'$/g, '');
}

/**
 * Hand-rolled frontmatter reader for the ADR-0002 schema.
 * Supports `key: value`, inline lists `[a, b]`, and block lists (`-` items).
 * Returns { ok, data, body, error }.
 */
export function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') {
    return { ok: false, error: 'no frontmatter (file must open with ---)' };
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) return { ok: false, error: 'frontmatter is not terminated by ---' };

  const data = {};
  let currentKey = null;

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const blockItem = line.match(/^\s*-\s+(.*)$/);
    if (blockItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(parseScalar(blockItem[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) return { ok: false, error: `unparseable frontmatter line ${i + 1}: "${line}"` };

    const [, key, rest] = kv;
    currentKey = key;
    data[key] = rest.trim() === '' ? [] : parseScalar(rest);
  }

  return { ok: true, data, body: lines.slice(end + 1).join('\n') };
}

// --- loading ----------------------------------------------------------------

export function loadDocs(root) {
  const dirs = DOC_DIRS.map((d) => join(root, d)).filter(existsSync);
  const docs = [];

  for (const dir of dirs) {
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.md') || file === 'INDEX.md') continue;
      const path = join(dir, file);
      const parsed = parseFrontmatter(readFileSync(path, 'utf8'));
      docs.push({ path, file, kind: basename(dir), ...parsed });
    }
  }
  return docs;
}

// --- rules ------------------------------------------------------------------
// Each rule is (docs, root, report) => void. `report` takes (severity, path, message).
// Every rule traces to an observed failure; see the table in ADR-0003.

const rules = {
  // R10 — a linter that finds nothing must not report success. Pointed at `boxel/adr`
  // rather than the repo root, this printed "0 document(s) — ok" and exited 0: a hook
  // wired to a wrong path would go green forever while checking nothing, which is the
  // exact failure mode this file exists to prevent.
  //
  // Severity splits on *why* the corpus is empty. No adr/ or slices/ at all means the
  // root is wrong — no repo using this method lacks both, so that is an error. Dirs that
  // exist but hold no documents are a correctly-scaffolded repo that has not written its
  // first ADR yet; erroring there would fail `npm run lint` during install, so it warns.
  corpus(docs, root, report) {
    if (docs.length > 0) return;
    const present = DOC_DIRS.filter((d) => existsSync(join(root, d)));
    if (present.length === 0) {
      report('error', root, `R10 no ${DOC_DIRS.join('/ or ')}/ directory here — is this the repo root?`);
    } else {
      report('warn', root, `R10 ${present.map((d) => `${d}/`).join(' and ')} present but empty — no documents to check`);
    }
  },

  // R1 — frontmatter present, parseable, required fields non-empty.
  frontmatter(docs, _root, report) {
    for (const d of docs) {
      if (!d.ok) {
        report('error', d.path, `R1 ${d.error}`);
        continue;
      }
      for (const field of REQUIRED) {
        const v = d.data[field];
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
          report('error', d.path, `R1 missing required field "${field}"`);
        }
      }
    }
  },

  // R2 — id matches the filename ordinal; no duplicates. Slug is not a key:
  // 0068-lava-fluid and 0128-lava-fluid share one, as do the three farming files.
  ids(docs, _root, report) {
    const seen = new Map();
    for (const d of docs) {
      if (!d.ok || d.data.id === undefined) continue;
      const id = normId(d.data.id);

      if (!isId(d.data.id)) {
        report('error', d.path, `R2 id "${d.data.id}" is not a number`);
        continue;
      }
      const fromName = d.file.match(/^(\d{1,4})/);
      if (!fromName) {
        report('error', d.path, `R2 filename does not start with an ordinal`);
      } else if (normId(fromName[1]) !== id) {
        report('error', d.path, `R2 id ${id} does not match filename ordinal ${normId(fromName[1])}`);
      }

      if (seen.has(id)) {
        report('error', d.path, `R2 duplicate id ${id} (also in ${basename(seen.get(id))})`);
      } else {
        seen.set(id, d.path);
      }
    }
  },

  // R3 — closed vocabularies. Legacy carried Implemented/ACCEPTED/**Accepted**.
  vocabulary(docs, _root, report) {
    for (const d of docs) {
      if (!d.ok) continue;
      const { status, type } = d.data;
      if (status !== undefined && !STATUSES.includes(status)) {
        report('error', d.path, `R3 status "${status}" not in [${STATUSES.join(', ')}]`);
      }
      if (type !== undefined && !TYPES.includes(type)) {
        report('error', d.path, `R3 type "${type}" not in [${TYPES.join(', ')}]`);
      }
    }
  },

  // R4/R5/R6/R7 — the supersession graph. These share an index, so they run together.
  supersession(docs, _root, report) {
    const byId = new Map();
    for (const d of docs) {
      if (d.ok && d.data.id !== undefined && isId(d.data.id)) byId.set(normId(d.data.id), d);
    }
    const listOf = (d, key) => {
      const v = d.data[key];
      if (v === undefined) return [];
      return (Array.isArray(v) ? v : [v]).filter((x) => x !== '').map(normId);
    };

    for (const [id, d] of byId) {
      const supersededBy = listOf(d, 'superseded_by');
      const supersedes = listOf(d, 'supersedes');

      // R5 — dangling references. Legacy 0051 and 0061 claimed supersession with no
      // resolvable target at all.
      for (const key of ['supersedes', 'superseded_by']) {
        for (const ref of listOf(d, key)) {
          if (!byId.has(ref)) report('error', d.path, `R5 ${key} references ADR ${ref}, which does not exist`);
        }
      }

      // R4 — bidirectionality. This is the 0112/0113/0114 -> 0122 defect: each declared
      // itself superseded, and 0122 acknowledged none of them.
      for (const ref of supersededBy) {
        const target = byId.get(ref);
        if (target && !listOf(target, 'supersedes').includes(id)) {
          report('error', d.path, `R4 declares superseded_by ${ref}, but ADR ${ref} does not list ${id} in supersedes`);
        }
      }
      for (const ref of supersedes) {
        const target = byId.get(ref);
        if (target && !listOf(target, 'superseded_by').includes(id)) {
          report('error', d.path, `R4 declares it supersedes ${ref}, but ADR ${ref} does not list ${id} in superseded_by`);
        }
      }

      // R6 — status and supersession must agree. Legacy 0112/0114 read
      // "Status: Accepted" four lines above "Superseded by ADR 0122".
      const isSuperseded = d.data.status === 'superseded';
      if (isSuperseded && supersededBy.length === 0) {
        report('error', d.path, `R6 status is superseded but superseded_by is empty`);
      }
      if (!isSuperseded && supersededBy.length > 0) {
        report('error', d.path, `R6 superseded_by names ${supersededBy.join(', ')} but status is "${d.data.status}"`);
      }
    }

    // R7 — the same disagreement seen from the other side: B claims to supersede A while
    // A still reads as live. R6 cannot catch this when A says nothing at all.
    for (const [id, d] of byId) {
      for (const ref of listOf(d, 'supersedes')) {
        const target = byId.get(ref);
        if (target && target.data.status === 'accepted') {
          report('error', target.path, `R7 is "accepted" but ADR ${id} claims to supersede it`);
        }
      }
    }
  },

  // R8 — ledger citations resolve. The ledger is the only mutable file (ADR-0001);
  // if it cites a decision, that decision must exist.
  ledger(docs, root, report) {
    const path = join(root, 'LEDGER.md');
    if (!existsSync(path)) return;
    const ids = new Set(docs.filter((d) => d.ok && d.data.id !== undefined).map((d) => normId(d.data.id)));

    const text = readFileSync(path, 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/ADR[-\s](\d{1,4})/g)) {
        if (!ids.has(normId(m[1]))) {
          report('error', path, `R8 line ${i + 1} cites ADR ${normId(m[1])}, which does not exist`);
        }
      }
    });
  },

  // R11 — every verify script is wired into package.json (ADR-0004). The harness's
  // load-bearing half: an unwired `*-verify.mjs` ran once on the day it was written and
  // never again — ADR-0004 Finding 2 found eleven of twelve boxel scripts in exactly that
  // state. This is the first *harness* rule; R1–R9 (and R10) check documents. It reads
  // scripts/ and package.json, never CLAUDE.md, so no prose enters the checked surface.
  //
  // Probes are excluded by name: a probe answers a design question once and its number
  // goes in an ADR, so it is not a standing regression and is not required to be wired.
  harnessWiring(_docs, root, report) {
    const scriptsDir = join(root, 'scripts');
    const pkgPath = join(root, 'package.json');
    if (!existsSync(scriptsDir) || !existsSync(pkgPath)) return;

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch (err) {
      report('error', pkgPath, `R11 package.json is not valid JSON: ${err.message}`);
      return;
    }

    // A script is wired if its filename is the basename of a token in any npm command.
    // Tokenising and comparing basenames — rather than a substring test — is what keeps
    // `a-verify.mjs` from matching a runner that only mentions `xa-verify.mjs`, and lets
    // one aggregate command (`node scripts/a.mjs && node scripts/b.mjs`) wire both.
    const wired = new Set(
      Object.values(pkg.scripts ?? {})
        .flatMap((cmd) => String(cmd).split(/[\s'"]+/))
        .map((tok) => basename(tok)),
    );

    for (const file of readdirSync(scriptsDir).sort()) {
      if (!/-verify\.(mjs|mts)$/.test(file)) continue;
      if (!wired.has(file)) {
        report('error', join(scriptsDir, file), `R11 ${file} is not wired into package.json — it would run never`);
      }
    }
  },

  // R9 — prose cross-references. Warning only, deliberately: boxel carries 567 bare
  // references, some pointing at external or historical context. Failing the build on
  // those would make the linter something to disable rather than obey.
  proseRefs(docs, _root, report) {
    const ids = new Set(docs.filter((d) => d.ok && d.data.id !== undefined).map((d) => normId(d.data.id)));
    for (const d of docs) {
      if (!d.ok || !d.body) continue;
      const unresolved = new Set();
      for (const m of d.body.matchAll(/ADR[-\s](\d{1,4})/g)) {
        if (!ids.has(normId(m[1]))) unresolved.add(normId(m[1]));
      }
      for (const ref of [...unresolved].sort()) {
        report('warn', d.path, `R9 prose references ADR ${ref}, which does not exist`);
      }
    }
  },
};

// --- runner -----------------------------------------------------------------

export function lint(root) {
  const docs = loadDocs(root);
  const findings = [];
  const report = (severity, path, message) => findings.push({ severity, path, message });
  for (const rule of Object.values(rules)) rule(docs, root, report);
  return { docs, findings };
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const roots = argv.filter((a) => !a.startsWith('--'));
  if (roots.length === 0) roots.push(process.cwd());

  let errors = 0;
  let warnings = 0;

  for (const root of roots) {
    const { docs, findings } = lint(root);
    const errs = findings.filter((f) => f.severity === 'error');
    const warns = findings.filter((f) => f.severity === 'warn');
    errors += errs.length;
    warnings += warns.length;

    if (!quiet || findings.length) {
      console.log(`\n${root} — ${docs.length} document(s)`);
    }
    for (const f of [...errs, ...warns]) {
      const tag = f.severity === 'error' ? 'ERROR' : ' WARN';
      // Corpus-level findings are reported against the root itself; basename would render
      // it as "adr: no adr/ directory here", which reads as a contradiction.
      const where = f.path === root ? root : basename(f.path);
      console.log(`  ${tag}  ${where}: ${f.message}`);
    }
    if (!findings.length && !quiet) console.log('  ok');
  }

  const summary = `\n${errors} error(s), ${warnings} warning(s)`;
  if (!quiet || errors || warnings) console.log(summary);
  return errors > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
