import z from '@deepseek-ai/schemastery'

/** User-facing configuration for the local OSS provider. */
export interface Config {
  /** Maximum lifetime of one model-facing local operation. */
  operationTimeoutMs?: number
  /** Register model-facing `univer_*` tools. */
  tools?: boolean
  /** Register bundled Sheet/Doc workflow skills. */
  skills?: boolean
}

export interface ResolvedConfig {
  readonly operationTimeoutMs: number
  readonly tools: boolean
  readonly skills: boolean
}

export const Config: z<Config> = z.object({
  operationTimeoutMs: z.natural().default(120_000),
  tools: z.boolean().default(true),
  skills: z.boolean().default(true),
})

export function resolveConfig(config: Config = {}): ResolvedConfig {
  const operationTimeoutMs = config.operationTimeoutMs ?? 120_000
  if (!Number.isSafeInteger(operationTimeoutMs) || operationTimeoutMs < 1) {
    throw new Error('univer: operationTimeoutMs must be a positive integer')
  }
  return {
    operationTimeoutMs,
    tools: config.tools ?? true,
    skills: config.skills ?? true,
  }
}
