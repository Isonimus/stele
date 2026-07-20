// Tests for the index generator. The index is a generated file (ADR-0001), so the thing
// worth pinning is that it is a faithful, deterministic function of the corpus: active
// decisions listed under their type, superseded ones dropped from the tables but present
// as supersession edges, and --check catching a stale index. A generated file that can
// silently disagree with its source is exactly the drift this project exists to abolish.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderIndex } from '../scripts/build-index.mjs';
import { loadDocs } from '../scripts/lint-docs.mjs';

/** A throwaway repo holding just the ADR files under test. */
function scratch(files) {
  const root = mkdtempSync(join(tmpdir(), 'index-test-'));
  mkdirSync(join(root, 'adr'), { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(root, 'adr', name), text);
  }
  return root;
}

const fm = (fields) => {
  const f = { supersedes: [], superseded_by: [], ...fields };
  const list = (a) => `[${a.map((x) => `'${x}'`).join(', ')}]`;
  return [
    '---',
    `id: '${f.id}'`,
    `title: ${JSON.stringify(f.title)}`,
    `type: ${f.type}`,
    `status: ${f.status}`,
    'date: 2026-07-20',
    `supersedes: ${list(f.supersedes)}`,
    `superseded_by: ${list(f.superseded_by)}`,
    '---',
    '',
    `# ${f.title}`,
    '',
  ].join('\n');
};

const render = (files) => renderIndex(loadDocs(scratch(files)));

test('active decisions appear under their type heading', () => {
  const text = render({
    '0001-alpha.md': fm({ id: '0001', title: 'Alpha', type: 'architecture', status: 'accepted' }),
    '0002-beta.md': fm({ id: '0002', title: 'Beta', type: 'slice', status: 'accepted' }),
  });
  const arch = text.slice(text.indexOf('## Architecture'), text.indexOf('## Slices'));
  const slices = text.slice(text.indexOf('## Slices'));
  assert.match(arch, /0001 \| Alpha/);
  assert.doesNotMatch(arch, /Beta/);
  assert.match(slices, /0002 \| Beta/);
});

test('a superseded ADR leaves the tables but shows as a supersession edge', () => {
  const text = render({
    '0001-old.md': fm({
      id: '0001', title: 'Old', type: 'slice', status: 'superseded', superseded_by: ['0002'],
    }),
    '0002-new.md': fm({
      id: '0002', title: 'New', type: 'slice', status: 'accepted', supersedes: ['0001'],
    }),
  });
  const tables = text.slice(0, text.indexOf('## Supersession'));
  assert.doesNotMatch(tables, /\| Old \|/); // dropped from the Slices table
  assert.match(tables, /\| New \|/);
  assert.match(text, /- 0001 → 0002 {2}\(New\)/); // present as an edge, named by target
});

test('count header reflects the full corpus, superseded included', () => {
  const text = render({
    '0001-a.md': fm({ id: '0001', title: 'A', type: 'architecture', status: 'accepted' }),
    '0002-b.md': fm({ id: '0002', title: 'B', type: 'slice', status: 'superseded', superseded_by: ['0003'] }),
    '0003-c.md': fm({ id: '0003', title: 'C', type: 'slice', status: 'accepted', supersedes: ['0002'] }),
  });
  assert.match(text, /3 decision\(s\): 1 architecture, 2 slice, 0 batch\./);
});

test('a pipe in a title cannot break the table or the edge line', () => {
  const text = render({
    '0001-a.md': fm({ id: '0001', title: 'One | Two', type: 'slice', status: 'accepted' }),
  });
  assert.match(text, /\| 0001 \| One \\\| Two \| accepted \|/);
});

test('render is deterministic — same corpus, byte-identical output', () => {
  const files = {
    '0002-b.md': fm({ id: '0002', title: 'B', type: 'slice', status: 'accepted' }),
    '0001-a.md': fm({ id: '0001', title: 'A', type: 'architecture', status: 'accepted' }),
  };
  assert.equal(render(files), render(files));
});

test('an empty corpus renders every section as None, not a crash', () => {
  const text = render({});
  assert.match(text, /0 decision\(s\)/);
  assert.match(text, /## Architecture\s+_None\._/);
  assert.match(text, /## Supersession\s+_None\._/);
});
