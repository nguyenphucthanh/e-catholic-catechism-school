import * as React from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  useMatches,
  useNavigate,
} from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Globe,
  Menu,
  SchoolIcon,
  Search,
  X,
} from 'lucide-react'
import Fuse from 'fuse.js'
import type { FuseResult } from 'fuse.js'
import type { HelpRole, SearchIndexNode } from '~/content/help/registry'
import {
  HELP_CONTENT,
  HELP_ROLES,
  ROLE_NAMES,
  extractHeadings,
  parseMarkdownToSections,
} from '~/content/help/registry'
import { setLanguage } from '~/lib/i18n'
import { useAuth } from '~/lib/auth'

export const Route = createFileRoute('/help')({
  component: HelpLayout,
})

function HelpLayout() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const matches = useMatches()

  // Detect active role from path
  const activeRoleMatch = matches.find((m) => m.routeId.includes('/help/$role'))
  const activeRole =
    (activeRoleMatch?.params as { role?: HelpRole } | undefined)?.role ||
    'student'

  const currentLang = i18n.language.startsWith('en') ? 'en-US' : 'vi-VN'

  // UI States
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<
    Array<FuseResult<SearchIndexNode>>
  >([])
  const [searchFocused, setSearchFocused] = React.useState(false)

  // Global Search Index
  const searchIndex = React.useMemo(() => {
    const index: Array<SearchIndexNode> = []
    for (const r of HELP_ROLES) {
      const mdText = HELP_CONTENT[r][currentLang]
      index.push(...parseMarkdownToSections(r, currentLang, mdText))
    }
    return index
  }, [currentLang])

  const fuse = React.useMemo(() => {
    return new Fuse(searchIndex, {
      keys: ['heading', 'content'],
      threshold: 0.35,
      ignoreLocation: true,
    })
  }, [searchIndex])

  // Handle Search Input Change
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const results = fuse.search(searchQuery)
    setSearchResults(results.slice(0, 5)) // Top 5 results
  }, [searchQuery, fuse])

  // Generate Table of Contents (TOC) from current active role's Markdown
  const tocHeadings = React.useMemo(() => {
    const mdText = HELP_CONTENT[activeRole][currentLang]
    return extractHeadings(mdText).filter((h) => h.level > 1) // Exclude H1 (page title)
  }, [activeRole, currentLang])

  // Automatic anchor scroll on route change/hash load
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const hash = window.location.hash
      if (hash) {
        const id = decodeURIComponent(hash.substring(1))
        const element = document.getElementById(id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [activeRole, matches])

  const handleSearchResultClick = (role: HelpRole, id: string) => {
    setSearchQuery('')
    setSearchFocused(false)
    void navigate({
      to: '/help/$role',
      params: { role },
      hash: id,
    })
  }

  // Close mobile drawer on route transition
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [activeRole])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/10">
      {/* Top Banner/Header for mobile */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/60 flex h-16 items-center justify-between px-4 md:px-6 lg:hidden">
        <div className="flex items-center gap-2">
          <SchoolIcon className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Trường Giáo Lý</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            Help
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-muted-foreground hover:text-foreground focus:outline-none"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 relative items-stretch">
        {/* Left Sidebar (Navigation & Search) */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-72 border-r bg-card/50 backdrop-blur-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <SchoolIcon className="h-6 w-6 text-primary" />
            <div className="flex flex-col">
              <span className="font-bold leading-none">Trường Giáo Lý</span>
              <span className="text-xs text-muted-foreground mt-1">
                Hướng Dẫn Sử Dụng
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={
                      currentLang === 'vi-VN'
                        ? 'Tìm kiếm hướng dẫn...'
                        : 'Search guides...'
                    }
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() =>
                      setTimeout(() => setSearchFocused(false), 200)
                    }
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Global Search Results Dropdown */}
                {searchFocused && searchQuery && (
                  <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    {searchResults.length > 0 ? (
                      <div className="py-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b mb-1">
                          {currentLang === 'vi-VN'
                            ? 'Kết quả tìm kiếm'
                            : 'Search Results'}
                        </div>
                        {searchResults.map(({ item }) => (
                          <button
                            key={`${item.role}-${item.id}`}
                            className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground text-sm flex flex-col gap-0.5 border-b last:border-0 transition-colors"
                            onClick={() =>
                              handleSearchResultClick(item.role, item.id)
                            }
                          >
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.2 rounded font-normal">
                                {item.roleName}
                              </span>
                              {item.heading}
                            </span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {item.content}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {currentLang === 'vi-VN'
                          ? 'Không tìm thấy kết quả nào.'
                          : 'No results found.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Roles Navigation Links */}
              <nav className="space-y-1">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {currentLang === 'vi-VN' ? 'VAI TRÒ SỬ DỤNG' : 'USER ROLES'}
                </div>
                {HELP_ROLES.map((role) => {
                  const isActive = activeRole === role
                  return (
                    <Link
                      key={role}
                      to="/help/$role"
                      params={{ role }}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group
                        ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }
                      `}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen
                          className={`h-4 w-4 ${isActive ? '' : 'text-muted-foreground group-hover:text-foreground'}`}
                        />
                        {ROLE_NAMES[role][currentLang]}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 opacity-50 ${
                          isActive
                            ? 'translate-x-0.5'
                            : 'group-hover:translate-x-0.5'
                        } transition-transform`}
                      />
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Language & Exit Panel at bottom */}
            <div className="pt-6 border-t mt-6 space-y-4">
              {/* Language Switcher */}
              <div className="flex items-center justify-between bg-accent/50 p-1.5 rounded-lg border">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-2">
                  <Globe className="h-3.5 w-3.5" />
                  Language
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLanguage('vi-VN')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      currentLang === 'vi-VN'
                        ? 'bg-background text-foreground shadow-sm border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    VI
                  </button>
                  <button
                    onClick={() => setLanguage('en-US')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      currentLang === 'en-US'
                        ? 'bg-background text-foreground shadow-sm border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>

              {/* Enter App Button */}
              <Link
                to={user ? '/dashboard' : '/login'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-card border hover:bg-accent transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {user
                  ? currentLang === 'vi-VN'
                    ? 'Vào Dashboard'
                    : 'Enter Dashboard'
                  : currentLang === 'vi-VN'
                    ? 'Đăng Nhập'
                    : 'Go to Login'}
              </Link>
            </div>
          </div>
        </aside>

        {/* Back-drop for mobile drawer */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* Dynamic Center Page Content (Markdown Document) */}
        <main
          id="help-main-content"
          className="flex-1 overflow-y-auto px-4 py-8 lg:px-12 flex justify-center"
        >
          <div className="w-full max-w-3xl min-w-0">
            <Outlet />
          </div>
        </main>

        {/* Right Sidebar: Table of Contents (Desktop only) */}
        <aside className="hidden xl:block w-64 shrink-0 border-l p-8 bg-card/10">
          <div className="sticky top-8 space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {currentLang === 'vi-VN' ? 'MỤC LỤC' : 'ON THIS PAGE'}
            </h4>
            {tocHeadings.length > 0 ? (
              <ul className="space-y-2 border-l border-muted/50 pl-0">
                {tocHeadings.map((h) => {
                  const paddingClass = h.level === 3 ? 'pl-6' : 'pl-3'
                  return (
                    <li key={h.id} className="relative">
                      <a
                        href={`#${h.id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const el = document.getElementById(h.id)
                          if (el) {
                            el.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                            window.history.pushState(null, '', `#${h.id}`)
                          }
                        }}
                        className={`
                          block text-sm text-muted-foreground hover:text-foreground transition-colors border-l-2 -ml-[1px] border-transparent hover:border-primary py-0.5
                          ${paddingClass}
                        `}
                      >
                        {h.text}
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {currentLang === 'vi-VN'
                  ? 'Không có đề mục phụ.'
                  : 'No subheadings found.'}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
