import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { UserCheck } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
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

function TransformStudentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [selectedYearId, setSelectedYearId] = React.useState<
    Id<'academicYears'> | ''
  >('')
  const [selectedClassYearId, setSelectedClassYearId] = React.useState<
    Id<'classYears'> | ''
  >('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const academicYears = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )
  const activeYear = useQuery(
    api.academicYears.getActive,
    requesterId ? { requesterId } : 'skip',
  )

  // Default year to active year if available and not explicitly selected
  React.useEffect(() => {
    if (activeYear && !selectedYearId) {
      setSelectedYearId(activeYear._id)
    }
  }, [activeYear, selectedYearId])

  const classYears = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const roster = useQuery(
    api.students.getRosterByClassYear,
    requesterId && selectedClassYearId
      ? {
          requesterId,
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

  const transformMutation = useMutation(
    api.catechists.transformStudentsToCatechists,
  )

  const selectedStudents = React.useMemo(() => {
    if (!roster) return []
    return roster.filter((r) => rowSelection[r.studentId])
  }, [roster, rowSelection])

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
    if (!requesterId || selectedCount === 0) return

    setSubmitting(true)
    try {
      const studentIds = selectedStudents.map((s) => s.studentId)
      const result = await transformMutation({
        requesterId,
        studentIds,
      })
      toast.success(t('students.transform.success', { count: result.count }))
      setRowSelection({})
      setConfirmOpen(false)
    } catch (err) {
      toast.error(translateConvexError(err, t, 'students.transform.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Array<ColumnDef<RosterRow>> = [
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

  const yearOptions = (academicYears ?? []).map((y) => ({
    value: y._id,
    label: y.name + (y.isActive ? ` (${t('academicYears.activeLabel')})` : ''),
  }))

  const classOptions = (classYears ?? []).map((c) => ({
    value: c.classYearId,
    label: c.className,
  }))

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
