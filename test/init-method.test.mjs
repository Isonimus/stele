// Behaviour fixtures for /init-method (ADR-0006). Run: node --test
//
// These build throwaway git repos under os.tmpdir() rather than committing fixture
// trees, because the behaviours under test are *filesystem states* — a symlink, a
// missing hook, a drifted copy — which a checked-in fixture cannot carry faithfully
// (git stores no broken symlink targets and no .git/hooks).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, lstatSync, readlinkSync, readFileSync, appendFileSync, readdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

/** A git repo with one valid ADR. Removed on exit. */
function scratchRepo({ withAdr = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'init-method-'));
  const target = join(root, 'repo');
  mkdirSync(target, { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: target });
  if (withAdr) {
    mkdirSync(join(target, 'adr'), { recursive: true });
    writeFileSync(join(target, 'adr', '0001-a-first-decision.md'), ADR);
  }
  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  return { root, target };
}

const run = (opts) => initMethod({ toolkit: TOOLKIT, ...opts });
const statuses = (actions, path) => actions.filter((a) => a.path.endsWith(path)).map((a) => a.status);

test('a dry run writes nothing at all', () => {
  const { target } = scratchRepo();
  const { actions } = run({ target });

  assert.ok(actions.some((a) => a.status === 'would'));
  assert.equal(existsSync(join(target, 'CLAUDE.md')), false);
  assert.equal(existsSync(join(target, 'scripts', 'lint-docs.mjs')), false);
  assert.equal(existsSync(join(target, '.git', 'hooks', 'pre-commit')), false);
});

test('--apply scaffolds, vendors, indexes, and hooks', () => {
  const { target } = scratchRepo();
  const { problems } = run({ target, apply: true });

  assert.equal(problems, 0);
  assert.ok(existsSync(join(target, 'CLAUDE.md')));
  assert.ok(existsSync(join(target, 'LEDGER.md')));
  assert.ok(existsSync(join(target, 'scripts', 'lint-docs.mjs')));
  assert.ok(existsSync(join(target, 'adr', 'INDEX.md')));

  const hook = join(target, '.git', 'hooks', 'pre-commit');
  assert.ok(lstatSync(hook).isSymbolicLink());
  assert.equal(readlinkSync(hook), '../../.claude/hooks/pre-commit');
  assert.ok(existsSync(hook), 'the hook symlink must resolve, not merely exist');
});

test('an unwired verify script blocks the hook but not the rest of the install', () => {
  const { target } = scratchRepo();
  mkdirSync(join(target, 'scripts'), { recursive: true });
  writeFileSync(join(target, 'scripts', 'thing-verify.mjs'), '// never wired\n');
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }));

  const { actions, problems } = run({ target,apply: true });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /REFUSING to install the pre-commit hook/.test(a.message)));
  assert.equal(existsSync(join(target, '.git', 'hooks', 'pre-commit')), false, 'a red corpus must not receive a hook');
  // Everything that cannot brick the repo still lands, so a re-run after wiring is cheap.
  assert.ok(existsSync(join(target, 'CLAUDE.md')));
  assert.ok(existsSync(join(target, 'scripts', 'lint-docs.mjs')));
});

test('wiring the script and re-running installs the hook', () => {
  const { target } = scratchRepo();
  mkdirSync(join(target, 'scripts'), { recursive: true });
  writeFileSync(join(target, 'scripts', 'thing-verify.mjs'), '// wired below\n');
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }));
  run({ target,apply: true });

  writeFileSync(join(target, 'package.json'), JSON.stringify({
    name: 'x',
    scripts: { 'verify:thing': 'node scripts/thing-verify.mjs' },
  }));
  const { problems } = run({ target,apply: true });

  assert.equal(problems, 0);
  assert.ok(existsSync(join(target, '.git', 'hooks', 'pre-commit')));
});

test('an existing CLAUDE.md is kept, never overwritten', () => {
  const { target } = scratchRepo();
  writeFileSync(join(target, 'CLAUDE.md'), '# Ours, hand-written\n');

  const { actions } = run({ target,apply: true });

  assert.deepEqual(statuses(actions, 'CLAUDE.md').slice(0, 1), ['keep']);
  assert.equal(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), '# Ours, hand-written\n');
});

test('--check fails on a removed hook and on a drifted copy', () => {
  const { target } = scratchRepo();
  run({ target,apply: true });
  assert.equal(run({ target,mode: 'check' }).problems, 0);

  rmSync(join(target, '.git', 'hooks', 'pre-commit'));
  appendFileSync(join(target, 'scripts', 'lint-docs.mjs'), '\n// local edit\n');
  const { actions, problems } = run({ target,mode: 'check' });

  assert.equal(problems, 2);
  assert.ok(actions.some((a) => a.status === 'problem' && /no hook installed/.test(a.message)));
  assert.ok(actions.some((a) => a.status === 'problem' && /drifted from the toolkit/.test(a.message)));
});

