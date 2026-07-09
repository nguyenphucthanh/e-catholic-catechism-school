import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatPersonName } from '~/lib/name'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Field, FieldContent, FieldLabel } from '~/components/ui/field'
import { Checkbox } from '~/components/ui/checkbox'
import { ScrollArea } from '~/components/ui/scroll-area'

export interface PrintCardsStudent {
  _id: Id<'students'>
  fullName: string
  saintName?: string
  studentCode: string
}

interface PrintCardsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  students: Array<PrintCardsStudent>
  filename: string
}

export function PrintCardsDialog({
  isOpen,
  onOpenChange,
  title,
  students,
  filename,
}: PrintCardsDialogProps) {
  const { t } = useTranslation()
  const appConfig = useQuery(api.appConfig.get)

  const sortedStudents = useMemo(() => {
    const nameFormat = appConfig?.nameFormat
    return [...students].sort((a, b) => {
      if (nameFormat === 'firstName_lastName') {
        return a.fullName
          .toLocaleLowerCase()
          .localeCompare(b.fullName.toLocaleLowerCase())
      }
      const lastNameA = a.fullName.split(' ').pop() || ''
      const lastNameB = b.fullName.split(' ').pop() || ''
      return lastNameA
        .toLocaleLowerCase()
        .localeCompare(lastNameB.toLocaleLowerCase())
    })
  }, [students, appConfig?.nameFormat])

  const form = useForm({
    defaultValues: {
      studentIds: [] as Array<Id<'students'>>,
    },
    onSubmit: ({ value }) => {
      if (value.studentIds.length === 0) {
        toast.error(t('classes.sacraments.bulkUpdate.noStudentsSelected'))
        return
      }
      if (!appConfig) return

      const selected = sortedStudents.filter((s) =>
        value.studentIds.includes(s._id),
      )
      exportQrCardsPdf(
        selected.map((s) => ({
          studentCode: s.studentCode,
          fullName: s.fullName,
          saintName: s.saintName,
        })),
        {
          troopName: appConfig.troopName,
          parishName: appConfig.parishName,
        },
        filename,
      )
      form.reset()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('printCards.dialogTitle')} - {title}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-6"
        >
          <form.Field
            name="studentIds"
            children={(field) => {
              const selectedIds = field.state.value
              const toggleStudent = (id: Id<'students'>) => {
                if (selectedIds.includes(id)) {
                  field.handleChange(selectedIds.filter((x) => x !== id))
                } else {
                  field.handleChange([...selectedIds, id])
                }
              }

              const toggleAll = () => {
                if (selectedIds.length === sortedStudents.length) {
                  field.handleChange([])
                } else {
                  field.handleChange(sortedStudents.map((s) => s._id))
                }
              }

              const isAllChecked =
                sortedStudents.length > 0 &&
                selectedIds.length === sortedStudents.length

              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b pb-2 mb-1">
                    <FieldLabel className="mb-0">
                      {t('classes.enrollment.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedIds.length} / {sortedStudents.length}
                    </span>
                  </div>

                  <Field orientation="horizontal">
                    <Checkbox
                      id="select-all-print-students"
                      checked={isAllChecked}
                      onCheckedChange={toggleAll}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="select-all-print-students">
                        {t('classes.sacraments.bulkUpdate.selectAll')}
                      </FieldLabel>
                    </FieldContent>
                  </Field>

                  <div className="border rounded-lg overflow-hidden bg-card">
                    <ScrollArea className="h-60 p-2">
                      <div className="flex flex-col gap-1">
                        {sortedStudents.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            {t('classes.enrollment.noStudents')}
                          </div>
                        ) : (
                          sortedStudents.map((student) => {
                            const isChecked = selectedIds.includes(student._id)
                            return (
                              <div
                                key={student._id}
                                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
                              >
                                <Checkbox
                                  id={`print-student-${student._id}`}
                                  checked={isChecked}
                                  onCheckedChange={() =>
                                    toggleStudent(student._id)
                                  }
                                />
                                <label
                                  htmlFor={`print-student-${student._id}`}
                                  className="flex flex-col cursor-pointer select-none flex-1"
                                >
                                  <span className="text-sm font-medium text-foreground">
                                    {formatPersonName(
                                      student.saintName,
                                      student.fullName,
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {student.studentCode}
                                  </span>
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('printCards.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
