import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { translateConvexError } from '~/lib/convex-errors'
import { formatCurrency, formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { useManagementPermission } from '~/hooks/use-management-permission'

export const Route = createFileRoute(
  '/_authenticated/_catechist/extracurricular-programs',
)({
  component: ExtracurricularProgramsPage,
  staticData: {
    crumbs: [{ label: 'extracurricular.title' }],
  },
})

interface ProgramRow {
  _id: Id<'extracurricularPrograms'>
  title: string
  dateStart: string
  dateEnd: string
  target: string
  feeRequired: boolean
  feeAmount?: number
  maxCapacity?: number
  enrollmentCount: number
  status: 'upcoming' | 'active' | 'past'
}

function getStatus(
  dateStart: string,
  dateEnd: string,
): 'upcoming' | 'active' | 'past' {
  const today = new Date().toISOString().split('T')[0]
  if (dateStart > today) return 'upcoming'
  if (dateEnd < today) return 'past'
  return 'active'
}

function ExtracurricularProgramsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canManage, isLoading } = useManagementPermission()
  const [deleteId, setDeleteId] =
    React.useState<Id<'extracurricularPrograms'> | null>(null)

  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const { selectedYearId } = useSelectedAcademicYear()
  const activeAcademicYear = useQuery(
    api.academicYears.getActive,
    requesterId && !selectedYearId ? { requesterId } : 'skip',
  )

  const academicYearId = selectedYearId || activeAcademicYear?._id

  const programs = useQuery(
    api.extracurricularPrograms.listPrograms,
    requesterId && academicYearId
      ? {
          academicYearId,
          requesterId,
        }
      : 'skip',
  )

  const deleteProgram = useMutation(api.extracurricularPrograms.deleteProgram)

  if (isLoading) return null

  const handleDelete = async () => {
    if (!deleteId || !requesterId) return
    try {
      await deleteProgram({
        programId: deleteId,
        requesterId,
      })
      toast.success(t('common.deleted'))
      setDeleteId(null)
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }

  const columns: Array<ColumnDef<ProgramRow>> = [
    {
      accessorKey: 'title',
      header: () => t('extracurricular.title'),
      cell: ({ row }) => (
        <Link
          to="/extracurricular-programs/$id"
          params={{ id: row.original._id }}
          className="text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'dateStart',
      header: () => t('extracurricular.dateStart'),
      cell: ({ row }) => formatDate(row.original.dateStart),
    },
    {
      accessorKey: 'dateEnd',
      header: () => t('extracurricular.dateEnd'),
      cell: ({ row }) => formatDate(row.original.dateEnd),
    },
    {
      accessorKey: 'target',
      header: () => t('extracurricular.target'),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {t(`extracurricular.target.${row.original.target}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'feeRequired',
      header: () => t('extracurricular.fee'),
      cell: ({ row }) =>
        row.original.feeRequired
          ? `${t('common.yes')}: ${formatCurrency(row.original.feeAmount || 0)}`
          : t('common.no'),
    },
    {
      accessorKey: 'enrollmentCount',
      header: () => t('extracurricular.enrollment'),
      cell: ({ row }) =>
        row.original.maxCapacity
          ? `${row.original.enrollmentCount}/${row.original.maxCapacity}`
          : row.original.enrollmentCount,
    },
    {
      accessorKey: 'status',
      header: () => t('extracurricular.status'),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'active'
              ? 'default'
              : row.original.status === 'upcoming'
                ? 'secondary'
                : 'outline'
          }
        >
          {t(`extracurricular.status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                navigate({
                  to: '/extracurricular-programs/$id',
                  params: { id: row.original._id },
                })
              }
            >
              {t('common.view')}
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    navigate({
                      to: '/extracurricular-programs/$id/edit',
                      params: { id: row.original._id },
                    })
                  }
                >
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(row.original._id)}
                  className="text-red-600"
                >
                  {t('common.delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const rows: Array<ProgramRow> = (programs ?? []).map((p) => ({
    _id: p._id,
    title: p.title,
    dateStart: p.dateStart,
    dateEnd: p.dateEnd,
    target: p.target,
    feeRequired: p.feeRequired,
    feeAmount: p.feeAmount,
    maxCapacity: p.maxCapacity,
    enrollmentCount: p.enrollmentCount,
    status: getStatus(p.dateStart, p.dateEnd),
  }))

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          icon={BookOpen}
          title={t('extracurricular.title')}
          subtitle={t('extracurricular.description')}
          actions={
            canManage ? (
              <Link to="/extracurricular-programs/create">
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('common.create')}
                </Button>
              </Link>
            ) : undefined
          }
        />

        <div className="border rounded-xl bg-card p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={programs === undefined}
          />
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('extracurricular.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
