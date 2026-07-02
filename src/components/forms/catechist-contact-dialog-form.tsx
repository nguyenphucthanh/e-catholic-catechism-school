import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { PhoneInput } from '~/components/custom/inputs/phone-input'

export type ContactType = 'phone' | 'email' | 'zalo' | 'other'

export interface CatechistContactDialogFormValues {
  label: string
  contactType: ContactType
  value: string
  isPrimary: boolean
  notes?: string
}

interface CatechistContactDialogFormProps {
  initialValues?: {
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes: string
  }
  onSubmit: (values: CatechistContactDialogFormValues) => Promise<void>
}

function validateRequired(val: string, t: (key: string) => string) {
  const r = z.string().min(1).safeParse(val)
  return r.success ? undefined : t('common.required')
}

export function CatechistContactDialogForm({
  initialValues,
  onSubmit,
}: CatechistContactDialogFormProps) {
  const { t } = useTranslation()

  const form = useForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      contactType: initialValues?.contactType ?? 'phone',
      value: initialValues?.value ?? '',
      isPrimary: initialValues?.isPrimary ?? false,
      notes: initialValues?.notes ?? '',
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
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
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
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </Field>
          )}
        />

        <form.Field
          name="label"
          validators={{
            onBlur: ({ value }) => validateRequired(value, t),
            onSubmit: ({ value }) => validateRequired(value, t),
          }}
          children={(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel htmlFor="contact-label">
                {t('profile.contacts.col.label')}{' '}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="contact-label"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('profile.contacts.label.placeholder')}
              />
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </Field>
          )}
        />
      </div>

      <form.Field
        name="value"
        validators={{
          onChange: ({ value, fieldApi }) => {
            if (!value) return t('common.required')
            const type = fieldApi.form.getFieldValue('contactType')
            if (type === 'phone') {
              const phoneWithPlus = value.startsWith('+') ? value : `+${value}`
              if (!isValidPhoneNumber(phoneWithPlus)) {
                return t('profile.contacts.phone.invalid')
              }
            }
            if (type === 'email') {
              const r = z.string().email().safeParse(value)
              if (!r.success) return t('profile.contacts.email.invalid')
            }
            return undefined
          },
          onBlur: ({ value, fieldApi }) => {
            if (!value) return t('common.required')
            const type = fieldApi.form.getFieldValue('contactType')
            if (type === 'phone') {
              const phoneWithPlus = value.startsWith('+') ? value : `+${value}`
              if (!isValidPhoneNumber(phoneWithPlus)) {
                return t('profile.contacts.phone.invalid')
              }
            }
            if (type === 'email') {
              const r = z.string().email().safeParse(value)
              if (!r.success) return t('profile.contacts.email.invalid')
            }
            return undefined
          },
          onSubmit: ({ value, fieldApi }) => {
            if (!value) return t('common.required')
            const type = fieldApi.form.getFieldValue('contactType')
            if (type === 'phone') {
              const phoneWithPlus = value.startsWith('+') ? value : `+${value}`
              if (!isValidPhoneNumber(phoneWithPlus)) {
                return t('profile.contacts.phone.invalid')
              }
            }
            return undefined
          },
        }}
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
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
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      void form.validateField('value', 'change')
                    }}
                    onBlur={field.handleBlur}
                    placeholder={t('profile.contacts.value.placeholder')}
                  />
                )
              }
            </form.Subscribe>
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
            <FieldLabel htmlFor="contact-notes">
              {t('profile.contacts.col.notes')}
            </FieldLabel>
            <Input
              id="contact-notes"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
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
