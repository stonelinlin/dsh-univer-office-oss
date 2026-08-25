import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createUnit } from '../src/local/model.ts'
import { LocalRevisionStore } from '../src/local/store.ts'
import { exportDocx, exportXlsx, importDocx, importXlsx } from '../src/local/office-adapters.ts'
import { projectDocToSuperDoc } from '../src/local/superdoc-adapter.ts'

test('draft changes stay isolated until an explicitly ready worktree is merged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-univer-oss-'))
  try {
    const file = join(root, 'book.univer')
    const store = new LocalRevisionStore()
    await store.create(file)
    const worktree = await store.createWorktree(file, 'agent edit')
    const sheet = createUnit('sheet', 'Budget')
    await store.mutateWorktree(file, worktree.id, (current) => ({ ...current, units: [...current.units, sheet] }))

    assert.equal((await store.read(file)).units.length, 0)
    assert.equal((await store.readWorktree(file, worktree.id)).units.length, 1)
    await assert.rejects(() => store.transition(file, worktree.id, 'merge'), /Cannot merge a draft worktree/u)

    await store.transition(file, worktree.id, 'ready')
    const merged = await store.transition(file, worktree.id, 'merge')
    assert.equal(merged.status, 'merged')
    assert.equal((await store.read(file)).revision, 1)
    assert.equal((await store.read(file)).units[0]?.name, 'Budget')
    await assert.rejects(() => store.transition(file, worktree.id, 'reopen'), /Cannot reopen a merged worktree/u)

    assert.equal((JSON.parse(await readFile(file, 'utf8')) as { revision: number }).revision, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('stale worktrees fail closed instead of overwriting a newer trunk revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-univer-oss-'))
  try {
    const file = join(root, 'book.univer')
    const store = new LocalRevisionStore()
    await store.create(file)
    const first = await store.createWorktree(file, 'first')
    const stale = await store.createWorktree(file, 'stale')

    await store.mutateWorktree(file, first.id, (current) => ({ ...current, units: [createUnit('sheet', 'First')] }))
    await store.transition(file, first.id, 'ready')
    await store.transition(file, first.id, 'merge')

    await store.mutateWorktree(file, stale.id, (current) => ({ ...current, units: [createUnit('sheet', 'Stale')] }))
    await store.transition(file, stale.id, 'ready')
    await assert.rejects(() => store.transition(file, stale.id, 'merge'), /based on revision 0, but trunk is revision 1/u)
    assert.equal((await store.read(file)).units[0]?.name, 'First')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('discard is terminal and never changes trunk', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-univer-oss-'))
  try {
    const file = join(root, 'book.univer')
    const store = new LocalRevisionStore()
    await store.create(file)
    const worktree = await store.createWorktree(file)
    await store.mutateWorktree(file, worktree.id, (current) => ({ ...current, units: [createUnit('doc', 'Draft')] }))
    const discarded = await store.transition(file, worktree.id, 'discard')
    assert.equal(discarded.status, 'discarded')
    assert.equal((await store.read(file)).units.length, 0)
    await assert.rejects(() => store.mutateWorktree(file, worktree.id, (current) => current), /only draft worktrees are writable/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('open-source XLSX and DOCX adapters round-trip basic content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-univer-oss-'))
  try {
    const sheet = createUnit('sheet', 'Workbook')
    const sheetId = (sheet.snapshot.sheetOrder as string[])[0]!
    const sheets = sheet.snapshot.sheets as Record<string, Record<string, unknown>>
    sheets[sheetId]!.cellData = { 0: { 0: { v: 'Name' }, 1: { v: 42 } } }
    const xlsx = join(root, 'book.xlsx')
    await exportXlsx(sheet, xlsx)
    const importedSheet = await importXlsx(xlsx, 'imported-sheet', 'Imported')
    const importedId = (importedSheet.sheetOrder as string[])[0]!
    const importedSheets = importedSheet.sheets as Record<string, { cellData: Record<string, Record<string, { v: unknown }>> }>
    assert.equal(importedSheets[importedId]!.cellData['0']!['0']!.v, 'Name')
    assert.equal(importedSheets[importedId]!.cellData['0']!['1']!.v, 42)

    const doc = createUnit('doc', 'Document')
    doc.snapshot.body = {
      dataStream: 'Hello\rOpen source\r\n',
      textRuns: [],
      paragraphs: [{ startIndex: 5 }, { startIndex: 17 }],
      sectionBreaks: [{ startIndex: 18 }],
    }
    const docx = join(root, 'document.docx')
    await exportDocx(doc, docx)
    const importedDoc = await importDocx(docx, 'imported-doc', 'Imported Doc')
    const body = importedDoc.body as { dataStream: string }
    assert.match(body.dataStream, /Hello/u)
    assert.match(body.dataStream, /Open source/u)
    const projection = projectDocToSuperDoc(importedDoc)
    assert.equal(projection.modelVersion, 'sdm/1')
    assert.equal(projection.body[0]?.kind, 'paragraph')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
