import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Save } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export'
import { exportCsv } from '~/lib/export'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

type StudentRow = {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

interface EvaluationsBoardProps {
  classYearId: Id<'classYears'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
  canManage?: boolean
  students: Array<StudentRow>
}

type SemesterRowState = {
  morality?: Morality
  teacherNote: string
  isCompleted: boolean
}

type AnnualRowState = {
  conductGrade?: Morality
  remark: string
  isCompleted: boolean
}

const EMPTY_SEMESTER_ROW: SemesterRowState = {
  morality: undefined,
  teacherNote: '',
  isCompleted: false,
}

const EMPTY_ANNUAL_ROW: AnnualRowState = {
  conductGrade: undefined,
  remark: '',
  isCompleted: false,
}

// Morality & Conduct options
const MORALITY_OPTIONS = [
  { value: 'excellent', labelKey: 'evaluations.morality.excellent' },
  { value: 'good', labelKey: 'evaluations.morality.good' },
  { value: 'average', labelKey: 'evaluations.morality.average' },
  { value: 'below_average', labelKey: 'evaluations.morality.below_average' },
  { value: 'poor', labelKey: 'evaluations.morality.poor' },
] as const

type Morality = (typeof MORALITY_OPTIONS)[number]['value']

export function EvaluationsBoard({
  classYearId,
  academicYearId,
  requesterId,
  canManage = false,
  students,
}: EvaluationsBoardProps) {
  const { t } = useTranslation()
  const appConfig = useQuery(api.appConfig.get)
  const nameFormat = appConfig?.nameFormat ?? 'firstName_lastName'

  // Fetch semesters (all, ordered by semesterNumber)
  const semestersRaw = useQuery(api.academicYears.listSemesters, {
    requesterId,
    academicYearId,
  })
  const semesters = React.useMemo(
    () =>
      semestersRaw
        ? [...semestersRaw].sort((a, b) => a.semesterNumber - b.semesterNumber)
        : undefined,
    [semestersRaw],
  )

  // Fetch semester results across every semester in a single call
  const semesterResults = useQuery(api.grading.listSemesterResultsByClassYear, {
    requesterId,
    classYearId,
  })

  // Fetch Annual Results
  const annualResults = useQuery(
    api.grading.listAnnualResults,
    requesterId
      ? {
          requesterId,
          classYearId,
        }
      : 'skip',
  )

  // Batch Mutations
  const saveSemesterResult = useMutation(api.grading.upsertSemesterResult)
  const saveAnnualResult = useMutation(api.grading.upsertAnnualResult)

  // Local state: semesterId -> studentClassId -> row state
  const [semesterState, setSemesterState] = React.useState<
    Record<string, Record<string, SemesterRowState>>
  >({})
  const [annualState, setAnnualState] = React.useState<
    Record<string, AnnualRowState>
  >({})

  const [isSaving, setIsSaving] = React.useState(false)

  // Track which rows were actually edited so handleSaveAll doesn't
  // rewrite recordedBy/recordedAt for untouched students.
  const [dirtySemesterRows, setDirtySemesterRows] = React.useState<Set<string>>(
    new Set(),
  )
  const [dirtyAnnualRows, setDirtyAnnualRows] = React.useState<Set<string>>(
    new Set(),
  )

  // Initialize state once backend data is loaded
  React.useEffect(() => {
    if (semesterResults) {
      const state: Record<string, Record<string, SemesterRowState>> = {}
      semesterResults.forEach((r) => {
        state[r.semesterId] = {
          ...state[r.semesterId],
          [r.studentClassId]: {
            morality: r.morality || undefined,
            teacherNote: r.teacherNote || '',
            isCompleted: r.isCompleted || false,
          },
        }
      })
      setSemesterState((prev) => {
        const merged: Record<string, Record<string, SemesterRowState>> = {
          ...state,
        }
        for (const [semesterId, rows] of Object.entries(prev)) {
          merged[semesterId] = { ...state[semesterId], ...rows }
        }
        return merged
      })
    }
  }, [semesterResults])

  React.useEffect(() => {
    if (annualResults) {
      const state: typeof annualState = {}
      annualResults.forEach((r) => {
        state[r.studentClassId] = {
          conductGrade: r.conductGrade || undefined,
          remark: r.remark || '',
          isCompleted: r.isCompleted || false,
        }
      })
      setAnnualState((prev) => ({ ...state, ...prev }))
    }
  }, [annualResults])

  const activeStudents = React.useMemo(() => {
    return students
      .filter((s) => s.student && s.enrollment.status === 'active')
      .sort((a, b) => {
        const nameA = a.student!.saintName
          ? `${a.student!.saintName} ${a.student!.fullName}`
          : a.student!.fullName
        const nameB = b.student!.saintName
          ? `${b.student!.saintName} ${b.student!.fullName}`
          : b.student!.fullName

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
  }, [students, nameFormat])

  const exportHeaders = React.useMemo<Array<string>>(() => {
    const headers: Array<string> = [
      t('evaluations.studentColumn'),
      t('students.col.studentCode'),
    ]
    for (const semester of semesters ?? []) {
      const label = t('evaluations.semesterHeader', {
        number: semester.semesterNumber,
      })
      headers.push(`${label} - ${t('evaluations.morality')}`)
      headers.push(`${label} - ${t('evaluations.noteColumn')}`)
      headers.push(
        `${label} - ${t('evaluations.completedSemester', {
          number: semester.semesterNumber,
        })}`,
      )
    }
    const annualLabel = t('evaluations.annual')
    headers.push(`${annualLabel} - ${t('evaluations.classificationColumn')}`)
    headers.push(`${annualLabel} - ${t('evaluations.annualNoteColumn')}`)
    headers.push(`${annualLabel} - ${t('evaluations.promoted')}`)
    return headers
  }, [t, semesters])

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    if (!semesters) return []
    const moralityLabel = (m?: Morality) =>
      m ? t(MORALITY_OPTIONS.find((opt) => opt.value === m)!.labelKey) : '—'
    return activeStudents
      .map(({ enrollment, student }) => {
        if (!student) return null
        const scId = enrollment._id
        const fullName =
          student.saintName && student.fullName
            ? `${student.saintName} ${student.fullName}`
            : student.fullName
        const row: Record<string, CellValue> = {
          [exportHeaders[0]]: fullName,
          [exportHeaders[1]]: student.studentCode,
        }
        let idx = 2
        for (const semester of semesters) {
          const bySemester = (
            semesterState as Record<
              string,
              Record<string, SemesterRowState> | undefined
            >
          )[semester._id]
          const semRow = bySemester?.[scId] ?? EMPTY_SEMESTER_ROW
          row[exportHeaders[idx++]] = moralityLabel(semRow.morality)
          row[exportHeaders[idx++]] = semRow.teacherNote || '—'
          row[exportHeaders[idx++]] = semRow.isCompleted
            ? t('evaluations.yes')
            : t('evaluations.no')
        }
        const ann = annualState[scId] ?? EMPTY_ANNUAL_ROW
        row[exportHeaders[idx++]] = moralityLabel(ann.conductGrade)
        row[exportHeaders[idx++]] = ann.remark || '—'
        row[exportHeaders[idx++]] = ann.isCompleted
          ? t('evaluations.yes')
          : t('evaluations.no')
        return row
      })
      .filter((row): row is Record<string, CellValue> => row !== null)
  }, [activeStudents, semesters, semesterState, annualState, exportHeaders, t])

  const handleExportCsv = () => {
    exportCsv(exportRows, 'danh-gia-hoc-sinh.csv', exportHeaders)
  }

  const isLoading =
    semesters === undefined ||
    semesterResults === undefined ||
    annualResults === undefined

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const getSemesterRow = (
    semesterId: string,
    studentClassId: string,
  ): SemesterRowState => {
    const bySemester = (
      semesterState as Record<
        string,
        Record<string, SemesterRowState> | undefined
      >
    )[semesterId]
    return bySemester?.[studentClassId] ?? EMPTY_SEMESTER_ROW
  }

  const setSemesterRow = (
    semesterId: string,
    studentClassId: string,
    patch: Partial<SemesterRowState>,
  ) => {
    setSemesterState((prev) => ({
      ...prev,
      [semesterId]: {
        ...prev[semesterId],
        [studentClassId]: {
          ...getSemesterRow(semesterId, studentClassId),
          ...patch,
        },
      },
    }))
    setDirtySemesterRows((prev) => {
      const next = new Set(prev)
      next.add(`${semesterId}|${studentClassId}`)
      return next
    })
  }

  const getAnnualRow = (studentClassId: string): AnnualRowState =>
    annualState[studentClassId] ?? EMPTY_ANNUAL_ROW

  const setAnnualRow = (
    studentClassId: string,
    patch: Partial<AnnualRowState>,
  ) => {
    setAnnualState((prev) => ({
      ...prev,
      [studentClassId]: {
        ...getAnnualRow(studentClassId),
        ...patch,
      },
    }))
    setDirtyAnnualRows((prev) => {
      const next = new Set(prev)
      next.add(studentClassId)
      return next
    })
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const semesterSaves = semesters.flatMap((semester) => {
        const rows = semesterState[semester._id] ?? {}
        return Object.entries(rows)
          .filter(([studentClassId]) =>
            dirtySemesterRows.has(`${semester._id}|${studentClassId}`),
          )
          .map(([studentClassId, rowState]) =>
            saveSemesterResult({
              requesterId,
              studentClassId: studentClassId as Id<'studentClasses'>,
              semesterId: semester._id,
              morality: rowState.morality,
              teacherNote: rowState.teacherNote,
              isCompleted: rowState.isCompleted,
            }),
          )
      })

      const annualSaves = Object.entries(annualState)
        .filter(([studentClassId]) => dirtyAnnualRows.has(studentClassId))
        .map(([studentClassId, rowState]) =>
          saveAnnualResult({
            requesterId,
            studentClassId: studentClassId as Id<'studentClasses'>,
            conductGrade: rowState.conductGrade,
            remark: rowState.remark,
            isCompleted: rowState.isCompleted,
          }),
        )

      const results = await Promise.allSettled([
        ...semesterSaves,
        ...annualSaves,
      ])
      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )

      if (failures.length > 0) {
        failures.forEach((f) => console.error(f.reason))
        const firstReason = failures[0].reason
        const message =
          firstReason instanceof Error && firstReason.message
            ? firstReason.message
            : t('evaluations.saveError')
        toast.error(message)
      } else {
        setDirtySemesterRows(new Set())
        setDirtyAnnualRows(new Set())
        toast.success(t('evaluations.saveSuccess'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 min-w-0">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold">{t('evaluations.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            {t('evaluations.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 h-9"
          >
            <Download className="h-4 w-4" />
            <span>{t('classes.export.csv')}</span>
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 h-9"
            >
              <Save className="h-4 w-4" />
              <span>{t('evaluations.saveBtn')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg border bg-card overflow-x-auto max-h-150">
        <table className="border-collapse w-full min-w-225 text-xs">
          <thead>
            {/* Header Row 1 */}
            <tr className="bg-muted/50 border-b">
              <th
                rowSpan={2}
                className="drop-shadow-lg sticky left-0 bg-background p-3 text-left font-semibold border-r"
                style={{ width: '220px' }}
              >
                {t('evaluations.studentColumn')}
              </th>
              {semesters.map((semester) => (
                <th
                  key={semester._id}
                  colSpan={3}
                  className="p-2 border-r text-center font-semibold text-primary"
                >
                  {t('evaluations.semesterHeader', {
                    number: semester.semesterNumber,
                  })}
                </th>
              ))}
              <th
                colSpan={3}
                className="p-2 text-center font-semibold text-indigo-600"
              >
                {t('evaluations.annual')}
              </th>
            </tr>
            {/* Header Row 2 */}
            <tr className="bg-muted/30 border-b">
              {semesters.map((semester) => (
                <React.Fragment key={semester._id}>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground w-32">
                    {t('evaluations.morality')}
                  </th>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground">
                    {t('evaluations.noteColumn')}
                  </th>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground w-20">
                    {t('evaluations.completedSemester', {
                      number: semester.semesterNumber,
                    })}
                  </th>
                </React.Fragment>
              ))}
              {/* Annual */}
              <th className="p-2 border-r text-center font-medium text-muted-foreground w-32">
                {t('evaluations.classificationColumn')}
              </th>
              <th className="p-2 border-r text-center font-medium text-muted-foreground">
                {t('evaluations.annualNoteColumn')}
              </th>
              <th className="p-2 text-center font-medium text-muted-foreground w-20">
                {t('evaluations.promoted')}
              </th>
            </tr>
          </thead>

          <tbody>
            {activeStudents.map(({ enrollment, student }) => {
              if (!student) return null
              const scId = enrollment._id
              const ann = getAnnualRow(scId)

              const fullName =
                student.saintName && student.fullName
                  ? `${student.saintName} ${student.fullName}`
                  : student.fullName

              return (
                <tr
                  key={scId}
                  className="hover:bg-accent/30 border-b last:border-b-0"
                >
                  {/* Student Name */}
                  <td className="drop-shadow-lg sticky left-0 bg-background p-2.5 font-medium border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="font-semibold text-foreground truncate max-w-50">
                      {fullName}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {t('students.col.studentCode')}: {student.studentCode}
                    </div>
                  </td>

                  {semesters.map((semester) => {
                    const row = getSemesterRow(semester._id, scId)
                    return (
                      <React.Fragment key={semester._id}>
                        {/* Morality */}
                        <td className="p-1 border-r text-center">
                          <Select
                            value={row.morality || 'none'}
                            onValueChange={(val) => {
                              const morality =
                                val && val !== 'none'
                                  ? (val as Morality)
                                  : undefined
                              setSemesterRow(semester._id, scId, { morality })
                            }}
                            disabled={!canManage || isSaving}
                            items={[
                              { label: t('evaluations.notSet'), value: 'none' },
                              ...MORALITY_OPTIONS.map((opt) => ({
                                label: t(opt.labelKey),
                                value: opt.value,
                              })),
                            ]}
                          >
                            <SelectTrigger className="h-7 text-xs w-full bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                              <SelectItem value="none">
                                {t('evaluations.notSet')}
                              </SelectItem>
                              {MORALITY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {t(opt.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Note */}
                        <td className="p-1 border-r">
                          <Input
                            value={row.teacherNote}
                            onChange={(e) =>
                              setSemesterRow(semester._id, scId, {
                                teacherNote: e.target.value,
                              })
                            }
                            disabled={!canManage || isSaving}
                            className="h-7 text-xs w-full bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder={t('evaluations.notePlaceholder')}
                          />
                        </td>
                        {/* Completed */}
                        <td className="p-1 border-r text-center">
                          <Label className="cursor-pointer w-full h-10 flex items-center justify-center">
                            <Checkbox
                              checked={row.isCompleted}
                              onCheckedChange={(checked) =>
                                setSemesterRow(semester._id, scId, {
                                  isCompleted: checked,
                                })
                              }
                              disabled={!canManage || isSaving}
                            />
                          </Label>
                        </td>
                      </React.Fragment>
                    )
                  })}

                  {/* Annual Conduct */}
                  <td className="p-1 border-r text-center">
                    <Select
                      value={ann.conductGrade || 'none'}
                      onValueChange={(val) => {
                        const conductGrade =
                          val && val !== 'none' ? (val as Morality) : undefined
                        setAnnualRow(scId, { conductGrade })
                      }}
                      disabled={!canManage || isSaving}
                      items={[
                        { label: t('evaluations.notSet'), value: 'none' },
                        ...MORALITY_OPTIONS.map((opt) => ({
                          label: t(opt.labelKey),
                          value: opt.value,
                        })),
                      ]}
                    >
                      <SelectTrigger className="h-7 text-xs w-full bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="none">
                          {t('evaluations.notSet')}
                        </SelectItem>
                        {MORALITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Annual Remark */}
                  <td className="p-1 border-r">
                    <Input
                      value={ann.remark}
                      onChange={(e) =>
                        setAnnualRow(scId, { remark: e.target.value })
                      }
                      disabled={!canManage || isSaving}
                      className="h-7 text-xs w-full bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder={t('evaluations.annualNotePlaceholder')}
                    />
                  </td>
                  {/* Annual Completed */}
                  <td className="p-1 text-center">
                    <Label className="cursor-pointer w-full h-10 flex items-center justify-center">
                      <Checkbox
                        checked={ann.isCompleted}
                        onCheckedChange={(checked) =>
                          setAnnualRow(scId, { isCompleted: checked })
                        }
                        disabled={!canManage || isSaving}
                      />
                    </Label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
