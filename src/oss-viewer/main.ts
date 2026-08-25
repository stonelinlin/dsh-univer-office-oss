import { UniverDocsCorePreset } from '@univerjs/preset-docs-core'
import UniverPresetDocsCoreZhCN from '@univerjs/preset-docs-core/locales/zh-CN'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import {
  createUniver,
  defaultTheme,
  LocaleType,
  mergeLocales,
  UniverInstanceType,
} from '@univerjs/presets'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-docs-core/lib/index.css'
import './styles.css'

interface ViewerUnit {
  readonly unitId: string
  readonly kind: 'sheet' | 'doc' | 'slide' | 'base' | 'board'
  readonly name: string
  readonly snapshot: Record<string, unknown>
  readonly editable: boolean
  readonly worktreeId?: string
}

const query = new URLSearchParams(window.location.search)
const status = document.querySelector<HTMLDivElement>('#status')!
const unit = await loadUnit()

if (unit.kind !== 'sheet' && unit.kind !== 'doc') {
  status.textContent = `${unit.name}（${unit.kind}）当前提供结构预览。`
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<pre>${escapeHtml(JSON.stringify(unit.snapshot, null, 2))}</pre>`
} else {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN, UniverPresetDocsCoreZhCN),
    },
    theme: defaultTheme,
    presets: [
      UniverSheetsCorePreset({ container: 'app' }),
      UniverDocsCorePreset({ container: 'app' }),
    ],
  })
  univer.createUnit(
    unit.kind === 'sheet' ? UniverInstanceType.UNIVER_SHEET : UniverInstanceType.UNIVER_DOC,
    unit.snapshot,
  )
  status.textContent = unit.editable ? '草稿已打开；修改会自动保存到本地 worktree。' : '只读预览'
  if (!unit.editable) document.body.dataset.readonly = 'true'

  let timer: number | undefined
  let saving = false
  let dirty = false
  if (unit.editable) {
    univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
      dirty = true
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void save(), 500)
    })
    window.addEventListener('beforeunload', (event) => {
      if (dirty || saving) event.preventDefault()
    })
  }

  async function save(): Promise<void> {
    if (!dirty || saving || unit.worktreeId === undefined) return
    dirty = false
    saving = true
    status.textContent = '正在保存…'
    try {
      const facade = unit.kind === 'sheet' ? univerAPI.getActiveWorkbook() : univerAPI.getActiveDocument()
      if (facade === null) throw new Error('Active Unit is unavailable')
      const response = await fetch('/univer-api/viewer-data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file: required('file'),
          sessionId: required('sessionId'),
          worktreeId: unit.worktreeId,
          unitId: unit.unitId,
          snapshot: facade.save(),
        }),
      })
      if (!response.ok) throw new Error((await response.json() as { message?: string }).message ?? `HTTP ${response.status}`)
      status.textContent = '已保存到本地草稿'
    } catch (error) {
      dirty = true
      status.textContent = `保存失败：${error instanceof Error ? error.message : String(error)}`
    } finally {
      saving = false
      if (dirty) timer = window.setTimeout(() => void save(), 1000)
    }
  }
}

async function loadUnit(): Promise<ViewerUnit> {
  const parameters = new URLSearchParams()
  for (const key of ['file', 'sessionId', 'worktreeId', 'unit']) {
    const value = query.get(key)
    if (value !== null) parameters.set(key, value)
  }
  const response = await fetch(`/univer-api/viewer-data?${parameters.toString()}`)
  if (!response.ok) throw new Error((await response.json() as { message?: string }).message ?? `HTTP ${response.status}`)
  return await response.json() as ViewerUnit
}

function required(name: string): string {
  const value = query.get(name)
  if (value === null || value.length === 0) throw new Error(`${name} is required`)
  return value
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
