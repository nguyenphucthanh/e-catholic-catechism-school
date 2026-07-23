# PLAN: Tiptap Editor Modes (Simple / Advance) & Image Upload with Auto Compression

## 1. Goal Overview
Enhance the `RichTextEditor` component in `src/components/custom/richtext-editor.tsx` by adding a `mode` prop (`'simple' | 'advance'`) defaulting to `'simple'`.
In `'advance'` mode, the editor will provide rich text formatting utilities (headings, blockquotes, code blocks, links, text alignment, horizontal rules, undo/redo, image uploading) and support image insertion with automatic client-side compression.

## 2. Scope & Key Requirements

### 2.1 Component Props API
- `mode?: 'simple' | 'advance'` (default: `'simple'`)
- `onImageUpload?: (file: File) => Promise<string>` (optional custom upload handler returning image URL; falls back to compressed Base64 Data URL)
- Existing props preserved: `value: string`, `onChange: (value: string) => void`, `editable?: boolean` (default `true`), `placeholder?: string`, `className?: string`.

### 2.2 'simple' Mode (Default)
- Toolbar controls: Bold, Italic, Bullet List, Ordered List.
- Clean, compact toolbar suitable for short description fields (e.g. event descriptions, quick notes).

### 2.3 'advance' Mode
- Expanded toolbar with rich text capabilities:
  - Formatting: Bold, Italic, Underline, Strikethrough, Code.
  - Headings: H1, H2, H3 (or Heading select dropdown/toggles).
  - Lists & Blocks: Bullet List, Ordered List, Blockquote, Code Block, Horizontal Rule (`<hr>`).
  - Alignment: Left, Center, Right, Justify.
  - Media & Links: Link dialog/prompt, Image Upload button (with file input).
  - History: Undo, Redo.
- Tiptap Extensions required:
  - `@tiptap/starter-kit` (already installed - includes Bold, Italic, BulletList, OrderedList, Heading, Blockquote, CodeBlock, HorizontalRule, History).
  - `@tiptap/extension-image` (to be installed).
  - `@tiptap/extension-link` (to be installed).
  - `@tiptap/extension-underline` (to be installed).
  - `@tiptap/extension-text-align` (to be installed).

### 2.4 Image Upload & Compression
- When an image is selected via the toolbar button or dropped into the editor:
  1. Process the `File` object through `compressAndResizeImage(file)` (`src/lib/image.ts`).
  2. If `onImageUpload` prop is provided, call `onImageUpload(compressedFile)` to get the uploaded URL.
  3. Otherwise, convert `compressedFile` to a compressed Data URL (`FileReader.readAsDataURL`).
  4. Insert the image into the editor (`editor.chain().focus().setImage({ src: url }).run()`).

## 3. Success Criteria
- [ ] `RichTextEditor` defaults to `'simple'` mode without breaking any existing usage or test cases.
- [ ] Passing `mode="advance"` renders the expanded rich text toolbar with all advanced options.
- [ ] Image upload tool compresses images via `compressAndResizeImage` before inserting into editor.
- [ ] Unit tests in `src/components/custom/richtext-editor.test.tsx` cover both `simple` and `advance` modes and image upload functionality.
- [ ] `npm run typecheck` and `npm run test` pass with 0 errors.
