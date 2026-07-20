# ADR 0123 — Chunk pipeline backpressure

## Status

Accepted (2026-07-18)

## Context

- **Stale work still runs.** Superseded mesh jobs and left-behind generation
  jobs still occupy workers.
- **Worker-side cancellation** of superseded jobs is pointless once queues are short.
