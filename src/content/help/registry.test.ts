import { describe, expect, it } from 'vitest'
import { extractHeadings, parseMarkdownToSections, slugify } from './registry'

describe('Help Registry Helpers', () => {
  describe('slugify', () => {
    it('should convert to lowercase, remove accents, and replace spaces with dashes', () => {
      expect(slugify('Điểm danh bằng mã QR')).toBe('diem-danh-bang-ma-qr')
      expect(slugify('Giáo Lý Viên')).toBe('giao-ly-vien')
      expect(slugify('Admin Guide')).toBe('admin-guide')
    })

    it('should strip special characters', () => {
      expect(slugify('Hello @ World!!!')).toBe('hello-world')
      expect(slugify('Help & Support')).toBe('help-support')
    })

    it('should collapse multiple spaces/dashes', () => {
      expect(slugify('a  b---c')).toBe('a-b-c')
    })
  })

  describe('extractHeadings', () => {
    it('should correctly extract headings levels and texts with slugified ids', () => {
      const markdown = `
# Title Heading
Intro text here
## Section One
Some more text
### Subsection A
Even more text
`
      const headings = extractHeadings(markdown)
      expect(headings).toHaveLength(3)
      expect(headings[0]).toEqual({
        level: 1,
        text: 'Title Heading',
        id: 'title-heading',
      })
      expect(headings[1]).toEqual({
        level: 2,
        text: 'Section One',
        id: 'section-one',
      })
      expect(headings[2]).toEqual({
        level: 3,
        text: 'Subsection A',
        id: 'subsection-a',
      })
    })

    it('should return an empty array if no headings are present', () => {
      const markdown = 'Just normal paragraph text with no hash symbols.'
      expect(extractHeadings(markdown)).toEqual([])
    })
  })

  describe('parseMarkdownToSections', () => {
    it('should split markdown content into searchable section chunks', () => {
      const markdown = `
# Student Manual
Introduction text here.
## Scanning QR
Use your camera to scan.
`
      const sections = parseMarkdownToSections('student', 'vi-VN', markdown)
      expect(sections.length).toBeGreaterThanOrEqual(1)

      const qrSection = sections.find((s) => s.id === 'scanning-qr')
      expect(qrSection).toBeDefined()
      expect(qrSection?.heading).toBe('Scanning QR')
      expect(qrSection?.content).toContain('Use your camera to scan.')
    })

    it('should handle markdown with no headings by using role name as heading', () => {
      const markdown = 'Just some text with no hashes.'
      const sections = parseMarkdownToSections('student', 'vi-VN', markdown)
      expect(sections).toHaveLength(1)
      expect(sections[0].heading).toBe('Học sinh (Thiếu nhi)')
      expect(sections[0].content).toBe('Just some text with no hashes.')
      expect(sections[0].id).toBe('')
    })

    it('should handle empty markdown by returning no sections', () => {
      const sections = parseMarkdownToSections('student', 'vi-VN', '')
      expect(sections).toHaveLength(0)
    })
  })
})
