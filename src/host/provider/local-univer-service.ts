import { extname } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { WorktreeActionResult } from '../../shared/wire/actions.ts'
import type { ChangedUnit, FileState, WorktreeState } from '../../shared/wire/state.ts'
import type { EnsureGatewayResult, GatewayStatus } from '../../shared/wire/status.ts'
import { createUnit, type LocalUnit, type LocalWorktree } from '../../local/model.ts'
import { executeWithOssUniver } from '../../local/oss-runtime.ts'
import { exportDocx, exportXlsx, importDocx, importXlsx } from '../../local/office-adapters.ts'
import { LocalRevisionStore } from '../../local/store.ts'
import { projectDocToSuperDoc } from '../../local/superdoc-adapter.ts'
import { UniverError } from '../service/errors.ts'
import type {
  ApiReferenceRequest,
  ExecuteUnitContentRequest,
  ExportUnitContentRequest,
  FileStateRequest,
  FileStatusRequest,
  ImportUnitContentRequest,
  InspectUnitContentRequest,
  JsonValue,
  NewUniverFileRequest,
  SaveViewerUnitRequest,
  UnitOperationRequest,
  UniverApiResult,
  UniverOperationResult,
  WorktreeActionRequest,
  WorktreeOperationRequest,
  ViewerUnitRequest,
} from '../service/types.ts'
import { UniverService } from '../service/univer-service.ts'
import { assertAuthorizedPath } from '../service/workspace.ts'

/** Fully local service provider backed by JSON snapshots and OSS Univer Facades. */
export class LocalUniverService extends UniverService {
  readonly store = new LocalRevisionStore()

  constructor(ctx: Context) {
    super(ctx)
  }

  gatewayStatus(): Promise<GatewayStatus> {
    return Promise.resolve({ phase: 'running', gateway: '/univer-api', owned: true })
  }

  ensureGateway(): Promise<EnsureGatewayResult> {
    return Promise.resolve({ ok: true, gateway: '/univer-api', reused: true })
  }

  unitContentStatus(): Promise<'bundled'> {
    return Promise.resolve('bundled')
  }

