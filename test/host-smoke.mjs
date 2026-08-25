import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'

const host = await import('../lib/index.js')
assert.equal(host.name, 'dsh-univer-office-oss')
assert.equal(typeof host.apply, 'function')
assert.equal(typeof host.LocalUniverService, 'function')
assert.deepEqual(host.resolveConfig({ tools: false, skills: false }).tools, false)

const execution = await host.executeWithOssUniver(host.createUnit('sheet', 'Runtime smoke'), 'return 42')
assert.equal(execution.value, 42)
assert.equal(execution.snapshot.name, 'Runtime smoke')
const docExecution = await host.executeWithOssUniver(host.createUnit('doc', 'Document smoke'), 'return 7')
assert.equal(docExecution.value, 7)
assert.equal(docExecution.snapshot.title, 'Document smoke')

const temporary = await mkdtemp(join(tmpdir(), 'univer-ready-preview-'))
const workspace = await realpath(temporary)
try {
  const file = join(workspace, 'ready.univer')
  const service = new host.LocalUniverService(new Context())
  await service.store.create(file)
  const draft = await service.store.createWorktree(file, 'Ready preview')
  await service.store.mutateWorktree(file, draft.id, (current) => ({
    ...current,
    units: [host.createUnit('sheet', 'Preview sheet')],
  }))
  await service.store.transition(file, draft.id, 'ready')
  const state = await service.fileState({ workspace, file })
  assert.match(state.worktrees[0]?.mergeUrl ?? '', /worktreeId=/u)
  assert.match(state.worktrees[0]?.units[0]?.mergeUrl ?? '', /unit=/u)
} finally {
  await rm(workspace, { recursive: true, force: true })
}

const service = new host.LocalUniverService(new Context())
const server = createServer(host.createUniverRouter(service, {}))
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
try {
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  const viewerResponse = await fetch(`${origin}/univer-api/viewer`)
  assert.equal(viewerResponse.status, 200)
  const viewerHtml = await viewerResponse.text()
  const asset = viewerHtml.match(/src="([^"]+\.js)"/u)?.[1]
  assert.ok(asset)
  const assetResponse = await fetch(new URL(asset, origin))
  assert.equal(assetResponse.status, 200)
  assert.match(assetResponse.headers.get('content-type') ?? '', /javascript/u)
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

const bundle = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const forbidden of ['@univerjs-pro/', '@univer-cli/', '@superdoc/docx-engine']) {
  assert.equal(bundle.includes(forbidden), false, `Host bundle contains forbidden dependency: ${forbidden}`)
}
console.log('host smoke OK (OSS Facade execution, exports, and forbidden dependency boundary)')
