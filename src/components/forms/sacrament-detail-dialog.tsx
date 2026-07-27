import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'

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
  const [searchTerm, setSearchTerm] = useState('')
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

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return activeStudents
    const query = searchTerm.toLowerCase()
    return activeStudents.filter((s) => {
      const student = s.student!
      const fullName = formatPersonName(
        student.saintName,
        student.fullName,
      ).toLowerCase()
      const studentCode = student.studentCode.toString()
      return fullName.includes(query) || studentCode.includes(query)
    })
  }, [activeStudents, searchTerm])

  const handleFieldChange = (
    studentId: Id<'students'>,
    field:
      'feastName' | 'sponsorName' | 'notes' | 'receivedDate' | 'receivedPlace',
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
    field:
      'feastName' | 'sponsorName' | 'notes' | 'receivedDate' | 'receivedPlace',
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
      <DialogContent className="sm:max-w-7xl max-h-[80vh]">
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

          <Card className="flex-1 ring-0 border border-border gap-0">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between border-b border-b-border">
              <CardTitle className="text-base grow">
                {filteredStudents.length}{' '}
                {t('classes.sacraments.detail.studentsWithSacrament')}
              </CardTitle>
              <InputGroup className="shrink max-w-48">
                <InputGroupAddon>
                  <Search className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder={t('common.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </CardHeader>
            <CardContent
              className={'p-0 overflow-hidden overflow-y-auto scroll-fade'}
            >
              <div className="divide-y">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">
                    {activeStudents.length === 0
                      ? t('classes.sacraments.detail.noStudentsWithSacrament')
                      : t('common.noResultsFound')}
                  </p>
                ) : (
                  filteredStudents.map((row) => {
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <Field>
                            <FieldLabel>
                              {t('students.detail.sacraments.receivedDate')}
                            </FieldLabel>
                            <Input
                              type="date"
                              value={
                                changes.receivedDate
                                  ? changes.receivedDate
                                  : (sacrament.receivedDate as string) || ''
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  student._id,
                                  'receivedDate',
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleFieldBlur(student._id, 'receivedDate')
                              }
                              className="mt-1"
                            />
                          </Field>

                          <Field>
                            <FieldLabel>
                              {t('students.detail.sacraments.receivedPlace')}
                            </FieldLabel>
                            <Input
                              value={
                                changes.receivedPlace
                                  ? changes.receivedPlace
                                  : (sacrament.receivedPlace as string) || ''
                              }
                              onChange={(e) =>
                                handleFieldChange(
                                  student._id,
                                  'receivedPlace',
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleFieldBlur(student._id, 'receivedPlace')
                              }
                              className="mt-1"
                            />
                          </Field>

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
