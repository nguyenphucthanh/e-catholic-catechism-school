import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus, Users } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef, GroupingState } from '@tanstack/react-table'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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

export const Route = createFileRoute('/_authenticated/_catechist/catechists')({
  component: CatechistsPage,
  staticData: { crumb: 'catechists.title' },
})

type Catechist = Doc<'catechists'>

function CatechistsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('all')
  const [deleteTarget, setDeleteTarget] = React.useState<Catechist | null>(null)
  const [grouping, setGrouping] = React.useState<GroupingState>([])

  const activeYear = useQuery(
    api.academicYears.getActive,
    requesterId ? { requesterId } : 'skip',
  )

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )

  const branchId =
    selectedBranchId !== 'all'
      ? (selectedBranchId as Id<'branches'>)
      : undefined
  const academicYearId = activeYear ? activeYear._id : undefined

  const catechists = useQuery(
    api.catechists.list,
    requesterId
      ? {
          requesterId,
          ...(branchId && academicYearId ? { branchId, academicYearId } : {}),
        }
      : 'skip',
  )

  const deleteMutation = useMutation(api.catechists.softDelete)

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        catechistId: deleteTarget._id,
      })
      toast.success(t('catechists.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      toast.error(t('catechists.deleteError'))
    }
  }

  const columns: Array<ColumnDef<Catechist>> = [
    {
      accessorKey: 'memberId',
      header: t('catechists.col.memberId'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        return (
          <span className="font-mono text-muted-foreground">
            {row.original.memberId.toString()}
          </span>
        )
      },
    },
    {
      accessorKey: 'fullName',
      header: t('catechists.col.fullName'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        return (
          <Link
            to={'/catechists/$id'}
            params={{ id: row.original._id }}
            className="text-primary hover:underline font-medium"
          >
            {formatPersonName(row.original.saintName, row.original.fullName)}
          </Link>
        )
      },
    },
    {
      accessorKey: 'gender',
      header: t('catechists.col.gender'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        const gender = row.original.gender
        if (!gender) return '-'
        return (
          <Badge variant="secondary" className="capitalize">
            {t(`profile.personal.gender.${gender}`)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'role',
      header: t('catechists.col.role'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        return (
          <Badge
            variant={
              row.original.role === 'admin' ? 'destructive' : 'secondary'
            }
          >
            {row.original.role}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: t('catechists.col.isActive'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        return (
          <Badge variant={row.original.isActive ? 'default' : 'outline'}>
            {row.original.isActive
              ? t('academicYears.status.active')
              : t('academicYears.status.inactive')}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'joinedDate',
      header: t('catechists.col.joinedDate'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        if (!row.original.joinedDate) return '-'
        return new Date(row.original.joinedDate).toLocaleDateString(
          i18n.language === 'vi' ? 'vi-VN' : 'en-US',
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!canManage || !row.original) return null
        const catechist = row.original
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
                  navigate({
                    to: '/catechists/$id/edit',
                    params: { id: catechist._id },
                  })
                }
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(catechist)}
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
        icon={Users}
        title={t('catechists.title')}
        subtitle={t('catechists.subtitle')}
        actions={
          canManage && (
            <Button onClick={() => navigate({ to: '/catechists/create' })}>
              <Plus className="size-4" />
              {t('catechists.actions.create')}
            </Button>
          )
        }
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {branches && branches.length > 0 && (
            <Select
              value={selectedBranchId}
              onValueChange={(val) => setSelectedBranchId(val || 'all')}
              items={[
                {
                  label: t('catechists.filterByBranch.all'),
                  value: 'all',
                },
                ...branches.map((b) => ({
                  label: b.name,
                  value: b._id,
                })),
              ]}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('catechists.filterByBranch')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('catechists.filterByBranch.all')}
                </SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch._id} value={branch._id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={grouping.length > 0 ? grouping[0] : 'none'}
            onValueChange={(val) =>
              setGrouping(val && val !== 'none' ? [val] : [])
            }
            items={[
              {
                label: 'None',
                value: 'none',
              },
              {
                label: t('catechists.col.role'),
                value: 'role',
              },
              {
                label: t('catechists.col.isActive'),
                value: 'isActive',
              },
            ]}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="role">{t('catechists.col.role')}</SelectItem>
              <SelectItem value="isActive">
                {t('catechists.col.isActive')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4">
        {catechists === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={catechists}
            searchColumnKey="fullName"
            searchPlaceholder={t('catechists.searchPlaceholder')}
            grouping={grouping}
            onGroupingChange={setGrouping}
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
            <AlertDialogTitle>{t('catechists.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('catechists.delete.description', {
                name: deleteTarget
                  ? formatPersonName(
                      deleteTarget.saintName,
                      deleteTarget.fullName,
                    )
                  : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('catechists.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
