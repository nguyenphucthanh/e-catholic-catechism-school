import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Card, CardContent } from '../ui/card'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AttendancePointConfig } from '~/lib/attendance'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '~/components/ui/field'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
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

import { attendancePointValueSchema } from '~/lib/attendance'
import { HARDCODED_CATECHIST_TITLES } from '~/lib/catechist-titles'

interface AppConfigFormProps {
  initialValues?: {
    troopName?: string
    parishName: string
    dioceseName: string
    nameFormat: 'firstName_lastName' | 'lastName_firstName'
    logoStorageId?: Id<'_storage'>
    logoUrl?: string | null
    epiphanyOnSunday?: boolean
    corpusChristiOnSunday?: boolean
    ascensionOnSunday?: boolean
    attendancePointConfig?: AttendancePointConfig
    catechistTitles?: Array<string>
  }
  upsertMutation: (args: {
    troopName?: string
    parishName: string
    dioceseName: string
    nameFormat: 'firstName_lastName' | 'lastName_firstName'
    logoStorageId?: Id<'_storage'> | null
    epiphanyOnSunday: boolean
    corpusChristiOnSunday: boolean
    ascensionOnSunday: boolean
    attendancePointConfig?: AttendancePointConfig
    catechistTitles?: Array<string>
  }) => Promise<unknown>
  generateUploadUrlMutation: () => Promise<string>
  onSuccess: () => void
}

