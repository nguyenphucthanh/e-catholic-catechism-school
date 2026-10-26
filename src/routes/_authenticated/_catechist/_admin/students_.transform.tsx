import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, UserCheck } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type { RowSelectionState } from '@tanstack/react-table'
import type { Id } from '../../../../../convex/_generated/dataModel'
import type { TableColumnDef } from '~/components/custom/data-table'
import type { IssuedCredential } from '~/lib/export'
import type { FunctionReturnType } from 'convex/server'
import { translateConvexError } from '~/lib/convex-errors'
import { PageHeader } from '~/components/page-header'
import { IssuedCredentialsDialog } from '~/components/custom/issued-credentials-dialog'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/students_/transform',
)({
  component: TransformStudentsPage,
  staticData: {
    crumbs: [{ label: 'nav.admin' }, { label: 'students.transform.title' }],
  },
})

type RosterRow = {
  studentClassId: Id<'studentClasses'>
  studentId: Id<'students'>
  studentCode: string
  fullName: string
  saintName: string | undefined
  gender: 'male' | 'female' | undefined
}

type TransformedResultItem = FunctionReturnType<
  typeof api.catechists.transformStudentsToCatechists
>['items'][number]

function TransformStudentsPage() {
  const { t } = useTranslation()

  const [selectedYearId, setSelectedYearId] = React.useState<
    Id<'academicYears'> | ''
  >('')
  const [selectedClassYearId, setSelectedClassYearId] = React.useState<
    Id<'classYears'> | ''
  >('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [transformResult, setTransformResult] =
    React.useState<Array<TransformedResultItem> | null>(null)
  const [issued, setIssued] = React.useState<Array<IssuedCredential> | null>(
    null,
  )

  const academicYears = useQuery(api.academicYears.list, {})
  const activeYear = useQuery(api.academicYears.getActive, {})

  // Default year to active year if available and not explicitly selected
  React.useEffect(() => {
    if (activeYear && !selectedYearId) {
      setSelectedYearId(activeYear._id)
    }
  }, [activeYear, selectedYearId])

  const classYears = useQuery(
    api.classes.listClassYears,
    selectedYearId ? { academicYearId: selectedYearId } : 'skip',
  )

  const roster = useQuery(
    api.students.getRosterByClassYear,
    selectedClassYearId
      ? {
          classYearId: selectedClassYearId,
        }
      : 'skip',
  )

  // Reset class and selection when year changes
  React.useEffect(() => {
    setSelectedClassYearId('')
    setRowSelection({})
  }, [selectedYearId])

  // Reset row selection when class changes
  React.useEffect(() => {
    setRowSelection({})
  }, [selectedClassYearId])

  const transformMutation = useAction(
    api.catechists.transformStudentsToCatechists,
  )

  const selectedStudents = React.useMemo(() => {
    return roster ?? []
  }, [roster])

  const selectedCount = selectedStudents.length

  const handleOpenConfirm = () => {
    if (!selectedClassYearId) {
      toast.error(t('students.transform.noClass'))
      return
    }
    if (selectedCount === 0) {
      toast.error(t('students.transform.noSelection'))
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmTransform = async () => {
    if (selectedCount === 0) return

    setSubmitting(true)
    try {
      const studentIds = selectedStudents.map((s) => s.studentId)
      const result = await transformMutation({
        studentIds,
      })
      toast.success(t('students.transform.success', { count: result.count }))
      setRowSelection({})
      setConfirmOpen(false)
      setTransformResult(result.items)
      if (result.credentials.length > 0) setIssued(result.credentials)
    } catch (err) {
      toast.error(translateConvexError(err, t, 'students.transform.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Array<TableColumnDef<RosterRow>> = [
    {
      id: 'select',
      header: ({ table }) => {
        const rows = table.getRowModel().rows
        const allSelected =
          rows.length > 0 && rows.every((r) => r.getIsSelected())
        const someSelected = !allSelected && rows.some((r) => r.getIsSelected())
        return (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            disabled={rows.length === 0}
            onCheckedChange={(value) =>
              rows.forEach((r) => r.toggleSelected(!!value))
            }
            aria-label="Select all"
          />
        )
      },
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
  ]

  const resultColumns: Array<TableColumnDef<TransformedResultItem>> = [
    {
      accessorKey: 'memberId',
      header: t('students.transform.result.col.memberId'),
    },
    {
      accessorKey: 'saintName',
      header: t('students.transform.result.col.saintName'),
      cell: ({ row }) => row.original.saintName ?? '—',
    },
    {
      accessorKey: 'fullName',
      header: t('students.transform.result.col.fullName'),
    },
    {
      accessorKey: 'loginId',
      header: t('students.transform.result.col.loginId'),
      cell: ({ row }) => (
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">
          {row.original.loginId}
        </code>
      ),
    },
  ]

  const yearOptions = (academicYears ?? []).map((y) => ({
    value: y._id,
    label: y.name + (y.isActive ? ` (${t('academicYears.activeLabel')})` : ''),
  }))

  const classOptions = (classYears ?? []).map((c) => ({
    value: c.classYearId,
    label: c.className,
  }))

  if (transformResult) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={CheckCircle2}
          title={t('students.transform.result.title')}
          subtitle={t('students.transform.result.subtitle', {
            count: transformResult.length,
          })}
        />

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setTransformResult(null)}>
            {t('students.transform.result.backButton')}
          </Button>

          <Button render={<Link to="/catechists" />}>
            {t('students.transform.result.viewCatechistsButton')}
          </Button>
        </div>

        <DataTable
          columns={resultColumns}
          data={transformResult}
          getRowId={(row) => row.catechistId}
        />

        <IssuedCredentialsDialog
          mode="bulk"
          credentials={issued}
          csvAction="chuyen-doi"
          onClose={() => setIssued(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserCheck}
        title={t('students.transform.title')}
        subtitle={t('students.transform.subtitle')}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <Field>
            <FieldLabel>{t('students.transform.yearLabel')}</FieldLabel>
            <Select
              value={selectedYearId}
              onValueChange={(val: any) => setSelectedYearId(val)}
              items={yearOptions}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('students.transform.yearPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y.value} value={y.value}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="bg-card border rounded-xl p-4 space-y-3">
          <Field>
            <FieldLabel>{t('students.transform.classLabel')}</FieldLabel>
            <Select
              value={selectedClassYearId}
              onValueChange={(val: any) => setSelectedClassYearId(val)}
              disabled={!selectedYearId || classOptions.length === 0}
              items={classOptions}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('students.transform.classPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {selectedClassYearId && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {t('students.rosterTitle', { count: roster?.length ?? 0 })}
            </h3>
            <Button
              onClick={handleOpenConfirm}
              disabled={selectedCount === 0 || submitting}
            >
              {t('students.transform.submitButton', { count: selectedCount })}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={roster ?? []}
            getRowId={(row) => row.studentId}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            emptyText={t('students.transform.rosterEmpty')}
          />
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('students.transform.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('students.transform.confirmDescription', {
                count: selectedCount,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              {t('students.transform.cancelButton')}
            </Button>
            <Button onClick={handleConfirmTransform} disabled={submitting}>
              {submitting
                ? t('common.saving')
                : t('students.transform.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
