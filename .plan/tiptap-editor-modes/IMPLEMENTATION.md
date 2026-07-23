# IMPLEMENTATION: Tiptap Editor Modes (Simple / Advance) & Image Upload with Auto Compression

## 1. Summary of Changes
- Updated `RichTextEditor` component (`src/components/custom/richtext-editor.tsx`) to support `mode?: 'simple' | 'advance'` prop (defaulting to `'simple'`).
- Installed Tiptap extension packages: `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`.
- Added rich text toolbar items in `'advance'` mode:
  - History: Undo, Redo
  - Headings: H1, H2, H3
  - Formatting: Bold, Italic, Underline, Strikethrough, Code
  - Lists & Structure: Bullet List, Ordered List, Blockquote, Code block, Horizontal Rule
  - Alignment: Left, Center, Right, Justify
  - Media & Links: Link dialog, Image Upload
- Integrated automatic client-side image compression using `compressAndResizeImage` from `src/lib/image.ts` when uploading via toolbar image button, dropping images, or pasting images.
- Supported optional `onImageUpload` prop for custom cloud/backend image handlers, with fallback to compressed Base64 Data URL.
- Updated and expanded unit tests in `src/components/custom/richtext-editor.test.tsx`.

## 2. Modified Files
- `package.json` & `package-lock.json`: Added `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`.
- [src/components/custom/richtext-editor.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/custom/richtext-editor.tsx)
- [src/components/custom/richtext-editor.test.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/custom/richtext-editor.test.tsx)

## 3. Verification & Test Results
- `npm run typecheck`: Passed with 0 errors.
- `npm run test`: Passed all 186 unit tests across 29 test files.
- `src/components/custom/richtext-editor.test.tsx`: 8/8 tests passed covering simple mode, advance mode, toolbar commands, and image compression + upload.
