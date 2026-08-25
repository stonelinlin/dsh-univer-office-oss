import { readFile, writeFile } from 'node:fs/promises'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import ExcelJS from 'exceljs'
import mammoth from 'mammoth'
import type { JsonValue } from '../host/service/types.ts'
import { UniverError } from '../host/service/errors.ts'
import type { LocalUnit } from './model.ts'

/** Import an XLSX workbook without proprietary exchange bindings. */
export async function importXlsx(path: string, id: string, name: string): Promise<Record<string, JsonValue>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheets: Record<string, JsonValue> = {}
  const sheetOrder: string[] = []
  for (const source of workbook.worksheets) {
    const sheetId = crypto.randomUUID()
    sheetOrder.push(sheetId)
    const cellData: Record<string, JsonValue> = {}
    source.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const columns: Record<string, JsonValue> = {}
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        columns[String(columnNumber - 1)] = excelCell(cell)
      })
      cellData[String(rowNumber - 1)] = columns
    })
    sheets[sheetId] = {
      id: sheetId,
      name: source.name,
      rowCount: Math.max(source.rowCount, 1000),
      columnCount: Math.max(source.columnCount, 26),
      cellData,
    }
  }
  if (sheetOrder.length === 0) {
    const sheetId = crypto.randomUUID()
    sheetOrder.push(sheetId)
    sheets[sheetId] = { id: sheetId, name: 'Sheet1', rowCount: 1000, columnCount: 26, cellData: {} }
  }
  return { id, name, appVersion: '1.0.0', locale: 'zhCN', styles: {}, sheetOrder, sheets }
}

/** Export one Sheet Unit as XLSX using ExcelJS. */
export async function exportXlsx(unit: LocalUnit, path: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const order = stringArray(unit.snapshot.sheetOrder)
  const sheets = record(unit.snapshot.sheets, 'Invalid workbook sheets')
  for (const sheetId of order) {
    const source = record(sheets[sheetId], `Invalid sheet ${sheetId}`)
    const target = workbook.addWorksheet(typeof source.name === 'string' ? source.name : 'Sheet')
    const cellData = recordOrEmpty(source.cellData)
    for (const [rowIndex, rowValue] of Object.entries(cellData)) {
      const columns = recordOrEmpty(rowValue)
      for (const [columnIndex, cellValue] of Object.entries(columns)) {
        const cell = recordOrEmpty(cellValue)
        const targetCell = target.getCell(Number(rowIndex) + 1, Number(columnIndex) + 1)
        if (typeof cell.f === 'string') {
          const result = excelPrimitive(cell.v)
          const formula: ExcelJS.CellFormulaValue = {
            formula: cell.f.replace(/^=/u, ''),
            ...(result === undefined ? {} : { result }),
          }
          targetCell.value = formula
        } else {
          targetCell.value = excelPrimitive(cell.v)
        }
      }
    }
  }
  await workbook.xlsx.writeFile(path)
}

/** Import DOCX text into an OSS Univer Doc snapshot. Rich OOXML fidelity is intentionally not claimed. */
export async function importDocx(path: string, id: string, name: string): Promise<Record<string, JsonValue>> {
  const result = await mammoth.extractRawText({ buffer: await readFile(path) })
  return documentSnapshot(id, name, result.value)
}

/** Export an OSS Univer Doc snapshot to a standards-based DOCX file. */
export async function exportDocx(unit: LocalUnit, path: string): Promise<void> {
  const body = record(unit.snapshot.body, 'Invalid document body')
  const dataStream = typeof body.dataStream === 'string' ? body.dataStream : ''
  const lines = dataStream.replace(/\r?\n$/u, '').split(/\r\n|\r|\n/u)
  const document = new Document({
    sections: [{
      children: lines.map((line) => new Paragraph({ children: [new TextRun(line)] })),
    }],
  })
  await writeFile(path, await Packer.toBuffer(document))
}

function documentSnapshot(id: string, name: string, text: string): Record<string, JsonValue> {
  const lines = text.replace(/\r\n/gu, '\n').split('\n')
  while (lines.at(-1) === '') lines.pop()
  if (lines.length === 0) lines.push('')
  const paragraphs: JsonValue[] = []
  let offset = 0
  for (const line of lines) {
    offset += line.length
    paragraphs.push({ startIndex: offset })
    offset += 1
  }
  const dataStream = `${lines.join('\r')}\r\n`
  return {
    id,
    title: name,
    body: { dataStream, textRuns: [], paragraphs, sectionBreaks: [{ startIndex: dataStream.length - 1 }] },
    documentStyle: {
      pageSize: { width: 595, height: 842 },
      marginTop: 72,
      marginBottom: 72,
      marginLeft: 72,
      marginRight: 72,
    },
  }
}

function excelCell(cell: ExcelJS.Cell): Record<string, JsonValue> {
  const value = cell.value
  if (value === null) return { v: null }
  if (value instanceof Date) return { v: value.toISOString() }
  if (typeof value === 'object') {
    if ('formula' in value) {
      return { f: `=${String(value.formula)}`, v: jsonPrimitive(value.result) }
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return { v: value.richText.map((part) => part.text).join('') }
    }
    if ('text' in value) return { v: String(value.text) }
    return { v: String(value) }
  }
  return { v: jsonPrimitive(value) }
}

function excelPrimitive(value: unknown): string | number | boolean | Date | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value
  if (value === null || value === undefined) return undefined
  return String(value)
}

function jsonPrimitive(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (value === undefined) return null
  return String(value)
}

function record(value: JsonValue | undefined, message: string): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new UniverError(message, 'INVALID_UNIT_SNAPSHOT')
  return value
}

function recordOrEmpty(value: JsonValue | undefined): Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
}

function stringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new UniverError('Invalid workbook sheet order.', 'INVALID_UNIT_SNAPSHOT')
  }
  return value
}
