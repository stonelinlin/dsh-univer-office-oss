import type { SessionStore } from '@deepseek-ai/dsh-session'
import type { UniverService } from '../../service/univer-service.ts'
import { resolveAuthorizedFile } from '../session-scope.ts'

/** Read one file's current worktree state. */
export async function stateRoute(service: UniverService, sessions: SessionStore, file: unknown, sessionId: unknown) {
  const authorized = await resolveAuthorizedFile(file, sessionId, sessions)
  const state = await service.fileState({ workspace: authorized.workspace, file: authorized.path })
  const id = String(sessionId)
  return {
    ...state,
    viewerUrl: state.viewerUrl === null ? null : withSession(state.viewerUrl, id),
    worktrees: state.worktrees.map((worktree) => ({
      ...worktree,
      ...(worktree.openUrl === undefined ? {} : { openUrl: withSession(worktree.openUrl, id) }),
      ...(worktree.worktreeUrl === undefined ? {} : { worktreeUrl: withSession(worktree.worktreeUrl, id) }),
      ...(worktree.mergeUrl === undefined ? {} : { mergeUrl: withSession(worktree.mergeUrl, id) }),
      units: worktree.units.map((unit) => ({
        ...unit,
        ...(unit.worktreeUrl === undefined ? {} : { worktreeUrl: withSession(unit.worktreeUrl, id) }),
        ...(unit.mergeUrl === undefined ? {} : { mergeUrl: withSession(unit.mergeUrl, id) }),
      })),
    })),
  }
}

function withSession(url: string, sessionId: string): string {
  const parsed = new URL(url, 'http://localhost')
  parsed.searchParams.set('sessionId', sessionId)
  return `${parsed.pathname}${parsed.search}`
}
