import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import {
  Edit,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { DEFAULT_COUNTRY } from '~/lib/locale'

import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Badge } from '~/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export const Route = createFileRoute('/_authenticated/catechists_/create')({
  component: CreateCatechistPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.create.title' },
    ],
  },
})

function CreateCatechistPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  if (!canManage || !requesterId) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return <CreateCatechistForm requesterId={requesterId} />
}

type ContactType = 'phone' | 'email' | 'zalo' | 'other'

type StagedContact = {
  id: string
  label: string
  contactType: ContactType
  value: string
  isPrimary: boolean
  notes?: string
}

const CONTACT_TYPE_ICONS: Record<ContactType, React.ElementType> = {
  phone: Phone,
  email: Mail,
  zalo: MessageCircle,
  other: LinkIcon,
}

function ContactTypeIcon({ type }: { type: ContactType }) {
  const Icon = CONTACT_TYPE_ICONS[type]
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}

type ContactDialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; contact: StagedContact }

function ContactDialogForm({
  initialValues,
  onSave,
}: {
  initialValues?: StagedContact
  onSave: (data: Omit<StagedContact, 'id'>) => void
}) {
  const { t } = useTranslation()

  const form = useForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      contactType: initialValues?.contactType ?? 'phone',
      value: initialValues?.value ?? '',
      isPrimary: initialValues?.isPrimary ?? false,
      notes: initialValues?.notes ?? '',
    },
    onSubmit: ({ value }) => {
      let storedValue = value.value
      if (value.contactType === 'phone') {
        const phoneWithPlus = value.value.startsWith('+')
          ? value.value
          : `+${value.value}`
        if (isValidPhoneNumber(phoneWithPlus)) {
          storedValue = parsePhoneNumber(phoneWithPlus).format('E.164')
        }
      }
      onSave({
        label: value.label,
        contactType: value.contactType,
        value: storedValue,
        isPrimary: value.isPrimary,
        notes: value.notes || undefined,
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field
          name="contactType"
          children={(field) => (
            <Field>
              <FieldLabel>{t('profile.contacts.col.type')}</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as ContactType)}
              >
                <SelectTrigger>
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
            </Field>
          )}
        />
        <form.Field
          name="label"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="label">
                {t('profile.contacts.col.label')}
              </FieldLabel>
              <Input
                id="label"
                placeholder={t('profile.contacts.label.placeholder')}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </Field>
          )}
        />
      </div>

      <form.Field
        name="value"
        validators={{
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
              if (!r.success) return 'Invalid email'
            }
            return undefined
          },
        }}
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="value">
              {t('profile.contacts.col.value')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="value"
              placeholder={t('profile.contacts.value.placeholder')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              autoFocus
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
          <Field>
            <FieldLabel htmlFor="notes">
              {t('profile.contacts.col.notes')}
            </FieldLabel>
            <Input
              id="notes"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </Field>
        )}
      />

      <form.Field
        name="isPrimary"
        children={(field) => (
          <Field className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
            <Checkbox
              id="isPrimary"
              checked={field.state.value}
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            <div className="space-y-1 leading-none">
              <FieldLabel htmlFor="isPrimary">
                {t('profile.contacts.col.isPrimary')}
              </FieldLabel>
            </div>
          </Field>
        )}
      />

      <form.Subscribe
        selector={(s) => s.isSubmitting}
        children={(isSubmitting) => (
          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            {t('common.save')}
          </Button>
        )}
      />
    </form>
  )
}

