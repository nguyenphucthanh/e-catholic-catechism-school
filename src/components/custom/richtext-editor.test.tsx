import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useEditor } from '@tiptap/react'
import { RichTextEditor } from './richtext-editor'
import { compressAndResizeImage } from '~/lib/image'

// Tiptap/ProseMirror relies on browser-only DOM APIs (real contentEditable
// typing, Range.getClientRects, Selection) that jsdom doesn't implement,
// making genuine keystroke/selection simulation unreliable and flaky. Since
// tiptap is a third-party dependency, we mock `@tiptap/react`'s
// `useEditor`/`EditorContent` and test this component's own wiring
// (content parsing, onChange plumbing, toolbar active-state/command calls,
// editable prop propagation, mode switching, image upload & compression) in isolation.
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(),
  EditorContent: ({ editor }: { editor: any }) => (
    <div
      data-testid="editor-content"
      data-json={JSON.stringify(editor?.getJSON() ?? {})}
    />
  ),
}))

vi.mock('@tiptap/starter-kit', () => ({ StarterKit: {} }))
vi.mock('@tiptap/extension-image', () => ({
  Image: { configure: vi.fn(() => ({})) },
}))
vi.mock('@tiptap/extension-link', () => ({
  Link: { configure: vi.fn(() => ({})) },
}))
vi.mock('@tiptap/extension-underline', () => ({ Underline: {} }))
vi.mock('@tiptap/extension-text-align', () => ({
  TextAlign: { configure: vi.fn(() => ({})) },
}))

vi.mock('~/lib/image', () => ({
  compressAndResizeImage: vi.fn((file: File) => Promise.resolve(file)),
}))

