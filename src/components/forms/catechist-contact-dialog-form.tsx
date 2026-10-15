import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  CONTACT_PUBLICITY_ICONS,
  DEFAULT_CONTACT_PUBLICITY,
} from './contact-publicity'
import type { ContactPublicity } from './contact-publicity'
import { DEFAULT_COUNTRY } from '~/lib/locale'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '~/components/ui/field'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { PhoneInput } from '~/components/custom/inputs/phone-input'

export type ContactType = 'phone' | 'email' | 'zalo' | 'other'
export type { ContactPublicity }

export interface CatechistContactDialogFormValues {
  label: string
  contactType: ContactType
  value: string
  isPrimary: boolean
  notes?: string
  publicity: ContactPublicity
}

interface CatechistContactDialogFormProps {
  initialValues?: {
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes: string
    publicity?: ContactPublicity
  }
  onSubmit: (values: CatechistContactDialogFormValues) => Promise<void>
}

export function CatechistContactDialogForm({
  initialValues,
  onSubmit,
}: CatechistContactDialogFormProps) {
  const { t } = useTranslation()

  const formSchema = useMemo(
    () =>
      z
        .object({
          contactType: z.enum(['phone', 'email', 'zalo', 'other']),
          label: z.string().trim().min(1, t('common.required')),
          value: z.string().trim(),
          isPrimary: z.boolean(),
          notes: z.string(),
          publicity: z.enum(['private', 'public']),
        })
        .superRefine((data, ctx) => {
          if (!data.value) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: t('common.required'),
            })
            return
          }
          if (data.contactType === 'phone') {
            const phoneWithPlus = data.value.startsWith('+')
              ? data.value
              : `+${data.value}`
            if (!isValidPhoneNumber(phoneWithPlus)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['value'],
                message: t('profile.contacts.phone.invalid'),
              })
            }
          } else if (data.contactType === 'email') {
            const r = z.string().email().safeParse(data.value)
            if (!r.success) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['value'],
                message: t('profile.contacts.email.invalid'),
              })
            }
          }
        }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      contactType: initialValues?.contactType ?? 'phone',
      value: initialValues?.value ?? '',
      isPrimary: initialValues?.isPrimary ?? false,
      notes: initialValues?.notes ?? '',
      publicity: initialValues?.publicity ?? DEFAULT_CONTACT_PUBLICITY,
    },
    validators: {
      onChange: formSchema,
      onBlur: formSchema,
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      let storedValue = value.value
      if (value.contactType === 'phone') {
        const phoneWithPlus = value.value.startsWith('+')
          ? value.value
          : `+${value.value}`
        if (isValidPhoneNumber(phoneWithPlus)) {
          storedValue = parsePhoneNumber(phoneWithPlus).format('E.164')
        }
      }
      try {
        await onSubmit({
          label: value.label,
          contactType: value.contactType,
          value: storedValue,
          isPrimary: value.isPrimary,
          notes: value.notes || undefined,
          publicity: value.publicity,
        })
      } catch {
        toast.error(t('profile.contacts.saveError'))
      }
    },
  })

  return (
    <form
      id="contact-dialog-form"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field
          name="contactType"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel>{t('profile.contacts.col.type')}</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => {
                    field.handleChange(val as ContactType)
                    void form.validateField('value', 'change')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">
                      {t('profile.contacts.type.phone')}
                    </SelectItem>
                    <SelectItem value="email">
                      {t('profile.contacts.type.email')}
                    </SelectItem>
                    <SelectItem value="zalo">
                      {t('profile.contacts.type.zalo')}
                    </SelectItem>
                    <SelectItem value="other">
                      {t('profile.contacts.type.other')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="label"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="contact-label">
                  {t('profile.contacts.col.label')}{' '}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="contact-label"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('profile.contacts.label.placeholder')}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
      </div>

      <form.Field
        name="value"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor="contact-value">
                {t('profile.contacts.col.value')}{' '}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <form.Subscribe selector={(state) => state.values.contactType}>
                {(contactType) =>
                  contactType === 'phone' ? (
                    <PhoneInput
                      country={DEFAULT_COUNTRY.toLowerCase()}
                      disableDropdown
                      value={field.state.value}
                      onChange={(val) => {
                        field.handleChange(val)
                        void form.validateField('value', 'change')
                      }}
                      onBlur={field.handleBlur}
                      placeholder={t('profile.contacts.value.placeholder')}
                      inputProps={{
                        id: 'contact-value',
                      }}
                    />
                  ) : (
                    <Input
                      id="contact-value"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        void form.validateField('value', 'change')
                      }}
                      onBlur={field.handleBlur}
                      placeholder={t('profile.contacts.value.placeholder')}
                      aria-invalid={isInvalid}
                    />
                  )
                }
              </form.Subscribe>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      />

      <form.Field
        name="notes"
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor="contact-notes">
                {t('profile.contacts.col.notes')}
              </FieldLabel>
              <Input
                id="contact-notes"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      />

      <form.Field
        name="isPrimary"
        children={(field) => (
          <Field orientation={'horizontal'}>
            <Checkbox
              id="contact-isPrimary"
              checked={field.state.value}
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            <FieldContent>
              <FieldLabel
                htmlFor="contact-isPrimary"
                className="cursor-pointer font-normal"
              >
                {t('profile.contacts.isPrimary')}
              </FieldLabel>
            </FieldContent>
          </Field>
        )}
      />

      <form.Field
        name="publicity"
        children={(field) => (
          <Field className="gap-2">
            <FieldLabel>{t('profile.contacts.publicity.label')}</FieldLabel>
            <RadioGroup
              value={field.state.value}
              onValueChange={(val) =>
                field.handleChange(val as ContactPublicity)
              }
              className="flex flex-col gap-2.5"
            >
              {(['private', 'public'] as const).map((value) => {
                const Icon = CONTACT_PUBLICITY_ICONS[value]
                return (
                  <div key={value} className="flex items-start gap-2">
                    <RadioGroupItem
                      value={value}
                      id={`contact-publicity-${value}`}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <Label
                        htmlFor={`contact-publicity-${value}`}
                        className="flex cursor-pointer items-center gap-1.5 text-sm font-medium"
                      >
                        <Icon className="size-3.5 text-muted-foreground" />
                        {t(`profile.contacts.publicity.${value}`)}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(`profile.contacts.publicity.${value}Desc`)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </RadioGroup>
          </Field>
        )}
      />

      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('common.save')}
          </Button>
        )}
      />
    </form>
  )
}
