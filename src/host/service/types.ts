import type { WorktreeReviewAction, WorktreeActionResult } from '../../shared/wire/actions.ts'
import type { FileState } from '../../shared/wire/state.ts'
import type { EnsureGatewayResult, GatewayStatus } from '../../shared/wire/status.ts'
import type { UniverFilePath, UnitId, WorkspacePath, WorktreeId } from './identifiers.ts'

/** JSON values accepted across the model tool boundary. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Unit kinds supported by the collaboration Gateway. */
export type UniverUnitKind = 'sheet' | 'doc' | 'slide' | 'base' | 'board'

/** File request tied to one authorized workspace. */
export interface ScopedFileRequest {
  readonly workspace: WorkspacePath
  readonly file: UniverFilePath
}

/** Request for one file's collaboration state. */
export interface FileStateRequest extends ScopedFileRequest {}

/** Request for a model-readable file status projection. */
export interface FileStatusRequest extends ScopedFileRequest {
  readonly worktreeId?: WorktreeId
  readonly unitId?: UnitId
}

/** Browser Viewer request for one local Unit snapshot. */
export interface ViewerUnitRequest extends ScopedFileRequest {
  readonly worktreeId?: WorktreeId
  readonly unitId?: UnitId
}

/** Browser Viewer write, permitted only for a draft worktree. */
export interface SaveViewerUnitRequest extends ScopedFileRequest {
  readonly worktreeId: WorktreeId
  readonly unitId: UnitId
  readonly snapshot: Record<string, JsonValue>
}

/** Request for creating an empty Univer file. */
export interface NewUniverFileRequest extends ScopedFileRequest {}

/** Request for a browser worktree lifecycle decision. */
export interface WorktreeActionRequest extends ScopedFileRequest {
  readonly action: WorktreeReviewAction
  readonly worktreeId: WorktreeId
}

/** Agent-facing worktree lifecycle request. */
export type WorktreeOperationRequest = ScopedFileRequest & (
  | { readonly action: 'create'; readonly name?: string }
  | { readonly action: 'ready' | 'reopen' | 'merge' | 'discard'; readonly worktreeId: WorktreeId }
)

/** Draft-worktree Unit lifecycle request. */
export type UnitOperationRequest = ScopedFileRequest & (
  | {
      readonly action: 'create'
      readonly worktreeId: WorktreeId
      readonly kind: UniverUnitKind
      readonly name: string
    }
  | {
      readonly action: 'remove'
      readonly worktreeId: WorktreeId
      readonly unitId: UnitId
    }
)

/** Request for inspecting one Unit. */
export interface InspectUnitContentRequest extends ScopedFileRequest {
  readonly unitId: UnitId
  readonly range?: string
  readonly worktreeId?: WorktreeId
}

/** Request for executing Univer Facade code. */
export interface ExecuteUnitContentRequest extends ScopedFileRequest {
  readonly code: string
  readonly worktreeId: WorktreeId
  readonly unitId: UnitId
}

/** Request for importing one Office file as a Unit in a draft worktree. */
export interface ImportUnitContentRequest extends ScopedFileRequest {
  readonly source: string
  readonly sourceWorkspace: WorkspacePath
  readonly worktreeId: WorktreeId
  readonly name: string
}

/** Request for exporting one Unit. */
export interface ExportUnitContentRequest extends ScopedFileRequest {
  readonly output: string
  readonly outputWorkspace: WorkspacePath
  readonly unitId: UnitId
  readonly worktreeId?: WorktreeId
}

/** Version-matched Facade reference lookup. */
export type ApiReferenceRequest =
  | {
      readonly action: 'find'
      readonly queries: readonly string[]
      readonly unit?: UniverUnitKind
      readonly limit?: number
    }
  | { readonly action: 'show'; readonly queries: readonly string[] }

/** Structured operation result logged in the DSH session. */
export interface UniverOperationResult {
  readonly ok: true
  readonly operation: 'new' | 'status' | 'inspect' | 'execute' | 'import' | 'export' | 'unit' | 'worktree'
  readonly file: string
  readonly result: JsonValue
}

/** Structured API-reference result logged in the DSH session. */
export interface UniverApiResult {
  readonly ok: true
  readonly operation: 'api'
  readonly result: JsonValue
}

/** Stable methods offered by the Univer service. */
export interface UniverServiceMethods {
  gatewayStatus(): Promise<GatewayStatus>
  ensureGateway(): Promise<EnsureGatewayResult>
  unitContentStatus(): Promise<'bundled' | 'unavailable'>
  fileState(request: FileStateRequest): Promise<FileState>
  worktreeAction(request: WorktreeActionRequest): Promise<WorktreeActionResult>
  newFile(request: NewUniverFileRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  status(request: FileStatusRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  worktree(request: WorktreeOperationRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  unit(request: UnitOperationRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  inspectUnitContent(request: InspectUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  executeUnitContent(request: ExecuteUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  importUnitContent(request: ImportUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  exportUnitContent(request: ExportUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult>
  apiReference(request: ApiReferenceRequest): Promise<UniverApiResult>
  viewerUnit(request: ViewerUnitRequest): Promise<JsonValue>
  saveViewerUnit(request: SaveViewerUnitRequest): Promise<JsonValue>
}
