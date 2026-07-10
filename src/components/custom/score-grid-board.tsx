import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Download, Edit, History, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { Textarea } from '../ui/textarea'
import { Field, FieldLabel } from '../ui/field'
import type { Id } from '../../../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export'
import { computeAnnualAvg, computeSemesterAvg } from '~/lib/grading'
import { exportCsv } from '~/lib/export'
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
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface ScoreGridBoardProps {
  classId: Id<'classes'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
  canManage?: boolean
}

type ConfirmActionType = 'deleteColumn' | 'clearColumn' | 'updateCell'

function ScoreCellDisplay({
  scoreValue,
  scoreLabel,
  scaleType,
}: {
  scoreValue?: number
  scoreLabel?: string
  scaleType: string
}) {
  if (scaleType === 'scale_10') {
    return scoreValue !== undefined ? (
      <span className="font-semibold text-sm">{scoreValue.toFixed(1)}</span>
    ) : (
      <span className="text-muted-foreground/30 text-xs">—</span>
    )
  }

  if (scaleType === 'pass_fail') {
    if (scoreLabel === 'pass') {
      return (
        <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
          Đạt
        </span>
      )
    }
    if (scoreLabel === 'fail') {
      return (
        <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
          Hỏng
        </span>
      )
    }
    return <span className="text-muted-foreground/30 text-xs">—</span>
  }

  // letter_af
  return scoreLabel ? (
    <span className="font-bold text-sm text-blue-600">{scoreLabel}</span>
  ) : (
    <span className="text-muted-foreground/30 text-xs">—</span>
  )
}

