import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, ListPlus, MoreHorizontal, Plus } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { CLASS_ERRORS } from '../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export const Route = createFileRoute('/_authenticated/classes')({
  component: ClassesPage,
  staticData: { crumb: 'classes.title' },
})

type Class = Doc<'classes'>

type DialogState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; class: Class }

function ClassesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const classes = useQuery(
    api.classes.list,
    requesterId ? { requesterId } : 'skip',
  )
  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const createClassMutation = useMutation(api.classes.create)
  const updateClassMutation = useMutation(api.classes.update)
  const deleteMutation = useMutation(api.classes.softDelete)

  const [dialogState, setDialogState] = React.useState<DialogState>({
    mode: 'closed',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<Class | null>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

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
                onClick={() => setDialogState({ mode: 'edit', class: cls })}
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
                className="flex gap-2"
              >
                <ListPlus className="size-4" />
                {t('classes.actions.bulkCreate')}
              </Button>
            )}
            {canManage && (
              <Button
                onClick={() => setDialogState({ mode: 'create' })}
                className="flex gap-2"
              >
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
            data={classes}
            searchColumnKey="name"
            searchPlaceholder={t('classes.searchPlaceholder')}
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
                ? t('classes.dialog.edit')
                : t('classes.dialog.create')}
            </DialogTitle>
          </DialogHeader>
          {dialogState.mode !== 'closed' && requesterId && (
            <ClassForm
              key={
                dialogState.mode === 'edit' ? dialogState.class._id : 'create'
              }
              initialValues={
                dialogState.mode === 'edit' ? dialogState.class : undefined
              }
              requesterId={requesterId}
              createMutation={createClassMutation}
              updateMutation={updateClassMutation}
              branches={branches ?? []}
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
              {t('classes.confirmLeave.title', 'Discard unsaved changes?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'classes.confirmLeave.description',
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
              {t('classes.confirmLeave.discard', 'Discard')}
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

function ClassForm({
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  branches,
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  initialValues?: Class
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    branchId: Id<'branches'>
    name: string
    description?: string
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    classId: Id<'classes'>
    name?: string
    description?: string
  }) => Promise<unknown>
  branches: Array<Doc<'branches'>>
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const classId = initialValues?._id

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      branchId: initialValues?.branchId ?? '',
      description: initialValues?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!value.name || !value.branchId) return

      try {
        if (classId) {
          await updateMutation({
            requesterId,
            classId,
            name: value.name,
            description: value.description || undefined,
          })
        } else {
          await createMutation({
            requesterId,
            branchId: value.branchId as Id<'branches'>,
            name: value.name,
            description: value.description || undefined,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(CLASS_ERRORS.DUPLICATE_NAME)) {
          toast.error(t('classes.fields.name.duplicate'))
        } else {
          toast.error(t('classes.saveError'))
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
              {t('classes.fields.name')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="name"
              placeholder={t('classes.fields.name.placeholder')}
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
        name="branchId"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="branchId">
              {t('classes.fields.branch')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={field.state.value}
              onValueChange={(val) => {
                field.handleChange(val as string)
                onDirtyChange(true)
              }}
              disabled={!!classId}
            >
              <SelectTrigger id="branchId" onBlur={field.handleBlur}>
                <SelectValue
                  placeholder={t('classes.fields.branch.placeholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!field.state.value && field.state.meta.isTouched && (
              <FieldError>{t('classes.fields.branch.required')}</FieldError>
            )}
            {field.state.value && field.state.meta.errors.length > 0 && (
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
              {t('classes.fields.description')}
            </FieldLabel>
            <Textarea
              id="description"
              placeholder={t('classes.fields.description.placeholder')}
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
          selector={(s) => ({
            isSubmitting: s.isSubmitting,
            canSubmit: s.canSubmit && !!form.state.values.branchId,
          })}
          children={({ isSubmitting, canSubmit }) => (
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          )}
        />
      </div>
    </form>
  )
}
