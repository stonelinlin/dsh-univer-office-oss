import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { UniverError } from '../host/service/errors.ts'
import type { JsonValue } from '../host/service/types.ts'
import {
  LOCAL_FILE_FORMAT,
  LOCAL_FILE_VERSION,
  createWorktree,
  emptyFile,
  type LocalUnit,
  type LocalUniverFile,
  type LocalWorktree,
} from './model.ts'

const locks = new Map<string, Promise<void>>()

/** File-backed revision store. All writes are atomic and serialized per `.univer` file. */
export class LocalRevisionStore {
  async create(file: string): Promise<LocalUniverFile> {
    return this.lock(file, async () => {
      await mkdir(dirname(file), { recursive: true })
      const handle = await open(file, 'wx')
      const value = emptyFile()
      try {
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
      } finally {
        await handle.close()
      }
      return value
    })
  }

  async read(file: string): Promise<LocalUniverFile> {
    return parseFile(JSON.parse(await readFile(file, 'utf8')) as unknown)
  }

  async listWorktrees(file: string): Promise<readonly LocalWorktree[]> {
    const directory = worktreeDirectory(file)
    let entries: string[]
    try {
      entries = await readdir(directory)
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return []
      throw error
    }
    const worktrees = await Promise.all(entries
      .filter((entry) => entry.endsWith('.json'))
      .map(async (entry) => this.readWorktree(file, entry.slice(0, -5))))
    return worktrees.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async readWorktree(file: string, id: string): Promise<LocalWorktree> {
    try {
      return parseWorktree(JSON.parse(await readFile(worktreePath(file, id), 'utf8')) as unknown)
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        throw new UniverError(`Worktree ${id} was not found.`, 'WORKTREE_NOT_FOUND')
      }
      throw error
    }
  }

  async createWorktree(file: string, name?: string): Promise<LocalWorktree> {
    return this.lock(file, async () => {
      const worktree = createWorktree(await this.read(file), name)
      await mkdir(worktreeDirectory(file), { recursive: true })
      await this.writeJson(worktreePath(file, worktree.id), worktree)
      return worktree
    })
  }

  async mutateWorktree(
    file: string,
    id: string,
    mutate: (worktree: LocalWorktree) => LocalWorktree | Promise<LocalWorktree>,
  ): Promise<LocalWorktree> {
    return this.lock(file, async () => {
      const current = await this.readWorktree(file, id)
      if (current.status !== 'draft') {
        throw new UniverError(`Worktree ${id} is ${current.status}; only draft worktrees are writable.`, 'WORKTREE_NOT_DRAFT')
      }
      const next = await mutate(structuredClone(current))
      const persisted = { ...next, updatedAt: new Date().toISOString() }
      await this.writeJson(worktreePath(file, id), persisted)
      return persisted
    })
  }

  async transition(file: string, id: string, action: 'ready' | 'reopen' | 'merge' | 'discard'): Promise<LocalWorktree> {
    return this.lock(file, async () => {
      const current = await this.readWorktree(file, id)
      const now = new Date().toISOString()
      if (action === 'ready') {
        requireStatus(current, 'draft', action)
        return this.persistWorktree(file, { ...current, status: 'ready', updatedAt: now })
      }
      if (action === 'reopen') {
        requireStatus(current, 'ready', action)
        return this.persistWorktree(file, { ...current, status: 'draft', updatedAt: now })
      }
      if (action === 'discard') {
        if (current.status !== 'draft' && current.status !== 'ready') invalidTransition(current, action)
        return this.persistWorktree(file, { ...current, status: 'discarded', updatedAt: now })
      }

      if (current.status !== 'ready') invalidTransition(current, action)
      const trunk = await this.read(file)
      if (trunk.revision !== current.baseRevision) {
        throw new UniverError(
          `Worktree ${id} is based on revision ${current.baseRevision}, but trunk is revision ${trunk.revision}. Recreate the worktree before merging.`,
          'WORKTREE_CONFLICT',
        )
      }
      await this.writeJson(file, { ...trunk, revision: trunk.revision + 1, units: current.units })
      return this.persistWorktree(file, { ...current, status: 'merged', updatedAt: now })
    })
  }

  async replaceUnit(file: string, worktreeId: string, unit: LocalUnit): Promise<LocalWorktree> {
    return this.mutateWorktree(file, worktreeId, (worktree) => {
      const index = worktree.units.findIndex((candidate) => candidate.id === unit.id)
      if (index < 0) throw new UniverError(`Unit ${unit.id} was not found.`, 'UNIT_NOT_FOUND')
      const units = [...worktree.units]
      units[index] = structuredClone(unit)
      return { ...worktree, units }
    })
  }

  async cleanupDiscarded(file: string, id: string): Promise<void> {
    const current = await this.readWorktree(file, id)
    if (current.status !== 'discarded') {
      throw new UniverError('Only discarded worktree data can be cleaned up.', 'WORKTREE_NOT_DISCARDED')
    }
    await rm(worktreePath(file, id))
  }

  private async persistWorktree(file: string, value: LocalWorktree): Promise<LocalWorktree> {
    await this.writeJson(worktreePath(file, value.id), value)
    return value
  }

  private async writeJson(path: string, value: JsonValue | LocalUniverFile | LocalWorktree): Promise<void> {
    const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private async lock<T>(file: string, operation: () => Promise<T>): Promise<T> {
    const previous = locks.get(file) ?? Promise.resolve()
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const queued = previous.then(() => pending)
    locks.set(file, queued)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (locks.get(file) === queued) locks.delete(file)
    }
  }
}

function worktreeDirectory(file: string): string {
  return `${file}.worktrees`
}

function worktreePath(file: string, id: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) throw new UniverError('Invalid worktree ID.', 'INVALID_WORKTREE_ID')
  return join(worktreeDirectory(file), `${id}.json`)
}

function parseFile(value: unknown): LocalUniverFile {
  if (!isRecord(value) || value.format !== LOCAL_FILE_FORMAT || value.version !== LOCAL_FILE_VERSION
    || !Number.isSafeInteger(value.revision) || !Array.isArray(value.units)) {
    throw new UniverError('The file is not a supported open Univer file.', 'INVALID_UNIVER_FILE')
  }
  return value as unknown as LocalUniverFile
}

function parseWorktree(value: unknown): LocalWorktree {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
    || !['draft', 'ready', 'merged', 'discarded'].includes(String(value.status))
    || !Number.isSafeInteger(value.baseRevision) || !Array.isArray(value.baseline) || !Array.isArray(value.units)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new UniverError('The worktree record is invalid.', 'INVALID_WORKTREE')
  }
  return value as unknown as LocalWorktree
}

function requireStatus(worktree: LocalWorktree, status: LocalWorktree['status'], action: string): void {
  if (worktree.status !== status) invalidTransition(worktree, action)
}

function invalidTransition(worktree: LocalWorktree, action: string): never {
  throw new UniverError(`Cannot ${action} a ${worktree.status} worktree.`, 'INVALID_WORKTREE_TRANSITION')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code
}
