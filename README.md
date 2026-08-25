# DSH × Univer Office OSS

A local-first DSH office plugin built from checked-in open-source code. It keeps the original structured tool and review workflow while replacing the proprietary collaboration Gateway, Worktree service, exchange bindings, CLI runtime, and Viewer with a local revision store, OSS Univer, and open Office adapters.

## Current scope

- `.univer` JSON containers with atomic local writes.
- Isolated `draft → ready → merge/discard` worktrees. `merged` and `discarded` are terminal.
- `univer_new`, `univer_status`, `univer_worktree`, `univer_unit`, `univer_inspect`, `univer_execute`, and `univer_export`.
- `univer_import` for CSV, XLSX, and DOCX.
- Sheet and Doc Facade execution on the OSS JavaScript formula/runtime stack.
- Source-built local Sheet/Doc Viewer with draft autosave and session-scoped authorization.
- CSV/XLSX import and export through ExcelJS; basic DOCX text import/export through Mammoth and docx.
- SuperDoc's engine-agnostic `@superdoc/document-api` source is vendored for the Doc API contract; Doc inspection includes a basic SDM/1 projection.

## Explicit limits

- DOCX conversion is basic text fidelity; it does not clone or use SuperDoc's proprietary `@superdoc/docx-engine`.
- Slide, Base, and Board snapshots can be created and structurally viewed, but Facade editing and Office export are not implemented.
- No multiplayer OT/CRDT gateway, screenshot renderer, pivot tables, charts, sparklines, or Pro asset registry.
- A stale worktree never auto-rebases. Merge fails closed when trunk revision changed.
- `.univer` files are this project's open JSON format, not the proprietary database format used by the upstream Pro Gateway.

## Development

Requires Node.js 22.19+ and pnpm 11.20.

```bash
pnpm install
pnpm run typecheck
pnpm test
```

Univer 1.0.0-beta.2 source lives in `vendor/univer`. SuperDoc's engine-independent Document API source lives in `vendor/superdoc-document-api`. Generated `lib/` and `artifacts/` are not committed.

## Licensing

This combined work is AGPL-3.0-only because it incorporates SuperDoc AGPL source. Vendored Univer remains Apache-2.0. ExcelJS, Mammoth, docx, and other dependencies keep their respective licenses. See `THIRD_PARTY_LICENSES.md` and the license files inside vendored projects.