  async fileState(request: FileStateRequest): Promise<FileState> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    const worktrees = await this.store.listWorktrees(request.file)
    return {
      ok: true,
      file: request.file,
      gateway: '/univer-api',
      gatewayRunning: true,
      viewerUrl: viewerUrl(request.file),
      worktrees: worktrees.map((worktree) => worktreeState(request.file, worktree)),
    }
  }

  async worktreeAction(request: WorktreeActionRequest): Promise<WorktreeActionResult> {
    try {
      await this.store.transition(request.file, request.worktreeId, request.action)
      return {
        ok: true,
        action: request.action,
        worktreeId: request.worktreeId,
        state: await this.fileState(request),
      }
    } catch (error) {
      const state = await this.fileState(request).catch(() => undefined)
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        ...(state === undefined ? {} : { state }),
      }
    }
  }

  async newFile(request: NewUniverFileRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, false)
    signal?.throwIfAborted()
    await this.store.create(request.file)
    return operation('new', request.file, { created: true, filePath: request.file })
  }

  async status(request: FileStatusRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    signal?.throwIfAborted()
    const [trunk, worktrees] = await Promise.all([this.store.read(request.file), this.store.listWorktrees(request.file)])
    const selected = request.worktreeId === undefined
      ? undefined
      : worktrees.find((worktree) => worktree.id === request.worktreeId)
    if (request.worktreeId !== undefined && selected === undefined) {
      throw new UniverError(`Worktree ${request.worktreeId} was not found.`, 'WORKTREE_NOT_FOUND')
    }
    const unitFilter = (unit: LocalUnit) => request.unitId === undefined || unit.id === request.unitId
    return operation('status', request.file, {
      trunk: { revision: trunk.revision, units: trunk.units.filter(unitFilter).map(unitResult) },
      worktrees: worktrees.map(worktreeResult),
      ...(selected === undefined ? {} : {
        selectedWorktree: { ...worktreeResult(selected), units: selected.units.filter(unitFilter).map(unitResult) },
      }),
    })
  }

  async worktree(request: WorktreeOperationRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    signal?.throwIfAborted()
    const result = request.action === 'create'
      ? await this.store.createWorktree(request.file, request.name)
      : await this.store.transition(request.file, request.worktreeId, request.action)
    return operation('worktree', request.file, { action: request.action, ...worktreeResult(result) })
  }

  async unit(request: UnitOperationRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    signal?.throwIfAborted()
    let changed: LocalUnit | undefined
    const worktree = await this.store.mutateWorktree(request.file, request.worktreeId, (current) => {
      if (request.action === 'create') {
        changed = createUnit(request.kind, request.name)
        return { ...current, units: [...current.units, changed] }
      }
      const index = current.units.findIndex((unit) => unit.id === request.unitId)
      if (index < 0) throw new UniverError(`Unit ${request.unitId} was not found.`, 'UNIT_NOT_FOUND')
      changed = current.units[index]
      return { ...current, units: current.units.filter((unit) => unit.id !== request.unitId) }
    })
    return operation('unit', request.file, {
      action: request.action,
      worktreeId: worktree.id,
      ...(changed === undefined ? {} : unitResult(changed)),
    })
  }

  async inspectUnitContent(request: InspectUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    signal?.throwIfAborted()
    const unit = await this.loadUnit(request.file, request.unitId, request.worktreeId)
    return operation('inspect', request.file, inspectUnit(unit, request.range))
  }

  async executeUnitContent(request: ExecuteUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    signal?.throwIfAborted()
    const unit = await this.loadUnit(request.file, request.unitId, request.worktreeId)
    const executed = await executeWithOssUniver(unit, request.code)
    signal?.throwIfAborted()
    await this.store.replaceUnit(request.file, request.worktreeId, { ...unit, snapshot: executed.snapshot })
    return operation('execute', request.file, {
      committed: true,
      unitId: unit.id,
      worktreeId: request.worktreeId,
      value: executed.value,
    })
  }

  async importUnitContent(request: ImportUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await Promise.all([
      assertAuthorizedPath(request.workspace, request.file, true),
      assertAuthorizedPath(request.sourceWorkspace, request.source, true),
    ])
    signal?.throwIfAborted()
    const extension = extname(request.source).toLowerCase()
    const unit = createUnit(extension === '.docx' ? 'doc' : 'sheet', request.name)
    const snapshot = extension === '.csv'
      ? importCsv(unit.snapshot, await readFile(request.source, 'utf8'))
      : extension === '.xlsx'
        ? await importXlsx(request.source, unit.id, request.name)
        : extension === '.docx'
          ? await importDocx(request.source, unit.id, request.name)
          : undefined
    if (snapshot === undefined) {
      throw new UniverError('Supported import formats are CSV, XLSX and DOCX.', 'IMPORT_FORMAT_UNSUPPORTED')
    }
    const imported = { ...unit, snapshot }
    await this.store.mutateWorktree(request.file, request.worktreeId, (worktree) => ({
      ...worktree,
      units: [...worktree.units, imported],
    }))
    return operation('import', request.file, { sourcePath: request.source, worktreeId: request.worktreeId, ...unitResult(imported) })
  }

  async exportUnitContent(request: ExportUnitContentRequest, signal?: AbortSignal): Promise<UniverOperationResult> {
    await Promise.all([
      assertAuthorizedPath(request.workspace, request.file, true),
      assertAuthorizedPath(request.outputWorkspace, request.output, false),
    ])
    signal?.throwIfAborted()
    const unit = await this.loadUnit(request.file, request.unitId, request.worktreeId)
    const extension = extname(request.output).toLowerCase()
    if (unit.kind === 'sheet' && extension === '.csv') {
      await writeFile(request.output, exportCsv(unit), 'utf8')
    } else if (unit.kind === 'sheet' && extension === '.xlsx') {
      await exportXlsx(unit, request.output)
    } else if (unit.kind === 'doc' && extension === '.docx') {
      await exportDocx(unit, request.output)
    } else {
      throw new UniverError('Supported exports are Sheet to CSV/XLSX and Doc to DOCX.', 'EXPORT_FORMAT_UNSUPPORTED')
    }
    return operation('export', request.file, {
      unitId: unit.id,
      kind: unit.kind,
      outputPath: request.output,
      scope: request.worktreeId === undefined ? 'trunk' : 'worktree',
    })
  }

  apiReference(request: ApiReferenceRequest): Promise<UniverApiResult> {
    const entries = [
      { unit: 'sheet', symbol: 'univerAPI.getActiveWorkbook()' },
      { unit: 'sheet', symbol: 'workbook.getActiveSheet().getRange("A1:B2")' },
      { unit: 'sheet', symbol: 'range.setValues([[1, 2], [3, 4]])' },
      { unit: 'doc', symbol: 'univerAPI.getActiveDocument()' },
      { unit: 'doc', symbol: 'document.getBody()' },
    ]
    const queries = request.queries.map((query) => query.toLowerCase())
    const result = entries.filter((entry) => queries.length === 0 || queries.some((query) => entry.symbol.toLowerCase().includes(query)))
    return Promise.resolve({ ok: true, operation: 'api', result })
  }

  async viewerUnit(request: ViewerUnitRequest): Promise<JsonValue> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    const units = request.worktreeId === undefined
      ? (await this.store.read(request.file)).units
      : (await this.store.readWorktree(request.file, request.worktreeId)).units
    const unit = request.unitId === undefined ? units[0] : units.find((candidate) => candidate.id === request.unitId)
    if (unit === undefined) throw new UniverError('No matching Unit was found.', 'UNIT_NOT_FOUND')
    const worktree = request.worktreeId === undefined ? undefined : await this.store.readWorktree(request.file, request.worktreeId)
    return {
      ...unitResult(unit),
      snapshot: unit.snapshot,
      editable: worktree?.status === 'draft',
      ...(worktree === undefined ? {} : { worktreeId: worktree.id, worktreeStatus: worktree.status }),
    }
  }

  async saveViewerUnit(request: SaveViewerUnitRequest): Promise<JsonValue> {
    await assertAuthorizedPath(request.workspace, request.file, true)
    const unit = await this.loadUnit(request.file, request.unitId, request.worktreeId)
    await this.store.replaceUnit(request.file, request.worktreeId, { ...unit, snapshot: structuredClone(request.snapshot) })
    return { saved: true, unitId: unit.id, worktreeId: request.worktreeId }
  }

  private async loadUnit(file: string, unitId: string, worktreeId?: string): Promise<LocalUnit> {
    const units = worktreeId === undefined
      ? (await this.store.read(file)).units
      : (await this.store.readWorktree(file, worktreeId)).units
    const unit = units.find((candidate) => candidate.id === unitId)
    if (unit === undefined) throw new UniverError(`Unit ${unitId} was not found.`, 'UNIT_NOT_FOUND')
    return structuredClone(unit)
  }
}

