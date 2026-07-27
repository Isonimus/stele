// Behaviour fixtures for the pre-commit hook (ADR-0018). Run: node --test
//
// These drive real `git commit` in throwaway repos rather than calling the checks
// directly, because the defect under test is not in either check — both are correct — but
// in *which bytes the hook hands them*. Only an actual commit can tell the working tree
// and the index apart, so a test that invoked lint-docs.mjs itself would pass against the
// broken hook and prove nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initMethod } from '../scripts/init-method.mjs';

const TOOLKIT = dirname(dirname(fileURLToPath(import.meta.url)));

const adr = (id, extra = '') => `---
id: '${id}'
title: "Decision ${id}"
type: architecture
status: accepted
date: 2026-01-01
supersedes: []
superseded_by: []
${extra}---

# ADR-${id} — Decision ${id}

## Context
## Decision
## Consequences
`;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

/** Attempts a commit. Returns { ok, output } instead of throwing, because the hook
 *  rejecting the commit *is* the assertion in most of these tests. */
function tryCommit(cwd, message) {
  try {
    return { ok: true, output: git(cwd, 'commit', '-q', '-m', message) };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** An installed repo with the hook live and one committed ADR. Removed on exit. */
function installedRepo() {
  const root = mkdtempSync(join(tmpdir(), 'pre-commit-'));
  const target = join(root, 'repo');
  mkdirSync(join(target, 'adr'), { recursive: true });
  git(target, 'init', '--quiet');
  git(target, 'config', 'user.email', 'test@example.com');
  git(target, 'config', 'user.name', 'test');
  writeFileSync(join(target, 'adr', '0001-decision-0001.md'), adr('0001'));

  const { problems } = initMethod({ target, toolkit: TOOLKIT, apply: true });
  assert.equal(problems, 0, 'the fixture repo must install cleanly');

  git(target, 'add', '-A');
  const first = tryCommit(target, 'base');
  assert.ok(first.ok, `the base commit must pass the hook:\n${first.output}`);

  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  return target;
}

test('a commit whose staged content is broken is rejected, even when the working tree is clean', () => {
  const target = installedRepo();
  const path = join(target, 'adr', '0002-decision-0002.md');

  // Staged: superseded with nothing to point at — an R6 error.
  writeFileSync(path, adr('0002', 'superseded_by: []\n').replace('status: accepted', 'status: superseded'));
  git(target, 'add', path);
  // Working tree: fixed, and deliberately NOT staged. This is the whole test — a hook
  // reading the working tree sees a clean corpus and lets the broken one through.
  writeFileSync(path, adr('0002'));
  execFileSync('node', [join(target, 'scripts', 'build-index.mjs'), target]);

  const result = tryCommit(target, 'stages a broken ADR behind a clean working tree');

  assert.equal(result.ok, false, 'the hook must reject a commit whose staged content is red');
  assert.match(result.output, /R6/, 'and must say which rule the staged content broke');
  assert.equal(git(target, 'log', '--oneline').trim().split('\n').length, 1, 'nothing new landed');
});

test('a stale index is caught when the regenerated one is left unstaged', () => {
  const target = installedRepo();
  writeFileSync(join(target, 'adr', '0003-decision-0003.md'), adr('0003'));
  git(target, 'add', join(target, 'adr', '0003-decision-0003.md'));
  // Regenerated on disk but never staged: the everyday version of the same defect — the
  // commit lands with an index that does not mention 0003.
  execFileSync('node', [join(target, 'scripts', 'build-index.mjs'), target]);

  const result = tryCommit(target, 'adds an ADR without staging the regenerated index');

  assert.equal(result.ok, false, 'the hook must reject a commit carrying a stale INDEX.md');
  assert.match(result.output, /out of date/);
});

test('staging the index too makes the same commit pass', () => {
  const target = installedRepo();
  writeFileSync(join(target, 'adr', '0003-decision-0003.md'), adr('0003'));
  execFileSync('node', [join(target, 'scripts', 'build-index.mjs'), target]);
  git(target, 'add', '-A');

  const result = tryCommit(target, 'adds an ADR and stages the index');

  assert.ok(result.ok, `a correctly staged commit must pass:\n${result.output}`);
  assert.match(git(target, 'show', 'HEAD:adr/INDEX.md'), /0003/, 'the committed index is current');
});

test('the hook leaves unstaged work untouched', () => {
  const target = installedRepo();
  const scratch = join(target, 'adr', '0004-decision-0004.md');
  writeFileSync(scratch, adr('0004'));
  execFileSync('node', [join(target, 'scripts', 'build-index.mjs'), target]);
  git(target, 'add', '-A');
  // Uncommitted, unstaged edits to a *different* file, made after staging.
  writeFileSync(join(target, 'LEDGER.md'), '# Ledger\n\nwork in progress, not staged\n');

  const result = tryCommit(target, 'commits with unrelated unstaged work present');

  assert.ok(result.ok, `the commit should pass:\n${result.output}`);
  assert.match(readFileSync(join(target, 'LEDGER.md'), 'utf8'), /work in progress/,
    'a stash-based hook that failed to pop would have eaten this');
  assert.equal(git(target, 'stash', 'list').trim(), '', 'no stash may be left behind');
});

test('a commit that drops the vendored checker is refused, not silently unchecked', () => {
  const target = installedRepo();
  git(target, 'rm', '-q', '--cached', 'scripts/lint-docs.mjs');

  const result = tryCommit(target, 'removes the linter from the tree');

  assert.equal(result.ok, false, 'no checker in the commit must fail loud, never fall back');
  assert.match(result.output, /not in the commit/);
  assert.ok(existsSync(join(target, 'scripts', 'lint-docs.mjs')), 'the working copy is untouched');
});
