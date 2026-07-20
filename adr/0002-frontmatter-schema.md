---
id: 0002
title: ADR frontmatter schema
type: architecture
status: accepted
date: 2026-07-20
supersedes: []
superseded_by: []
---

# ADR 0002 — ADR frontmatter schema

## Context

ADR-0001 requires a machine-checkable corpus, but no existing ADR in either repo is
machine-readable. The survey found three mutually incompatible status dialects, split
chronologically:

| Dialect | Count | Shape |
|---|---|---|
| `## Status` H2, value on the next line | 68 | boxel 0001–0064, 0125–0128 |
| Bare `Status: ...` paragraph at line 3 | 62 | boxel 0065–0124, 0129, 0130 |
| `- Status: <value> (<date>)` bullet | 8 | gamatar |

with sub-variants inside those (`**Accepted**` ×7, `ACCEPTED` ×1). The status vocabulary
in actual use is `accepted` (125), `proposed` (4), `implemented` (1), `superseded` (1).

Cross-references are equally split: boxel carries **567 bare `ADR 0123` references and
zero markdown links**; gamatar uses markdown links exclusively, hyphenated (`ADR-0008`).

Two parsing hazards were confirmed by inspection:

- `0095-status-effects.md` — the H1 *title* contains "Status", so `grep -i status | head -1`
  matches the title, not the field.
- In the 62-file inline family, the status token heads a multi-paragraph prose blob
  running to the next `## ` heading. A line-bounded regex captures a whole paragraph.

Consequently nothing can be audited today, and the five supersession defects catalogued
in ADR-0003 went unnoticed for weeks.

## Decision

Every ADR carries YAML frontmatter as its first bytes:

```yaml
---
id: 0112                    # 4-digit, matches the filename ordinal
title: Mountains biome      # plain text, no markdown
type: architecture | slice | batch
status: accepted | proposed | superseded | amended
date: 2026-07-16            # ISO 8601
supersedes: []              # list of ids
superseded_by: [0122]       # list of ids
---
```

- **`type`** carries the ADR-0001 distinction. `architecture` = a cross-cutting
  mechanism, data format, or boundary that later ADRs must obey. `slice` = one feature
  work-unit. `batch` exists because ~12 boxel ADRs bundle several unrelated features and
  cannot map 1:1 to a work item; it marks them as unsplittable rather than pretending
  otherwise.
- **`supersedes` / `superseded_by` are lists of ids**, not prose and not links. Ids are
  the join key. Prose references stay in the body, unparsed, and are checked only as a
  warning (ADR-0003 rule 9).
- Frontmatter is the **sole** machine-readable surface. Body prose is never parsed for
  meaning. This is what lets bodies stay immutable while metadata evolves.

The schema is deliberately closed and small: seven fields, fixed vocabularies, no nesting
beyond flat id lists. That is what permits a hand-written parser with no YAML dependency
(ADR-0003).

## Consequences

- The corpus becomes queryable: supersession graphs, open-decision lists, and the
  architecture/slice view are all derivable, satisfying ADR-0001's "generated" category.
- Migration must handle all three dialects and both hazard cases. It prepends frontmatter
  only — no body prose is touched, no file is renamed — so all 567 bare cross-references
  remain valid.
- `type:` records the architecture/slice split without physically moving files. A
  directory split would have rewritten every one of those 567 references for no
  additional query power.
- Slug is **not** a key: `0068-lava-fluid.md` and `0128-lava-fluid.md` share one, as do
  the three `farming` files. `id` is the only identifier.
- Legacy status values must be mapped, not preserved: `implemented` → `accepted`,
  `ACCEPTED`/`**Accepted**` → `accepted`. The `amended` value is retained because 36
  files carry dated amendment blocks that are a real state, not a synonym.
- Cost: hand-written YAML is easy to get subtly wrong. Rule 1 (ADR-0003) rejects
  unparseable frontmatter outright rather than guessing.
