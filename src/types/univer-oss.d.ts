/**
 * Narrow application-facing declarations for the vendored Univer OSS runtime.
 * Runtime code is always bundled from vendor/univer; this file prevents the
 * application typecheck from compiling the entire upstream monorepo.
 */
export const LocaleType: { readonly ZH_CN: string }
export const UniverInstanceType: {
  readonly UNIVER_SHEET: number
  readonly UNIVER_DOC: number
}
export function awaitTime(milliseconds: number): Promise<void>

export class Univer {
  constructor(options: { locale: string; locales: Record<string, unknown> })
  registerPlugin(plugin: unknown): void
  createUnit(type: number, snapshot: Record<string, unknown>): unknown
  dispose(): void
}

export const FUniver: {
  newAPI(univer: Univer): {
    getActiveWorkbook(): { save(): Record<string, unknown> } | null
    getActiveDocument(): { save(): Record<string, unknown> } | null
  }
}

export const UniverDataValidationPlugin: unknown
export const UniverDocsPlugin: unknown
export const UniverDocsDrawingPlugin: unknown
export const UniverDrawingPlugin: unknown
export const UniverFormulaEnginePlugin: unknown
export const UniverSheetsPlugin: unknown
export const UniverSheetsConditionalFormattingPlugin: unknown
export const UniverSheetsDataValidationPlugin: unknown
export const UniverSheetsDrawingPlugin: unknown
export const UniverSheetsFilterPlugin: unknown
export const UniverSheetsFormulaPlugin: unknown
export const UniverSheetsHyperLinkPlugin: unknown
export const UniverSheetsNumfmtPlugin: unknown
export const UniverSheetsSortPlugin: unknown
export const UniverThreadCommentPlugin: unknown
