import { randomUUID } from 'node:crypto'
import type { JsonValue, UniverUnitKind } from '../host/service/types.ts'

export const LOCAL_FILE_FORMAT = 'dsh-univer-office-oss' as const
export const LOCAL_FILE_VERSION = 1 as const

export interface LocalUnit {
  readonly id: string
  readonly kind: UniverUnitKind
  readonly name: string
  readonly snapshot: Record<string, JsonValue>
}

export interface LocalUniverFile {
  readonly format: typeof LOCAL_FILE_FORMAT
  readonly version: typeof LOCAL_FILE_VERSION
  readonly revision: number
  readonly units: readonly LocalUnit[]
}

export interface LocalWorktree {
  readonly id: string
  readonly name: string
  readonly status: 'draft' | 'ready' | 'merged' | 'discarded'
  readonly baseRevision: number
  readonly baseline: readonly LocalUnit[]
  readonly units: readonly LocalUnit[]
  readonly createdAt: string
  readonly updatedAt: string
}

export function emptyFile(): LocalUniverFile {
  return {
    format: LOCAL_FILE_FORMAT,
    version: LOCAL_FILE_VERSION,
    revision: 0,
    units: [],
  }
}

export function createWorktree(file: LocalUniverFile, name?: string): LocalWorktree {
  const id = randomUUID()
  const now = new Date().toISOString()
  return {
    id,
    name: name?.trim() || `draft-${id.slice(0, 8)}`,
    status: 'draft',
    baseRevision: file.revision,
    baseline: structuredClone(file.units),
    units: structuredClone(file.units),
    createdAt: now,
    updatedAt: now,
  }
}

export function createUnit(kind: UniverUnitKind, name: string): LocalUnit {
  const id = randomUUID()
  switch (kind) {
    case 'sheet':
      return { id, kind, name, snapshot: emptyWorkbook(id, name) }
    case 'doc':
      return { id, kind, name, snapshot: emptyDocument(id, name) }
    case 'slide':
      return { id, kind, name, snapshot: emptySlide(id, name) }
    case 'base':
      return { id, kind, name, snapshot: { id, name, tables: [] } }
    case 'board':
      return { id, kind, name, snapshot: { id, name, elements: [] } }
  }
}

function emptyWorkbook(id: string, name: string): Record<string, JsonValue> {
  const sheetId = randomUUID()
  return {
    id,
    name,
    appVersion: '1.0.0',
    locale: 'zhCN',
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: 'Sheet1',
        rowCount: 1000,
        columnCount: 26,
        cellData: {},
      },
    },
  }
}

function emptyDocument(id: string, name: string): Record<string, JsonValue> {
  return {
    id,
    title: name,
    body: {
      dataStream: '\r\n',
      textRuns: [],
      paragraphs: [{ startIndex: 0 }],
      sectionBreaks: [{ startIndex: 1 }],
    },
    documentStyle: {
      pageSize: { width: 595, height: 842 },
      marginTop: 72,
      marginBottom: 72,
      marginLeft: 72,
      marginRight: 72,
    },
  }
}

function emptySlide(id: string, name: string): Record<string, JsonValue> {
  const pageId = randomUUID()
  return {
    id,
    name,
    pageSize: { width: 960, height: 540 },
    pageOrder: [pageId],
    pages: {
      [pageId]: { id: pageId, name: 'Slide 1', elements: {}, order: [] },
    },
  }
}
