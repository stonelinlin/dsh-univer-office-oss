import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
assert.match(client, /id: "dsh-univer-office-oss"/u)
assert.equal(client.includes('@univerjs-pro/'), false)

const html = await readFile(new URL('../artifacts/viewer/index.html', import.meta.url), 'utf8')
assert.match(html, /\/univer-api\/viewer-assets\//u)
const assets = await readdir(new URL('../artifacts/viewer/assets/', import.meta.url))
assert.ok(assets.some((file) => file.endsWith('.js')), 'Viewer must emit JavaScript')
assert.ok(assets.some((file) => file.endsWith('.css')), 'Viewer must emit processed CSS')
console.log('client smoke OK (DSH client and OSS Viewer artifacts)')
