#!/usr/bin/env node
// Builds CHANGELOG.md from annotated git tags (ADR-0026). Generated, never hand-edited.
//
//   node scripts/build-changelog.mjs [repo-root]           write CHANGELOG.md
//   node scripts/build-changelog.mjs --check [repo-root]   fail if it is stale
//
// Tags are the only input, so the file changes when a release is tagged and at no other
// time — which is what makes --check affordable in CI. Commits made after the newest tag
// are deliberately absent until the next tag exists (ADR-0026).
//
// --check runs in CI only, and cannot move into the pre-commit hook: the hook checks the
// commit by extracting a `git archive` of the staged tree into a temp directory (ADR-0018),
// which has no `.git` and therefore no tags. Reading tags from the real repo instead would
// check the working tree while claiming to check the commit, which is the exact confusion
// ADR-0018 exists to prevent.

import { writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHANGELOG = 'CHANGELOG.md';

/** Conventional-commit types, in the order a reader cares about them. Anything else sorts
 *  last under its own literal prefix rather than being dropped: a commit that escaped the
 *  convention is still a change that shipped, and hiding it would make the file a claim
 *  about the corpus instead of a rendering of it. */
const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'chore'];

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** The type prefix of a conventional subject (`feat(x): …` → `feat`), or null. */
export function commitType(subject) {
  const match = /^([a-z]+)(\([^)]*\))?!?:/.exec(subject);
  return match ? match[1] : null;
}

const typeRank = (subject) => {
  const index = TYPE_ORDER.indexOf(commitType(subject));
  return index === -1 ? TYPE_ORDER.length : index;
};

/**
 * The tags, split into releases and everything this tool refuses to call one.
 *
 * A release is an **annotated** tag that dereferences to a **commit**, and both halves of
 * that are load-bearing (ADR-0026, found by the ADR-0017 pass on this file):
 *
 * - `refs/tags` holds lightweight tags too — local bookmarks, bisect markers, CI leftovers —
 *   and counting one as a release publishes a section for something nobody released.
 * - An annotated tag may point at a blob or a tree. `git rev-list -n 1` then yields the empty
 *   string, and the next git call inherits it as a ref and dies with a raw `fatal: ambiguous
 *   argument ''` plus a stack trace.
 *
 * Both are read straight off `for-each-ref` rather than probed afterwards: `%(*objecttype)`
 * and `%(*objectname)` are the peeled object, so one call answers both questions and there is
 * no window where a tag is assumed to be something it is not.
 *
 * Releases come back oldest first, ordered by the tagged **commit's** date rather than the
 * tag's own — this repo's first three tags were written retroactively in one sitting, so
 * creation order carries no release information whatever.
 */
export function readTags(cwd) {
  const lines = git(cwd, [
    'for-each-ref',
    '--format=%(refname:short)\t%(objecttype)\t%(*objecttype)\t%(*objectname)',
    'refs/tags',
  ]);
  if (lines === '') return { releases: [], skipped: [] };

  const releases = [];
  const skipped = [];

  for (const line of lines.split('\n')) {
    const [name, objectType, peeledType, peeledCommit] = line.split('\t');
    if (objectType !== 'tag') {
      skipped.push({ name, why: 'lightweight — a release tag is annotated (git tag -a)' });
      continue;
    }
    if (peeledType !== 'commit') {
      skipped.push({ name, why: `annotated but points at a ${peeledType || 'non-commit object'}` });
      continue;
    }
    // Full timestamp for ordering, short date for display: two releases on one day are
    // ordinary, and a date-only sort would fall back to alphabetical refname order, which
    // puts v0.10.0 before v0.9.0.
    const [orderedBy, date] = git(cwd, ['log', '-1', '--format=%aI\t%ad', '--date=short', peeledCommit]).split('\t');
    releases.push({ name, commit: peeledCommit, orderedBy, date });
  }

  releases.sort((a, b) => (a.orderedBy < b.orderedBy ? -1 : a.orderedBy > b.orderedBy ? 1 : 0));
  return { releases, skipped };
}