export function AppConfigForm({
  initialValues,
  upsertMutation,
  generateUploadUrlMutation,
  onSuccess,
}: AppConfigFormProps) {
  const { t } = useTranslation()
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoRemoved, setLogoRemoved] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const formSchema = React.useMemo(() => {
    const pointValue = attendancePointValueSchema(
      t('appConfig.fields.attendancePoint.rangeError'),
    )
    return z.object({
      troopName: z.string(),
      parishName: z.string().trim().min(1, t('common.required')),
      dioceseName: z.string().trim().min(1, t('common.required')),
      nameFormat: z.enum(['firstName_lastName', 'lastName_firstName']),
      epiphanyOnSunday: z.boolean(),
      corpusChristiOnSunday: z.boolean(),
      ascensionOnSunday: z.boolean(),
      catechistTitles: z
        .array(z.string().trim().min(1, t('appConfig.fields.titleEmptyError')))
        .refine(
          (items) =>
            new Set(items.map((i) => i.trim().toLowerCase())).size ===
            items.length,
          { message: t('appConfig.fields.titleDuplicateError') },
        ),
      attendancePointMode: z.enum(['rate', 'type']),
      attendancePointPresent: pointValue,
      attendancePointLate: pointValue,
      attendancePointExcused: pointValue,
      attendancePointAbsentUnset: pointValue,
    })
  }, [t])

  const initialConfig = initialValues?.attendancePointConfig
  const form = useForm({
    defaultValues: {
      troopName: initialValues?.troopName ?? '',
      parishName: initialValues?.parishName ?? '',
      dioceseName: initialValues?.dioceseName ?? '',
      nameFormat: initialValues?.nameFormat ?? 'firstName_lastName',
      epiphanyOnSunday: initialValues?.epiphanyOnSunday ?? true,
      corpusChristiOnSunday: initialValues?.corpusChristiOnSunday ?? true,
      ascensionOnSunday: initialValues?.ascensionOnSunday ?? true,
      catechistTitles: initialValues?.catechistTitles ?? [],
      attendancePointMode: initialConfig?.mode ?? ('rate' as const),
      attendancePointPresent:
        initialConfig && initialConfig.mode === 'type'
          ? initialConfig.present
          : 10,
      attendancePointLate:
        initialConfig && initialConfig.mode === 'type' ? initialConfig.late : 9,
      attendancePointExcused:
        initialConfig && initialConfig.mode === 'type'
          ? initialConfig.excused
          : 0,
      attendancePointAbsentUnset:
        initialConfig && initialConfig.mode === 'type'
          ? initialConfig.absentUnset
          : -0.5,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        let logoStorageId: Id<'_storage'> | null | undefined =
          initialValues?.logoStorageId

        if (logoRemoved) logoStorageId = null

        const file = fileInputRef.current?.files?.[0]
        if (file) {
          const uploadUrl = await generateUploadUrlMutation()
          const result = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          })
          if (!result.ok) throw new Error('Upload failed')
          const { storageId } = await result.json()
          logoStorageId = storageId as Id<'_storage'>
        }

        const attendancePointConfig: AttendancePointConfig =
          value.attendancePointMode === 'rate'
            ? { mode: 'rate' }
            : {
                mode: 'type',
                present: value.attendancePointPresent,
                late: value.attendancePointLate,
                excused: value.attendancePointExcused,
                absentUnset: value.attendancePointAbsentUnset,
              }

        const {
          attendancePointMode: _m,
          attendancePointPresent: _p,
          attendancePointLate: _l,
          attendancePointExcused: _e,
          attendancePointAbsentUnset: _a,
          ...restValues
        } = value

        await upsertMutation({
          ...restValues,
          attendancePointConfig,
          troopName: value.troopName || undefined,
          catechistTitles: value.catechistTitles.map((x) => x.trim()),
          logoStorageId,
        })
        toast.success(t('appConfig.saved'))
        onSuccess()
      } catch {
        toast.error(t('appConfig.saveError'))
      }
    },
  })

  const handleCancel = () => {
    if (formDirty) {
      setConfirmLeaveOpen(true)
    } else {
      onSuccess()
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoPreview(URL.createObjectURL(file))
      setLogoRemoved(false)
      setFormDirty(true)
    }
  }

  const handleLogoRemove = () => {
    setLogoPreview(null)
    setLogoRemoved(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setFormDirty(true)
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">
              {t('appConfig.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="catechistsStudents">
              {t('appConfig.tabs.catechistsStudents')}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="general"
            keepMounted
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent>
                <FieldSet>
                  <FieldLegend>{t('appConfig.form.parishInfo')}</FieldLegend>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('appConfig.form.parishInfo.description')}
                  </p>
                  <FieldGroup>
                    <form.Field
                      name="troopName"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="troopName">
                              {t('appConfig.fields.troopName')}
                            </FieldLabel>
                            <Input
                              id="troopName"
                              name={field.name}
                              placeholder={t(
                                'appConfig.fields.troopName.placeholder',
                              )}
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value)
                                setFormDirty(true)
                              }}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />

                    <form.Field
                      name="parishName"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="parishName">
                              {t('appConfig.fields.parishName')}{' '}
                              <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id="parishName"
                              name={field.name}
                              placeholder={t(
                                'appConfig.fields.parishName.placeholder',
                              )}
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value)
                                setFormDirty(true)
                              }}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />

                    <form.Field
                      name="dioceseName"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="dioceseName">
                              {t('appConfig.fields.dioceseName')}{' '}
                              <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id="dioceseName"
                              name={field.name}
                              placeholder={t(
                                'appConfig.fields.dioceseName.placeholder',
                              )}
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value)
                                setFormDirty(true)
                              }}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <FieldSet>
                  <FieldLegend>{t('appConfig.form.appearance')}</FieldLegend>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('appConfig.form.appearance.description')}
                  </p>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="logo">
                        {t('appConfig.fields.logo')}
                      </FieldLabel>
                      <div className="flex items-center gap-4">
                        {(logoPreview ||
                          (initialValues?.logoUrl && !logoRemoved)) && (
                          <img
                            src={logoPreview ?? initialValues?.logoUrl ?? ''}
                            alt="Logo preview"
                            className="size-16 rounded object-contain border"
                          />
                        )}
                        <Input
                          ref={fileInputRef}
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                        />
                        {(logoPreview ||
                          (initialValues?.logoUrl && !logoRemoved)) && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleLogoRemove}
                          >
                            {t('appConfig.fields.logo.remove')}
                          </Button>
                        )}
                      </div>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <FieldSet>
                  <FieldLegend>{t('appConfig.form.romcal')}</FieldLegend>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('appConfig.form.romcal.description')}
                  </p>
                  <FieldGroup>
                    <form.Field
                      name="epiphanyOnSunday"
                      children={(field) => (
                        <Field orientation="horizontal">
                          <FieldLabel htmlFor="epiphanyOnSunday">
                            {t('appConfig.fields.epiphanyOnSunday')}
                          </FieldLabel>
                          <Switch
                            id="epiphanyOnSunday"
                            checked={field.state.value}
                            onCheckedChange={(checked) => {
                              field.handleChange(checked)
                              setFormDirty(true)
                            }}
                          />
                        </Field>
                      )}
                    />

                    <form.Field
                      name="corpusChristiOnSunday"
                      children={(field) => (
                        <Field orientation="horizontal">
                          <FieldLabel htmlFor="corpusChristiOnSunday">
                            {t('appConfig.fields.corpusChristiOnSunday')}
                          </FieldLabel>
                          <Switch
                            id="corpusChristiOnSunday"
                            checked={field.state.value}
                            onCheckedChange={(checked) => {
                              field.handleChange(checked)
                              setFormDirty(true)
                            }}
                          />
                        </Field>
                      )}
                    />

                    <form.Field
                      name="ascensionOnSunday"
                      children={(field) => (
                        <Field orientation="horizontal">
                          <FieldLabel htmlFor="ascensionOnSunday">
                            {t('appConfig.fields.ascensionOnSunday')}
                          </FieldLabel>
                          <Switch
                            id="ascensionOnSunday"
                            checked={field.state.value}
                            onCheckedChange={(checked) => {
                              field.handleChange(checked)
                              setFormDirty(true)
                            }}
                          />
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="catechistsStudents"
            keepMounted
            className="flex flex-col gap-6"
          >
            <h3 className="text-lg font-semibold">
              {t('appConfig.sections.common')}
            </h3>
            <Card>
              <CardContent>
                <FieldGroup>
                  <form.Field
                    name="nameFormat"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel>
                            {t('appConfig.fields.nameFormat')}
                          </FieldLabel>
                          <RadioGroup
                            value={field.state.value}
                            onValueChange={(val) => {
                              field.handleChange(
                                val as
                                  'firstName_lastName' | 'lastName_firstName',
                              )
                              setFormDirty(true)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value="firstName_lastName"
                                id="firstName_lastName"
                              />
                              <Label htmlFor="firstName_lastName">
                                {t(
                                  'appConfig.fields.nameFormat.firstName_lastName',
                                )}
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value="lastName_firstName"
                                id="lastName_firstName"
                              />
                              <Label htmlFor="lastName_firstName">
                                {t(
                                  'appConfig.fields.nameFormat.lastName_firstName',
                                )}
                              </Label>
                            </div>
                          </RadioGroup>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <h3 className="text-lg font-semibold">
              {t('appConfig.sections.catechists')}
            </h3>
            <Card>
              <CardContent>
                <FieldSet>
                  <FieldLegend>
                    {t('appConfig.form.catechistTitles')}
                  </FieldLegend>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('appConfig.form.catechistTitles.description')}
                  </p>

                  <div className="space-y-2 mb-6">
                    <FieldLabel>
                      {t('appConfig.fields.systemTitles')}
                    </FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      {t('appConfig.fields.systemTitles.description')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {HARDCODED_CATECHIST_TITLES.map((title) => (
                        <Badge
                          key={title.value}
                          variant="secondary"
                          className="px-2.5 py-1 text-sm font-normal flex items-center gap-1.5"
                        >
                          <Lock
                            className="size-3 text-muted-foreground"
                            data-testid="system-title-lock"
                          />
                          <span>{t(title.labelKey)}</span>
                          <span className="text-xs text-muted-foreground">
                            ({title.value})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <form.Field
                    name="catechistTitles"
                    mode="array"
                    children={(field) => (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <FieldLabel>
                              {t('appConfig.fields.customTitles')}
                            </FieldLabel>
                            <p className="text-xs text-muted-foreground">
                              {t('appConfig.fields.customTitles.description')}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              field.handleChange([...field.state.value, ''])
                              setFormDirty(true)
                            }}
                          >
                            <Plus className="size-4 mr-1" />
                            {t('appConfig.fields.addTitle')}
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {field.state.value.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic py-2">
                              {t('appConfig.fields.noCustomTitles')}
                            </p>
                          ) : (
                            field.state.value.map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <Input
                                  value={item}
                                  aria-label={t(
                                    'appConfig.fields.customTitles',
                                  )}
                                  placeholder={t(
                                    'appConfig.fields.titlePlaceholder',
                                  )}
                                  onChange={(e) => {
                                    const next = [...field.state.value]
                                    next[index] = e.target.value
                                    field.handleChange(next)
                                    setFormDirty(true)
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={() => {
                                    field.handleChange(
                                      field.state.value.filter(
                                        (_, i) => i !== index,
                                      ),
                                    )
                                    setFormDirty(true)
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">
                                    {t('common.delete')}
                                  </span>
                                </Button>
                              </div>
                            ))
                          )}
                          {field.state.meta.errors.length > 0 && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </div>
                      </div>
                    )}
                  />
                </FieldSet>
              </CardContent>
            </Card>

            <h3 className="text-lg font-semibold">
              {t('appConfig.sections.students')}
            </h3>
            <Card>
              <CardContent>
                <FieldSet>
                  <FieldLegend>
                    {t('appConfig.form.attendancePoint')}
                  </FieldLegend>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('appConfig.form.attendancePoint.description')}
                  </p>
                  <FieldGroup>
                    <form.Field
                      name="attendancePointMode"
                      children={(field) => (
                        <RadioGroup
                          value={field.state.value}
                          onValueChange={(val) => {
                            field.handleChange(val as 'rate' | 'type')
                            setFormDirty(true)
                          }}
                          className="flex flex-col gap-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rate" id="ap-rate" />
                            <Label htmlFor="ap-rate" className="cursor-pointer">
                              {t('appConfig.fields.attendancePoint.modeRate')}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="type" id="ap-type" />
                            <Label htmlFor="ap-type" className="cursor-pointer">
                              {t('appConfig.fields.attendancePoint.modeType')}
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    />

                    <form.Subscribe
                      selector={(s) => s.values.attendancePointMode}
                      children={(mode) => {
                        if (mode !== 'type') return null
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pt-2 border-t">
                            <form.Field
                              name="attendancePointPresent"
                              children={(field) => (
                                <Field>
                                  <FieldLabel htmlFor="attendancePointPresent">
                                    {t(
                                      'appConfig.fields.attendancePoint.present',
                                    )}
                                  </FieldLabel>
                                  <Input
                                    id="attendancePointPresent"
                                    type="number"
                                    step="0.1"
                                    min="-10"
                                    max="10"
                                    value={field.state.value}
                                    onChange={(e) => {
                                      field.handleChange(
                                        parseFloat(e.target.value) || 0,
                                      )
                                      setFormDirty(true)
                                    }}
                                  />
                                  <FieldError
                                    errors={field.state.meta.errors}
                                  />
                                </Field>
                              )}
                            />

                            <form.Field
                              name="attendancePointLate"
                              children={(field) => (
                                <Field>
                                  <FieldLabel htmlFor="attendancePointLate">
                                    {t('appConfig.fields.attendancePoint.late')}
                                  </FieldLabel>
                                  <Input
                                    id="attendancePointLate"
                                    type="number"
                                    step="0.1"
                                    min="-10"
                                    max="10"
                                    value={field.state.value}
                                    onChange={(e) => {
                                      field.handleChange(
                                        parseFloat(e.target.value) || 0,
                                      )
                                      setFormDirty(true)
                                    }}
                                  />
                                  <FieldError
                                    errors={field.state.meta.errors}
                                  />
                                </Field>
                              )}
                            />

                            <form.Field
                              name="attendancePointExcused"
                              children={(field) => (
                                <Field>
                                  <FieldLabel htmlFor="attendancePointExcused">
                                    {t(
                                      'appConfig.fields.attendancePoint.excused',
                                    )}
                                  </FieldLabel>
                                  <Input
                                    id="attendancePointExcused"
                                    type="number"
                                    step="0.1"
                                    min="-10"
                                    max="10"
                                    value={field.state.value}
                                    onChange={(e) => {
                                      field.handleChange(
                                        parseFloat(e.target.value) || 0,
                                      )
                                      setFormDirty(true)
                                    }}
                                  />
                                  <FieldError
                                    errors={field.state.meta.errors}
                                  />
                                </Field>
                              )}
                            />

                            <form.Field
                              name="attendancePointAbsentUnset"
                              children={(field) => (
                                <Field>
                                  <FieldLabel htmlFor="attendancePointAbsentUnset">
                                    {t(
                                      'appConfig.fields.attendancePoint.absentUnset',
                                    )}
                                  </FieldLabel>
                                  <Input
                                    id="attendancePointAbsentUnset"
                                    type="number"
                                    step="0.1"
                                    min="-10"
                                    max="10"
                                    value={field.state.value}
                                    onChange={(e) => {
                                      field.handleChange(
                                        parseFloat(e.target.value) || 0,
                                      )
                                      setFormDirty(true)
                                    }}
                                  />
                                  <FieldError
                                    errors={field.state.meta.errors}
                                  />
                                </Field>
                              )}
                            />
                          </div>
                        )
                      }}
                    />
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            )}
          />
        </div>
      </form>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('branches.confirmLeave.title', 'Discard unsaved changes?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'branches.confirmLeave.description',
                'You have unsaved changes that will be lost.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                onSuccess()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('branches.confirmLeave.discard', 'Discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
