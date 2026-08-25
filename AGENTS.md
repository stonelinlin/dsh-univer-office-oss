# Engineering instructions

- Prefer the smallest maintainable local-first implementation. Do not add compatibility layers for removed Pro services.
- Never add `@univerjs-pro/*`, `@univer-cli/*`, `@superdoc/docx-engine`, or native Pro bindings.
- Do not inspect, benchmark, reverse engineer, or emulate `@superdoc/docx-engine`.
- Preserve worktree safety invariants: draft-only writes, explicit ready/reopen, terminal merge/discard, and conflict-safe merge.
- Every browser file operation must be authorized against a live DSH session workspace.
- Run `pnpm run typecheck` and the narrowest relevant test. Run `pnpm test` for cross-layer changes.
- `vendor/univer` and `vendor/superdoc-document-api` are upstream source mirrors. Keep local integration code outside vendored trees.
- Generated `lib/` and `artifacts/` are never committed.
