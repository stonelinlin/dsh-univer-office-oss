---
name: univer
description: Create, inspect, edit, import, export, and review local .univer Sheet and Doc files through DSH tools and isolated worktrees.
---

# Open Univer workflow

1. For a new file, call `univer_new`; otherwise begin with `univer_status`.
2. Create one worktree with `univer_worktree action=create`.
3. Create a Sheet or Doc with `univer_unit`, or import CSV/XLSX/DOCX with `univer_import`.
4. Modify the explicit `file + worktreeId + unitId` with `univer_execute`.
5. Verify the changed scope with `univer_inspect` and export only when requested.
6. Mark the worktree `ready`. Merge or discard only when the user explicitly requests it.

Writes are allowed only in `draft`. Reopen a `ready` worktree before changing it. Never reuse `merged` or `discarded` worktrees. A stale worktree fails merge and must be recreated.

Supported exports are Sheet to CSV/XLSX and Doc to DOCX. DOCX conversion is basic text fidelity. Slide, Base, Board, screenshots, SVG compilation, charts, pivots, and multiplayer collaboration are not available.
