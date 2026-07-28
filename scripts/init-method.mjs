#!/usr/bin/env node
// Installs the method kit into a git repo (ADR-0006). Dry-run by default.
//
//   node scripts/init-method.mjs <repo-root> [--apply] [--check] [--update [--force]]
//
// The load-bearing rule lives in installHook(): the pre-commit hook is linked ONLY
// against a corpus the linter calls clean. An unwired scripts/*-verify.mjs is an R11
// error, so a repo can be red on arrival — and a hook installed on a red corpus blocks
// every commit, which is the tool bricking the repo it was meant to protect.
//
// The linter always runs against the REPO ROOT. Pointed at a subdirectory holding no
// documents it would report "0 document(s) — ok" (the reason rule 10 exists), certifying
// an install that checks nothing.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, lstatSync, readlinkSync, symlinkSync, unlinkSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lint, loadDocs } from './lint-docs.mjs';
import { renderIndex } from './build-index.mjs';

const TOOLKIT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Machinery vendored into every installed repo: target path ← toolkit path. Copies
 *  rather than symlinks, because a symlink into this checkout resolves on one machine
 *  only. These must stay byte-identical — a locally edited linter is a silently
 *  different linter, so `--check` calls any difference a problem. */
const VENDORED = [
  ['scripts/lint-docs.mjs', 'scripts/lint-docs.mjs'],
  ['scripts/build-index.mjs', 'scripts/build-index.mjs'],
  ['scripts/check-immutable.mjs', 'scripts/check-immutable.mjs'],
  ['.claude/hooks/pre-commit', '.claude/hooks/pre-commit'],
];

const COMMANDS_DIR = '.claude/commands';

/**
 * The slash commands, vendored too (ADR-0023) — same target path as toolkit path.
 *
 * Read from disk rather than listed, so a new command reaches installed repos without
 * anyone remembering to extend an array here.
 */
const commandFiles = (toolkit) =>
  readdirSync(join(toolkit, COMMANDS_DIR))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `${COMMANDS_DIR}/${name}`);

/**
 * What the toolkit last handed this repo: command path → SHA-256 of the content written
 * there (ADR-0023).
 *
 * Without it an update sees two states where three are needed — a stale copy of an older
 * release and a deliberate local adaptation are the same observation, "differs from the
 * toolkit", and the only safe reading of that is the destructive one. Committed, not
 * ignored: a fresh clone missing it classifies every command as unreconciled.
 */
const PROVENANCE = '.claude/.stele-vendored.json';

/** Bumped only when the record's shape changes; an unrecognised version is treated as no
 *  record at all, which keeps every command rather than overwriting it. */
const PROVENANCE_VERSION = 1;

const digest = (text) => createHash('sha256').update(text).digest('hex');

/** Scaffolded once and never overwritten: target path ← template path. */
const SCAFFOLD = [
  ['CLAUDE.md', 'templates/CLAUDE.md'],
  ['LEDGER.md', 'templates/LEDGER.md'],
];

/** What .git/hooks/pre-commit must point at to count as installed. */
const HOOK_LINK_TARGET = '../../.claude/hooks/pre-commit';

/** A repo using the `pre-commit` framework gets the checks composed into its config
 *  instead of a symlink, because that framework owns the same file (ADR-0008). */
const FRAMEWORK_CONFIG = '.pre-commit-config.yaml';

/** Identifies our block on re-runs, so composing is idempotent. */
const FRAMEWORK_HOOK_ID = 'stele-docs';

/**
 * Appended verbatim. Mirrors .claude/hooks/pre-commit — the same two checks.
 *
 * These deliberately run against the working tree (`.`), where the hook materialises the
 * staged tree first (ADR-0018). It is not an oversight and must not be "fixed" into a
 * copy of that machinery: the framework stashes unstaged changes before dispatching, so
 * by the time these entries run the working tree already *is* the index. Reproducing the
 * archive dance here would duplicate what the framework provides — which is the whole
 * reason ADR-0008 chose to compose with it rather than fight it for the file.
 */
