import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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

const bundle = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const forbidden of ['@univerjs-pro/', '@univer-cli/', '@superdoc/docx-engine']) {
  assert.equal(bundle.includes(forbidden), false, `Host bundle contains forbidden dependency: ${forbidden}`)
}
console.log('host smoke OK (OSS Facade execution, exports, and forbidden dependency boundary)')
