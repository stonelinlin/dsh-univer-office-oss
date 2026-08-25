import type { UniverLocaleKey } from './zh.ts'

/** English UI strings. */
export const en = {
  title: 'Univer Preview', expand: 'Expand preview', collapse: 'Collapse preview', refresh: 'Refresh',
  'gateway.running': 'Local Univer runtime ready', 'gateway.stopped': 'Local Univer runtime stopped — click to start',
  'gateway.starting': 'Starting local Univer runtime…', 'gateway.checking': 'Checking local Univer runtime…', 'gateway.failed': 'Local Univer runtime unavailable — click to retry',
  'dock.live': 'live sync', 'dock.draft': 'Editing', 'dock.ready': 'Ready', 'dock.mergeReady': 'Ready',
  'dock.unit.added': 'A', 'dock.unit.modified': 'M', 'dock.unit.deleted': 'D', 'dock.unit.conflict': 'Conflict',
  'dock.fold': 'Collapse', 'dock.expand': 'Expand', 'dock.maximize': 'Maximize', 'dock.restore': 'Restore', 'dock.close': 'Close',
  'dock.gatewayDown': 'Local Univer runtime is unavailable', 'dock.startGateway': 'Retry runtime',
  'dock.mergeTitle': 'Merge preview', 'dock.reviewTitle': 'Modification in progress', 'dock.markReady': 'Submit for confirmation',
  'dock.merged': 'Merged', 'dock.discarded': 'Discarded', 'dock.mergedTitle': 'Changes merged', 'dock.discardedTitle': 'Changes discarded',
  'dock.fullscreen': 'Review fullscreen', 'dock.exitFullscreen': 'Exit fullscreen',
  'dock.currentVersion': 'Current version', 'dock.loading': 'Loading', 'dock.unavailable': 'Unavailable',
  'dock.notReady': 'Submit this modification for confirmation before merging or discarding it', 'dock.merge': 'Merge into current version', 'dock.discard': 'Discard',
} satisfies Record<UniverLocaleKey, string>
