import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, MoreHorizontal, Plus, Users } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { STUDENT_ERRORS } from '../../../../convex/lib/errors'
import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { isAdmin } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
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

export const Route = createFileRoute('/_authenticated/_catechist/students')({
  component: StudentsPage,
  staticData: { crumb: 'students.title' },
})

type Student = Doc<'students'>

function StudentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [nameInput, setNameInput] = React.useState('')
  const [debouncedName, setDebouncedName] = React.useState('')
  const [genderFilter, setGenderFilter] = React.useState<
    '' | 'male' | 'female'
  >('')
  const [statusFilter, setStatusFilter] = React.useState<
    '' | 'active' | 'inactive'
  >('')
  const [branchFilter, setBranchFilter] = React.useState('')
  const [classYearFilter, setClassYearFilter] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  type StudentSortField =
    | 'studentCode'
    | 'saintName'
    | 'fullName'
    | 'gender'
    | 'isActive'
    | '_creationTime'
  const activeSort = sorting.length > 0 ? sorting[0] : undefined
  const sortBy = activeSort?.id as StudentSortField | undefined
  const sortOrder = activeSort?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(nameInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [nameInput])

  // Query args below reset the underlying convex cursor/accumulated results,
  // so any page the user had navigated to is no longer valid.
  React.useEffect(() => {
    setPagination((old) => ({ ...old, pageIndex: 0 }))
  }, [
    debouncedName,
    genderFilter,
    statusFilter,
    branchFilter,
    classYearFilter,
    sortBy,
    sortOrder,
  ])

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const classesInYear = useQuery(
    api.classes.list,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )
  const classYearsInYear = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const classYearIdByClassId = React.useMemo(() => {
    const map = new Map<string, Id<'classYears'>>()
    classYearsInYear?.forEach((cy) => map.set(cy.classId, cy.classYearId))
    return map
  }, [classYearsInYear])

  const branchOptions = React.useMemo(() => {
    if (!branches || !classesInYear) return []
    const branchIds = new Set(classesInYear.map((c) => c.branchId))
    return branches.filter((b) => branchIds.has(b._id))
  }, [branches, classesInYear])

  const classOptions = React.useMemo(() => {
    if (!classesInYear) return []
    const scoped = branchFilter
      ? classesInYear.filter((c) => c.branchId === branchFilter)
      : classesInYear
    return scoped
      .map((c) => ({
        classYearId: classYearIdByClassId.get(c._id),
        name: c.name,
      }))
      .filter(
        (c): c is { classYearId: Id<'classYears'>; name: string } =>
          c.classYearId !== undefined,
      )
  }, [classesInYear, branchFilter, classYearIdByClassId])

  // Reset the class filter if it no longer matches the (possibly changed)
  // branch/academic-year scope.
  React.useEffect(() => {
    if (
      classYearFilter &&
      !classOptions.some((c) => c.classYearId === classYearFilter)
    ) {
      setClassYearFilter('')
    }
  }, [classOptions, classYearFilter])

  const paginatedStudents = usePaginatedQuery(
    api.students.list,
    requesterId
      ? {
          requesterId,
          name: debouncedName || undefined,
          gender: genderFilter || undefined,
          isActive: statusFilter === '' ? undefined : statusFilter === 'active',
          branchId: (branchFilter as Id<'branches'>) || undefined,
          classYearId: (classYearFilter as Id<'classYears'>) || undefined,
          academicYearId: selectedYearId ?? undefined,
          sortBy,
          sortOrder,
        }
      : 'skip',
    { initialNumItems: pagination.pageSize },
  )
  const deleteMutation = useMutation(api.students.softDelete)

  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null)

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

  const columns: Array<ColumnDef<Student>> = [
    {
      accessorKey: 'studentCode',
      header: t('students.col.studentCode'),
      enableSorting: true,
    },
    {
      accessorKey: 'saintName',
      header: t('students.col.saintName'),
      enableSorting: true,
    },
    {
      accessorKey: 'fullName',
      header: t('students.col.fullName'),
      enableSorting: true,
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
      accessorKey: 'gender',
      header: t('students.col.gender'),
      enableSorting: true,
      cell: ({ row }) => {
        const g = row.original.gender
        if (!g) return '—'
        return <Badge variant="outline">{t(`students.gender.${g}`)}</Badge>
      },
    },
    {
      accessorKey: 'isActive',
      header: t('students.col.status'),
      enableSorting: true,
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
      enableSorting: false,
      cell: ({ row }) => {
        if (!requesterId) return null
        const student = row.original
        // @ts-ignore - isEditable field returned from backend
        const isEditable = !!student.isEditable
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() =>
                navigate({
                  to: '/students/$id/attendance',
                  params: { id: student._id },
                })
              }
            >
              <CalendarCheck className="size-4" />
              <span className="sr-only">{t('students.attendance.title')}</span>
            </Button>
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
                    navigate({
                      to: '/students/$id',
                      params: { id: student._id },
                    })
                  }}
                >
                  {t('common.view')}
                </DropdownMenuItem>
                {(isEditable || canManage) && (
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
                )}
                {canManage && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                    onClick={() => setDeleteTarget(student)}
                  >
                    {t('common.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={t('students.title')}
        subtitle={t('students.subtitle')}
        actions={
          <>
            {requesterId && (
              <Button onClick={() => navigate({ to: '/students/create' })}>
                <Plus className="size-4" />
                {t('students.actions.create')}
              </Button>
            )}
          </>
        }
      />
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
        <DataTable
          columns={columns}
          data={paginatedStudents.results}
          disableSearch
          isLoading={paginatedStudents.isLoading}
          hasMore={paginatedStudents.status === 'CanLoadMore'}
          onLoadMore={() => paginatedStudents.loadMore(pagination.pageSize)}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          filterExtra={
            <>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t('students.searchPlaceholder')}
                className="max-w-xs"
              />
              <Select
                value={genderFilter}
                onValueChange={(val: any) => setGenderFilter(val)}
                items={[
                  { value: '', label: t('students.filters.anyGender') },
                  { value: 'male', label: t('students.gender.male') },
                  { value: 'female', label: t('students.gender.female') },
                ]}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('students.filters.anyGender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('students.filters.anyGender')}
                  </SelectItem>
                  <SelectItem value="male">
                    {t('students.gender.male')}
                  </SelectItem>
                  <SelectItem value="female">
                    {t('students.gender.female')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(val: any) => setStatusFilter(val)}
                items={[
                  { value: '', label: t('students.filters.anyStatus') },
                  { value: 'active', label: t('students.status.active') },
                  { value: 'inactive', label: t('students.status.inactive') },
                ]}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('students.filters.anyStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('students.filters.anyStatus')}
                  </SelectItem>
                  <SelectItem value="active">
                    {t('students.status.active')}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {t('students.status.inactive')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={branchFilter}
                onValueChange={(val: any) => setBranchFilter(val)}
                items={[
                  { value: '', label: t('students.filters.anyBranch') },
                  ...branchOptions.map((b) => ({
                    value: b._id,
                    label: b.name,
                  })),
                ]}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t('students.filters.anyBranch')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('students.filters.anyBranch')}
                  </SelectItem>
                  {branchOptions.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={classYearFilter}
                onValueChange={(val: any) => setClassYearFilter(val)}
                items={[
                  { value: '', label: t('students.filters.anyClass') },
                  ...classOptions.map((c) => ({
                    value: c.classYearId,
                    label: c.name,
                  })),
                ]}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t('students.filters.anyClass')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('students.filters.anyClass')}
                  </SelectItem>
                  {classOptions.map((c) => (
                    <SelectItem key={c.classYearId} value={c.classYearId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
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
              {t('students.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