function operation(
  kind: UniverOperationResult['operation'],
  file: string,
  result: JsonValue,
): UniverOperationResult {
  return { ok: true, operation: kind, file, result }
}

function unitResult(unit: LocalUnit): { unitId: string; name: string; kind: LocalUnit['kind']; type: string } {
  return { unitId: unit.id, name: unit.name, kind: unit.kind, type: unit.kind }
}

function worktreeResult(worktree: LocalWorktree): Record<string, JsonValue> {
  return {
    worktreeId: worktree.id,
    name: worktree.name,
    status: worktree.status,
    baseRevision: worktree.baseRevision,
  }
}

function worktreeState(file: string, worktree: LocalWorktree): WorktreeState {
  const baseline = new Map(worktree.baseline.map((unit) => [unit.id, unit]))
  const current = new Map(worktree.units.map((unit) => [unit.id, unit]))
  const ids = new Set([...baseline.keys(), ...current.keys()])
  const units: ChangedUnit[] = []
  for (const id of ids) {
    const before = baseline.get(id)
    const after = current.get(id)
    if (before !== undefined && after !== undefined && JSON.stringify(before) === JSON.stringify(after)) continue
    const value = after ?? before
    if (value === undefined) continue
    units.push({
      unitId: id,
      name: value.name,
      type: value.kind,
      kind: before === undefined ? 'added' : after === undefined ? 'deleted' : 'modified',
      worktreeUrl: viewerUrl(file, worktree.id, id),
      mergeUrl: viewerUrl(file, worktree.id, id),
    })
  }
  return {
    worktreeId: worktree.id,
    name: worktree.name,
    status: worktree.status,
    units,
    openUrl: viewerUrl(file, worktree.id),
    worktreeUrl: viewerUrl(file, worktree.id),
    mergeUrl: viewerUrl(file, worktree.id),
  }
}

function viewerUrl(file: string, worktreeId?: string, unitId?: string): string {
  const query = new URLSearchParams({ file })
  if (worktreeId !== undefined) query.set('worktreeId', worktreeId)
  if (unitId !== undefined) query.set('unit', unitId)
  return `/univer-api/viewer?${query.toString()}`
}

function inspectUnit(unit: LocalUnit, range?: string): JsonValue {
  if (unit.kind === 'doc') {
    return { ...unitResult(unit), snapshot: unit.snapshot, superdoc: projectDocToSuperDoc(unit.snapshot) as unknown as JsonValue }
  }
  if (unit.kind !== 'sheet') return { ...unitResult(unit), snapshot: unit.snapshot }
  const sheet = activeSheet(unit)
  const bounds = parseRange(range ?? usedRange(sheet))
  const values: JsonValue[][] = []
  for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
    const output: JsonValue[] = []
    for (let column = bounds.startColumn; column <= bounds.endColumn; column += 1) {
      const cell = cellAt(sheet, row, column)
      output.push(cell?.v ?? cell?.f ?? null)
    }
    values.push(output)
  }
  return { ...unitResult(unit), range: range ?? usedRange(sheet), values }
}