test('--update restores a drifted copy and touches nothing else', () => {
  const { target } = scratchRepo();
  run({ target,apply: true });
  appendFileSync(join(target, 'scripts', 'lint-docs.mjs'), '\n// local edit\n');
  writeFileSync(join(target, 'CLAUDE.md'), '# edited since install\n');

  run({ target,mode: 'update', apply: true });

  assert.equal(
    readFileSync(join(target, 'scripts', 'lint-docs.mjs'), 'utf8'),
    readFileSync(join(TOOLKIT, 'scripts', 'lint-docs.mjs'), 'utf8'),
  );
  assert.equal(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), '# edited since install\n');
});

test('--apply vendors every slash command the toolkit ships', () => {
  const { target } = scratchRepo();
  run({ target,apply: true });

  for (const name of readdirSync(join(TOOLKIT, '.claude', 'commands')).filter((n) => n.endsWith('.md'))) {
    const vendored = join(target, '.claude', 'commands', name);
    assert.ok(existsSync(vendored), `${name} was not vendored`);
    assert.equal(readFileSync(vendored, 'utf8'), readFileSync(join(TOOLKIT, '.claude', 'commands', name), 'utf8'));
  }
});

test('a repo edit to a command survives --apply and is reported, not counted against a clean check', () => {
  const { target } = scratchRepo();
  run({ target,apply: true });
  const slice = join(target, '.claude', 'commands', 'slice.md');
  writeFileSync(slice, '# our own slice workflow\n');

  const install = run({ target,apply: true });
  assert.equal(readFileSync(slice, 'utf8'), '# our own slice workflow\n', 'an install must not clobber an adapted command');
  assert.deepEqual(statuses(install.actions, 'commands/slice.md'), ['keep']);

  const { actions, problems } = run({ target,mode: 'check' });
  assert.equal(problems, 0, 'command drift is informational — the install is not broken');
  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['local']);
});

// ADR-0023. `--update` used to overwrite every command whose bytes differed, which made
// taking a machinery fix and keeping a local adaptation mutually exclusive — the incident
// in `pull_request`, whose correct `/adr` fix an update would have silently reverted.
const COMMANDS = '.claude/commands';
const PROVENANCE = join('.claude', '.stele-vendored.json');
const toolkitCommand = (name) => readFileSync(join(TOOLKIT, COMMANDS, name), 'utf8');
const adapt = (target, name, text) => writeFileSync(join(target, COMMANDS, name), text);
const installed = (target, name) => readFileSync(join(target, COMMANDS, name), 'utf8');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Rewinds a command to an older release *and* says the toolkit handed that older text over
 * — the on-disk shape of "this repo is behind and has not touched the file". Editing the
 * file alone would produce an adaptation, which is the state this one has to be told from.
 */
function rewind(target, name, older) {
  adapt(target, name, older);
  const path = join(target, PROVENANCE);
  const record = JSON.parse(readFileSync(path, 'utf8'));
  record.commands[`${COMMANDS}/${name}`] = sha256(older);
  writeFileSync(path, JSON.stringify(record, null, 2));
}

test('--update keeps a locally adapted command instead of discarding it', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  adapt(target, 'slice.md', '# our own slice workflow\n');

  const { actions } = run({ target, mode: 'update', apply: true });

  assert.equal(installed(target, 'slice.md'), '# our own slice workflow\n');
  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['keep']);
});

test('--update --force is the way to discard a local adaptation', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  adapt(target, 'slice.md', '# our own slice workflow\n');

  run({ target, mode: 'update', apply: true, force: true });

  assert.equal(installed(target, 'slice.md'), toolkitCommand('slice.md'));
});

test('--update refreshes a command the repo never touched', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  rewind(target, 'slice.md', '# an older release of /slice\n');

  const { actions } = run({ target, mode: 'update', apply: true });

  assert.equal(installed(target, 'slice.md'), toolkitCommand('slice.md'), 'an unmodified command must take the fix');
  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['wrote']);
});

test('--check calls an unmodified stale command a problem and an adaptation information', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });

  adapt(target, 'slice.md', '# our own slice workflow\n');
  rewind(target, 'audit.md', '# an older release of /audit\n');

  const { actions, problems } = run({ target, mode: 'check' });

  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['local'], 'an adaptation is the repo exercising ADR-0007');
  assert.deepEqual(statuses(actions, 'commands/audit.md'), ['problem'], 'behind and unmodified is a repo missing a fix');
  assert.equal(problems, 1);
});

test('a command differing with no record is kept, because it cannot be told from an adaptation', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  adapt(target, 'slice.md', '# adapted before the record existed\n');
  rmSync(join(target, PROVENANCE));

  const { actions } = run({ target, mode: 'update', apply: true });

  assert.equal(installed(target, 'slice.md'), '# adapted before the record existed\n');
  assert.deepEqual(statuses(actions, 'commands/slice.md'), ['keep']);
});

test('an unreadable record is reported and overwrites nothing', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  adapt(target, 'slice.md', '# our own slice workflow\n');
  writeFileSync(join(target, PROVENANCE), '{ not json');

  const { actions } = run({ target, mode: 'update', apply: true });

  assert.equal(installed(target, 'slice.md'), '# our own slice workflow\n');
  assert.deepEqual(statuses(actions, '.stele-vendored.json').slice(0, 1), ['problem'], 'a record we cannot read is said out loud, not swallowed');
});

