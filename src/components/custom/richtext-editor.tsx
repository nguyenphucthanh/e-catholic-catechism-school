import * as React from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import type { Content } from '@tiptap/react'
import { cn } from '~/lib/utils'
import { Toggle } from '~/components/ui/toggle'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  editable?: boolean
  placeholder?: string
  className?: string
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
  editable = true,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseContent(value),
    editable,
    editorProps: {
      attributes: {
        class: 'max-w-none min-h-24 px-3 py-2 text-sm focus:outline-none',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(JSON.stringify(current.getJSON()))
    },
  })

  React.useEffect(() => {
    const currentJson = JSON.stringify(editor.getJSON())
    if (currentJson !== value) {
      editor.commands.setContent(parseContent(value), { emitUpdate: false })
    }
  }, [value, editor])

  React.useEffect(() => {
    editor.setEditable(editable)
  }, [editable, editor])

  return (
    <div className={cn('rounded-md border bg-background', className)}>
      {editable && (
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
      <EditorContent editor={editor} />
    </div>
  )
}
