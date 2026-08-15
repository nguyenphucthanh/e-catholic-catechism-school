import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { FileDown, Search } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { formatPersonName } from '~/lib/name'
import { formatDate } from '~/lib/locale'
import { exportCsv } from '~/lib/export/csv'
import { exportPdf } from '~/lib/export/pdf'
import { sacramentFields, type SacramentFieldKey } from '~/lib/sacrament-fields'
import { buildSacramentExportRows } from '~/lib/sacrament-export'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'

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
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<SacramentFieldKey>>(
    new Set(
      sacramentFields.filter((f) => f.defaultExportSelected).map((f) => f.key),
    ),
  )

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
    field: SacramentFieldKey,
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
    field: SacramentFieldKey,
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

  const handleExport = (format: 'csv' | 'pdf') => {
    const { headers, rows } = buildSacramentExportRows({
      students: filteredStudents.map((row) => ({
        ...row,
        student: row.student!,
      })),
      sacramentByStudent,
      editingState,
      sacramentType,
      selectedFields,
      t,
    })

    const filename = `sacraments-${sacramentType}-${new Date().toISOString().split('T')[0]}`
    const sacramentLabel = t(
      sacramentType === 'baptism'
        ? 'students.sacraments.baptism'
        : 'students.sacraments.confirmation',
    )

    if (format === 'csv') {
      exportCsv(rows, `${filename}.csv`, headers)
    } else {
      exportPdf(
        rows,
        `${t('students.detail.sacraments.title')} - ${sacramentLabel}`,
        {
          [t('students.detail.sacraments.type')]: sacramentLabel,
          'Export Date': formatDate(new Date().toISOString()),
        },
        `${filename}.pdf`,
        headers,
      )
    }

    setShowExportDialog(false)
    toast.success(t('common.exported'))
  }

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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                >
                  <FileDown className="size-4 mr-2" />
                  {t('common.export')}
                </Button>
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
              </div>
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
                          {sacramentFields.map((field) => (
                            <Field key={field.key}>
                              <FieldLabel>{t(field.labelKey)}</FieldLabel>
                              <Input
                                type={field.inputType}
                                value={
                                  changes[field.key] ||
                                  (sacrament[field.key] as string) ||
                                  ''
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    student._id,
                                    field.key,
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  handleFieldBlur(student._id, field.key)
                                }
                                placeholder={
                                  field.placeholderKey
                                    ? t(field.placeholderKey)
                                    : undefined
                                }
                                className="mt-1"
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          selectedFields={selectedFields}
          onFieldsChange={setSelectedFields}
          onExport={handleExport}
          t={t}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFields: Set<SacramentFieldKey>
  onFieldsChange: (fields: Set<SacramentFieldKey>) => void
  onExport: (format: 'csv' | 'pdf') => void
  t: ReturnType<typeof useTranslation>['t']
}

function ExportDialog({
  open,
  onOpenChange,
  selectedFields,
  onFieldsChange,
  onExport,
  t,
}: ExportDialogProps) {
  const fieldOptions = sacramentFields.map((field) => ({
    key: field.key,
    label: t(field.labelKey),
  }))

  const toggleField = (fieldKey: SacramentFieldKey) => {
    const newFields = new Set(selectedFields)
    if (newFields.has(fieldKey)) {
      newFields.delete(fieldKey)
    } else {
      newFields.add(fieldKey)
    }
    onFieldsChange(newFields)
  }

  const hasAnyFieldSelected = selectedFields.size > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.selectFieldsToExport')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fieldOptions.map((option) => (
            <div key={option.key} className="flex items-center gap-2">
              <Checkbox
                id={option.key}
                checked={selectedFields.has(option.key)}
                onCheckedChange={() => toggleField(option.key)}
              />
              <label
                htmlFor={option.key}
                className="text-sm font-medium cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            disabled={!hasAnyFieldSelected}
            onClick={() => onExport('csv')}
          >
            {t('common.exportCsv')}
          </Button>
          <Button
            disabled={!hasAnyFieldSelected}
            onClick={() => onExport('pdf')}
          >
            {t('common.exportPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
