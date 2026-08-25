import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import type {} from '../service/univer-service.ts'
import { apiTool } from './definitions/api.ts'
import { executeTool } from './definitions/execute.ts'
import { exportTool } from './definitions/export.ts'
import { importTool } from './definitions/import.ts'
import { inspectTool } from './definitions/inspect.ts'
import { newTool } from './definitions/new.ts'
import { statusTool } from './definitions/status.ts'
import { unitTool } from './definitions/unit.ts'
import { worktreeTool } from './definitions/worktree.ts'
import { withUniverErrorContent } from './presentation.ts'

export const inject = ['univer', 'tools']
export const name = 'univer-tools'

/** Register model-facing domain tools over `ctx.univer`. */
export function apply(ctx: Context, config: ResolvedConfig): void {
  const timeoutMs = config.operationTimeoutMs
  ctx.tools.register(withUniverErrorContent(newTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(statusTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(worktreeTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(unitTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(importTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(inspectTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(executeTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(exportTool(ctx, timeoutMs)))
  ctx.tools.register(withUniverErrorContent(apiTool(ctx)))
  ctx.on('tools/pre-execute', (exec, next) => {
    if (exec.name !== 'univer_worktree' || !isRecord(exec.arguments)) return next()
    const action = exec.arguments.action
    if (action !== 'merge' && action !== 'discard') return next()
    return Promise.resolve({
      kind: 'ask',
      reason: action === 'merge'
        ? 'Merging publishes the selected Univer worktree into trunk.'
        : 'Discarding permanently removes the selected Univer worktree changes.',
    })
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
