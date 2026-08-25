import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SessionStore } from '@deepseek-ai/dsh-session'
import { UniverError } from '../service/errors.ts'
import { unitId, worktreeId } from '../service/identifiers.ts'
import type { UniverService } from '../service/univer-service.ts'
import type { JsonValue } from '../service/types.ts'
import { gatewayStartRoute } from './routes/gateway.ts'
import { stateRoute } from './routes/state.ts'
import { statusRoute } from './routes/status.ts'
import { worktreeActionRoute } from './routes/worktree-action.ts'
import { resolveAuthorizedFile } from './session-scope.ts'

const MAX_BODY_BYTES = 64 * 1024
const MAX_VIEWER_BODY_BYTES = 16 * 1024 * 1024
const VIEWER_ROOT = fileURLToPath(new URL('../artifacts/viewer/', import.meta.url))

/** Create the `/univer-api` HTTP dispatcher. */
export function createUniverRouter(service: UniverService, sessions: SessionStore) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (request.method === 'GET' && url.pathname === '/univer-api/status') {
        sendJson(response, 200, await statusRoute(service))
        return
      }
      if (request.method === 'POST' && url.pathname === '/univer-api/gateway/start') {
        sendJson(response, 200, await gatewayStartRoute(service))
        return
      }
      if (request.method === 'GET' && url.pathname === '/univer-api/state') {
        sendJson(response, 200, await stateRoute(service, sessions, url.searchParams.get('file'), url.searchParams.get('sessionId')))
        return
      }
      if (request.method === 'POST' && url.pathname === '/univer-api/worktree-action') {
        sendJson(response, 200, await worktreeActionRoute(service, sessions, await readJsonBody(request)))
        return
      }
      if (request.method === 'GET' && url.pathname === '/univer-api/viewer') {
        await sendAsset(response, 'index.html')
        return
      }
      if (request.method === 'GET' && url.pathname.startsWith('/univer-api/viewer-assets/')) {
        await sendAsset(response, decodeURIComponent(url.pathname.slice('/univer-api/viewer-assets/'.length)))
        return
      }
      if (request.method === 'GET' && url.pathname === '/univer-api/viewer-data') {
        const authorized = await resolveAuthorizedFile(url.searchParams.get('file'), url.searchParams.get('sessionId'), sessions)
        const rawWorktree = url.searchParams.get('worktreeId')
        const rawUnit = url.searchParams.get('unit')
        sendJson(response, 200, await service.viewerUnit({
          workspace: authorized.workspace,
          file: authorized.path,
          ...(rawWorktree === null ? {} : { worktreeId: worktreeId(rawWorktree) }),
          ...(rawUnit === null ? {} : { unitId: unitId(rawUnit) }),
        }))
        return
      }
      if (request.method === 'PUT' && url.pathname === '/univer-api/viewer-data') {
        const body = await readJsonBody(request, MAX_VIEWER_BODY_BYTES)
        if (!isObject(body) || typeof body.worktreeId !== 'string' || typeof body.unitId !== 'string' || !isJsonRecord(body.snapshot)) {
          throw new UniverError('Viewer save requires file, sessionId, worktreeId, unitId and snapshot.', 'INVALID_REQUEST')
        }
        const authorized = await resolveAuthorizedFile(body.file, body.sessionId, sessions)
        sendJson(response, 200, await service.saveViewerUnit({
          workspace: authorized.workspace,
          file: authorized.path,
          worktreeId: worktreeId(body.worktreeId),
          unitId: unitId(body.unitId),
          snapshot: body.snapshot,
        }))
        return
      }
      response.writeHead(404)
      response.end()
    } catch (error) {
      const rejected = error instanceof UniverError && (
        error.code === 'INVALID_REQUEST'
        || error.code === 'INVALID_FILE_PATH'
        || error.code === 'FILE_PERMISSION_DENIED'
        || error.code === 'SESSION_SCOPE_UNAVAILABLE'
        || error.code === 'SESSION_SCOPE_DENIED'
      )
      const forbidden = error instanceof UniverError && (
        error.code === 'FILE_PERMISSION_DENIED' || error.code === 'SESSION_SCOPE_DENIED'
      )
      const status = rejected ? (forbidden ? 403 : 400) : 500
      sendJson(response, status, {
        ok: false,
        code: error instanceof UniverError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/** Send a JSON response with no browser cache. */
export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > maxBytes) throw new UniverError('request body is too large', 'INVALID_REQUEST')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new UniverError('JSON body is required', 'INVALID_REQUEST')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new UniverError('request body must be valid JSON', 'INVALID_REQUEST', { cause: error })
  }
}

async function sendAsset(response: ServerResponse, relativePath: string): Promise<void> {
  const path = resolve(VIEWER_ROOT, relativePath)
  if (path !== VIEWER_ROOT.slice(0, -1) && !path.startsWith(`${VIEWER_ROOT}${sep}`)) {
    throw new UniverError('Invalid Viewer asset path.', 'INVALID_REQUEST')
  }
  const content = await readFile(path)
  const contentType = ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  } as Record<string, string>)[extname(path)] ?? 'application/octet-stream'
  response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' })
  response.end(content)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
  return isObject(value) && Object.values(value).every(isJsonValue)
}

function isJsonValue(value: unknown): value is JsonValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
    || (Array.isArray(value) && value.every(isJsonValue))
    || isJsonRecord(value)
}
