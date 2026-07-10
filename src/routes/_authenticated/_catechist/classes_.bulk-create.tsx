import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Layers, Plus, X } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { CLASS_ERRORS } from '../../../../convex/lib/errors'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Field, FieldDescription, FieldLabel } from '~/components/ui/field'

export const Route = createFileRoute(
  '/_authenticated/_catechist/classes_/bulk-create',
)({
  component: BulkCreateClassesPage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'classes.bulkCreate.title' },
    ],
  },
})

function BulkCreateClassesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canAccess = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )

  if (!canAccess) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Layers}
        title={t('classes.bulkCreate.title', 'Tạo Hàng Loạt')}
        subtitle={t(
          'classes.bulkCreate.subtitle',
          'Thêm nhiều lớp cùng lúc cho từng ngành',
        )}
      />

      <div className="bg-card border rounded-xl p-4">
        {branches === undefined ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            {t('classes.bulkCreate.noEntries', 'Chưa có lớp nào để tạo')}
          </div>
        ) : (
          <BulkCreateForm branches={branches} />
        )}
      </div>
    </div>
  )
}

function BulkCreateForm({ branches }: { branches: Array<Doc<'branches'>> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'>

  const bulkCreateMutation = useMutation(api.classes.bulkCreate)
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

  const academicYears = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )

  const [importYearId, setImportYearId] = React.useState<string>('')

  const importClasses = useQuery(
    api.classes.list,
    requesterId && importYearId
      ? { requesterId, academicYearId: importYearId as Id<'academicYears'> }
      : 'skip',
  )

  const previousYears = React.useMemo(() => {
    if (!academicYears) return []
    return academicYears.filter((y) => y._id !== selectedYearId)
  }, [academicYears, selectedYearId])

  const defaultValues = React.useMemo(() => {
    const defaults: Record<string, Array<{ name: string }>> = {}
    branches.forEach((b) => {
      defaults[b._id] = [{ name: '' }]
    })
    return { branchClasses: defaults }
  }, [branches])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (!selectedYearId) {
        toast.error(t('classes.noActiveYear', 'Chưa chọn năm học'))
        return
      }

      const classesToCreate: Array<{
        branchId: Id<'branches'>
        name: string
      }> = []

      for (const branch of branches) {
        const branchRows = value.branchClasses[branch._id]
        for (const row of branchRows) {
          const name = row.name.trim()
          if (name) {
            classesToCreate.push({
              branchId: branch._id,
              name,
            })
          }
        }
      }

      if (classesToCreate.length === 0) {
        toast.error(t('classes.bulkCreate.emptyName', 'Vui lòng nhập tên lớp'))
        return
      }

      try {
        await bulkCreateMutation({
          requesterId,
          academicYearId: selectedYearId,
          classes: classesToCreate,
        })
        toast.success(
          t('classes.bulkCreate.success', 'Đã tạo {{count}} lớp thành công', {
            count: classesToCreate.length,
          }),
        )
        setFormDirty(false)
        navigate({ to: '/classes' })
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(CLASS_ERRORS.EMPTY_NAME)) {
          toast.error(
            t(
              'classes.bulkCreate.emptyNameError',
              'Tên lớp không được để trống',
            ),
          )
        } else {
          toast.error(
            t('classes.saveError', 'Lỗi khi lưu thông tin. Vui lòng thử lại.'),
          )
        }
      }
    },
  })

  const lastAppliedYearIdRef = React.useRef<string>('')

  React.useEffect(() => {
    if (importYearId && importClasses !== undefined) {
      if (lastAppliedYearIdRef.current !== importYearId) {
        lastAppliedYearIdRef.current = importYearId

        const newBranchClasses: Record<string, Array<{ name: string }>> = {}
        branches.forEach((b) => {
          const matchingClasses = importClasses.filter(
            (c) => c.branchId === b._id,
          )
          if (matchingClasses.length > 0) {
            newBranchClasses[b._id] = matchingClasses.map((c) => ({
              name: c.name,
            }))
          } else {
            newBranchClasses[b._id] = [{ name: '' }]
          }
        })

        form.setFieldValue('branchClasses', newBranchClasses)
        setFormDirty(true)
        toast.info(
          t(
            'classes.bulkCreate.imported',
            'Đã tải danh sách lớp từ năm học đã chọn.',
          ),
        )
      }
    }
  }, [importYearId, importClasses, branches, form, t])

  const handleCancel = () => {
    if (formDirty) {
      setConfirmLeaveOpen(true)
    } else {
      navigate({ to: '/classes' })
    }
  }

  const addRow = (branchId: string) => {
    const current = form.getFieldValue(
      `branchClasses.${branchId}` as any,
    ) as Array<{
      name: string
    }>
    form.setFieldValue(
      `branchClasses.${branchId}` as any,
      [...current, { name: '' }] as any,
    )
    setFormDirty(true)
  }

  const removeRow = (branchId: string, index: number) => {
    const current = form.getFieldValue(
      `branchClasses.${branchId}` as any,
    ) as Array<{
      name: string
    }>
    form.setFieldValue(
      `branchClasses.${branchId}` as any,
      current.filter((_, i) => i !== index) as any,
    )
    setFormDirty(true)
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-8"
      >
        {previousYears.length > 0 && (
          <Field>
            <FieldLabel>
              {t(
                'classes.bulkCreate.importFromYear',
                'Sao chép lớp từ năm học cũ',
              )}
            </FieldLabel>
            <Select
              value={importYearId}
              onValueChange={(val) => {
                if (val) {
                  setImportYearId(val)
                }
              }}
              items={previousYears.map((year) => ({
                label: year.name,
                value: year._id,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t(
                    'classes.bulkCreate.selectPreviousYear',
                    'Chọn năm học trước...',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {previousYears.map((year) => (
                  <SelectItem key={year._id} value={year._id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {importYearId && importClasses === undefined && (
              <FieldDescription className="text-xs text-muted-foreground animate-pulse">
                {t('common.loading', 'Đang tải...')}
              </FieldDescription>
            )}
          </Field>
        )}

        <div className="space-y-8">
          {branches.map((branch) => (
            <div key={branch._id} className="space-y-4">
              <h3 className="text-lg font-semibold">{branch.name}</h3>

              <form.Field
                name={`branchClasses.${branch._id}` as any}
                children={(field: any) => {
                  const rows: Array<{ name: string }> = field.state.value || []
                  return (
                    <div className="space-y-2">
                      {rows.map((_, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <form.Field
                            name={
                              `branchClasses.${branch._id}[${index}].name` as any
                            }
                            children={(subField: any) => (
                              <Input
                                placeholder={t(
                                  'classes.fields.name.placeholder',
                                  'Ví dụ: Ấu Nhi 1',
                                )}
                                value={subField.state.value}
                                onChange={(e) => {
                                  subField.handleChange(e.target.value)
                                  setFormDirty(true)
                                }}
                                onBlur={subField.handleBlur}
                                className="max-w-sm"
                              />
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(branch._id, index)}
                            title={t('classes.bulkCreate.removeRow', 'Xóa')}
                          >
                            <X className="size-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex gap-2 text-primary mt-2"
                        onClick={() => addRow(branch._id)}
                      >
                        <Plus className="size-4" />
                        {t('classes.bulkCreate.addRow', 'Thêm lớp')}
                      </Button>
                    </div>
                  )
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe
            selector={(s) => ({
              isSubmitting: s.isSubmitting,
            })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t('common.saving')
                  : t('classes.bulkCreate.submit', 'Tạo tất cả')}
              </Button>
            )}
          />
        </div>
      </form>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('classes.confirmLeave.title', 'Hủy bỏ thay đổi chưa lưu?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'classes.confirmLeave.description',
                'Các thay đổi chưa lưu sẽ bị mất.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                setFormDirty(false)
                navigate({ to: '/classes' })
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('classes.confirmLeave.discard', 'Hủy bỏ')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
