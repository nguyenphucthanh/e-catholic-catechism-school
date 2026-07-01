import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Users } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { STUDENT_ERRORS } from '../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
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

export const Route = createFileRoute('/_authenticated/students')({
  component: StudentsPage,
  staticData: { crumb: 'students.title' },
})

type Student = Doc<'students'>

function StudentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const paginatedStudents = usePaginatedQuery(
    api.students.list,
    requesterId ? { requesterId } : 'skip',
    { initialNumItems: 50 },
  )
  const deleteMutation = useMutation(api.students.softDelete)

  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null)
  const [groupBy, setGroupBy] = React.useState<'none' | 'gender' | 'isActive'>(
    'none',
  )

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        studentId: deleteTarget._id,
      })
      toast.success(t('students.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(STUDENT_ERRORS.IN_USE_BY_ENROLLMENT)) {
        toast.error(t('students.deleteActiveEnrollmentError'))
      } else {
        toast.error(t('students.deleteError'))
      }
    }
  }

  const groupByOptions = [
    { value: 'none', label: t('students.groupBy.none') },
    { value: 'gender', label: t('students.groupBy.gender') },
    { value: 'isActive', label: t('students.groupBy.status') },
  ]

  const columns: Array<ColumnDef<Student>> = [
    {
      accessorKey: 'studentCode',
      header: t('students.col.studentCode'),
    },
    {
      accessorKey: 'fullName',
      header: t('students.col.fullName'),
      cell: ({ row }) => {
        return (
          <Link
            // @ts-ignore - Route not yet generated
            to={'/students/$id'}
            // @ts-ignore - Route not yet generated
            params={{ id: row.original._id }}
            className="text-primary hover:underline font-medium"
          >
            {row.original.fullName}
          </Link>
        )
      },
    },
    {
      accessorKey: 'saintName',
      header: t('students.col.saintName'),
      cell: ({ row }) => row.original.saintName ?? '—',
    },
    {
      accessorKey: 'gender',
      header: t('students.col.gender'),
      cell: ({ row }) => {
        const g = row.original.gender
        if (!g) return '—'
        return <Badge variant="outline">{t(`students.gender.${g}`)}</Badge>
      },
    },
    {
      accessorKey: 'isActive',
      header: t('students.col.status'),
      cell: ({ row }) => {
        const active = row.original.isActive
        return (
          <Badge variant={active ? 'default' : 'secondary'}>
            {active
              ? t('students.status.active')
              : t('students.status.inactive')}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (!canManage) return null
        const student = row.original
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
                onClick={() => {
                  // @ts-ignore - Route not yet generated
                  navigate({ to: '/students/$id', params: { id: student._id } })
                }}
              >
                {t('common.view')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigate({
                    // @ts-ignore - Route not yet generated
                    to: '/students/$id/edit',
                    // @ts-ignore - Route not yet generated
                    params: { id: student._id },
                  })
                }}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(student)}
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const data = React.useMemo(() => {
    if (groupBy === 'none') return paginatedStudents.results

    return [...paginatedStudents.results].sort((a, b) => {
      const aVal = a[groupBy as keyof Student]
      const bVal = b[groupBy as keyof Student]
      if (aVal === bVal) return 0
      // @ts-expect-error - Dynamic sort field
      return aVal < bVal ? -1 : 1
    })
  }, [paginatedStudents.results, groupBy])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={t('students.title')}
        subtitle={t('students.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
        <div className="flex justify-end">
          <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupByOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {paginatedStudents.status === 'LoadingFirstPage' ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              searchColumnKey="fullName"
              searchPlaceholder={t('students.searchPlaceholder')}
            />
            {(paginatedStudents.status === 'CanLoadMore' ||
              paginatedStudents.status === 'LoadingMore') && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => paginatedStudents.loadMore(50)}
                  disabled={paginatedStudents.status === 'LoadingMore'}
                >
                  {t('students.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('students.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('students.delete.description', {
                name: deleteTarget?.fullName ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('students.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
