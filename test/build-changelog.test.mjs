// Behaviour fixtures for the generated changelog (ADR-0026). Run: node --test
//
// The pure renderer is tested directly; everything that reads git is tested against a
// throwaway repo built here, because the behaviours under test — tag ordering, the range
// between two tags, an untagged tip — are properties of real history that a checked-in
// fixture cannot carry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { commitType, renderChangelog, readTags, buildChangelog } from '../scripts/build-changelog.mjs';

/** A repo whose history is fully controlled, including commit dates. */
function scratchRepo() {
  const root = mkdtempSync(join(tmpdir(), 'changelog-'));
  const git = (...args) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e' },
  });

  git('init', '--quiet', '.');
  // The file is a parameter so two branches can commit without conflicting: the merge in the
  // duplicate-commit fixture has to succeed for the fixture to say anything.
  const commit = (subject, date, file = 'file.txt') => {
    writeFileSync(join(root, file), `${subject}\n`);
    git('add', '-A');
    git('-c', `user.name=T`, '-c', 'user.email=t@e', 'commit', '--quiet', '-m', subject, '--date', date);
  };
  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  return { root, git, commit };
}

test('a conventional subject yields its type, and anything else yields null', () => {
  assert.equal(commitType('feat: a thing'), 'feat');
  assert.equal(commitType('fix(scope): a thing'), 'fix');
  assert.equal(commitType('feat!: a breaking thing'), 'feat');
  assert.equal(commitType('Merge branch main'), null);
  assert.equal(commitType('no colon here'), null);
});

test('releases render newest first, and entries sort by type rather than by commit order', () => {
  const text = renderChangelog([
    { name: 'v0.1.0', date: '2026-01-01', commits: [{ sha: 'aaa1111', subject: 'feat: the first thing' }] },
    {
      name: 'v0.2.0',
      date: '2026-02-02',
      commits: [
        { sha: 'ccc3333', subject: 'chore: bump' },
        { sha: 'bbb2222', subject: 'fix: a defect' },
        { sha: 'ddd4444', subject: 'feat: a feature' },
      ],
    },
  ]);

  assert.ok(text.indexOf('## v0.2.0 — 2026-02-02') < text.indexOf('## v0.1.0 — 2026-01-01'));
  const entries = text.split('\n').filter((line) => line.startsWith('- '));
  assert.deepEqual(entries.slice(0, 3), [
    '- feat: a feature (`ddd4444`)',
    '- fix: a defect (`bbb2222`)',
    '- chore: bump (`ccc3333`)',
  ]);
});

test('an unconventional subject is rendered rather than dropped', () => {
  const text = renderChangelog([
    { name: 'v0.1.0', date: '2026-01-01', commits: [{ sha: 'aaa1111', subject: 'Initial import' }, { sha: 'bbb2222', subject: 'feat: a feature' }] },
  ]);

  assert.match(text, /- Initial import \(`aaa1111`\)/);
  const entries = text.split('\n').filter((line) => line.startsWith('- '));
  assert.equal(entries.at(-1), '- Initial import (`aaa1111`)', 'unrecognised types sort last');
});

