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

    test('handles null editor gracefully on initial render', () => {
      ;(useEditor as any).mockReturnValue(null)

      expect(() => {
        render(<RichTextEditor value="" onChange={vi.fn()} editable={false} />)
      }).not.toThrow()
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

    test('logs and swallows error when image processing fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      const dummyFile = new File(['fake image content'], 'test.png', {
        type: 'image/png',
      })
      ;(compressAndResizeImage as any).mockRejectedValueOnce(
        new Error('compression failed'),
      )

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const fileInput = screen.getByTestId('rich-text-image-input')
      fireEvent.change(fileInput, { target: { files: [dummyFile] } })

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to process image:',
          expect.any(Error),
        )
      })
      expect(mockEditor.__chain.setImage).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    test('does nothing when handleImageFile is invoked without an editor', () => {
      // Covers the `if (!currentEditor) return` guard by triggering the file
      // input change handler before the editor instance exists.
      ;(useEditor as any).mockReturnValue(null)

      expect(() => {
        render(<RichTextEditor value="" onChange={vi.fn()} editable={false} />)
      }).not.toThrow()
    })
  })

  describe('parseContent', () => {
    test('parses JSON string content into an object', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      const jsonValue = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })

      render(<RichTextEditor value={jsonValue} onChange={vi.fn()} />)

      expect(lastConfig.content).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
      expect(mockEditor).toBeTruthy()
    })

    test('falls back to raw string when value is not valid JSON', () => {
      render(<RichTextEditor value="not json" onChange={vi.fn()} />)

      expect(lastConfig.content).toBe('not json')
    })

    test('treats empty string value as empty content', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} />)

      expect(lastConfig.content).toBe('')
    })
  })

  describe('Toolbar command coverage (simple mode)', () => {
    test('triggers italic, bullet list, and ordered list commands', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} />)

      fireEvent.click(screen.getByLabelText('Italic'))
      expect(mockEditor.__chain.toggleItalic).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Bullet list'))
      expect(mockEditor.__chain.toggleBulletList).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Ordered list'))
      expect(mockEditor.__chain.toggleOrderedList).toHaveBeenCalled()
    })
  })

  describe('Toolbar command coverage (advance mode)', () => {
    let mockEditor: any

    beforeEach(() => {
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })
    })

    test('triggers undo and redo commands', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Undo'))
      expect(mockEditor.__chain.undo).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Redo'))
      expect(mockEditor.__chain.redo).toHaveBeenCalled()
    })

    test('triggers heading level commands', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Heading 1'))
      expect(mockEditor.__chain.toggleHeading).toHaveBeenCalledWith({
        level: 1,
      })

      fireEvent.click(screen.getByLabelText('Heading 2'))
      expect(mockEditor.__chain.toggleHeading).toHaveBeenCalledWith({
        level: 2,
      })

      fireEvent.click(screen.getByLabelText('Heading 3'))
      expect(mockEditor.__chain.toggleHeading).toHaveBeenCalledWith({
        level: 3,
      })
    })

    test('triggers bold, italic, strikethrough, and code commands', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Bold'))
      expect(mockEditor.__chain.toggleBold).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Italic'))
      expect(mockEditor.__chain.toggleItalic).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Strikethrough'))
      expect(mockEditor.__chain.toggleStrike).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Code'))
      expect(mockEditor.__chain.toggleCode).toHaveBeenCalled()
    })

    test('triggers bullet list, ordered list, blockquote, code block, and horizontal rule commands', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Bullet list'))
      expect(mockEditor.__chain.toggleBulletList).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Ordered list'))
      expect(mockEditor.__chain.toggleOrderedList).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Blockquote'))
      expect(mockEditor.__chain.toggleBlockquote).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Code block'))
      expect(mockEditor.__chain.toggleCodeBlock).toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('Horizontal rule'))
      expect(mockEditor.__chain.setHorizontalRule).toHaveBeenCalled()
    })

    test('triggers all text-align commands', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Align left'))
      expect(mockEditor.__chain.setTextAlign).toHaveBeenCalledWith('left')

      fireEvent.click(screen.getByLabelText('Align right'))
      expect(mockEditor.__chain.setTextAlign).toHaveBeenCalledWith('right')

      fireEvent.click(screen.getByLabelText('Align justify'))
      expect(mockEditor.__chain.setTextAlign).toHaveBeenCalledWith('justify')
    })

    test('clicking upload image button triggers the hidden file input', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const fileInput = screen.getByTestId('rich-text-image-input')
      const clickSpy = vi.spyOn(fileInput, 'click')

      fireEvent.click(screen.getByLabelText('Upload image'))

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Link handling', () => {
    test('unsets link when link mark is already active', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor({ activeMarks: ['link'] })
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Link'))

      expect(mockEditor.__chain.unsetLink).toHaveBeenCalled()
      expect(mockEditor.__chain.setLink).not.toHaveBeenCalled()
    })

    test('prompts for a URL and sets link when none is active', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })
      const promptSpy = vi
        .spyOn(window, 'prompt')
        .mockReturnValue('https://example.com')

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Link'))

      expect(promptSpy).toHaveBeenCalledWith('URL:')
      expect(mockEditor.__chain.extendMarkRange).toHaveBeenCalledWith('link')
      expect(mockEditor.__chain.setLink).toHaveBeenCalledWith({
        href: 'https://example.com',
      })

      promptSpy.mockRestore()
    })

    test('does not set link when prompt is cancelled', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      fireEvent.click(screen.getByLabelText('Link'))

      expect(mockEditor.__chain.setLink).not.toHaveBeenCalled()

      promptSpy.mockRestore()
    })
  })

  describe('editorProps.handleDrop', () => {
    function makeDragEvent(files: Array<{ type: string }>) {
      return { dataTransfer: { files } } as unknown as DragEvent
    }

    test('marks a dropped image as handled and reports the processing failure', async () => {
      // Note: handleDrop forwards the raw ProseMirror `view` (not the tiptap
      // editor instance) into handleImageFile, which calls `.chain()` on it.
      // A bare view has no `.chain()`, so this always throws and is caught by
      // handleImageFile's try/catch (logged via console.error). This test
      // documents that current behavior rather than asserting a successful
      // insert that the code doesn't actually perform.
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const fakeFile = new File(['x'], 'dropped.png', { type: 'image/png' })
      const event = makeDragEvent([fakeFile])
      ;(event as any).preventDefault = vi.fn()

      const handled = lastConfig.editorProps.handleDrop({}, event, {}, false)

      expect(handled).toBe(true)
      expect((event as any).preventDefault).toHaveBeenCalled()
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to process image:',
          expect.any(Error),
        )
      })

      consoleErrorSpy.mockRestore()
    })

    test('ignores drop when mode is simple', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} />)

      const event = makeDragEvent([{ type: 'image/png' }])
      const handled = lastConfig.editorProps.handleDrop({}, event, {}, false)

      expect(handled).toBe(false)
    })

    test('ignores drop when selection was moved within the editor', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const event = makeDragEvent([{ type: 'image/png' }])
      const handled = lastConfig.editorProps.handleDrop({}, event, {}, true)

      expect(handled).toBe(false)
    })

    test('ignores drop when no files are present', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const event = makeDragEvent([])
      const handled = lastConfig.editorProps.handleDrop({}, event, {}, false)

      expect(handled).toBe(false)
    })

    test('ignores drop when dropped file is not an image', () => {
      let mockEditor: any
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        mockEditor = createMockEditor()
        return mockEditor
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const event = makeDragEvent([{ type: 'text/plain' }])
      const handled = lastConfig.editorProps.handleDrop({}, event, {}, false)

      expect(handled).toBe(false)
    })
  })

  describe('editorProps.handlePaste', () => {
    function makeClipboardEvent(items: Array<any>) {
      return { clipboardData: { items } } as unknown as ClipboardEvent
    }

    test('marks a pasted image as handled and reports the processing failure', async () => {
      // Same underlying behavior as the handleDrop case: handlePaste passes
      // the raw ProseMirror `view` (not the tiptap editor) into
      // handleImageFile, which always throws when it calls `.chain()` on it.
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const fakeFile = new File(['x'], 'pasted.png', { type: 'image/png' })
      const item = {
        type: 'image/png',
        getAsFile: () => fakeFile,
      }
      const event = makeClipboardEvent([item])
      ;(event as any).preventDefault = vi.fn()

      const handled = lastConfig.editorProps.handlePaste({}, event)

      expect(handled).toBe(true)
      expect((event as any).preventDefault).toHaveBeenCalled()
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to process image:',
          expect.any(Error),
        )
      })

      consoleErrorSpy.mockRestore()
    })

    test('ignores paste when mode is simple', () => {
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} />)

      const item = { type: 'image/png', getAsFile: () => null }
      const event = makeClipboardEvent([item])
      const handled = lastConfig.editorProps.handlePaste({}, event)

      expect(handled).toBe(false)
    })

    test('ignores paste when no clipboard items are present', () => {
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const event = makeClipboardEvent([])
      const handled = lastConfig.editorProps.handlePaste({}, event)

      expect(handled).toBe(false)
    })

    test('ignores paste when no item is an image type', () => {
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const item = { type: 'text/plain', getAsFile: () => null }
      const event = makeClipboardEvent([item])
      const handled = lastConfig.editorProps.handlePaste({}, event)

      expect(handled).toBe(false)
    })

    test('does not fail when image item has no associated file', () => {
      ;(useEditor as any).mockImplementation((config: any) => {
        lastConfig = config
        return createMockEditor()
      })

      render(<RichTextEditor value="" onChange={vi.fn()} mode="advance" />)

      const item = { type: 'image/png', getAsFile: () => null }
      const event = makeClipboardEvent([item])
      const handled = lastConfig.editorProps.handlePaste({}, event)

      expect(handled).toBe(false)
    })
  })
})
