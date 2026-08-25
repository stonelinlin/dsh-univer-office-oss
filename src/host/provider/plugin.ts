import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import { LocalUniverService } from './local-univer-service.ts'

/** Mount the Univer Service Provider. */
export function apply(ctx: Context, config: ResolvedConfig): void {
  void config
  new LocalUniverService(ctx)
}

export const name = 'univer-provider'
