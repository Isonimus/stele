#!/usr/bin/env node
// Installs the method kit into a git repo (ADR-0006). Dry-run by default.
//
//   node scripts/init-method.mjs <repo-root> [--apply] [--check] [--update]
//
// The load-bearing rule lives in installHook(): the pre-commit hook is linked ONLY
// against a corpus the linter calls clean. An unwired scripts/*-verify.mjs is an R11
// error, so a repo can be red on arrival — and a hook installed on a red corpus blocks
// every commit, which is the tool bricking the repo it was meant to protect.
//
// The linter always runs against the REPO ROOT. Pointed at a subdirectory holding no
// documents it would report "0 document(s) — ok" (the reason rule 10 exists), certifying
// an install that checks nothing.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, lstatSync, readlinkSync, symlinkSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

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
  ['.claude/hooks/pre-commit', '.claude/hooks/pre-commit'],
];

const COMMANDS_DIR = '.claude/commands';

/**
 * The slash commands, vendored too (ADR-0007) — same target path as toolkit path.
 *
 * Read from disk rather than listed, so a new command reaches installed repos without
 * anyone remembering to extend an array here.
 */
const commandFiles = (toolkit) =>
  readdirSync(join(toolkit, COMMANDS_DIR))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `${COMMANDS_DIR}/${name}`);

/** Scaffolded once and never overwritten: target path ← template path. */
const SCAFFOLD = [
  ['CLAUDE.md', 'templates/CLAUDE.md'],
  ['LEDGER.md', 'templates/LEDGER.md'],
];

const GLOBAL_LINK = 'global/CLAUDE.md';

/** What .git/hooks/pre-commit must point at to count as installed. */
const HOOK_LINK_TARGET = '../../.claude/hooks/pre-commit';

/** A repo using the `pre-commit` framework gets the checks composed into its config
 *  instead of a symlink, because that framework owns the same file (ADR-0008). */
const FRAMEWORK_CONFIG = '.pre-commit-config.yaml';

/** Identifies our block on re-runs, so composing is idempotent. */
const FRAMEWORK_HOOK_ID = 'claude-method-docs';

/** Appended verbatim. Mirrors .claude/hooks/pre-commit — the same two commands. */
const FRAMEWORK_BLOCK = `
  # Doc invariants (claude-method ADR-0003, composed by /init-method per ADR-0008).
  # Zero-dependency and language: system, so there is nothing to install but node.
  - repo: local
    hooks:
      - id: ${FRAMEWORK_HOOK_ID}
        name: doc invariants hold
        entry: node scripts/lint-docs.mjs .
        language: system
        pass_filenames: false
        always_run: true
      - id: claude-method-index
        name: adr/INDEX.md matches the corpus
        entry: node scripts/build-index.mjs --check .
        language: system
        pass_filenames: false
        always_run: true
`;

const read = (path) => readFileSync(path, 'utf8');

/** lstat that answers "what is here?" without throwing on absent. */
function inspect(path) {
  if (!existsSync(path) && !isSymlink(path)) return { kind: 'absent' };
  if (isSymlink(path)) return { kind: 'symlink', points: readlinkSync(path) };
  return { kind: 'file' };
}

/** existsSync follows symlinks, so a broken link reads as absent — the silent-vanish
 *  state ADR-0006 names. lstat is what distinguishes the two. */
function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * The global ~/.claude/CLAUDE.md link, in every mode.
 *
 * Three states, not two: absent is legal (global conventions simply do not apply), a
 * symlink into this toolkit is installed, and anything else is somebody's own file that
 * an installer must never touch.
 */
