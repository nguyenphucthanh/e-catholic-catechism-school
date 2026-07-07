import { createFileRoute } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/admin/catechist-accounts',
)({
  component: AdminCatechistAccountsPage,
  staticData: { crumb: 'nav.admin.catechistAccounts' },
})

type CatechistRow = {
  catechist: Doc<'catechists'>
  account: Doc<'accounts'> | null
}

function AdminCatechistAccountsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const grantAccount = useMutation(api.accountAdmin.grantCatechistAccount)
  const resetPassword = useMutation(api.accountAdmin.resetPassword)
  const toggleStatus = useMutation(api.accountAdmin.toggleAccountStatus)
  const bulkGrant = useMutation(api.accountAdmin.bulkGrantCatechistAccounts)
  const bulkReset = useMutation(api.accountAdmin.bulkResetPasswords)

  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [bulkLoading, setBulkLoading] = React.useState(false)

  const [resetDialogOpen, setResetDialogOpen] = React.useState(false)

  const [roleFilter, setRoleFilter] = React.useState<string>('')
  const [accountStatusFilter, setAccountStatusFilter] =
    React.useState<string>('')
  const [activeStatusFilter, setActiveStatusFilter] = React.useState<string>('')

  const [nameInput, setNameInput] = React.useState('')
  const [debouncedName, setDebouncedName] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  type CatechistAccountSortField =
    'memberId' | 'fullName' | 'role' | 'joinedDate' | '_creationTime'
  const activeSort = sorting.length > 0 ? sorting[0] : undefined
  const sortBy = activeSort?.id as CatechistAccountSortField | undefined
  const sortOrder = activeSort?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(nameInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [nameInput])

  React.useEffect(() => {
    setPagination((old) => ({ ...old, pageIndex: 0 }))
  }, [
    debouncedName,
    roleFilter,
    accountStatusFilter,
    activeStatusFilter,
    sortBy,
    sortOrder,
  ])

  const paginatedData = usePaginatedQuery(
    api.accountAdmin.listCatechistAccounts,
    requesterId
      ? {
          requesterId,
          name: debouncedName || undefined,
          role: (roleFilter as 'admin' | 'user') || undefined,
          accountStatus:
            (accountStatusFilter as 'hasAccount' | 'noAccount' | 'disabled') ||
            undefined,
          activeStatus:
            activeStatusFilter === ''
              ? undefined
              : activeStatusFilter === 'active',
          sortBy,
          sortOrder,
        }
      : 'skip',
    { initialNumItems: pagination.pageSize },
  )

  const data = paginatedData.results

  const selectedRows = React.useMemo(() => {
    if (!data) return []
    const idSet = new Set(Object.keys(rowSelection))
    return data.filter((r) => idSet.has(r.catechist._id))
  }, [data, rowSelection])

  const selectedGrantable = React.useMemo(
    () => selectedRows.filter((r) => !r.account),
    [selectedRows],
  )

  const selectedWithAccount = React.useMemo(
    () => selectedRows.filter((r) => r.account),
    [selectedRows],
  )

  const handleGrant = async (catechistId: Id<'catechists'>) => {
    if (!requesterId) return
    setLoadingId(catechistId)
    try {
      await grantAccount({ requesterId, catechistId })
      toast.success(t('adminAccounts.grantSuccess'))
    } catch (err: any) {
      const msg =
        err.message === 'ACCOUNT_ALREADY_EXISTS'
          ? t('adminAccounts.accountAlreadyExists')
          : t('adminAccounts.grantError')
      toast.error(msg)
    } finally {
      setLoadingId(null)
    }
  }

  const handleResetPassword = async (accountId: Id<'accounts'>) => {
    if (!requesterId) return
    setLoadingId(accountId)
    try {
      await resetPassword({ requesterId, accountId })
      toast.success(t('adminAccounts.resetSuccess'))
    } catch {
      toast.error(t('adminAccounts.resetError'))
    } finally {
      setLoadingId(null)
    }
  }

  const handleToggleStatus = async (accountId: Id<'accounts'>) => {
    if (!requesterId) return
    setLoadingId(accountId)
    try {
      await toggleStatus({ requesterId, accountId })
      toast.success(t('adminAccounts.toggleSuccess'))
    } catch {
      toast.error(t('adminAccounts.toggleError'))
    } finally {
      setLoadingId(null)
    }
  }

  const handleBulkGrant = async () => {
    if (!requesterId || selectedGrantable.length === 0) return
    setBulkLoading(true)
    try {
      await bulkGrant({
        requesterId,
        catechistIds: selectedGrantable.map((r) => r.catechist._id),
      })
      toast.success(t('adminAccounts.bulkGrantSuccess'))
      setRowSelection({})
    } catch {
      toast.error(t('adminAccounts.bulkGrantError'))
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkReset = async () => {
    if (!requesterId) return
    const accountIds = selectedWithAccount.map((r) => r.account!._id)
    if (accountIds.length === 0) return
    setBulkLoading(true)
    try {
      await bulkReset({ requesterId, accountIds })
      toast.success(t('adminAccounts.bulkResetSuccess'))
      setRowSelection({})
      setResetDialogOpen(false)
    } catch {
      toast.error(t('adminAccounts.resetError'))
      setBulkLoading(false)
    }
  }

  const columns: Array<ColumnDef<CatechistRow>> = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'catechist.memberId',
      header: t('catechists.col.memberId'),
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.catechist.memberId.toString()}
        </span>
      ),
    },
    {
      accessorKey: 'catechist.fullName',
      header: t('catechists.col.fullName'),
      cell: ({ row }) => (
        <span className="font-medium">
          {formatPersonName(
            row.original.catechist.saintName,
            row.original.catechist.fullName,
          )}
        </span>
      ),
    },
    {
      accessorKey: 'catechist.role',
      header: t('catechists.col.role'),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.catechist.role === 'admin'
              ? 'destructive'
              : 'secondary'
          }
        >
          {row.original.catechist.role}
        </Badge>
      ),
    },
    {
      id: 'accountStatus',
      header: t('adminAccounts.col.accountStatus'),
      cell: ({ row }) => {
        const account = row.original.account
        if (!account) {
          return (
            <Badge variant="outline" className="text-muted-foreground">
              {t('adminAccounts.status.noAccount')}
            </Badge>
          )
        }
        return (
          <Badge variant={account.isActive ? 'default' : 'secondary'}>
            {account.isActive
              ? t('adminAccounts.status.hasAccount')
              : t('adminAccounts.status.disabled')}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'catechist.isActive',
      header: t('catechists.col.isActive'),
      cell: ({ row }) => (
        <Badge
          variant={row.original.catechist.isActive ? 'default' : 'outline'}
        >
          {row.original.catechist.isActive
            ? t('academicYears.status.active')
            : t('academicYears.status.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'catechist.joinedDate',
      header: t('catechists.col.joinedDate'),
      cell: ({ row }) => {
        if (!row.original.catechist.joinedDate) return '-'
        return new Date(row.original.catechist.joinedDate).toLocaleDateString(
          i18n.language === 'vi' ? 'vi-VN' : 'en-US',
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const { catechist, account } = row.original
        const isLoading =
          loadingId === catechist._id || loadingId === account?._id
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={isLoading}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('common.moreActions')}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              {!account && (
                <DropdownMenuItem onClick={() => handleGrant(catechist._id)}>
                  <UserCheck className="mr-2 size-4" />
                  {t('adminAccounts.actions.grant')}
                </DropdownMenuItem>
              )}
              {account && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleResetPassword(account._id)}
                  >
                    <KeyRound className="mr-2 size-4" />
                    {t('adminAccounts.actions.resetPassword')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToggleStatus(account._id)}
                  >
                    {account.isActive ? (
                      <>
                        <UserX className="mr-2 size-4" />
                        {t('adminAccounts.actions.disable')}
                      </>
                    ) : (
                      <>
                        <UserCheck className="mr-2 size-4" />
                        {t('adminAccounts.actions.enable')}
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        title={t('adminAccounts.catechist.title')}
        subtitle={t('adminAccounts.catechist.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4">
        <DataTable
          columns={columns}
          data={data}
          disableSearch
          isLoading={paginatedData.isLoading}
          hasMore={paginatedData.status === 'CanLoadMore'}
          onLoadMore={() => paginatedData.loadMore(pagination.pageSize)}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row) => row.catechist._id}
          filterExtra={
            <>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t('catechists.searchPlaceholder')}
                className="max-w-xs"
              />
              <Select
                onValueChange={(val: any) => setRoleFilter(val)}
                items={[
                  { value: '', label: t('adminAccounts.filters.anyRole') },
                  { value: 'admin', label: t('catechists.role.admin') },
                  { value: 'user', label: t('catechists.role.user') },
                ]}
              >
                <SelectTrigger className="w-36">
                  <SelectValue
                    placeholder={t('adminAccounts.filters.anyRole')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('adminAccounts.filters.anyRole')}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t('catechists.role.admin')}
                  </SelectItem>
                  <SelectItem value="user">
                    {t('catechists.role.user')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={accountStatusFilter}
                onValueChange={(val: any) => setAccountStatusFilter(val)}
                items={[
                  {
                    value: '',
                    label: t('adminAccounts.filters.anyAccountStatus'),
                  },
                  {
                    value: 'hasAccount',
                    label: t('adminAccounts.status.hasAccount'),
                  },
                  {
                    value: 'noAccount',
                    label: t('adminAccounts.status.noAccount'),
                  },
                  {
                    value: 'disabled',
                    label: t('adminAccounts.status.disabled'),
                  },
                ]}
              >
                <SelectTrigger className="w-40">
                  <SelectValue
                    placeholder={t('adminAccounts.filters.anyAccountStatus')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('adminAccounts.filters.anyAccountStatus')}
                  </SelectItem>
                  <SelectItem value="hasAccount">
                    {t('adminAccounts.status.hasAccount')}
                  </SelectItem>
                  <SelectItem value="noAccount">
                    {t('adminAccounts.status.noAccount')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('adminAccounts.status.disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={activeStatusFilter}
                onValueChange={(val: any) => setActiveStatusFilter(val)}
                items={[
                  {
                    value: '',
                    label: t('adminAccounts.filters.anyActiveStatus'),
                  },
                  {
                    value: 'active',
                    label: t('academicYears.status.active'),
                  },
                  {
                    value: 'inactive',
                    label: t('academicYears.status.inactive'),
                  },
                ]}
              >
                <SelectTrigger className="w-36">
                  <SelectValue
                    placeholder={t('adminAccounts.filters.anyActiveStatus')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('adminAccounts.filters.anyActiveStatus')}
                  </SelectItem>
                  <SelectItem value="active">
                    {t('academicYears.status.active')}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {t('academicYears.status.inactive')}
                  </SelectItem>
                </SelectContent>
              </Select>
              {Object.keys(rowSelection).length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedGrantable.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleBulkGrant}
                      disabled={bulkLoading}
                    >
                      <UserCheck className="mr-1.5 size-4" />
                      {t('adminAccounts.actions.bulkGrant', {
                        count: selectedGrantable.length,
                      })}
                    </Button>
                  )}
                  {selectedWithAccount.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResetDialogOpen(true)}
                      disabled={bulkLoading}
                    >
                      <KeyRound className="mr-1.5 size-4" />
                      {t('adminAccounts.actions.bulkResetPassword', {
                        count: selectedWithAccount.length,
                      })}
                    </Button>
                  )}
                </div>
              )}
            </>
          }
        />
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('adminAccounts.bulkResetPassword.confirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('adminAccounts.bulkResetPassword.confirm.description', {
                names: selectedWithAccount
                  .map((r) =>
                    formatPersonName(
                      r.catechist.saintName,
                      r.catechist.fullName,
                    ),
                  )
                  .join(', '),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkReset}>
              {t('adminAccounts.actions.bulkResetPassword', {
                count: selectedWithAccount.length,
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