function activeSheet(unit: LocalUnit): Record<string, JsonValue> {
  const order = unit.snapshot.sheetOrder
  const sheets = unit.snapshot.sheets
  if (!Array.isArray(order) || typeof order[0] !== 'string' || !isRecord(sheets) || !isRecord(sheets[order[0]])) {
    throw new UniverError(`Sheet Unit ${unit.id} has an invalid snapshot.`, 'INVALID_SHEET_SNAPSHOT')
  }
  const sheet = sheets[order[0]]
  if (!isRecord(sheet)) throw new UniverError(`Sheet Unit ${unit.id} has an invalid snapshot.`, 'INVALID_SHEET_SNAPSHOT')
  return sheet
}

function cellAt(sheet: Record<string, JsonValue>, row: number, column: number): Record<string, JsonValue> | undefined {
  const cellData = sheet.cellData
  if (!isRecord(cellData)) return undefined
  const rowData = cellData[String(row)]
  if (!isRecord(rowData)) return undefined
  const cell = rowData[String(column)]
  return isRecord(cell) ? cell : undefined
}

function usedRange(sheet: Record<string, JsonValue>): string {
  let maxRow = 0
  let maxColumn = 0
  if (isRecord(sheet.cellData)) {
    for (const [row, columns] of Object.entries(sheet.cellData)) {
      if (!isRecord(columns)) continue
      maxRow = Math.max(maxRow, Number(row))
      for (const column of Object.keys(columns)) maxColumn = Math.max(maxColumn, Number(column))
    }
  }
  return `A1:${columnName(maxColumn)}${maxRow + 1}`
}

function parseRange(value: string): { startRow: number; startColumn: number; endRow: number; endColumn: number } {
  const match = /^([A-Z]+)([1-9]\d*)(?::([A-Z]+)([1-9]\d*))?$/iu.exec(value.trim())
  if (match === null) throw new UniverError(`Invalid A1 range: ${value}`, 'INVALID_RANGE')
  const startColumn = columnIndex(match[1]!)
  const startRow = Number(match[2]) - 1
  const endColumn = columnIndex(match[3] ?? match[1]!)
  const endRow = Number(match[4] ?? match[2]) - 1
  if (endRow < startRow || endColumn < startColumn) throw new UniverError(`Invalid A1 range: ${value}`, 'INVALID_RANGE')
  if ((endRow - startRow + 1) * (endColumn - startColumn + 1) > 100_000) {
    throw new UniverError('Inspection range is too large.', 'RANGE_TOO_LARGE')
  }
  return { startRow, startColumn, endRow, endColumn }
}

function columnIndex(value: string): number {
  let result = 0
  for (const character of value.toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64
  return result - 1
}

function columnName(index: number): string {
  let value = index + 1
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

function importCsv(snapshot: Record<string, JsonValue>, value: string): Record<string, JsonValue> {
  const rows = parseCsv(value)
  const clone = structuredClone(snapshot)
  const order = clone.sheetOrder
  const sheets = clone.sheets
  if (!Array.isArray(order) || typeof order[0] !== 'string' || !isRecord(sheets) || !isRecord(sheets[order[0]])) return clone
  const cellData: Record<string, JsonValue> = {}
  rows.forEach((row, rowIndex) => {
    const columns: Record<string, JsonValue> = {}
    row.forEach((cell, columnIndex) => { columns[String(columnIndex)] = { v: cell } })
    cellData[String(rowIndex)] = columns
  })
  const sheet = sheets[order[0]]
  if (!isRecord(sheet)) return clone
  sheet.cellData = cellData
  return clone
}

function exportCsv(unit: LocalUnit): string {
  const sheet = activeSheet(unit)
  const bounds = parseRange(usedRange(sheet))
  const rows: string[] = []
  for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
    const cells: string[] = []
    for (let column = bounds.startColumn; column <= bounds.endColumn; column += 1) {
      const cell = cellAt(sheet, row, column)
      cells.push(csvCell(String(cell?.v ?? cell?.f ?? '')))
    }
    rows.push(cells.join(','))
  }
  return `${rows.join('\n')}\n`
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        cell += '"'
        index += 1
      } else quoted = !quoted
      continue
    }
    if (!quoted && character === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && value[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += character
  }
  if (quoted) throw new UniverError('CSV contains an unterminated quoted field.', 'INVALID_CSV')
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function csvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
