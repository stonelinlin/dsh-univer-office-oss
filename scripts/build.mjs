import { builtinModules } from 'node:module'
import { execFileSync } from 'node:child_process'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { build as buildVite } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const target = process.argv[2] ?? 'all'
const peerDependencies = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/schemastery',
  'docx',
  'exceljs',
  'mammoth',
]
const nodeExternal = [...builtinModules, ...builtinModules.map((name) => `node:${name}`), ...peerDependencies]

if (target === 'all' || target === 'lib') {
  await rm('lib', { recursive: true, force: true })
  await mkdir('lib', { recursive: true })
  await build({
    entryPoints: ['src/host/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    packages: 'bundle',
    external: nodeExternal,
    platform: 'node',
    target: 'node22.19',
    format: 'esm',
    legalComments: 'eof',
    sourcemap: true,
    tsconfig: 'tsconfig.json',
  })

  const client = await build({
    entryPoints: ['src/client/index.tsx'],
    bundle: true,
    write: false,
    packages: 'bundle',
    external: ['react'],
    platform: 'browser',
    target: 'es2022',
    format: 'cjs',
    legalComments: 'none',
    tsconfig: 'tsconfig.client.json',
  })
  const clientCode = client.outputFiles[0]?.text
  if (clientCode === undefined) throw new Error('client build produced no JavaScript')
  await writeFile('lib/client.js', `window.__ModuleLoader__.load({\n  id: "dsh-univer-office-oss",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${indent(clientCode, 4)}\n    return module.exports;\n  }\n});\n`)
  console.log('built lib/index.js + lib/client.js')
}

if (target === 'all' || target === 'viewer') {
  await ensureVendorStyles()
  await buildVite({
    configFile: false,
    root: resolve('src/oss-viewer'),
    base: '/univer-api/viewer-assets/',
    build: {
      target: 'es2022',
      outDir: resolve('artifacts/viewer'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 10_000,
    },
    define: { 'process.env': '{}' },
    plugins: [tailwindcss()],
  })
  console.log('built artifacts/viewer')
}

async function ensureVendorStyles() {
  const sheetCss = 'vendor/univer/presets/packages/preset-sheets-core/lib/index.css'
  const docCss = 'vendor/univer/presets/packages/preset-docs-core/lib/index.css'
  if (await exists(sheetCss) && await exists(docCss)) return
  const common = ['-r', '--filter', '@univerjs/preset-sheets-core^...', '--filter', '@univerjs/preset-docs-core^...', '--workspace-concurrency=4', '--if-present', 'run', 'build:bundle']
  execFileSync('pnpm', common, { stdio: 'inherit' })
  execFileSync('pnpm', ['--filter', '@univerjs/preset-sheets-core', 'run', 'build:bundle'], { stdio: 'inherit' })
  execFileSync('pnpm', ['--filter', '@univerjs/preset-docs-core', 'run', 'build:bundle'], { stdio: 'inherit' })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces)
  return value.split('\n').map((line) => line.length === 0 ? '' : prefix + line).join('\n')
}
