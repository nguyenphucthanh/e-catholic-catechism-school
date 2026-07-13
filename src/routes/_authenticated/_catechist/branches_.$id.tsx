import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import {
  CalendarDays,
  GraduationCap,
  Network,
  SignalHigh,
  SignalLow,
  SignalMedium,
  UserRound,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { formatDate } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Badge } from '~/components/ui/badge'
import { buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute(
  '/_authenticated/_catechist/branches_/$id',
)({
  component: BranchDetailPage,
  staticData: {
    crumbs: [
      { label: 'branches.title', path: '/branches' },
      { label: 'branches.detail.title' },
    ],
  },
})

type ClassRow = {
  classId: Id<'classes'>
  className: string
  assignedCatechists: Array<{
    catechistId: Id<'catechists'>
    fullName: string
    saintName: string | undefined
    role: 'homeroom' | 'co_teacher'
  }>
  studentCount: number
}

function BranchDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branchDetail = useQuery(
    api.branches.getBranchDetail,
    requesterId && selectedYearId
      ? {
          requesterId,
          id: id as Id<'branches'>,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const today = format(new Date(), 'yyyy-MM-dd')
  const dateTo = format(addDays(new Date(), 28), 'yyyy-MM-dd')
  const branchEvents = useQuery(
    api.calendarEvents.list,
    requesterId && selectedYearId && branchDetail?.branch
      ? {
          requesterId,
          academicYearId: selectedYearId,
          dateFrom: today,
          dateTo,
        }
      : 'skip',
  )
  const branchEventsScoped = React.useMemo(
    () =>
      (branchEvents ?? [])
        .filter(
          (e) =>
            e.scope === 'branch' && e.branchId === branchDetail?.branch._id,
        )
        .slice(0, 5),
    [branchEvents, branchDetail?.branch._id],
  )

  const columns = React.useMemo<Array<ColumnDef<ClassRow>>>(
    () => [
      {
        id: 'className',
        accessorKey: 'className',
        header: t('classes.col.name'),
        cell: ({ row }) => (
          <Link
            to="/classes/$id"
            params={{ id: row.original.classId }}
            className="text-primary hover:underline font-medium"
          >
            {row.original.className}
          </Link>
        ),
      },
      {
        id: 'assignedCatechists',
        header: t('classes.col.catechists'),
        cell: ({ row }) => {
          const catechists = row.original.assignedCatechists
          if (catechists.length === 0) return '—'
          return (
            <div className="flex flex-wrap gap-1">
              {catechists.map((c) => (
                <Badge key={c.catechistId} variant="secondary">
                  {formatPersonName(c.saintName, c.fullName)}
                </Badge>
              ))}
            </div>
          )
        },
      },
      {
        id: 'studentCount',
        accessorKey: 'studentCount',
        header: t('classes.col.students'),
        cell: ({ row }) => row.original.studentCount,
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Network}
        title={branchDetail?.branch.name ?? t('branches.detail.title')}
      />

      {branchDetail === undefined ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : branchDetail === null ? (
        <Card>
          <CardContent className="text-center text-muted-foreground">
            {t('branches.detail.notFound')}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('branches.detail.statStudents')}
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {branchDetail.stats.totalStudents}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('branches.detail.statCatechists')}
                </CardTitle>
                <UserRound className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {branchDetail.stats.totalCatechists}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('branches.detail.statClasses')}
                </CardTitle>
                <GraduationCap className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {branchDetail.stats.totalClasses}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {t('branches.detail.upcomingEvents.title')}
                </CardTitle>
                <Link
                  to="/calendar-events"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {t('branches.detail.upcomingEvents.viewAll')}
                </Link>
              </CardHeader>
              <CardContent>
                {branchEvents === undefined ? (
                  <Skeleton className="h-20 w-full" />
                ) : branchEventsScoped.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('branches.detail.upcomingEvents.empty')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {branchEventsScoped.map((event) => (
                      <div
                        key={event._id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <span
                          className="inline-flex shrink-0"
                          title={t(`calendarEvents.severity.${event.severity}`)}
                        >
                          {event.severity === 'high' && (
                            <SignalHigh className="size-5 text-destructive" />
                          )}
                          {event.severity === 'medium' && (
                            <SignalMedium className="size-5 text-yellow-600 dark:text-yellow-400" />
                          )}
                          {event.severity === 'low' && (
                            <SignalLow className="size-5 text-muted-foreground" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {formatDate(event.date)}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {(() => {
                              try {
                                const doc = JSON.parse(event.description)
                                const parts: Array<string> = []
                                const walk = (node: unknown) => {
                                  if (!node || typeof node !== 'object') return
                                  const { text, content } = node as {
                                    text?: unknown
                                    content?: unknown
                                  }
                                  if (typeof text === 'string') parts.push(text)
                                  if (Array.isArray(content))
                                    content.forEach(walk)
                                }
                                walk(doc)
                                return parts.join(' ').trim()
                              } catch {
                                return event.description
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                data={branchDetail.classes}
                searchColumnKey="className"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
