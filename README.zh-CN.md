# DSH × Univer Office OSS

这是一个完全本地运行、从仓库内开源源码构建的 DSH Office 插件。它保留原项目的结构化工具与审阅流程，并用本地 revision store、OSS Univer 和开源 Office 转换器替代商业 Collaboration Gateway、Worktree 服务、Exchange binding、CLI runtime 与 Viewer。

## 当前已实现

- 原子写入的开放 `.univer` JSON 容器。
- `draft → ready → merge/discard` 隔离 worktree；`merged` 与 `discarded` 是不可复用终态。
- 七个核心工具：`univer_new`、`univer_status`、`univer_worktree`、`univer_unit`、`univer_inspect`、`univer_execute`、`univer_export`。
- `univer_import` 支持 CSV、XLSX、DOCX。
- Sheet/Doc 使用 OSS Univer Facade 和 JavaScript 公式引擎执行。
- 本地 Sheet/Doc Viewer；draft 自动保存，所有文件访问都绑定 DSH session workspace。
- ExcelJS 提供 CSV/XLSX 基础转换；Mammoth + docx 提供 DOCX 基础文本转换。
- 融合 SuperDoc 中与引擎无关的 `@superdoc/document-api` 源码与契约；Doc 检查结果会给出基础 SDM/1 结构投影。

## 明确限制

- DOCX 目前是基础文本保真，不使用、不读取、也不仿制 SuperDoc 专有的 `@superdoc/docx-engine`。
- Slide、Base、Board 目前只能创建快照和查看结构，尚无 Facade 编辑和 Office 导出。
- 暂无多人实时 OT/CRDT、截图渲染、图表、透视表、迷你图和 Pro 素材库。
- trunk revision 变化后，旧 worktree 合并会直接报冲突，不做隐式 rebase。
- 本项目 `.univer` 是开放 JSON 格式，不兼容上游 Pro Gateway 的专有数据库格式。

## 开发

要求 Node.js 22.19+ 与 pnpm 11.20。

```bash
pnpm install
pnpm run typecheck
pnpm test
```

Univer 1.0.0-beta.2 源码位于 `vendor/univer`；SuperDoc 的引擎无关 Document API 位于 `vendor/superdoc-document-api`。`lib/` 与 `artifacts/` 都是构建产物，不提交。

## 许可证

由于融合了 SuperDoc AGPL 源码，组合仓库整体使用 AGPL-3.0-only。Vendored Univer 保持 Apache-2.0，其他依赖保持各自许可证。详见 `THIRD_PARTY_LICENSES.md` 与 vendored 项目内的许可证文件。
