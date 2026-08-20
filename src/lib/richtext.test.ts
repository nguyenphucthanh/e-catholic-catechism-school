import { describe, expect, test } from 'vitest'
import { extractPlainText } from './richtext'

describe('extractPlainText', () => {
  test('extracts text from a nested Tiptap doc', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'world' },
          ],
        },
      ],
    }
    expect(extractPlainText(JSON.stringify(doc))).toBe('Hello world')
  })

  test('returns empty string for a doc with no text nodes', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
    expect(extractPlainText(JSON.stringify(doc))).toBe('')
  })

  test('falls back to the raw string when JSON.parse throws', () => {
    expect(extractPlainText('not json')).toBe('not json')
  })
})
