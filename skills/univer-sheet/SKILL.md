---
name: univer-sheet
description: Edit and verify Sheet Units using the OSS Univer Facade.
---

# Sheet Units

Use `univer_execute` code with the injected `univerAPI` and `unit` (the active workbook). Typical access is `unit.getActiveSheet().getRange("A1:B2")`. Await asynchronous setters. Inspect the narrowest A1 range after each write. Formula strings begin with `=` and use the OSS JavaScript formula engine.

CSV and XLSX import/export are supported. Charts, pivots, sparklines, protected ranges, and Excel-perfect formatting round trips are not claimed.
