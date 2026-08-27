import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info, Printer, UserCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { CatechistPersonalInfoForm } from '~/components/forms/catechist-personal-info-form'
import { formatPersonName } from '~/lib/name'
import { CatechistAddressForm } from '~/components/forms/catechist-address-form'
import { CatechistContactsSection } from '~/components/forms/catechist-contacts-section'
import { CatechistPhotoUpload } from '~/components/custom/catechist-photo-upload'
import { StudentDetailCards } from '~/components/custom/student-detail-cards'
import { ProfileAvatar } from '~/components/custom/profile-avatar'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
import { Alert, AlertDescription } from '~/components/ui/alert'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
  staticData: { crumb: 'nav.profile' },
})

// ─── Photo Section ────────────────────────────────────────────────────────────

function PhotoSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const profile = useQuery(api.catechists.getMyProfile, {
    requesterId: catechistId,
    catechistId,
  })

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
            requesterId={catechistId}
            catechistId={catechistId}
            fullName={formatPersonName(profile.saintName, profile.fullName)}
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
  const profile = useQuery(api.catechists.getMyProfile, {
    requesterId: catechistId,
    catechistId,
  })
  const updateProfile = useMutation(api.catechists.updateMyProfile)

  const handleSubmit = async (values: CatechistPersonalInfoFormValues) => {
    await updateProfile({ requesterId: catechistId, ...values, catechistId })
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
  const address = useQuery(api.catechists.getMyAddress, {
    requesterId: catechistId,
    catechistId,
  })
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
              await upsertAddress({
                requesterId: catechistId,
                catechistId,
                ...values,
              })
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
  const contacts = useQuery(api.catechists.getMyContacts, {
    requesterId: catechistId,
    catechistId,
  })
  const addContactMutation = useMutation(api.catechists.addContact)
  const updateContactMutation = useMutation(api.catechists.updateContact)
  const deleteContactMutation = useMutation(api.catechists.deleteContact)

  const wrapAdd = (
    args: Omit<Parameters<typeof addContactMutation>[0], 'requesterId'>,
  ) => addContactMutation({ ...args, requesterId: catechistId })
  const wrapUpdate = (
    args: Omit<Parameters<typeof updateContactMutation>[0], 'requesterId'>,
  ) => updateContactMutation({ ...args, requesterId: catechistId })
  const wrapDelete = (
    args: Omit<Parameters<typeof deleteContactMutation>[0], 'requesterId'>,
  ) => deleteContactMutation({ ...args, requesterId: catechistId })

  return (
    <CatechistContactsSection
      catechistId={catechistId}
      contacts={contacts}
      addContact={wrapAdd}
      updateContact={wrapUpdate}
      deleteContact={wrapDelete}
    />
  )
}

// ─── Student read-only view ────────────────────────────────────────────────────

function StudentProfilePage({ studentId }: { studentId: Id<'students'> }) {
  const { t } = useTranslation()
  const data = useQuery(api.students.getMyProfile, { requesterId: studentId })
  const appConfig = useQuery(api.appConfig.get)

  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!showQrCode || !data) {
      setQrCodeUrl(null)
      return
    }
    QRCode.toDataURL(data.studentCode).then(setQrCodeUrl)
  }, [showQrCode, data])

  const handlePrintCard = () => {
    if (!data || !appConfig) return
    exportQrCardsPdf(
      [
        {
          studentCode: data.studentCode,
          fullName: data.fullName,
          saintName: data.saintName,
        },
      ],
      {
        troopName: appConfig.troopName,
        parishName: appConfig.parishName,
        studentCodeLabel: t('printCards.studentCodeLabel'),
      },
      `${data.studentCode}-card.pdf`,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserCircle}
        title={
          data
            ? formatPersonName(data.saintName, data.fullName)
            : t('profile.title')
        }
      />

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          {t('profile.student.masked_info_hint')}
        </AlertDescription>
      </Alert>

      {data && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                {showQrCode && qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt={data.studentCode}
                    className="size-32"
                  />
                ) : (
                  <ProfileAvatar
                    size="lg"
                    className={'size-32!'}
                    userType={'student'}
                    userId={data._id}
                    fullName={data.fullName}
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold">
                    {formatPersonName(data.saintName, data.fullName)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('students.col.studentCode')}: {data.studentCode}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-4">
            <Button onClick={handlePrintCard} variant="outline">
              <Printer className="mr-2 size-4" />
              {t('printCards.singleAction')}
            </Button>
            <Label className="flex items-center gap-2 justify-end">
              <span className="text-sm text-muted-foreground">
                {t('students.detail.showQrCode')}
              </span>
              <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
            </Label>
          </CardFooter>
        </Card>
      )}

      <StudentDetailCards
        data={data}
        requester={{ accountType: 'student', requesterId: studentId }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  if (user?.accountType === 'student') {
    return <StudentProfilePage studentId={user.userDocId as Id<'students'>} />
  }

  const catechistId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

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