const FRAMEWORK_BLOCK = `
  # Doc invariants (stele:ADR-0003, composed by /init-method per stele:ADR-0008).
  # Zero-dependency and language: system, so there is nothing to install but node.
  - repo: local
    hooks:
      - id: ${FRAMEWORK_HOOK_ID}
        name: doc invariants hold
        entry: node scripts/lint-docs.mjs .
        language: system
        pass_filenames: false
        always_run: true
      - id: stele-index
        name: adr/INDEX.md matches the corpus
        entry: node scripts/build-index.mjs --check .
        language: system
        pass_filenames: false
        always_run: true
      - id: stele-immutable
        name: immutable documents only grow
        entry: node scripts/check-immutable.mjs
        language: system
        pass_filenames: false
        always_run: true
`;

const read = (path) => readFileSync(path, 'utf8');

/** existsSync follows symlinks, so a broken link reads as absent — the silent-vanish
 *  state ADR-0006 names. lstat is what distinguishes the two. */
function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** The linter's error findings for a repo.
 *  Always the repo ROOT: pointed at a subdirectory holding no documents the linter
 *  reports "0 document(s) — ok", certifying an install that checks nothing (rule 10). */
const lintErrors = (target) => lint(target).findings.filter((f) => f.severity === 'error');

/** True when the target's copy is byte-identical to the toolkit's. */
const matches = (targetPath, toolkitPath) =>
  existsSync(targetPath) && read(targetPath) === read(toolkitPath);

