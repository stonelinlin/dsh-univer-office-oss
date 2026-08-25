import type { LocaleId } from '@deepseek-ai/dsh-client-locale/client'

/** Locale tags understood by the bundled Univer Viewer. */
export type ViewerLocale = 'zh-CN' | 'en-US'

/** Viewer-locale accessor injected into DSH slot components. */
export interface ViewerLocaleInjected {
  readonly getViewerLocale: () => ViewerLocale
}

const VIEWER_LOCALES = {
  zh: 'zh-CN',
  en: 'en-US',
} as const satisfies Record<LocaleId, ViewerLocale>

/** Map one DSH locale id to the corresponding Univer Viewer locale tag. */
export function viewerLocaleOf(locale: LocaleId): ViewerLocale {
  return VIEWER_LOCALES[locale]
}

/** Add the active Viewer locale without reconstructing the Host-owned target. */
export function localizeViewerUrl(url: string, locale: ViewerLocale): string {
  const target = new URL(url, window.location.origin)
  target.searchParams.set('lang', locale)
  return target.toString()
}
