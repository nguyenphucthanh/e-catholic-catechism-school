import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { ENROLLMENT_ERRORS } from '../../../../convex/lib/errors'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Field, FieldLabel } from '~/components/ui/field'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/promote',
)({
  component: PromoteStudentsPage,
  staticData: {
    crumbs: [{ label: 'nav.admin' }, { label: 'students.promote.title' }],
  },
})

type RosterRow = {
  studentClassId: Id<'studentClasses'>
  studentId: Id<'students'>
  studentCode: string
  fullName: string
  saintName: string | undefined
  gender: 'male' | 'female' | undefined
  alreadyEnrolledInTargetYear: boolean
}

function PromoteStudentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [sourceYearId, setSourceYearId] = React.useState<
    Id<'academicYears'> | ''
  >('')
  const [sourceClassYearId, setSourceClassYearId] = React.useState<
    Id<'classYears'> | ''
  >('')
  const [targetClassYearId, setTargetClassYearId] = React.useState<
    Id<'classYears'> | ''
  >('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [submitting, setSubmitting] = React.useState(false)

  const academicYears = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )
  const activeYear = useQuery(
    api.academicYears.getActive,
    requesterId ? { requesterId } : 'skip',
  )

  const sourceYearOptions = React.useMemo(
    () => (academicYears ?? []).filter((y) => !y.isActive),
    [academicYears],
  )

  const sourceClassYears = useQuery(
    api.classes.listClassYears,
    requesterId && sourceYearId
      ? { requesterId, academicYearId: sourceYearId }
      : 'skip',
  )
  const targetClassYears = useQuery(
    api.classes.listClassYears,
    requesterId && activeYear
      ? { requesterId, academicYearId: activeYear._id }
      : 'skip',
  )

  const roster = useQuery(
    api.students.getEligibleForTransfer,
    requesterId && sourceClassYearId && activeYear
      ? {
          requesterId,
          sourceClassYearId,
          targetAcademicYearId: activeYear._id,
        }
      : 'skip',
  )

  // Changing the source year invalidates the previously picked source class.
  React.useEffect(() => {
    setSourceClassYearId('')
    setRowSelection({})
  }, [sourceYearId])

  // Changing the source class invalidates the previous roster selection.
  React.useEffect(() => {
    setRowSelection({})
  }, [sourceClassYearId])

  const enrollMutation = useMutation(api.students.enrollStudents)

  const selectedCount = React.useMemo(
    () => Object.values(rowSelection).filter(Boolean).length,
    [rowSelection],
  )

  const handleSubmit = async () => {
    if (!requesterId || !roster) return
    if (!targetClassYearId) {
      toast.error(t('students.promote.noTargetClass'))
      return
    }
    const selectedStudentIds = roster
      .filter(
        (r) => rowSelection[r.studentId] && !r.alreadyEnrolledInTargetYear,
      )
      .map((r) => r.studentId)
    if (selectedStudentIds.length === 0) {
      toast.error(t('students.promote.noSelection'))
      return
    }

    setSubmitting(true)
    try {
      await enrollMutation({
        requesterId,
        studentIds: selectedStudentIds,
        classYearId: targetClassYearId,
        isPrimaryClass: true,
        enrolledDate: new Date().toLocaleDateString('sv-SE'),
      })
      toast.success(
        t('students.promote.success', { count: selectedStudentIds.length }),
      )
      setSourceClassYearId('')
      setTargetClassYearId('')
      setRowSelection({})
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)) {
        toast.error(t('students.promote.conflictError'))
      } else {
        toast.error(t('students.promote.error'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Array<ColumnDef<RosterRow>> = [
    {
      id: 'select',
      header: ({ table }) => {
        const rows = table.getRowModel().rows
        const selectable = rows.filter(
          (r) => !r.original.alreadyEnrolledInTargetYear,
        )
        const allSelected =
          selectable.length > 0 && selectable.every((r) => r.getIsSelected())
        const someSelected =
          !allSelected && selectable.some((r) => r.getIsSelected())
        return (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            disabled={selectable.length === 0}
            onCheckedChange={(value) =>
              selectable.forEach((r) => r.toggleSelected(!!value))
            }
            aria-label="Select all"
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          disabled={row.original.alreadyEnrolledInTargetYear}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'studentCode',
      header: t('students.col.studentCode'),
    },
    {
      accessorKey: 'saintName',
      header: t('students.col.saintName'),
    },
    {
      accessorKey: 'fullName',
      header: t('students.col.fullName'),
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
      id: 'status',
      header: t('students.col.status'),
      cell: ({ row }) =>
        row.original.alreadyEnrolledInTargetYear ? (
          <Badge variant="secondary">
            {t('students.promote.alreadyEnrolledBadge')}
          </Badge>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ArrowRightLeft}
        title={t('students.promote.title')}
        subtitle={t('students.promote.subtitle')}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">{t('students.promote.sourceTitle')}</h3>
          <Field>
            <FieldLabel>{t('students.promote.sourceYearLabel')}</FieldLabel>
            <Select
              value={sourceYearId}
              onValueChange={(val: any) => setSourceYearId(val)}
              items={sourceYearOptions.map((y) => ({
                value: y._id,
                label: y.name,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('students.promote.sourceYearPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {sourceYearOptions.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {t('students.promote.noSourceYears')}
                  </div>
                ) : (
                  sourceYearOptions.map((y) => (
                    <SelectItem key={y._id} value={y._id}>
                      {y.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('students.promote.sourceClassLabel')}</FieldLabel>
            <Select
              value={sourceClassYearId}
              onValueChange={(val: any) => setSourceClassYearId(val)}
              disabled={!sourceYearId}
              items={(sourceClassYears ?? []).map((c) => ({
                value: c.classYearId,
                label: c.className,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('students.promote.sourceClassPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {(sourceClassYears ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {t('students.promote.noSourceClasses')}
                  </div>
                ) : (
                  (sourceClassYears ?? []).map((c) => (
                    <SelectItem key={c.classYearId} value={c.classYearId}>
                      {c.className}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="bg-card border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">{t('students.promote.targetTitle')}</h3>
          {activeYear === undefined ? null : activeYear === null ? (
            <p className="text-sm text-muted-foreground">
              {t('students.promote.noActiveYear')}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{activeYear.name}</p>
              <Field>
                <FieldLabel>
                  {t('students.promote.targetClassLabel')}
                </FieldLabel>
                <Select
                  value={targetClassYearId}
                  onValueChange={(val: any) => setTargetClassYearId(val)}
                  items={(targetClassYears ?? []).map((c) => ({
                    value: c.classYearId,
                    label: c.className,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t('students.promote.targetClassPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(targetClassYears ?? []).length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('students.promote.noTargetClasses')}
                      </div>
                    ) : (
                      (targetClassYears ?? []).map((c) => (
                        <SelectItem key={c.classYearId} value={c.classYearId}>
                          {c.className}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
        {!sourceClassYearId ? (
          <div className="text-center p-8 text-muted-foreground">
            {t('students.promote.selectSourceClassPrompt')}
          </div>
        ) : roster !== undefined && roster.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            {t('students.promote.rosterEmpty')}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={roster ?? []}
            isLoading={roster === undefined}
            disableSearch
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={(row) => row.studentId}
          />
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {t('students.promote.selectedCount', { count: selectedCount })}
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!targetClassYearId || selectedCount === 0 || submitting}
          >
            {submitting ? t('common.saving') : t('students.promote.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
