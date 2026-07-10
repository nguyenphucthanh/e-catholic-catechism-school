import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent } from '../ui/card'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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
  }
  requesterId: Id<'catechists'>
  upsertMutation: (args: {
    requesterId: Id<'catechists'>
    troopName?: string
    parishName: string
    dioceseName: string
    nameFormat: 'firstName_lastName' | 'lastName_firstName'
    logoStorageId?: Id<'_storage'> | null
    epiphanyOnSunday: boolean
    corpusChristiOnSunday: boolean
    ascensionOnSunday: boolean
  }) => Promise<unknown>
  generateUploadUrlMutation: () => Promise<string>
  onSuccess: () => void
}

export function AppConfigForm({
  initialValues,
  requesterId,
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

  const form = useForm({
    defaultValues: {
      troopName: initialValues?.troopName ?? '',
      parishName: initialValues?.parishName ?? '',
      dioceseName: initialValues?.dioceseName ?? '',
      nameFormat: initialValues?.nameFormat ?? 'firstName_lastName',
      epiphanyOnSunday: initialValues?.epiphanyOnSunday ?? true,
      corpusChristiOnSunday: initialValues?.corpusChristiOnSunday ?? true,
      ascensionOnSunday: initialValues?.ascensionOnSunday ?? true,
    },
    onSubmit: async ({ value }) => {
      if (!value.parishName || !value.dioceseName) return

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

        await upsertMutation({
          requesterId,
          ...value,
          troopName: value.troopName || undefined,
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
                  children={(field) => (
                    <Field>
                      <FieldLabel htmlFor="troopName">
                        {t('appConfig.fields.troopName')}
                      </FieldLabel>
                      <Input
                        id="troopName"
                        placeholder={t(
                          'appConfig.fields.troopName.placeholder',
                        )}
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value)
                          setFormDirty(true)
                        }}
                        onBlur={field.handleBlur}
                      />
                    </Field>
                  )}
                />

                <form.Field
                  name="parishName"
                  children={(field) => {
                    const isInvalid = field.state.meta.errors.length > 0
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="parishName">
                          {t('appConfig.fields.parishName')}{' '}
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          id="parishName"
                          placeholder={t(
                            'appConfig.fields.parishName.placeholder',
                          )}
                          value={field.state.value}
                          onChange={(e) => {
                            field.handleChange(e.target.value)
                            setFormDirty(true)
                          }}
                          onBlur={field.handleBlur}
                        />
                        {isInvalid && (
                          <FieldError
                            errors={field.state.meta.errors.map((message) => ({
                              message,
                            }))}
                          />
                        )}
                      </Field>
                    )
                  }}
                />

                <form.Field
                  name="dioceseName"
                  children={(field) => {
                    const isInvalid = field.state.meta.errors.length > 0
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="dioceseName">
                          {t('appConfig.fields.dioceseName')}{' '}
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          id="dioceseName"
                          placeholder={t(
                            'appConfig.fields.dioceseName.placeholder',
                          )}
                          value={field.state.value}
                          onChange={(e) => {
                            field.handleChange(e.target.value)
                            setFormDirty(true)
                          }}
                          onBlur={field.handleBlur}
                        />
                        {isInvalid && (
                          <FieldError
                            errors={field.state.meta.errors.map((message) => ({
                              message,
                            }))}
                          />
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

                <form.Field
                  name="nameFormat"
                  children={(field) => {
                    const isInvalid = field.state.meta.errors.length > 0
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
                          <FieldError
                            errors={field.state.meta.errors.map((message) => ({
                              message,
                            }))}
                          />
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
