import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Share2 } from 'lucide-react'
import { Button } from '~/components/ui/button'

export interface ProgramLink {
  type: 'social' | 'im'
  label: string
  url: string
  forEnrolledOnly: boolean
}

interface ProgramLinksListProps {
  links: Array<ProgramLink> | undefined
  userEnrolled: boolean
}

const LINK_TYPE_ICONS: Record<ProgramLink['type'], React.ElementType> = {
  social: Share2,
  im: MessageCircle,
}

export function ProgramLinksList({
  links,
  userEnrolled,
}: ProgramLinksListProps) {
  const { t } = useTranslation()
  const visibleLinks = (links ?? []).filter(
    (link) => !link.forEnrolledOnly || userEnrolled,
  )

  if (visibleLinks.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {t('extracurricular.links')}
      </p>
      <div className="flex flex-wrap gap-2">
        {visibleLinks.map((link, index) => {
          const Icon = LINK_TYPE_ICONS[link.type]
          return (
            <Button
              key={`${link.url}-${index}`}
              type="button"
              variant="outline"
              size="sm"
              render={<a href={link.url} target="_blank" rel="noreferrer" />}
            >
              <Icon className="mr-1 size-4" />
              {link.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
