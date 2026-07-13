import { createFileRoute, notFound, useParams } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import type { HelpRole } from '~/content/help/registry'
import { HELP_CONTENT, HELP_ROLES, slugify } from '~/content/help/registry'

export const Route = createFileRoute('/help/$role')({
  component: HelpRoleDetail,
})

function HelpRoleDetail() {
  const { role } = useParams({ from: '/help/$role' })
  const { i18n } = useTranslation()

  const isHelpRole = (r: string): r is HelpRole => {
    return (HELP_ROLES as ReadonlyArray<string>).includes(r)
  }

  // Validate parameter
  if (!isHelpRole(role)) {
    throw notFound()
  }

  const currentLang = i18n.language.startsWith('en') ? 'en-US' : 'vi-VN'
  const markdownText = HELP_CONTENT[role][currentLang]

  return (
    <article className="prose dark:prose-invert max-w-none pb-16">
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => {
            const text =
              typeof children === 'string' ? children : String(children)
            const id = slugify(text)
            return (
              <h1
                id={id}
                className="text-3xl font-extrabold text-foreground mb-6 pb-4 border-b tracking-tight mt-0"
                {...props}
              >
                {children}
              </h1>
            )
          },
          h2: ({ children, ...props }) => {
            const text =
              typeof children === 'string' ? children : String(children)
            const id = slugify(text)
            return (
              <h2
                id={id}
                className="text-2xl font-bold text-foreground mt-10 mb-4 border-b border-muted pb-2 tracking-tight group flex items-center gap-2"
                {...props}
              >
                {children}
                <a
                  href={`#${id}`}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-xs transition-opacity font-normal text-muted-foreground ml-1"
                  title="Anchor link"
                >
                  #
                </a>
              </h2>
            )
          },
          h3: ({ children, ...props }) => {
            const text =
              typeof children === 'string' ? children : String(children)
            const id = slugify(text)
            return (
              <h3
                id={id}
                className="text-lg font-semibold text-foreground mt-6 mb-3 tracking-tight group flex items-center gap-2"
                {...props}
              >
                {children}
                <a
                  href={`#${id}`}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-xs transition-opacity font-normal text-muted-foreground ml-1"
                  title="Anchor link"
                >
                  #
                </a>
              </h3>
            )
          },
          p: ({ children, ...props }) => (
            <p
              className="text-muted-foreground leading-7 mb-4 text-sm md:text-base"
              {...props}
            >
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul
              className="list-disc list-inside space-y-2 mb-6 pl-4 text-muted-foreground text-sm md:text-base"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="list-decimal list-inside space-y-2 mb-6 pl-4 text-muted-foreground text-sm md:text-base"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-7" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-primary bg-muted/40 p-4 rounded-r-lg italic my-6 text-muted-foreground [&>p]:mb-0 text-sm md:text-base"
              {...props}
            >
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground border"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <pre className="bg-muted/70 border rounded-lg p-4 overflow-x-auto my-6 font-mono text-xs md:text-sm text-foreground">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          hr: ({ ...props }) => <hr className="my-8 border-muted" {...props} />,
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>
              {children}
            </strong>
          ),
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              className="text-primary hover:underline font-medium"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {markdownText}
      </ReactMarkdown>
    </article>
  )
}
