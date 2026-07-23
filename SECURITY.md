# Security Policy

## Supported Versions

Stele is pre-1.0; fixes land on the latest release.

| Version | Supported |
|---------|-----------|
| 0.x     | ✓         |

## Scope

Stele is a zero-dependency developer tool. It runs `node scripts/*.mjs` over a repo's own
documents and installs a local git hook — it has no network surface, no server, and no
secret handling. The realistic concerns are the installer writing outside its intended
paths or the linter mishandling crafted input; reports in that spirit are welcome.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report privately, either:

- **GitHub Private Vulnerability Reporting** (preferred) — on this repository, go to
  **Security → Report a vulnerability**. This routes straight to the maintainers and keeps
  the report confidential until a fix ships.
- **Email** — ikerlaforga@gmail.com, if you prefer.

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive an acknowledgement within **48 hours** and a status update or resolution
within **90 days**. Once a fix is released, the issue is disclosed publicly with credit to
the reporter, unless you prefer to remain anonymous.
