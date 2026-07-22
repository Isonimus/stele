// Behaviour fixtures for /init-method (ADR-0006). Run: node --test
//
// These build throwaway git repos under os.tmpdir() rather than committing fixture
// trees, because the behaviours under test are *filesystem states* — a symlink, a
// missing hook, a drifted copy — which a checked-in fixture cannot carry faithfully
// (git stores no broken symlink targets and no .git/hooks).
//
// `home` is always injected. A test that let the script find the operator's real
// ~/.claude/CLAUDE.md would either clobber it or pass only on one machine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, lstatSync, readlinkSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initMethod } from '../scripts/init-method.mjs';

const TOOLKIT = dirname(dirname(fileURLToPath(import.meta.url)));

const ADR = `---
id: '0001'
title: "A first decision"
type: architecture
status: accepted
date: 2026-01-01
supersedes: []
superseded_by: []
---

# ADR-0001 — A first decision

## Context
## Decision
## Consequences
`;

/** A git repo with one valid ADR, plus an injected empty home. Removed on exit. */
function scratchRepo({ withAdr = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'init-method-'));
  const target = join(root, 'repo');
  const home = join(root, 'home');
  mkdirSync(target, { recursive: true });
  mkdirSync(home, { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: target });
  if (withAdr) {
    mkdirSync(join(target, 'adr'), { recursive: true });
    writeFileSync(join(target, 'adr', '0001-a-first-decision.md'), ADR);
  }
  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  return { root, target, home };
}

const run = (opts) => initMethod({ toolkit: TOOLKIT, ...opts });
const statuses = (actions, path) => actions.filter((a) => a.path.endsWith(path)).map((a) => a.status);

test('a dry run writes nothing at all', () => {
  const { target, home } = scratchRepo();
  const { actions } = run({ target, home });

  assert.ok(actions.some((a) => a.status === 'would'));
  assert.equal(existsSync(join(target, 'CLAUDE.md')), false);
  assert.equal(existsSync(join(target, 'scripts', 'lint-docs.mjs')), false);
  assert.equal(existsSync(join(target, '.git', 'hooks', 'pre-commit')), false);
  assert.equal(existsSync(join(home, '.claude', 'CLAUDE.md')), false);
});

test('--apply scaffolds, vendors, indexes, hooks and links the global conventions', () => {
  const { target, home } = scratchRepo();
  const { problems } = run({ target, home, apply: true });

  assert.equal(problems, 0);
  assert.ok(existsSync(join(target, 'CLAUDE.md')));
  assert.ok(existsSync(join(target, 'LEDGER.md')));
  assert.ok(existsSync(join(target, 'scripts', 'lint-docs.mjs')));
  assert.ok(existsSync(join(target, 'adr', 'INDEX.md')));

  const hook = join(target, '.git', 'hooks', 'pre-commit');
  assert.ok(lstatSync(hook).isSymbolicLink());
  assert.equal(readlinkSync(hook), '../../.claude/hooks/pre-commit');
  assert.ok(existsSync(hook), 'the hook symlink must resolve, not merely exist');

  const global = join(home, '.claude', 'CLAUDE.md');
  assert.equal(readlinkSync(global), join(TOOLKIT, 'global', 'CLAUDE.md'));
});

test('an unwired verify script blocks the hook but not the rest of the install', () => {
  const { target, home } = scratchRepo();
  mkdirSync(join(target, 'scripts'), { recursive: true });
  writeFileSync(join(target, 'scripts', 'thing-verify.mjs'), '// never wired\n');
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }));

  const { actions, problems } = run({ target, home, apply: true });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /REFUSING to install the pre-commit hook/.test(a.message)));
  assert.equal(existsSync(join(target, '.git', 'hooks', 'pre-commit')), false, 'a red corpus must not receive a hook');
  // Everything that cannot brick the repo still lands, so a re-run after wiring is cheap.
  assert.ok(existsSync(join(target, 'CLAUDE.md')));
  assert.ok(existsSync(join(target, 'scripts', 'lint-docs.mjs')));
});

