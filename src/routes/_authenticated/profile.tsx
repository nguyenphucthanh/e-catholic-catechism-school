import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { UserCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { CatechistPersonalInfoFormValues } from '~/components/forms/catechist-personal-info-form'
import type { CatechistAddressFormValues } from '~/components/forms/catechist-address-form'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { CatechistPersonalInfoForm } from '~/components/forms/catechist-personal-info-form'
import { CatechistAddressForm } from '~/components/forms/catechist-address-form'
import { CatechistContactsSection } from '~/components/forms/catechist-contacts-section'
import { CatechistPhotoUpload } from '~/components/custom/catechist-photo-upload'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
  staticData: { crumb: 'nav.profile' },
})

// ─── Photo Section ────────────────────────────────────────────────────────────

function PhotoSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const profile = useQuery(api.catechists.getMyProfile, { catechistId })

  if (profile === null) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.personal.photo')}</CardTitle>
        <CardDescription>{t('profile.personal.photo.maxSize')}</CardDescription>
      </CardHeader>
      <CardContent>
        {profile === undefined ? (
          <Skeleton className="size-32 rounded-full" />
        ) : (
          <CatechistPhotoUpload
            catechistId={catechistId}
            fullName={profile.fullName}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Personal Info ────────────────────────────────────────────────────────────

function PersonalInfoSection({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const profile = useQuery(api.catechists.getMyProfile, { catechistId })
  const updateProfile = useMutation(api.catechists.updateMyProfile)

  const handleSubmit = async (values: CatechistPersonalInfoFormValues) => {
    await updateProfile({ ...values, catechistId })
    toast.success(t('common.saved'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.personal.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {profile === undefined ? (
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">
            {t('profile.personal.not_found')}
          </p>
        ) : (
          <CatechistPersonalInfoForm
            initialValues={{
              fullName: profile.fullName,
              saintName: profile.saintName ?? '',
              dateOfBirth: profile.dateOfBirth ?? '',
              gender: profile.gender ?? '',
              joinedDate: profile.joinedDate ?? '',
              notes: profile.notes ?? '',
              title: profile.title ?? '',
              community: profile.community ?? '',
              level: profile.level ?? '',
            }}
            onSubmit={handleSubmit}
            submitLabel="profile.personal.save"
            fullWidthSubmit
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Address ──────────────────────────────────────────────────────────────────

function AddressSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const address = useQuery(api.catechists.getMyAddress, { catechistId })
  const upsertAddress = useMutation(api.catechists.upsertMyAddress)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.address.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {address === undefined ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <CatechistAddressForm
            initialValues={{
              addressLine1: address?.addressLine1 ?? '',
              addressLine2: address?.addressLine2 ?? '',
              city: address?.city ?? '',
              stateProvince: address?.stateProvince ?? '',
              postalCode: address?.postalCode ?? '',
              hamlet: address?.hamlet ?? '',
              subHamlet: address?.subHamlet ?? '',
            }}
            onSubmit={async (values: CatechistAddressFormValues) => {
              await upsertAddress({ ...values, catechistId })
              toast.success(t('common.saved'))
            }}
            submitLabel="profile.address.save"
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

function ContactsSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const contacts = useQuery(api.catechists.getMyContacts, { catechistId })
  const addContactMutation = useMutation(api.catechists.addContact)
  const updateContactMutation = useMutation(api.catechists.updateContact)
  const deleteContactMutation = useMutation(api.catechists.deleteContact)

  return (
    <CatechistContactsSection
      catechistId={catechistId}
      contacts={contacts}
      addContact={addContactMutation}
      updateContact={updateContactMutation}
      deleteContact={deleteContactMutation}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const catechistId = user?.userDocId as Id<'catechists'> | undefined

  if (!catechistId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={UserCircle} title={t('profile.title')} />
        <p className="text-sm text-muted-foreground">
          {t('auth.stale_session')}{' '}
          <button
            onClick={logout}
            className="text-primary underline underline-offset-4"
          >
            {t('auth.stale_session_action')}
          </button>{' '}
          {t('auth.stale_session_suffix')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={UserCircle} title={t('profile.title')} />
      <PhotoSection catechistId={catechistId} />
      <PersonalInfoSection catechistId={catechistId} />
      <AddressSection catechistId={catechistId} />
      <ContactsSection catechistId={catechistId} />
    </div>
  )
}
