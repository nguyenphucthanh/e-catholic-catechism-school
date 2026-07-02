import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

type Gender = 'male' | 'female' | 'other'

export interface CatechistPersonalInfoFormValues {
  fullName: string
  saintName?: string
  dateOfBirth?: string
  gender?: Gender
  joinedDate?: string
  notes?: string
  title?: string
  community?: string
  level?: string
}

interface CatechistPersonalInfoFormProps {
  initialValues: {
    fullName: string
    saintName: string
    dateOfBirth: string
    gender: string
    joinedDate: string
    notes: string
    title: string
    community: string
    level: string
  }
  _catechistId?: Id<'catechists'>
  onSubmit: (values: CatechistPersonalInfoFormValues) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  submitLabel?: string
  fullWidthSubmit?: boolean
}

export function CatechistPersonalInfoForm({
  initialValues,
  onSubmit,
  onDirtyChange,
  submitLabel,
  fullWidthSubmit,
}: CatechistPersonalInfoFormProps) {
  const { t } = useTranslation()

  const form = useForm({
    defaultValues: {
      fullName: initialValues.fullName,
      saintName: initialValues.saintName,
      dateOfBirth: initialValues.dateOfBirth,
      gender: initialValues.gender as Gender | '',
      joinedDate: initialValues.joinedDate,
      notes: initialValues.notes,
      title: initialValues.title,
      community: initialValues.community,
      level: initialValues.level,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        fullName: value.fullName,
        saintName: value.saintName || undefined,
        dateOfBirth: value.dateOfBirth || undefined,
        gender: value.gender || undefined,
        joinedDate: value.joinedDate || undefined,
        notes: value.notes || undefined,
        title: value.title || undefined,
        community: value.community || undefined,
        level: value.level || undefined,
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="saintName"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="saintName">
              {t('profile.personal.saintName')}
            </FieldLabel>
            <Input
              id="saintName"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange?.(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <form.Field
        name="fullName"
        validators={{
          onBlur: ({ value }) => {
            const r = z.string().min(1).safeParse(value)
            return r.success
              ? undefined
              : t('profile.personal.fullName.required')
          },
        }}
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="fullName">
              {t('profile.personal.fullName')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="fullName"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange?.(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="dateOfBirth"
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel htmlFor="dateOfBirth">
                {t('profile.personal.dob')}
              </FieldLabel>
              <Input
                id="dateOfBirth"
                type="date"
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  onDirtyChange?.(true)
                }}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </Field>
          )}
        />

        <form.Field
          name="gender"
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel>{t('profile.personal.gender')}</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(val) => {
                  field.handleChange(val as Gender | '')
                  onDirtyChange?.(true)
                }}
                items={[
                  {
                    value: 'male',
                    label: t('profile.personal.gender.male'),
                  },
                  {
                    value: 'female',
                    label: t('profile.personal.gender.female'),
                  },
                  {
                    value: 'other',
                    label: t('profile.personal.gender.other'),
                  },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('profile.personal.gender.placeholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">
                    {t('profile.personal.gender.male')}
                  </SelectItem>
                  <SelectItem value="female">
                    {t('profile.personal.gender.female')}
                  </SelectItem>
                  <SelectItem value="other">
                    {t('profile.personal.gender.other')}
                  </SelectItem>
                </SelectContent>
              </Select>
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </Field>
          )}
        />
      </div>

      <form.Field
        name="joinedDate"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="joinedDate">
              {t('profile.personal.joinedDate')}
            </FieldLabel>
            <Input
              id="joinedDate"
              type="date"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange?.(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <form.Field
        name="notes"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="notes">
              {t('profile.personal.notes')}
            </FieldLabel>
            <Textarea
              id="notes"
              rows={3}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange?.(true)
              }}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="title"
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel>{t('profile.personal.title.label')}</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(val) => {
                  field.handleChange(val ?? '')
                  onDirtyChange?.(true)
                }}
                items={[
                  {
                    value: '',
                    label: t('profile.personal.title.none'),
                  },
                  {
                    value: 'Cha',
                    label: t('profile.personal.title.cha'),
                  },
                  {
                    value: 'Thầy',
                    label: t('profile.personal.title.thay'),
                  },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('profile.personal.title.placeholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t('profile.personal.title.none')}
                  </SelectItem>
                  <SelectItem value="Cha">
                    {t('profile.personal.title.cha')}
                  </SelectItem>
                  <SelectItem value="Thầy">
                    {t('profile.personal.title.thay')}
                  </SelectItem>
                  <SelectItem value="Soeur">
                    {t('profile.personal.title.soeur')}
                  </SelectItem>
                  <SelectItem value="Huynh Trưởng">
                    {t('profile.personal.title.huynh_truong')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <form.Field
          name="community"
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel htmlFor="community">
                {t('profile.personal.community')}
              </FieldLabel>
              <Input
                id="community"
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  onDirtyChange?.(true)
                }}
                onBlur={field.handleBlur}
              />
            </Field>
          )}
        />
      </div>

      <form.Field
        name="level"
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="level">
              {t('profile.personal.level')}
            </FieldLabel>
            <Input
              id="level"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                onDirtyChange?.(true)
              }}
              onBlur={field.handleBlur}
            />
          </Field>
        )}
      />

      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <Button
            type="submit"
            disabled={isSubmitting}
            className={fullWidthSubmit ? undefined : 'w-fit'}
          >
            {isSubmitting
              ? t('common.saving')
              : t(submitLabel ?? 'common.save')}
          </Button>
        )}
      />
    </form>
  )
}
