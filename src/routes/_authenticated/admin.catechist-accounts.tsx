import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
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
import { api } from '../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
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

export const Route = createFileRoute(
  '/_authenticated/admin/catechist-accounts',
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

  const data = useQuery(
    api.accountAdmin.listCatechistAccounts,
    requesterId ? { requesterId } : 'skip',
  )

  const grantAccount = useMutation(api.accountAdmin.grantCatechistAccount)
  const resetPassword = useMutation(api.accountAdmin.resetPassword)
  const toggleStatus = useMutation(api.accountAdmin.toggleAccountStatus)

  const [loadingId, setLoadingId] = React.useState<string | null>(null)

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

  const columns: Array<ColumnDef<CatechistRow>> = [
    {
      accessorKey: 'catechist.memberId',
      header: t('catechists.col.memberId'),
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.catechist.memberId.toString().padStart(6, '0')}
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
        {data === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchColumnKey="catechist.fullName"
            searchPlaceholder={t('catechists.searchPlaceholder')}
          />
        )}
      </div>
    </div>
  )
}
