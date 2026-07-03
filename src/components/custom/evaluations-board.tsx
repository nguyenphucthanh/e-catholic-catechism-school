import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
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

  const activeStudents = students.filter(
    (s) => s.student && s.enrollment.status === 'active',
  )

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
  }

  const getAnnualRow = (studentClassId: string): AnnualRowState =>
    annualState[studentClassId] ?? EMPTY_ANNUAL_ROW

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      // Save results for every semester
      for (const semester of semesters) {
        const rows = semesterState[semester._id] ?? {}
        for (const [studentClassId, rowState] of Object.entries(rows)) {
          await saveSemesterResult({
            requesterId,
            studentClassId: studentClassId as Id<'studentClasses'>,
            semesterId: semester._id,
            morality: rowState.morality,
            teacherNote: rowState.teacherNote,
            isCompleted: rowState.isCompleted,
          })
        }
      }

      // Save Annual Results
      for (const [studentClassId, rowState] of Object.entries(annualState)) {
        await saveAnnualResult({
          requesterId,
          studentClassId: studentClassId as Id<'studentClasses'>,
          conductGrade: rowState.conductGrade,
          remark: rowState.remark,
          isCompleted: rowState.isCompleted,
        })
      }

      toast.success(t('evaluations.saveSuccess'))
    } catch (err: any) {
      toast.error(err.message || t('evaluations.saveError'))
      console.error(err)
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
                      {student.studentCode}
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
                        setAnnualState((prev) => ({
                          ...prev,
                          [scId]: {
                            ...getAnnualRow(scId),
                            conductGrade,
                          },
                        }))
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
                        setAnnualState((prev) => ({
                          ...prev,
                          [scId]: {
                            ...getAnnualRow(scId),
                            remark: e.target.value,
                          },
                        }))
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
                          setAnnualState((prev) => ({
                            ...prev,
                            [scId]: {
                              ...getAnnualRow(scId),
                              isCompleted: checked,
                            },
                          }))
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
