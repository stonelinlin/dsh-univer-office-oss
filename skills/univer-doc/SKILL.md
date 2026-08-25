---
name: univer-doc
description: Edit and verify Doc Units using OSS Univer and the engine-independent SuperDoc Document API contract.
---

# Doc Units

Use `univer_execute` code with the injected `univerAPI` and `unit` (the active document). Save and inspect the resulting Univer Doc snapshot before handoff.

DOCX import uses Mammoth text extraction and export uses the open-source `docx` generator. This path does not use SuperDoc's proprietary DOCX engine and does not promise layout, tracked-change, comment, field, or drawing fidelity.
