#!/usr/bin/env node
// Mutation check over the linter's pure predicates (ADR-0004's probe idea, made standing).
//
//   node scripts/check-mutants.mjs [--quiet]
//
// Each mutant is a small, deliberate behaviour change. The suite is run against it: a
// mutant that dies proves a test was watching, one that SURVIVES proves the behaviour is
// unpinned and a refactor could reverse it in silence. Exit 1 if any non-exempt mutant
// survives.
//
// Scope is the class of decision a mutant can prove, not a list of files (ADR-0028,
// amending ADR-0022): an entry belongs here when it reverses a decision the code makes and
// the test that should notice is a test of that decision. What stays out is a mutant that
// would mostly prove the filesystem, the network or git still works — init-method's
// copy-and-symlink behaviour, the git-reading half of build-changelog. The pre-commit hook
// is shell, not JS, so it is out for a different reason entirely.
//
// What this does NOT buy, stated so a green run is not read as more than it is: none of the
// three defects this repo has actually suffered would have been caught. Two were missing
// inputs and one was a wrong specification; mutation testing perturbs code and asks whether
// tests notice, so it is blind to a case nobody wrote and to a rule that was wrong from the
// start. It measures regression durability, not correctness (LEDGER).

import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const LINTER = 'scripts/lint-docs.mjs';
const IMMUTABLE = 'scripts/check-immutable.mjs';

/** Only `classifyVendored` (ADR-0023) is in scope here — it reverses a verdict, where a
 *  mutant over the installer's copy-and-symlink work would mostly prove the filesystem
 *  still works (ADR-0028, clause 2). */
const INIT = 'scripts/init-method.mjs';

/** The changelog's type classifier and its ordering are total and IO-free, so they fall in
 *  the same scope as the linter's predicates — the git-reading half does not (ADR-0026). */
const CHANGELOG = 'scripts/build-changelog.mjs';

/**
 * The Claude Code lifecycle hooks (ADR-0027). These read the filesystem, and are in scope
 * because each mutant below reverses a decision rather than the file read that carries it
 * (ADR-0028).
 *
 * They earn the runtime: this layer is advisory by ADR-0027, so a defect here is not caught
 * by a red build the way a linter defect is — it is caught by nobody.
 */
const HOOK_LINT = '.claude/hooks/post-tool-lint.mjs';
const HOOK_DIGEST = '.claude/hooks/session-digest.mjs';

/**
 * The curated mutant list. Each entry names one behaviour and the smallest edit that
 * reverses it.
 *
 * Hand-picked rather than generated: a generator emits hundreds of mutants over these files
 * and most are equivalent or trivial, so the triage cost — not the runtime — is what makes
 * a framework a bad trade here. Curating is the work; the runner is twenty lines.
 *
 * `equivalent` marks a mutant that cannot be killed because the mutated code means the same
 * thing. It is kept rather than deleted, so nobody re-adds it as a "gap", and it must carry
 * the reason it is exempt.
 */
