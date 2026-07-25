import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { DEFAULT_COUNTRY } from '~/lib/locale'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'

export interface CatechistAddressFormValues {
  country: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  hamlet?: string
  subHamlet?: string
}

interface CatechistAddressFormProps {
  initialValues: {
    addressLine1: string
    addressLine2: string
    city: string
    stateProvince: string
    postalCode: string
    hamlet: string
    subHamlet: string
  }
  onSubmit: (values: CatechistAddressFormValues) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  submitLabel?: string
}

export interface CatechistAddressFieldsProps {
  form: any
  onDirtyChange?: (dirty: boolean) => void
}

const formSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  hamlet: z.string().optional(),
  subHamlet: z.string().optional(),
})

export function CatechistAddressFields({
  form,
  onDirtyChange,
}: CatechistAddressFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <form.Field
        name="addressLine1"
        children={(field: any) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor="addressLine1">
                {t('profile.address.line1')}
              </FieldLabel>
              <Input
                id="addressLine1"
                name={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  onDirtyChange?.(true)
                }}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      />

      <form.Field
        name="addressLine2"
        children={(field: any) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor="addressLine2">
                {t('profile.address.line2')}
              </FieldLabel>
              <Input
                id="addressLine2"
                name={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  onDirtyChange?.(true)
                }}
                onBlur={field.handleBlur}
                aria-invalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="city"
          children={(field: any) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="city">
                  {t('profile.address.city')}
                </FieldLabel>
                <Input
                  id="city"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    onDirtyChange?.(true)
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="stateProvince"
          children={(field: any) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="stateProvince">
                  {t('profile.address.state')}
                </FieldLabel>
                <Input
                  id="stateProvince"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    onDirtyChange?.(true)
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="hamlet"
          children={(field: any) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="hamlet">
                  {t('profile.address.hamlet')}
                </FieldLabel>
                <Input
                  id="hamlet"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    onDirtyChange?.(true)
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="subHamlet"
          children={(field: any) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="subHamlet">
                  {t('profile.address.subHamlet')}
                </FieldLabel>
                <Input
                  id="subHamlet"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    onDirtyChange?.(true)
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="postalCode"
          children={(field: any) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="postalCode">
                  {t('profile.address.postal')}
                </FieldLabel>
                <Input
                  id="postalCode"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    onDirtyChange?.(true)
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
      </div>
    </>
  )
}

export function CatechistAddressForm({
  initialValues,
  onSubmit,
  onDirtyChange,
  submitLabel,
}: CatechistAddressFormProps) {
  const { t } = useTranslation()

  const form = useForm({
    defaultValues: {
      addressLine1: initialValues.addressLine1,
      addressLine2: initialValues.addressLine2,
      city: initialValues.city,
      stateProvince: initialValues.stateProvince,
      postalCode: initialValues.postalCode,
      hamlet: initialValues.hamlet,
      subHamlet: initialValues.subHamlet,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        country: DEFAULT_COUNTRY,
        addressLine1: value.addressLine1 || undefined,
        addressLine2: value.addressLine2 || undefined,
        city: value.city || undefined,
        stateProvince: value.stateProvince || undefined,
        postalCode: value.postalCode || undefined,
        hamlet: value.hamlet || undefined,
        subHamlet: value.subHamlet || undefined,
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
      <CatechistAddressFields form={form} onDirtyChange={onDirtyChange} />
      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <Button type="submit" disabled={isSubmitting} className="w-fit">
            {isSubmitting
              ? t('common.saving')
              : t(submitLabel ?? 'common.save')}
          </Button>
        )}
      />
    </form>
  )
}
