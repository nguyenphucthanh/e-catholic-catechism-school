import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { BRANCH_ERRORS } from '../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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

export const Route = createFileRoute('/_authenticated/branches')({
  component: BranchesPage,
  staticData: { crumb: 'branches.title' },
})

type Branch = Doc<'branches'>

type DialogState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; branch: Branch }

function BranchesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isBoard = user?.role === 'board'
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branches = useQuery(api.branches.list)
  const createBranchMutation = useMutation(api.branches.create)
  const updateBranchMutation = useMutation(api.branches.update)
  const deleteMutation = useMutation(api.branches.softDelete)
  const reorderMutation = useMutation(api.branches.reorder)

  const [dialogState, setDialogState] = React.useState<DialogState>({
    mode: 'closed',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<Branch | null>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

  if (!isBoard) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.unauthorized', 'Unauthorized access. Board role required.')}
      </div>
    )
  }

  const closeDialog = () => {
    setDialogState({ mode: 'closed' })
    setFormDirty(false)
  }

  const requestCloseDialog = () => {
    if (formDirty) {
      setConfirmLeaveOpen(true)
    } else {
      closeDialog()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        branchId: deleteTarget._id,
      })
      toast.success(t('branches.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(BRANCH_ERRORS.IN_USE_BY_CLASS)) {
        toast.error(t('branches.deleteInUseError'))
      } else {
        toast.error(t('branches.deleteError'))
      }
    }
  }

  const handleReorder = async (
    branchId: Id<'branches'>,
    direction: 'up' | 'down',
  ) => {
    if (!requesterId) return
    try {
      await reorderMutation({ requesterId, branchId, direction })
    } catch (err: any) {
      toast.error(t('branches.reorderError', 'Failed to reorder branch'))
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
                disabled={isFirst}
                onClick={() => handleReorder(branch._id, 'up')}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={isLast}
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
    },
    {
      accessorKey: 'description',
      header: t('branches.col.description'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
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
                onClick={() => setDialogState({ mode: 'edit', branch })}
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
          <Button
            onClick={() => setDialogState({ mode: 'create' })}
            className="flex gap-2"
          >
            <Plus className="size-4" />
            {t('branches.actions.create')}
          </Button>
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

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) requestCloseDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === 'edit'
                ? t('branches.dialog.edit')
                : t('branches.dialog.create')}
            </DialogTitle>
          </DialogHeader>
          {dialogState.mode !== 'closed' && requesterId && (
            <BranchForm
              key={
                dialogState.mode === 'edit' ? dialogState.branch._id : 'create'
              }
              initialValues={
                dialogState.mode === 'edit' ? dialogState.branch : undefined
              }
              requesterId={requesterId}
              createMutation={createBranchMutation}
              updateMutation={updateBranchMutation}
              onSuccess={closeDialog}
              onCancel={requestCloseDialog}
              onDirtyChange={setFormDirty}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm leave unsaved changes */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('branches.confirmLeave.title', 'Discard unsaved changes?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'branches.confirmLeave.description',
                'You have unsaved changes that will be lost.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                closeDialog()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('branches.confirmLeave.discard', 'Discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function BranchForm({
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  initialValues?: Branch
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    name: string
    description?: string
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    branchId: Id<'branches'>
    name?: string
    description?: string
  }) => Promise<unknown>
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const branchId = initialValues?._id

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!value.name) return

      try {
        if (branchId) {
          await updateMutation({
            requesterId,
            branchId,
            name: value.name,
            description: value.description || undefined,
          })
        } else {
          await createMutation({
            requesterId,
            name: value.name,
            description: value.description || undefined,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(BRANCH_ERRORS.DUPLICATE_NAME)) {
          toast.error(t('branches.fields.name.duplicate'))
        } else {
          toast.error(t('branches.saveError'))
        }
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="name"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="name">
              {t('branches.fields.name')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="name"
              placeholder={t('branches.fields.name.placeholder')}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <form.Field
        name="description"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="description">
              {t('branches.fields.description')}
            </FieldLabel>
            <Textarea
              id="description"
              placeholder={t('branches.fields.description.placeholder')}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <form.Subscribe
          selector={(s) => ({ isSubmitting: s.isSubmitting })}
          children={({ isSubmitting }) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          )}
        />
      </div>
    </form>
  )
}
