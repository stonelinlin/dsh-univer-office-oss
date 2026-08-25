# Vendored source provenance

The repository intentionally carries auditable source snapshots instead of Pro binaries.

| Path | Upstream | Commit | License |
| --- | --- | --- | --- |
| `vendor/univer` | `dream-num/univer` | `d9d5391c851562f8170c390d36543cb8fa35155a` | Apache-2.0 |
| `vendor/superdoc-document-api` | `Harbour-Enterprises/SuperDoc/packages/document-api` | `b0ff2221645f79b7094e1c037723fe2a435ffd3c` | AGPL-3.0 |

To update a snapshot, import the exact upstream Git tree, record the new commit here, review license changes, rebuild vendor type declarations, and run the full test suite. Never vendor or inspect `@superdoc/docx-engine`, `@univerjs-pro/*`, `@univer-cli/*`, or native Pro bindings.
