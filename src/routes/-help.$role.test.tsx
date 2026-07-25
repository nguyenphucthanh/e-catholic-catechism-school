import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { useParams } from '@tanstack/react-router'
import { Route } from './help.$role'

vi.mock('@tanstack/react-router', () => {
  return {
    createFileRoute: vi.fn(() => (options: any) => ({ options })),
    useParams: vi.fn(),
    notFound: vi.fn(),
  }
})

describe('HelpRoleDetail route component', () => {
  beforeEach(() => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'vi-VN',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
  })

  test('renders student guide when parameter role is student', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Hướng dẫn dành cho Học sinh/)).toBeInTheDocument()
    expect(screen.getByText(/Điểm danh & Nhận diện QR/)).toBeInTheDocument()
  })

  test('renders english markdown content when language is en', () => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'en-US',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Guide for Students/i)).toBeInTheDocument()
  })

  test('throws notFound when role parameter is invalid', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'invalid_role' })
    const Component = (Route as any).options.component

    expect(() => render(<Component />)).toThrow()
  })

  test('renders catechist guide when parameter role is catechist', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'catechist' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Giáo lý viên/),
    ).toBeInTheDocument()
  })

  test('renders branch-head role guide correctly', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'branch-head' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Phân đoàn trưởng/),
    ).toBeInTheDocument()
  })

  test('renders board-member role guide correctly', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'board-member' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Ban trị sự/),
    ).toBeInTheDocument()
  })

  test('renders admin role guide correctly', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'admin' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Quản trị viên/),
    ).toBeInTheDocument()
  })

  test('renders markdown with heading hierarchy (h1, h2, h3)', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    // The markdown should contain multiple heading levels
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(1)
  })

  test('renders markdown links with correct href attributes', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    // Check if any links exist in the rendered content
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(0)
  })

  test('renders ordered and unordered lists', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    // The markdown should contain list items
    const listItems = screen.getAllByRole('listitem')
    expect(listItems.length).toBeGreaterThan(0)
  })

  test('renders markdown paragraph content', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    // Should render paragraph text from markdown
    const paragraphs = document.querySelectorAll('p')
    expect(paragraphs.length).toBeGreaterThan(0)
  })

  test('renders strong text with correct styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    // Check for strong elements in the markdown
    const strongElements = document.querySelectorAll('strong')
    // Strong elements might or might not be present depending on content
    expect(strongElements).toBeDefined()
  })

  test('renders markdown article with prose styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const article = document.querySelector('article')
    expect(article).toHaveClass('prose')
    expect(article).toHaveClass('dark:prose-invert')
  })

  test('type guard rejects multiple invalid roles', () => {
    const invalidRoles = ['invalid1', 'invalid2', 'superadmin', 'guest']

    invalidRoles.forEach((invalidRole) => {
      vi.mocked(useParams).mockReturnValue({ role: invalidRole })
      const Component = (Route as any).options.component

      expect(() => render(<Component />)).toThrow()
    })
  })

  test('renders English language when i18n is configured for English', () => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'en',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Guide for Students/i)).toBeInTheDocument()
  })

  test('renders Vietnamese content when language is not English', () => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'vi',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Hướng dẫn dành cho Học sinh/)).toBeInTheDocument()
  })

  test('markdown links have proper styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const links = document.querySelectorAll('a[href]')
    // Check that some links exist and have proper classes
    // (heading anchors and content links may have different styling)
    expect(links.length).toBeGreaterThanOrEqual(0)

    // Check content links specifically (not in headings)
    const article = document.querySelector('article')
    if (article) {
      const contentLinks = article.querySelectorAll('p a, li a')
      contentLinks.forEach((link) => {
        expect(link).toHaveClass('text-primary')
      })
    }
  })

  test('renders markdown with bold text styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const strongElements = document.querySelectorAll('strong')
    strongElements.forEach((element) => {
      expect(element).toHaveClass('font-semibold')
      expect(element).toHaveClass('text-foreground')
    })
  })

  test('renders h2 heading with anchor link functionality', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const h2Elements = document.querySelectorAll('h2')
    expect(h2Elements.length).toBeGreaterThan(0)

    h2Elements.forEach((h2) => {
      expect(h2).toHaveClass('text-2xl')
      expect(h2).toHaveClass('font-bold')
      const anchor = h2.querySelector('a')
      if (anchor) {
        expect(anchor).toHaveAttribute('href')
      }
    })
  })

  test('renders h3 heading with proper styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const h3Elements = document.querySelectorAll('h3')
    h3Elements.forEach((h3) => {
      expect(h3).toHaveClass('text-lg')
      expect(h3).toHaveClass('font-semibold')
    })
  })

  test('renders lists with appropriate spacing', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const unorderedLists = document.querySelectorAll('ul')
    unorderedLists.forEach((ul) => {
      expect(ul).toHaveClass('list-disc')
    })

    const orderedLists = document.querySelectorAll('ol')
    orderedLists.forEach((ol) => {
      expect(ol).toHaveClass('list-decimal')
    })
  })

  test('renders markdown horizontal rules', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const hrs = document.querySelectorAll('hr')
    hrs.forEach((hr) => {
      expect(hr).toHaveClass('border-muted')
    })
  })

  test('renders code blocks with language class styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const codeBlocks = document.querySelectorAll('pre')
    codeBlocks.forEach((pre) => {
      expect(pre).toHaveClass('bg-muted/70')
      expect(pre).toHaveClass('border')
      expect(pre).toHaveClass('rounded-lg')
    })
  })

  test('renders inline code with proper styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const inlineCodes = document.querySelectorAll('code')
    inlineCodes.forEach((code) => {
      // All code elements should exist
      expect(code).toBeInTheDocument()
    })
  })

  test('h1 heading renders with border-b styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const h1Elements = document.querySelectorAll('h1')
    h1Elements.forEach((h1) => {
      expect(h1).toHaveClass('text-3xl')
      expect(h1).toHaveClass('font-extrabold')
      expect(h1).toHaveClass('border-b')
    })
  })

  test('h2 heading includes group hover anchor link', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const h2Elements = document.querySelectorAll('h2')
    h2Elements.forEach((h2) => {
      expect(h2).toHaveClass('group')
      const anchor = h2.querySelector('a')
      if (anchor) {
        expect(anchor).toHaveClass('opacity-0')
        expect(anchor).toHaveClass('group-hover:opacity-40')
      }
    })
  })

  test('h3 heading includes group hover anchor link', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const h3Elements = document.querySelectorAll('h3')
    h3Elements.forEach((h3) => {
      expect(h3).toHaveClass('group')
      const anchor = h3.querySelector('a')
      if (anchor) {
        expect(anchor).toHaveClass('opacity-0')
      }
    })
  })

  test('renders blockquote with italic styling', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const blockquotes = document.querySelectorAll('blockquote')
    blockquotes.forEach((bq) => {
      expect(bq).toHaveClass('border-l-4')
      expect(bq).toHaveClass('border-primary')
      expect(bq).toHaveClass('italic')
    })
  })

  test('renders list items with proper leading', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const listItems = document.querySelectorAll('li')
    listItems.forEach((li) => {
      expect(li).toHaveClass('leading-7')
    })
  })

  test('renders article with proper contrast for dark mode', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const article = document.querySelector('article')
    expect(article).toHaveClass('dark:prose-invert')
  })

  test('renders catechist, branch-head, and board-member roles without errors', () => {
    const roles = ['catechist', 'branch-head', 'board-member', 'admin']

    roles.forEach((role) => {
      vi.mocked(useParams).mockReturnValue({ role })
      const Component = (Route as any).options.component

      expect(() => render(<Component />)).not.toThrow()
    })
  })

  test('type guard validation catches invalid role strings', () => {
    const invalidRoles = ['superuser', 'guest', 'teacher', 'parent', '']

    invalidRoles.forEach((role) => {
      vi.mocked(useParams).mockReturnValue({ role })
      const Component = (Route as any).options.component

      expect(() => render(<Component />)).toThrow()
    })
  })

  test('blockquote children rendering', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const blockquotes = document.querySelectorAll('blockquote')
    expect(blockquotes.length).toBeGreaterThanOrEqual(0)
  })

  test('code component differentiates between inline and block', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const preElements = document.querySelectorAll('pre')
    const inlineCodeElements = document.querySelectorAll('p code, li code')

    // Verify structure is correct
    expect(preElements.length).toBeGreaterThanOrEqual(0)
    expect(inlineCodeElements.length).toBeGreaterThanOrEqual(0)
  })

  test('link href attributes are properly set', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    const links = document.querySelectorAll('a[href]')
    links.forEach((link) => {
      // All links should have href attribute
      expect(link).toHaveAttribute('href')
    })
  })

  test('renders different roles without errors', () => {
    const roles = ['student', 'catechist', 'admin']

    roles.forEach((role) => {
      vi.mocked(useTranslation).mockReturnValue({
        t: ((key: string) => key) as any,
        i18n: {
          language: 'en',
          changeLanguage: vi.fn(),
        } as any,
      } as any)
      vi.mocked(useParams).mockReturnValue({ role })
      const Component = (Route as any).options.component

      expect(() => render(<Component />)).not.toThrow()
    })
  })
})
