import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { ACADEMIC_YEAR_ERRORS } from '../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { canManageAcademicYear } from '~/lib/permissions'
import { DEFAULT_TIMEZONE, formatDate } from '~/lib/locale'
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

export const Route = createFileRoute('/_authenticated/academic-years')({
  component: AcademicYearsPage,
  staticData: { crumb: 'academicYears.title' },
})

type AcademicYear = Doc<'academicYears'>

function AcademicYearsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageAcademicYear(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const years = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )
  const createYearMutation = useMutation(api.academicYears.create)
  const updateYearMutation = useMutation(api.academicYears.update)
  const setActiveMutation = useMutation(api.academicYears.setActive)
  const deleteMutation = useMutation(api.academicYears.softDelete)

  const [deleteTarget, setDeleteTarget] = React.useState<AcademicYear | null>(
    null,
  )

  const handleSetActive = async (yearId: Id<'academicYears'>) => {
    if (!requesterId) return
    try {
      await setActiveMutation({ requesterId, academicYearId: yearId })
      toast.success(t('academicYears.setActiveSuccess'))
    } catch {
      toast.error(t('academicYears.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        academicYearId: deleteTarget._id,
      })
      toast.success(t('academicYears.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE)) {
        toast.error(t('academicYears.deleteActiveError'))
      } else {
        toast.error(t('academicYears.deleteError'))
      }
    }
  }

  const columns: Array<ColumnDef<AcademicYear>> = [
    {
      accessorKey: 'name',
      header: t('academicYears.col.name'),
      cell: ({ row }) => {
        return (
          <Link
            to={'/academic-years/$id'}
            params={{ id: row.original._id }}
            className="text-primary hover:underline font-medium"
          >
            {row.original.name}
          </Link>
        )
      },
    },
    {
      accessorKey: 'startDate',
      header: t('academicYears.col.startDate'),
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      accessorKey: 'endDate',
      header: t('academicYears.col.endDate'),
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    {
      accessorKey: 'isActive',
      header: t('academicYears.col.status'),
      cell: ({ row }) => {
        const active = row.original.isActive
        return (
          <Badge variant={active ? 'default' : 'secondary'}>
            {active
              ? t('academicYears.status.active')
              : t('academicYears.status.inactive')}
          </Badge>
        )
      },
    },
  ]

  // Add actions column if user has board privileges
  if (canManage) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const year = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('common.moreActions')}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={year.isActive}
                onClick={() => handleSetActive(year._id)}
              >
                {t('academicYears.actions.setActive')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: '/academic-years/$id/edit',
                    params: { id: year._id },
                  })
                }
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(year)}
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarRange}
        title={t('academicYears.title')}
        subtitle={t('academicYears.subtitle')}
        actions={
          canManage && (
            <Button
              onClick={() => navigate({ to: '/academic-years/create' })}
              className="flex gap-2"
            >
              <Plus className="size-4" />
              {t('academicYears.actions.create')}
            </Button>
          )
        }
      />

      <div className="bg-card border rounded-xl p-4">
        {years === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={years}
            searchColumnKey="name"
            searchPlaceholder={t('academicYears.select_year')}
          />
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('academicYears.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('academicYears.delete.description', {
                name: deleteTarget?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('academicYears.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