test('an install predating the record acquires one from the commands that already match', () => {
  const { target } = scratchRepo();
  run({ target, apply: true });
  rmSync(join(target, PROVENANCE));

  run({ target, apply: true });

  const record = JSON.parse(readFileSync(join(target, PROVENANCE), 'utf8'));
  assert.equal(record.commands[`${COMMANDS}/slice.md`], sha256(toolkitCommand('slice.md')));
});

test('a dry run writes no vendoring record', () => {
  const { target } = scratchRepo();
  run({ target });

  assert.equal(existsSync(join(target, PROVENANCE)), false, 'the record must describe what is on disk, not what was planned');
});

test('a deleted command is reported by --check without failing it', () => {
  const { target } = scratchRepo();
  run({ target,apply: true });
  rmSync(join(target, '.claude', 'commands', 'audit.md'));

  const { actions, problems } = run({ target,mode: 'check' });

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
  const { target } = scratchRepo({ withAdr: false });

  const dry = run({ target });
  assert.equal(dry.problems, 0, 'the plan must not report a corpus error against a directory it plans to create');
  assert.ok(dry.actions.some((a) => a.path.endsWith('hooks/pre-commit') && a.status === 'would'));

  // ...and the plan holds: applying it really does install the hook.
  assert.equal(run({ target,apply: true }).problems, 0);
  assert.ok(existsSync(join(target, '.git', 'hooks', 'pre-commit')));
});

test('a repo using the pre-commit framework gets the checks composed, not a symlink', () => {
  const { target } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);

  run({ target,apply: true });

  const config = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');
  assert.ok(config.startsWith(FRAMEWORK_CONFIG), 'the existing config must survive verbatim');
  assert.match(config, /id: stele-docs/);
  assert.match(config, /id: stele-index/);
  assert.equal(
    existsSync(join(target, '.git', 'hooks', 'pre-commit')),
    false,
    'the framework owns that file — taking it would be silently undone by `pre-commit install`',
  );
});

test('composing is idempotent — a second run appends nothing', () => {
  const { target } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);
  run({ target,apply: true });
  const once = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');

  run({ target,apply: true });

  const twice = readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8');
  assert.equal(twice, once, 'a re-run must not append a second copy');
  assert.equal(twice.match(/id: stele-docs/g)?.length, 1, 'the block must be present exactly once');
});

test('a configured-but-uninstalled framework is a problem, because nothing runs at all', () => {
  const { target } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), FRAMEWORK_CONFIG);
  run({ target,apply: true });

  const { actions, problems } = run({ target,mode: 'check' });

  assert.equal(problems, 1);
  assert.ok(actions.some((a) => a.status === 'problem' && /`pre-commit install`/.test(a.message)));

  // Once the framework's own dispatcher exists, the install is complete.
  mkdirSync(join(target, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(target, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n# framework\n');
  assert.equal(run({ target,mode: 'check' }).problems, 0);
});

test('an unrecognised pre-commit config is refused, never guessed at', () => {
  const { target } = scratchRepo();
  writeFileSync(join(target, '.pre-commit-config.yaml'), 'something: else\n');

  const { actions, problems } = run({ target,apply: true });

  assert.ok(problems > 0);
  assert.ok(actions.some((a) => a.status === 'problem' && /refusing to edit it/.test(a.message)));
  assert.equal(readFileSync(join(target, '.pre-commit-config.yaml'), 'utf8'), 'something: else\n');
});

test('a directory that is not a git repo is refused', () => {
  const { root } = scratchRepo();
  const notARepo = join(root, 'plain');
  mkdirSync(notARepo, { recursive: true });

  const { actions, problems } = run({ target: notARepo, apply: true });

  assert.equal(problems, 1);
  assert.match(actions[0].message, /not a git repository/);
});

test('the CLI entry point runs when invoked through a symlink, as every npm bin is', () => {
  // Regression (ADR-0015 amendment): npm links node_modules/.bin/stele → init-method.mjs, so
  // the published bin is always run via a symlink. process.argv[1] is then the LINK path while
  // import.meta.url resolves to the real file; a raw `file://${argv[1]}` guard is false and
  // main() silently never runs — `npx @isonimus/stele … --apply` exits 0 and scaffolds nothing.
  // Every other test drives initMethod() directly and so never exercised the entry guard.
  const { root, target } = scratchRepo();
  const link = join(root, 'stele-bin'); // stand-in for node_modules/.bin/stele
  symlinkSync(join(TOOLKIT, 'scripts', 'init-method.mjs'), link);

  execFileSync('node', [link, target, '--apply']);

  assert.ok(existsSync(join(target, 'CLAUDE.md')), 'main() ran: CLAUDE.md scaffolded');
  assert.ok(existsSync(join(target, '.git', 'hooks', 'pre-commit')), 'main() ran: hook installed');
});
