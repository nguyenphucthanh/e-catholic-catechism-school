import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
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

export const Route = createFileRoute('/_authenticated/_catechist/branches')({
  component: BranchesPage,
  staticData: { crumb: 'branches.title' },
})

type Branch = Doc<'branches'>

function BranchesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const deleteMutation = useMutation(api.branches.softDelete)
  const reorderMutation = useMutation(api.branches.reorder)

  const [deleteTarget, setDeleteTarget] = React.useState<Branch | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        branchId: deleteTarget._id,
      })
      toast.success(t('branches.deleted'))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(translateConvexError(err, t, 'branches.deleteError'))
    }
  }

  const handleReorder = async (
    branchId: Id<'branches'>,
    direction: 'up' | 'down',
  ) => {
    if (!requesterId) return
    try {
      await reorderMutation({ requesterId, branchId, direction })
    } catch (err) {
      toast.error(translateConvexError(err, t, 'branches.reorderError'))
    }
  }

  const columns: Array<ColumnDef<Branch>> = [
    {
      accessorKey: 'sortOrder',
      header: t('branches.col.order'),
      cell: ({ row, table }) => {
        const branch = row.original
        const visibleRows = table.getRowModel().rows
        const isFirst = visibleRows[0]?.original._id === branch._id
        const isLast =
          visibleRows[visibleRows.length - 1]?.original._id === branch._id
        return (
          <div className="flex items-center gap-2">
            <span className="w-4 text-center">{branch.sortOrder}</span>
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={isFirst || !canManage}
                onClick={() => handleReorder(branch._id, 'up')}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={isLast || !canManage}
                onClick={() => handleReorder(branch._id, 'down')}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      header: t('branches.col.name'),
      cell: ({ row }) => {
        return (
          <Link
            to={'/branches/$id'}
            params={{ id: row.original._id }}
            className="text-primary hover:underline font-medium"
          >
            {row.original.name}
          </Link>
        )
      },
    },
    {
      accessorKey: 'description',
      header: t('branches.col.description'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (!canManage) return null
        const branch = row.original
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
                render={
                  <Link to="/branches/$id/edit" params={{ id: branch._id }} />
                }
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(branch)}
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
        icon={GitBranch}
        title={t('branches.title')}
        subtitle={t('branches.subtitle')}
        actions={
          canManage && (
            <Button render={<Link to="/branches/create" />}>
              <Plus className="size-4" />
              {t('branches.actions.create')}
            </Button>
          )
        }
      />

      <div className="bg-card border rounded-xl p-4">
        {branches === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={branches}
            searchColumnKey="name"
            searchPlaceholder={t('branches.searchPlaceholder')}
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
            <AlertDialogTitle>{t('branches.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('branches.delete.description', {
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
              {t('branches.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