export const MUTANTS = [
  {
    label: 'normId: pad ids to 3 digits instead of 4',
    file: LINTER,
    find: "String(v).trim().padStart(4, '0')",
    replace: "String(v).trim().padStart(3, '0')",
  },
  {
    label: 'isCalendarDate: drop the round-trip check',
    file: LINTER,
    find: 'return parsed.toISOString().startsWith(text);',
    replace: 'return true;',
  },
  {
    label: 'citableText: stop stripping URLs before matching citations',
    file: LINTER,
    find: ".replace(/\\S*:\\/\\/\\S*/g, '')",
    replace: '',
  },
  {
    label: 'citableText: stop stripping code spans before matching citations',
    file: LINTER,
    find: "text.replace(CODE_SPAN, '')",
    replace: 'text',
  },
  {
    label: 'CODE_SPAN: let a span cross lines, so one stray backtick swallows the body',
    file: LINTER,
    find: 'const CODE_SPAN = /(`+)(?:(?!\\1)[^\\n])*?\\1/g;',
    replace: 'const CODE_SPAN = /(`+)(?:(?!\\1)[\\s\\S])*?\\1/g;',
  },
  {
    label: 'inReadScope: drop the exact-match branch, keeping only the prefix',
    file: LINTER,
    find: 'rootRelative === entry || rootRelative.startsWith(`${entry}/`)',
    replace: 'rootRelative.startsWith(`${entry}/`)',
  },
  {
    label: 'withoutFences: stop blanking lines inside a code fence',
    file: LINTER,
    find: "return open === null ? line : '';",
    replace: 'return line;',
  },
  {
    label: 'sectionText: read to end of body instead of stopping at the next heading',
    file: LINTER,
    find: "(end === -1 ? rest : rest.slice(0, end)).join('\\n')",
    replace: "rest.join('\\n')",
  },
  {
    label: 'hasGherkinTriad: require any step kind rather than all three',
    file: LINTER,
    find: "steps.has('given') && steps.has('when') && steps.has('then')",
    replace: "steps.has('given') || steps.has('when') || steps.has('then')",
  },
  {
    label: 'R6: ignore a superseded_by list of exactly one target',
    file: LINTER,
    find: 'if (!isSuperseded && supersededBy.length > 0) {',
    replace: 'if (!isSuperseded && supersededBy.length > 1) {',
  },
  {
    label: 'classifyVendored: treat an unrecorded command as stale rather than unknown',
    file: INIT,
    find: "if (recordedDigest === undefined) return 'unknown';",
    replace: "if (recordedDigest === undefined) return 'stale';",
  },
  {
    label: 'classifyVendored: swap the stale/adapted verdict',
    file: INIT,
    find: "return digest(targetText) === recordedDigest ? 'stale' : 'adapted';",
    replace: "return digest(targetText) === recordedDigest ? 'adapted' : 'stale';",
  },
  {
    label: 'firstLostLine: weaken the exhausted-scan guard',
    file: IMMUTABLE,
    find: 'if (cursor === now.length) return i;',
    replace: 'if (cursor > now.length) return i;',
  },
  {
    label: 'commitType: accept a subject with no colon as conventional',
    file: CHANGELOG,
    find: "/^([a-z]+)(\\([^)]*\\))?!?:/",
    replace: "/^([a-z]+)(\\([^)]*\\))?!?:?/",
  },
  {
    label: 'typeRank: sort an unrecognised type first rather than last',
    file: CHANGELOG,
    find: 'return index === -1 ? TYPE_ORDER.length : index;',
    replace: 'return index === -1 ? 0 : index;',
  },
  {
    label: 'post-tool-lint: drop the read-scope gate, so any edit lints the whole corpus',
    file: HOOK_LINT,
    find: "if (editedRelative !== null && !inReadScope(editedRelative)) return { exitCode: 0, stderr: '' };",
    replace: '',
  },
  {
    label: 'post-tool-lint: gate on any file path, absolute or not',
    file: HOOK_LINT,
    find: "typeof edited === 'string' && isAbsolute(edited)",
    replace: "typeof edited === 'string'",
  },
  {
    label: 'post-tool-lint: block on warnings as well as errors',
    file: HOOK_LINT,
    find: "f.severity === 'error'",
    replace: "f.severity !== 'error'",
  },
  {
    label: 'post-tool-lint: print every finding instead of capping the list',
    file: HOOK_LINT,
    find: 'ranked.slice(0, MAX_FINDINGS_SHOWN)',
    replace: 'ranked.slice(0)',
  },
  {
    label: "post-tool-lint: report in corpus order, not the edited file's findings first",
    file: HOOK_LINT,
    find: 'const ranked = [...errors.filter(isEdited), ...errors.filter((f) => !isEdited(f))];',
    replace: 'const ranked = [...errors];',
  },
  {
    label: 'session-digest: stop making room for the truncation notice',
    file: HOOK_DIGEST,
    find: 'used + Buffer.byteLength(notice(items.length - kept)) > DIGEST_BUDGET_BYTES',
    replace: 'false',
  },
  {
    label: "session-digest: leave the digest's trailing newline out of the budget",
    file: HOOK_DIGEST,
    find: 'const fixed = Buffer.byteLength(head) + Buffer.byteLength(tail) + 1;',
    replace: 'const fixed = Buffer.byteLength(head) + Buffer.byteLength(tail);',
  },
  {
    label: 'session-digest: read every section, so resolved items are injected as open work',
    file: HOOK_DIGEST,
    find: "inOpen = line.trim() === '## Open';",
    replace: 'inOpen = true;',
  },
  {
    label: 'session-digest: unanchor the item pattern, so a sub-item counts as an item',
    file: HOOK_DIGEST,
    find: "/^- \\[[a-z]+\\] /.test(line)",
    replace: "/- \\[[a-z]+\\] /.test(line)",
  },
  {
    label: 'firstLostLine: compare body lines loosely',
    file: IMMUTABLE,
    find: 'while (cursor < now.length && now[cursor] !== was[i]) cursor++;',
    replace: 'while (cursor < now.length && now[cursor] != was[i]) cursor++;',
    equivalent: 'both operands are strings, so != and !== are the same comparison',
  },
];

/**
 * A disposable copy of the working tree. The check never edits the operator's files: a run
 * interrupted midway would otherwise leave mutated source behind, and "my linter is subtly
 * wrong and I do not know why" is an expensive afternoon.
 *
 * `.git` is copied with everything else, because the copy has to behave identically or the
 * baseline below fails for reasons that have nothing to do with any mutant. `migrate-adrs`
 * reads commit dates and falls back silently when git cannot answer, so a hollow `.git`
 * changed its plan and failed five tests. At 3.2MB the copy is not worth being clever about.
 */
function scratchCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'stele-mutants-'));
  cpSync(ROOT, dir, { recursive: true, filter: (src) => !src.endsWith('/node_modules') });
  return dir;
}

/**
 * `test/mutants.test.mjs` guards this script's own list by asserting every anchor matches
 * exactly once. Applying a mutant is precisely what stops an anchor matching, so under a
 * mutated tree that test fails — and every mutant would be scored as killed by the guard
 * rather than by any regression test, including the equivalent one that cannot be killed
 * at all. It runs in the ordinary suite, where it belongs, and is excluded here.
 */
const SELF_REFERENTIAL = 'mutants.test.mjs';

/** The suite's files, expanded here rather than by a shell: `node --test test/` reads that
 *  argument as a module path and dies, which is not a test failure but looks exactly like
 *  one from the outside. */
function testFiles(cwd) {
  const dir = join(cwd, 'test');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.test.mjs') && f !== SELF_REFERENTIAL)
    .sort();
  if (files.length === 0) throw new Error(`no test files under ${dir} — nothing to run mutants against`);
  return files.map((f) => join('test', f));
}

/** True when the suite passes — i.e. the mutant went unnoticed. */
function suitePasses(cwd, files) {
  try {
    execFileSync(process.execPath, ['--test', ...files], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function checkMutants({ quiet = false } = {}) {
  const dir = scratchCopy();
  const survivors = [];
  try {
    const files = testFiles(dir);

    // The load-bearing guard. Every verdict here is "the suite failed, so something was
    // watching" — which is worthless if the suite fails for its own reasons, and reports a
    // perfect score while testing nothing. The first draft of this script did exactly that:
    // it ran `node --test test/`, which is not a directory glob, so all ten mutants "died"
    // in 621ms against a suite that never started.
    if (!suitePasses(dir, files)) {
      throw new Error(
        'the unmutated suite does not pass — every mutant would report as killed for the\n' +
        'wrong reason. Fix the suite first, then re-run this check.',
      );
    }

    for (const mutant of MUTANTS) {
      const path = join(dir, mutant.file);
      const pristine = readFileSync(path, 'utf8');

      // A rotted anchor is a failure, never a skip. The alternative is a probe that quietly
      // stops testing what it claims to — the exact false green this repo exists to remove.
      const hits = pristine.split(mutant.find).length - 1;
      if (hits !== 1) {
        throw new Error(
          `mutant anchor matched ${hits} times in ${mutant.file}, expected exactly 1:\n` +
          `  ${mutant.label}\n` +
          `  The code moved. Re-aim the mutant at the behaviour it was written for, or ` +
          `delete it if that behaviour is gone.`,
        );
      }

      writeFileSync(path, pristine.replace(mutant.find, mutant.replace));
      const survived = suitePasses(dir, files);
      writeFileSync(path, pristine);

      // An equivalent mutant that dies is the canary, not a bonus. It cannot be detected by
      // any honest test, so a kill means the suite failed for a reason unrelated to the
      // mutation and every other verdict in this run is worthless. Both times this harness
      // scored wrongly — the crashing test command, then the self-referential guard — this
      // is the line that showed it.
      if (mutant.equivalent && !survived) {
        throw new Error(
          `an equivalent mutant was killed, which cannot happen honestly:\n` +
          `  ${mutant.label}\n` +
          `  exempt because: ${mutant.equivalent}\n` +
          `  The suite is failing for a reason unrelated to the mutation, so every other\n` +
          `  verdict in this run is meaningless. Run the suite by hand and find out why.`,
        );
      }

      if (survived && !mutant.equivalent) survivors.push(mutant);
      if (!quiet) {
        const verdict = mutant.equivalent ? 'exempt   (equivalent)' : (survived ? 'SURVIVED' : 'killed');
        console.log(`  ${verdict.padEnd(24)} ${mutant.label}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return survivors;
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  if (!quiet) console.log(`\n${ROOT} — ${MUTANTS.length} mutant(s)`);

  const survivors = checkMutants({ quiet });
  const exempt = MUTANTS.filter((m) => m.equivalent).length;

  if (survivors.length === 0) {
    console.log(`\nall ${MUTANTS.length - exempt} non-exempt mutant(s) killed, ${exempt} exempt`);
    return 0;
  }

  console.log(`\n${survivors.length} mutant(s) survived — the behaviour below is unpinned:`);
  for (const m of survivors) console.log(`  ${m.file}: ${m.label}`);
  console.log(
    '\nEach needs a regression test, or — if the mutated code genuinely means the same thing\n' +
    '— an `equivalent` note on the mutant saying why it cannot be killed.',
  );
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
