export function extractPlainText(serialized: string): string {
  try {
    const doc = JSON.parse(serialized)
    const parts: Array<string> = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const { text, content } = node as { text?: unknown; content?: unknown }
      if (typeof text === 'string') parts.push(text)
      if (Array.isArray(content)) content.forEach(walk)
    }
    walk(doc)
    return parts.join(' ').trim()
  } catch {
    return serialized
  }
}
