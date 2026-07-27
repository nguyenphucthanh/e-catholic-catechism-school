import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { formatPersonName } from '~/lib/name'
import { formatDate } from '~/lib/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Input } from '~/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldLabel } from '~/components/ui/field'

type SacramentType = 'baptism' | 'confirmation'

interface SacramentDetailDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  students: Array<{
    student: Doc<'students'> | null
    sacramentDates: Record<string, string | undefined>
  }>
  requesterId: Id<'catechists'>
  classYearId: Id<'classYears'>
}

export function SacramentDetailDialog({
  isOpen,
  onOpenChange,
  students,
  requesterId,
  classYearId,
}: SacramentDetailDialogProps) {
  const { t } = useTranslation()
  const [sacramentType, setSacramentType] =
    useState<SacramentType>('confirmation')
  const [editingState, setEditingState] = useState<
    Map<Id<'students'>, Record<string, string>>
  >(new Map())

  const sacramentDetailsData = useQuery(
    api.students.getClassSacramentDetails,
    isOpen && requesterId && classYearId
      ? { requesterId, classYearId }
      : 'skip',
  )

  const updateSacramentDetails = useMutation(
    api.students.updateStudentSacramentDetails,
  )

  // Build map of sacrament data by student ID
  const sacramentByStudent = useMemo(() => {
    const map = new Map<
      Id<'students'>,
      Record<string, Record<string, unknown>>
    >()
    if (!sacramentDetailsData) return map

    for (const { studentId, records } of sacramentDetailsData) {
      const sacramentMap: Record<string, Record<string, unknown>> = {}
      for (const record of records) {
        sacramentMap[record.sacramentType] = record
      }
      map.set(studentId, sacramentMap)
    }
    return map
  }, [sacramentDetailsData])

  const activeStudents = useMemo(
    () => students.filter((s) => s.student !== null),
    [students],
  )

  const handleFieldChange = (
    studentId: Id<'students'>,
    field: 'feastName' | 'sponsorName' | 'notes',
    value: string,
  ) => {
    const current = editingState.get(studentId) || {}
    setEditingState(
      new Map(editingState).set(studentId, {
        ...current,
        [field]: value,
      }),
    )
  }

  const handleFieldBlur = async (
    studentId: Id<'students'>,
    field: 'feastName' | 'sponsorName' | 'notes',
  ) => {
    const changes = editingState.get(studentId)
    if (!changes) return

    try {
      await updateSacramentDetails({
        requesterId,
        studentId,
        sacramentType,
        [field]: changes[field] || undefined,
      })
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const sacramentItems = [
    { value: 'baptism', label: t('students.sacraments.baptism') },
    { value: 'confirmation', label: t('students.sacraments.confirmation') },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('classes.sacraments.detail.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 max-h-[70vh] overflow-hidden">
          <Field>
            <FieldLabel>
              {t('classes.sacraments.detail.selectSacrament')}
            </FieldLabel>
            <Select
              value={sacramentType}
              onValueChange={(val) => setSacramentType(val as SacramentType)}
              items={sacramentItems}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sacramentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Card className="flex-1 ring-0 border border-border">
            <CardHeader>
              <CardTitle className="text-base">
                {activeStudents.length}{' '}
                {t('classes.sacraments.detail.studentsWithSacrament')}
              </CardTitle>
            </CardHeader>
            <CardContent
              className={'p-0 overflow-hidden overflow-y-auto scroll-fade'}
            >
              <div className="divide-y">
                {activeStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('classes.sacraments.detail.noStudentsWithSacrament')}
                  </p>
                ) : (
                  activeStudents.map((row) => {
                    const student = row.student!
                    const receivedDate = row.sacramentDates[sacramentType]
                    const sacrament =
                      sacramentByStudent.get(student._id)?.[sacramentType] || {}
                    const changes = editingState.get(student._id) || {}

                    return (
                      <div key={student._id} className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <span className="font-medium">
                              {formatPersonName(
                                student.saintName,
                                student.fullName,
                              )}
                            </span>{' '}
                            <span className="text-xs text-muted-foreground">
                              {t('students.col.studentCode')}:{' '}
                              {student.studentCode}
                            </span>
                          </div>
                          {receivedDate ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(receivedDate)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              {t('classes.sacraments.detail.notReceived')}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field>
                            <FieldLabel>
                              {t('students.form.sacrament.feastName')}
                            </FieldLabel>
                            <Input
                              value={
                                changes.feastName
                                  ? changes.feastName
                                  : (sacrament.feastName as string) || ''
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  student._id,
                                  'feastName',
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleFieldBlur(student._id, 'feastName')
                              }
                              placeholder={t(
                                'students.form.sacrament.feastName.placeholder',
                              )}
                              className="mt-1"
                            />
                          </Field>

                          <Field>
                            <FieldLabel>
                              {t('students.form.sacrament.sponsorName')}
                            </FieldLabel>
                            <Input
                              value={
                                changes.sponsorName
                                  ? changes.sponsorName
                                  : (sacrament.sponsorName as string) || ''
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  student._id,
                                  'sponsorName',
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleFieldBlur(student._id, 'sponsorName')
                              }
                              placeholder={t(
                                'students.form.sacrament.sponsorName.placeholder',
                              )}
                              className="mt-1"
                            />
                          </Field>

                          <Field>
                            <FieldLabel>
                              {t('students.form.sacrament.notes')}
                            </FieldLabel>
                            <Input
                              value={
                                changes.notes
                                  ? changes.notes
                                  : (sacrament.notes as string) || ''
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  student._id,
                                  'notes',
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleFieldBlur(student._id, 'notes')
                              }
                              className="mt-1"
                            />
                          </Field>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
