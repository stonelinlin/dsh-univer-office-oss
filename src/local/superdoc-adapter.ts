import type { SDDocument } from '@superdoc/document-api'
import type { JsonValue } from '../host/service/types.ts'

/** Project a Univer Doc snapshot into the engine-agnostic SuperDoc SDM/1 contract. */
export function projectDocToSuperDoc(snapshot: Record<string, JsonValue>): SDDocument {
  const body = isRecord(snapshot.body) ? snapshot.body : {}
  const stream = typeof body.dataStream === 'string' ? body.dataStream : ''
  const text = stream.replace(/\r?\n$/u, '')
  const paragraphs = text.split(/\r\n|\r|\n/u)
  return {
    modelVersion: 'sdm/1',
    body: paragraphs.map((paragraph) => ({
      kind: 'paragraph',
      paragraph: {
        inlines: paragraph.length === 0 ? [] : [{ kind: 'run', run: { text: paragraph } }],
      },
    })),
  }
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
