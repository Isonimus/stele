// Every citation in text this repo vendors must be qualified (ADR-0020). Run: node --test
//
// This is a test rather than a lint rule because only the *source* repo knows which of its
// files get copied elsewhere. Pointed at an installed repo the linter sees the same files
// and must reach the opposite verdict: a repo that adapts its commands (ADR-0007) and cites
// its own decisions bare is correct, so a rule here would fail it wrongly.
//
// The defect this guards against does not look like a defect from either side. gamatar's
// vendored `/remember` read "the exact failure ADR-0005 exists to prevent"; gamatar:ADR-0005
// is a superseded decision about canvas face textures, and its corpus lints green,
// because the citation resolves — to the wrong record.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADAPTABLE_DOCS } from '../scripts/init-method.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Bare `ADR-NNNN` — no `<repo>:` qualifier immediately before it. Mirrors the linter's
 *  CITATION pattern; a leading character class stands in for the absent qualifier. */
const BARE_CITATION = /(^|[^:\w.-])(ADR[-\s]\d{1,4})/g;

/** The text vendored verbatim into installed repos: slash commands (ADR-0007), the scaffold
 *  templates (ADR-0006), and the adaptable docs (ADR-0024).
 *
 *  The directories are read from disk so a new file is covered on arrival rather than when
 *  someone remembers to extend a list. The docs cannot be — `docs/` also holds this repo's
 *  own live docs, which are not vendored — so they come from the installer's own list rather
 *  than a copy of it. A second literal here would be a list to keep in step, which is the
 *  read-scope failure of ADR-0021: the rule shipped, the second list did not, and the check
 *  reported green over files nobody was reading. */
function vendoredTextFiles() {
  const proseDirs = ['.claude/commands', 'templates'];
  return [
    ...proseDirs.flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => join(dir, name)),
    ),
    // `.claude/hooks/` is vendored too — `pre-commit` is in the installer's byte-identical
    // VENDORED list — and its citations live in comments, read by the operator working out
    // why a commit was blocked. That is precisely when a citation pointing at the wrong
    // record costs the most. Every file rather than the `.md` filter above: there is no
    // `.md` among them, which is how the directory stayed outside this guard while the
    // defect it describes sat in the hook's own header.
    ...readdirSync(join(ROOT, '.claude/hooks')).sort().map((name) => join('.claude/hooks', name)),
    ...ADAPTABLE_DOCS,
  ];
}

test('vendored text cites this repo by name, never bare', () => {
  const offenders = [];

  for (const file of vendoredTextFiles()) {
    readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      for (const [, , citation] of line.matchAll(BARE_CITATION)) {
        offenders.push(`${file}:${i + 1} — ${citation}`);
      }
    });
  }

  assert.deepEqual(offenders, [],
    'copied into another repo, a bare citation names that repo\'s decision of the same number');
});

test('the guard reads the files it claims to', () => {
  // Without this, deleting a directory or a filter typo turns the test above into a
  // vacuous pass — the failure mode the whole enforcement layer exists to prevent (R10).
  const files = vendoredTextFiles();

  assert.ok(files.length >= 7, `expected the vendored text set, got ${files.length} file(s)`);
  assert.ok(files.includes(relative(ROOT, join(ROOT, 'templates/CLAUDE.md'))));
  assert.ok(files.some((f) => f.startsWith('.claude/commands/')));
  assert.ok(files.includes(join('.claude/hooks', 'pre-commit')));
});
