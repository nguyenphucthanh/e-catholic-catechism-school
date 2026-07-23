import * as React from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Image as TiptapImage } from '@tiptap/extension-image'
import { Link as TiptapLink } from '@tiptap/extension-link'
import { Underline as TiptapUnderline } from '@tiptap/extension-underline'
import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  SquareCode,
  Strikethrough,
  Underline,
  Undo,
} from 'lucide-react'
import type { Content } from '@tiptap/react'
import { cn } from '~/lib/utils'
import { Toggle } from '~/components/ui/toggle'
import { Button } from '~/components/ui/button'
import { compressAndResizeImage } from '~/lib/image'

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  mode?: 'simple' | 'advance'
  editable?: boolean
  placeholder?: string
  className?: string
  onImageUpload?: (file: File) => Promise<string>
}

function parseContent(value: string): Content {
  if (!value) return ''
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function RichTextEditor({
  value,
  onChange,
  mode = 'simple',
  editable = true,
  placeholder,
  className,
  onImageUpload,
}: RichTextEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const extensions = React.useMemo(() => {
    if (mode === 'advance') {
      return [
        StarterKit,
        TiptapUnderline,
        TiptapTextAlign.configure({ types: ['heading', 'paragraph'] }),
        TiptapLink.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
        }),
        TiptapImage.configure({
          HTMLAttributes: { class: 'max-w-full h-auto rounded-md my-2' },
        }),
      ]
    }
    return [StarterKit]
  }, [mode])

  const handleImageFile = React.useCallback(
    async (file: File, currentEditor: any) => {
      if (!currentEditor) return
      try {
        const compressedFile = await compressAndResizeImage(file)
        let imageUrl = ''
        if (onImageUpload) {
          imageUrl = await onImageUpload(compressedFile)
        } else {
          imageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(compressedFile)
          })
        }
        if (imageUrl) {
          currentEditor.chain().focus().setImage({ src: imageUrl }).run()
        }
      } catch (err) {
        console.error('Failed to process image:', err)
      }
    },
    [onImageUpload],
  )

  const editorProps = React.useMemo(
    () => ({
      attributes: {
        class: 'max-w-none min-h-24 px-3 py-2 text-sm focus:outline-none',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handleDrop: (
        view: any,
        event: DragEvent,
        _slice: any,
        moved: boolean,
      ) => {
        if (mode === 'advance' && !moved && event.dataTransfer?.files.length) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            handleImageFile(file, view)
            return true
          }
        }
        return false
      },
      handlePaste: (view: any, event: ClipboardEvent) => {
        if (mode === 'advance' && event.clipboardData?.items.length) {
          const items = Array.from(event.clipboardData.items)
          for (const item of items) {
            if (item.type.indexOf('image') === 0) {
              const file = item.getAsFile()
              if (file) {
                event.preventDefault()
                handleImageFile(file, view)
                return true
              }
            }
          }
        }
        return false
      },
    }),
    [mode, placeholder, handleImageFile],
  )

  const onUpdate = React.useCallback(
    ({ editor: current }: any) => {
      onChange(JSON.stringify(current.getJSON()))
    },
    [onChange],
  )

  const editor = useEditor({
    extensions,
    content: parseContent(value),
    editable,
    editorProps,
    onUpdate,
  })

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    if (currentJson !== value) {
      editor.commands.setContent(parseContent(value), { emitUpdate: false })
    }
  }, [value, editor])

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!editor) return
    editor.setEditable(editable)
  }, [editable, editor])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageFile(file, editor)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSetLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL:')
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run()
    }
  }

  return (
    <div className={cn('rounded-md border', className)}>
      {editable && mode === 'simple' && (
        <div className="flex items-center gap-1 border-b p-1">
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <Bold className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <Italic className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('bulletList')}
            onPressedChange={() =>
              editor.chain().focus().toggleBulletList().run()
            }
            aria-label="Bullet list"
          >
            <List className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('orderedList')}
            onPressedChange={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
            aria-label="Ordered list"
          >
            <ListOrdered className="size-4" />
          </Toggle>
        </div>
      )}

      {editable && mode === 'advance' && (
        <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileInputChange}
            data-testid="rich-text-image-input"
          />

          {/* History */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="Undo"
          >
            <Undo className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="Redo"
          >
            <Redo className="size-4" />
          </Button>

          <div className="h-4 w-px bg-border my-auto mx-0.5" />

          {/* Headings */}
          <Toggle
            size="sm"
            pressed={editor.isActive('heading', { level: 1 })}
            onPressedChange={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            aria-label="Heading 1"
          >
            <Heading1 className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('heading', { level: 2 })}
            onPressedChange={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            aria-label="Heading 2"
          >
            <Heading2 className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('heading', { level: 3 })}
            onPressedChange={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            aria-label="Heading 3"
          >
            <Heading3 className="size-4" />
          </Toggle>

          <div className="h-4 w-px bg-border my-auto mx-0.5" />

          {/* Formatting */}
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <Bold className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <Italic className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('underline')}
            onPressedChange={() =>
              editor.chain().focus().toggleUnderline().run()
            }
            aria-label="Underline"
          >
            <Underline className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('strike')}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            aria-label="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('code')}
            onPressedChange={() => editor.chain().focus().toggleCode().run()}
            aria-label="Code"
          >
            <Code className="size-4" />
          </Toggle>

          <div className="h-4 w-px bg-border my-auto mx-0.5" />

          {/* Lists & Blocks */}
          <Toggle
            size="sm"
            pressed={editor.isActive('bulletList')}
            onPressedChange={() =>
              editor.chain().focus().toggleBulletList().run()
            }
            aria-label="Bullet list"
          >
            <List className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('orderedList')}
            onPressedChange={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
            aria-label="Ordered list"
          >
            <ListOrdered className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('blockquote')}
            onPressedChange={() =>
              editor.chain().focus().toggleBlockquote().run()
            }
            aria-label="Blockquote"
          >
            <Quote className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('codeBlock')}
            onPressedChange={() =>
              editor.chain().focus().toggleCodeBlock().run()
            }
            aria-label="Code block"
          >
            <SquareCode className="size-4" />
          </Toggle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            aria-label="Horizontal rule"
          >
            <Minus className="size-4" />
          </Button>

          <div className="h-4 w-px bg-border my-auto mx-0.5" />

          {/* Alignments */}
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'left' })}
            onPressedChange={() =>
              editor.chain().focus().setTextAlign('left').run()
            }
            aria-label="Align left"
          >
            <AlignLeft className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'center' })}
            onPressedChange={() =>
              editor.chain().focus().setTextAlign('center').run()
            }
            aria-label="Align center"
          >
            <AlignCenter className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'right' })}
            onPressedChange={() =>
              editor.chain().focus().setTextAlign('right').run()
            }
            aria-label="Align right"
          >
            <AlignRight className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'justify' })}
            onPressedChange={() =>
              editor.chain().focus().setTextAlign('justify').run()
            }
            aria-label="Align justify"
          >
            <AlignJustify className="size-4" />
          </Toggle>

          <div className="h-4 w-px bg-border my-auto mx-0.5" />

          {/* Links & Media */}
          <Toggle
            size="sm"
            pressed={editor.isActive('link')}
            onPressedChange={handleSetLink}
            aria-label="Link"
          >
            <LinkIcon className="size-4" />
          </Toggle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload image"
          >
            <ImageIcon className="size-4" />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} className="prose mx-auto" />
    </div>
  )
}