function ScorePopoverContent({
  studentName,
  columnName,
  scaleType,
  scoreEntryId,
  currentValue,
  currentLabel,
  onSave,
  isSaving,
  requesterId,
}: {
  studentName: string
  columnName: string
  scaleType: string
  scoreEntryId?: Id<'scoreEntries'>
  currentValue?: number
  currentLabel?: string
  onSave: (value?: number, label?: string, reason?: string) => void
  isSaving: boolean
  requesterId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const [val, setVal] = React.useState<string>(
    currentValue !== undefined ? currentValue.toString() : '',
  )
  const [lbl, setLbl] = React.useState<string>(currentLabel || '')
  const [reason, setReason] = React.useState<string>('')

  // Fetch history if entry exists
  const history = useQuery(
    api.grading.listScoreEntryHistory,
    scoreEntryId ? { requesterId, scoreEntryId } : 'skip',
  )

  const handleFormSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error(t('exams.popover.notesPlaceholder'))
      return
    }

    if (scaleType === 'scale_10') {
      const parsed = parseFloat(val)
      if (isNaN(parsed) || parsed < 0 || parsed > 10) {
        toast.error('Điểm số phải từ 0 đến 10')
        return
      }
      onSave(parsed, undefined, reason)
    } else if (scaleType === 'pass_fail') {
      if (!lbl) {
        toast.error('Vui lòng chọn trạng thái Đạt/Hỏng')
        return
      }
      onSave(undefined, lbl, reason)
    } else {
      // letter_af
      onSave(undefined, lbl.trim() || undefined, reason)
    }
  }

  return (
    <div className="w-80 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">{t('exams.popover.title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{studentName}</p>
        <p className="text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-1 inline-block">
          {columnName}
        </p>
      </div>

      <form onSubmit={handleFormSave} className="space-y-3">
        <Field>
          <FieldLabel>Điểm số</FieldLabel>
          {scaleType === 'scale_10' && (
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={isSaving}
              placeholder="0.0 - 10.0"
              required
            />
          )}
          {scaleType === 'pass_fail' && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={lbl === 'pass' ? 'default' : 'outline'}
                onClick={() => setLbl('pass')}
                className="flex-1 text-xs"
                disabled={isSaving}
              >
                Đạt (Pass)
              </Button>
              <Button
                type="button"
                variant={lbl === 'fail' ? 'destructive' : 'outline'}
                onClick={() => setLbl('fail')}
                className="flex-1 text-xs"
                disabled={isSaving}
              >
                Hỏng (Fail)
              </Button>
            </div>
          )}
          {scaleType === 'letter_af' && (
            <Input
              type="text"
              value={lbl}
              onChange={(e) => setLbl(e.target.value)}
              disabled={isSaving}
              placeholder="Ví dụ: A+, B-, C..."
            />
          )}
        </Field>

        <Field>
          <FieldLabel>Lý do thay đổi</FieldLabel>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            placeholder={t('exams.popover.notesPlaceholder')}
            rows={2}
            className="resize-none text-xs"
            required
          />
        </Field>

        <Button
          type="submit"
          size="sm"
          disabled={isSaving || !reason.trim()}
          className="w-full"
        >
          {t('exams.popover.saveBtn')}
        </Button>
      </form>

      {/* Audit History Timeline */}
      <div className="border-t pt-3 space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-1">
          <History className="h-3 w-3" />
          {t('exams.popover.historyTitle')}
        </h4>
        {!scoreEntryId ? (
          <p className="text-[10px] text-muted-foreground italic">
            Chưa ghi nhận điểm (Điểm gốc)
          </p>
        ) : history === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : history.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">
            Chưa có lịch sử cập nhật.
          </p>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-2 pr-1">
            {history.map((h) => {
              const formattedTime = format(new Date(h.changedAt), 'HH:mm dd/MM')
              return (
                <div
                  key={h._id}
                  className="text-[10px] border-b pb-1 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between font-semibold text-muted-foreground">
                    <span>{h.changedByName}</span>
                    <span>{formattedTime}</span>
                  </div>
                  <div className="mt-0.5 text-foreground">
                    Thay đổi:{' '}
                    <span className="font-medium text-primary">
                      {h.oldScoreValue !== undefined
                        ? h.oldScoreValue.toFixed(1)
                        : h.oldScoreLabel || 'Trống'}
                    </span>{' '}
                    →{' '}
                    <span className="font-semibold text-primary">
                      {h.newScoreValue !== undefined
                        ? h.newScoreValue.toFixed(1)
                        : h.newScoreLabel || 'Trống'}
                    </span>
                  </div>
                  {h.reason && (
                    <div className="text-gray-500 italic mt-0.5">
                      Lý do: {h.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ColumnActionsPopover({
  column,
  isSaving,
  onSave,
  onDelete,
}: {
  column: {
    _id: Id<'scoreColumns'>
    columnName: string
    columnType: string
    scaleType: 'scale_10' | 'pass_fail' | 'letter_af'
    weight: number
    examDate?: string
    sortOrder: number
  }
  isSaving: boolean
  onSave: (
    name: string,
    type: any,
    scale: any,
    weight: number,
    examDate: string | undefined,
    order: number,
  ) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = React.useState(column.columnName)
  const [type, setType] = React.useState(column.columnType)
  const [scale, setScale] = React.useState(column.scaleType)
  const [weight, setWeight] = React.useState(column.weight.toString())
  const [examDate, setExamDate] = React.useState(column.examDate ?? '')
  const [order, setOrder] = React.useState(column.sortOrder.toString())

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên cột điểm')
      return
    }
    onSave(
      name.trim(),
      type,
      scale,
      parseInt(weight) || 1,
      examDate || undefined,
      parseInt(order) || 0,
    )
  }

  return (
    <div className="w-72 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">
          {t('exams.columnActions.title')}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Cấu hình cột điểm khảo hạch
        </p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-3">
        <Field>
          <FieldLabel>{t('exams.create.name')}</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
            required
            className="h-8 text-xs"
          />
        </Field>

        <Field>
          <FieldLabel>{t('exams.create.type')}</FieldLabel>
          <datalist id="edit-exam-type-suggestions">
            <option value={t('exams.create.type.short_quiz')} />
            <option value={t('exams.create.type.midterm_test')} />
            <option value={t('exams.create.type.semester_exam')} />
          </datalist>
          <Input
            list="edit-exam-type-suggestions"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isSaving}
            placeholder={t('exams.create.type.placeholder')}
            className="h-8 text-xs"
          />
        </Field>

        <Field>
          <FieldLabel>{t('exams.create.scale')}</FieldLabel>
          <Select
            value={scale}
            onValueChange={(val: any) => setScale(val)}
            items={[
              { label: t('exams.create.scale.scale_10'), value: 'scale_10' },
              { label: t('exams.create.scale.pass_fail'), value: 'pass_fail' },
              { label: t('exams.create.scale.letter_af'), value: 'letter_af' },
            ]}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scale_10">
                {t('exams.create.scale.scale_10')}
              </SelectItem>
              <SelectItem value="pass_fail">
                {t('exams.create.scale.pass_fail')}
              </SelectItem>
              <SelectItem value="letter_af">
                {t('exams.create.scale.letter_af')}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{t('exams.create.weight')}</FieldLabel>
          <Input
            type="number"
            min={1}
            max={3}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            disabled={isSaving}
            required
            className="h-8 text-xs"
          />
        </Field>

        <Field>
          <FieldLabel>{t('exams.create.examDate')}</FieldLabel>
          <Input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            disabled={isSaving}
            className="h-8 text-xs"
          />
        </Field>

        <Field>
          <FieldLabel>{t('exams.create.sortOrder')}</FieldLabel>
          <Input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            disabled={isSaving}
            required
            className="h-8 text-xs"
          />
        </Field>

        <div className="flex gap-2 justify-between">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isSaving}
            className="h-8 text-xs flex gap-1 items-center"
          >
            <Trash2 className="h-3..5 w-3.5" />
            {t('common.delete')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="h-8 text-xs flex gap-1 items-center"
          >
            <Edit className="h-3.5 w-3.5" />
            Cập nhật
          </Button>
        </div>
      </form>
    </div>
  )
}

export function ScoreGridBoard({
  classId,
  academicYearId,
  requesterId,
  canManage = false,
}: ScoreGridBoardProps) {
  const { t } = useTranslation()
  const gridData = useQuery(api.grading.getScoresGrid, {
    classId,
    academicYearId,
    requesterId,
  })
  const appConfig = useQuery(api.appConfig.get)
  const nameFormat = appConfig?.nameFormat ?? 'firstName_lastName'

  const saveScoreEntry = useMutation(api.grading.upsertScoreEntry)
  const updateScoreColumn = useMutation(api.grading.updateScoreColumn)
  const softDeleteScoreColumn = useMutation(api.grading.softDeleteScoreColumn)

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedSemester, setSelectedSemester] = React.useState<string>('all')
  const [savingCellKey, setSavingCellKey] = React.useState<string | null>(null)
  const [savingColumnId, setSavingColumnId] =
    React.useState<Id<'scoreColumns'> | null>(null)

  const [confirmAction, setConfirmAction] = React.useState<{
    type: ConfirmActionType
    columnId?: Id<'scoreColumns'>
    columnName?: string
    cellData?: {
      studentId: Id<'students'>
      studentClassId: Id<'studentClasses'>
      studentName: string
      columnId: Id<'scoreColumns'>
      columnName: string
      value?: number
      label?: string
      reason: string
    }
  } | null>(null)

  const semesters = useQuery(api.academicYears.listSemesters, {
    requesterId,
    academicYearId,
  })

  const semesterOptions = React.useMemo(
    () =>
      (Array.isArray(semesters) ? semesters : []).map((semester) => ({
        label:
          semester.name ??
          t('semesters.numberLabel', {
            defaultValue: `Semester ${semester.semesterNumber}`,
            number: semester.semesterNumber,
          }),
        value: semester._id,
      })),
    [semesters, t],
  )

  const visibleColumns = React.useMemo(() => {
    if (!gridData) return []
    let list = gridData.scoreColumns
    if (selectedSemester !== 'all') {
      list = list.filter((c) => c.semesterId === selectedSemester)
    }
    return list
  }, [gridData, selectedSemester])

  // studentClassId -> semesterId -> avg (null when not yet computable)
  const semesterAvgByStudent = React.useMemo(() => {
    const map = new Map<string, Map<string, number | null>>()
    if (!gridData) return map

    for (const student of gridData.students) {
      const bySemester = new Map<string, number | null>()
      for (const semester of semesterOptions) {
        const columns = gridData.scoreColumns.filter(
          (c) => c.semesterId === semester.value,
        )
        const exams = columns.map((c) => ({
          scaleType: c.scaleType,
          weight: c.weight,
          scoreValue:
            gridData.scoreEntriesMap[`${student.studentClassId}_${c._id}`]
              .scoreValue,
        }))
        bySemester.set(semester.value, computeSemesterAvg(exams))
      }
      map.set(student.studentClassId, bySemester)
    }
    return map
  }, [gridData, semesterOptions])

  const annualAvgByStudent = React.useMemo(() => {
    const map = new Map<string, number | null>()
    if (!gridData) return map
    for (const student of gridData.students) {
      const semesterAvgs = semesterOptions.map(
        (s) =>
          semesterAvgByStudent.get(student.studentClassId)?.get(s.value) ??
          null,
      )
      map.set(student.studentClassId, computeAnnualAvg(semesterAvgs))
    }
    return map
  }, [gridData, semesterOptions, semesterAvgByStudent])

  const filteredStudents = React.useMemo(() => {
    if (!gridData) return []
    const query = searchQuery.trim().toLowerCase()
    let list = gridData.students
    if (query) {
      list = list.filter((student) => {
        const saint = (student.saintName || '').toLowerCase()
        const name = student.fullName.toLowerCase()
        const code = student.studentCode.toLowerCase()
        return (
          name.includes(query) || saint.includes(query) || code.includes(query)
        )
      })
    }
    return [...list].sort((a, b) => {
      const nameA = a.saintName ? `${a.saintName} ${a.fullName}` : a.fullName
      const nameB = b.saintName ? `${b.saintName} ${b.fullName}` : b.fullName

      if (nameFormat === 'firstName_lastName') {
        return nameA
          .toLocaleLowerCase()
          .localeCompare(nameB.toLocaleLowerCase())
      }
      const lastNameA = nameA.split(' ').pop() || ''
      const lastNameB = nameB.split(' ').pop() || ''
      return lastNameA
        .toLocaleLowerCase()
        .localeCompare(lastNameB.toLocaleLowerCase())
    })
  }, [gridData, searchQuery, nameFormat])

  const exportHeaders = React.useMemo<Array<string>>(
    () => [
      t('exams.grid.studentName'),
      t('students.col.studentCode'),
      ...visibleColumns.map((col) => col.columnName),
    ],
    [t, visibleColumns],
  )

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    if (!gridData) return []
    return filteredStudents.map((student) => {
      const fullName =
        student.saintName && student.fullName
          ? `${student.saintName} ${student.fullName}`
          : student.fullName
      const row: Record<string, CellValue> = {
        [exportHeaders[0]]: fullName,
        [exportHeaders[1]]: student.studentCode,
      }
      visibleColumns.forEach((col, i) => {
        const record = gridData.scoreEntriesMap[
          `${student.studentClassId}_${col._id}`
        ] as (typeof gridData.scoreEntriesMap)[string] | undefined
        let value = '—'
        if (col.scaleType === 'scale_10') {
          value =
            record?.scoreValue !== undefined
              ? record.scoreValue.toFixed(1)
              : '—'
        } else if (col.scaleType === 'pass_fail') {
          value =
            record?.scoreLabel === 'pass'
              ? 'Đạt'
              : record?.scoreLabel === 'fail'
                ? 'Hỏng'
                : '—'
        } else {
          value = record?.scoreLabel ?? '—'
        }
        row[exportHeaders[i + 2]] = value
      })
      return row
    })
  }, [gridData, filteredStudents, visibleColumns, exportHeaders])

  const handleExportCsv = () => {
    exportCsv(exportRows, 'bang-diem.csv', exportHeaders)
  }

  if (!gridData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (gridData.students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center bg-card">
        <p className="font-semibold text-muted-foreground">
          {t('exams.grid.noStudents')}
        </p>
      </div>
    )
  }

  const handleCellSave = (
    studentId: Id<'students'>,
    studentClassId: Id<'studentClasses'>,
    studentName: string,
    columnId: Id<'scoreColumns'>,
    columnName: string,
    value?: number,
    label?: string,
    reason?: string,
  ) => {
    setConfirmAction({
      type: 'updateCell',
      cellData: {
        studentId,
        studentClassId,
        studentName,
        columnId,
        columnName,
        value,
        label,
        reason: reason || '',
      },
    })
  }

  const handleUpdateColumnFields = async (
    columnId: Id<'scoreColumns'>,
    columnName: string,
    columnType: any,
    scaleType: any,
    weight: number,
    examDate: string | undefined,
    sortOrder: number,
  ) => {
    setSavingColumnId(columnId)
    try {
      await updateScoreColumn({
        requesterId,
        id: columnId,
        columnName,
        columnType,
        scaleType,
        weight,
        examDate,
        sortOrder,
      })
      toast.success(t('common.saved'))
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật thông tin cột điểm')
      console.error(err)
    } finally {
      setSavingColumnId(null)
    }
  }

  const handleConfirmedAction = async () => {
    if (!confirmAction) return
    const { type, columnId, cellData } = confirmAction

    try {
      if (type === 'deleteColumn' && columnId) {
        setSavingColumnId(columnId)
        await softDeleteScoreColumn({ requesterId, id: columnId })
        toast.success('Đã xóa cột điểm thành công')
      } else if (type === 'updateCell' && cellData) {
        const cellKey = `${cellData.studentClassId}_${cellData.columnId}`
        setSavingCellKey(cellKey)
        await saveScoreEntry({
          requesterId,
          studentClassId: cellData.studentClassId,
          scoreColumnId: cellData.columnId,
          scoreValue: cellData.value,
          scoreLabel: cellData.label,
          reason: cellData.reason,
        })
        toast.success(t('common.saved'))
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại')
      console.error(err)
    } finally {
      setConfirmAction(null)
      setSavingColumnId(null)
      setSavingCellKey(null)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <Input
            type="text"
            placeholder={t('exams.grid.toolbar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          <Select
            value={selectedSemester}
            onValueChange={(val) => {
              if (val) setSelectedSemester(val)
            }}
            items={[
              { label: t('attendance.summary.allSemesters'), value: 'all' },
              ...semesterOptions,
            ]}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('attendance.summary.allSemesters')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('attendance.summary.allSemesters')}
              </SelectItem>
              {semesterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={handleExportCsv}
          >
            <Download className="h-4 w-4" />
            <span>{t('classes.export.csv')}</span>
          </Button>
          {canManage && (
            <Link to="/classes/$id/exams/create" params={{ id: classId }}>
              <Button size="sm" className="gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                <span>{t('exams.grid.toolbar.createExam')}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg border bg-card flex flex-col overflow-hidden max-h-[600px]">
        <div className="overflow-auto min-w-0 flex-1">
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th
                  className="sticky left-0 top-0 z-40 border bg-background p-3 text-left text-sm font-semibold drop-shadow-lg"
                  style={{ minWidth: '220px' }}
                >
                  {t('exams.grid.studentName')}
                </th>
                {visibleColumns.length === 0 ? (
                  <th className="border bg-background p-3 text-center text-xs text-muted-foreground">
                    {t('exams.grid.noExams')}
                  </th>
                ) : (
                  visibleColumns.map((col) => {
                    const isSaving = savingColumnId === col._id
                    return (
                      <th
                        key={col._id}
                        className="sticky top-0 z-30 border bg-background p-2 text-center text-xs font-semibold select-none min-w-[130px]"
                      >
                        {canManage ? (
                          <Popover>
                            <PopoverTrigger
                              disabled={isSaving}
                              className="cursor-pointer hover:bg-accent/50 w-full rounded p-1.5 transition text-left block border border-transparent hover:border-border"
                            >
                              <div className="truncate font-semibold text-foreground text-center">
                                {col.columnName}
                              </div>
                              <div className="text-[10px] text-muted-foreground text-center mt-0.5">
                                {t(`exams.create.type.${col.columnType}`, {
                                  defaultValue: col.columnType,
                                })}
                              </div>
                              {col.examDate && (
                                <div className="text-[9px] text-muted-foreground/70 text-center mt-0.5">
                                  {format(new Date(col.examDate), 'dd/MM/yyyy')}
                                </div>
                              )}
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              align="center"
                              className="w-auto"
                            >
                              <ColumnActionsPopover
                                column={col}
                                isSaving={isSaving}
                                onSave={(
                                  name,
                                  type,
                                  scale,
                                  weight,
                                  examDate,
                                  order,
                                ) =>
                                  handleUpdateColumnFields(
                                    col._id,
                                    name,
                                    type,
                                    scale,
                                    weight,
                                    examDate,
                                    order,
                                  )
                                }
                                onDelete={() =>
                                  setConfirmAction({
                                    type: 'deleteColumn',
                                    columnId: col._id,
                                    columnName: col.columnName,
                                  })
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="p-1.5">
                            <div className="font-semibold truncate">
                              {col.columnName}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {t(`exams.create.type.${col.columnType}`, {
                                defaultValue: col.columnType,
                              })}
                            </div>
                            {col.examDate && (
                              <div className="text-[9px] text-muted-foreground/70 mt-0.5">
                                {format(new Date(col.examDate), 'dd/MM/yyyy')}
                              </div>
                            )}
                          </div>
                        )}
                      </th>
                    )
                  })
                )}
                {semesterOptions.map((semester) => (
                  <th
                    key={`avg-${semester.value}`}
                    className="sticky top-0 z-30 border bg-muted/50 p-2 text-center text-xs font-semibold min-w-[110px]"
                  >
                    {t('exams.grid.semesterAvg', { semester: semester.label })}
                  </th>
                ))}
                {selectedSemester === 'all' && semesterOptions.length > 0 && (
                  <th className="sticky top-0 z-30 border bg-amber-500/10 p-2 text-center text-xs font-semibold min-w-[110px]">
                    {t('exams.grid.annualAvg')}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student) => {
                const fullName =
                  student.saintName && student.fullName
                    ? `${student.saintName} ${student.fullName}`
                    : student.fullName
                return (
                  <tr
                    key={student.studentClassId}
                    className="hover:bg-accent/40 group transition-colors"
                  >
                    <td
                      className="sticky transition-colors left-0 z-20 border bg-background group-hover:bg-accent/50 p-2.5 text-sm drop-shadow-lg"
                      style={{ minWidth: '220px' }}
                    >
                      <div className="font-medium whitespace-nowrap">
                        {fullName}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {student.studentCode}
                      </div>
                    </td>
                    {visibleColumns.length === 0 ? (
                      <td className="border p-4 text-center text-xs text-muted-foreground">
                        —
                      </td>
                    ) : (
                      visibleColumns.map((col) => {
                        const cellKey = `${student.studentClassId}_${col._id}`
                        const record = gridData.scoreEntriesMap[cellKey] as
                          (typeof gridData.scoreEntriesMap)[string] | undefined
                        const isSaving = savingCellKey === cellKey

                        return (
                          <td
                            key={col._id}
                            className="border p-1 text-center align-middle"
                          >
                            {canManage ? (
                              <Popover>
                                <PopoverTrigger
                                  disabled={isSaving}
                                  className="h-10 w-full hover:bg-accent/50 border border-transparent hover:border-border rounded flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ScoreCellDisplay
                                    scoreValue={record?.scoreValue}
                                    scoreLabel={record?.scoreLabel}
                                    scaleType={col.scaleType}
                                  />
                                </PopoverTrigger>
                                <PopoverContent
                                  side="right"
                                  align="start"
                                  className="w-auto z-50"
                                >
                                  <ScorePopoverContent
                                    studentName={fullName}
                                    columnName={col.columnName}
                                    scaleType={col.scaleType}
                                    scoreEntryId={record?._id}
                                    currentValue={record?.scoreValue}
                                    currentLabel={record?.scoreLabel}
                                    requesterId={requesterId}
                                    isSaving={isSaving}
                                    onSave={(newVal, newLbl, reason) =>
                                      handleCellSave(
                                        student.studentId,
                                        student.studentClassId,
                                        fullName,
                                        col._id,
                                        col.columnName,
                                        newVal,
                                        newLbl,
                                        reason,
                                      )
                                    }
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <div className="h-10 w-full flex items-center justify-center">
                                <ScoreCellDisplay
                                  scoreValue={record?.scoreValue}
                                  scoreLabel={record?.scoreLabel}
                                  scaleType={col.scaleType}
                                />
                              </div>
                            )}
                          </td>
                        )
                      })
                    )}
                    {semesterOptions.map((semester) => {
                      const avg = semesterAvgByStudent
                        .get(student.studentClassId)
                        ?.get(semester.value)
                      return (
                        <td
                          key={`avg-${semester.value}`}
                          className="border bg-muted/30 p-1 text-center align-middle text-sm font-semibold"
                        >
                          {avg !== null && avg !== undefined ? (
                            avg.toFixed(1)
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {selectedSemester === 'all' &&
                      semesterOptions.length > 0 &&
                      (() => {
                        const annualAvg = annualAvgByStudent.get(
                          student.studentClassId,
                        )
                        return (
                          <td className="border bg-amber-500/10 p-1 text-center align-middle text-sm font-bold">
                            {annualAvg !== null && annualAvg !== undefined ? (
                              annualAvg.toFixed(1)
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">
                                —
                              </span>
                            )}
                          </td>
                        )
                      })()}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for cell updates & column deletions */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <AlertDialogContent>
          {confirmAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction.type === 'deleteColumn'
                    ? t('exams.columnActions.confirmDeleteTitle')
                    : 'Xác nhận lưu điểm số'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction.type === 'deleteColumn'
                    ? t('exams.columnActions.confirmDeleteDesc', {
                        name: confirmAction.columnName,
                      })
                    : `Bạn có chắc muốn lưu điểm mới cho học sinh ${confirmAction.cellData?.studentName}?\nHành động này sẽ tạo nhật ký thay đổi và lưu vào hệ thống.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmedAction}
                  className={
                    confirmAction.type === 'deleteColumn'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/95'
                      : ''
                  }
                >
                  {confirmAction.type === 'deleteColumn'
                    ? t('common.delete')
                    : t('common.save')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
