import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, MoreHorizontal, Plus } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { ACADEMIC_YEAR_ERRORS } from '../../../convex/lib/errors'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { DEFAULT_TIMEZONE, formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { DateInput } from '~/components/custom/date-input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
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

export const Route = createFileRoute('/_authenticated/academic-years')({
  component: AcademicYearsPage,
  staticData: { crumb: 'academicYears.title' },
})

type AcademicYear = Doc<'academicYears'>

type DialogState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; year: AcademicYear }

function AcademicYearsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isBoard = user?.role === 'board'
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const years = useQuery(api.academicYears.list)
  const createYearMutation = useMutation(api.academicYears.create)
  const updateYearMutation = useMutation(api.academicYears.update)
  const setActiveMutation = useMutation(api.academicYears.setActive)
  const deleteMutation = useMutation(api.academicYears.softDelete)

  const [dialogState, setDialogState] = React.useState<DialogState>({
    mode: 'closed',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<AcademicYear | null>(
    null,
  )
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

  const handleSetActive = async (yearId: Id<'academicYears'>) => {
    if (!requesterId) return
    try {
      await setActiveMutation({ requesterId, academicYearId: yearId })
      toast.success(t('academicYears.setActiveSuccess'))
    } catch {
      toast.error(t('academicYears.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !requesterId) return
    try {
      await deleteMutation({
        requesterId,
        academicYearId: deleteTarget._id,
      })
      toast.success(t('academicYears.deleted'))
      setDeleteTarget(null)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE)) {
        toast.error(t('academicYears.deleteActiveError'))
      } else {
        toast.error(t('academicYears.deleteError'))
      }
    }
  }

  const columns: Array<ColumnDef<AcademicYear>> = [
    {
      accessorKey: 'name',
      header: t('academicYears.col.name'),
    },
    {
      accessorKey: 'startDate',
      header: t('academicYears.col.startDate'),
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      accessorKey: 'endDate',
      header: t('academicYears.col.endDate'),
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    {
      accessorKey: 'isActive',
      header: t('academicYears.col.status'),
      cell: ({ row }) => {
        const active = row.original.isActive
        return (
          <Badge variant={active ? 'default' : 'secondary'}>
            {active
              ? t('academicYears.status.active')
              : t('academicYears.status.inactive')}
          </Badge>
        )
      },
    },
  ]

  // Add actions column if user has board privileges
  if (isBoard) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const year = row.original
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
                disabled={year.isActive}
                onClick={() => handleSetActive(year._id)}
              >
                {t('academicYears.actions.setActive')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDialogState({ mode: 'edit', year })}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => setDeleteTarget(year)}
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarRange}
        title={t('academicYears.title')}
        subtitle={t('academicYears.subtitle')}
        actions={
          isBoard && (
            <Button
              onClick={() => setDialogState({ mode: 'create' })}
              className="flex gap-2"
            >
              <Plus className="size-4" />
              {t('academicYears.actions.create')}
            </Button>
          )
        }
      />

      <div className="bg-card border rounded-xl p-4">
        {years === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={years}
            searchColumnKey="name"
            searchPlaceholder={t('academicYears.select_year')}
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
                ? t('academicYears.dialog.edit')
                : t('academicYears.dialog.create')}
            </DialogTitle>
          </DialogHeader>
          {dialogState.mode !== 'closed' && requesterId && (
            <AcademicYearForm
              key={
                dialogState.mode === 'edit' ? dialogState.year._id : 'create'
              }
              initialValues={
                dialogState.mode === 'edit' ? dialogState.year : undefined
              }
              requesterId={requesterId}
              createMutation={createYearMutation}
              updateMutation={updateYearMutation}
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
              {t(
                'academicYears.confirmLeave.title',
                'Discard unsaved changes?',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'academicYears.confirmLeave.description',
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
              {t('academicYears.confirmLeave.discard', 'Discard')}
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
            <AlertDialogTitle>
              {t('academicYears.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('academicYears.delete.description', {
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
              {t('academicYears.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AcademicYearForm({
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  initialValues?: AcademicYear
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    name: string
    startDate: string
    endDate: string
    timezone: string
    numberOfSemesters: number
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    academicYearId: Id<'academicYears'>
    name?: string
    startDate?: string
    endDate?: string
    timezone?: string
  }) => Promise<unknown>
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const yearId = initialValues?._id

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      startDate: initialValues?.startDate ?? '',
      endDate: initialValues?.endDate ?? '',
      numberOfSemesters: !yearId ? 2 : undefined,
    },
    onSubmit: async ({ value }) => {
      // Basic validation
      if (!value.name || !value.startDate || !value.endDate) {
        return
      }

      // Start date must be before end date
      if (new Date(value.startDate) >= new Date(value.endDate)) {
        toast.error(t('academicYears.fields.endDate.refine'))
        return
      }

      try {
        if (yearId) {
          await updateMutation({
            requesterId,
            academicYearId: yearId,
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            timezone: DEFAULT_TIMEZONE,
          })
        } else {
          await createMutation({
            requesterId,
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            timezone: DEFAULT_TIMEZONE,
            numberOfSemesters: value.numberOfSemesters!,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)) {
          toast.error(t('academicYears.fields.name.duplicate'))
        } else if (msg.includes(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)) {
          toast.error(t('academicYears.fields.numberOfSemesters.error'))
        } else {
          toast.error(t('academicYears.saveError'))
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">
              {t('academicYears.fields.name')}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t('academicYears.fields.name.placeholder')}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange(true)
              }}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <form.Field
        name="startDate"
        children={(field) => {
          const dateValue = field.state.value
            ? new Date(field.state.value)
            : undefined

          const handleDateChange = (date: Date | undefined) => {
            if (date) {
              const yr = date.getFullYear()
              const mo = String(date.getMonth() + 1).padStart(2, '0')
              const dy = String(date.getDate()).padStart(2, '0')
              field.handleChange(`${yr}-${mo}-${dy}`)
            } else {
              field.handleChange('')
            }
            onDirtyChange(true)
          }

          return (
            <div className="flex flex-col gap-1.5">
              <Label>
                {t('academicYears.fields.startDate')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <DateInput
                value={dateValue}
                onChange={handleDateChange}
                placeholder={t('academicYears.fields.startDate')}
              />
            </div>
          )
        }}
      />

      <form.Field
        name="endDate"
        children={(field) => {
          const dateValue = field.state.value
            ? new Date(field.state.value)
            : undefined

          const handleDateChange = (date: Date | undefined) => {
            if (date) {
              const yr = date.getFullYear()
              const mo = String(date.getMonth() + 1).padStart(2, '0')
              const dy = String(date.getDate()).padStart(2, '0')
              field.handleChange(`${yr}-${mo}-${dy}`)
            } else {
              field.handleChange('')
            }
            onDirtyChange(true)
          }

          return (
            <div className="flex flex-col gap-1.5">
              <Label>
                {t('academicYears.fields.endDate')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <DateInput
                value={dateValue}
                onChange={handleDateChange}
                placeholder={t('academicYears.fields.endDate')}
              />
            </div>
          )
        }}
      />

      {!yearId && (
        <form.Field
          name="numberOfSemesters"
          validators={{
            onChange: ({ value }) => {
              if (value === undefined) return undefined
              if (!Number.isInteger(value) || value < 1 || value > 4) {
                return t('academicYears.fields.numberOfSemesters.error')
              }
              return undefined
            },
          }}
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numberOfSemesters">
                {t('academicYears.fields.numberOfSemesters')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="numberOfSemesters"
                type="number"
                min={1}
                max={4}
                value={field.state.value ?? ''}
                onChange={(e) => {
                  field.handleChange(Number(e.target.value))
                  onDirtyChange(true)
                }}
                onBlur={field.handleBlur}
              />
              <p className="text-muted-foreground text-sm">
                {t('academicYears.fields.numberOfSemesters.hint')}
              </p>
              {field.state.meta.errors.length > 0 && (
                <p className="text-destructive text-sm mt-1">
                  {field.state.meta.errors.join(', ')}
                </p>
              )}
            </div>
          )}
        />
      )}

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
