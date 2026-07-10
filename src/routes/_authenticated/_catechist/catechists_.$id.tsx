import * as React from 'react'
import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Pencil, Phone, Users } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { formatPersonName } from '~/lib/name'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { ProfileAvatar } from '~/components/custom/profile-avatar'

export const Route = createFileRoute(
  '/_authenticated/_catechist/catechists_/$id',
)({
  component: CatechistDetailPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.detail.title' },
    ],
  },
})

type ContactType = 'phone' | 'email' | 'zalo' | 'other'

const CONTACT_TYPE_ICONS: Record<ContactType, React.ElementType> = {
  phone: Phone,
  email: Mail,
  zalo: MessageCircle,
  other: Users,
}

function ContactTypeIcon({ type }: { type: ContactType }) {
  const Icon = CONTACT_TYPE_ICONS[type]
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}

function CatechistDetailPage() {
  const { id } = useParams({ strict: false })
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const canManage = isAdmin(user)

  const data = useQuery(
    api.catechists.get,
    requesterId ? { requesterId, catechistId: id as Id<'catechists'> } : 'skip',
  )

  const classAssignments = useQuery(
    api.catechists.getClassAssignments,
    requesterId ? { requesterId, catechistId: id as Id<'catechists'> } : 'skip',
  )

  type AssignmentItem = NonNullable<typeof classAssignments>[number]
  const assignmentGroups: Array<{
    yearName: string
    yearId: string
    items: Array<AssignmentItem>
  }> = []
  if (classAssignments) {
    const map = new Map<
      string,
      { yearId: string; items: Array<AssignmentItem> }
    >()
    for (const a of classAssignments) {
      const group = map.get(a.academicYearName)
      if (group) {
        group.items.push(a)
      } else {
        map.set(a.academicYearName, { yearId: a.academicYearId, items: [a] })
      }
    }
    for (const [yearName, { yearId, items }] of [...map.entries()].sort(
      ([a], [b]) => b.localeCompare(a),
    )) {
      assignmentGroups.push({ yearName, yearId, items })
    }
  }

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={Users} title={t('catechists.detail.title')} />
        <p className="text-sm text-muted-foreground">
          {t('catechists.notFound')}
        </p>
      </div>
    )
  }

  const actions = canManage ? (
    <Button
      onClick={() =>
        navigate({ to: '/catechists/$id/edit', params: { id: id as string } })
      }
      variant="outline"
    >
      <Pencil className="mr-2 size-4" />
      {t('common.edit')}
    </Button>
  ) : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={
          data
            ? formatPersonName(data.saintName, data.fullName)
            : t('catechists.detail.title')
        }
        actions={actions}
      />

      {data && data === Object(data) && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <ProfileAvatar
                size="lg"
                className="size-32!"
                userType={'catechist'}
                userId={data._id}
                fullName={data.fullName}
              />
              <div>
                <h2 className="text-lg font-semibold">
                  {formatPersonName(data.saintName, data.fullName)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('catechists.col.memberId')}: {data.memberId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.fullName')}
                </p>
                <p>{formatPersonName(data.saintName, data.fullName)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.dob')}
                </p>
                <p>{data.dateOfBirth || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.gender')}
                </p>
                <p>
                  {data.gender ? (
                    <Badge variant="secondary">
                      {t(`profile.personal.gender.${data.gender}`)}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.joinedDate')}
                </p>
                <p>{data.joinedDate || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.notes')}
                </p>
                <p>{data.notes || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.title.label')}
                </p>
                <p>{data.title || t('profile.personal.title.none')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.community')}
                </p>
                <p>{data.community || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.personal.level')}
                </p>
                <p>{data.level || '-'}</p>
              </div>
              {canManage && (
                <>
                  <div className="col-span-full border-t pt-4 mt-2">
                    <p className="text-sm font-medium mb-4">
                      {t('catechists.edit.account.title')}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t('catechists.col.role')}
                        </p>
                        <Badge variant="secondary">
                          {t(`catechists.role.${data.role}`)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t('catechists.col.isActive')}
                        </p>
                        <Badge
                          variant={data.isActive ? 'default' : 'secondary'}
                        >
                          {data.isActive
                            ? t('students.status.active')
                            : t('students.status.inactive')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('catechists.edit.address.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : !data.address ? (
            <p className="text-sm text-muted-foreground">-</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.line1')}
                </p>
                <p>{data.address.addressLine1 || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.line2')}
                </p>
                <p>{data.address.addressLine2 || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.city')}
                </p>
                <p>{data.address.city || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.postal')}
                </p>
                <p>{data.address.postalCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.hamlet')}
                </p>
                <p>{data.address.hamlet || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('profile.address.subHamlet')}
                </p>
                <p>{data.address.subHamlet || '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('catechists.edit.contacts.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <Skeleton className="h-20 w-full" />
          ) : data.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('profile.contacts.empty')}
            </p>
          ) : (
            <ul className="flex flex-col">
              {data.contacts.map((contact) => (
                <li
                  key={contact._id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 [&:not(:first-child)]:border-t"
                >
                  <ContactTypeIcon type={contact.contactType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {contact.value}
                    </p>
                    {(contact.label || contact.notes) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[contact.label, contact.notes]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="secondary">
                      {t(`profile.contacts.type.${contact.contactType}`)}
                    </Badge>
                    {contact.isPrimary && (
                      <Badge>{t('profile.contacts.primary')}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('catechists.detail.classes.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {classAssignments === undefined ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : assignmentGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('catechists.detail.classes.empty')}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {assignmentGroups.map(({ yearName, items }) => (
                <div key={yearName}>
                  <p className="mb-2 text-sm font-medium">{yearName}</p>
                  <ul className="flex flex-col">
                    {items.map((assignment) => (
                      <li
                        key={assignment._id}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 not-first:border-t"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/classes/$id"
                            params={{ id: assignment.classId }}
                            className="text-sm font-medium hover:underline text-primary"
                          >
                            {assignment.className}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {assignment.branchName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            assignment.role === 'homeroom'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {t(
                            `catechists.detail.classes.role.${assignment.role}`,
                          )}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