function vendor({ target, toolkit, apply, report }) {
  for (const [dest, src] of VENDORED) {
    const to = join(target, dest);
    const from = join(toolkit, src);
    if (matches(to, from)) {
      report('ok', to, 'current');
      continue;
    }
    const verb = existsSync(to) ? 'update' : 'copy';
    if (!apply) {
      report('would', to, `${verb} from toolkit`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    report('wrote', to, `${verb}d from toolkit`);
  }
}

/**
 * The recorded digests, or `{}` when there is no usable record.
 *
 * A record we cannot read is reported and then treated as absent. That is the safe
 * direction and not a silenced error: every command classifies as `unknown`, so nothing is
 * overwritten and the operator sees why (ADR-0023).
 */
export function readProvenance(target, report) {
  const path = join(target, PROVENANCE);
  if (!existsSync(path)) return {};

  let parsed;
  try {
    parsed = JSON.parse(read(path));
  } catch (error) {
    report('problem', path, `unreadable (${error.message}) — treating every command as unreconciled, so none will be overwritten. Delete it to start a fresh record.`);
    return {};
  }

  const commands = parsed?.commands;
  if (parsed?.version !== PROVENANCE_VERSION || typeof commands !== 'object' || commands === null) {
    report('problem', path, `unrecognised shape (expected version ${PROVENANCE_VERSION}) — treating every command as unreconciled, so none will be overwritten.`);
    return {};
  }
  return commands;
}

function writeProvenance(target, commands) {
  const path = join(target, PROVENANCE);
  const ordered = Object.fromEntries(Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ version: PROVENANCE_VERSION, commands: ordered }, null, 2)}\n`);
}

/**
 * What an installed command is, relative to the toolkit and to what we last handed over.
 *
 * `stale` and `adapted` are the two states the old boolean could not tell apart, and the
 * whole of ADR-0023 is the ability to name them separately. `unknown` is a differing file
 * with no record — an install predating the record — which is kept, because assuming
 * permission to overwrite is exactly the incident.
 *
 * @returns {'absent'|'current'|'stale'|'adapted'|'unknown'}
 */
export function classifyCommand({ targetText, toolkitText, recordedDigest }) {
  if (targetText === null) return 'absent';
  if (targetText === toolkitText) return 'current';
  if (recordedDigest === undefined) return 'unknown';
  return digest(targetText) === recordedDigest ? 'stale' : 'adapted';
}

const KEPT_REASON = {
  stale: 'behind the toolkit but unmodified here — `--update` takes the new version',
  adapted: 'adapted locally — kept; `--update --force` discards the adaptation',
  unknown: 'differs from the toolkit and predates the vendoring record, so it cannot be told from a local adaptation — kept. Reconcile it once by hand, or `--update --force` to take the toolkit version',
};

/**
 * Slash commands, which are prose and therefore adaptable (ADR-0023).
 *
 * Copy-if-absent, unlike vendor(): a repo that has tailored `/slice` to its own workflow
 * must not have that overwritten. `--update` additionally refreshes anything the repo has
 * not touched, and only `--force` discards an adaptation (ADR-0023).
 */
function vendorCommands({ target, toolkit, apply, update, force, report }) {
  const recorded = readProvenance(target, report);
  const learned = { ...recorded };
  let changed = false;

  for (const path of commandFiles(toolkit)) {
    const to = join(target, path);
    const toolkitText = read(join(toolkit, path));
    const state = classifyCommand({
      targetText: existsSync(to) ? read(to) : null,
      toolkitText,
      recordedDigest: recorded[path],
    });

    // An up-to-date command is how an install predating the record acquires one: its bytes
    // ARE the toolkit's, so the digest is known without having written anything.
    if (state === 'current') {
      report('ok', to, 'current');
      if (recorded[path] !== digest(toolkitText)) {
        learned[path] = digest(toolkitText);
        changed = true;
      }
      continue;
    }

    const takeover = state === 'absent' || (update && (state === 'stale' || force));
    if (!takeover) {
      report('keep', to, KEPT_REASON[state]);
      continue;
    }

    const verb = state === 'absent' ? 'copy' : 'overwrite';
    if (!apply) {
      report('would', to, `${verb} from toolkit`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, toolkitText);
    learned[path] = digest(toolkitText);
    changed = true;
    report('wrote', to, `${verb === 'copy' ? 'copied' : 'overwritten'} from toolkit`);
  }

  // Never on a dry run: the record describes what is on disk, and writing it while writing
  // nothing else would claim we handed over files we did not.
  if (apply && changed) {
    writeProvenance(target, learned);
    report('wrote', join(target, PROVENANCE), 'recorded what was vendored, so a later --update can tell a stale command from an adapted one');
  }
}

function scaffold({ target, toolkit, apply, report }) {
  const adr = join(target, 'adr');
  if (!existsSync(adr)) {
    if (apply) mkdirSync(adr, { recursive: true });
    report(apply ? 'wrote' : 'would', adr, 'create adr/');
  }

  for (const [dest, src] of SCAFFOLD) {
    const to = join(target, dest);
    if (existsSync(to)) {
      // A repo's own conventions outrank a template; never merge, never overwrite.
      report('keep', to, 'already exists — left as it is');
      continue;
    }
    if (!apply) {
      report('would', to, `scaffold from ${src}`);
      continue;
    }
    writeFileSync(to, read(join(toolkit, src)));
    report('wrote', to, `scaffolded from ${src} — fill its {{PLACEHOLDER}} fields`);
  }
}

function buildIndex({ target, apply, report }) {
  const path = join(target, 'adr', 'INDEX.md');
  const docs = loadDocs(target).filter((d) => d.ok);
  const wanted = renderIndex(docs);
  if (existsSync(path) && read(path) === wanted) return report('ok', path, 'current');
  if (!apply) return report('would', path, 'generate index');
  writeFileSync(path, wanted);
  report('wrote', path, `generated — ${docs.length} decision(s)`);
}

/**
 * Links the hook, but only onto a clean corpus.
 *
 * The refusal is the decision (ADR-0006). A warning here would be a rule enforced by
 * memory, which is the failure this whole kit exists to fix.
 */
function installHook({ target, apply, report }) {
  // A dry run over a repo with no adr/ cannot judge the corpus: the linter would report
  // R10 "no adr/ — is this the repo root?" against a directory --apply creates two steps
  // earlier. Refusing on that would be a plan that contradicts what applying does.
  if (!apply && !existsSync(join(target, 'adr'))) {
    return report('would', join(target, '.git', 'hooks', 'pre-commit'), 'decide once adr/ exists — a dry run cannot check a corpus that has not been scaffolded yet');
  }

  const errors = lintErrors(target);
  if (errors.length > 0) {
    for (const f of errors) report('problem', f.path, f.message);
    report('problem', target, `${errors.length} lint error(s) — REFUSING to install the pre-commit hook. A hook on a red corpus blocks every commit. Fix these (an unwired scripts/*-verify.mjs is wired by adding it to package.json), then re-run.`);
    return;
  }

  if (existsSync(join(target, FRAMEWORK_CONFIG))) return composeHook({ target, apply, report });

  const path = join(target, '.git', 'hooks', 'pre-commit');
  if (isSymlink(path) && readlinkSync(path) === HOOK_LINK_TARGET && existsSync(path)) {
    return report('ok', path, 'hook installed');
  }
  if (existsSync(path) && !isSymlink(path)) {
    return report('problem', path, 'a hook already exists here and is not ours — left untouched.');
  }
  if (!apply) return report('would', path, `link → ${HOOK_LINK_TARGET}`);

  mkdirSync(dirname(path), { recursive: true });
  if (isSymlink(path)) unlinkSync(path);
  symlinkSync(HOOK_LINK_TARGET, path);
  report('wrote', path, `linked → ${HOOK_LINK_TARGET}`);
}

/**
 * Joins the pre-commit framework instead of taking .git/hooks/pre-commit (ADR-0008).
 *
 * A symlink here would work until the next `pre-commit install`, which replaces the file
 * with no error and takes the doc checks with it — a guarantee a third party can revoke
 * silently is not a guarantee.
 */
function composeHook({ target, apply, report }) {
  const path = join(target, FRAMEWORK_CONFIG);
  const config = read(path);

  // Refuse rather than guess: this is a textual append into a file we do not own.
  if (!/^repos:/m.test(config)) {
    return report('problem', path, 'no top-level `repos:` key — unrecognised shape, refusing to edit it. Add the stele-docs block by hand.');
  }

  if (config.includes(FRAMEWORK_HOOK_ID)) report('ok', path, 'doc checks composed into the framework');
  else if (!apply) report('would', path, 'append the doc checks as a `repo: local` block');
  else {
    writeFileSync(path, `${config.replace(/\n*$/, '\n')}${FRAMEWORK_BLOCK}`);
    report('wrote', path, 'appended the doc checks as a `repo: local` block');
  }

  frameworkInstalled({ target, report });
}

/** The framework's own dispatcher. Configured-but-not-installed means nothing runs at
 *  all, while the config still reads as protection. */
function frameworkInstalled({ target, report }) {
  const hook = join(target, '.git', 'hooks', 'pre-commit');
  if (existsSync(hook)) report('ok', hook, 'the framework dispatcher is installed');
  else report('problem', hook, 'the pre-commit framework is configured but never installed — no hook runs at all, including its own. Run `pre-commit install`.');
}

/**
 * Reports a corpus the freshly vendored linter calls red.
 *
 * `--apply` refuses to *install* a hook on a red corpus, because a hook that blocks every
 * commit is the tool bricking the repo it protects. `--update` reaches the same state by
 * the other door and had no equivalent guard: a release that adds an error-severity rule
 * lands a stricter linter behind a hook that is already live, and the next commit fails
 * with no hint that an update caused it.
 *
 * It reports rather than refuses. By the time the copy is written the old linter is gone,
 * so there is nothing to decline into — and rolling back would leave the repo on machinery
 * the operator explicitly asked to replace. Loud and accurate beats a silent half-update.
 */
function lintAfterUpdate({ target, report }) {
  const errors = lintErrors(target);
  if (errors.length === 0) {
    return report('ok', target, 'corpus still clean under the updated linter');
  }
  for (const f of errors) report('problem', f.path, f.message);
  report('problem', target, `${errors.length} lint error(s) under the updated linter — the hook is live, so every commit is blocked until these are fixed. \`git commit --no-verify\` is the escape hatch while you do.`);
}

function check({ target, toolkit, report }) {
  for (const [dest, src] of VENDORED) {
    const to = join(target, dest);
    if (!existsSync(to)) report('problem', to, 'missing — run /init-method --apply');
    else if (!matches(to, join(toolkit, src))) report('problem', to, 'drifted from the toolkit — run /init-method --update');
    else report('ok', to, 'current');
  }

  // An *adaptation* is prose a repo may legitimately own, so it stays informational. A
  // command merely behind and unmodified is a repo missing a fix, which is a problem — the
  // record is what lets --check tell those two apart at all (ADR-0023, superseding ADR-0007,
  // under which no command difference could be counted and so a shipped defect in one was
  // invisible in every installed repo).
  const recorded = readProvenance(target, report);
  for (const path of commandFiles(toolkit)) {
    const to = join(target, path);
    const state = classifyCommand({
      targetText: existsSync(to) ? read(to) : null,
      toolkitText: read(join(toolkit, path)),
      recordedDigest: recorded[path],
    });
    if (state === 'absent') report('missing', to, 'not installed — run /init-method --apply');
    else if (state === 'stale') report('problem', to, 'behind the toolkit and unmodified here — run /init-method --update');
    else if (state !== 'current') report('local', to, KEPT_REASON[state]);
    else report('ok', to, 'current');
  }

  // The framework's presence is the single discriminator, so --check cannot disagree
  // with --apply about which install shape is in force (ADR-0008).
  const framework = join(target, FRAMEWORK_CONFIG);
  const hook = join(target, '.git', 'hooks', 'pre-commit');
  if (existsSync(framework)) {
    if (read(framework).includes(FRAMEWORK_HOOK_ID)) report('ok', framework, 'doc checks composed into the framework');
    else report('problem', framework, 'the pre-commit framework runs here but not the doc checks — run /init-method --apply');
    frameworkInstalled({ target, report });
  } else if (!isSymlink(hook)) report('problem', hook, 'no hook installed — nothing checks commits');
  else if (!existsSync(hook)) report('problem', hook, `broken symlink → ${readlinkSync(hook)}; commits are unchecked and silent about it`);
  else report('ok', hook, 'hook installed and resolving');

  const index = join(target, 'adr', 'INDEX.md');
  const docs = loadDocs(target).filter((d) => d.ok);
  if (!existsSync(index)) report('problem', index, 'missing — run /init-method --apply');
  else if (read(index) !== renderIndex(docs)) report('problem', index, 'stale — regenerate it');
  else report('ok', index, 'current');

  const errors = lintErrors(target);
  if (errors.length > 0) report('problem', target, `${errors.length} lint error(s) — the corpus is red`);
  else report('ok', target, `corpus clean — ${docs.length} document(s)`);
}

/**
 * @param {object} options
 * @param {string} options.target   repo to install into
 * @param {string} [options.toolkit] this kit's root (overridable for tests)
 * @param {'install'|'check'|'update'} [options.mode]
 * @param {boolean} [options.apply]  false = dry run, the default
 * @param {boolean} [options.force]  update only: discard local command adaptations too
 * @returns {{actions: Array<{status: string, path: string, message: string}>, problems: number}}
 */
export function initMethod({ target, toolkit = TOOLKIT, mode = 'install', apply = false, force = false }) {
  const actions = [];
  const report = (status, path, message) => actions.push({ status, path, message });

  if (!existsSync(join(target, '.git'))) {
    report('problem', target, 'not a git repository — the hook has nowhere to live. Run `git init` first.');
    return { actions, problems: 1 };
  }

  if (mode === 'check') {
    check({ target, toolkit, report });
  } else if (mode === 'update') {
    vendor({ target, toolkit, apply, report });
    vendorCommands({ target, toolkit, apply, update: true, force, report });
    if (apply) lintAfterUpdate({ target, report });
  } else {
    scaffold({ target, toolkit, apply, report });
    vendor({ target, toolkit, apply, report });
    vendorCommands({ target, toolkit, apply, update: false, force: false, report });
    buildIndex({ target, apply, report });
    installHook({ target, apply, report });
  }

  return { actions, problems: actions.filter((a) => a.status === 'problem').length };
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const target = positional[0] ?? process.cwd();
  const mode = flags.has('--check') ? 'check' : flags.has('--update') ? 'update' : 'install';
  const apply = flags.has('--apply');
  const force = flags.has('--force');

  if (force && mode !== 'update') {
    console.error('--force only means anything with --update: it discards local command adaptations.');
    return 1;
  }

  const { actions, problems } = initMethod({ target, mode, apply, force });

  console.log(`\n${target} — /init-method ${mode}${apply || mode === 'check' ? '' : ' (dry run)'}`);
  for (const a of actions) {
    const where = a.path === target ? target : relative(target, a.path) || a.path;
    console.log(`  ${a.status.toUpperCase().padStart(7)}  ${where}: ${a.message}`);
  }
  if (!apply && mode === 'install') {
    console.log('\nNothing was written. Re-run with --apply to perform the install.');
  }
  console.log(`\n${problems} problem(s)`);
  return problems > 0 ? 1 : 0;
}

// A bin is invoked through a symlink (npm links node_modules/.bin/stele → this file), so
// process.argv[1] is the LINK path while import.meta.url resolves to the real file — a raw
// `file://${argv[1]}` compare is false under npx and main() silently never runs, no-opping
// the whole install (ADR-0015 amendment). Resolve both to real paths before comparing.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
