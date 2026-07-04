import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, ListPlus, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { CLASS_ERRORS } from '../../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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

export const Route = createFileRoute('/_authenticated/_catechist/classes')({
  component: ClassesPage,
  staticData: { crumb: 'classes.title' },
})

type Class = Doc<'classes'>

function ClassesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const classes = useQuery(
    api.classes.list,
    requesterId
      ? { requesterId, academicYearId: selectedYearId ?? undefined }
      : 'skip',
  )
  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const deleteMutation = useMutation(api.classes.softDelete)

  const [selectedBranchId, setSelectedBranchId] = React.useState<string | null>(
    null,
  )

  const branchSortMap = React.useMemo(() => {
    const map = new Map<string, number>()
    if (branches) {
      for (const b of branches) {
        map.set(b._id, b.sortOrder)
      }
    }
    return map
  }, [branches])

  const displayClasses = React.useMemo(() => {
    if (!classes) return undefined
    let result = [...classes]
    if (selectedBranchId) {
      result = result.filter((c) => c.branchId === selectedBranchId)
    }
    result.sort((a, b) => {
      const aOrder = branchSortMap.get(a.branchId) ?? Infinity
      const bOrder = branchSortMap.get(b.branchId) ?? Infinity
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })
    return result
  }, [classes, selectedBranchId, branchSortMap])

  const [deleteTarget, setDeleteTarget] = React.useState<Class | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        classId: deleteTarget._id,
      })
      toast.success(t('classes.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(CLASS_ERRORS.IN_USE_BY_CLASS_YEAR)) {
        toast.error(t('classes.deleteInUseError'))
      } else {
        toast.error(t('classes.deleteError'))
      }
    }
  }

  const columns: Array<ColumnDef<Class>> = [
    {
      accessorKey: 'name',
      header: t('classes.col.name'),
      cell: ({ row }) => {
        return (
          <Link
            to={'/classes/$id'}
            params={{ id: row.original._id }}
            className="text-primary hover:underline font-medium"
          >
            {row.original.name}
          </Link>
        )
      },
    },
    {
      accessorKey: 'branchId',
      header: t('classes.col.branch'),
      cell: ({ row }) => {
        const branch = branches?.find((b) => b._id === row.original.branchId)
        return <span>{branch?.name ?? '—'}</span>
      },
    },
    {
      accessorKey: 'description',
      header: t('classes.col.description'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (!canManage) return null
        const cls = row.original
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
                onClick={() =>
                  navigate({ to: '/classes/$id/edit', params: { id: cls._id } })
                }
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(cls)}
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
        icon={GraduationCap}
        title={t('classes.title')}
        subtitle={t('classes.subtitle')}
        actions={
          <>
            {canManage && (
              <Button
                onClick={() => navigate({ to: '/classes/bulk-create' })}
                variant="outline"
              >
                <ListPlus className="size-4" />
                {t('classes.actions.bulkCreate')}
              </Button>
            )}
            {canManage && (
              <Button onClick={() => navigate({ to: '/classes/create' })}>
                <Plus className="size-4" />
                {t('classes.actions.create')}
              </Button>
            )}
          </>
        }
      />

      <div className="bg-card border rounded-xl p-4">
        {classes === undefined || branches === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={displayClasses ?? []}
            searchColumnKey="name"
            searchPlaceholder={t('classes.searchPlaceholder')}
            filterExtra={
              <Select
                value={selectedBranchId ?? ''}
                onValueChange={(val) => setSelectedBranchId(val || null)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t('classes.filterBranch')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('classes.allBranches')}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
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
            <AlertDialogTitle>{t('classes.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('classes.delete.description', {
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
              {t('classes.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