function CreateCatechistForm({
  requesterId,
}: {
  requesterId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const createMutation = useMutation(api.catechists.create)
  const upsertAddressMutation = useMutation(api.catechists.upsertMyAddress)
  const addContactMutation = useMutation(api.catechists.addContact)

  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

  const [address, setAddress] = React.useState({
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    hamlet: '',
    subHamlet: '',
  })

  const handleAddressChange =
    (field: keyof typeof address) => (value: string) => {
      setAddress((prev) => ({ ...prev, [field]: value }))
      setFormDirty(true)
    }

  const [stagedContacts, setStagedContacts] = React.useState<
    Array<StagedContact>
  >([])
  const [contactDialog, setContactDialog] = React.useState<ContactDialogState>({
    mode: 'closed',
  })

  const handleContactSave = (data: Omit<StagedContact, 'id'>) => {
    const targetId =
      contactDialog.mode === 'edit'
        ? contactDialog.contact.id
        : crypto.randomUUID()
    let contacts =
      contactDialog.mode === 'edit'
        ? stagedContacts.map((c) =>
            c.id === targetId ? { ...data, id: targetId } : c,
          )
        : [...stagedContacts, { ...data, id: targetId }]

    if (data.isPrimary) {
      contacts = contacts.map((c) =>
        c.contactType === data.contactType && c.id !== targetId
          ? { ...c, isPrimary: false }
          : c,
      )
    }
    setStagedContacts(contacts)
    setFormDirty(true)
    setContactDialog({ mode: 'closed' })
  }

  const handleCancel = () => {
    if (formDirty) setConfirmLeaveOpen(true)
    else void navigate({ to: '/catechists' })
  }

  const form = useForm({
    defaultValues: {
      saintName: '',
      fullName: '',
      dateOfBirth: '',
      gender: '' as '' | 'male' | 'female' | 'other',
      role: '' as '' | 'admin' | 'user',
      joinedDate: '',
      notes: '',
    },
    onSubmitInvalid: ({ formApi }) => {
      console.error('Validation failed!', formApi.state.fieldMeta)
    },
    onSubmit: async ({ value }) => {
      try {
        const newId = await createMutation({
          requesterId,
          fullName: value.fullName,
          saintName: value.saintName || undefined,
          dateOfBirth: value.dateOfBirth || undefined,
          gender: value.gender || undefined,
          role: value.role as 'admin' | 'user',
          joinedDate: value.joinedDate || undefined,
          notes: value.notes || undefined,
        })

        const hasAddress = Object.values(address).some(Boolean)
        if (hasAddress) {
          await upsertAddressMutation({
            catechistId: newId,
            country: DEFAULT_COUNTRY,
            addressLine1: address.addressLine1 || undefined,
            addressLine2: address.addressLine2 || undefined,
            city: address.city || undefined,
            stateProvince: address.stateProvince || undefined,
            postalCode: address.postalCode || undefined,
            hamlet: address.hamlet || undefined,
            subHamlet: address.subHamlet || undefined,
          })
        }

        for (const contact of stagedContacts) {
          await addContactMutation({
            catechistId: newId,
            label: contact.label,
            contactType: contact.contactType,
            value: contact.value,
            isPrimary: contact.isPrimary,
            notes: contact.notes,
          })
        }

        toast.success(t('catechists.created'))
        setFormDirty(false)
        void navigate({ to: '/catechists/$id', params: { id: newId } })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('common.error'))
      }
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={t('catechists.create.title')}
        subtitle={t('catechists.create.subtitle')}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
            <CardDescription>
              {t('catechists.edit.personal.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="saintName"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('profile.personal.saintName')}
                    </FieldLabel>
                    <Input
                      id={field.name}
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
                name="fullName"
                validators={{
                  onBlur: ({ value }) =>
                    !value ? t('common.required') : undefined,
                  onSubmit: ({ value }) =>
                    !value ? t('common.required') : undefined,
                }}
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t('profile.personal.fullName')}{' '}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value)
                          setFormDirty(true)
                        }}
                        onBlur={field.handleBlur}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="dateOfBirth"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('profile.personal.dateOfBirth')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="date"
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
                name="gender"
                children={(field) => (
                  <Field>
                    <FieldLabel>{t('profile.personal.gender')}</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => {
                        field.handleChange(val as 'male' | 'female' | 'other')
                        setFormDirty(true)
                      }}
                    >
                      <SelectTrigger>
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
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="joinedDate"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('profile.personal.joinedDate')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="date"
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
                name="role"
                validators={{
                  onBlur: ({ value }) =>
                    !value ? t('common.required') : undefined,
                  onSubmit: ({ value }) =>
                    !value ? t('common.required') : undefined,
                }}
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>
                        {t('catechists.col.role')}{' '}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => {
                          field.handleChange(val as 'admin' | 'user')
                          setFormDirty(true)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('catechists.role.placeholder')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            {t('catechists.role.admin')}
                          </SelectItem>
                          <SelectItem value="user">
                            {t('catechists.role.user')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            </div>

            <form.Field
              name="notes"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('profile.personal.notes')}
                  </FieldLabel>
                  <Textarea
                    id={field.name}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('catechists.edit.address.title')}</CardTitle>
            <CardDescription>
              {t('catechists.edit.address.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="addressLine1">
                {t('profile.address.line1')}
              </FieldLabel>
              <Input
                id="addressLine1"
                value={address.addressLine1}
                onChange={(e) =>
                  handleAddressChange('addressLine1')(e.target.value)
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="addressLine2">
                {t('profile.address.line2')}
              </FieldLabel>
              <Input
                id="addressLine2"
                value={address.addressLine2}
                onChange={(e) =>
                  handleAddressChange('addressLine2')(e.target.value)
                }
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="city">
                  {t('profile.address.city')}
                </FieldLabel>
                <Input
                  id="city"
                  value={address.city}
                  onChange={(e) => handleAddressChange('city')(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="stateProvince">
                  {t('profile.address.state')}
                </FieldLabel>
                <Input
                  id="stateProvince"
                  value={address.stateProvince}
                  onChange={(e) =>
                    handleAddressChange('stateProvince')(e.target.value)
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="hamlet">
                  {t('profile.address.hamlet')}
                </FieldLabel>
                <Input
                  id="hamlet"
                  value={address.hamlet}
                  onChange={(e) =>
                    handleAddressChange('hamlet')(e.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="subHamlet">
                  {t('profile.address.subHamlet')}
                </FieldLabel>
                <Input
                  id="subHamlet"
                  value={address.subHamlet}
                  onChange={(e) =>
                    handleAddressChange('subHamlet')(e.target.value)
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="postalCode">
                  {t('profile.address.postalCode')}
                </FieldLabel>
                <Input
                  id="postalCode"
                  value={address.postalCode}
                  onChange={(e) =>
                    handleAddressChange('postalCode')(e.target.value)
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('catechists.edit.contacts.title')}</CardTitle>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setContactDialog({ mode: 'add' })}
            >
              <Plus className="mr-1 size-4" />
              {t('catechists.create.contacts.add')}
            </Button>
          </CardHeader>
          <CardContent>
            {stagedContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('catechists.create.contacts.empty')}
              </p>
            ) : (
              <ul className="flex flex-col">
                {stagedContacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="flex flex-row items-center justify-between gap-4 py-3 border-b last:border-0"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-row items-center gap-2">
                        <ContactTypeIcon type={contact.contactType} />
                        <span className="font-medium truncate">
                          {contact.value}
                        </span>
                        {contact.isPrimary && (
                          <Badge variant="secondary" className="px-1.5 py-0">
                            {t('profile.contacts.col.isPrimary')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {contact.label && (
                          <span className="truncate">{contact.label}</span>
                        )}
                        {contact.label && contact.notes && <span>&bull;</span>}
                        {contact.notes && (
                          <span className="truncate">{contact.notes}</span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">
                              {t('common.moreActions')}
                            </span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setContactDialog({ mode: 'edit', contact })
                          }
                        >
                          <Edit className="mr-2 size-4" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => {
                            setStagedContacts((prev) =>
                              prev.filter((c) => c.id !== contact.id),
                            )
                            setFormDirty(true)
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t('common.saving')
                  : t('catechists.create.title')}
              </Button>
            )}
          />
        </div>
      </form>

      <Dialog
        open={contactDialog.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setContactDialog({ mode: 'closed' })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contactDialog.mode === 'edit'
                ? t('profile.contacts.editContact')
                : t('profile.contacts.addContact')}
            </DialogTitle>
          </DialogHeader>
          {contactDialog.mode !== 'closed' && (
            <ContactDialogForm
              initialValues={
                contactDialog.mode === 'edit'
                  ? contactDialog.contact
                  : undefined
              }
              onSave={handleContactSave}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('catechists.confirmLeave.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('catechists.confirmLeave.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                void navigate({ to: '/catechists' })
              }}
            >
              {t('catechists.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
