import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import type { FunctionReturnType } from 'convex/server'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import type { TableColumnDef } from '~/components/custom/data-table'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { isAdmin } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { exportCsv } from '~/lib/export'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
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

type CatechistRow = Doc<'catechists'> & {
  assignedClasses?: Array<{ classId: Id<'classes'>; className: string }>
}

function CatechistsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('all')
  const [genderFilter, setGenderFilter] = React.useState<
    '' | 'male' | 'female'
  >('')
  const [statusFilter, setStatusFilter] = React.useState<
    '' | 'active' | 'inactive'
  >('')
  // '' = any, 'none' = no title, otherwise the title string
  const [titleFilter, setTitleFilter] = React.useState('')
  const [deleteTarget, setDeleteTarget] =
    React.useState<Doc<'catechists'> | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    React.useState<Doc<'catechists'> | null>(null)
  const [showDeleted, setShowDeleted] = React.useState(false)

  const [nameInput, setNameInput] = React.useState('')
  const [debouncedName, setDebouncedName] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  type CatechistSortField =
    | 'memberId'
    | 'saintName'
    | 'fullName'
    | 'gender'
    | 'isActive'
    | 'joinedDate'
    | '_creationTime'
  const activeSort = sorting.length > 0 ? sorting[0] : undefined
  const sortBy = activeSort?.id as CatechistSortField | undefined
  const sortOrder = activeSort?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(nameInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [nameInput])

  React.useEffect(() => {
    setPagination((old) => ({ ...old, pageIndex: 0 }))
  }, [
    debouncedName,
    genderFilter,
    titleFilter,
    statusFilter,
    selectedBranchId,
    sortBy,
    sortOrder,
    showDeleted,
  ])

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

  const permissions = useQuery(
    api.catechistPermissions.getPermissions,
    requesterId && academicYearId ? { requesterId, academicYearId } : 'skip',
  )
  const canExport = permissions?.isAdmin || permissions?.isBoardMember

  const titleArg =
    titleFilter === '' ? undefined : titleFilter === 'none' ? '' : titleFilter

  const paginatedCatechists = usePaginatedQuery(
    api.catechists.list,
    requesterId
      ? {
          requesterId,
          name: debouncedName || undefined,
          gender: genderFilter || undefined,
          title: titleArg,
          isActive: statusFilter === '' ? undefined : statusFilter === 'active',
          isDeleted: showDeleted,
          branchId: branchId ?? undefined,
          academicYearId: academicYearId ?? undefined,
          sortBy,
          sortOrder,
        }
      : 'skip',
    { initialNumItems: pagination.pageSize },
  )

  const deleteMutation = useMutation(api.catechists.softDelete)
  const restoreMutation = useMutation(api.catechists.restore)
  const permanentDeleteMutation = useMutation(api.catechists.permanentDelete)

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        catechistId: deleteTarget._id,
      })
      toast.success(t('catechists.deleted'))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(translateConvexError(err, t, 'catechists.deleteError'))
    }
  }

  const handleRestore = async (catechist: Doc<'catechists'>) => {
    if (!requesterId) return
    try {
      await restoreMutation({ requesterId, catechistId: catechist._id })
      toast.success(t('catechists.restored'))
    } catch (err) {
      toast.error(translateConvexError(err, t, 'catechists.restoreError'))
    }
  }

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget || !requesterId) return
    try {
      await permanentDeleteMutation({
        requesterId,
        catechistId: permanentDeleteTarget._id,
      })
      toast.success(t('catechists.permanentDeleted'))
      setPermanentDeleteTarget(null)
    } catch (err) {
      toast.error(
        translateConvexError(err, t, 'catechists.permanentDeleteError'),
      )
    }
  }

  const convex = useConvex()

  const handleExport = async () => {
    if (!requesterId) return
    let rows: FunctionReturnType<typeof api.catechists.exportList>
    try {
      rows = await convex.query(api.catechists.exportList, {
        requesterId,
        name: debouncedName || undefined,
        gender: genderFilter || undefined,
        title: titleArg,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        branchId: branchId ?? undefined,
        academicYearId: academicYearId ?? undefined,
        sortBy,
        sortOrder,
      })
    } catch {
      toast.error(t('catechists.export.unauthorized'))
      return
    }

    const headers = [
      t('catechists.export.col.memberId'),
      t('catechists.export.col.saintName'),
      t('catechists.export.col.fullName'),
      t('catechists.export.col.gender'),
      t('catechists.export.col.dateOfBirth'),
      t('catechists.export.col.role'),
      t('catechists.export.col.isActive'),
      t('catechists.export.col.joinedDate'),
      t('catechists.export.col.title'),
      t('catechists.export.col.community'),
      t('catechists.export.col.level'),
      t('catechists.export.col.notes'),
      t('catechists.export.col.addressLine1'),
      t('catechists.export.col.addressLine2'),
      t('catechists.export.col.city'),
      t('catechists.export.col.stateProvince'),
      t('catechists.export.col.postalCode'),
      t('catechists.export.col.country'),
      t('catechists.export.col.hamlet'),
      t('catechists.export.col.subHamlet'),
      t('catechists.export.col.primaryPhone'),
      t('catechists.export.col.primaryEmail'),
    ]

    const csvRows = rows.map((r) => ({
      [headers[0]]: r.memberId,
      [headers[1]]: r.saintName ?? '',
      [headers[2]]: r.fullName,
      [headers[3]]: r.gender ? t(`profile.personal.gender.${r.gender}`) : '',
      [headers[4]]: r.dateOfBirth ?? '',
      [headers[5]]: t(`catechists.role.${r.role}`),
      [headers[6]]: r.isActive
        ? t('academicYears.status.active')
        : t('academicYears.status.inactive'),
      [headers[7]]: r.joinedDate ?? '',
      [headers[8]]: r.title ?? '',
      [headers[9]]: r.community ?? '',
      [headers[10]]: r.level ?? '',
      [headers[11]]: r.notes ?? '',
      [headers[12]]: r.addressLine1 ?? '',
      [headers[13]]: r.addressLine2 ?? '',
      [headers[14]]: r.city ?? '',
      [headers[15]]: r.stateProvince ?? '',
      [headers[16]]: r.postalCode ?? '',
      [headers[17]]: r.country ?? '',
      [headers[18]]: r.hamlet ?? '',
      [headers[19]]: r.subHamlet ?? '',
      [headers[20]]: r.primaryPhone ?? '',
      [headers[21]]: r.primaryEmail ?? '',
    }))

    const today = new Date().toISOString().slice(0, 10)
    exportCsv(csvRows, `catechists-${today}.csv`, headers)
  }

  const titleOptions = [
    { value: '', label: t('catechists.filters.anyTitle') },
    { value: 'none', label: t('profile.personal.title.none') },
    { value: 'Giáo Lý Viên', label: t('profile.personal.title.catechist') },
    { value: 'Cha', label: t('profile.personal.title.cha') },
    { value: 'Thầy', label: t('profile.personal.title.thay') },
    { value: 'Soeur', label: t('profile.personal.title.soeur') },
    { value: 'Huynh Trưởng', label: t('profile.personal.title.huynh_truong') },
  ]

  const columns: Array<TableColumnDef<CatechistRow>> = [
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
      accessorKey: 'title',
      header: t('catechists.col.title'),
      enableSorting: false,
      cell: ({ row }) => row.original.title || '-',
    },
    {
      accessorKey: 'saintName',
      header: t('catechists.col.saintName'),
    },
    {
      accessorKey: 'fullName',
      header: t('catechists.col.fullName'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        if (showDeleted) {
          return <span className="font-medium">{row.original.fullName}</span>
        }
        return (
          <Link
            to={'/catechists/$id'}
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
      id: 'assignedClasses',
      header: t('catechists.col.assignedClasses'),
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!row.original) return null
        const classes = row.original.assignedClasses
        if (!classes || classes.length === 0) return '-'
        return (
          <span>
            {classes.map((cls, idx) => (
              <React.Fragment key={cls.classId}>
                {idx > 0 && ', '}
                <Link
                  to="/classes/$id"
                  params={{ id: cls.classId }}
                  className="text-primary hover:underline font-medium"
                >
                  {cls.className}
                </Link>
              </React.Fragment>
            ))}
          </span>
        )
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!canManage || !row.original) return null
        const catechist = row.original

        if (showDeleted) {
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
                <DropdownMenuItem onClick={() => handleRestore(catechist)}>
                  <RotateCcw className="size-4" />
                  {t('catechists.restore')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                  onClick={() => setPermanentDeleteTarget(catechist)}
                >
                  <Trash2 className="size-4" />
                  {t('catechists.permanentDelete.action')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

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
                  <Link
                    to="/catechists/$id/edit"
                    params={{ id: catechist._id }}
                  />
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
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                variant="outline"
                onClick={() => setShowDeleted((prev) => !prev)}
              >
                {showDeleted
                  ? t('catechists.showActive')
                  : t('catechists.showDeleted')}
              </Button>
            )}
            {!showDeleted && canExport && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="size-4" />
                {t('catechists.export.csv')}
              </Button>
            )}
            {!showDeleted && canManage && (
              <Button
                nativeButton={false}
                render={<Link to="/catechists/create" />}
              >
                <Plus className="size-4" />
                {t('catechists.actions.create')}
              </Button>
            )}
          </div>
        }
      />

      <div className="bg-card border rounded-xl p-4">
        <DataTable
          columns={columns}
          data={paginatedCatechists.results}
          disableSearch
          isLoading={paginatedCatechists.isLoading}
          hasMore={paginatedCatechists.status === 'CanLoadMore'}
          onLoadMore={() => paginatedCatechists.loadMore(pagination.pageSize)}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          filterExtra={
            <>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t('catechists.searchPlaceholder')}
                className="max-w-xs"
              />
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
                  <SelectTrigger className="w-50">
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
                value={genderFilter}
                onValueChange={(val: any) => setGenderFilter(val)}
                items={[
                  { value: '', label: t('students.filters.anyGender') },
                  { value: 'male', label: t('students.gender.male') },
                  { value: 'female', label: t('students.gender.female') },
                ]}
              >
                <SelectTrigger className="w-36">
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
                value={titleFilter}
                onValueChange={(val) => setTitleFilter(val ?? '')}
                items={titleOptions}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('catechists.filters.anyTitle')} />
                </SelectTrigger>
                <SelectContent>
                  {titleOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
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
                <SelectTrigger className="w-36">
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
            </>
          }
        />
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

      {/* Permanent Delete Confirmation */}
      <AlertDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPermanentDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('catechists.permanentDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('catechists.permanentDelete.description', {
                name: permanentDeleteTarget
                  ? formatPersonName(
                      permanentDeleteTarget.saintName,
                      permanentDeleteTarget.fullName,
                    )
                  : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('catechists.permanentDelete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
