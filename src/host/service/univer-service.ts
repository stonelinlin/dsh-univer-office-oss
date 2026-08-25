import { Context, Service } from '@deepseek-ai/cordis'
import type { UniverServiceMethods } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    univer: UniverService
  }
}

/** Service Definition for all Host-side Univer operations. */
export abstract class UniverService extends Service implements UniverServiceMethods {
  constructor(ctx: Context) {
    super(ctx, 'univer')
  }

  abstract gatewayStatus(): ReturnType<UniverServiceMethods['gatewayStatus']>
  abstract ensureGateway(): ReturnType<UniverServiceMethods['ensureGateway']>
  abstract unitContentStatus(): ReturnType<UniverServiceMethods['unitContentStatus']>
  abstract fileState(...args: Parameters<UniverServiceMethods['fileState']>): ReturnType<UniverServiceMethods['fileState']>
  abstract worktreeAction(...args: Parameters<UniverServiceMethods['worktreeAction']>): ReturnType<UniverServiceMethods['worktreeAction']>
  abstract newFile(...args: Parameters<UniverServiceMethods['newFile']>): ReturnType<UniverServiceMethods['newFile']>
  abstract status(...args: Parameters<UniverServiceMethods['status']>): ReturnType<UniverServiceMethods['status']>
  abstract worktree(...args: Parameters<UniverServiceMethods['worktree']>): ReturnType<UniverServiceMethods['worktree']>
  abstract unit(...args: Parameters<UniverServiceMethods['unit']>): ReturnType<UniverServiceMethods['unit']>
  abstract inspectUnitContent(...args: Parameters<UniverServiceMethods['inspectUnitContent']>): ReturnType<UniverServiceMethods['inspectUnitContent']>
  abstract executeUnitContent(...args: Parameters<UniverServiceMethods['executeUnitContent']>): ReturnType<UniverServiceMethods['executeUnitContent']>
  abstract importUnitContent(...args: Parameters<UniverServiceMethods['importUnitContent']>): ReturnType<UniverServiceMethods['importUnitContent']>
  abstract exportUnitContent(...args: Parameters<UniverServiceMethods['exportUnitContent']>): ReturnType<UniverServiceMethods['exportUnitContent']>
  abstract apiReference(...args: Parameters<UniverServiceMethods['apiReference']>): ReturnType<UniverServiceMethods['apiReference']>
  abstract viewerUnit(...args: Parameters<UniverServiceMethods['viewerUnit']>): ReturnType<UniverServiceMethods['viewerUnit']>
  abstract saveViewerUnit(...args: Parameters<UniverServiceMethods['saveViewerUnit']>): ReturnType<UniverServiceMethods['saveViewerUnit']>
}