test('no tags produces a document that says so, rather than an empty file', () => {
  const text = renderChangelog([]);
  assert.match(text, /^# Changelog/);
  assert.match(text, /No tags yet/);
});

test('releases are ordered by the tagged commit, not by when the tag was written', () => {
  // The three tags in this repo were all written retroactively in one sitting, so tag
  // creation order carries no release information at all (ADR-0026).
  const { root, git, commit } = scratchRepo();
  commit('feat: the oldest release', '2026-01-01T00:00:00');
  commit('feat: the middle release', '2026-02-01T00:00:00');
  commit('feat: the newest release', '2026-03-01T00:00:00');

  // Tag creation order is the reverse of release order, which is what retroactive tagging
  // produces and what a `--sort=creatordate` would get exactly backwards.
  git('tag', '-a', 'v0.3.0', '-m', 'written first, newest commit');
  git('tag', '-a', 'v0.1.0', 'HEAD~2', '-m', 'written second, oldest commit');
  git('tag', '-a', 'v0.2.0', 'HEAD~1', '-m', 'written last, middle commit');

  assert.deepEqual(readTags(root).releases.map((r) => r.name), ['v0.1.0', 'v0.2.0', 'v0.3.0']);
});

test('a release lists only the commits since the previous tag, and the untagged tip is absent', () => {
  const { root, git, commit } = scratchRepo();
  commit('feat: shipped in the first release', '2026-01-01T00:00:00');
  git('tag', '-a', 'v0.1.0', '-m', 'first');
  commit('fix: shipped in the second release', '2026-02-01T00:00:00');
  git('tag', '-a', 'v0.2.0', '-m', 'second');
  commit('feat: an untagged tip', '2026-03-01T00:00:00');

  const { text } = buildChangelog(root);
  const second = text.slice(text.indexOf('## v0.2.0'), text.indexOf('## v0.1.0'));

  assert.match(second, /shipped in the second release/);
  assert.doesNotMatch(second, /shipped in the first release/, 'the previous release is not repeated');
  assert.doesNotMatch(text, /an untagged tip/, 'work past the newest tag waits for its own tag');
});

// Three states the ADR-0017 pass found. Each was reproduced against the generator before
// being fixed: a lightweight tag published a release nobody made, a tagged branch merged in
// later listed its commits twice, and an annotated tag on a blob died with a raw
// `fatal: ambiguous argument ''` and a stack trace.

test('a lightweight tag is not a release, and is named rather than dropped in silence', () => {
  const { root, git, commit } = scratchRepo();
  commit('feat: a real release', '2026-01-01T00:00:00');
  git('tag', '-a', 'v0.1.0', '-m', 'annotated');
  commit('feat: work marked with a bare tag', '2026-02-01T00:00:00');
  git('tag', 'v0.2.0');

  const { text, skipped } = buildChangelog(root);

  assert.doesNotMatch(text, /## v0\.2\.0/, 'a bare `git tag` is a bookmark, not a release');
  assert.deepEqual(skipped.map((s) => s.name), ['v0.2.0']);
  assert.match(skipped[0].why, /lightweight/);
});

test('an annotated tag on a non-commit object is reported, not crashed on', () => {
  const { root, git, commit } = scratchRepo();
  commit('feat: a real release', '2026-01-01T00:00:00');
  git('tag', '-a', 'v0.1.0', '-m', 'annotated');
  const blob = git('rev-parse', 'HEAD:file.txt').trim();
  git('tag', '-a', 'v0.2.0-blob', '-m', 'points at a blob', blob);

  const { text, skipped } = buildChangelog(root);

  assert.match(text, /## v0\.1\.0/);
  assert.deepEqual(skipped.map((s) => s.name), ['v0.2.0-blob']);
  assert.match(skipped[0].why, /points at a blob/);
});

test('a commit released on a branch is not repeated by the release that merges it', () => {
  const { root, git, commit } = scratchRepo();
  commit('feat: base', '2026-01-01T00:00:00');
  git('tag', '-a', 'v0.1.0', '-m', 'x');
  const base = git('rev-parse', 'HEAD').trim();

  git('checkout', '--quiet', '-b', 'feature');
  commit('feat: branch work', '2026-02-01T00:00:00', 'branch.txt');
  git('tag', '-a', 'v0.2.0', '-m', 'x');

  git('checkout', '--quiet', base);
  git('checkout', '--quiet', '-B', 'trunk');
  commit('feat: trunk work', '2026-03-01T00:00:00', 'trunk.txt');
  git('tag', '-a', 'v0.3.0', '-m', 'x');
  git('merge', '--quiet', '--no-ff', 'feature', '-m', 'Merge feature');
  git('tag', '-a', 'v0.4.0', '-m', 'x');

  const { text } = buildChangelog(root);

  assert.equal(text.match(/feat: branch work/g).length, 1, 'listed once, under the release that shipped it');
  const branchRelease = text.slice(text.indexOf('## v0.2.0'), text.indexOf('## v0.1.0'));
  assert.match(branchRelease, /feat: branch work/);
  assert.doesNotMatch(text, /Merge feature/, 'a merge records an integration, not a change');
});