test('wiring the script and re-running installs the hook', () => {
  const { target, home } = scratchRepo();
  mkdirSync(join(target, 'scripts'), { recursive: true });
  writeFileSync(join(target, 'scripts', 'thing-verify.mjs'), '// wired below\n');
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }));
  run({ target, home, apply: true });

  writeFileSync(join(target, 'package.json'), JSON.stringify({
    name: 'x',
    scripts: { 'verify:thing': 'node scripts/thing-verify.mjs' },
  }));
  const { problems } = run({ target, home, apply: true });

  assert.equal(problems, 0);
  assert.ok(existsSync(join(target, '.git', 'hooks', 'pre-commit')));
});

test('an existing CLAUDE.md is kept, never overwritten', () => {
  const { target, home } = scratchRepo();
  writeFileSync(join(target, 'CLAUDE.md'), '# Ours, hand-written\n');

  const { actions } = run({ target, home, apply: true });

  assert.deepEqual(statuses(actions, 'CLAUDE.md').slice(0, 1), ['keep']);
  assert.equal(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), '# Ours, hand-written\n');
});

test('a real ~/.claude/CLAUDE.md is refused and left alone', () => {
  const { target, home } = scratchRepo();
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# my own conventions\n');

  const { actions, problems } = run({ target, home, apply: true });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /refusing to overwrite/.test(a.message)));
  assert.equal(readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8'), '# my own conventions\n');
});

test('a broken global symlink is reported, because absent is legal and silent', () => {
  const { target, home } = scratchRepo();
  mkdirSync(join(home, '.claude'), { recursive: true });
  execFileSync('ln', ['-s', join(home, 'gone', 'CLAUDE.md'), join(home, '.claude', 'CLAUDE.md')]);

  const { actions, problems } = run({ target, home, mode: 'check' });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /silently absent/.test(a.message)));
});

test('--check fails on a removed hook and on a drifted copy', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });
  assert.equal(run({ target, home, mode: 'check' }).problems, 0);

  rmSync(join(target, '.git', 'hooks', 'pre-commit'));
  appendFileSync(join(target, 'scripts', 'lint-docs.mjs'), '\n// local edit\n');
  const { actions, problems } = run({ target, home, mode: 'check' });

  assert.equal(problems, 2);
  assert.ok(actions.some((a) => a.status === 'problem' && /no hook installed/.test(a.message)));
  assert.ok(actions.some((a) => a.status === 'problem' && /drifted from the toolkit/.test(a.message)));
});

test('--update restores a drifted copy and touches nothing else', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });
  appendFileSync(join(target, 'scripts', 'lint-docs.mjs'), '\n// local edit\n');
  writeFileSync(join(target, 'CLAUDE.md'), '# edited since install\n');

  run({ target, home, mode: 'update', apply: true });

  assert.equal(
    readFileSync(join(target, 'scripts', 'lint-docs.mjs'), 'utf8'),
    readFileSync(join(TOOLKIT, 'scripts', 'lint-docs.mjs'), 'utf8'),
  );
  assert.equal(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), '# edited since install\n');
});

test('--apply vendors every slash command the toolkit ships', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });

  for (const name of readdirSync(join(TOOLKIT, '.claude', 'commands')).filter((n) => n.endsWith('.md'))) {
    const vendored = join(target, '.claude', 'commands', name);
    assert.ok(existsSync(vendored), `${name} was not vendored`);
    assert.equal(readFileSync(vendored, 'utf8'), readFileSync(join(TOOLKIT, '.claude', 'commands', name), 'utf8'));
  }
});

test('a repo edit to a command survives --apply and is reported, not counted against a clean check', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });
  const slice = join(target, '.claude', 'commands', 'slice.md');
  writeFileSync(slice, '# our own slice workflow\n');

  const install = run({ target, home, apply: true });
  assert.equal(readFileSync(slice, 'utf8'), '# our own slice workflow\n', 'an install must not clobber an adapted command');
  assert.deepEqual(statuses(install.actions, 'commands/slice.md'), ['keep']);

  const { actions, problems } = run({ target, home, mode: 'check' });
  assert.equal(problems, 0, 'command drift is informational — the install is not broken');
  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['local']);
});

