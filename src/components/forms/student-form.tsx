import React from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { DEFAULT_COUNTRY } from '~/lib/locale'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { PhoneInput } from '~/components/custom/inputs/phone-input'

export type SacramentType =
  'baptism' | 'first_confession' | 'first_communion' | 'confirmation'

export const SACRAMENT_TYPES: Array<SacramentType> = [
  'baptism',
  'first_confession',
  'first_communion',
  'confirmation',
]

export interface StudentGuardianEntry {
  localId: string
  guardianId?: string
  fullName: string
  saintName: string
  relationship: string
  contactPriority: number
  notes: string
  phone: string
  email: string
  isLinked: boolean
}

export interface StudentSacramentEntry {
  received: boolean
  receivedDate: string
  receivedPlace: string
  notes: string
}

export interface StudentFormValues {
  fullName: string
  saintName: string
  dateOfBirth: string
  gender: '' | 'male' | 'female'
  isActive: boolean
  previousParish: string
  previousDiocese: string
  // address
  addressLine1: string
  addressLine2: string
  city: string
  stateProvince: string
  postalCode: string
  hamlet: string
  subHamlet: string
  // sacraments
  sacraments: Record<SacramentType, StudentSacramentEntry>
  // guardians
  guardians: Array<StudentGuardianEntry>
  // enrollment (create only)
  enrollmentEnabled: boolean
  enrollmentClassYearId: string
  enrollmentDate: string
}

export function defaultStudentFormValues(): StudentFormValues {
  const emptySacrament = (): StudentSacramentEntry => ({
    received: false,
    receivedDate: '',
    receivedPlace: '',
    notes: '',
  })
  return {
    fullName: '',
    saintName: '',
    dateOfBirth: '',
    gender: '',
    isActive: true,
    previousParish: '',
    previousDiocese: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    hamlet: '',
    subHamlet: '',
    sacraments: {
      baptism: emptySacrament(),
      first_confession: emptySacrament(),
      first_communion: emptySacrament(),
      confirmation: emptySacrament(),
    },
    guardians: [],
    enrollmentEnabled: false,
    enrollmentClassYearId: '',
    enrollmentDate: '',
  }
}

// ─── Guardian Phone Lookup ─────────────────────────────────────────────────────

function GuardianPhoneLookup({
  phone,
  requesterId,
  onFound,
  onNotFound,
}: {
  phone: string
  requesterId: Id<'catechists'>
  onFound: (guardian: {
    _id: Id<'guardians'>
    fullName: string
    saintName?: string
    notes?: string
  }) => void
  onNotFound: () => void
}) {
  const result = useQuery(
    api.guardians.findByPhone,
    phone.length >= 8 ? { requesterId, phone } : 'skip',
  )

  // Callback refs prevent stale closures: effect only re-runs when result
  // changes, but always calls the latest version of onFound/onNotFound.
  const onFoundRef = React.useRef(onFound)
  const onNotFoundRef = React.useRef(onNotFound)
  React.useEffect(() => {
    onFoundRef.current = onFound
    onNotFoundRef.current = onNotFound
  })

  React.useEffect(() => {
    if (result === undefined) return
    if (result) {
      onFoundRef.current(result)
    } else {
      onNotFoundRef.current()
    }
  }, [result])

  return null
}

// ─── Guardian Entry ────────────────────────────────────────────────────────────

