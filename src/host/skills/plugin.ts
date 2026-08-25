import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'univer'
const INVOCATION = { modelInvocable: true, userInvocable: true } as const
const DEFINITIONS = [
  {
    name: 'univer',
    description: 'Create, inspect, edit, import, export, and hand off local .univer Sheet and Doc files through DSH tools and isolated worktrees.',
  },
  {
    name: 'univer-sheet',
    description: 'Read, write, format, calculate, import, export, and verify OSS Univer Sheet Units.',
  },
  {
    name: 'univer-doc',
    description: 'Read, create, edit, inspect, export, and review OSS Univer Doc Units with basic open DOCX conversion.',
  },
] as const

const CANDIDATES: readonly SkillCandidate[] = DEFINITIONS.map((definition) => {
  const url = new URL(`../skills/${definition.name}/SKILL.md`, import.meta.url)
  return {
    ...definition,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: fileURLToPath(new URL(`../skills/${definition.name}/`, import.meta.url)) },
    rank: BUNDLED_SKILL_RANK,
    locator: url,
  }
})

const provider: SkillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve(CANDIDATES),
  async get(candidate): Promise<SkillDefinition> {
    if (!(candidate.locator instanceof URL)) throw new Error('univer skill locator must be a URL')
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: candidate.provider,
      source: candidate.source,
      ...candidate.resourceBase === undefined ? {} : { resourceBase: candidate.resourceBase },
      content: stripFrontmatter(await readFile(candidate.locator, 'utf8')),
    }
  },
}

export const name = 'univer-skills'
export const inject = ['skills']

/** Register version-matched Univer instructions on the DSH skill seam. */
export function apply(ctx: Context): void {
  ctx.skills.registerProvider(() => provider)
}

function stripFrontmatter(value: string): string {
  if (!value.startsWith('---\n')) return value
  const end = value.indexOf('\n---\n', 4)
  return end === -1 ? value : value.slice(end + 5)
}
