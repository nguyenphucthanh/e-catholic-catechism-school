import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Network, UserRound, Users } from 'lucide-react'
import * as React from 'react'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Badge } from '~/components/ui/badge'
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
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : branchDetail === null ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t('branches.detail.notFound')}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
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