function GuardianEntryRow({
  guardian,
  requesterId,
  onChange,
  onRemove,
}: {
  guardian: StudentGuardianEntry
  requesterId: Id<'catechists'>
  onChange: (updated: StudentGuardianEntry) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()

  const relationshipItems = [
    { value: 'father', label: t('students.form.guardian.relationship.father') },
    { value: 'mother', label: t('students.form.guardian.relationship.mother') },
    {
      value: 'guardian',
      label: t('students.form.guardian.relationship.guardian'),
    },
  ]

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3 relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-7 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
        <span className="sr-only">{t('students.form.guardian.remove')}</span>
      </Button>

      {/* phone lookup (runs silently) */}
      <GuardianPhoneLookup
        phone={guardian.phone}
        requesterId={requesterId}
        onFound={(found) => {
          onChange({
            ...guardian,
            guardianId: found._id,
            fullName: found.fullName,
            saintName: found.saintName ?? '',
            isLinked: true,
          })
        }}
        onNotFound={() => {
          if (guardian.isLinked) {
            onChange({ ...guardian, guardianId: undefined, isLinked: false })
          }
        }}
      />

      {guardian.isLinked && (
        <Badge variant="secondary" className="w-fit">
          {t('students.form.guardian.linked')}
        </Badge>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <FieldLabel>{t('students.form.guardian.phone')}</FieldLabel>
          <PhoneInput
            country="vn"
            value={guardian.phone}
            onChange={(val) => {
              const e164 = val.startsWith('+') ? val : `+${val}`
              onChange({
                ...guardian,
                phone: e164,
                isLinked: false,
                guardianId: undefined,
              })
            }}
            enableSearch
          />
        </Field>

        <Field>
          <FieldLabel>{t('students.form.guardian.email')}</FieldLabel>
          <Input
            value={guardian.email}
            onChange={(e) => onChange({ ...guardian, email: e.target.value })}
            type="email"
          />
        </Field>

        <Field>
          <FieldLabel>{t('students.form.guardian.fullName')}</FieldLabel>
          <Input
            value={guardian.fullName}
            disabled={guardian.isLinked}
            onChange={(e) =>
              onChange({ ...guardian, fullName: e.target.value })
            }
          />
        </Field>

        <Field>
          <FieldLabel>{t('students.form.guardian.saintName')}</FieldLabel>
          <Input
            value={guardian.saintName}
            disabled={guardian.isLinked}
            onChange={(e) =>
              onChange({ ...guardian, saintName: e.target.value })
            }
          />
        </Field>

        <Field>
          <FieldLabel>{t('students.form.guardian.relationship')}</FieldLabel>
          <Select
            value={guardian.relationship}
            onValueChange={(val) =>
              onChange({ ...guardian, relationship: val ?? '' })
            }
            items={relationshipItems}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {relationshipItems.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{t('students.form.guardian.contactPriority')}</FieldLabel>
          <Input
            type="number"
            min={1}
            value={guardian.contactPriority}
            onChange={(e) =>
              onChange({
                ...guardian,
                contactPriority: parseInt(e.target.value, 10) || 1,
              })
            }
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{t('students.form.guardian.notes')}</FieldLabel>
          <Input
            value={guardian.notes}
            onChange={(e) => onChange({ ...guardian, notes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Sacrament Row ─────────────────────────────────────────────────────────────

function SacramentRow({
  type,
  value,
  onChange,
}: {
  type: SacramentType
  value: StudentSacramentEntry
  onChange: (updated: StudentSacramentEntry) => void
}) {
  const { t } = useTranslation()
  const label = t(`students.sacraments.${type}`)

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-3">
      <Field orientation={'horizontal'}>
        <Checkbox
          checked={value.received}
          onCheckedChange={(checked) =>
            onChange({ ...value, received: checked === true })
          }
          id={`sacrament-type-${type}`}
        />
        <FieldLabel htmlFor={`sacrament-type-${type}`}>{label}</FieldLabel>
      </Field>

      {value.received && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6">
          <Field>
            <FieldLabel>{t('students.form.sacrament.receivedDate')}</FieldLabel>
            <Input
              type="date"
              value={value.receivedDate}
              onChange={(e) =>
                onChange({ ...value, receivedDate: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>
              {t('students.form.sacrament.receivedPlace')}
            </FieldLabel>
            <Input
              value={value.receivedPlace}
              onChange={(e) =>
                onChange({ ...value, receivedPlace: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>{t('students.form.sacrament.notes')}</FieldLabel>
            <Input
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

// ─── Enrollment Section ────────────────────────────────────────────────────────

function EnrollmentSection({
  requesterId,
  enabled,
  classYearId,
  enrolledDate,
  onEnabledChange,
  onClassYearChange,
  onDateChange,
}: {
  requesterId: Id<'catechists'>
  enabled: boolean
  classYearId: string
  enrolledDate: string
  onEnabledChange: (v: boolean) => void
  onClassYearChange: (v: string) => void
  onDateChange: (v: string) => void
}) {
  const { t } = useTranslation()

  const [academicYearId, setAcademicYearId] = React.useState<
    Id<'academicYears'> | undefined
  >(undefined)

  React.useEffect(() => {
    const stored = localStorage.getItem('giaoly_selected_year')
    if (stored) {
      setAcademicYearId(stored as Id<'academicYears'>)
    }
  }, [])

  const classYearsResult = useQuery(
    api.classes.listClassYears,
    requesterId && academicYearId ? { requesterId, academicYearId } : 'skip',
  )

  const classItems =
    classYearsResult?.map((cy) => ({
      label: cy.className,
      value: cy.classYearId,
    })) ?? []

  return (
    <div className="flex flex-col gap-3">
      <Field orientation={'horizontal'}>
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onEnabledChange(checked === true)}
          id="enrollment-enable"
        />
        <FieldLabel htmlFor="enrollment-enable">
          {t('students.form.enrollment.enable')}
        </FieldLabel>
      </Field>

      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
          <Field>
            <FieldLabel>{t('students.form.enrollment.class')}</FieldLabel>
            {classYearsResult && classItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('students.form.enrollment.noClasses')}
              </p>
            ) : (
              <Select
                value={classYearId}
                onValueChange={(val) => onClassYearChange(val ?? '')}
                items={classItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t(
                      'students.form.enrollment.class.placeholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {classItems.map((ci) => (
                    <SelectItem key={ci.value} value={ci.value}>
                      {ci.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field>
            <FieldLabel>{t('students.form.enrollment.date')}</FieldLabel>
            <Input
              type="date"
              value={enrolledDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

// ─── Main Form Component ───────────────────────────────────────────────────────

export interface StudentFormProps {
  mode: 'create' | 'edit'
  values: StudentFormValues
  onChange: (values: StudentFormValues) => void
  requesterId: Id<'catechists'>
}

export function StudentForm({
  mode,
  values,
  onChange,
  requesterId,
}: StudentFormProps) {
  const { t } = useTranslation()

  const setField = <TKey extends keyof StudentFormValues>(
    key: TKey,
    value: StudentFormValues[TKey],
  ) => {
    onChange({ ...values, [key]: value })
  }

  const setSacrament = (type: SacramentType, entry: StudentSacramentEntry) => {
    onChange({
      ...values,
      sacraments: { ...values.sacraments, [type]: entry },
    })
  }

  const addGuardian = () => {
    const nextPriority = values.guardians.length + 1
    onChange({
      ...values,
      guardians: [
        ...values.guardians,
        {
          localId: crypto.randomUUID(),
          guardianId: undefined,
          fullName: '',
          saintName: '',
          relationship: 'father',
          contactPriority: nextPriority,
          notes: '',
          phone: '',
          email: '',
          isLinked: false,
        },
      ],
    })
  }

  const updateGuardian = (localId: string, updated: StudentGuardianEntry) => {
    onChange({
      ...values,
      guardians: values.guardians.map((g) =>
        g.localId === localId ? updated : g,
      ),
    })
  }

  const removeGuardian = (localId: string) => {
    onChange({
      ...values,
      guardians: values.guardians.filter((g) => g.localId !== localId),
    })
  }

  const genderItems = [
    { value: 'male', label: t('students.gender.male') },
    { value: 'female', label: t('students.gender.female') },
  ]

  const statusItems = [
    { value: 'true', label: t('students.form.isActive.active') },
    { value: 'false', label: t('students.form.isActive.inactive') },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Card 1: Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('students.form.personal.title')}</CardTitle>
          <CardDescription>
            {t('students.form.personal.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>{t('students.form.saintName')}</FieldLabel>
              <Input
                value={values.saintName}
                onChange={(e) => setField('saintName', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>
                {t('students.form.fullName')}{' '}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={values.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('students.form.dateOfBirth')}</FieldLabel>
              <Input
                type="date"
                value={values.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('students.form.gender')}</FieldLabel>
              <Select
                value={values.gender}
                onValueChange={(val) =>
                  setField('gender', val as '' | 'male' | 'female')
                }
                items={genderItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('students.form.gender.placeholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {genderItems.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t('students.form.isActive')}</FieldLabel>
              <Select
                value={values.isActive ? 'true' : 'false'}
                onValueChange={(val) => setField('isActive', val === 'true')}
                items={statusItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t('students.form.previousParish')}</FieldLabel>
              <Input
                value={values.previousParish}
                onChange={(e) => setField('previousParish', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('students.form.previousDiocese')}</FieldLabel>
              <Input
                value={values.previousDiocese}
                onChange={(e) => setField('previousDiocese', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Address */}
      <Card>
        <CardHeader>
          <CardTitle>{t('students.form.address.title')}</CardTitle>
          <CardDescription>
            {t('students.form.address.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>{t('profile.address.line1')}</FieldLabel>
            <Input
              value={values.addressLine1}
              onChange={(e) => setField('addressLine1', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t('profile.address.line2')}</FieldLabel>
            <Input
              value={values.addressLine2}
              onChange={(e) => setField('addressLine2', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>{t('profile.address.city')}</FieldLabel>
              <Input
                value={values.city}
                onChange={(e) => setField('city', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('profile.address.state')}</FieldLabel>
              <Input
                value={values.stateProvince}
                onChange={(e) => setField('stateProvince', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('profile.address.hamlet')}</FieldLabel>
              <Input
                value={values.hamlet}
                onChange={(e) => setField('hamlet', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('profile.address.subHamlet')}</FieldLabel>
              <Input
                value={values.subHamlet}
                onChange={(e) => setField('subHamlet', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('profile.address.postal')}</FieldLabel>
              <Input
                value={values.postalCode}
                onChange={(e) => setField('postalCode', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Sacraments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('students.form.sacraments.title')}</CardTitle>
          <CardDescription>
            {t('students.form.sacraments.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {SACRAMENT_TYPES.map((type) => (
            <SacramentRow
              key={type}
              type={type}
              value={values.sacraments[type]}
              onChange={(updated) => setSacrament(type, updated)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Card 4: Guardians */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('students.form.guardians.title')}</CardTitle>
            <CardDescription>
              {t('students.form.guardians.description')}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addGuardian}
          >
            <Plus className="mr-1 size-4" />
            {t('students.form.guardian.add')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {values.guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.form.guardian.empty')}
            </p>
          ) : (
            values.guardians.map((g) => (
              <GuardianEntryRow
                key={g.localId}
                guardian={g}
                requesterId={requesterId}
                onChange={(updated) => updateGuardian(g.localId, updated)}
                onRemove={() => removeGuardian(g.localId)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Card 5: Enrollment (create only) */}
      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('students.form.enrollment.title')}</CardTitle>
            <CardDescription>
              {t('students.form.enrollment.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnrollmentSection
              requesterId={requesterId}
              enabled={values.enrollmentEnabled}
              classYearId={values.enrollmentClassYearId}
              enrolledDate={values.enrollmentDate}
              onEnabledChange={(v) => setField('enrollmentEnabled', v)}
              onClassYearChange={(v) => setField('enrollmentClassYearId', v)}
              onDateChange={(v) => setField('enrollmentDate', v)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Shared save helpers (used by both create and edit routes) ─────────────────

export function hasAddress(values: StudentFormValues): boolean {
  return !!(
    values.addressLine1 ||
    values.addressLine2 ||
    values.city ||
    values.stateProvince ||
    values.postalCode ||
    values.hamlet ||
    values.subHamlet
  )
}

export function buildAddressArgs(values: StudentFormValues) {
  return {
    country: DEFAULT_COUNTRY,
    addressLine1: values.addressLine1 || undefined,
    addressLine2: values.addressLine2 || undefined,
    city: values.city || undefined,
    stateProvince: values.stateProvince || undefined,
    postalCode: values.postalCode || undefined,
    hamlet: values.hamlet || undefined,
    subHamlet: values.subHamlet || undefined,
  }
}
