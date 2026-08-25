import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../skills/', import.meta.url)
const directories = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
assert.deepEqual(directories, ['univer', 'univer-doc', 'univer-sheet'])
for (const directory of directories) {
  const content = await readFile(new URL(`${directory}/SKILL.md`, root), 'utf8')
  assert.match(content, /^---\nname:/u)
  for (const forbidden of ['univer_screenshot', 'univer_compile_svg', '@univerjs-pro/']) {
    assert.equal(content.includes(forbidden), false, `${directory} advertises unavailable ${forbidden}`)
  }
}
console.log('skills smoke OK (only supported OSS workflows are advertised)')
