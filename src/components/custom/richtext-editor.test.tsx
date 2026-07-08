import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useEditor } from '@tiptap/react'
import { RichTextEditor } from './richtext-editor'

// Tiptap/ProseMirror relies on browser-only DOM APIs (real contentEditable
// typing, Range.getClientRects, Selection) that jsdom doesn't implement,
// making genuine keystroke/selection simulation unreliable and flaky. Since
// romcal/proseMirror is a third-party dependency, we mock `@tiptap/react`'s
// `useEditor`/`EditorContent` and test this component's own wiring
// (content parsing, onChange plumbing, toolbar active-state/command calls,
// editable prop propagation) in isolation, per unit-testing conventions.
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(),
  EditorContent: ({ editor }: { editor: any }) => (
    <div
      data-testid="editor-content"
      data-json={JSON.stringify(editor.getJSON())}
    />
  ),
}))

vi.mock('@tiptap/starter-kit', () => ({ StarterKit: {} }))

function createMockEditor(
  overrides: {
    activeMarks?: Array<string>
    json?: unknown
  } = {},
) {
  const activeMarks = new Set(overrides.activeMarks ?? [])
  const json = overrides.json ?? { type: 'doc', content: [] }
  const chain: any = {}
  chain.focus = vi.fn(() => chain)
  chain.toggleBold = vi.fn(() => chain)
  chain.toggleItalic = vi.fn(() => chain)
  chain.toggleBulletList = vi.fn(() => chain)
  chain.toggleOrderedList = vi.fn(() => chain)
  chain.run = vi.fn()

  return {
    isActive: vi.fn((name: string) => activeMarks.has(name)),
    chain: vi.fn(() => chain),
    getJSON: vi.fn(() => json),
    commands: { setContent: vi.fn() },
    setEditable: vi.fn(),
    __chain: chain,
  }
}

describe('RichTextEditor', () => {
  let lastConfig: any

  beforeEach(() => {
    lastConfig = null
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      return createMockEditor()
    })
  })

  test('renders with initial JSON content by passing parsed content to useEditor', () => {
    const initial = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
    render(<RichTextEditor value={initial} onChange={vi.fn()} />)

    expect(lastConfig.content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
  })

  test('falls back to the raw value when it is not valid JSON', () => {
    render(<RichTextEditor value="plain text" onChange={vi.fn()} />)

    expect(lastConfig.content).toBe('plain text')
  })

  test('renders empty content for an empty value', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />)

    expect(lastConfig.content).toBe('')
  })

  test('calls onChange with serialized JSON when the editor reports an update', () => {
    const onChange = vi.fn()
    const updatedJson = { type: 'doc', content: [{ type: 'text', text: 'x' }] }
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor({ json: updatedJson })
      return mockEditor
    })

    render(<RichTextEditor value="" onChange={onChange} />)

    lastConfig.onUpdate({ editor: mockEditor })

    expect(onChange).toHaveBeenCalledWith(JSON.stringify(updatedJson))
  })

  test('bold toggle reflects active state and calls the bold command on click', () => {
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor({ activeMarks: ['bold'] })
      return mockEditor
    })

    render(<RichTextEditor value="" onChange={vi.fn()} />)

    const boldToggle = screen.getByLabelText('Bold')
    expect(boldToggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(boldToggle)

    expect(mockEditor.chain).toHaveBeenCalled()
    expect(mockEditor.__chain.focus).toHaveBeenCalled()
    expect(mockEditor.__chain.toggleBold).toHaveBeenCalled()
    expect(mockEditor.__chain.run).toHaveBeenCalled()
  })

  test('italic toggle reflects inactive state and calls the italic command on click', () => {
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor()
      return mockEditor
    })

    render(<RichTextEditor value="" onChange={vi.fn()} />)

    const italicToggle = screen.getByLabelText('Italic')
    expect(italicToggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(italicToggle)

    expect(mockEditor.__chain.toggleItalic).toHaveBeenCalled()
    expect(mockEditor.__chain.run).toHaveBeenCalled()
  })

  test('bullet list toggle calls the bullet list command on click', () => {
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor()
      return mockEditor
    })

    render(<RichTextEditor value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Bullet list'))

    expect(mockEditor.__chain.toggleBulletList).toHaveBeenCalled()
    expect(mockEditor.__chain.run).toHaveBeenCalled()
  })

  test('ordered list toggle calls the ordered list command on click', () => {
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor()
      return mockEditor
    })

    render(<RichTextEditor value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Ordered list'))

    expect(mockEditor.__chain.toggleOrderedList).toHaveBeenCalled()
    expect(mockEditor.__chain.run).toHaveBeenCalled()
  })

  test('editable=false hides the toolbar', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} editable={false} />)

    expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Italic')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bullet list')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ordered list')).not.toBeInTheDocument()
  })

  test('editable=true shows the toolbar', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} editable />)

    expect(screen.getByLabelText('Bold')).toBeInTheDocument()
  })

  test('passes editable through to useEditor config and calls setEditable on change', () => {
    let mockEditor: any
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      mockEditor = createMockEditor()
      return mockEditor
    })

    const { rerender } = render(
      <RichTextEditor value="" onChange={vi.fn()} editable={false} />,
    )
    expect(lastConfig.editable).toBe(false)
    expect(mockEditor.setEditable).toHaveBeenCalledWith(false)

    rerender(<RichTextEditor value="" onChange={vi.fn()} editable />)
    expect(mockEditor.setEditable).toHaveBeenCalledWith(true)
  })

  test('sets the placeholder data attribute in editorProps when provided', () => {
    render(
      <RichTextEditor
        value=""
        onChange={vi.fn()}
        placeholder="Type something"
      />,
    )

    expect(lastConfig.editorProps.attributes['data-placeholder']).toBe(
      'Type something',
    )
  })

  test('omits the placeholder data attribute when not provided', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />)

    expect(
      lastConfig.editorProps.attributes['data-placeholder'],
    ).toBeUndefined()
  })
})