function globalLink({ toolkit, home, apply, report }) {
  const path = join(home, '.claude', 'CLAUDE.md');
  const want = join(toolkit, GLOBAL_LINK);
  const found = inspect(path);

  if (found.kind === 'symlink') {
    const resolved = found.points.startsWith('/') ? found.points : join(dirname(path), found.points);
    if (resolved === want) return report('ok', path, 'global conventions linked');
    if (!existsSync(resolved)) {
      return report('problem', path, `symlink is broken — points at ${found.points}, which does not exist. Global conventions are silently absent.`);
    }
    return report('problem', path, `symlink points at ${found.points}, not at this toolkit. Left untouched.`);
  }

  if (found.kind === 'file') {
    return report('problem', path, `a real file already lives here — refusing to overwrite it. Compare with \`diff ${path} ${want}\` and merge by hand.`);
  }

  if (!apply) return report('would', path, `link → ${want}`);
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(want, path);
  return report('wrote', path, `linked → ${want}`);
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
 * Slash commands, which are prose and therefore adaptable (ADR-0007).
 *
 * Copy-if-absent, unlike vendor(): a repo that has tailored `/slice` to its own workflow
 * must not have that overwritten by an install. `--update` is the explicit way to take
 * the toolkit's version back.
 */
function vendorCommands({ target, toolkit, apply, force, report }) {
  for (const path of commandFiles(toolkit)) {
    const to = join(target, path);
    const from = join(toolkit, path);
    if (matches(to, from)) {
      report('ok', to, 'current');
      continue;
    }
    if (existsSync(to) && !force) {
      report('keep', to, 'differs from the toolkit — left as it is; `--update` takes the toolkit version');
      continue;
    }
    const verb = existsSync(to) ? 'overwrite' : 'copy';
    if (!apply) {
      report('would', to, `${verb} from toolkit`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    report('wrote', to, `${verb === 'copy' ? 'copied' : 'overwritten'} from toolkit`);
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
    return report('problem', path, 'no top-level `repos:` key — unrecognised shape, refusing to edit it. Add the claude-method-docs block by hand.');
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

function check({ target, toolkit, report }) {
  for (const [dest, src] of VENDORED) {
    const to = join(target, dest);
    if (!existsSync(to)) report('problem', to, 'missing — run /init-method --apply');
    else if (!matches(to, join(toolkit, src))) report('problem', to, 'drifted from the toolkit — run /init-method --update');
    else report('ok', to, 'current');
  }

  // Commands are prose a repo may legitimately adapt, so their drift is informational
  // (ADR-0007) — reported so it is visible, never counted against a clean check.
  for (const path of commandFiles(toolkit)) {
    const to = join(target, path);
    if (!existsSync(to)) report('missing', to, 'not installed — run /init-method --apply');
    else if (!matches(to, join(toolkit, path))) report('local', to, 'differs from the toolkit — kept; `--update` takes the toolkit version');
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
 * @param {string} [options.home]    HOME for the global link (injected by tests, never guessed)
 * @param {'install'|'check'|'update'} [options.mode]
 * @param {boolean} [options.apply]  false = dry run, the default
 * @returns {{actions: Array<{status: string, path: string, message: string}>, problems: number}}
 */
export function initMethod({ target, toolkit = TOOLKIT, home = homedir(), mode = 'install', apply = false }) {
  const actions = [];
  const report = (status, path, message) => actions.push({ status, path, message });

  if (!existsSync(join(target, '.git'))) {
    report('problem', target, 'not a git repository — the hook has nowhere to live. Run `git init` first.');
    return { actions, problems: 1 };
  }

  if (mode === 'check') {
    check({ target, toolkit, report });
    globalLink({ toolkit, home, apply: false, report });
  } else if (mode === 'update') {
    vendor({ target, toolkit, apply, report });
    vendorCommands({ target, toolkit, apply, force: true, report });
  } else {
    scaffold({ target, toolkit, apply, report });
    vendor({ target, toolkit, apply, report });
    vendorCommands({ target, toolkit, apply, force: false, report });
    buildIndex({ target, apply, report });
    installHook({ target, apply, report });
    globalLink({ toolkit, home, apply, report });
  }

  return { actions, problems: actions.filter((a) => a.status === 'problem').length };
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const target = positional[0] ?? process.cwd();
  const mode = flags.has('--check') ? 'check' : flags.has('--update') ? 'update' : 'install';
  const apply = flags.has('--apply');

  const { actions, problems } = initMethod({ target, mode, apply });

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

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