function createMockEditor(
  overrides: {
    activeMarks?: Array<any>
    json?: unknown
  } = {},
) {
  const activeMarks = overrides.activeMarks ?? []
  const json = overrides.json ?? { type: 'doc', content: [] }
  const chain: any = {}
  chain.focus = vi.fn(() => chain)
  chain.toggleBold = vi.fn(() => chain)
  chain.toggleItalic = vi.fn(() => chain)
  chain.toggleUnderline = vi.fn(() => chain)
  chain.toggleStrike = vi.fn(() => chain)
  chain.toggleCode = vi.fn(() => chain)
  chain.toggleHeading = vi.fn(() => chain)
  chain.toggleBulletList = vi.fn(() => chain)
  chain.toggleOrderedList = vi.fn(() => chain)
  chain.toggleBlockquote = vi.fn(() => chain)
  chain.toggleCodeBlock = vi.fn(() => chain)
  chain.setHorizontalRule = vi.fn(() => chain)
  chain.setTextAlign = vi.fn(() => chain)
  chain.unsetLink = vi.fn(() => chain)
  chain.setLink = vi.fn(() => chain)
  chain.extendMarkRange = vi.fn(() => chain)
  chain.setImage = vi.fn(() => chain)
  chain.undo = vi.fn(() => chain)
  chain.redo = vi.fn(() => chain)
  chain.run = vi.fn()

  return {
    isActive: vi.fn((name: any) => {
      if (typeof name === 'string') {
        return activeMarks.includes(name)
      }
      if (typeof name === 'object') {
        return activeMarks.some(
          (m) =>
            typeof m === 'object' && JSON.stringify(m) === JSON.stringify(name),
        )
      }
      return false
    }),
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
    vi.clearAllMocks()
    ;(useEditor as any).mockImplementation((config: any) => {
      lastConfig = config
      return createMockEditor()
    })
  })

  describe('Default (simple) Mode', () => {
    test('defaults to simple mode and renders basic toolbar buttons', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} />)

      expect(screen.getByLabelText('Bold')).toBeInTheDocument()
      expect(screen.getByLabelText('Italic')).toBeInTheDocument()
      expect(screen.getByLabelText('Bullet list')).toBeInTheDocument()
      expect(screen.getByLabelText('Ordered list')).toBeInTheDocument()

      expect(screen.queryByLabelText('Heading 1')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Underline')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Upload image')).not.toBeInTheDocument()
    })

    test('calls onChange with serialized JSON when the editor updates', () => {
      const onChange = vi.fn()
      const updatedJson = {
        type: 'doc',
        content: [{ type: 'text', text: 'x' }],
      }
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

    test('editable=false hides simple toolbar', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} editable={false} />)

      expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument()
    })
  })

  describe('Advance Mode', () => {
    test('renders rich text toolbar controls in advance mode', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      // History
      expect(screen.getByLabelText('Undo')).toBeInTheDocument()
      expect(screen.getByLabelText('Redo')).toBeInTheDocument()

      // Headings
      expect(screen.getByLabelText('Heading 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Heading 2')).toBeInTheDocument()
      expect(screen.getByLabelText('Heading 3')).toBeInTheDocument()

      // Formatting
      expect(screen.getByLabelText('Bold')).toBeInTheDocument()
      expect(screen.getByLabelText('Italic')).toBeInTheDocument()
      expect(screen.getByLabelText('Underline')).toBeInTheDocument()
      expect(screen.getByLabelText('Strikethrough')).toBeInTheDocument()
      expect(screen.getByLabelText('Code')).toBeInTheDocument()

      // Lists & Blocks
      expect(screen.getByLabelText('Bullet list')).toBeInTheDocument()
      expect(screen.getByLabelText('Ordered list')).toBeInTheDocument()
      expect(screen.getByLabelText('Blockquote')).toBeInTheDocument()
      expect(screen.getByLabelText('Code block')).toBeInTheDocument()
      expect(screen.getByLabelText('Horizontal rule')).toBeInTheDocument()

      // Alignments
      expect(screen.getByLabelText('Align left')).toBeInTheDocument()
      expect(screen.getByLabelText('Align center')).toBeInTheDocument()
      expect(screen.getByLabelText('Align right')).toBeInTheDocument()
      expect(screen.getByLabelText('Align justify')).toBeInTheDocument()

      // Links & Media
      expect(screen.getByLabelText('Link')).toBeInTheDocument()
      expect(screen.getByLabelText('Upload image')).toBeInTheDocument()
    })

    test('triggers underline command when clicked in advance mode', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Underline'))

      expect(mockEditor.__chain.toggleUnderline).toHaveBeenCalled()
      expect(mockEditor.__chain.run).toHaveBeenCalled()
    })

    test('triggers text align command when clicked', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Align center'))

      expect(mockEditor.__chain.setTextAlign).toHaveBeenCalledWith('center')
      expect(mockEditor.__chain.run).toHaveBeenCalled()
    })
  })

  describe('Image Upload with Auto Compression', () => {
    test('compresses and inserts image when file is selected via hidden input', async () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      const dummyFile = new File(['fake image content'], 'test.png', {
        type: 'image/png',
      })
      const compressedFile = new File(
        ['compressed image content'],
        'test.jpg',
        { type: 'image/jpeg' },
      )
      ;(compressAndResizeImage as any).mockResolvedValue(compressedFile)

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const fileInput = screen.getByTestId('rich-text-image-input')

      // Simulate file selection
      fireEvent.change(fileInput, { target: { files: [dummyFile] } })

      await waitFor(() => {
        expect(compressAndResizeImage).toHaveBeenCalledWith(dummyFile)
      })

      await waitFor(() => {
        expect(mockEditor.__chain.setImage).toHaveBeenCalledWith({
          src: expect.stringMatching(/^data:image\/jpeg;base64,/),
        })
      })
    })

    test('uses custom onImageUpload handler when provided', async () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      const dummyFile = new File(['fake image content'], 'test.png', {
        type: 'image/png',
      })
      const customUploadHandler = vi
        .fn()
        .mockResolvedValue('https://cdn.example.com/uploaded-image.png')

      render(
        <RichTextEditor
          value=""
          onChange={vi.fn()}
          mode="advance"
          onImageUpload={customUploadHandler}
        />,
      )

      const fileInput = screen.getByTestId('rich-text-image-input')
      fireEvent.change(fileInput, { target: { files: [dummyFile] } })

      await waitFor(() => {
        expect(customUploadHandler).toHaveBeenCalledWith(dummyFile)
      })

      await waitFor(() => {
        expect(mockEditor.__chain.setImage).toHaveBeenCalledWith({
          src: 'https://cdn.example.com/uploaded-image.png',
        })
      })
    })
  })
})
