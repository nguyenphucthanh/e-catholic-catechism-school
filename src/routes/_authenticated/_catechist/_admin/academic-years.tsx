import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, MoreHorizontal, Plus, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { isAdmin } from '~/lib/permissions'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
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

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/academic-years',
)({
  component: AcademicYearsPage,
  staticData: {
    crumbs: [{ label: 'nav.admin' }, { label: 'academicYears.title' }],
  },
})

type AcademicYear = Doc<'academicYears'>

function AcademicYearsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const years = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )
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
    } catch (err) {
      toast.error(translateConvexError(err, t, 'academicYears.deleteError'))
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
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const year = row.original
        if (!canManage) return null
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
                render={
                  <Link
                    to="/academic-years/$id/edit"
                    params={{ id: year._id }}
                  />
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
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarRange}
        title={t('academicYears.title')}
        subtitle={t('academicYears.subtitle')}
        actions={
          canManage && (
            <Button
              nativeButton={false}
              render={<Link to="/academic-years/create" />}
            >
              <Plus className="size-4" />
              {t('academicYears.actions.create')}
            </Button>
          )
        }
      />

      {canManage && (
        <Alert className="bg-primary/5 border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl">
          <div className="space-y-1">
            <AlertTitle className="font-semibold text-primary">
              {t('academicYears.setup.banner.title')}
            </AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {t('academicYears.setup.banner.description')}
            </AlertDescription>
          </div>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link to="/academic-years/setup" />}
            className="shrink-0"
          >
            <Sparkles className="size-4 mr-2" />
            {t('academicYears.setup.banner.action')}
          </Button>
        </Alert>
      )}

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