test('--update takes the toolkit version of an adapted command back', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });
  const slice = join(target, '.claude', 'commands', 'slice.md');
  writeFileSync(slice, '# our own slice workflow\n');

  run({ target, home, mode: 'update', apply: true });

  assert.equal(
    readFileSync(slice, 'utf8'),
    readFileSync(join(TOOLKIT, '.claude', 'commands', 'slice.md'), 'utf8'),
  );
});

test('a deleted command is reported by --check without failing it', () => {
  const { target, home } = scratchRepo();
  run({ target, home, apply: true });
  rmSync(join(target, '.claude', 'commands', 'audit.md'));

  const { actions, problems } = run({ target, home, mode: 'check' });

  assert.equal(problems, 0, 'a repo may decline a command; only machinery drift is a problem');
  assert.deepEqual(statuses(actions, 'commands/audit.md'), ['missing']);
});

const FRAMEWORK_CONFIG = `repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.4
    hooks:
      - id: ruff
`;

test('a dry run over a repo with no adr/ does not predict a refusal that --apply disproves', () => {
  const { target, home } = scratchRepo({ withAdr: false });

  const dry = run({ target, home });
  assert.equal(dry.problems, 0, 'the plan must not report a corpus error against a directory it plans to create');
  assert.ok(dry.actions.some((a) => a.path.endsWith('hooks/pre-commit') && a.status === 'would'));

  // ...and the plan holds: applying it really does install the hook.
  assert.equal(run({ target, home, apply: true }).problems, 0);
  assert.ok(existsSync(join(target, '.git', 'hooks', 'pre-commit')));
});

test('a repo using the pre-commit framework gets the checks composed, not a symlink', () => {
  const { target, home } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);

  run({ target, home, apply: true });

  const config = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');
  assert.ok(config.startsWith(FRAMEWORK_CONFIG), 'the existing config must survive verbatim');
  assert.match(config, /id: claude-method-docs/);
  assert.match(config, /id: claude-method-index/);
  assert.equal(
    existsSync(join(target, '.git', 'hooks', 'pre-commit')),
    false,
    'the framework owns that file — taking it would be silently undone by `pre-commit install`',
  );
});

test('composing is idempotent — a second run appends nothing', () => {
  const { target, home } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);
  run({ target, home, apply: true });
  const once = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');

  run({ target, home, apply: true });

  const twice = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');
  assert.equal(twice, once, 'a re-run must not append a second copy');
  assert.equal(twice.match(/id: claude-method-docs/g)?.length, 1, 'the block must be present exactly once');
});

test('a configured-but-uninstalled framework is a problem, because nothing runs at all', () => {
  const { target, home } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);
  run({ target, home, apply: true });

  const { actions, problems } = run({ target, home, mode: 'check' });

  assert.equal(problems, 1);
  assert.ok(actions.some((a) => a.status === 'problem' && /`pre-commit install`/.test(a.message)));

  // Once the framework's own dispatcher exists, the install is complete.
  mkdirSync(join(target, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(target, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n# framework\n');
  assert.equal(run({ target, home, mode: 'check' }).problems, 0);
});

test('an unrecognised pre-commit config is refused, never guessed at', () => {
  const { target, home } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), 'something: else\n');

  const { actions, problems } = run({ target, home, apply: true });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /refusing to edit it/.test(a.message)));
  assert.equal(readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8'), 'something: else\n');
});

test('a directory that is not a git repo is refused', () => {
  const { root, home } = scratchRepo();
  const notARepo = join(root, 'plain');
  mkdirSync(notARepo, { recursive: true });

  const { actions, problems } = run({ target: notARepo, home, apply: true });

  assert.equal(problems, 1);
  assert.match(actions[0].message, /not a git repository/);
});
