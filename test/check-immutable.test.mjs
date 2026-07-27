// Behaviour fixtures for the immutability check (ADR-0019). Run: node --test
//
// Real commits in throwaway repos, for the same reason as the hook fixtures: the property
// under test is a relationship between two revisions, which no single checked-in tree can
// express.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkImmutable } from '../scripts/check-immutable.mjs';

const adr = (id, { status = 'accepted', body = 'The original reasoning.' } = {}) => `---
id: '${id}'
title: "Decision ${id}"
type: architecture
status: ${status}
date: 2026-01-01
supersedes: []
superseded_by: []
---

# ADR-${id} — Decision ${id}

## Context

${body}

## Decision
## Consequences
`;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

/** A repo with one committed ADR, and a helper to commit further states. Removed on exit. */
function repoWithAdr() {
  const root = mkdtempSync(join(tmpdir(), 'check-immutable-'));
  mkdirSync(join(root, 'adr'), { recursive: true });
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'), adr('0001'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'first');

  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  return { root };
}

/** Runs the check inside `root`, since it reads git from the current directory. */
function check(root, base, head) {
  const cwd = process.cwd();
  try {
    process.chdir(root);
    return checkImmutable(base, head);
  } finally {
    process.chdir(cwd);
  }
}

test('rewriting the body of a committed document is a violation', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'),
    adr('0001', { body: 'We actually decided the opposite, and nobody will ever know.' }));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'rewrite');

  const problems = check(root, 'HEAD~1', 'HEAD');

  assert.equal(problems.length, 1);
  assert.match(problems[0], /0001-decision-0001\.md: body line \d+ was deleted or rewritten/);
});

test('appending an amendment is allowed', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'),
    `${adr('0001')}\n## Amendment — 2026-07-27: this turned out to be narrower than we thought\n\nDetails.\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'amend');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), []);
});

test('changing frontmatter alone is allowed — it is the mutable surface', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'), adr('0001', { status: 'superseded' }));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'supersede');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), []);
});

test('an in-place correction marker is allowed — the sanctioned way to correct a claim', () => {
  // ADR-0003 does exactly this: a `> **Corrected <date>.**` block immediately above the
  // wrong line, per ADR-0001's amendment. A prefix test would have outlawed it (ADR-0019).
  const { root } = repoWithAdr();
  const corrected = adr('0001').replace(
    'The original reasoning.',
    '> **Corrected 2026-07-27.** The line below overstates it.\n\nThe original reasoning.',
  );
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'), corrected);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'correct in place');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), []);
});

test('deleting a body line is a violation even when nothing is rewritten', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'),
    adr('0001').replace('The original reasoning.\n\n', ''));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'quietly drop a claim');

  const problems = check(root, 'HEAD~1', 'HEAD');

  assert.equal(problems.length, 1);
  assert.match(problems[0], /deleted or rewritten/);
});

test('deleting an immutable document is a violation', () => {
  const { root } = repoWithAdr();
  git(root, 'rm', '-q', 'adr/0001-decision-0001.md');
  git(root, 'commit', '-q', '--no-verify', '-m', 'delete');

  const problems = check(root, 'HEAD~1', 'HEAD');

  assert.equal(problems.length, 1);
  assert.match(problems[0], /removed/);
});

test('a new document is not compared against anything', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0002-decision-0002.md'), adr('0002'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'add');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), []);
});

test('trailing-newline churn is not an edit', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'), `${adr('0001').trimEnd()}\n\n\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'whitespace');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), []);
});

test('the generated index is not an immutable document', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', 'INDEX.md'), '# ADR Index\n\nfirst\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'index');
  writeFileSync(join(root, 'adr', 'INDEX.md'), '# ADR Index\n\nregenerated, wholly different\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'regenerate');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), [],
    'INDEX.md is generated (ADR-0010) — rewriting it is its normal mode');
});

test('an unparseable document is left to rule 1 rather than guessed at', () => {
  const { root } = repoWithAdr();
  writeFileSync(join(root, 'adr', '0001-decision-0001.md'), 'no frontmatter at all\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'break it');

  assert.deepEqual(check(root, 'HEAD~1', 'HEAD'), [],
    'the body boundary is unknown here; lint rule 1 errors on the same file');
});
