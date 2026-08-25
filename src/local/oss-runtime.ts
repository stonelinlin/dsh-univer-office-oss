import { LocaleType, Univer, UniverInstanceType, awaitTime } from '@univerjs/core'
import { FUniver } from '@univerjs/core/facade'
import { UniverDataValidationPlugin } from '@univerjs/data-validation'
import { UniverDocsPlugin } from '@univerjs/docs'
import '@univerjs/docs/facade'
import { UniverDocsDrawingPlugin } from '@univerjs/docs-drawing'
import { UniverDrawingPlugin } from '@univerjs/drawing'
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula'
import '@univerjs/engine-formula/facade'
import { UniverSheetsPlugin } from '@univerjs/sheets'
import '@univerjs/sheets/facade'
import { UniverSheetsConditionalFormattingPlugin } from '@univerjs/sheets-conditional-formatting'
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation'
import '@univerjs/sheets-data-validation/facade'
import { UniverSheetsDrawingPlugin } from '@univerjs/sheets-drawing'
import { UniverSheetsFilterPlugin } from '@univerjs/sheets-filter'
import '@univerjs/sheets-filter/facade'
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula'
import '@univerjs/sheets-formula/facade'
import { UniverSheetsHyperLinkPlugin } from '@univerjs/sheets-hyper-link'
import '@univerjs/sheets-hyper-link/facade'
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt'
import '@univerjs/sheets-numfmt/facade'
import { UniverSheetsSortPlugin } from '@univerjs/sheets-sort'
import { UniverThreadCommentPlugin } from '@univerjs/thread-comment'
import type { JsonValue } from '../host/service/types.ts'
import { UniverError } from '../host/service/errors.ts'
import type { LocalUnit } from './model.ts'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>

/** Run one Facade program against an isolated OSS Univer instance and return its saved snapshot. */
export async function executeWithOssUniver(
  unit: LocalUnit,
  code: string,
): Promise<{ readonly snapshot: Record<string, JsonValue>; readonly value: JsonValue }> {
  if (unit.kind !== 'sheet' && unit.kind !== 'doc') {
    throw new UniverError(`OSS Facade execution is not available for ${unit.kind} Units.`, 'UNIT_EXECUTION_UNSUPPORTED')
  }
  const univer = createHeadlessUniver()
  try {
    univer.createUnit(instanceType(unit.kind), unit.snapshot)
    const univerAPI = FUniver.newAPI(univer)
    const facadeUnit = unit.kind === 'sheet' ? univerAPI.getActiveWorkbook() : univerAPI.getActiveDocument()
    if (facadeUnit === null) throw new UniverError(`Unit ${unit.id} could not be loaded.`, 'UNIT_LOAD_FAILED')

    let result: unknown
    try {
      const program = new AsyncFunction('univerAPI', 'unit', 'console', `'use strict';\n${code}`)
      result = await program(univerAPI, facadeUnit, console)
      await awaitTime(0)
    } catch (error) {
      throw new UniverError(error instanceof Error ? error.message : String(error), 'FACADE_EXECUTION_FAILED', { cause: error })
    }

    const snapshot = facadeUnit.save() as unknown as Record<string, JsonValue>
    return { snapshot, value: jsonValue(result) }
  } finally {
    univer.dispose()
  }
}

function createHeadlessUniver(): Univer {
  const univer = new Univer({ locale: LocaleType.ZH_CN, locales: {} })
  univer.registerPlugin(UniverFormulaEnginePlugin)
  univer.registerPlugin(UniverThreadCommentPlugin)
  univer.registerPlugin(UniverDrawingPlugin)
  univer.registerPlugin(UniverDocsPlugin)
  univer.registerPlugin(UniverDocsDrawingPlugin)
  univer.registerPlugin(UniverSheetsPlugin)
  univer.registerPlugin(UniverSheetsFormulaPlugin)
  univer.registerPlugin(UniverSheetsConditionalFormattingPlugin)
  univer.registerPlugin(UniverDataValidationPlugin)
  univer.registerPlugin(UniverSheetsDataValidationPlugin)
  univer.registerPlugin(UniverSheetsFilterPlugin)
  univer.registerPlugin(UniverSheetsHyperLinkPlugin)
  univer.registerPlugin(UniverSheetsDrawingPlugin)
  univer.registerPlugin(UniverSheetsSortPlugin)
  univer.registerPlugin(UniverSheetsNumfmtPlugin)
  return univer
}

function instanceType(kind: 'sheet' | 'doc'): number {
  return kind === 'sheet' ? UniverInstanceType.UNIVER_SHEET : UniverInstanceType.UNIVER_DOC
}

function jsonValue(value: unknown): JsonValue {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue
  } catch (error) {
    throw new UniverError('Facade result is not JSON serializable.', 'FACADE_RESULT_NOT_SERIALIZABLE', { cause: error })
  }
}