/**
 * Subject and short SHA of every commit reachable from `to` and from none of `alreadyShipped`,
 * newest first.
 *
 * Excluding *every* earlier release rather than only the previous one is what keeps a commit
 * in one section. A tagged branch that merges in later is reachable from both its own tag and
 * the merge's tag, so a plain `previous..this` range reports it twice — once under the release
 * that shipped it and again under the release that merged it (ADR-0017 pass on this file).
 *
 * Merges themselves are excluded: a merge commit's subject records an integration, not a
 * change, and the commits it brings in are listed individually.
 */
export function commitsSince(cwd, alreadyShipped, to) {
  const lines = git(cwd, ['log', '--no-merges', '--format=%h\t%s', to, '--not', ...alreadyShipped]);
  if (lines === '') return [];

  return lines.split('\n').map((line) => {
    const separator = line.indexOf('\t');
    return { sha: line.slice(0, separator), subject: line.slice(separator + 1) };
  });
}

/** The document. Pure, so the shape is testable without a repo. */
export function renderChangelog(releases) {
  const head = `# Changelog

Generated by \`scripts/build-changelog.mjs\` from annotated git tags — never hand-edited
(ADR-0026). Run \`npm run changelog\` after tagging a release.

Every entry is a commit subject verbatim. Work committed after the newest tag is absent by
design and appears when the next release is tagged.
`;

  if (releases.length === 0) {
    return `${head}\nNo tags yet, so no releases to describe.\n`;
  }

  const sections = [...releases].reverse().map(({ name, date, commits }) => {
    const body = commits.length === 0
      ? '\nNo commits between this tag and the previous one.\n'
      : `\n${[...commits]
          .sort((a, b) => typeRank(a.subject) - typeRank(b.subject))
          .map(({ sha, subject }) => `- ${subject} (\`${sha}\`)`)
          .join('\n')}\n`;
    return `## ${name} — ${date}\n${body}`;
  });

  return `${head}\n${sections.join('\n')}`;
}

/** The document this repo's tags describe, and the tags that were not treated as releases. */
export function buildChangelog(cwd) {
  const { releases, skipped } = readTags(cwd);
  return {
    text: renderChangelog(
      releases.map((release, index) => ({
        ...release,
        commits: commitsSince(cwd, releases.slice(0, index).map((earlier) => earlier.commit), release.commit),
      })),
    ),
    skipped,
  };
}

function main(argv) {
  const check = argv.includes('--check');
  const cwd = argv.find((arg) => !arg.startsWith('--')) ?? process.cwd();
  const path = join(cwd, CHANGELOG);
  const { text: wanted, skipped } = buildChangelog(cwd);

  // Named rather than dropped in silence: a release tagged with a bare `git tag` produces a
  // changelog missing that release, and the only symptom is an absence nobody looks for.
  for (const { name, why } of skipped) {
    console.error(`note: tag ${name} is not treated as a release — ${why}`);
  }

  if (!check) {
    writeFileSync(path, wanted);
    console.log(`wrote ${CHANGELOG}`);
    return 0;
  }

  if (!existsSync(path)) {
    console.error(`${CHANGELOG} is missing — run \`npm run changelog\`.`);
    return 1;
  }
  if (readFileSync(path, 'utf8') !== wanted) {
    console.error(`${CHANGELOG} does not match the tags — a release was tagged without regenerating it. Run \`npm run changelog\`.`);
    return 1;
  }
  console.log(`${CHANGELOG} matches the tags`);
  return 0;
}

// Resolved on both sides before comparing: a raw `file://${argv[1]}` check is false whenever
// the script is reached through a symlink, and main() then silently never runs (ADR-0015
// amendment, where that cost an install that exited 0 and did nothing).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
