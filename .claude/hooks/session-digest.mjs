#!/usr/bin/env node
// SessionStart digest — puts this repo's open worklist in front of the model, because
// measurement showed it is not there (stele:ADR-0027).
//
// Only `CLAUDE.md` loads automatically. `LEDGER.md`, `docs/quality-bar.md` and
// `adr/INDEX.md` are cited from it and opened by nobody, so on an ordinary turn the
// deferrals this repo has already recorded are invisible and get re-derived or
// re-litigated. Citing a document is not loading it; this loads the part that changes.
//
// Wire it with a project-scope `.claude/settings.json` entry:
//
//   "SessionStart": [{ "hooks": [{ "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-digest.mjs\"" }] }]
//
// `SessionStart` stdout is injected into the model's context — unlike `PostToolUse`,
// which reaches it only by blocking. Measured 2026-09-09 against Claude Code 2.1.236,
// including that the event re-fires on resume (`source: "resume"`) and re-injects the
// whole payload, which is what makes the budget below a cap on a recurring cost rather
// than a one-off.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Byte ceiling on the injected digest — roughly 1,000 tokens at the usual ~4 bytes per
 * token for English prose (stele:ADR-0027 fixes the cap; this is the number and the
 * reason, per stele:ADR-0012).
 *
 * Measured on this repo: `LEDGER.md` whole is 15,691 bytes, and its open items reduced to
 * one line each are 1,350. Bytes rather than tokens because a tokeniser is a dependency
 * and this kit has none; the approximation errs high on prose, so the real cost lands
 * under the stated cap rather than over it.
 */
export const DIGEST_BUDGET_BYTES = 4000;

/** Documents `CLAUDE.md` cites but nothing opens. Named, not inlined: the pointer costs a
 *  line and the file costs thousands, and the digest's whole claim is that it is cheap. */
const CITED_BUT_UNLOADED = [
  ['docs/quality-bar.md', 'the quality bar this repo is held to'],
  ['adr/INDEX.md', 'the decision index'],
];

/**
 * The `- [tag] …` items under `## Open`, one first line each.
 *
 * First line only, and only the top level: a ledger item's continuation lines carry the
 * argument, which is what `LEDGER.md` is for. The digest exists to make the operator's
 * open work *known*, not to reproduce it. Items under `## Resolved` are excluded — a
 * closed item read as open is worse than not reading it at all.
 */
export function openLedgerItems(ledgerText) {
  const items = [];
  let inOpen = false;
  for (const line of ledgerText.split('\n')) {
    if (line.startsWith('## ')) {
      inOpen = line.trim() === '## Open';
      continue;
    }
    if (inOpen && /^- \[[a-z]+\] /.test(line)) items.push(line.trimEnd());
  }
  return items;
}

/** The digest for `root`, or `''` when there is nothing worth injecting. */
export function buildDigest(root) {
  const ledgerPath = join(root, 'LEDGER.md');

  // A repo without a ledger is a repo the kit has not been installed into yet. Silence is
  // the honest answer, not an error on every session start.
  if (!existsSync(ledgerPath)) return '';

  const items = openLedgerItems(readFileSync(ledgerPath, 'utf8'));
  if (!items.length) return '';

  const pointers = CITED_BUT_UNLOADED
    .filter(([path]) => existsSync(join(root, path)))
    .map(([path, what]) => `${path} (${what})`);

  const head = `Open items in this repo's LEDGER.md, first line each — ${items.length} of them. `
    + 'Read the full entry there before acting on one, and add a line there rather than a '
    + 'TODO in code when this task defers something.';
  const tail = pointers.length
    ? `\nAlso cited from CLAUDE.md and not loaded: ${pointers.join('; ')}.`
    : '';

  const notice = (omitted) =>
    `\n… ${omitted} further item(s) omitted to stay inside the digest budget; open LEDGER.md.`;

  // The `+ 1` is the newline the digest ends with, so the budget covers the bytes actually
  // emitted rather than those bytes less one.
  const fixed = Buffer.byteLength(head) + Buffer.byteLength(tail) + 1;
  const costs = items.map((item) => Buffer.byteLength(`\n${item}`));

  let kept = 0;
  let used = fixed;
  while (kept < items.length && used + costs[kept] <= DIGEST_BUDGET_BYTES) {
    used += costs[kept];
    kept += 1;
  }

  // Pay for the truncation notice only if there is going to be one. Reserving its bytes
  // against every item drops an item that would have fitted and then blames the budget for
  // it — a digest that misreports why it is short is worse than a longer one, and an
  // adversarial pass (stele:ADR-0017) reproduced exactly that. Making room can push a
  // further item out, which shortens the notice, so this re-checks rather than assuming one
  // pass settles it.
  while (kept > 0 && kept < items.length
      && used + Buffer.byteLength(notice(items.length - kept)) > DIGEST_BUDGET_BYTES) {
    kept -= 1;
    used -= costs[kept];
  }

  const omitted = items.length - kept;
  return `${head}\n${items.slice(0, kept).join('\n')}${omitted > 0 ? notice(omitted) : ''}${tail}\n`;
}

function main() {
  // `SessionStart` supplies a payload on stdin, but nothing in it is needed: the digest is
  // a property of the repo, not of how the session began. Draining stdin anyway keeps the
  // client from writing into a closed pipe.
  if (!process.stdin.isTTY) {
    try {
      readFileSync(0, 'utf8');
    } catch {
      // A payload we cannot read changes nothing we do; the digest does not depend on it.
    }
  }

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  process.stdout.write(buildDigest(root));
  return 0;
}

// realpath, not a string compare on argv[1] (stele:ADR-0015).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
